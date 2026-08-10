# yaokai-skills

个人 Codex Skills：京东商品采集与商品视频制作。

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