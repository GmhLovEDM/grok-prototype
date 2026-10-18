# 贡献约定

仓库里的每次改动都留在 GitHub 上。下面是目录、命名和审核规则。

## 目录

- 一个产品一个目录：`projects/<项目 slug>/`。slug 用小写英文和连字符，定下后不要改。
- 阶段文件夹固定为 `00-requirements/`、`01-planning/`、`02-prototype/`、`03-design/`、`04-dev/`。共用素材放同级的 `assets/`。
- 文件放进对应阶段。不要在仓库根目录或 `docs/`、`test/` 里新增产品内容。
- 空文件夹放一份短的 `README.md`，说明这个文件夹收什么。不要用 `.gitkeep`。
- 还没开工的阶段不要放占位代码或空工程。

各阶段负责人：需求由 Mike 确认、Grok Bot 审核；策划 Kai；原型 Efe；设计 Alex；开发 Him。

## 文件名

- 文件和文件夹用小写英文 kebab-case，例如 `story-outline.md`、`latte-art-notes.md`。
- 中文标题写在正文的一级标题里，不写进文件名。
- 长期维护的入口文件不用日期：`README.md`、`requirements.md`、`decisions.md`。
- 按一次讨论或一次导出归档的文件，名称以日期开头：`2026-10-18-review-notes.md`。
- 图片同样用 kebab-case，能看出来源和内容，例如 `2026-10-18-cafe-counter.png`。

## 外部链接

Figma、参考视频和其他外部资料的地址写进对应目录的 markdown，不要只留在聊天里。设计链接至少写清：地址、文件或页面名称、节点（如有）、记录日期。

## 分支

分支名：`<角色>/<项目 slug>-<主题>`，全部小写 kebab-case。

角色用 `grok`、`kai`、`efe`、`alex`、`him`、`mike`。

示例：

- `kai/seaside-cafe-chapter-two`
- `efe/seaside-cafe-pour-over`
- `alex/seaside-cafe-cafe-interior`
- `him/seaside-cafe-electron-shell`

平台如果要求固定前缀，可以在那个前缀下建分支，并在 PR 正文里写明角色和阶段。

## 拉取请求

- 改动通过草稿 PR 进入 `main`，不直接推 `main`。
- 合并前由 Grok Bot 审核。涉及产品取舍时，同时请 Mike 确认。
- 按仓库的 PR 模板填写：所属项目、阶段、变更内容、待确认事项、审核人。
- 一个 PR 只做一件事，并放在正确的项目和阶段目录里。

## 提交说明

格式：

```text
<类型>: <一句话说明>
```

类型用：`docs`（文档与约定）、`plan`（策划）、`prototype`（原型）、`design`（设计）、`feat`（功能）、`fix`（修复）、`chore`（杂项）。

说明用简体中文，写清改了什么。需要补充原因时，在空行后写正文。

示例：`docs: 记录汐湾咖啡馆已确认的需求`
