# 可拖拽大纲分隔条 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在大纲与内容之间增加可左右拖拽的分隔条,实时调整大纲宽度(160~480px),双击重置到 260px。

**Architecture:** 新增独立模块 `src/divider.ts`(导出 `mountResizer` + `clampWidth`),在 `index.html` 插入 `<div class="resizer">` 元素,`main.ts` 在大纲挂载成功后调用 `mountResizer`。拖拽用 Pointer Events + `setPointerCapture`,可见性由 `.resizer.mounted` class + CSS 隐藏规则控制(不用 inline style)。

**Tech Stack:** TypeScript, Vite, Vitest + jsdom, Pointer Events

**Spec:** `docs/superpowers/specs/2026-07-29-draggable-outline-divider-design.md`

---

## 文件结构

- **Create** `src/divider.ts` — 拖拽逻辑:导出 `clampWidth` 纯函数 + `mountResizer(resizerEl, outlineEl): ResizerHandle`
- **Create** `src/divider.test.ts` — `clampWidth` 单测 + `mountResizer` DOM 行为测试(jsdom + 模拟 PointerEvent)
- **Modify** `index.html` — 在 `#outline` 与 `#editor` 之间插入 `<div class="resizer" id="resizer"></div>`
- **Modify** `src/style.css` — 新增 `.resizer` 视觉 + `.mounted` 可见性规则 + 三条隐藏规则;删除 `#outline` 的 `border-right`
- **Modify** `src/main.ts` — 大纲挂载成功后调用 `mountResizer`
- **Modify** `src/main.test.ts` — mock `./divider`,更新 `setupDOM` 含 `#resizer`,验证调用

---

## Task 1: clampWidth 纯函数

**Files:**
- Create: `src/divider.test.ts`
- Create: `src/divider.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/divider.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { clampWidth } from './divider'

describe('clampWidth', () => {
  it('returns the value unchanged when within range', () => {
    expect(clampWidth(300, 160, 480)).toBe(300)
  })

  it('clamps to min when below range', () => {
    expect(clampWidth(100, 160, 480)).toBe(160)
  })

  it('clamps to max when above range', () => {
    expect(clampWidth(600, 160, 480)).toBe(480)
  })

  it('returns min when value equals min', () => {
    expect(clampWidth(160, 160, 480)).toBe(160)
  })

  it('returns max when value equals max', () => {
    expect(clampWidth(480, 160, 480)).toBe(480)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/divider.test.ts`
Expected: FAIL — `clampWidth` 未定义(模块不存在)

- [ ] **Step 3: 写最小实现**

创建 `src/divider.ts`:

```typescript
export function clampWidth(width: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, width))
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/divider.test.ts`
Expected: PASS (5 个测试)

- [ ] **Step 5: 提交**

```bash
git add src/divider.ts src/divider.test.ts
git commit -m "feat(divider): add clampWidth pure function"
```

---

## Task 2: mountResizer 骨架 — 挂载可见性 + destroy

**Files:**
- Modify: `src/divider.test.ts`
- Modify: `src/divider.ts`

- [ ] **Step 1: 写失败测试**

