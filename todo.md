# TODO

## 漏洞扫描遗留（2026-11-03 全舰队扫描，源 scratch/vuln-scan-*.md）

- [x] VULN-HELLOCON-001 [高危·GHSA-587h-7wmj-h5pm 路径穿越] vite ≤6.4.3→≥6.4.4（package-lock.json 仓，终扫 1，vite≤6.4.3 受影响）【已修复】vite override ^6.4.3→^6.4.4，lockfile 解析 vite 6.4.5；npm audit 0 漏洞；docs:audit 全部通过；docs:build 构建完成 20.24s（vitepress v1.6.4）
