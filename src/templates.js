import { readFileSync } from 'node:fs'

// 依赖版本（与当前 DSH 运行时对齐，可按需调整）
const CORDIS_VERSION = '~4.0.5'
const SCHEMASTERY_VERSION = '~3.18.5'
const TYPESCRIPT_VERSION = '^5.6.3'
const TYPES_NODE_VERSION = '^24.0.0'
const NODE_MIN = '>=24'

const KEYWORDS = ['dsh', 'dsh-plugin', 'deepseek-harness']

// 生成到插件项目里的 .gitignore 内容。
// 注意：npm 打包时会无条件排除任何名为 .gitignore 的文件，
// 所以这里用字符串内联，而不是把 .gitignore 当模板文件发布。
const GITIGNORE = [
  'node_modules/',
  'lib/',
  'dist/',
  '*.tsbuildinfo',
  '*.log',
  '.DS_Store',
  '',
].join('\n')

function basePackageJson(vars) {
  const { name, description, dshVersion } = vars
  return {
    name,
    version: '0.1.0',
    description,
    type: 'module',
    engines: { node: NODE_MIN, dsh: dshVersion },
    dsh: { manifestVersion: 1, bundle: { patch: './cordis.patch.yml' } },
    keywords: KEYWORDS,
    license: 'MIT',
    peerDependencies: {
      '@deepseek-ai/cordis': CORDIS_VERSION,
      '@deepseek-ai/dsh-tools': dshVersion,
      '@deepseek-ai/schemastery': SCHEMASTERY_VERSION,
    },
    // 这些包由 DSH 运行时提供，标记 optional 可避免安装时的 peer 警告。
    // 需要给模型注册工具时，从 @deepseek-ai/dsh-tools 导入即可。
    peerDependenciesMeta: {
      '@deepseek-ai/cordis': { optional: true },
      '@deepseek-ai/dsh-tools': { optional: true },
      '@deepseek-ai/schemastery': { optional: true },
    },
  }
}

function packageJsonTs(vars) {
  return {
    ...basePackageJson(vars),
    main: 'lib/index.js',
    types: 'lib/types/index.d.ts',
    exports: {
      '.': { types: './lib/types/index.d.ts', default: './lib/index.js' },
      './package.json': './package.json',
      './locale/*.json': './locale/*.json',
    },
    files: ['lib', 'cordis.patch.yml', 'locale'],
    scripts: {
      build: 'tsc',
      dev: 'tsc --watch',
      prepublishOnly: 'npm run build',
    },
    devDependencies: {
      '@deepseek-ai/cordis': CORDIS_VERSION,
      '@deepseek-ai/dsh-tools': vars.dshVersion,
      '@deepseek-ai/schemastery': SCHEMASTERY_VERSION,
      typescript: TYPESCRIPT_VERSION,
      '@types/node': TYPES_NODE_VERSION,
    },
  }
}

function packageJsonJs(vars) {
  return {
    ...basePackageJson(vars),
    main: 'src/index.js',
    exports: {
      '.': './src/index.js',
      './package.json': './package.json',
      './locale/*.json': './locale/*.json',
    },
    files: ['src', 'cordis.patch.yml', 'locale'],
    devDependencies: {
      '@deepseek-ai/cordis': CORDIS_VERSION,
      '@deepseek-ai/dsh-tools': vars.dshVersion,
      '@deepseek-ai/schemastery': SCHEMASTERY_VERSION,
    },
  }
}

function tsconfigJson() {
  return {
    compilerOptions: {
      target: 'ES2022',
      lib: ['ES2022'],
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      rootDir: 'src',
      outDir: 'lib',
      declaration: true,
      declarationDir: 'lib/types',
      declarationMap: true,
      sourceMap: true,
      strict: true,
      esModuleInterop: true,
      isolatedModules: true,
      verbatimModuleSyntax: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      types: ['node'],
    },
    include: ['src'],
  }
}

function cordisPatch(vars, entryPath) {
  const { id } = vars
  return [
    '# DSH 插件组合包 patch（由 create-dsh 生成）',
    '#',
    '# 发布后，DSH 会依据 package.json 里的 dsh.bundle.patch 自动应用本文件；',
    '# 本地开发时可直接：dsh web --patch ./cordis.patch.yml',
    '#',
    '# - id:      profile 内唯一的条目 id（可用它覆盖配置或禁用插件）',
    '# - name:    插件入口模块（相对本文件的路径会被转换为 file URL）',
    '# - config:  可选，插件默认配置（与 src 里导出的 Config Schema 对应）',
    '# - inject:  可选，声明依赖的服务，全部可用后插件才会启动',
    '- insert:',
    `    - id: ${id}`,
    `      name: ${entryPath}`,
    '      # config:',
    '      #   greeting: Hello from DSH!',
    '',
  ].join('\n')
}

