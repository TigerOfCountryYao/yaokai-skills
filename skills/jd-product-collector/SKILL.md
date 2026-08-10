---
name: jd-product-collector
description: 使用用户明确授权的 Chrome 登录态采集京东商品数据。用户提供京东短链接或商品链接，并要求提取产品图、详情长图、逐 SKU 规格或导出资料包时使用。逐个解析可选 SKU，不伪造不可售款式的数据，并使用内置脚本生成本地商品资料包。
---

# 京东商品采集

仅在用户明确授权时使用其 Chrome 登录态。不得读取或导出 Cookie、账户资料、订单、购物车、精确配送地址或无关推荐内容；不得加购或购买。

## 采集流程

1. 使用用户已授权的 Chrome 浏览器。
2. 在新的 Agent 标签页打开每个京东短链接，等待最终 URL 变为 `item.jd.com/<SKU>.html`；记录短链接与解析后 URL。
3. 采集当前 SKU 可见的标题、当前价格、店铺、可售状态和主图。不要使用旧版 JD 选择器，如 `#name` 或 `#jd-price`。
4. 从 `.specification-item-sku` 读取可选款式。
   - 对每个可售款式：点击并等待商品 URL 变化或稳定，再重新采集 SKU、价格、主图和规格表。
   - 不要强行点击不可售款式。保留展示名称与不可售状态。若缩略图 URL 包含 `/s<宽>x<高>_jfs/`，可将该片段替换为 `/jfs/` 得到高清图 URL，但必须标记为仅图片，不得推断 SKU 或规格。
5. 对每个已解析 SKU，通过 DOM 行读取规格表，不得截取整页文本。参见 [capture-schema.md](references/capture-schema.md)。
6. 仅从 `#detail-main` 中指向 `360buyimg.com/sku/` 的 CSS `url(...)` 提取详情长图。不得采集 `continuous-product-card` 或推荐图。
7. 按参考 Schema 组装采集 JSON，再运行内置脚本下载图片并写入商品资料包。

## 平台无关的路径与脚本

使用当前加载的本 Skill 文件夹作为 `<skill-dir>`；不要假定它在 `.codex` 或 `.agents`。一键安装通常位于 `~/.agents/skills/jd-product-collector`。

所有任务默认保存至 `~/Documents/JD商品采集`：Windows 为用户目录下的 `Documents\\JD商品采集`，macOS/Linux 为 `$HOME/Documents/JD商品采集`。不得写入当前工作区或既有采集任务目录。

每个用户请求开始时，创建一个 `YYYYMMDD-HHmmss-简短名称` 格式的采集任务 ID，例如 `20260808-143000-haier-washers`。同一请求内的所有链接使用相同 ID；每个新请求使用新 ID，不复用或覆盖已有任务。

运行随附的跨平台 Python 脚本：

```text
python "<skill-dir>/scripts/build_product_bundle.py" --input capture.json --collection-id "20260808-143000-haier-washers"
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

