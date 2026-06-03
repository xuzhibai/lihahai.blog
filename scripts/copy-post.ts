import { existsSync, statSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import { basename, join, resolve } from 'pathe'
import { pinyin } from 'pinyin-pro'
import prompts from 'prompts'

const POSTS_DIR = fileURLToPath(new URL('../pages/posts', import.meta.url))

// ===== OSS 图片上传配置 =====
const ENABLE_OSS_UPLOAD = false
const PICLIST_PICBED = process.env.PICLIST_PICBED || '' // 图床类型，如 'aws-s3', 'qiniu', 'upyun'
const PICLIST_CONFIG_NAME = process.env.PICLIST_CONFIG_NAME || '' // Piclist 配置名称
const PICLIST_UPLOAD_URL = process.env.PICLIST_UPLOAD_URL || ''

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

/**
 * 将中文转为拼音文件名，特殊字符用 - 替代
 */
function toPinyinFilename(input: string): string {
  const converted = pinyin(input, { toneType: 'none', separator: '-' })
  return converted
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * 判断文件路径是否在指定目录下
 */
function isUnderDir(filePath: string, dir: string): boolean {
  const resolved = resolve(filePath)
  const dirResolved = resolve(dir)
  return resolved.startsWith(`${dirResolved}/`)
}

/**
 * 通过 Piclist 上传图片到 OSS
 */
async function uploadImages(imagePaths: string[]): Promise<string[]> {
  let url = PICLIST_UPLOAD_URL
  const params = new URLSearchParams()
  if (PICLIST_PICBED)
    params.set('picbed', PICLIST_PICBED)
  if (PICLIST_CONFIG_NAME)
    params.set('configName', PICLIST_CONFIG_NAME)
  if (params.toString())
    url += `?${params.toString()}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list: imagePaths }),
  })

  const data = await response.json() as { success: boolean, result: string[] }

  if (!data.success) {
    throw new Error('Piclist 上传失败')
  }

  return data.result
}

/**
 * 解析 Obsidian 图片链接并上传替换为标准 markdown 格式
 * Obsidian 格式: ![[path/to/image.png]]
 * 转换为: ![](https://oss-url/image.png)
 */
async function processObsidianImages(content: string): Promise<string> {
  if (!ENABLE_OSS_UPLOAD)
    return content

  const obsidianVaultPath = process.env.OBSIDIAN_VAULT_DIR
  if (!obsidianVaultPath) {
    console.warn('⚠️ 已启用 OSS 上传但未设置 OBSIDIAN_VAULT_DIR 环境变量，跳过图片处理')
    return content
  }

  // 匹配 Obsidian 图片链接 ![[...]]
  const obsidianImageRegex = /!\[\[([^\]]+\.(png|jpe?g|gif|webp|svg|bmp))\]\]/gi
  const matches = [...content.matchAll(obsidianImageRegex)]

  if (matches.length === 0) {
    console.log('📷 未发现 Obsidian 图片链接')
    return content
  }

  console.log(`\n📷 发现 ${matches.length} 个 Obsidian 图片链接`)

  // 构建图片路径映射
  const imageMap = new Map<string, string>() // obsidian路径 -> 绝对路径
  for (const match of matches) {
    const imagePath = match[1]
    if (!imageMap.has(imagePath)) {
      imageMap.set(imagePath, join(obsidianVaultPath, imagePath))
    }
  }

  // 检查图片文件是否存在
  const validImages: string[] = []
  const pathToObsidian = new Map<string, string>() // 绝对路径 -> obsidian路径
  for (const [obsidianPath, absPath] of imageMap) {
    if (existsSync(absPath)) {
      validImages.push(absPath)
      pathToObsidian.set(absPath, obsidianPath)
      console.log(`  📎 ${obsidianPath}`)
    }
    else {
      console.warn(`  ⚠️ 图片不存在: ${absPath}`)
    }
  }

  if (validImages.length === 0) {
    console.log('📷 没有可上传的图片')
    return content
  }

  // 上传图片
  console.log(`\n⬆️ 正在上传 ${validImages.length} 张图片到 OSS...`)
  const uploadedUrls = await uploadImages(validImages)

  // 构建替换映射：obsidian路径 -> 上传后的URL
  const replaceMap = new Map<string, string>()
  for (let i = 0; i < validImages.length; i++) {
    const obsidianPath = pathToObsidian.get(validImages[i])!
    const url = uploadedUrls[i]
    replaceMap.set(obsidianPath, url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`)
  }

  // 替换内容中的 Obsidian 图片链接
  let result = content
  for (const [obsidianPath, url] of replaceMap) {
    // 转义特殊字符用于正则
    const escaped = obsidianPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(
      new RegExp(`!\\[\\[${escaped}\\]\\]`, 'gi'),
      `![](${url})`,
    )
  }

  console.log('✅ 图片上传并替换完成')
  return result
}

