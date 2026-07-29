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
- `main.ts` 在 `mountOutline` 成功(有标题)后才调用 `mountResizer`
- `style.css` — 分隔条视觉与隐藏规则

### 拖拽交互(Pointer Events)

常量:`MIN_WIDTH = 160`、`MAX_WIDTH = 480`、`DEFAULT_WIDTH = 260`

流程:
1. `pointerdown` 在 resizer 上:记录起始 `clientX` 和起始 `outlineWidth`,`setPointerCapture(e.pointerId)`,加 `dragging` 类
2. `pointermove`:`newWidth = startWidth + (e.clientX - startX)`,经 `clampWidth` 夹取后赋值给 `outlineEl.style.width`
3. `pointerup` / `pointercancel`:释放 capture,移除 `dragging` 类

双击:`dblclick` 事件 → `outlineEl.style.width = DEFAULT_WIDTH + 'px'`

### 边界情形

- 编辑模式:补 `#app:has(#editor.mode-edit) #resizer { display: none }`(display:none 元素不接收 pointerdown,逻辑自然不触发)
- 用户隐藏大纲:补 `#outline.outline-hidden ~ #resizer { display: none }`(resizer 是 outline 的后续兄弟,`~` 成立)
- 窄屏(≤768px):补 `@media (max-width: 768px) { #resizer { display: none } }`
- 无标题:resizer 默认 `display:none`,`mountResizer` 成功后显式设为可见

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
  display: none;          /* 默认隐藏,mountResizer 成功后显示 */
  user-select: none;
}
.resizer.dragging { background: #bdbdbd; }
.resizer:hover { background: #bdbdbd; }
```

- `#outline` 的 `border-right: 1px solid #e0e0e0` **删除**(避免双线,视觉分割由 resizer 承担)

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

## 不做

- 不持久化宽度到 localStorage(每次刷新重置)
- 不做拖拽时的全屏遮罩 / iframe 遮挡处理(当前页面无 iframe)
- 不支持触摸笔压感等高级指针特性(Pointer Events 已统一,无需额外处理)
