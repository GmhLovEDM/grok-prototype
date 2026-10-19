# 基准立绘审核：十张 `*_normal.png`

审核日期：2026-10-19。

审核对象是 commit `55c5d00d7f3dbd9bbbf4b1004cdf247e1be9f7d3` 新增的 10 张基准立绘，以及同一次提交里的 `assets/portraits/README.md`、`assets/portraits/_generation/portrait-masters.json`、`assets/portraits/_generation/cast-preview.jpg`。这 10 张图的像素与当前 `main` 上的文件一致，没有被后来的提交改过。

标准用 `01-planning/portrait-list.md` 的「基准立绘」一节（PR #8 最终版，现已在 `main`）。外貌对照 `01-planning/characters/`。本次只审核，不改图。

## 总结论

**有条件通过。**

画风、光线、头身比、透明通道、尺寸和路径是齐的，十个人放在一起能分开。这批可以当作同一套母版的底子。

定稿前有 4 张必须改，改完之前不要拿它们派生表情和换装：

- 唐棠：围裙上的「唐记」不是可认的字。
- 叶帆：鼻梁上没有晒出来的雀斑。
- 陆屿：双手出画，缆绳茧和旧疤不在图里。铜哨本身是对的，有哨嘴、出音口和哨身。
- 江叙白：没有草帽。

其余 6 张可以留作母版。下面的建议项不挡住这 6 张定稿。

## 怎么看的

每张原图都打开看过：全身、脸、胸口、腰部和配饰放大。透明用像素核对，不是只看肉眼。`sha256` 与 `portrait-masters.json` 逐张比对。合看用 `cast-preview.jpg`，再对照十张原图的头身和光线。

## 统一规格

| 项目 | 结果 |
| --- | --- |
| 尺寸 | 10 张都是 1536×2304 |
| 格式 | PNG，RGBA |
| 透明 | 真透明。四角 alpha 为 0，完全透明像素约占 28%–40%。透明像素的 RGB 是 0，没有把棋盘格画进图里。边缘有约 3%–7% 的半透明抗锯齿，正常 |
| 构图 | 腰以上，正面稍侧，手臂向下。底边都露出一截裤腰或短裤上半截（宋知远是抽绳沙滩裤，程鹭能看见工装裤腰带）。腰以上构图带这一截是正常的，不要求重画 |
| 比例与画风 | 成年人写实比例，细线人物插画，不是 Q 版，不是照片，不是 3D |
| 光 | 都是左上方来的海边夏日自然光，白平衡接近 |
| 不画的道具 | 糖盒、厨刀、出诊箱、吉他、潜水服、速写本、油画笔、冲浪板、陆屿的棒球帽，都没有出现 |
| 生成瑕疵 | 看得见的手没有多指、没有悬空物件。陆屿的手整双都在画外，手指无法检查 |

共同问题，记为**建议改**，不单列为某一张的必须改（陆屿的手例外，见该角色）：

- 头顶留白只有几个到三十来个像素，头发和帽子贴着上沿，但没有被切掉一块。
- 身体都画到最底一行。手多在底边被切去一截。`README.md` 写了手可能被裁切；基准条文写的是双手自然垂下，没有写手必须完整入画。
- 十张都顶满同一画幅，身高差（唐棠 158 cm，宋知远 185 cm）看不出来。肩宽仍能把娇小和高大分开，头身比没有忽然变成 Q 版。
- 母版是 1024×1536 用 Lanczos 放大 1.5 倍。字和雀斑这类细部会发糊。唐棠的围裙字、叶帆的晒斑受这个影响。铜哨的哨嘴和出音口仍然能辨认，不因此重画。

## 文件、README、json、总览图

路径符合 `projects/seaside-cafe/assets/portraits/<拼音>/<拼音>_normal.png`。十个 id 与清单一致：`xia-zhi`、`tang-tang`、`ye-fan`、`lu-yu`、`xu-zhiyan`、`su-nian`、`cheng-lu`、`shen-ruo`、`jiang-xubai`、`song-zhiyuan`。

`README.md` 的十行链接、`portrait-masters.json` 的 `file`、`verified_size`、`bytes`、`sha256`、`alpha_range`、`fully_transparent_pixels` 与磁盘文件一致。

`cast-preview.jpg` 是 1500×956 的 RGB JPEG 合影，不是交付用透明 PNG。十个人的服装和脸与单张一致，可以当合看用。立绘目录的 `README.md` 没有点名这张合影；`main` 上的立绘清单已经链到它。

