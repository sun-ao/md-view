# Toolbar 可见性参数化

## 背景

当前 `index.html` 固定渲染 `<div id="toolbar">`，`main.ts` 每次都挂载工具栏，占 48px 高度。需要改为默认隐藏，通过 URL 参数 `?toolbar=1` 控制 显示。

## 目标

- 默认场景（无参数）：不显示 toolbar，编辑区占满视口高度。
- opt-in 场景（`?toolbar=1`）：显示 toolbar，编辑区高度为 `calc(100vh - 48px)`，行为同现状。
- 默认场景首屏无闪烁：不出现"先占 48px 再隐藏"的跳变。
- 保持现有架构边界：`window.location` 只在 `main.ts` 解析。

## 方案

采用 CSS 默认隐藏 + `body.show-toolbar` 覆盖。

### 参数解析

在 `main.ts` 新增纯函数 `parseToolbarParam`，与 `parseUrlParam` 并列：

```ts
export function parseToolbarParam(search: string): boolean
```

规则：`toolbar` 参数值为 `1` 或 `true`（大小写不敏感）返回 `true`；省略或其它值返回 `false`。

```
parseToolbarParam('?url=xxx&toolbar=1')   -> true
parseToolbarParam('?url=xxx&toolbar=true')-> true
parseToolbarParam('?url=xxx&toolbar=0')   -> false
parseToolbarParam('?url=xxx&toolbar=')    -> false
parseToolbarParam('?url=xxx')             -> false
parseToolbarParam('')                     -> false
```

### CSS

`style.css` 调整：

- `#toolbar` 默认 `display: none`（原 `display: flex` 移到覆盖规则）。
- `#app` 默认 `height: 100vh`（原 `calc(100vh - 48px)` 移到覆盖规则）。
- 新增覆盖：
  ```css
  body.show-toolbar #toolbar { display: flex; }
  body.show-toolbar #app { height: calc(100vh - 48px); }
  ```

类挂在 `body` 上，一处控制 `#toolbar` 与 `#app` 两处联动。

### main.ts 流程

`main()` 在成功加载 md、拿到 `toolbarEl` 后、调用 `mountToolbar` 前判断（错误/加载态不需要 toolbar）：

1. `const showToolbar = parseToolbarParam(window.location.search)`
2. 若 `showToolbar`：`document.body.classList.add('show-toolbar')`，再调用 `mountToolbar` 拿 `toolbarHandle`。
3. 若不显示：不调用 `mountToolbar`，`toolbarHandle` 视为 `undefined`。

后续 outline 相关逻辑用可选链兼容 `toolbarHandle` 不存在：

- `toolbarHandle?.setOutlineToggleAvailable()`

toolbar 不显示时，大纲仍正常挂载和自动显示（用户已确认可接受，只是无法用按钮收起）。

`mountToolbar` 签名不变。

## 连带影响

- toolbar 隐藏时，其中的所有按钮均不可用：编辑/预览切换、导出、复制、原文链接、隐藏/显示大纲。大纲侧栏仍按现有逻辑自动显示（用户已确认可接受，只是无法用按钮收起）。
- 其它模块（`load-md`、`vditor-instance`、`toolbar`、`outline`、`divider`）行为不变。

## 测试

- `main.test.ts`：新增 `parseToolbarParam` 纯函数单测（`1`/`true`/`TRUE`/`0`/`yes`/空值/省略 等边界）。
- `main.test.ts`：扩展现有 mock 用例，分别测 `show-toolbar` 类加/不加、`mountToolbar` 被调/不被调。
- 其它测试文件不动。
