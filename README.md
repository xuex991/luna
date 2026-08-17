# LUNA — 逆向研究档案

把优秀的东西拆开，看它是怎么做出来的。两个栏目，同一个母题：

- **前端逆向**：完整复刻优秀 WebGL 案例（TRIONN Hero 等），提炼可复用的交互、参数和性能结论。
- **数据逆向**：拆解 X 上的工程 claim，拉公开数据逐条验证，给出可证伪的结论（属实 / 部分属实 / 夸大 / 虚构）。

## 技术栈

- [Astro](https://astro.build/) 7（静态输出，SSG）
- React 19 islands（Three.js / GSAP 交互）
- Content Collections：`src/content/posts`（数据逆向）+ `src/content/cases`（前端逆向）
- 部署：Cloudflare Pages

## 开发

```bash
npm install
npm run dev      # 本地开发 http://localhost:4321
npm run build    # 类型检查 + 构建到 dist/
```

## 写一篇数据逆向文章

在 `src/content/posts/` 下新建 `.mdx`：

```mdx
---
title: "标题：claim 是什么，验证结果是什么"
description: "一段话摘要"
pubDate: 2026-08-14
tags: ["xxx", "yyy"]
isDraft: false
---

开头给出 X 原帖 claim（附链接），然后拉数据、逐条验证、给结论。
```

## 写一个前端逆向案例

在 `src/content/cases/` 下新建 `.mdx`，前置字段：`title` / `tools` / `preview` / `demoUrl`。

## 路由

| 路径 | 说明 |
|---|---|
| `/` | 母题首页 |
| `/copies/trionn` | 前端逆向案例（TRIONN） |
| `/blocks` `/playgrounds` | 提炼模块与参数实验 |
| `/posts` | 数据逆向文章列表 |
| `/posts/[slug]` | 文章详情 |

旧路由 `/blog`、`/cases` 等已 301 到新位置。
