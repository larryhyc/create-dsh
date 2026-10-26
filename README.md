# create-dsh

一键创建 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件项目，类似 `create-vite` 的体验。

生成的项目开箱即用：`package.json`、`cordis.patch.yml`（组合包 patch）、TypeScript 配置、`locale/` 显示名、`.gitignore`、`README.md` 都已配好，只需写插件逻辑。

## 快速开始

```sh
# TypeScript（默认）
npx @larryhyc-org/create-dsh my-plugin

# JavaScript
npx @larryhyc-org/create-dsh my-plugin --js

# 指定 DSH 版本 + 创建后立即安装依赖
npx @larryhyc-org/create-dsh my-plugin --ts --dsh-version 0.2.1-rc.3 --install
```

也可以全局安装后使用（安装命令带 scope，日常命令仍是不带 scope 的 `create-dsh`）：

```sh
npm i -g @larryhyc-org/create-dsh
create-dsh my-plugin
```

或直接用本仓库运行：

```sh
node bin/create-dsh.js my-plugin
```

## 交互式创建

不带 `--ts` / `--js` 时，会用**上下键选择、回车确认**（类似 `create-vite`）：

```sh
create-dsh my-plugin
```

界面示例：

```
? 选择语言
❯ TypeScript   推荐
  JavaScript
```

创建完成后会让你选择包管理器来安装依赖：

```
? 选择包管理器安装依赖
❯ pnpm   推荐
  npm
  yarn
  bun
  不安装
```

> 带 `--ts` / `--js` / `--yes` 参数时不会弹出交互，适合脚本或 CI。想跳过选择直接安装，用 `--install` 搭配 `--package-manager <pm>`。

## 选项

| 选项 | 说明 |
| --- | --- |
| `-t, --template <ts\|js>` | 语言：TypeScript 或 JavaScript |
| `--ts` / `--js` | `-t ts` / `-t js` 的简写 |
| `--description <文本>` | 插件描述（写入 package.json 与 README） |
| `--dsh-version <版本>` | 目标 DSH 版本（写入 `engines.dsh`，默认 `0.2.1-rc.3`） |
| `-p, --package-manager <pm>` | 安装依赖用的包管理器：npm / pnpm / yarn / bun |
| `-i, --install` | 创建后立即安装依赖 |
| `-y, --yes` | 跳过交互，使用默认值 |
| `-v, --version` | 输出版本号 |
| `-h, --help` | 显示帮助 |

## 生成的项目结构（TypeScript）

```
my-plugin/
├── package.json       # name/version/exports/engines.dsh/dsh.bundle.patch ...
├── tsconfig.json      # 编译到 lib/index.js + lib/types/index.d.ts
├── cordis.patch.yml   # 把插件作为 entry 插入 profile 的 Cordis 树
├── src/index.ts       # 导出 name / Config / apply
├── locale/{en,zh}.json
├── .gitignore
└── README.md
```

## 本地开发流程

```sh
cd my-plugin
pnpm install && pnpm build      # 编译（JS 项目可跳过 build）
dsh web --patch ./cordis.patch.yml   # 加载到 DSH
```

## 说明

- 依赖版本与当前 DSH 运行时对齐：`@deepseek-ai/cordis@~4.0.5`、`@deepseek-ai/schemastery@~3.18.5`、`@deepseek-ai/dsh-tools@0.2.1-rc.3`。
- 这三个 peer 依赖都通过 `peerDependenciesMeta` 标记为 `optional`（由 DSH 运行时提供）。需要给模型注册工具时，直接 `import` `@deepseek-ai/dsh-tools` 即可，不用额外装。
- `engines.dsh` 默认 `0.2.1-rc.3`，可在 `src/index.js` 里改 `DEFAULT_DSH_VERSION` 或发布前手动修改 `package.json`。
- 发布后用户通过 `dsh plugin --profile <profile> add <包名>` 安装。

## License

MIT
