#!/usr/bin/env node
// 结构审计：扫 docs/ 源文件与 .vitepress/config.mts，把人工复核的口径固化成脚本。
// 四类检查：①侧栏/导航链接必须落到真实文件 ②正文页必须可达（侧栏或页内链入链）
// ③SUMMARY 底稿与文件集双向对账 ④knowledge 编号连续、正文页来源节策略。
// 与 audit-links.mjs 互补：那个查构建产物的路径与锚点，这个查源文件的结构。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname, normalize } from 'node:path'

const DOCS = 'docs'
const CONFIG = join(DOCS, '.vitepress/config.mts')
const problems = []

// ---- 收集 docs 下全部 markdown（排除 SUMMARY 底稿与构建目录） ----
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '.vitepress' || name === 'node_modules') continue
      walk(p, out)
    } else if (name.endsWith('.md')) out.push(p)
  }
  return out
}

const pages = walk(DOCS)
const toRoute = (p) => relative(DOCS, p).replace(/\.md$/, '')
const pageSet = new Set(pages.map(toRoute))
const SUMMARY = 'SUMMARY'

// ---- ① 侧栏与导航链接 → 文件 ----
const config = readFileSync(CONFIG, 'utf8')
const configLinks = [...config.matchAll(/link:\s*'([^']+)'/g)].map((m) => m[1])
const sidebarRoutes = new Set()
let configChecked = 0
for (const link of configLinks) {
  if (/^https?:/.test(link)) continue
  configChecked++
  const route = link.replace(/^\/+|\/+$/g, '')
  const target = route === '' ? 'index' : route
  if (!pageSet.has(target)) problems.push(`config.mts → ${link} 目标页不存在`)
  else sidebarRoutes.add(target)
}

// ---- ② 可达性：每页要么在侧栏，要么有页内 markdown 入链 ----
const inbound = new Map([...pageSet].map((r) => [r, 0]))
for (const file of pages) {
  if (toRoute(file) === SUMMARY) continue // SUMMARY 是不参与构建的底稿，不算入链来源
  const text = readFileSync(file, 'utf8')
  const dir = dirname(file)
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    let href = m[1]
    if (/^(https?:|mailto:|#)/.test(href)) continue
    href = href.split('#')[0]
    if (!href) continue
    // 相对路径按文件目录算，站内绝对路径（/foo/bar）按 docs 根算
    const target = href.startsWith('/')
      ? href.replace(/^\/+/, '')
      : relative(DOCS, normalize(join(dir, href))).replace(/\\/g, '/')
    const route = target.replace(/\.md$/, '')
    if (pageSet.has(route)) inbound.set(route, inbound.get(route) + 1)
  }
}
let reachable = 0
for (const route of pageSet) {
  const linked = inbound.get(route) > 0 || sidebarRoutes.has(route) || route === SUMMARY
  if (linked) reachable++
  else problems.push(`${route}.md 无入链：既不在侧栏，也没有任何页内链接指向它`)
}

// ---- ③ SUMMARY 底稿 ↔ 文件集 ----
const summary = readFileSync(join(DOCS, SUMMARY + '.md'), 'utf8')
const summaryRoutes = [...summary.matchAll(/\]\((\.\/[^)]+\.md)\)/g)].map((m) =>
  normalize(m[1]).replace(/^\.\//, '').replace(/\.md$/, '')
)
let summaryChecked = 0
for (const route of summaryRoutes) {
  summaryChecked++
  if (!pageSet.has(route)) problems.push(`SUMMARY.md → ${route}.md 目标页不存在`)
}
for (const route of pageSet) {
  if (route === 'index' || route === SUMMARY) continue // 首页不入底稿，底稿不自列
  if (!summaryRoutes.includes(route)) problems.push(`${route}.md 未列入 SUMMARY.md 底稿`)
}

// ---- ④ knowledge 编号连续 ----
const knowledge = readFileSync(join(DOCS, 'knowledge.md'), 'utf8')
const numbers = [...knowledge.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]))
let numberChecked = numbers.length
for (let i = 0; i < numbers.length; i++) {
  if (numbers[i] !== i + 1) {
    problems.push(`knowledge.md 条目编号断号：期望 ${i + 1}，实际 ${numbers[i]}`)
    break
  }
}

// ---- ⑤ 来源节策略：正文页须有「本章来源」，无专项调研支撑的按白名单豁免 ----
const SOURCE_SECTION = '## 本章来源'
const noSource = [
  'index', // 首页
  'knowledge', // 总纲：出处在底稿
  'chapter_1', // 引言
  SUMMARY,
  'basics/critical-section', // 无专项调研支撑（R5 口径：宁缺毋假）
  'basics/thread-process',
]
let sourceChecked = 0
for (const route of pageSet) {
  if (route.startsWith('research/')) continue // 底稿自身即出处记录
  if (noSource.includes(route)) continue
  sourceChecked++
  const text = readFileSync(join(DOCS, route + '.md'), 'utf8')
  if (!text.includes(SOURCE_SECTION)) problems.push(`${route}.md 缺少「本章来源」一节`)
}

console.log(
  `audit-structure: 侧栏/导航 ${configChecked} 条，可达页面 ${reachable}/${pageSet.size}，` +
    `SUMMARY 对账 ${summaryChecked} 条，knowledge 编号 ${numberChecked} 条，来源节 ${sourceChecked} 页`
)
if (problems.length) {
  console.error(`发现 ${problems.length} 处问题：`)
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log('全部通过')
