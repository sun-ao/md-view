# Toolbar 可见性参数化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 默认隐藏 toolbar，通过 URL 参数 `?toolbar=1` 控制其显示。

**Architecture:** CSS 默认 `#toolbar { display:none }`、`#app { height:100vh }`；`main.ts` 解析 `toolbar` 参数，值为 `1`/`true` 时给 `body` 加 `show-toolbar` 类并调用 `mountToolbar`，否则不挂载。`body.show-toolbar` 覆盖规则恢复 48px 布局。

**Tech Stack:** TypeScript, Vite, Vitest (jsdom, globals:true)

**Spec:** `docs/superpowers/specs/2026-07-29-toolbar-visibility-design.md`

---

## File Structure

- **Modify:** `src/main.ts` — 新增 `parseToolbarParam` 纯函数；`main()` 条件挂载 toolbar + 加 `body.show-toolbar` 类。
- **Modify:** `src/main.test.ts` — 新增 `parseToolbarParam` 单测；新增/调整 orchestration 用例覆盖 toolbar 显示/隐藏两条路径。
- **Modify:** `src/style.css` — `#toolbar` 默认隐藏，`#app` 默认满高；新增 `body.show-toolbar` 覆盖规则。

---

### Task 1: parseToolbarParam 纯函数（TDD）

**Files:**
- Modify: `src/main.ts` (新增导出函数，放在 `parseUrlParam` 之后)
- Modify: `src/main.test.ts` (新增 `describe('parseToolbarParam', ...)` 块，放在 `describe('parseUrlParam', ...)` 之后)

- [ ] **Step 1: 写失败测试**

在 `src/main.test.ts` 的 `parseUrlParam` describe 块之后（约第 60 行 `})` 之后）插入：

```typescript
describe('parseToolbarParam', () => {
  it('returns true for toolbar=1', () => {
    expect(parseToolbarParam('?url=xxx&toolbar=1')).toBe(true)
  })

  it('returns true for toolbar=true (case-insensitive)', () => {
    expect(parseToolbarParam('?url=xxx&toolbar=true')).toBe(true)
    expect(parseToolbarParam('?url=xxx&toolbar=TRUE')).toBe(true)
  })

  it('returns false for toolbar=0', () => {
    expect(parseToolbarParam('?url=xxx&toolbar=0')).toBe(false)
  })

  it('returns false for empty toolbar value', () => {
    expect(parseToolbarParam('?url=xxx&toolbar=')).toBe(false)
  })

  it('returns false for other values', () => {
    expect(parseToolbarParam('?url=xxx&toolbar=yes')).toBe(false)
    expect(parseToolbarParam('?url=xxx&toolbar=false')).toBe(false)
  })

  it('returns false when toolbar param is absent', () => {
    expect(parseToolbarParam('?url=xxx')).toBe(false)
  })

  it('returns false for empty search', () => {
    expect(parseToolbarParam('')).toBe(false)
  })
})
```

同时在文件顶部的 import 行中加入 `parseToolbarParam`：

```typescript
import { getErrorMessage, parseUrlParam, parseToolbarParam } from './main'
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/main.test.ts -t "parseToolbarParam"`
Expected: FAIL — `parseToolbarParam is not a function`（或 import 报错）

- [ ] **Step 3: 实现 parseToolbarParam**

在 `src/main.ts` 的 `parseUrlParam` 函数之后（约第 27 行 `}` 之后）插入：

```typescript
export function parseToolbarParam(search: string): boolean {
  const params = new URLSearchParams(search)
  const value = params.get('toolbar')
  if (!value) return false
  const lower = value.toLowerCase()
  return lower === '1' || lower === 'true'
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/main.test.ts -t "parseToolbarParam"`
Expected: PASS — 7 个用例全绿

- [ ] **Step 5: 提交**

```bash
git add src/main.ts src/main.test.ts
git commit -m "feat(toolbar): add parseToolbarParam pure function"
```

---

### Task 2: main() 条件挂载 toolbar（TDD）

**Files:**
- Modify: `src/main.test.ts` (调整现有成功用例的 URL，新增 toolbar 隐藏用例)
- Modify: `src/main.ts` (`main()` 中条件挂载逻辑)

**背景：** 现有成功用例 `'?url=https://example.com/doc.md'`（第 160 行）没有 `toolbar` 参数。改造后该路径不会再调用 `mountToolbar`。需要给该用例 URL 加上 `&toolbar=1` 保持测试覆盖 toolbar 挂载路径，再新增一个不带 `toolbar` 的用例验证隐藏路径。

- [ ] **Step 1: 调整现有成功用例 URL**

在 `src/main.test.ts` 中找到用例 `'inits Vditor and mounts toolbar on successful load, enables outline toggle when headings exist'`（约第 160 行），把：

```typescript
      value: { search: '?url=https://example.com/doc.md' },
```

改为：

```typescript
      value: { search: '?url=https://example.com/doc.md&toolbar=1' },
```

同样找到用例 `'does not enable outline toggle when document has no headings'`（约第 205 行），把：

```typescript
      value: { search: '?url=https://example.com/doc.md' },
```

改为：

```typescript
      value: { search: '?url=https://example.com/doc.md&toolbar=1' },
```

- [ ] **Step 2: 写失败的新用例（toolbar 隐藏路径）**

在 `'does not enable outline toggle when document has no headings'` 用例之后（约第 228 行 `})` 之后）插入新用例：

