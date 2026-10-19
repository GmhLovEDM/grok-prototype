# 《汐湾咖啡馆》出图提示词：序章与第一章

> 状态：给生成图用的提示词。序章是第 1 天，第一章是第 2 到 14 天，按 `03-script/` 的章节行和 `01-planning/story-flow.md`。
> 存放：策划文档没有指定提示词目录。这一包放在 `projects/seaside-cafe/02-art-prompts/`。`02-prototype/` 仍是原型，不放提示词。

[立绘清单](../01-planning/portrait-list.md)
[立绘 README](../assets/portraits/README.md)
[母版提示词记录](../assets/portraits/_generation/portrait-masters.json)
[基准立绘审核](../assets/portraits/_reviews/portrait-masters-review.md)

四处必须改和可选小修以 [基准立绘审核](../assets/portraits/_reviews/portrait-masters-review.md) 的「修正提示词」为准。本目录只链过去，不另写一套改法。

## 场景

场景是空背景。人物用立绘叠上去。序章和第一章没有锁定某一个人的 CG：台风夜留谁、烟花夜站在谁旁边，都随路线变。秀姨、拿铁、老唐、老夏、老护士、周总还没有基准立绘，这些场也不画进背景。

建议成图：横图 1920×1080，16:9，不透明 PNG。策划没有写场景尺寸，这是建议，不是既定规格。建议以后放在 `projects/seaside-cafe/assets/backgrounds/`，本目录不生成图。

画风与立绘同一套：细腻的半写实手绘，干净的线，克制的上色，材料可信。不是照片，不是 3D，不是 Q 版。晴天用左上方的暖中性阳光，加一点冷天光。夜里和台风用该条自己的光源。

除非该条写明，否则不要可读文字。允许的字只有：「老街十七号」、「远帆号」、「唐记」。别的招牌、价签、登记簿保持旧、空，或看不清。

负向（每条场景都加上）：人物，脸，手，脚，猫，狗，鸟的特写，Q 版，二次元大眼，照片，3D，水印，边框，乱码，霓虹，没写明的招牌。

| id | 建议文件名 | 优先级 | 用在 |
| --- | --- | --- | --- |
| `bg-office-night` | `bg-office-night.png` | P0 | 第 1 天「写字楼」 |
| `bg-coach-day` | `bg-coach-day.png` | P0 | 第 1 天「回程」 |
| `bg-station-day` | `bg-station-day.png` | P0 | 第 1 天「车站」 |
| `bg-old-street-day` | `bg-old-street-day.png` | P0 | 第 1 天离站往老街 |
| `bg-chaoxi-dusty-afternoon` | `bg-chaoxi-dusty-afternoon.png` | P0 | 第 1 天「潮汐」 |
| `bg-chaoxi-day` | `bg-chaoxi-day.png` | P0 | 第 2、3、4、6、7、8、11、12 天店内白天。第 4 天三种饮品同一张 |
| `bg-chaoxi-night` | `bg-chaoxi-night.png` | P0 | 第 3 天「夜里」，第 8 天「深夜消息」 |
| `bg-chaoxi-typhoon-night` | `bg-chaoxi-typhoon-night.png` | P0 | 第 9 天「钉窗」「留谁」 |
| `bg-chaoxi-after-storm` | `bg-chaoxi-after-storm.png` | P0 | 第 10、11 天台风后的店内 |
| `bg-chaoxi-door-night` | `bg-chaoxi-door-night.png` | P0 | 第 14 天「来电」，人站在关着的店门外 |
| `bg-dock-entrance-dusk` | `bg-dock-entrance-dusk.png` | P0 | 第 6 到 8 天「码头入口」 |
| `bg-dock-nets-dusk` | `bg-dock-nets-dusk.png` | P0 | 第 6 到 8 天「修网」 |
| `bg-tangji-kitchen-night` | `bg-tangji-kitchen-night.png` | P0 | 第 6 到 8 天「练刀」 |
| `bg-lighthouse-dusk` | `bg-lighthouse-dusk.png` | P0 | 第 6 到 8 天「灯塔」 |
| `bg-reef-dusk` | `bg-reef-dusk.png` | P0 | 第 6 到 8 天「礁石滩」 |
| `bg-clinic-day` | `bg-clinic-day.png` | P0 | 第 5 天「卫生所」 |
| `bg-clinic-steps-night` | `bg-clinic-steps-night.png` | P0 | 第 10 到 12 天台阶。泡面是立绘，不画进人 |
| `bg-post-interior-day` | `bg-post-interior-day.png` | P0 | 第 12 天「邮局」 |
| `bg-plaza-day` | `bg-plaza-day.png` | P0 | 第 13 天「码头广场」 |
| `bg-plaza-fireworks` | `bg-plaza-fireworks.png` | P0 | 第 14 天「广场」和烟花各场 |
| `bg-chaoxi-noon` | `bg-chaoxi-noon.png` | P1 | 第 5 天中午。可由 `bg-chaoxi-day` 改光 |
| `bg-dock-empty-night` | `bg-dock-empty-night.png` | P1 | 第 10 到 12 天空码头。可由修网图改 |
| `bg-lighthouse-empty-night` | `bg-lighthouse-empty-night.png` | P1 | 第 7、8 天已看，以及第 10 到 12 天空灯塔 |
| `bg-reef-night` | `bg-reef-night.png` | P1 | 第 10 到 12 天空滩。可由黄昏礁石改 |
| `bg-post-closed-dusk` | `bg-post-closed-dusk.png` | P1 | 第 1 天路过、第 11 天「邮局空」 |
| `bg-old-street-after-storm` | `bg-old-street-after-storm.png` | P1 | 第 10 天清晨街面。可由白天老街改 |

