# md-view

纯静态 Markdown 在线预览 / 临时编辑工具。

通过 URL `?url=` 参数传入在线 Markdown 文件地址，即可在浏览器中预览；支持一键切换到编辑模式临时修改，并导出修改后的 `.md` 文件。

## 在线使用

将 `?url=` 后面换成你要查看的 Markdown 地址：

```
https://your-host.com/?url=https://raw.githubusercontent.com/microsoft/vscode/main/README.md
```

支持的 URL 参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| `url` | 是 | Markdown 文件地址 |
| `toolbar` | 否 | `1` 显示顶部工具栏（编辑 / 导出 / 复制 / 原文 / 大纲切换），默认隐藏 |
| `outline` | 否 | `0` 或 `false` 关闭右侧大纲，默认显示 |
| `inEysy` | 否 | `1` 表示运行在 e-ysy 客户端容器内，启用外链拦截（见下文），默认关闭 |

> **注意**：由于浏览器安全限制（CORS），只能加载**允许跨域**的在线地址。推荐的 CORS 友好源包括：
> - `https://raw.githubusercontent.com/...`
> - `https://cdn.jsdelivr.net/...`
> - 大部分静态托管/CDN 资源
>
> 不支持 `file://` 协议，也不支持绕过 CORS。

## 功能

- 纯静态部署，无需后端服务器
- 默认只读预览，一键切换编辑模式
- 编辑内容不持久化，可导出 `.md` 文件到本地
- 一键复制 Markdown 内容到剪贴板
- 原文链接跳转
- 自动生成文章大纲，点击跳转、滚动高亮，可拖拽调整宽度
- 加载态 / 错误态提示（CORS、HTTP 404、空文件等）
- 嵌入 e-ysy 客户端容器时，可拦截外链点击交由宿主用系统浏览器打开

## 嵌入 e-ysy 容器

在 URL 上加 `?inEysy=1` 即可启用外链拦截，适用于以 iframe 形式嵌入 e-ysy 客户端的场景：

```
https://your-host.com/?url=https://example.com/doc.md&inEysy=1
```

启用后，预览区内的 http/https 链接点击不会被浏览器默认打开，而是通过 `postMessage` 通知父窗口，由宿主唤起系统浏览器。锚点（`#xxx`）、`mailto:`、`tel:` 等非 http(s) 链接照常放行。

父窗口需监听 `message` 事件并处理 `openExternal`：

```js
window.addEventListener('message', (e) => {
  // 建议校验 e.origin 是否为可信部署地址
  let data
  try { data = JSON.parse(e.data) } catch { return }
  if (data.event === 'openExternal' && data.url) {
    // 用系统浏览器打开 data.url
  }
})
```

> 注意：`inEysy=1` 只在容器内有意义。直接在浏览器中带该参数访问，链接点击会因无父窗口响应而看起来"无反应"。

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

开发服务器启动后访问：

```
http://localhost:5173/?url=https://raw.githubusercontent.com/microsoft/vscode/main/README.md
```

## 技术栈

- [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vditor](https://github.com/Vanessa219/vditor) 3.11.2
- [Vitest](https://vitest.dev/) + jsdom

## 项目结构

```
src/
├── load-md.ts          # 远程 Markdown 拉取与错误分类
├── vditor-instance.ts  # Vditor 实例封装（预览/编辑模式切换）
├── toolbar.ts          # 顶部工具栏（编辑 / 导出 / 复制 / 原文 / 大纲切换）
├── outline.ts          # 文章大纲（scroll-spy + 点击跳转）
├── divider.ts          # 大纲宽度拖拽分隔条
├── link-interceptor.ts # e-ysy 容器外链拦截（postMessage 通知父窗口）
├── main.ts             # 应用入口编排
└── style.css           # 布局与 Vditor 模式样式
```

## 部署

`npm run build` 后产物在 `dist/` 目录，可部署到任意静态托管服务：

- GitHub Pages
- Netlify
- Vercel
- Nginx / Apache
- 直接双击 `dist/index.html`（但 `file://` 协议下远程 `fetch` 可能受浏览器限制，建议通过 HTTP 服务器访问）

## 许可证

MIT