在 `src/divider.test.ts` 顶部 import 区追加 `mountResizer`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clampWidth, mountResizer } from './divider'
```

在文件末尾追加:

```typescript
describe('mountResizer', () => {
  beforeEach(() => {
    document.body.innerHTML = '<aside id="outline"></aside><div class="resizer" id="resizer"></div>'
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('adds the mounted class on mount so CSS makes it visible', () => {
    const resizer = document.getElementById('resizer')!
    const outline = document.getElementById('outline')!
    mountResizer(resizer, outline)
    expect(resizer.classList.contains('mounted')).toBe(true)
  })

  it('destroy removes the mounted class', () => {
    const resizer = document.getElementById('resizer')!
    const outline = document.getElementById('outline')!
    const handle = mountResizer(resizer, outline)
    handle.destroy()
    expect(resizer.classList.contains('mounted')).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/divider.test.ts`
Expected: FAIL — `mountResizer` 未导出

- [ ] **Step 3: 写最小实现**

在 `src/divider.ts` 追加:

```typescript
export interface ResizerHandle {
  destroy(): void
}

export function mountResizer(resizerEl: HTMLElement, outlineEl: HTMLElement): ResizerHandle {
  resizerEl.classList.add('mounted')

  return {
    destroy(): void {
      resizerEl.classList.remove('mounted')
    },
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/divider.test.ts`
Expected: PASS (含新 mountResizer 测试)

- [ ] **Step 5: 提交**

```bash
git add src/divider.ts src/divider.test.ts
git commit -m "feat(divider): add mountResizer skeleton with mounted class"
```

---

## Task 3: 拖拽交互 — pointermove 实时更新宽度

**Files:**
- Modify: `src/divider.test.ts`
- Modify: `src/divider.ts`

- [ ] **Step 1: 写失败测试**

在 `src/divider.test.ts` 的 `mountResizer` describe 块内追加(在已有 `beforeEach` 之后,`it('adds the mounted class...')` 之前插入一个 helper 和测试):

```typescript
  // jsdom 不实现 setPointerCapture / releasePointerCapture,需 stub。
  function setupResizerFixture(): { resizer: HTMLElement; outline: HTMLElement } {
    const resizer = document.getElementById('resizer')!
    const outline = document.getElementById('outline')!
    resizer.setPointerCapture = vi.fn()
    resizer.releasePointerCapture = vi.fn()
    // 给 outline 一个起始宽度,模拟默认 260px
    outline.style.width = '260px'
    return { resizer, outline }
  }

  it('updates outline width by the pointer delta during drag', () => {
    const { resizer, outline } = setupResizerFixture()
    mountResizer(resizer, outline)

    // pointerdown 记录起点 clientX=200,起始宽度 260
    resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, pointerId: 1 }))
    // pointermove 到 clientX=250 -> delta=50 -> 新宽度 310
    resizer.dispatchEvent(new PointerEvent('pointermove', { clientX: 250, pointerId: 1 }))

    expect(outline.style.width).toBe('310px')
  })

  it('adds dragging class on pointerdown and removes on pointerup', () => {
    const { resizer, outline } = setupResizerFixture()
    mountResizer(resizer, outline)

    resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, pointerId: 1 }))
    expect(resizer.classList.contains('dragging')).toBe(true)

    resizer.dispatchEvent(new PointerEvent('pointerup', { clientX: 210, pointerId: 1 }))
    expect(resizer.classList.contains('dragging')).toBe(false)
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/divider.test.ts`
Expected: FAIL — 拖拽未实现,宽度仍是 `'260px'`,`dragging` 类未添加

- [ ] **Step 3: 写实现**

在 `src/divider.ts` 顶部追加常量,并改写 `mountResizer`:

```typescript
const MIN_WIDTH = 160
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 260

// 从 inline style 读宽度;为空(CSS 默认未写到 inline)时回退 DEFAULT_WIDTH。
// 用 parseInt(style.width) 而非 offsetWidth,因为 jsdom 不做布局、offsetWidth 恒为 0。
function readCurrentWidth(el: HTMLElement): number {
  const raw = el.style.width
  if (!raw) return DEFAULT_WIDTH
  const parsed = parseInt(raw, 10)
  return Number.isNaN(parsed) ? DEFAULT_WIDTH : parsed
}

export function mountResizer(resizerEl: HTMLElement, outlineEl: HTMLElement): ResizerHandle {
  resizerEl.classList.add('mounted')

  let startX = 0
  let startWidth = 0

  const onPointerDown = (e: PointerEvent): void => {
    startX = e.clientX
    startWidth = readCurrentWidth(outlineEl)
    resizerEl.setPointerCapture(e.pointerId)
    resizerEl.classList.add('dragging')
  }

  const onPointerMove = (e: PointerEvent): void => {
    if (!resizerEl.classList.contains('dragging')) return
    const delta = e.clientX - startX
    const newWidth = clampWidth(startWidth + delta, MIN_WIDTH, MAX_WIDTH)
    outlineEl.style.width = `${newWidth}px`
  }

  const onPointerUp = (e: PointerEvent): void => {
    if (!resizerEl.classList.contains('dragging')) return
    resizerEl.releasePointerCapture(e.pointerId)
    resizerEl.classList.remove('dragging')
  }

  resizerEl.addEventListener('pointerdown', onPointerDown)
  resizerEl.addEventListener('pointermove', onPointerMove)
  resizerEl.addEventListener('pointerup', onPointerUp)
  // pointercancel 与 pointerup 共用处理:系统取消指针(如触摸中断)时也要释放 capture + 移除 dragging
  resizerEl.addEventListener('pointercancel', onPointerUp)

  return {
    destroy(): void {
      resizerEl.removeEventListener('pointerdown', onPointerDown)
      resizerEl.removeEventListener('pointermove', onPointerMove)
      resizerEl.removeEventListener('pointerup', onPointerUp)
      resizerEl.removeEventListener('pointercancel', onPointerUp)
      resizerEl.classList.remove('mounted')
    },
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/divider.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/divider.ts src/divider.test.ts
git commit -m "feat(divider): implement pointer drag to resize outline width"
```

---

## Task 4: 拖拽边界 clamp 验证

**Files:**
- Modify: `src/divider.test.ts`

> 说明:clamp 逻辑已在 Task 3 由 `clampWidth` 接入,本任务只补充边界测试,不改动实现。

- [ ] **Step 1: 写测试**

在 `mountResizer` describe 块内追加:

```typescript
  it('clamps to MAX_WIDTH when dragging far right', () => {
    const { resizer, outline } = setupResizerFixture()
    mountResizer(resizer, outline)

    resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, pointerId: 1 }))
    // 起始 260 + delta 500 = 760 -> clamp 到 480
    resizer.dispatchEvent(new PointerEvent('pointermove', { clientX: 700, pointerId: 1 }))

    expect(outline.style.width).toBe('480px')
  })

  it('clamps to MIN_WIDTH when dragging far left', () => {
    const { resizer, outline } = setupResizerFixture()
    mountResizer(resizer, outline)

    resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, pointerId: 1 }))
    // 起始 260 + delta(-200) = 60 -> clamp 到 160
    resizer.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, pointerId: 1 }))

    expect(outline.style.width).toBe('160px')
  })
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npx vitest run src/divider.test.ts`
Expected: PASS(实现已覆盖,直接通过)

- [ ] **Step 3: 提交**

```bash
git add src/divider.test.ts
git commit -m "test(divider): cover clamp at min/max width boundaries"
```

---

## Task 5: 双击重置到默认宽度

**Files:**
- Modify: `src/divider.test.ts`
- Modify: `src/divider.ts`

- [ ] **Step 1: 写失败测试**

在 `mountResizer` describe 块内追加:

```typescript
  it('resets outline width to default on dblclick', () => {
    const { resizer, outline } = setupResizerFixture()
    mountResizer(resizer, outline)

    // 先拖拽改宽度
    resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, pointerId: 1 }))
    resizer.dispatchEvent(new PointerEvent('pointermove', { clientX: 300, pointerId: 1 }))
    expect(outline.style.width).toBe('360px')

    // 双击重置
    resizer.dispatchEvent(new MouseEvent('dblclick'))

    expect(outline.style.width).toBe('260px')
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/divider.test.ts`
Expected: FAIL — dblclick 后宽度仍是 `'360px'`

- [ ] **Step 3: 写实现**

在 `src/divider.ts` 的 `mountResizer` 内(`onPointerUp` 定义之后)追加监听器,并在 `destroy` 中移除:

```typescript
  const onDblClick = (): void => {
    outlineEl.style.width = `${DEFAULT_WIDTH}px`
  }

  resizerEl.addEventListener('pointerdown', onPointerDown)
  resizerEl.addEventListener('pointermove', onPointerMove)
  resizerEl.addEventListener('pointerup', onPointerUp)
  resizerEl.addEventListener('pointercancel', onPointerUp)
  resizerEl.addEventListener('dblclick', onDblClick)
