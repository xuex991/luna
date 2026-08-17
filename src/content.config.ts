import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

// 数据逆向:拆解 X 上的工程 claim,拉数据验证(原 harness-blog 内容)
const posts = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    isDraft: z.boolean().default(false),
    relatedPosts: z.array(z.string()).default([]),
    readingTimeMinutes: z.number().optional(),
  }),
})

// 前端逆向:优秀 WebGL/UI 案例拆解(原 LUNA 内容,逐步迁移到 MDX)
const cases = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/cases' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date().optional(),
    tools: z.array(z.string()).default([]),
    preview: z.string().optional(),
    demoUrl: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
})

export const collections = { posts, cases }
