# {{name}}

{{description}}

> 由 [create-dsh](https://github.com/deepseek-ai/deepseek-harness) 生成的 DeepSeek Harness 插件项目（TypeScript）。

## 目录结构

```
.
├── cordis.patch.yml   # 插件组合包 patch：把插件插入 profile 的 Cordis 树
├── package.json       # 含 dsh.bundle.patch / engines.dsh 等插件元数据
├── tsconfig.json      # TypeScript 配置（输出到 lib/）
├── src/
│   └── index.ts       # 插件入口（导出 name / Config / apply）
└── locale/
    ├── en.json        # 英文显示名
    └── zh.json        # 中文显示名与描述
```

## 开发

```sh
pnpm install    # 安装依赖（TypeScript、cordis、schemastery 等）
pnpm build      # 编译到 lib/（lib/index.js + lib/types/index.d.ts）
pnpm dev        # 监听模式编译
```

> 也可用 `npm install` / `npm run build` 替换，效果相同。

## 本地加载到 DSH

编译后，在插件项目目录执行：

```sh
dsh web --patch ./cordis.patch.yml
```

`--patch` 会把 `cordis.patch.yml` 作为一层 patch 覆盖到 profile 上；
其中 `name: ./lib/index.js` 是相对本文件的路径，会被转换为 file URL 直接加载。

也可以把它当作本地包安装进某个 profile：

```sh
dsh plugin --profile web add .
```

## 配置

`src/index.ts` 中导出的 `Config`（schemastery Schema）就是插件的配置结构，
DSH 会用它校验配置并生成配置界面。可在 `cordis.patch.yml` 的 `config:` 里写默认值。

## 发布

1. 修改 `package.json` 里的 `name` / `version` / `description` / `engines.dsh`（目标 DSH 版本，当前为 `{{dshVersion}}`）。
2. 运行 `pnpm build`，确认 `lib/` 已生成。
3. 执行 `npm publish`（或 `pnpm publish`）。

用户安装：`dsh plugin --profile <profile> add {{name}}`

## 依赖说明

- `@deepseek-ai/cordis` — Cordis 插件框架（peer dependency，由 DSH 运行时提供）
- `@deepseek-ai/schemastery` — 配置 Schema 校验（peer dependency）

## 更多

- Cordis 入门：`docs/cordis-primer`
- DSH profile 与组合包：`docs/app-boot`
