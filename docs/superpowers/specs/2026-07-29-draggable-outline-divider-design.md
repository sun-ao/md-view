# 可拖拽大纲分隔条设计

日期: 2026-07-29
状态: 已批准(待 spec 评审)

## 背景与目标

md-view 预览页采用 `#outline`(大纲) + `#editor`(内容)横向 flex 布局。当前两者之间的"竖线"仅是 `#outline` 的 `border-right: 1px solid`,宽度固定 260px,无法调整。

目标:在大纲与内容之间增加一条可左右拖拽的分隔条,让用户自由调整大纲宽度。

## 需求

- 用户可拖拽分隔条左右移动,实时调整 `#outline` 宽度
- 宽度范围限制:160px ~ 480px
- 双击分隔条重置宽度到默认值 260px
- 宽度**不持久化**,每次刷新页面回到默认 260px
- 与现有状态联动:编辑模式、用户隐藏大纲、窄屏(≤768px)时分隔条同样隐藏
- 无标题(outline 未挂载)时分隔条不出现

## 方案

采用独立模块 `divider.ts` + 新增 `<div class="resizer">` 元素,与现有 `toolbar.ts` / `outline.ts` 的 `mount*` 命令式 DOM 风格一致。

### DOM 结构

`index.html` 在 `#outline` 与 `#editor` 之间插入分隔条:

```html
<div id="app">
  <aside id="outline"></aside>
  <div class="resizer" id="resizer"></div>
  <div id="editor"></div>
</div>
```

### 模块边界

- `src/divider.ts` — 拖拽逻辑,导出 `mountResizer(resizerEl, outlineEl): ResizerHandle`
- `ResizerHandle` 含 `destroy()`,与 `OutlineHandle` 风格一致
- `main.ts` 在 `mountOutline` 成功(返回非 null handle,即有标题)后才调用 `mountResizer`;`mountOutline` 返回 null 时 resizer 保持默认隐藏,不调用 `mountResizer`
- `style.css` — 分隔条视觉与隐藏规则

### 拖拽交互(Pointer Events)

常量:`MIN_WIDTH = 160`、`MAX_WIDTH = 480`、`DEFAULT_WIDTH = 260`

流程(所有监听器挂在 resizer 元素上,`setPointerCapture` 把后续指针事件路由到 resizer,无需在 window/document 上挂全局监听):
1. `pointerdown` 在 resizer 上:记录起始 `clientX` 和起始 `outlineWidth`,`setPointerCapture(e.pointerId)`,加 `dragging` 类
2. `pointermove`(resizer 上):`newWidth = startWidth + (e.clientX - startX)`,经 `clampWidth` 夹取后赋值给 `outlineEl.style.width`
3. `pointerup` / `pointercancel`(resizer 上):释放 capture,移除 `dragging` 类

双击:`dblclick` 事件 → `outlineEl.style.width = DEFAULT_WIDTH + 'px'`

### 边界情形

隐藏规则通过 CSS class 组合实现,避免 inline style 与 CSS 规则的优先级冲突:

- resizer 默认 `display:none`(见 CSS)
- `mountResizer` 成功后给 resizer 加 `mounted` 类,基础规则 `.resizer.mounted { display: block }` 让它可见
- 三条隐藏规则都带 `.mounted` 且特异性更高,覆盖可见规则:
  - 编辑模式:`#app:has(#editor.mode-edit) .resizer.mounted { display: none }`
  - 用户隐藏大纲:`#outline.outline-hidden ~ .resizer.mounted { display: none }`
  - 窄屏(≤768px):`@media (max-width: 768px) { .resizer.mounted { display: none } }`
- 无标题:resizer 默认 `display:none` 且 `mountResizer` 不被调用,自然不出现

### CSS 视觉

```css
.resizer {
  width: 6px;
  flex-shrink: 0;
  height: 100%;
  cursor: col-resize;
  background: #e0e0e0;
  position: relative;
  z-index: 1;
  display: none;          /* 默认隐藏,mountResizer 加 .mounted 类后显示 */
  user-select: none;
}
.resizer.mounted { display: block; }
.resizer.dragging { background: #bdbdbd; }
.resizer:hover { background: #bdbdbd; }

#app:has(#editor.mode-edit) .resizer.mounted { display: none; }
#outline.outline-hidden ~ .resizer.mounted { display: none; }
@media (max-width: 768px) {
  .resizer.mounted { display: none; }
}
```

- `#outline` 的 `border-right: 1px solid #e0e0e0` **删除**(避免双线,视觉分割由 resizer 承担)
- 不用 inline style 控制可见性:inline `display` 会覆盖所有 CSS 隐藏规则,导致编辑模式 / 用户隐藏 / 窄屏时分隔条仍可见

### 测试策略(`src/divider.test.ts`)

纯函数 + DOM 行为分离:

- 导出纯函数 `clampWidth(width, min, max)`,直接单测边界夹取逻辑,`pointermove` 内部调用它
- DOM 行为(jsdom + 模拟 PointerEvent):
  - `mountResizer` 后 resizer 可见、outline 宽度仍是默认
  - `pointerdown` + `pointermove`(模拟 clientX 变化)→ outline 宽度按差值更新
  - 拖拽超过 MAX / 低于 MIN → 被 clamp
  - `dblclick` → 宽度重置为 260px
  - `destroy()` → 移除监听器,不再响应事件
- 不测纯视觉(CSS 声明)

### jsdom 已知缺口

- jsdom 不原生实现 `PointerEvent` 和 `setPointerCapture`。测试需 stub:`resizerEl.setPointerCapture = vi.fn()`、`resizerEl.releasePointerCapture = vi.fn()`,并用 `new PointerEvent('pointermove', { clientX: N })`(jsdom 的 `PointerEvent` 构造器在现代版本可用,不可用时退回 `new MouseEvent` 并手动赋值)。这与 CLAUDE.md 记录的 `URL.createObjectURL` / `navigator.clipboard` stub 模式一致。

## 不做

- 不持久化宽度到 localStorage(每次刷新重置)
- 不做拖拽时的全屏遮罩 / iframe 遮挡处理(当前页面无 iframe)
- 不支持触摸笔压感等高级指针特性(Pointer Events 已统一,无需额外处理)
