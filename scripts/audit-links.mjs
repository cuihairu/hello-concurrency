#!/usr/bin/env node
// 站内链接与锚点审计：扫 dist 产物，验证页面路径存在、#锚点在目标页有对应 id。
// VitePress 构建只查页面路径不查锚点（曾漏过 stm.md 的 Clojure 锚点 slug 错写），这里补上。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const DIST = 'docs/.vitepress/dist'
const BASE = '/hello-concurrency/'

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.html')) out.push(p)
  }
  return out
}

function fileForRoute(route) {
  const clean = route.replace(/^\/+|\/+$/g, '')
  return clean === '' ? join(DIST, 'index.html') : join(DIST, clean + '.html')
}

const pages = walk(DIST)
const problems = []
let checked = 0

for (const page of pages) {
  const html = readFileSync(page, 'utf8')
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
  for (const href of hrefs) {
    if (/^(https?:|mailto:|javascript:|data:)/.test(href)) continue
    if (href.startsWith('#')) {
      // 同页锚点
      checked++
      const frag = decodeURIComponent(href.slice(1))
      if (frag && !html.includes(`id="${frag}"`)) {
        problems.push(`${relative(DIST, page)} → 同页锚点 #${frag} 无对应 id`)
      }
      continue
    }
    if (!href.startsWith(BASE)) continue // 站外或资源路径，跳过
    const [route, frag] = href.slice(BASE.length).split('#')
    if (/\.(svg|png|jpe?g|ico|xml|txt|json|js|css|woff2?)$/i.test(route)) continue
    checked++
    const target = fileForRoute(route)
    let targetHtml
    try {
      targetHtml = readFileSync(target, 'utf8')
    } catch {
      problems.push(`${relative(DIST, page)} → ${href} 目标页不存在`)
      continue
    }
    if (frag) {
      const decoded = decodeURIComponent(frag)
      if (!targetHtml.includes(`id="${decoded}"`)) {
        problems.push(`${relative(DIST, page)} → ${href} 目标页无 id="${decoded}"`)
      }
    }
  }
}

console.log(`audit-links: 检查 ${checked} 条站内链接，${pages.length} 个页面`)
if (problems.length) {
  console.error(`发现 ${problems.length} 处问题：`)
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log('全部通过')
