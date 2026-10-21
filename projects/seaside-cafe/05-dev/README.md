# 汐湾咖啡馆 · 第 1 轮

序章和第 1 到 14 天的可玩原型。技术决定写在 [tech-stack.md](./tech-stack.md)。

在这个目录里：

```bash
npm install
npm test
npm run dev
```

`npm run dev` 会先把 `../03-script/day-*.md` 编成 `src/generated/story.json`，再打开 Vite。浏览器里是标题画面。

打包后本地看：

```bash
npm run build
npm run preview
```

`build` 依次做三件事：编剧本、`tsc --noEmit`、Vite 打包。剧本有认不出的标记时，编剧本这一步会停，并打出文件名和行号。

| 脚本 | 作用 |
| --- | --- |
| `dev` | 编剧本并启动开发服务器 |
| `build` | 编剧本、类型检查、产出 `dist/` |
| `build:script` | 只编剧本，并核对背景、立绘文件在不在 |
| `test` | 解析器和分支测试 |
| `preview` | 看 `dist/`，地址 `127.0.0.1:4173` |

图从 `../assets/` 按文件名读取。以 `_` 开头的目录（`_generation`、`_reviews`）不会进开发服务器，也不会进 `dist/`。
