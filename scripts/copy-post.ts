import { existsSync, statSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import { basename, join } from 'pathe'
import prompts from 'prompts'

const POSTS_DIR = fileURLToPath(new URL('../pages/posts', import.meta.url))

interface PostMeta {
  title: string
  date: string
  lang: string
  duration: string
}

/**
 * 计算阅读时长（基于字数）
 * 中文约 400 字/分钟，英文约 200 词/分钟
 */
function calculateReadTime(content: string): string {
  // 移除 YAML frontmatter
  const text = content.replace(/^---[\s\S]*?---\n/, '')

  // 统计中文字符数
  const chineseChars = (text.match(/[\u4E00-\u9FA5]/g) || []).length
  // 统计英文单词数（粗略估计）
  const englishWords = (text.match(/[a-z]+/gi) || []).length

  // 阅读时间（分钟）
  const minutes = Math.max(1, Math.ceil(chineseChars / 400 + englishWords / 200))

  return `${minutes}min`
}

/**
 * 提取文章标题（优先匹配一级标题，其次二级标题）
 */
function extractTitle(content: string): string | null {
  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const h1 = content.match(/^#\s+(.+)$/m)
  if (h1) {
    return h1[1].trim()
  }

  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const h2 = content.match(/^##\s+(.+)$/m)
  return h2 ? h2[1].trim() : null
}

/**
 * 去除初稿部分，只保留终稿内容
 * 终稿与初稿以 "---\n# 初稿" 分隔
 * 同时去除 "# 终稿" 标题行
 */
function extractFinalDraft(content: string): string {
  // 先去除初稿及之后的内容
  let result = content.replace(/\n---\n# 初稿[\s\S]*$/, '')
  // 去除 "# 终稿" 标题行
  result = result.replace(/^# 终稿\n*/m, '')
  return result
}

/**
 * 从文件名提取周刊编号
 */
function extractWeeklyNumber(filename: string): number {
  const match = filename.match(/weekly-(\d+)/i)
  return match ? Number.parseInt(match[1], 10) : 0
}

/**
 * 获取下一个周刊编号
 */
async function getNextWeeklyNumber(): Promise<number> {
  const files = await fg('weekly-*.md', {
    absolute: true,
    cwd: POSTS_DIR,
  })

  const numbers = files.map(file => extractWeeklyNumber(basename(file)))
  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0

  return maxNumber + 1
}

/**
 * 生成文章元数据
 */
function generateFrontmatter(meta: PostMeta): string {
  return `---
title: "${meta.title}"
date: ${meta.date}
lang: ${meta.lang}
duration: ${meta.duration}
---

`
}

/**
 * 获取北京时间格式的 ISO 日期字符串
 */
function getBeijingTimeISO(): string {
  const now = new Date()
  const offset = 8 * 60 * 60 * 1000
  const beijingTime = new Date(now.getTime() + offset + now.getTimezoneOffset() * 60 * 1000)
  return beijingTime.toISOString().replace('Z', '+08:00')
}

/**
 * 确保周刊编号格式正确
 */
function padWeeklyNumber(num: number): string {
  return String(num).padStart(3, '0')
}

async function main() {
  // 从环境变量获取源目录
  const sourceDir = process.argv[2] || process.env.BLOG_SOURCE_DIR

  if (!sourceDir) {
    console.error('❌ 请提供源目录路径')
    console.log('\n使用方法:')
    console.log('  1. 设置环境变量: export BLOG_SOURCE_DIR=<源目录路径>')
    console.log('  2. 或通过参数: pnpm tsx scripts/copy-post.ts <源目录路径>')
    process.exit(1)
  }

  if (!existsSync(sourceDir)) {
    console.error(`❌ 目录不存在: ${sourceDir}`)
    process.exit(1)
  }

  console.log('📂 扫描目录:', sourceDir)

  // 扫描所有 markdown 文件
  const files = await fg('**/*.md', {
    absolute: true,
    cwd: sourceDir,
    ignore: ['**/node_modules/**'],
  })

  if (files.length === 0) {
    console.error('❌ 未找到 markdown 文件')
    process.exit(1)
  }

  // 按修改时间排序，获取最新的文件
  const sortedFiles = files
    .map(file => ({
      file,
      mtime: statSync(file).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime)

  // 显示找到的文件（最新的前5个）
  console.log('\n📄 找到的 markdown 文件（按修改时间排序）:')
  sortedFiles.slice(0, 5).forEach((item, index) => {
    const time = new Date(item.mtime).toLocaleString('zh-CN')
    console.log(`  ${index + 1}. ${basename(item.file)} (${time})`)
  })

  // 选择文件
  const { selectedIndex } = await prompts({
    type: 'select',
    name: 'selectedIndex',
    message: '请选择要复制的文件',
    choices: sortedFiles.slice(0, 5).map((item, index) => ({
      title: `${basename(item.file)} (${new Date(item.mtime).toLocaleString('zh-CN')})`,
      value: index,
    })),
    initial: 0,
  })

  if (selectedIndex === undefined) {
    console.log('❌ 已取消')
    process.exit(0)
  }

  const selectedFile = sortedFiles[selectedIndex].file
  console.log('\n✅ 已选择:', basename(selectedFile))

  // 读取文件内容
  let content = await fs.readFile(selectedFile, 'utf-8')

  // 去除初稿部分，只保留终稿
  content = extractFinalDraft(content)

  // 检查是否已有 frontmatter
  const hasFrontmatter = content.startsWith('---')

  let meta: PostMeta

  if (hasFrontmatter) {
    // 解析现有 frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1]

      // 提取标题
      // eslint-disable-next-line regexp/no-super-linear-backtracking
      const titleMatch = frontmatter.match(/title:\s*["']?(.+?)["']?\s*$/m)
      const title = titleMatch ? titleMatch[1].replace(/["']/g, '') : extractTitle(content) || '未命名'

      // 提取日期
      // eslint-disable-next-line regexp/no-super-linear-backtracking
      const dateMatch = frontmatter.match(/date:\s*(.+?)\s*$/m)
      let date = dateMatch ? dateMatch[1] : getBeijingTimeISO()

      // 如果日期没有时区信息，添加北京时间
      if (date && !date.includes('+') && !date.includes('T')) {
        date = `${date}T00:00:00+08:00`
      }

      meta = {
        title,
        date,
        lang: 'zh',
        duration: calculateReadTime(content),
      }

      // 移除旧的 frontmatter
      content = content.replace(/^---[\s\S]*?---\n*/, '')
    }
    else {
      meta = {
        title: extractTitle(content) || '未命名',
        date: getBeijingTimeISO(),
        lang: 'zh',
        duration: calculateReadTime(content),
      }
    }
  }
  else {
    meta = {
      title: extractTitle(content) || '未命名',
      date: getBeijingTimeISO(),
      lang: 'zh',
      duration: calculateReadTime(content),
    }
  }

  // 显示元数据并询问是否修改
  console.log('\n📝 生成的元数据:')
  console.log(`  标题: ${meta.title}`)
  console.log(`  日期: ${meta.date}`)
  console.log(`  语言: ${meta.lang}`)
  console.log(`  阅读时长: ${meta.duration}`)

  const { confirmMeta } = await prompts({
    type: 'confirm',
    name: 'confirmMeta',
    message: '是否使用以上元数据？',
    initial: true,
  })

  if (confirmMeta === undefined) {
    console.log('❌ 已取消')
    process.exit(0)
  }

  if (!confirmMeta) {
    // 手动输入标题
    const { customTitle } = await prompts({
      type: 'text',
      name: 'customTitle',
      message: '请输入文章标题',
      initial: meta.title,
    })

    if (customTitle === undefined) {
      console.log('❌ 已取消')
      process.exit(0)
    }
    if (customTitle) {
      meta.title = customTitle
    }
  }

  // 获取下一个周刊编号
  const nextNumber = await getNextWeeklyNumber()
  const { customNumber } = await prompts({
    type: 'number',
    name: 'customNumber',
    message: '请输入周刊编号',
    initial: nextNumber,
    min: 1,
  })

  if (customNumber === undefined) {
    console.log('❌ 已取消')
    process.exit(0)
  }

  const weeklyNumber = customNumber || nextNumber
  const newFilename = `weekly-${padWeeklyNumber(weeklyNumber)}.md`
  const destPath = join(POSTS_DIR, newFilename)

  // 检查文件是否已存在
  if (existsSync(destPath)) {
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `文件 ${newFilename} 已存在，是否覆盖？`,
      initial: false,
    })

    if (overwrite === undefined || !overwrite) {
      console.log('❌ 已取消')
      process.exit(0)
    }
  }

  // 生成新的 frontmatter
  const newFrontmatter = generateFrontmatter(meta)
  const newContent = `${newFrontmatter + content.trim()}\n`

  // 写入文件
  await fs.writeFile(destPath, newContent, 'utf-8')

  console.log('\n✅ 文章已复制到:', destPath)
  console.log('🎉 完成！')
}

main().catch((error) => {
  console.error('❌ 发生错误:', error)
  process.exit(1)
})
