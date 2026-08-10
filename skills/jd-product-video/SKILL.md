---
name: jd-product-video
description: 将用户已确认的京东商品资料包制作成带动态商品卡、口播、字幕和封面的 MP4 视频。用户已确认商品与 SKU 范围，并要求基于已采集的京东商品数据和图片制作商品介绍、推荐合集、主题方案或横向对比视频时使用。
---

# 京东商品视频制作

仅向用户交付已质检的 MP4。页面、音频、HTML 源码和渲染文件均留在视频任务目录中，供修复和重渲染，不作为交付物展示。

## 前置确认关卡

资料包必须列出用户已确认的商品与 SKU 范围；否则停止。调用方没有明确提供以下值时，逐项询问并等待确认：

1. 内容模式：`合集/推荐`、`横向对比` 或 `主题方案`。
2. [视频规范](references/video-spec.md)中的一套口播结构。
3. [视频规范](references/video-spec.md)中的一套视觉规范。
4. 画幅：`9:16`、`16:9` 或 `1:1`。
5. 封面：提供 Seedance 生图（询问 API Key）或“商品主图 + 标题”的排版封面；先给出 3 个标题候选，等待用户选定。非 AI 封面不得直接使用裸商品图。
6. TTS：除非调用方已明确传入用户既有选择，否则询问 `Edge TTS`（免费）或 `MiniMax`（需 API Key）。API Key 只能放在当前进程内存或临时环境变量中，绝不写入资料包、任务目录、脚本或 Skill。

不要推断商品/SKU 范围、价格、规格、评分、促销信息或用户偏好。任一必要确认缺失时，不进入创作。

## 环境检查

在生成项目文件前运行内置检查。它检查 Node.js（22+）、FFmpeg、`npx hyperframes` 和所选 TTS 的依赖；只报告密钥环境变量是否存在，绝不输出密钥值。

```powershell
& "C:\Users\yaokai\.codex\skills\jd-product-video\scripts\check_environment.ps1" `
  -TtsMode "EdgeTTS"
```

MiniMax 或 Seedance 需要密钥时，将调用方刚取得的临时环境变量名传给 `-RequiredSecretEnv`。检查失败即停止，并说明缺少的环境，不绕过。

## 文件存放规范

所有视频必须保存在已确认资料包所属的采集任务目录，不得写入当前工作区，也不得和其他采集任务混放：

```text
C:\Users\yaokai\Documents\JD商品采集\<采集任务ID>\
  jd_<SKU>\...
  videos\<视频任务ID>\
    assets\      # 仅本任务使用的素材副本或生成图
    voice\       # 口播与字幕源文件
    project\     # HTML/CSS/JS 与 DESIGN.md
    output\final.mp4
    job.json
```

每条视频使用新的 `<视频任务ID>`；同一资料包可有多条视频。创建源码前先初始化，已有同名目录时脚本会拒绝覆盖：

```powershell
python "C:\Users\yaokai\.codex\skills\jd-product-video\scripts\create_video_job.py" `
  --dossier-dir "C:\Users\yaokai\Documents\JD商品采集\<采集任务ID>" `
  --video-id "20260808-143000-roundup"
```

## 制作动态商品页

直接创建 HTML/CSS/JS 视频合成项目；不要让其他 Agent 再读取或执行外部 Skill 提示词。

- 读取 [视频规范](references/video-spec.md)，在 `project/DESIGN.md` 写明所选视觉规范的色彩、字体、动效和禁忌。
- 先完成每页完全可见时的静态布局，再添加动效。内容使用 flex/grid；绝对定位只用于装饰。
- 只使用已采集的本地高清商品素材。价格是时效信息，只有资料包中存在时才展示，并标记为“参考价”。
- 默认每个已确认商品/SKU 1 张动态商品卡，另加封面页和结尾页。仅在用户要求深讲或该商品口播超过约 12 秒时增加第 2 页。
- 以最终口播时长作为页面时间线；烧录简洁同步字幕，只高亮口播中确实提到的事实。
- 为每个定时片段设置唯一的 `data-composition-id`、`data-start`、`data-duration` 与 `data-track-index`；同步注册暂停状态的 GSAP 时间线到 `window.__timelines`。
- 每页元素应有目的明确的入场，每页之间必须有转场。不要跳切、无限循环、异步创建时间线，或在转场前做退出动画。
- 渲染画面中的标题至少 60px、正文至少 20px、标签至少 16px。让动态文本换行或自适应；不要用 `<br>` 强制普通文本换行。
- 用户未提供可用音乐或明确授权来源时，不添加背景音乐；如添加，始终压低到不干扰口播。

## 质检与渲染

创建合成项目后运行内置渲染脚本：

```powershell
& "C:\Users\yaokai\.codex\skills\jd-product-video\scripts\render_hyperframes.ps1" `
  -ProjectDir "...\videos\<视频任务ID>\project" `
  -OutputPath "...\videos\<视频任务ID>\output\final.mp4"
```

脚本会执行环境检查、语法检查、对比度验证、文本溢出检查和最终渲染。修复所有错误及对比度/布局警告后，才交付 `final.mp4`。上传发布不属于本 Skill。

