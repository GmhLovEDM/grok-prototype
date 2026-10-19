# 夏栀 xia-zhi

<img src="../../assets/portraits/xia-zhi/xia-zhi_normal.png" width="240" alt="夏栀现有母版">

现有母版：[xia-zhi_normal.png](../../assets/portraits/xia-zhi/xia-zhi_normal.png)

审核以这一版为准：[基准立绘审核 `fe9c128`](https://github.com/GmhLovEDM/grok-prototype/blob/fe9c1282fde5f5a4ebc439432c782a48db51d274/projects/seaside-cafe/assets/portraits/_reviews/portrait-masters-review.md)

## 重画要点

无必须改。可以按现有母版派生。

可选小修不挡住定稿。原文在审核报告「可选的小修」和「夏栀」一条，这里只引，不加成必须改：

- 嘴角放平，做成闭上的、不笑的平静。
- 派生服装时，下装按档案统一成长裙。当前母版底边的长裤裤腰不用为这一条重画。
- 钥匙齿偏小。若再定一版，齿部可以再明确一点。仍是一把旧铜钥匙，不是灯塔坠。

```text
Use case: precise-object-edit. Optional small passes, one character per edit. 夏栀: flatten the mouth to a closed unsmiling calm. When deriving later costumes, use her documented long skirt; do not redraw this master only to hide the trouser waistband.
```

## 规格

1536×2304，PNG，真实透明。腰以上。腰际可以露出一截裤腰或裙腰，再往下不画。糖盒不画。

固定身份：25 岁，纤细，肩薄，站得直。黑发中长，木簪松松挽在脑后，脸侧有碎发。深棕杏眼，眼尾略垂。浅色棉麻衬衫。包上挂一把旧铜钥匙：圆柄，柄上可以有很小的灯塔刻纹，有钥匙杆和齿。平常慢，有距离，不笑。

共同负向：风景，棋盘格，照片，3D，Q 版，水印，乱码，多指，糖盒，灯塔形吊坠，全身，大腿，鞋，别人的脸。

## 表情

默认这套可以现在派生。参考 `xia-zhi_normal.png`。只改表情。钥匙和木簪留着。

### xia-zhi_smile.png

笑是眼尾弯下去。

中文：眼尾弯一点，嘴角很轻。不是大声笑。

```text
Use case: precise-object-edit. Same 夏栀 master. Expression only: a small smile, outer eye corners softening downward. Not a wide laugh. Keep hairpin, key, shirt, pose, alpha. Output 1536×2304 PNG.
```

### xia-zhi_sad.png

难过用于看作文沉默、爷爷发病、一个人坐在塔顶、发言发抖。

中文：不哭出声。眼睛低下一点，嘴是平的。

```text
Use case: precise-object-edit. Same master. Expression only: quiet sadness, gaze slightly lowered, mouth flat, no tears streaming. Keep hairpin, key, pose, alpha. Output 1536×2304 PNG.
```

## 服装

### xia-zhi_coat_normal.png

灯塔上的旧藏青工作外套。第 6 到 8 天读报，以及后来上塔。袖子挽两道。里面仍是浅色衬衫。

派生时下装按长裙对齐，只在底边露出裙腰。不要为了长裙去重画当前母版。

中文：在同一人身上加一件旧的藏青工作外套，袖子挽两道。木簪、钥匙、脸保持。底边若要改，改成裙腰，不要画到裙摆。平常不笑。

```text
Use case: precise-object-edit. Same 夏栀 identity. Add her grandfather's old navy work coat over the pale shirt, sleeves rolled twice. Keep the wooden hairpin and the brass key. Unsmiling calm. At the bottom edge, prefer a long-skirt waistband rather than trousers; do not show the skirt below the waist. No sugar tin. Real alpha. Output 1536×2304 PNG.
```

### xia-zhi_coat_smile.png

外套那套的笑，眼尾弯下去。其余与 `coat_normal` 相同。

```text
Use case: precise-object-edit. Coat variant above, expression only: small smile, outer eyes softening. Keep coat, hairpin, key, alpha. Output 1536×2304 PNG.
```

### xia-zhi_coat_sad.png

外套那套的难过。其余与 `coat_normal` 相同。

```text
Use case: precise-object-edit. Coat variant above, expression only: quiet sadness, mouth flat. Keep coat, hairpin, key, alpha. Output 1536×2304 PNG.
```
