import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import mdx from '@astrojs/mdx'
import { remarkReadingTime } from './src/lib/remark-reading-time.mjs'

export default defineConfig({
  site: 'https://luna-az2.pages.dev',
  output: 'static',
  trailingSlash: 'never',
  integrations: [
    react(),
    sitemap(),
    mdx({
      remarkPlugins: [remarkReadingTime],
    }),
  ],
  redirects: {
    '/copies': '/copies/trionn',
    '/cases': '/copies/trionn',
    '/cases/trionn': '/copies/trionn',
    '/research': '/copies/trionn#case-study',
    '/blog': '/posts',
  },
})
