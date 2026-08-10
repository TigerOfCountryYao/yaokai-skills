# yaokai-skills

个人 Codex Skills：京东商品采集与商品视频制作。

## 环境要求

安装命令依赖较新的 Node.js；推荐 Node.js 22。安装前先运行：

```bash
node -v
```

若出现 `node:util does not provide an export named styleText`，说明当前终端使用了过旧的 Node.js。切换到 Node 22 后重新打开终端再安装；Windows 使用 NVM 时可执行：

```powershell
nvm use 22.23.1
```

安装器无法自动修复此问题，因为它本身必须先由 Node.js 启动。

## 一键安装

在 macOS、Linux 或 Windows 的终端中运行以下命令，即可全局安装两个 Skill：

```bash
npx skills add https://github.com/TigerOfCountryYao/yaokai-skills --skill jd-product-collector jd-product-video --full-depth --global
```

安装完成后，在下一轮对话即可使用 `$jd-product-collector` 和 `$jd-product-video`。若同名 Skill 已存在，安装器会停止，避免覆盖本地版本。

## 手动安装

将本仓库 `skills` 下所需 Skill 文件夹复制到 Codex 的全局 Skills 目录后，重新打开 Codex。

## Skill

- `jd-product-collector`：通过用户明确授权的 Chrome 登录态采集京东商品图片与逐 SKU 规格。
- `jd-product-video`：将已确认资料包制作成带口播、字幕和动态商品卡的 MP4。