json 里有两类和成图不一致的提示词，下次不要原样再用：

- 江叙白的提示词写了不要帽子。基准条文要求草帽，而且不要挡住脸。成图跟着提示词走了，所以没有帽子。
- 沈若的提示词写墨镜夹在领口。基准条文要求架在头顶。成图按条文，墨镜在头顶。
- 若干提示词要求腰线露出短裤或长裤。成图底边确实都有一截裤腰或短裤上半截。这和腰以上构图一致，不要求为了「不画腰以下」而重画。夏栀这一截是长裤，和档案里的默认长裙不一致，见她本人一条。

json 的 `source` / `reference` 是生成机器上的本地路径，只作记录，对不上仓库里的文件。

## 十人放在一起

画风和光照是一套的。脸型、发色、服装能分开：唐棠的短发和红围裙、叶帆的邮差帽、陆屿的背心和格子衫、许之言的白大褂和眼镜、苏念的黑衬衫和长卷发、程鹭的湿马尾、沈若的墨镜和眼线、江叙白的小揪、宋知远的敞怀花衬衫。没有两张脸撞成同一个人。

沈若左右留白更大，人在画里稍小。陆屿和宋知远几乎顶到左右边。建议以后派生图时把头顶留白和肩宽在画里的比例收齐。这是建议，不挡住已通过的几张。

## 逐角色

### 夏栀 `xia-zhi/xia-zhi_normal.png`

结论：可通过。无必须改。

对得上的：25 岁上下，肩薄，站得直。黑发中长，木簪松松挽在脑后，脸侧有碎发。深棕、眼尾略垂的杏眼。浅色棉麻衬衫。包上是一把铜钥匙，圆柄有灯塔刻纹，有钥匙杆和齿，不是单独的灯塔坠。旧铁皮糖盒没有出现。腰以上，手臂向下。底边露出一截裤腰，这一截按构图可以留。

- 建议改：露出的是长裤。`characters/xia-zhi.md` 的默认搭配是浅色棉麻衬衫配长裙或九分裤，基准图这一侧更适合先统一成长裙。不要求现在重画母版；以后派生服装时和长裙对齐。
- 建议改：远看嘴角略松。条文要求平常慢、有距离、不笑。近看不是明显的笑，若再定一版，把嘴角放平即可。
- 建议改：钥匙齿偏小，柄上的灯塔刻纹容易先被看成坠子。齿部可以再明确一点。

### 唐棠 `tang-tang/tang-tang_normal.png`

结论：须改。

对得上的：23 岁，娇小，手臂有力，小麦色。棕红齐耳短发，发尾略翘，红发带扎住刘海。深棕圆眼。白 T 恤，牛仔背带，深红外围裙。没有厨刀，没有雨靴。手臂向下。底边有一截裤腰，按腰以上构图可以留。

- **必须改：** 围裙胸口的两个浅色字不是「唐记」。笔画粘在一起，读不成这两个字。
- 建议改：嘴角有一点上扬。条文要求不瞪人，也不笑。

### 叶帆 `ye-fan/ye-fan_normal.png`

结论：须改。

对得上的：22 岁，高挑匀称。栗色高马尾，碎刘海，褪色绿邮差帽，帽顶没有被切掉。琥珀色、睁得大的眼睛。平常是看着人，不是大笑。绿色短袖制服，袖子卷起。斜挎鼓鼓的帆布邮包。没有举着的信封，没有单车。底边有一截裤腰，按腰以上构图可以留。

- **必须改：** 鼻梁上没有晒出来的雀斑。放大到鼻梁仍然是干净皮肤。
- 建议改：邮包和帽檐贴着画边，头顶留白几乎没有。

### 陆屿 `lu-yu/lu-yu_normal.png`

结论：须改。

对得上的：24 岁男性，肩宽，手臂和后颈晒得深。黑短发有点乱，额前一撮翘着。没有棒球帽。深色狭长单眼皮，眯着，不笑，带着不耐烦。洗白的灰背心，外面敞开格子衬衫。脖子上的旧铜哨能看出哨嘴、出音口和哨身。没有渔具。底边有一截裤腰，按腰以上构图可以留。

- **必须改：** 双手都在底边之外。缆绳磨出的茧和一道旧疤没有画出来，手指也无法检查。
- 建议改：体格偏壮，仍在「高大结实」里，不要再往健美选手上加。

### 许之言 `xu-zhiyan/xu-zhiyan_normal.png`

结论：通过。无必须改。

