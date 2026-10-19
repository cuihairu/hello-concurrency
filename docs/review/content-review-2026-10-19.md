# 结构改动内容复核（2026-10-19）

## 复核范围

先执行 `git fetch origin && git pull --rebase origin main`，结果为 `Already up to date`，工作区原先干净。按真实历史复核最近 4 个提交（不是假定的 A/B/C 三个提交）：

- `dddd873 Align repository notes with project scope`（C：README 定位及审计记录）
- `fdc4bf5 Clarify cross-topic note boundaries`（B：跨主题边界）
- `916a4e1 Clarify sidebar navigation source`（A：导航真源）
- `e41b3ad docs: audit repository structure`（结构审计基线）

差异范围 `HEAD~4..HEAD`：10 个文件，148 insertions / 266 deletions。主要删除集中在双语 README 原有的拟议书籍目录与章节简介；B 提交本身仅有 2 处改写和互链补充，没有删除整段正文。

## 四项核查

### 1. 内容丢失：未发现已发布正文内容被误删

- B 的 `docs/practice/producer-consumer.md:148`：改前原有“事件驱动结构里的背压靠写缓冲水位线……见 Reactor；流式编程模型……见 async”的完整句子；改后保留该句，只在前面增加线程池实现的链接。目标分别是 `docs/practice/reactor.md`（事件循环水位线）和 `docs/practice/async.md`（Reactive Streams / `request(n)`），语义一致。
- B 的 `docs/models/stm.md:85`：改前说明《七周七并发模型》第 4 章重点是 Clojure 标识/值分离、STM ref 是四类引用之一；改后原句完整保留，并补充指向 `docs/research/books.md` 的版本、目录和覆盖核对。没有丢失模型说明。
- C 删除的 README 大段内容（`README.md`、`README.zh.md` 改前约第 22–155 行，改后第 22–26 行）：删除的是“编写一本书/本书旨在……”的未来规划目录及对应章节简介，不是已写好的正文；README 改后明确仓库是持续整理的个人笔记、不是教程或课程。主题正文仍在 `docs/basics/`、`sync/`、`models/`、`advanced/`、`practice/`；调研资料仍在 `docs/research/`。逐项搜索后，旧目录中的未来主题清单并非各自已有页面内容的唯一副本，因此未发现应补回的已发布知识段落。**未补回**：旧文案作为“书籍规划”被定位改动有意移除，恢复它会与新定位冲突。
- `docs/SUMMARY.md:5-53` 仍逐页列出引言、33 篇主题页、知识总纲、术语表、5 篇调研页和结构审计报告；没有发现大幅精简删掉内容性条目的情况。

### 2. 表述改错与计数：发现 1 处计数错误，已修

- README 新定位见 `README.md:22-26`、`README.zh.md:22-26`；“笔记与工程经验、游戏开发者视角、非教程/课程”与仓库实际内容相符。逐句核对新增的主题分类描述，五个目录均存在且对应分类；没有把“不支持”写成“支持”之类技术含义反转。
- 本次重新计数：docs 下 Markdown 共 45 个（含 SUMMARY）；排除 `SUMMARY.md` 后 44 个可构建页面，其中 33 个主题页、首页/引言/总纲/术语表 4 页、调研页 5 篇、两份审计报告。`docs/SUMMARY.md:3` 写 44 篇，正确。
- **问题（低，报告内部量化事实不一致）**：被复核的 `docs/review/structure-audit-2026-10-19.md` 改前第 13–20 行仍按未加入审计报告时的目录统计，报 43 个 Markdown、6,908 行、42 个可构建页面；该报告本身又在后文第 105 行计入结构审计报告，造成前后矛盾。已更新统计表纳入审计报告文件；当前统计为 45 个 Markdown、7,099 行、44 个构建页面。更正已包含在本次复核提交中。

### 3. 链接与导航：未发现目标缺失或主题错配

- A 改动后的侧栏新增项 `docs/.vitepress/config.mts:110` 指向 `/review/structure-audit-2026-10-19`，文件 `docs/review/structure-audit-2026-10-19.md` 存在且主题相符。侧栏各主题页逐项对照实际文件路径；SUMMARY 中审计报告条目 `docs/SUMMARY.md:53-54` 也指向同一文件。
- C 在 README 加入的目录链接 `README.md:24`、`README.zh.md:24` 分别落在实际存在的 `docs/basics/`、`docs/sync/`、`docs/models/`、`docs/advanced/`、`docs/practice/`；总纲、术语表、调研入口分别指向 `docs/knowledge.md`、`docs/glossary.md`、`docs/research/README.md`，主题匹配。
- 手工抽查新增互链：`docs/practice/thread-pool.md:5` → 生产者-消费者与 Reactor 页面；`docs/practice/producer-consumer.md:148` → 线程池、Reactor、异步页面；`docs/practice/reliability.md:75` ↔ `docs/advanced/security.md:89` 讨论角度分别为故障恢复和攻击面；`docs/models/stm.md:85` → 书目调研。目标均存在，主题相符。
- 执行 `pnpm docs:build` 成功；随后 `pnpm docs:audit` 通过：站内链接 3,017 条；链接脚本扫描 45 个 HTML（含 404 页），结构脚本确认 45/45 个 Markdown 路由可达（含不参与构建的 SUMMARY 映射底稿），43 条 SUMMARY 映射对账通过。`docs/.vitepress/config.mts:17-18` 明确排除 SUMMARY 构建。

### 4. 未核实项

- 未核实线上部署后的 GitHub Pages 实际呈现与外部搜索索引；本次验证覆盖当前源码构建产物、仓库相对链接与导航配置，不访问已发布站点。
- README 中“知识点总纲”等外部在线链接的部署可用性未在浏览器逐个访问；其站内对应文件存在，本地构建和内部链接审计通过。
- 对 README 中拟议书籍目录是否曾作为独立承诺对外传播，仓库历史和本次文件内容不足以判定；本次仅确认仓库当前没有按该目录编写的完整书籍正文。此点属于定位取舍，未据此要求恢复旧文案。

## 问题清单

| 严重度 | 问题 | 处理 | 修复提交 |
|---|---|---|---|
| 低 | 结构审计报告统计表漏计报告自身，页面数和行数与报告后文冲突 | 已修正统计、说明和过期审计数字 | 本报告提交（待提交） |

未发现高/中严重度的内容丢失、技术表述反转或导航错链；没有需要用户拍板的删并取舍。

## 结论

就本次复核的提交范围而言，未发现 README 定位调整或 B/A 导航改动损坏已发布正文、反转技术含义或把链接指向错误主题。唯一确认的问题是审计报告自身的统计口径矛盾，已在报告修正后可视为已验收；线上部署呈现未核实。

## 本章来源

- 本次复核依据：`git diff HEAD~4..HEAD`、仓库 Markdown 与 VitePress 配置、`scripts/audit-links.mjs`、`scripts/audit-structure.mjs`。验证命令：`pnpm docs:build`、`pnpm docs:audit`。
