# 本轮出图交付

2026-10-19 至 2026-10-20，使用内置 image_gen。每次只生成一张，生成后立即保存到项目并校验，成功后才开始下一张。

- 29 张场景：`../backgrounds/<id>/<id>.png`，1920×1080，不透明 RGB PNG。
- 63 张新增立绘：`../portraits/<id>/`。人物为 1536×2304 RGBA PNG；拿铁为 1024×1024 RGBA PNG，均含真实透明通道。
- 4 张母版修正：唐棠、叶帆、陆屿、江叙白。定稿后正式文件是各目录的 `*_normal.png`。旧母版仍在 `../portraits/_generation/original-masters/`。对照见 [v2 定稿](../_reviews/v2-selection.md)。

总计 96 张本轮交付图。最终文件清单、实际生成提示词、原始生成文件路径、原生尺寸、输出尺寸、字节数、SHA-256 和透明像素统计见 [delivery-manifest.json](delivery-manifest.json)。本地可视索引见 [gallery.html](gallery.html)，浏览器打开后点击图片可查看完整 PNG。

## 保存与尺寸

生成原图保留在 Codex 的 `generated_images` 目录。本地交付 PNG 用 Lanczos 重采样到文档规定尺寸，不把原生输出冒充为原生 1920×1080 或 1536×2304；各文件原生尺寸记录在清单中。真实透明通道在保存过程中保留，没有使用棋盘格替代透明。

12 张场景和苏念 `su-nian_night_sad` 的 `-v2` 与当时的正式文件是同一张图。定稿保留正式文件名，重复的一份在 `../backgrounds/_generation/alternates/` 与 `../portraits/_generation/alternates/`。首图仍在 `drafts/`。苏念外套难过版恢复了基准版的灰丝巾与蓝色牛仔外套。

## 本轮调整及复核范围

- 宋知远泳衣原方案被生成工具的输出审核拦截，没有返回图片；改为完整覆盖上身的深色运动泳衣，平常、微笑两张统一使用该套。
- 已对全部 96 个交付文件进行存在性、PNG 解码、尺寸和透明通道检查，结果 PASS。文件检查不等同于逐条美术验收。
- 后续美术复核应关注：陆屿为让双手完整入画，取景比其他角色略低；修网图右下角仍有很小的签名样痕迹；广场垫脚、失效灯泡数量等细部仍需按最终稿检查。场景左右 10% 安全区也建议在原型中实际裁切复核。

## 提示词记录

`prompts/` 保留实际发送的提示词；`art-progress.jsonl` 按完成保存的先后顺序追加记录，包含首轮及修正版。`delivery-manifest.json` 按当前交付文件 SHA-256 匹配实际生成记录。原始母版备份位于 `../portraits/_generation/original-masters/`。

出图当时没有提交 Git，没有修改原型代码，也没有覆盖当时已有的角色母版。唐棠、叶帆、陆屿、江叙白四张母版是在后来的定稿里才被修正版替换的，见 [v2 定稿](../_reviews/v2-selection.md)。