/**
 * 从目录中选择文件
 */
async function selectFileFromDir(sourceDir: string): Promise<string> {
  console.log('📂 扫描目录:', sourceDir)

  const files = await fg('**/*.md', {
    absolute: true,
    cwd: sourceDir,
    ignore: ['**/node_modules/**'],
  })

  if (files.length === 0) {
    console.error('❌ 未找到 markdown 文件')
    process.exit(1)
  }

  const sortedFiles = files
    .map(file => ({
      file,
      mtime: statSync(file).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime)

  console.log('\n📄 找到的 markdown 文件（按修改时间排序）:')
  sortedFiles.slice(0, 5).forEach((item, index) => {
    const time = new Date(item.mtime).toLocaleString('zh-CN')
    console.log(`  ${index + 1}. ${basename(item.file)} (${time})`)
  })

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

  return selectedFile
}

async function main() {
  const filePathArg = process.argv[2]
  const blogSourceDir = process.env.BLOG_SOURCE_DIR

  let selectedFile: string
  let isWeekly = true

  if (filePathArg) {
    // 指定了文件或目录路径参数
    if (!existsSync(filePathArg)) {
      console.error(`❌ 路径不存在: ${filePathArg}`)
      process.exit(1)
    }

    const fileStat = statSync(filePathArg)

    if (fileStat.isFile()) {
      selectedFile = resolve(filePathArg)
      isWeekly = !!(blogSourceDir && isUnderDir(selectedFile, blogSourceDir))
      console.log(isWeekly ? '📰 周刊文章' : '📄 非周刊文章')
      console.log('\n✅ 已选择:', basename(selectedFile))
    }
    else if (fileStat.isDirectory()) {
      selectedFile = await selectFileFromDir(filePathArg)
      isWeekly = true
    }
    else {
      console.error('❌ 不支持的路径类型')
      process.exit(1)
    }
  }
  else {
    // 未提供参数，使用 BLOG_SOURCE_DIR
    if (!blogSourceDir) {
      console.error('❌ 请提供文件路径参数或设置 BLOG_SOURCE_DIR 环境变量')
      console.log('\n使用方法:')
      console.log('  1. 指定文件路径: pnpm tsx scripts/copy-post.ts <文件路径>')
      console.log('  2. 设置环境变量: export BLOG_SOURCE_DIR=<源目录路径>')
      console.log('  3. 或通过参数指定目录: pnpm tsx scripts/copy-post.ts <目录路径>')
      process.exit(1)
    }

    if (!existsSync(blogSourceDir)) {
      console.error(`❌ 目录不存在: ${blogSourceDir}`)
      process.exit(1)
    }

    selectedFile = await selectFileFromDir(blogSourceDir)
    isWeekly = true
  }

  // 读取文件内容
  let content = await fs.readFile(selectedFile, 'utf-8')

  // 去除初稿部分，只保留终稿
  content = extractFinalDraft(content)

  // 处理 Obsidian 图片链接：上传并替换
  content = await processObsidianImages(content)

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

  // 生成文件名
  let newFilename: string

  if (isWeekly) {
    // 周刊文章：使用编号命名
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
    newFilename = `weekly-${padWeeklyNumber(weeklyNumber)}.md`
  }
  else {
    // 非周刊文章：交互式输入文件名
    const defaultFilename = toPinyinFilename(meta.title || basename(selectedFile, '.md'))

    const { customFilename } = await prompts({
      type: 'text',
      name: 'customFilename',
      message: '请输入文件名称（不含扩展名，中文将自动转为拼音）',
      initial: defaultFilename,
    })

    if (customFilename === undefined) {
      console.log('❌ 已取消')
      process.exit(0)
    }

    newFilename = `${toPinyinFilename(customFilename || defaultFilename)}.md`
  }

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
