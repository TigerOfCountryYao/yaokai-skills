# yaokai-skills

面向 Codex 的京东商品采集与商品视频制作 Skills。

## 安装前准备：Node.js 22

`npx skills` 依赖较新的 Node.js；推荐 Node.js 22。先确认当前版本：

```bash
node -v
```

若不是 `v22.x`，从 [Node.js 官网](https://nodejs.org/) 安装 Node.js 22，或使用版本管理器。

Windows 已安装 NVM for Windows 时：

```powershell
nvm install 22.23.1
nvm use 22.23.1
node -v
```

若出现 `node:util does not provide an export named styleText`，表示当前终端使用了旧 Node。运行 `where.exe node` 检查路径，切换到 Node 22 后关闭并重新打开终端。

## 一键安装

在 macOS、Linux 或 Windows 的终端运行：

```bash
npx skills add https://github.com/TigerOfCountryYao/yaokai-skills --skill jd-product-collector jd-product-video --full-depth --global
```

安装完成后，在下一轮 Codex 对话即可使用以下 Skill。若同名 Skill 已存在，安装器会停止，避免覆盖本地版本。

## 包含的 Skill

- [`jd-product-collector`](skills/jd-product-collector)：采集京东商品图片与逐 SKU 规格。
- [`jd-product-video`](skills/jd-product-video)：将已确认资料包制作成 MP4 商品视频。