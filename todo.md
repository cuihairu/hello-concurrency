# TODO

## 漏洞扫描遗留（2026-11-03 全舰队扫描，源 scratch/vuln-scan-*.md）

- [ ] VULN-HELLOCON-001 [高危·GHSA-587h-7wmj-h5pm 路径穿越] vite ≤6.4.3→≥6.4.4（package-lock.json 仓，终扫 1，vite≤6.4.3 受影响）【BLOCKED·规范禁 npm 改 lock】npm-lock 仓只审计未改动；验收：迁 pnpm（pnpm import）后 pnpm audit --audit-level=high 该包不再命中（或编排者批准 npm 侧修复后 npm audit 清零）；该仓无 test 脚本，audit-only