```

`destroy` 内追加(在已有的 `pointercancel` 移除之后):

```typescript
      resizerEl.removeEventListener('dblclick', onDblClick)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/divider.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/divider.ts src/divider.test.ts
git commit -m "feat(divider): reset outline width to default on dblclick"
```

---

## Task 6: destroy 移除监听器验证

**Files:**
- Modify: `src/divider.test.ts`

> 说明:destroy 已在 Task 3/5 移除监听器,本任务补端到端验证。

- [ ] **Step 1: 写测试**

在 `mountResizer` describe 块内追加:

```typescript
  it('destroy stops drag from updating width', () => {
    const { resizer, outline } = setupResizerFixture()
    const handle = mountResizer(resizer, outline)
    handle.destroy()

    resizer.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, pointerId: 1 }))
    resizer.dispatchEvent(new PointerEvent('pointermove', { clientX: 400, pointerId: 1 }))

    // destroy 后拖拽不应改变宽度
    expect(outline.style.width).toBe('260px')
  })

  it('destroy stops dblclick from resetting width', () => {
    const { resizer, outline } = setupResizerFixture()
    const handle = mountResizer(resizer, outline)
    // 先手动改宽度
    outline.style.width = '400px'
    handle.destroy()

    resizer.dispatchEvent(new MouseEvent('dblclick'))

    expect(outline.style.width).toBe('400px')
  })
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npx vitest run src/divider.test.ts`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/divider.test.ts
git commit -m "test(divider): verify destroy removes all listeners"
```

---

## Task 7: HTML 结构 + CSS 视觉

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`

- [ ] **Step 1: 改 index.html**

把 `#app` 内部改为(在 `#outline` 与 `#editor` 之间插入 resizer):

