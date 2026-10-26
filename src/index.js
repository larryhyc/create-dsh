import { promises as fs } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { stdout as output } from 'node:process'
import { createRequire } from 'node:module'
import { buildTypeScriptProject, buildJavaScriptProject } from './templates.js'
import { select, promptText } from './prompts.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

// 目标 DSH 版本（可用 --dsh-version 覆盖）
const DEFAULT_DSH_VERSION = '0.2.1-rc.3'

const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
}
const paint = (color, text) => (output.isTTY ? `${color}${text}${c.reset}` : text)

const HELP = `
${paint(c.bold, 'create-dsh')} — 一键创建 DeepSeek Harness 插件项目

用法：
  ${paint(c.cyan, 'create-dsh <项目名称> [选项]')}
  ${paint(c.cyan, 'create-dsh')}            # 交互式创建

选项：
  -t, --template <ts|js>       语言：TypeScript 或 JavaScript
      --ts / --js              -t ts / -t js 的简写
      --description <文本>      插件描述（写入 package.json 与 README）
      --dsh-version <版本>      目标 DSH 版本（engines.dsh，默认 ${DEFAULT_DSH_VERSION}）
  -p, --package-manager <pm>   安装依赖用的包管理器：npm | pnpm | yarn | bun
  -i, --install                创建后立即安装依赖
  -y, --yes                    跳过交互，使用默认值（语言默认 TypeScript）
  -v, --version                输出版本号
  -h, --help                   显示帮助

示例：
  ${paint(c.dim, '# TypeScript 插件')}
  create-dsh my-plugin
  ${paint(c.dim, '# JavaScript 插件，并指定 DSH 版本、立即安装')}
  create-dsh my-plugin --js --dsh-version 0.2.1-rc.3 --install
  ${paint(c.dim, '# scoped 包名')}
  create-dsh @scope/my-plugin --ts
`

function print(text = '') {
  output.write(`${text}\n`)
}

function fail(message) {
  print(`\n  ${paint(c.red, '✗')} ${message}\n`)
  process.exitCode = 1
}

function parseArgs(argv) {
  const opts = {
    name: undefined,
    template: undefined,
    description: undefined,
    dshVersion: undefined,
    packageManager: undefined,
    yes: false,
    install: false,
    help: false,
    version: false,
  }
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '-h':
      case '--help':
        opts.help = true
        break
      case '-v':
      case '-V':
      case '--version':
        opts.version = true
        break
      case '-y':
      case '--yes':
        opts.yes = true
        break
      case '-i':
      case '--install':
        opts.install = true
        break
      case '--ts':
      case '--typescript':
        opts.template = 'ts'
        break
      case '--js':
      case '--javascript':
        opts.template = 'js'
        break
      case '-t':
      case '--template':
        opts.template = argv[++i]
        break
      case '--description':
        opts.description = argv[++i]
        break
      case '--dsh-version':
        opts.dshVersion = argv[++i]
        break
      case '-p':
      case '--package-manager':
        opts.packageManager = argv[++i]
        break
      default:
        if (arg.startsWith('-')) {
          print(`${paint(c.yellow, '警告')}: 忽略未知选项 ${arg}`)
        } else {
          positional.push(arg)
        }
    }
  }
  opts.name = positional[0]
  return opts
}

function normalizeName(raw) {
  let name = String(raw ?? '').trim()
  if (name === '.') name = basename(resolve('.'))
  if (!name) return { error: '项目名称不能为空' }
  if (/\s/.test(name)) return { error: '项目名称不能包含空格' }
  name = name.toLowerCase()

  let scope = null
  let base = name
  const matched = /^@([^/]+)\/(.+)$/.exec(name)
  if (matched) {
    scope = matched[1]
    base = matched[2]
  }

  const validPart = (part) => /^[a-z0-9][a-z0-9._~-]*$/.test(part) && !part.startsWith('.') && !part.startsWith('_')
  if (scope !== null && !validPart(scope)) return { error: `scope 名称不合法：@${scope}` }
  if (!validPart(base)) return { error: `包名不合法：${base}（允许小写字母、数字、-、_、.、~，且不能以 . 或 _ 开头）` }
  if (name.length > 214) return { error: '包名过长（npm 限制 214 字符）' }

  return { name }
}

async function dirExists(path) {
  try {
    const stat = await fs.stat(path)
    return stat.isDirectory()
  } catch {
    return false
  }
}

