# dsh-model-block-picker

[English](README.en.md) | 中文

DeepSeek Harness (DSH) 插件 —— **按模型来源分块**的输入框模型选择器。

把官方那个「所有模型拉成一条长列表」的选择器，换成**先按来源渠道分块、再下钻进块内选模型**的两级结构；搜索、推理强度（Reasoning Effort）、模型可用性等原有能力**完全保留**。

---

## 功能

- **按来源分块**：DeepSeek 账号、DeepSeek API，以及 CodeBuddy / Qoder / TRAE 等第三方渠道，各自成为一张卡片；卡片上显示来源名、模型数量，当前所用来源带「当前」标记。
- **两级下钻**：点卡片 → 进入该渠道内只含它自己模型的列表；顶部 `← 所有来源` 或 `Esc` 返回。
- **全局搜索**：直接输入 `v3` / `sonnet` / `r1` 等关键词即可跨所有来源聚合匹配，回车选中首项；清空即回到分块视图。
- **推理强度保留**：当前模型支持 reasoning 时，浮层底部出现强度选择器（默认 / low / medium / high…）。
- **主题自适应**：浅色、深色均用 DSH 主题 token；深色下触发按钮为黑底 + 主题 off-white 描边/文字，与同排麦克风、截图图标同一设计语言。

## 安装

### 从本机目录安装（开发 / 自用）

在 DSH 会话里对 Agent 说：

> 帮我安装位于 `<本仓库路径>` 的插件

Agent 会执行 `plugin_manager(action: 'install_bundle', target: '<绝对路径>')`。

安装后**彻底退出 DSH 桌面端再重新打开**（客户端 bundle 有启动基线缓存，仅刷新页面不一定加载新代码）。

卸载：`plugin_manager(action: 'remove_bundle', target: 'dsh-model-block-picker')`，回退到官方原生选择器。

## 它是怎么工作的

### 1. 覆盖官方选择器（Slot 影射）

输入框模型位是 DSH 公开的一个**命名插槽**：`conversation.input.model`（`kind: "single"`，会话作用域）。

- 官方实现注册在优先级 `-10`；
- 动态安装的插件注册同名插槽时，系统分配**更低的数值即更高优先级**获胜；
- 本插件显式注册 `priority: -20`，因此作为 winner 覆盖原生组件，卸载即自动回退。

> 注意：`single` 槽位要求同优先级唯一，所以必须用负数优先级，否则会抛
> `single slot already has a registration`。

### 2. 复用官方数据服务（不重复造轮子）

不自己请求后端。通过 `ctx.modelDirectories`：

```js
const directory = models.directoryFor(sessionId);
directory.store   // 快照：{ groups: [{ id, name, models: [...] }], current: { provider, model, reasoningEffort } }
directory.load()  // 拉取目录
directory.select({ provider, model, reasoningEffort })  // 提交选择
```

与 `/model` 命令弹窗**共用同一份会话级目录**，任一入口的切换另一入口立即可见。

### 3. 深色外观的白，来自主题而不是硬编码

早期版本手写 `#1c1f23` 之类的兜底色，在深色下不会反转，导致字和箭头变深灰。现在全部改用真实 token：

| 用途 | token | 深色取值 |
|---|---|---|
| 主文本 | `--dsw-alias-label-primary` | `#f9fafb`（off-white，非纯白） |
| 边框 | `--dsw-alias-border-l1` | `#ffffff0f` |
| 背景 | `--dsw-alias-bg-layer-1/2`、`--dsw-alias-bg-overlay` | — |
| 品牌色 | `--dsw-alias-brand-primary` | — |

深色下额外用 `body[data-ds-dark-theme]` 把触发按钮设为 `.5px` 描边 + 该 token，与右侧截图插件
（`color: var(--dsw-alias-label-primary)` + `fill:none stroke=currentColor stroke-width=1`）
保持同一笔画重量。

> **踩坑记录**：写 CSS 时**别凭印象编变量名**。DSH 里**不存在**
> `--dsw-alias-text-regular`、`--dsw-alias-border-subtle`、`--dsw-alias-surface-overlay`、
> `--dsw-alias-primary` 这些名字——它们会静默回落到你写的兜底值，浅色看着没事、深色就崩。
> 可用 `cordis_inspect_query(platform: 'client', provider: 'Theme', method: 'listTokens')` 查真实 token。

## 文件结构

```
dsh-model-block-picker/
├── package.json          # 清单：dsh.bundle.patch + dsh.client 声明
├── cordis.patch.yml      # Loader patch：把本包插进 profile 名单
├── index.js              # 宿主半边（挂 /diag 诊断路由）
├── client.js             # 浏览器半边：React 组件 + 样式 + 插槽注册
├── LICENSE
└── README.md
```

## 诊断

排障时会用到：

- 宿主侧日志前缀 `[dsh-model-block-picker]`（DSH 日志里搜这个）。
- 浏览器端各生命周期节点会打到 `/plugins/dsh-model-block-picker/diag`：
  `module-evaluated` → `apply-called` → `slot-inject-triggered` → `registered-success`。
  若停在 `register-error`，说明槽位/优先级冲突；停在 `apply-error` 多半是 `inject` 未声明就访问了服务。

> **另一个坑**：客户端沙箱对服务访问有白名单。顶层 `inject` 声明了 `['slots','modelDirectories']`，
> 就**不能**再直接读 `ctx.sessions`，否则抛 `service "sessions" is not declared` 并当场崩溃。

## 已知限制

- 只替换输入框（composer）的模型位；`/model` 命令弹窗仍是官方样式（两者共用同一份数据，切换互通）。
- 已寻址的 subagent 会话不提供模型选择（沿用官方约定）。
- 来源分组顺序：DeepSeek 账号 → DeepSeek 官方 → 其余按名称排；如需自定义顺序改 `client.js` 里的分组排序逻辑。

## 许可

MIT
