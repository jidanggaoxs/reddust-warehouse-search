# ⛏ 仓库导航

把 Minecraft 仓库清单做成一个纯静态网站：搜物品、看坐标、逛六个区域、按分类筛选、导出 CSV。无需后端、无需数据库，所有数据都在浏览器里。

## 站点概览

| 项目 | 数量 |
| --- | --- |
| 物品 | 721 |
| 总格位 | 722 |
| 区域 | 6（AL / AR / BL / BR / CL / CR） |
| 空位 | 1（BR-4-44） |
| 分类 | 8 |

- **总览**：搜索、分类快捷筛选、最近查看、区域概览。
- **地图**：六个区域全部铺开，722 个格位逐格展示，空位单独标记。
- **清单**：721 条物品逐条可查，支持区域/分类/排序、分页和按当前筛选导出 CSV。
- **说明**：坐标规则、分类口径、数据更新方法、快捷键。
- **详情**：点击任意物品打开详情，可复制编码/位置，或跳到地图定位。

## 本地打开

直接双击 `index.html` 即可。数据、样式、脚本都使用相对路径，`file://` 下也能工作。

如果想用本地服务器（更接近线上环境）：

```bash
python -m http.server 8000
# 然后打开 http://127.0.0.1:8000/
```

## 目录结构

```text
minecraft-warehouse/
├─ index.html            总览
├─ map.html              地图
├─ items.html            清单
├─ about.html            说明
├─ 404.html              自定义 404
├─ assets/
│  ├─ data.js            生成的数据（window.WH_DATA）
│  ├─ core.js            坐标 / 分类 / 搜索 / URL 状态
│  ├─ site.css           全站样式
│  ├─ ui.js              公共 DOM 与详情弹窗
│  ├─ index.js           总览页
│  ├─ map.js             地图页
│  ├─ items.js           清单页
│  └─ about.js           说明页
├─ data/
│  └─ inventory.csv      全量 CSV（UTF-8 BOM）
├─ tools/
│  ├─ build_data.py      从原始 HTML 提取并校验数据
│  └─ test_core.js       核心逻辑测试
├─ robots.txt
├─ .nojekyll
└─ README.md
```

## 数据更新

原始数据来自单文件页面里的 `inventory` / `names` / `zones`。更新源文件后重新生成：

```bash
python tools/build_data.py --source "C:\path\to\minecraft_warehouse_search.html"
node tools/test_core.js
```

`build_data.py` 会校验：物品总数、区域容量、编码格式、名称唯一、空位数量。任何一项不通过都会以非零状态退出，不会写出半成品数据。

生成物：

- `assets/data.js`
- `data/inventory.csv`

## 搜索规则

- 空格分隔多个关键词，全部命中才显示（AND）。
- 可匹配物品名称、编码、区域名称、分类名称。
- 输入完整编码（如 `AL-2-13`）会优先精确命中。
- 排序：名称完全匹配 > 名称前缀 > 名称包含 > 编码命中。
- 搜索词、区域、分类、排序、页码、当前物品都会同步到 URL hash，可以直接分享链接。

## 发布到 GitHub Pages

> 需要一个 GitHub 账号。仓库建议设为 **Public**（公开仓库才能免费使用 Pages）。

1. 在 GitHub 新建仓库 `reddust-warehouse-search`（当前站点使用的仓库）。
2. 把本目录 **里面的内容** 上传到仓库根目录（不是把 `minecraft-warehouse` 文件夹整个套一层）。
   - 要包含 `.nojekyll`。它是隐藏文件，Windows 资源管理器里需要开启“显示隐藏的项目”。
3. 打开仓库的 **Settings → Pages**。
4. **Build and deployment → Source** 选 **Deploy from a branch**。
5. 分支选 **main**，目录选 **/(root)**，保存。
6. 等 1–3 分钟，访问：

```text
https://jidanggaoxs.github.io/reddust-warehouse-search/
```

如果仓库名或用户名不同，把地址中的用户名和最后一段换成实际值。站点全部使用相对路径，放在任意子路径下都能正常工作。

### 可选：Cloudflare Pages

如果 GitHub Pages 访问慢，也可以把同一目录拖到 Cloudflare Pages：

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Upload assets。
2. 上传本目录内容，部署后得到 `https://<项目名>.pages.dev/`。

两种方式都是纯静态托管，不需要改代码。

## 隐私与离线

- 没有后端请求，没有统计脚本，没有外部字体或 CDN。
- 搜索和筛选全部在本地浏览器完成。
- “最近查看”只存在当前浏览器的 `localStorage`，可随时在总览页清空。
- 断网后仍可打开本地文件使用。

## 说明

- 分类由规则自动推断，个别物品可能因命名差异归到“其他物品”；可在 `assets/core.js` 的 `RULES` 中调整。
- 坐标规则：货架区编码为 `区域-排-格`（如 `AL-2-13`），柜子区为 `区域-格`（如 `CL-07`）。
- 站点不提供在线编辑；数据变更请改源文件后重新生成。
