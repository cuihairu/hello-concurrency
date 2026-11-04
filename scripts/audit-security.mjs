#!/usr/bin/env node
// 依赖安全审计：固化 GHSA-587h 的修复门槛。
// VitePress 声明 vite ^5.4.14，本仓用 root overrides 强制 vite ^6.4.4（跨大版本注入）。
// 该 override 是 GHSA-587h（vite < 6.4.4 受影响，Windows 下 launch-editor 命令注入）的修复保障；
// 若未来移除 override 或 lockfile 重新解析使 vite 回退到 <6.4.4，此脚本必须在 CI 中失败，
// 防止高危漏洞静默复现。
import { readFileSync } from 'node:fs'

const LOCK = 'package-lock.json'
const FIXED = '6.4.4'

const lock = JSON.parse(readFileSync(LOCK, 'utf8'))
const vite = lock.packages?.['node_modules/vite']
if (!vite) {
  console.error('audit-security: package-lock.json 未找到 node_modules/vite')
  process.exit(1)
}

const version = vite.version
const [a, b, c] = version.split('.').map(Number)
const [fa, fb, fc] = FIXED.split('.').map(Number)
const safe = a > fa || (a === fa && (b > fb || (b === fb && c >= fc)))

if (!safe) {
  console.error(
    `audit-security: vite ${version} < ${FIXED}，GHSA-587h（launch-editor 命令注入）将复现；` +
      `请保留 overrides.vite >= ${FIXED}`
  )
  process.exit(1)
}

console.log(`audit-security: vite ${version} >= ${FIXED}（GHSA-587h 修复门槛），override 生效`)