对得上的：31 岁上下，高而瘦，肩背直。黑短发修剪整齐，刘海略长，平视时不挡住眼睛。灰褐瞳，细金属框眼镜。不笑，神情冷静。白大褂套在白衬衫外，衬衫袖口挽到小臂。手指干净修长，数量正常。出诊箱没有出现。没有听诊器、红十字或名牌文字。底边有一截裤腰，按腰以上构图可以留。

- 建议改：左胸袋有一支没有字的笔。笔在人设里是放进出诊箱的，基准条文没有要求画笔。无字可以留；若改，直接拿掉，不要在笔帽上加「言」或其他字。

### 苏念 `su-nian/su-nian_normal.png`

结论：可通过。无必须改。

对得上的：27 岁，高瘦。黑色长卷发披着，长度到腰，没有盘起来。灰黑细长凤眼，下巴微抬，不笑。宽松黑色亚麻衬衫，袖子松松卷着。脖子上有灰色薄丝巾。没有吉他，没有牛仔外套，没有多余首饰。底边有一截裤腰，按腰以上构图可以留。

- 建议改：指尖的薄茧看不清。手已经在画面下沿，补的时候只加薄茧，不要改手的姿势。

### 程鹭 `cheng-lu/cheng-lu_normal.png`

结论：通过。无必须改。

对得上的：29 岁上下，肩背结实。黑发低马尾，头发是湿的，发尾偏褐。深灰细长单眼皮，目光直，不笑。灰蓝色短袖速干衬衫。没有潜水服。手腕上有一块圆形老式潜水表，深色表带。两条小臂都能看见浅色细疤。底边能看见工装裤腰带，只是裤腰这一截，不要求重画。

条文没有指定衬衫颜色。灰蓝可以留。

### 沈若 `shen-ruo/shen-ruo_normal.png`

结论：可通过。无必须改。

对得上的：28 岁，匀称偏瘦，站得直。深栗齐肩直发，发尾内扣，没有扎丸子。黑色上挑丹凤眼，有眼线，看着人带审视，不笑。剪裁清楚的白衬衫。墨镜架在头顶，不挡眼睛。没有日程本。底边有一截裤腰，细高跟没有入画。裤腰这一截按构图可以留。

- 建议改：一只手在身侧握着手机，屏幕是空白的，没有乱码，也没有举到脸前。基准条文没有写手机，统一规格是双手自然垂下。手机是她的标志物，又没有被标成不画，所以不作为必须改。若要和「不持物」严格对齐，拿掉手机，手仍垂着。

### 江叙白 `jiang-xubai/jiang-xubai_normal.png`

结论：须改。

对得上的：30 岁上下，修长偏瘦，手腕细。深棕发过耳，脑后一个小揪，碎发在颈侧。深褐桃花眼，神情温和，眼神不是空的。宽松浅色亚麻衬衫。袖口和手指上有干了的蓝、赭颜料。没有速写本，没有油画笔，没有画架。底边有一截裤腰，按腰以上构图可以留。

- **必须改：** 没有草帽。条文要求戴草帽，并且不要挡住脸。生成提示词写成了不要帽子，和条文相反。
- 建议改：嘴角有一点笑意。条文要求像在听人说话，不笑。
- 建议改：手指在底边被切去一截。颜料已经能看见，手不必整只重画，只要帽子加上之后手仍自然下垂。

### 宋知远 `song-zhiyuan/song-zhiyuan_normal.png`

结论：通过。无必须改。

对得上的：28 岁，宽肩，窄腰，肌肉清楚，皮肤古铜色。浅棕微卷短发，发梢被晒浅，有点乱。浅褐、圆而下垂的眼睛。闭着嘴的一点笑，不是大笑，眼角没有细纹。花衬衫敞着扣，里面没有打底。一只手腕上有一串褪色布手环，能看见磨过的号码。没有冲浪板，没有墨镜，没有项链，没有防寒泳衣。底边露出抽绳沙滩裤的上半截，按腰以上构图可以留。

- 建议改：手环上的号码保持磨掉、看不清即可。不要改成一组能读出来的新数字。

## 必须改汇总

| 角色 | 必须改 |
| --- | --- |
| 唐棠 | 围裙文字改成可认的「唐记」，不要别的字 |
| 叶帆 | 鼻梁补上晒出来的浅雀斑 |
| 陆屿 | 双手入画，补上缆绳磨出的茧和一道旧疤。铜哨不改 |
| 江叙白 | 加一顶不挡脸的草帽 |

