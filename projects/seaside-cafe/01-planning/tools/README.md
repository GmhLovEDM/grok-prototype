# 核对脚本

`check_routes.py` 读 [`../routes/`](../routes/README.md) 的节拍表，对照 [`../timeline.md`](../timeline.md) 和 [`../story-flow.md`](../story-flow.md)。只打印不一致，不改文件。没有不一致时退出码为 0。

在仓库根目录运行：

```
python3 projects/seaside-cafe/01-planning/tools/check_routes.py
```
