# yaokai-skills

个人 Codex Skills：京东商品采集与商品视频制作。

## 一键安装

在 Windows PowerShell 中运行以下一条命令，即可同时安装两个 Skill：

```powershell
python "$env:USERPROFILE\.codex\skills\.system\skill-installer\scripts\install-skill-from-github.py" --repo TigerOfCountryYao/yaokai-skills --path skills/jd-product-collector skills/jd-product-video
```

安装完成后，在下一轮对话即可使用 `$jd-product-collector` 和 `$jd-product-video`。若同名 Skill 已存在，安装器会停止，避免覆盖本地版本。

## 手动安装

将本仓库 `skills` 下所需 Skill 文件夹复制到：

`C:\Users\<你的用户名>\.codex\skills\`

重新打开 Codex 后，可使用 `$jd-product-collector` 采集商品资料，使用 `$jd-product-video` 基于已确认资料包制作 MP4 视频。

## Skill

- `jd-product-collector`：通过用户明确授权的 Chrome 登录态采集京东商品图片与逐 SKU 规格。
- `jd-product-video`：将已确认资料包制作成带口播、字幕和动态商品卡的 MP4。