## 修正提示词

下面每段都是在对应的 `*_normal.png` 上做局部修改，不是整张重抽。脸、体型、发型、服装、站姿、光线、画幅和透明背景保持不动。输出仍是 1536×2304、带真实 alpha 的 PNG。

### 唐棠

中文：只改围裙胸口那两个字，改成清晰、端正的「唐记」两个汉字，奶油色，字号适中。不要加第三字，不要英文，不要乱码。脸、红发带、衣服和姿势不动。

```text
Use case: precise-object-edit. Edit ONLY the two marks on the chest of 唐棠 Tang Tang's dark red apron. Replace them with exactly two clearly legible Chinese characters 「唐记」, modest cream-colored print, clean strokes, no extra characters, no Latin letters, no garbled glyphs. Preserve her face, expression, red hairband, hair, white shirt, denim straps, apron shape, arms, pose, lighting, framing, and real alpha transparency. Output 1536×2304 PNG.
```

### 叶帆

中文：只在鼻梁上加一点晒出来的浅褐色雀斑，稀疏，不要满脸。帽子、眼睛、邮包和表情不动。

```text
Use case: precise-object-edit. Edit ONLY the skin on the bridge of 叶帆 Ye Fan's nose. Add a light scattering of small sun-exposed freckles across the nose bridge, sparse and natural, not a full-face freckle mask and not face paint. Preserve her amber eyes, chestnut high ponytail, faded green postal cap, uniform, mail satchel, slight non-laughing expression, pose, lighting, framing, and real alpha transparency. Output 1536×2304 PNG.
```

### 陆屿

中文：只改手。铜哨已有哨嘴、出音口和哨身，不要动。把画幅略往下，或把人物略上移，让双手自然垂在身侧并进入画面。手上有缆绳磨出的茧和一道旧疤。不要加棒球帽，不要加渔具。仍是腰以上，底边留一截裤腰即可，不要画到大腿。

```text
Use case: precise-object-edit. One change on 陆屿 Lu Yu only. Reframe slightly so both hands hang naturally at his sides and are inside the canvas. Show rope calluses and one old scar on a hand. Do not touch the brass whistle: it already has a mouthpiece, a sound hole, and a whistle body. No cap, no fishing gear. Keep the waist-up crop; a short strip of waistband may stay, but do not extend to the thighs. Preserve his face, narrowed dark monolid eyes, unsmiling impatient expression, cowlick, gray tank, open plaid shirt, tan, lighting, and real alpha transparency. Output 1536×2304 PNG.
```

### 江叙白

中文：只加一顶浅色草帽。帽檐上推，不挡眼睛和脸。脑后的小揪和颈侧碎发仍要看见。不要加速写本、笔或画架。嘴角可以顺便放平，保留在听人说话的神情。

```text
Use case: precise-object-edit. Add ONE light straw hat on 江叙白 Jiang Xubai. Brim tilted up so it does not cover his eyes or face. Keep the small tied tuft behind his head and the loose strands at his neck visible. Do not add a sketchbook, brush, or easel. Optionally relax the mouth to closed and unsmiling while keeping a mild listening expression. Preserve his face, dark-brown eyes, linen shirt, dried paint on cuffs and fingers, slim build, hanging arms, lighting, framing, and real alpha transparency. Output 1536×2304 PNG.
```

### 可选的小修（不挡住定稿）

夏栀：嘴角放平。派生服装时，下装按档案统一成长裙；当前母版底边的长裤裤腰不用为这一条重画。苏念：指尖加薄茧。沈若：若要双手都不持物，拿掉身侧手机，墨镜仍留在头顶。许之言：若要更贴条文，拿掉胸袋那支无字笔。宋知远：手环号码保持磨损，不要写成新的清晰数字。十张底边的裤腰或短裤上半截都留着，不为此重画。

```text
Use case: precise-object-edit. Optional small passes, one character per edit. 夏栀: flatten the mouth to a closed unsmiling calm. When deriving later costumes, use her documented long skirt; do not redraw this master only to hide the trouser waistband. 苏念: add faint calluses on the fingertips only. 沈若: remove the phone so both hands hang empty; keep sunglasses on top of her head. 许之言: remove the plain pen from the coat pocket. 宋知远: keep the wristbands faded so any numbers are worn away, not newly legible. Leave the short waistband or upper-shorts strip at the bottom of every portrait. Preserve everything else, including real alpha transparency. Output 1536×2304 PNG.
```
