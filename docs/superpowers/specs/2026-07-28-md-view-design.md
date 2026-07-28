# md-view 设计文档

## 概述

md-view 是一个纯静态的 Markdown 文档查看与临时编辑工具。用户通过 URL `?url=` 参数传入在线 md 地址,工具加载并渲染展示;支持切换到编辑模式进行临时修改,修改后的内容可导出为 `.md` 文件。打包产物为静态 HTML,可双击或部署到任意静态托管服务使用。

## 目标与非目标

### 目标
- 纯静态部署:Vite + 原生 TS 打包,产物可离线使用
- 在线 md 加载:`?url=` 参数指定源地址,仅支持 CORS 友好源
- 预览为主、可切编辑:默认只读预览,一键切换到编辑模式
- 临时编辑:编辑内容不持久化,可导出 `.md`
- 单 Vditor 实例:利用 Vditor 模式切换能力,避免销毁重建

### 非目标
- 不做用户认证、多用户、协作
- 不做后端服务、后端代理(纯前端)
- 不做内容持久化(无数据库、无 IndexedDB)
- 不做本地文件选择(无文件选择按钮、无拖拽上传)
- 不支持 `file://` URL:浏览器从 `http(s)` 页面 `fetch('file://...')` 会被拦截,从 `file://` 页面 `fetch` 远程 URL 仍受 CORS 限制。`?url=` 仅接受 `http(s)` 协议
- 不绕过 CORS 限制

## 技术栈

- **构建**:Vite
- **语言**:原生 TypeScript
- **核心库**:Vditor(通过 npm 安装,Vite 打包进产物,避免运行时依赖 CDN)
- **测试**:Vitest + jsdom

> **Vite 打包注记**:Vditor 自带动态 import、web worker 和运行时 CDN 资源(Lute WASM、字体等),Vite 打包时可能需要调整 `optimizeDeps` / 静态资源配置。实现阶段需为 Vite 配置预留调试时间,并锁定 Vditor 版本以避免 DOM 结构变化影响模式切换的 CSS 选择器。

## 架构

### 项目结构

```
md-view/
├── index.html              # 入口 HTML
├── src/
│   ├── main.ts             # 应用入口:解析 URL -> 拉取 md -> 初始化 Vditor
│   ├── vditor-instance.ts  # Vditor 实例封装:创建、模式切换、内容获取
│   ├── load-md.ts          # 远程 md 拉取,含错误处理
│   ├── toolbar.ts          # 顶部工具栏:模式切换、导出、复制、原文链接
│   └── style.css           # 全局样式(工具栏、错误态、加载态)
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### 模块职责

各模块独立,通过明确接口通信,可单独理解和测试:

- **`load-md.ts`**:只管拉取文本。输入 URL,输出 `FetchResult`。不关心 UI。
- **`vditor-instance.ts`**:只管 Vditor 实例。输入容器+初始内容,提供 `switchToPreview/switchToEdit/getContent/setContent/destroy`。不关心数据来源。
- **`toolbar.ts`**:只管工具栏 UI 和事件。通过 `IVditorInstance` 接口操作编辑器,不直接操作 Vditor。不关心数据来源。
- **`main.ts`**:编排。解析 URL -> 调用 `load-md` -> 调用 `vditor-instance` -> 挂载 `toolbar`。处理错误态和加载态 UI。

### 数据流

```
URL ?url=
  ↓
load-md.ts
  ↓
md 文本
  ↓
vditor-instance.ts
  ↓
Vditor 渲染
  ↑
toolbar.ts 触发模式切换/导出/复制
```

### 页面布局

```
┌─────────────────────────────────────┐
│ 工具栏(固定,约 48px)               │
│ [编辑/预览] [导出] [复制] [原文链接] │
├─────────────────────────────────────┤
│                                     │
│  Vditor 实例(占满剩余视口)         │
│                                     │
└─────────────────────────────────────┘
```

`index.html` 结构:
```html
<body>
  <div id="toolbar"></div>
  <div id="editor"></div>
</body>
```

## 组件设计

### Vditor 实例与模式切换(方案 A)

**单实例,两模式**,通过 Vditor 的 `sv` 模式 + CSS 控制源码区显隐实现:

| 模式 | 显示区域 | 编辑能力 |
|---|---|---|
| 预览(默认) | 仅显示 `.vditor-preview` | 隐藏源码区,只读 |
| 编辑 | 源码区 + 预览区(分屏) | 可编辑 |

**模式切换实现**:给 Vditor 容器加 CSS class:
- `.mode-preview`:`.vditor-sv { display: none }`,仅显示 `.vditor-preview`
- `.mode-edit`:两者都显示,默认左右分栏

**`vditor-instance.ts` 接口**:
```ts
export interface IVditorInstance {
  init(container: HTMLElement, initialMd: string): Promise<void>;
  switchToPreview(): void;
  switchToEdit(): void;
  getContent(): string;
  setContent(md: string): void;
  destroy(): void;
}
```

### 远程 md 拉取与错误处理

**`load-md.ts` 接口**:
```ts
export type FetchResult =
  | { ok: true; md: string; url: string }
  | { ok: false; error: FetchError };

export type FetchError =
  | { kind: 'no_url' }
  | { kind: 'network' }
  | { kind: 'cors' }
  | { kind: 'http'; status: number }
  | { kind: 'empty' };