P0 共 20 张。P1 共 6 张。合计 26 张。P1 是同一地点的光或天气变体，不先画也不挡住序章和第一章的主路径。

文件：

- [序章路上](scenes/prologue.md)
- [「潮汐」](scenes/chaoxi.md)
- [码头与「唐记」](scenes/dock.md)
- [灯塔与礁石滩](scenes/lighthouse-reef.md)
- [卫生所、邮局、广场](scenes/clinic-post-plaza.md)

二楼窗口不另做一张。第 1 天的空窗台写在店内图里。把窗口当画画的位置是第 21 天，不在这一章。研究站、「浪花里」、灯塔小学、外岛、县城这一章没有进场。

## 人物

只写 10 位可攻略角色。规格与 [立绘清单](../01-planning/portrait-list.md) 一致，并按审核收过一句话：腰以上；腰带、裤腰或裙腰的上沿可以露一点；再往下不画。底边这一截不是画错，不为此重画。

成图：1536×2304，PNG，真实透明。不要把棋盘格画进图里。半身，正面稍侧，手臂自然向下。除陆屿外，手可以在底边被切去一截。陆屿的手必须入画，只按审核那一条。

不拿在手里的道具不画。糖盒、厨刀、信封、单车、出诊箱、吉他、潜水服（在默认套里）、速写本、油画笔、画架、冲浪板、棒球帽，都不要出现。

派生时用该角色自己的 `*_normal.png` 做身份参考。不要换别人的脸。改表情或换装时，保住脸型、瞳色、发、体型、站姿、光线和没被要求改的衣服。

四处必须改是局部修改，不是整张重抽。改完之前不要派生这四个人的表情和换装：

| 角色 | 必须改 | 提示词 |
| --- | --- | --- |
| 唐棠 | 围裙胸口改成可认的「唐记」 | [tang-tang.md](characters/tang-tang.md) |
| 叶帆 | 鼻梁补晒出来的浅雀斑 | [ye-fan.md](characters/ye-fan.md) |
| 陆屿 | 双手入画，补缆绳茧和一道旧疤。铜哨不改 | [lu-yu.md](characters/lu-yu.md) |
| 江叙白 | 加一顶不挡脸的草帽 | [jiang-xubai.md](characters/jiang-xubai.md) |

其余六人可以按现有母版派生。可选小修不挡住定稿，原文在审核报告「可选的小修」，角色文件只引那一节，不加成必须改。

| 角色 | 文件 |
| --- | --- |
| 夏栀 | [xia-zhi.md](characters/xia-zhi.md) |
| 唐棠 | [tang-tang.md](characters/tang-tang.md) |
| 叶帆 | [ye-fan.md](characters/ye-fan.md) |
| 陆屿 | [lu-yu.md](characters/lu-yu.md) |
| 许之言 | [xu-zhiyan.md](characters/xu-zhiyan.md) |
| 苏念 | [su-nian.md](characters/su-nian.md) |
| 程鹭 | [cheng-lu.md](characters/cheng-lu.md) |
| 沈若 | [shen-ruo.md](characters/shen-ruo.md) |
| 江叙白 | [jiang-xubai.md](characters/jiang-xubai.md) |
| 宋知远 | [song-zhiyuan.md](characters/song-zhiyuan.md) |

人物共同负向：风景，地面，棋盘格，照片，3D，Q 版，大眼，水印，边框，乱码，多指，别人的脸，全身，大腿，鞋，手持道具。腰际一截裤腰或裙腰可以留。