```html
  <div id="app">
    <aside id="outline"></aside>
    <div class="resizer" id="resizer"></div>
    <div id="editor"></div>
  </div>
```

- [ ] **Step 2: 改 style.css**

找到 `#outline` 规则块(`width: 260px; ... border-right: 1px solid #e0e0e0;`),**删除**其中的 `border-right: 1px solid #e0e0e0;` 行(避免与 resizer 双线)。

在 `#outline` 规则块之后、`#editor` 规则块之前插入:

```css
.resizer {
  width: 6px;
  flex-shrink: 0;
  height: 100%;
  cursor: col-resize;
  background: #e0e0e0;
  position: relative;
  z-index: 1;
  display: none;
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

- [ ] **Step 3: 运行全量测试确认无回归**

Run: `npx vitest run`
Expected: PASS(所有测试,divider + outline + main + load-md + toolbar)

- [ ] **Step 4: 提交**

```bash
git add index.html src/style.css
git commit -m "feat(divider): add resizer element and CSS visibility rules"
```

---

## Task 8: main.ts 集成 + main.test.ts 更新

**Files:**
- Modify: `src/main.ts`
- Modify: `src/main.test.ts`

- [ ] **Step 1: 更新 main.test.ts — mock divider 模块 + setupDOM 加 #resizer**

在 `main.test.ts` 中,在 `vi.mock('./outline', ...)` 之后追加:

```typescript
// Mock divider module
vi.mock('./divider', () => ({
  mountResizer: vi.fn(),
}))
```

在 import 区(与其它 mocked 模块 import 一起)追加:

```typescript
import { mountResizer } from './divider'
```

在其它 `const mockedXxx = vi.mocked(xxx)` 旁追加:

```typescript
const mockedMountResizer = vi.mocked(mountResizer)
```

把 `setupDOM` 的 `document.body.innerHTML` 改为(加 `#resizer`):

```typescript
  document.body.innerHTML =
    '<div id="toolbar"></div><div id="app"><aside id="outline"></aside><div class="resizer" id="resizer"></div><div id="editor"></div></div>'
```

- [ ] **Step 2: 更新 main.test.ts — 加测试用例**

在 `describe('main orchestration')` 内,"inits Vditor and mounts toolbar..." 测试末尾(`expect(toolbarHandle.setOutlineToggleAvailable).toHaveBeenCalled()` 之后)追加:

```typescript
    expect(mockedMountResizer).toHaveBeenCalledWith(
      document.getElementById('resizer'),
      document.getElementById('outline'),
    )
```

在 "does not enable outline toggle when document has no headings" 测试末尾追加:

```typescript
    // 无标题 -> mountOutline 返回 null -> 不挂载 resizer
    expect(mockedMountResizer).not.toHaveBeenCalled()
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run src/main.test.ts`
Expected: FAIL — `main.ts` 尚未调用 `mountResizer`,第一个新断言失败

- [ ] **Step 4: 改 main.ts 集成**

在 `main.ts` 顶部 import 区追加:

```typescript
import { mountResizer } from './divider'
```

把 `main()` 中挂载 outline 的块:

```typescript
  if (outlineEl) {
    const outlineHandle = await mountOutline(outlineEl, editorEl)
    if (outlineHandle) {
      toolbarHandle.setOutlineToggleAvailable()
    }
  }
```

改为:

```typescript
  if (outlineEl) {
    const outlineHandle = await mountOutline(outlineEl, editorEl)
    if (outlineHandle) {
      toolbarHandle.setOutlineToggleAvailable()
      const resizerEl = document.getElementById('resizer')
      if (resizerEl) mountResizer(resizerEl, outlineEl)
    }
  }
```

- [ ] **Step 5: 运行全量测试确认通过**

Run: `npx vitest run`
Expected: PASS(所有测试)

- [ ] **Step 6: 手动验证(可选但推荐)**

Run: `npm run dev`,浏览器打开 `http://localhost:5173/?url=https://raw.githubusercontent.com/.../some.md`,确认:
- 大纲与内容间有 6px 分隔条
- 拖拽实时调整宽度,不能超出 160~480
- 双击重置到 260
- 切换编辑模式时分隔条消失
- 隐藏大纲时分隔条消失

- [ ] **Step 7: 提交**

```bash
git add src/main.ts src/main.test.ts
git commit -m "feat(divider): wire mountResizer into main after outline mount"
```

---

## 完成检查

- [ ] 所有测试通过:`npx vitest run`
- [ ] 构建无错:`npm run build`
- [ ] 拖拽、clamp、双击重置、三处隐藏(编辑/隐藏大纲/窄屏)行为符合 spec