```typescript
  it('does not mount toolbar and skips show-toolbar class when toolbar param is absent', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?url=https://example.com/doc.md' },
      writable: true,
    })

    const mockVditor = createMockVditorInstance()
    mockedCreateVditor.mockReturnValue(mockVditor)
    mockedLoadMd.mockResolvedValue({
      ok: true,
      md: '# Hello',
      url: 'https://example.com/doc.md',
    })
    const outlineHandle = { destroy: vi.fn() }
    mockedMountOutline.mockResolvedValue(outlineHandle)

    await main()

    expect(mockedMountToolbar).not.toHaveBeenCalled()
    expect(document.body.classList.contains('show-toolbar')).toBe(false)
    // outline still mounts even without toolbar
    expect(mockedMountOutline).toHaveBeenCalled()
  })
```

- [ ] **Step 3: 写失败的新用例（toolbar 显示路径验证 body 类）**

在上一个新用例之后紧接着插入：

```typescript
  it('adds show-toolbar class and mounts toolbar when toolbar=1', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?url=https://example.com/doc.md&toolbar=1' },
      writable: true,
    })

    const mockVditor = createMockVditorInstance()
    mockedCreateVditor.mockReturnValue(mockVditor)
    mockedLoadMd.mockResolvedValue({
      ok: true,
      md: '# Hello',
      url: 'https://example.com/doc.md',
    })
    const toolbarHandle = createMockToolbarHandle()
    mockedMountToolbar.mockReturnValue(toolbarHandle)
    const outlineHandle = { destroy: vi.fn() }
    mockedMountOutline.mockResolvedValue(outlineHandle)

    await main()

    expect(document.body.classList.contains('show-toolbar')).toBe(true)
    expect(mockedMountToolbar).toHaveBeenCalled()
  })
```

- [ ] **Step 4: 运行测试确认失败**

Run: `npx vitest run src/main.test.ts -t "main orchestration"`
Expected: FAIL — 新增的两个用例失败（`show-toolbar` 类未加 / `mountToolbar` 在无参数时仍被调用）

- [ ] **Step 5: 实现 main() 条件挂载逻辑**

在 `src/main.ts` 中，把 `main()` 函数里这一段（约第 57-69 行）：

```typescript
  const vditor = createVditorInstance()
  await vditor.init(editorEl, result.md)
  const outlineEl = document.getElementById('outline')
  const toolbarHandle = mountToolbar(toolbarEl, { vditor, sourceUrl: url, outlineEl })

  if (outlineEl) {
    const outlineHandle = await mountOutline(outlineEl, editorEl)
    if (outlineHandle) {
      toolbarHandle.setOutlineToggleAvailable()
      const resizerEl = document.getElementById('resizer')
      if (resizerEl) mountResizer(resizerEl, outlineEl)
    }
  }
```

替换为：

```typescript
  const vditor = createVditorInstance()
  await vditor.init(editorEl, result.md)
  const outlineEl = document.getElementById('outline')

  const showToolbar = parseToolbarParam(window.location.search)
  const toolbarHandle = showToolbar
    ? mountToolbar(toolbarEl, { vditor, sourceUrl: url, outlineEl })
    : undefined

  if (showToolbar) {
    document.body.classList.add('show-toolbar')
  }

  if (outlineEl) {
    const outlineHandle = await mountOutline(outlineEl, editorEl)
    if (outlineHandle) {
      toolbarHandle?.setOutlineToggleAvailable()
      const resizerEl = document.getElementById('resizer')
      if (resizerEl) mountResizer(resizerEl, outlineEl)
    }
  }
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run src/main.test.ts`
Expected: PASS — 全部用例绿

- [ ] **Step 7: 提交**

```bash
git add src/main.ts src/main.test.ts
git commit -m "feat(toolbar): conditionally mount toolbar based on ?toolbar=1"
```

---

### Task 3: CSS 默认隐藏 + show-toolbar 覆盖

**Files:**
- Modify: `src/style.css` (`#toolbar` 和 `#app` 规则)

- [ ] **Step 1: 修改 #toolbar 默认隐藏**

在 `src/style.css` 中找到 `#toolbar` 规则（约第 12-21 行）：

```css
#toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
  flex-shrink: 0;
}
```

把 `display: flex;` 改为 `display: none;`（其余属性保留，覆盖规则会恢复 flex）：

```css
#toolbar {
  display: none;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
  flex-shrink: 0;
}
```

- [ ] **Step 2: 修改 #app 默认满高**

在 `src/style.css` 中找到 `#app` 规则（约第 43-47 行）：

```css
#app {
  display: flex;
  height: calc(100vh - 48px);
  overflow: hidden;
}
```

把 `height: calc(100vh - 48px);` 改为 `height: 100vh;`：

```css
#app {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
```

- [ ] **Step 3: 新增 show-toolbar 覆盖规则**

在 `#app` 规则之后（约第 47 行 `}` 之后）插入：

```css
body.show-toolbar #toolbar {
  display: flex;
}

body.show-toolbar #app {
  height: calc(100vh - 48px);
}
```

- [ ] **Step 4: 运行全部测试 + 构建验证**

Run: `npm test && npm run build`
Expected: 全部测试 PASS，构建成功无报错

- [ ] **Step 5: 提交**

```bash
git add src/style.css
git commit -m "style(toolbar): hide toolbar by default, show via body.show-toolbar"
```

---

### Task 4: 全量验证

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: 所有测试文件 PASS，零失败

- [ ] **Step 2: 手动验证（可选）**

Run: `npm run dev`

1. 访问 `http://localhost:5173/?url=<某个 CORS 友好的 md URL>` — 确认 toolbar 不显示，编辑区占满视口。
2. 访问 `http://localhost:5173/?url=<同上>&toolbar=1` — 确认 toolbar 显示在顶部，编辑区高度 = 视口 - 48px。
3. 在 toolbar=1 页面切换编辑/预览、导出、复制、原文链接、大纲开关 — 确认功能正常。