async function writeFiles(targetDir, files) {
  for (const file of files) {
    const full = join(targetDir, file.path)
    await fs.mkdir(join(full, '..'), { recursive: true })
    await fs.writeFile(full, file.content, 'utf8')
  }
}

function detectPackageManager(explicit) {
  if (explicit) return explicit
  const userAgent = process.env.npm_config_user_agent ?? ''
  if (userAgent.startsWith('pnpm/')) return 'pnpm'
  if (userAgent.startsWith('yarn/')) return 'yarn'
  if (userAgent.startsWith('bun/')) return 'bun'
  return 'npm'
}

async function installDeps(targetDir, explicitPm) {
  const pm = detectPackageManager(explicitPm)
  const args = { npm: ['install'], pnpm: ['install'], yarn: [], bun: ['install'] }[pm]
  print(`\n  使用 ${paint(c.bold, pm)} 安装依赖...\n`)
  await new Promise((resolveInstall, rejectInstall) => {
    const child = spawn(pm, args, {
      cwd: targetDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    child.on('error', rejectInstall)
    child.on('exit', (code) => (code === 0 ? resolveInstall() : rejectInstall(new Error(`${pm} install 退出码 ${code}`))))
  })
}

export async function run(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv)
  if (opts.help) return print(HELP)
  if (opts.version) return print(pkg.version)

  // 1. 项目名称
  let name = opts.name
  if (!name && !opts.yes) {
    name = await promptText({ message: '项目名称（如 my-dsh-plugin）' })
  }
  const normalized = normalizeName(name)
  if (normalized.error) return fail(normalized.error)
  const packageName = normalized.name
  const id = packageName.replace(/^@[^/]+\//, '')

  // 2. 语言（上下键选择）
  let template = opts.template
  if (!template && opts.yes) template = 'ts'
  if (!template) {
    template = await select({
      message: '选择语言',
      options: [
        { label: 'TypeScript', value: 'ts', hint: '推荐' },
        { label: 'JavaScript', value: 'js' },
      ],
      defaultIndex: 0,
    })
  }
  if (template !== 'ts' && template !== 'js') return fail(`未知模板：${template}（可选 ts / js）`)

  // 3. 目标 DSH 版本与描述
  const dshVersion = opts.dshVersion || DEFAULT_DSH_VERSION
  const description = opts.description ?? 'A DeepSeek Harness plugin scaffolded by create-dsh.'

  const targetDir = join(process.cwd(), id)

  // 4. 目标目录检查
  if (await dirExists(targetDir)) {
    const existing = await fs.readdir(targetDir)
    if (existing.length) return fail(`目录已存在且非空：${targetDir}`)
  }

  // 5. 生成文件
  const vars = { name: packageName, id, description, dshVersion }
  const files = template === 'ts' ? buildTypeScriptProject(vars) : buildJavaScriptProject(vars)
  await writeFiles(targetDir, files)

  // 6. 汇总
  print('')
  print(`  ${paint(c.green, '✓')} 已创建 DSH 插件项目 ${paint(c.bold, packageName)}${paint(c.dim, `（${template.toUpperCase()}）`)}`)
  print(`    ${paint(c.dim, targetDir)}`)
  print('')
  print(`  ${paint(c.bold, '下一步：')}`)
  print(`    cd ${id}`)
  print(template === 'ts'
    ? `    ${paint(c.dim, '# 安装依赖并编译到 lib/')}\n    pnpm install && pnpm build`
    : `    ${paint(c.dim, '# 安装依赖（仅 peer，可选）')}\n    pnpm install`)
  print('')
  print(`  ${paint(c.bold, '本地加载到 DSH：')}`)
  print(`    dsh web --patch ./cordis.patch.yml`)
  print('')

  // 7. 选择包管理器安装依赖（上下键选择）
  if (opts.install) {
    await installDeps(targetDir, opts.packageManager)
  } else if (!opts.yes && output.isTTY && process.stdin.isTTY) {
    const choice = await select({
      message: '选择包管理器安装依赖',
      options: [
        { label: 'pnpm', value: 'pnpm', hint: '推荐' },
        { label: 'npm', value: 'npm' },
        { label: 'yarn', value: 'yarn' },
        { label: 'bun', value: 'bun' },
        { label: '不安装', value: null },
      ],
      defaultIndex: 0,
    })
    if (choice) await installDeps(targetDir, choice)
  }
}
