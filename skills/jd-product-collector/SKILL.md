---
name: jd-product-collector
description: 使用用户明确授权的 Chrome 登录态采集京东商品数据。用户提供京东短链接或商品链接，并要求提取产品图、详情长图、逐 SKU 规格或导出资料包时使用。自动枚举可选 SKU，不伪造不可售款式的数据，并使用内置脚本生成本地商品资料包。
---

# 京东商品采集

仅在用户明确授权时使用其 Chrome 登录态。不得读取或导出 Cookie、账户资料、订单、购物车、精确配送地址或无关推荐内容；不得加购或购买。

## 采集流程

1. 使用用户已授权的 Chrome 浏览器，在新的 Agent 标签页打开每个京东短链接；等待最终 URL 变为 `item.jd.com/<SKU>.html`，并保留原短链接。调用随附的 `classifyJDPage()` 判断落地页：
   - `mobile_product`：使用 `desktopProductURLFromMobile()` 转为同一 SKU 的 `item.jd.com/<SKU>.html` 后继续；
   - `coupon`：只在 `clickJDClaimButton()` 报告页面存在**唯一可见**“一键领取”按钮时点击一次；若没有或有多个按钮，停止并说明原因；
   - `login`、`rate_limited`：停止，请用户在 Chrome 中完成登录或等待风控冷却；不得绕过。
2. 不要由 Agent 为每个 SKU 单独发起点击和采集命令。将随附的 `scripts/capture_jd_variants.mjs` 导入已授权浏览器的持久运行时，并只调用一次 `collectJdVariants(jdTab, { sourceUrl: originalShortUrl, captureAllSKUs })`。它会：
   - 枚举系列品 `.specification-series-item` 及其 `.specification-item-sku` 款式；
   - 跳过不可售款式，只记录其标签与图片 URL；
   - 在用户要求“全部 SKU”时，依次切换每个可售款式、等待页面稳定，并重新读取 SKU、价格、选中款主图、规格表和详情长图；默认仅采集链接落地后的默认款；
   - 返回可直接写入 `build_product_bundle.py` 的采集 JSON。
3. 浏览器运行时应以本 Skill 的绝对 `file://` 模块 URL 导入该脚本。例如：

```js
const { pathToFileURL } = await import("node:url");
const { collectJdVariants, writeCaptureJson } = await import(pathToFileURL("<skill-dir>/scripts/capture_jd_variants.mjs").href);
const capture = await collectJdVariants(jdTab, { sourceUrl: originalShortUrl });
await writeCaptureJson("<临时采集JSON路径>", capture);
```

4. 仅在枚举器报告选择器缺失、页面状态异常或 CAPTCHA 时停止并向用户说明。不得退回为逐 SKU 的手工式 Agent 点击，也不得绕过 CAPTCHA。
5. 采集规则和输出字段参见 [capture-schema.md](references/capture-schema.md)。在枚举器返回后，直接将它写出的 JSON 传给内置打包脚本下载图片并写入商品资料包；不要重新逐项读取页面。

## 平台无关的路径与脚本

使用当前加载的本 Skill 文件夹作为 `<skill-dir>`；不要假定它在 `.codex` 或 `.agents`。一键安装通常位于 `~/.agents/skills/jd-product-collector`。

在首次采集前运行环境检查。它只检查本机 Python 与 Chrome/Chromium；“已授权浏览器控制能力”必须由调用 Agent 提供，脚本不会也不能检查、读取或导出登录 Cookie：

```text
<python3-command> "<skill-dir>/scripts/check_environment.py"
```

若同一工作流下一步要用 HyperFrames 渲染视频，则使用 `--with-video` 额外检查 Node.js、FFmpeg 和 HyperFrames：

```text
<python3-command> "<skill-dir>/scripts/check_environment.py" --with-video
```

安装缺失依赖时按当前系统执行下列命令，再重新运行检查。HyperFrames 不需要全局安装，统一用 `npx --yes hyperframes@latest` 运行。

| 系统 | Node.js（22+）与 FFmpeg | 验证 HyperFrames |
| --- | --- | --- |
| Windows（PowerShell） | `winget install OpenJS.NodeJS.LTS`<br>`winget install Gyan.FFmpeg` | `npx --yes hyperframes@latest doctor` |
| macOS（Homebrew） | `brew install node@22 ffmpeg`<br>`brew link --overwrite node@22` | `npx --yes hyperframes@latest doctor` |
| Debian/Ubuntu | `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo -E bash -`<br>`sudo apt-get install -y nodejs ffmpeg` | `npx --yes hyperframes@latest doctor` |

在 Windows 安装后重新打开终端；macOS/Linux 使用 `python3`，Windows 通常使用 `python`。Edge TTS 是视频阶段的可选依赖：`<python3-command> -m pip install edge-tts`。

所有任务默认保存至 `~/Documents/JD商品采集`：Windows 为用户目录下的 `Documents\\JD商品采集`，macOS/Linux 为 `$HOME/Documents/JD商品采集`。不得写入当前工作区或既有采集任务目录。

每个用户请求开始时，创建一个 `YYYYMMDD-HHmmss-简短名称` 格式的采集任务 ID，例如 `20260808-143000-haier-washers`。同一请求内的所有链接使用相同 ID；每个新请求使用新 ID，不复用或覆盖已有任务。

使用系统的 Python 3 命令运行脚本：Windows 通常为 `python`，macOS/Linux 通常为 `python3`。

```text
<python3-command> "<skill-dir>/scripts/build_product_bundle.py" --input capture.json --collection-id "20260808-143000-haier-washers"
```

使用 `--input -` 从标准输入读取 JSON。默认输出根目录为上述位置；只有用户明确要求其他位置时才传 `--output-root`。脚本拒绝覆盖既有 `jd_<root_sku>` 目录，除非明确传入 `--overwrite`。

## 质量检查

- `product-index.json` 必须列出所有已解析 SKU 与所有不可售款式。
- 每个已解析 SKU 必须有独立的 `product.json` 与 `specifications.json`。
- 不得将一个 SKU 的规格复制给另一个 SKU。
- 规格值不得包含 CSS、HTML 或 `ssd-module` 文本。
- 图片清单必须保留源 URL、解析后 URL、本地文件、SHA-256 和字节数。

## 异常处理

- Chrome 出现登录失效或 CAPTCHA 时停止，并请用户在 Chrome 中处理；不得绕过。
- 选择器缺失时，将字段保存为不可用并写明原因；不得按相似商品猜测。
- 详情图下载失败时，保留其 URL 并在图片清单中记录失败。
