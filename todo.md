# TODO

## 漏洞扫描遗留（2026-11-03 全舰队扫描，源 scratch/vuln-scan-*.md）

- [x] VULN-HELLOCON-001 [高危·GHSA-587h-7wmj-h5pm 路径穿越] vite ≤6.4.3→≥6.4.4（package-lock.json 仓，终扫 1，vite≤6.4.3 受影响）【已修复】vite override ^6.4.3→^6.4.4，lockfile 解析 vite 6.4.5；npm audit 0 漏洞；docs:audit 全部通过；docs:build 构建完成 20.24s（vitepress v1.6.4）；【守卫】scripts/audit-security.mjs 固化 vite≥6.4.4，npm test 与 CI 均调用（scripts/audit-security.mjs:1-32）

- [x] 审核发现：root overrides 强制 vite ^6.4.4（解析 6.4.5）注入 vitepress@1.6.4，而 vitepress 自身声明依赖 vite ^5.4.14，属跨大版本（v5→v6）越界覆盖，兼容性仅经手工 docs:build 单次验证、无自动化测试保障（package.json:15，package-lock.json:2625）【已修复】新增 scripts/audit-security.mjs（npm test），CI 加 Test 步骤；npm test 绿（audit-security: vite 6.4.5 ≥ 6.4.4）；docs:build 45.87s 通过；docs:audit 通过（audit-links 6210 条/89 页，audit-structure 45/45）【证据】scripts/audit-security.mjs:1-32，.github/workflows/deploy-pages.yml:37-39
- [x] 审核发现：本仓无 test 脚本（scripts 仅 docs:dev/build/audit/preview），对 vite 是否回退至 ≤6.4.3 无任何自动化守卫，未来移除 override 或 lockfile 重新解析可能静默复现该高危漏洞（package.json:5-10）【已修复】package.json 新增 "test" 脚本，scripts 现含 test；守卫在 vite<6.4.4 时以退出码 1 失败（模拟 6.4.3 实测 NEG_EXIT=1）；npm audit 0 漏洞【证据】package.json:9，scripts/audit-security.mjs:24-30

## 源码分层分析 2026-11-07

### a) 抽象层清单

- Content: 双语 Markdown 正文语料，按主题分目录（docs/、docs/zh/）——`docs/index.md:1`
- Navigation: VitePress sidebar/nav 单一真源，SUMMARY.md 为派生兼容映射——`docs/.vitepress/config.mts:7-8`
- Build: VitePress 构建管道，产出静态 HTML 至 docs/.vitepress/dist——`package.json:7`
- Validation: 链接/结构/依赖安全三个审计脚本——`scripts/audit-links.mjs:1`
- Theme: VitePress 主题样式与排印——`docs/.vitepress/theme/style.css:1`
- Delivery: GitHub Actions 部署到 GitHub Pages——`.github/workflows/deploy-pages.yml:1`

### b) 超大文件候选（>1000 行）

无 >1000 行文件

### c) 目录/分类不合理处

- 审计脚本位于仓库根 `scripts/` 而非 `docs/` 下，与 docs 内容分离但依赖根级 package.json 的 npm 约定（`package.json:8`，`scripts/audit-structure.mjs:10`）。属仓库根约定，非分类错误；不列为问题。
- 未见分类问题。