export async function loadMd(url: string): Promise<FetchResult>;
```

**参数校验职责划分**:
- `main.ts` 负责"参数是否存在":解析 `location.search`,无 `url` 参数或参数为空字符串 -> 不调用 `loadMd`,直接渲染 `no_url` 错误态
- `load-md.ts` 负责"格式是否合法":`url` 非 `http(s)` 开头 -> 返回 `{ ok: false, error: { kind: 'no_url' } }`

**拉取流程**(在 `load-md.ts` 内,接收已解析出的 url 字符串):
1. 校验 url 非 `http(s)` 开头,返回 `no_url`
2. `fetch(url)` 拉取,设置 `Accept: text/plain, text/markdown`
3. 使用 `AbortController`,10 秒超时归为 `network`
4. HTTP 非 2xx -> `http` 错误(携带 status)
5. 响应内容为空 -> `empty`
6. 网络异常 -> 归为 `cors`/`network`(浏览器对 CORS 失败只抛 `TypeError`,UI 文案两者并列提示)

**错误态 UI**(在 `main.ts` 中渲染到容器,替换 Vditor):
- `no_url`:提示"请在 URL 加 `?url=md文件地址`",展示示例
- `cors`/`network`:提示"加载失败,可能是跨域限制(CORS)。请确认源允许跨域,或使用 CORS 友好源(GitHub raw、jsdelivr 等)"
- `http`:提示"加载失败:HTTP {status}"
- `empty`:提示"文件内容为空"

**加载态**:拉取期间容器显示 loading spinner。

### 工具栏与导出

**`toolbar.ts` 顶部工具栏**:

| 按钮 | 行为 | 预览态可见 | 编辑态可见 |
|---|---|---|---|
| 模式切换 | 切换到另一模式(标签随当前模式变化:"编辑"/"预览") | ✓ | ✓ |
| 导出 .md | 下载当前内容的 `.md` 文件 | ✓ | ✓ |
| 复制 | 复制当前 md 到剪贴板 | ✓ | ✓ |
| 原文链接 | 新标签打开 `?url=` 的原始地址 | ✓ | ✓ |

**按钮状态**:
- 预览态:模式按钮显示"编辑"
- 编辑态:模式按钮显示"预览"
- 复制成功:按钮文案临时变"已复制",2 秒后恢复

**导出 .md 实现**:
```ts
function exportMd(md: string, filename: string): void {
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

**文件名**:从 `?url=` 提取路径最后一段(如 `https://x.com/docs/readme.md` -> `readme.md`);提取失败用 `document.md`。

**复制实现**:优先 `navigator.clipboard.writeText`,失败回退 `document.execCommand('copy')`。

**`toolbar.ts` 接口**:
```ts
export interface ToolbarConfig {
  vditor: IVditorInstance;
  sourceUrl: string | null;
}

export function mountToolbar(container: HTMLElement, config: ToolbarConfig): void;
```

### 入口编排

**`main.ts` 编排流程**:

```
页面加载
  ↓
解析 ?url=
  ├─ 无 url -> 渲染 no_url 错误态,结束
  └─ 有 url
       ↓
     显示 loading
       ↓
     loadMd(url)
       ├─ 失败 -> 渲染对应错误态,结束
       └─ 成功 (md)
            ↓
          创建 Vditor 实例,init(container, md)  // 默认预览态
            ↓
          mountToolbar(toolbar, { vditor, sourceUrl: url })
            ↓
          移除 loading
```

**关键点**:
- 错误态优先于 Vditor 初始化--拉取失败不创建实例,容器直接渲染错误信息
- 工具栏和 Vditor 共享同一个 `IVditorInstance` 引用,工具栏通过它触发模式切换和获取内容

## 测试策略

### 测试分层

| 层 | 工具 | 覆盖范围 |
|---|---|---|
| 单元测试 | Vitest | `load-md.ts` 解析逻辑、`toolbar.ts` 文件名提取、URL 校验 |
| DOM 集成 | Vitest + jsdom | `main.ts` 编排流程、错误态渲染 |
| Vditor 交互 | 手动验证 | 模式切换、导出、复制(Vditor 内部行为不测) |

### 重点单元测试

- `load-md.ts`:各种错误类型正确分类(`no_url`/`cors`/`http`/`empty`/`network`)
- 文件名提取:正常路径、无后缀、带 query string、URL 编码字符
- URL 校验:`http`/`https` 通过,相对路径拒绝,空值拒绝

### 手动验证清单

- 加载 GitHub raw 文件(`https://raw.githubusercontent.com/...`)
- 加载 jsdelivr 文件(`https://cdn.jsdelivr.net/...`)
- 加载 CORS 拒绝的源,确认错误提示正确
- 模式切换:预览 ⇄ 编辑,内容一致
- 导出 .md:文件名正确,内容与编辑后一致
- 复制:剪贴板内容正确
- 无 `?url=`:显示 `no_url` 错误态

## Vditor 内置能力(无需额外开发)

Vditor 自带以下能力,直接配置启用即可:
- 完整 GFM(表格、任务列表、删除线、脚注等)
- 代码高亮(基于 PrismJS)
- mermaid 流程图
- KaTeX 数学公式
- 目录大纲
- 快捷键
- Emoji

## 部署形态

- `vite build` 产出静态文件(`dist/`)
- 可直接部署到 GitHub Pages、Netlify、Vercel 等静态托管
- 也可双击 `dist/index.html` 离线使用(注意 `file://` 协议下浏览器对远程 `fetch` 的限制更严格,可能被完全拦截,建议通过 HTTP 服务器访问)