function indexTs(vars) {
  const { id } = vars
  return `import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

// 插件名：显示在 loader 日志与诊断里
export const name = '${id}'

// 配置 Schema：DSH 用它校验配置，并（可选）为配置界面生成表单
export const Config = z.object({
  greeting: z.string().default('Hello, world!').description('示例配置项'),
})

// （可选）声明依赖的服务，全部可用后插件才会启动
// export const inject = ['logger']

// 需要给模型注册可调用工具时，使用 @deepseek-ai/dsh-tools（已在 package.json 依赖中）

// 插件主体：ctx 是 Cordis 上下文，config 是经过 Config 校验后的配置
export function apply(ctx: Context, config: ReturnType<typeof Config>) {
  ctx.logger.info('[%s] loaded with greeting: %s', name, config.greeting)

  // 在这里编写插件逻辑，例如：
  //   ctx.on('some/event', (payload) => { ... })     // 监听事件（随插件一起卸载）
  //   ctx.inject(['logger'], (ctx) => { ... })       // 等待某服务可用后再执行
  //   ctx.plugin(AnotherPlugin, { ... })             // 挂载其他插件
}
`
}

function indexJs(vars) {
  const { id } = vars
  return `import z from '@deepseek-ai/schemastery'

// 插件名：显示在 loader 日志与诊断里
export const name = '${id}'

// 配置 Schema：DSH 用它校验配置，并（可选）为配置界面生成表单
export const Config = z.object({
  greeting: z.string().default('Hello, world!').description('示例配置项'),
})

// 需要给模型注册可调用工具时，使用 @deepseek-ai/dsh-tools（已在 package.json 依赖中）

// 插件主体：ctx 是 Cordis 上下文，config 是经过 Config 校验后的配置
export function apply(ctx, config) {
  ctx.logger.info('[%s] loaded with greeting: %s', name, config.greeting)
}
`
}

function localeEn(vars) {
  return { meta: { title: vars.id } }
}

function localeZh(vars) {
  return {
    meta: {
      title: vars.id,
      description: `${vars.id} — 一个 DeepSeek Harness 插件。`,
    },
  }
}

function readTemplate(rel, vars) {
  const content = readFileSync(new URL(`../templates/${rel}`, import.meta.url), 'utf8')
  return content
    .replaceAll('{{name}}', vars.name)
    .replaceAll('{{id}}', vars.id)
    .replaceAll('{{description}}', vars.description)
    .replaceAll('{{dshVersion}}', vars.dshVersion)
}

export function buildTypeScriptProject(vars) {
  return [
    { path: 'package.json', content: JSON.stringify(packageJsonTs(vars), null, 2) + '\n' },
    { path: 'tsconfig.json', content: JSON.stringify(tsconfigJson(), null, 2) + '\n' },
    { path: 'cordis.patch.yml', content: cordisPatch(vars, './lib/index.js') },
    { path: 'src/index.ts', content: indexTs(vars) },
    { path: 'locale/en.json', content: JSON.stringify(localeEn(vars), null, 2) + '\n' },
    { path: 'locale/zh.json', content: JSON.stringify(localeZh(vars), null, 2) + '\n' },
    { path: '.gitignore', content: GITIGNORE },
    { path: 'README.md', content: readTemplate('ts/README.md', vars) },
  ]
}

export function buildJavaScriptProject(vars) {
  return [
    { path: 'package.json', content: JSON.stringify(packageJsonJs(vars), null, 2) + '\n' },
    { path: 'cordis.patch.yml', content: cordisPatch(vars, './src/index.js') },
    { path: 'src/index.js', content: indexJs(vars) },
    { path: 'locale/en.json', content: JSON.stringify(localeEn(vars), null, 2) + '\n' },
    { path: 'locale/zh.json', content: JSON.stringify(localeZh(vars), null, 2) + '\n' },
    { path: '.gitignore', content: GITIGNORE },
    { path: 'README.md', content: readTemplate('js/README.md', vars) },
  ]
}
