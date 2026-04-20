import type { FeedOptions, Item } from 'feed'
import { dirname } from 'node:path'
import fg from 'fast-glob'
import { Feed } from 'feed'
import fs from 'fs-extra'
import matter from 'gray-matter'
import MarkdownIt from 'markdown-it'

const DOMAIN = 'https://www.xuzhibai.com'
const AUTHOR = {
  name: '叙枝白',
  link: DOMAIN,
}
const markdown = MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
})

async function run() {
  await buildBlogRSS()
}

async function buildBlogRSS() {
  const files = await fg('pages/posts/*.md')

  const options = {
    title: '叙枝白的博客',
    description: 'Xuzhibai\' Blog',
    id: 'https://www.xuzhibai.com/',
    link: 'https://www.xuzhibai.com/',
    copyright: 'CC BY-NC-SA 4.0 2021 © Xuzhibai',
    feedLinks: {
      json: 'https://www.xuzhibai.com/feed.json',
      atom: 'https://www.xuzhibai.com/feed.atom',
      rss: 'https://www.xuzhibai.com/feed.xml',
    },
  }
  const posts: any[] = (
    await Promise.all(
      files.filter(i => !i.includes('index'))
        .map(async (i) => {
          const raw = await fs.readFile(i, 'utf-8')
          const { data, content } = matter(raw)

          // Skip notes - check if type is explicitly "note" or if it's from notes directory
          if (data.type === 'note')
            return

          // Skip files without a valid date
          if (!data.date)
            return
          // Validate date is valid before using it
          const dateObj = new Date(data.date)
          if (Number.isNaN(dateObj.getTime()))
            return

          const html = markdown.render(content)
            .replace('src="/', `src="${DOMAIN}/`)

          if (data.image?.startsWith('/'))
            data.image = DOMAIN + data.image

          return {
            ...data,
            date: dateObj,
            content: html,
            author: [AUTHOR],
            link: DOMAIN + i.replace(/^pages(.+)\.md$/, '$1'),
          }
        }),
    ))
    .filter(Boolean)

  posts.sort((a, b) => +new Date(b.date) - +new Date(a.date))

  await writeFeed('feed', options, posts)
}

async function writeFeed(name: string, options: FeedOptions, items: Item[]) {
  options.author = AUTHOR
  options.image = 'https://www.xuzhibai.com/avatar.jpg'
  options.favicon = 'https://www.xuzhibai.com/favicon.jpg'

  const feed = new Feed(options)

  items.forEach(item => feed.addItem(item))
  // items.forEach(i=> console.log(i.title, i.date))

  await fs.ensureDir(dirname(`./dist/${name}`))
  await fs.writeFile(`./dist/${name}.xml`, feed.rss2(), 'utf-8')
  await fs.writeFile(`./dist/${name}.atom`, feed.atom1(), 'utf-8')
  await fs.writeFile(`./dist/${name}.json`, feed.json1(), 'utf-8')

  // Generate zh/index.xml to maintain compatibility with the former setup
  await fs.ensureDir('./dist/zh')
  await fs.writeFile('./dist/zh/index.xml', feed.rss2(), 'utf-8')
}

run()
