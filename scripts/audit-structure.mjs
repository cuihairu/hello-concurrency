#!/usr/bin/env node
// 结构审计：扫 docs/ 源文件与 .vitepress/config.mts，把人工复核的口径固化成脚本。
// 四类检查：①侧栏/导航链接必须落到真实文件 ②正文页必须可达（侧栏或页内链入链）
// ③SUMMARY 底稿与文件集双向对账 ④knowledge 编号连续、正文页来源节策略。
// 与 audit-links.mjs 互补：那个查构建产物的路径与锚点，这个查源文件的结构。
// 双语站：英文在 docs/ 根，中文在 docs/zh/，两套各自跑同一批检查。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname, normalize } from 'node:path'

const DOCS = 'docs'
const CONFIG = join(DOCS, '.vitepress/config.mts')
const problems = []

// 语言树：英文在 docs 根（前缀空），中文在 docs/zh/。
// 英文树要跳过中文子树，否则会把 zh 页面当成英文页检查。
const LOCALES = [
  { tag: 'en', dir: DOCS, prefix: '', skip: 'zh' },
  { tag: 'zh', dir: join(DOCS, 'zh'), prefix: 'zh/' }
]

const SUMMARY = 'SUMMARY'

// 无专项调研支撑、豁免「本章来源/ Sources」一节的页面（两套语言同口径）
const noSource = [
  'index', // 首页
  'knowledge', // 总纲：出处在底稿
  'chapter_1', // 引言
  SUMMARY,
  'basics/critical-section', // 无专项调研支撑（R5 口径：宁缺毋假）
  'basics/thread-process'
]

function walk(dir, out = [], skip = null) {
  for (const name of readdirSync(dir)) {
    if (name === skip) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '.vitepress' || name === 'node_modules') continue
      walk(p, out, skip)
    } else if (name.endsWith('.md')) out.push(p)
  }
  return out
}

const perLocale = new Map()
for (const loc of LOCALES) {
  const { tag, dir, skip } = loc
  const pages = walk(dir, [], skip)
  const toRoute = (p) => relative(dir, p).replace(/\.md$/, '')
  const pageSet = new Set(pages.map(toRoute))
  perLocale.set(tag, { loc, pages, pageSet, toRoute })
}

// ---- ① 侧栏与导航链接 → 文件 ----
// config 里 /zh/ 前缀的链接归中文树，无前缀归英文树。
const config = readFileSync(CONFIG, 'utf8')
const configLinks = [...config.matchAll(/link:\s*'([^']+)'/g)].map((m) => m[1])
const sidebarRoutes = new Map(LOCALES.map((l) => [l.tag, new Set()]))
let configChecked = 0
for (const link of configLinks) {
  if (/^https?:/.test(link)) continue
  configChecked++
  const stripped = link.replace(/^\/+|\/+$/g, '')
  // /zh/ 或 /zh 是中文语言根，落 zh/index；其余 /zh/xxx 归中文树，无前缀归英文树
  const tag = stripped === 'zh' || stripped.startsWith('zh/') ? 'zh' : 'en'
  const route = (stripped === 'zh' ? '' : stripped.replace(/^zh\//, '')).replace(/^\/+|\/+$/g, '') || 'index'
  const { pageSet } = perLocale.get(tag)
  if (!pageSet.has(route)) problems.push(`config.mts → ${link} 目标页不存在（${tag} 树无 ${route}.md）`)
  else sidebarRoutes.get(tag).add(route)
}

for (const loc of LOCALES) {
  const { tag, dir } = loc
  const { pages, pageSet, toRoute } = perLocale.get(tag)
  // 本语言的来源节标题
  const SOURCE_SECTION = tag === 'zh' ? '## 本章来源' : '## Sources'

  // ---- ② 可达性：每页要么在侧栏，要么有页内 markdown 入链 ----
  const inbound = new Map([...pageSet].map((r) => [r, 0]))
  for (const file of pages) {
    if (toRoute(file) === SUMMARY) continue // SUMMARY 是不参与构建的底稿，不算入链来源
    const text = readFileSync(file, 'utf8')
    const fileDir = dirname(file)
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      let href = m[1]
      if (/^(https?:|mailto:|#)/.test(href)) continue
      href = href.split('#')[0]
      if (!href) continue
      let target
      if (href.startsWith('/')) {
        // 站内绝对链接按前缀判语言树，跨树链接不计入本语言入链
        const otherTree = tag === 'zh' ? !href.startsWith('/zh/') : href.startsWith('/zh/')
        if (otherTree) continue
        target = href.replace(/^\/zh\//, '').replace(/^\/+/, '')
      } else {
        // 相对路径按文件目录算
        target = relative(dir, normalize(join(fileDir, href))).replace(/\\/g, '/')
      }
      const route = target.replace(/\.md$/, '')
      if (pageSet.has(route)) inbound.set(route, inbound.get(route) + 1)
    }
  }
  let reachable = 0
  for (const route of pageSet) {
    const linked = inbound.get(route) > 0 || sidebarRoutes.get(tag).has(route) || route === SUMMARY
    if (linked) reachable++
    else problems.push(`${tag}/${route}.md 无入链：既不在侧栏，也没有任何页内链接指向它`)
  }

  // ---- ③ SUMMARY 底稿 ↔ 文件集 ----
  const summary = readFileSync(join(dir, SUMMARY + '.md'), 'utf8')
  const summaryRoutes = [...summary.matchAll(/\]\((\.\/[^)]+\.md)\)/g)].map((m) =>
    normalize(m[1]).replace(/^\.\//, '').replace(/\.md$/, '')
  )
  let summaryChecked = 0
  for (const route of summaryRoutes) {
    summaryChecked++
    if (!pageSet.has(route)) problems.push(`${tag}/SUMMARY.md → ${route}.md 目标页不存在`)
  }
  for (const route of pageSet) {
    if (route === 'index' || route === SUMMARY) continue // 首页不入底稿，底稿不自列
    if (!summaryRoutes.includes(route)) problems.push(`${tag}/${route}.md 未列入 ${tag}/SUMMARY.md 底稿`)
  }

  // ---- ④ knowledge 编号连续 ----
  const knowledge = readFileSync(join(dir, 'knowledge.md'), 'utf8')
  const numbers = [...knowledge.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]))
  let numberChecked = numbers.length
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] !== i + 1) {
      problems.push(`${tag}/knowledge.md 条目编号断号：期望 ${i + 1}，实际 ${numbers[i]}`)
      break
    }
  }

  // ---- ⑤ 来源节策略：正文页须有来源节，无专项调研支撑的按白名单豁免 ----
  let sourceChecked = 0
  for (const route of pageSet) {
    if (route.startsWith('research/')) continue // 底稿自身即出处记录
    if (noSource.includes(route)) continue
    sourceChecked++
    const text = readFileSync(join(dir, route + '.md'), 'utf8')
    if (!text.includes(SOURCE_SECTION)) problems.push(`${tag}/${route}.md 缺少来源节「${SOURCE_SECTION}」`)
  }

  console.log(
    `audit-structure[${tag}]: 可达页面 ${reachable}/${pageSet.size}，` +
      `SUMMARY 对账 ${summaryChecked} 条，knowledge 编号 ${numberChecked} 条，来源节 ${sourceChecked} 页`
  )
}

console.log(`audit-structure: 侧栏/导航链接共 ${configChecked} 条`)
if (problems.length) {
  console.error(`发现 ${problems.length} 处问题：`)
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log('全部通过')
