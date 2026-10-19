# hello-concurrency 目录与内容组织核查

核查日期：2026-10-19。范围：仓库当前跟踪的 Markdown、`docs/.vitepress/config.mts`、`docs/SUMMARY.md`、根目录文件及仓库已有审计脚本。仅新增本报告，不调整现有内容或导航。

## 量化事实

### docs 下一级目录 Markdown 数量与行数

行数按文件文本换行切分统计；包括 `docs/SUMMARY.md`，不包括 `.vitepress` 中生成物。

| docs 下一级目录 | .md 数量 | 总行数 | 说明 |
|---|---:|---:|---|
| 根目录 | 5 | 672 | 含 `SUMMARY.md`、首页、知识总纲、术语表、引言 |
| advanced | 9 | 1,547 | 进阶主题 |
| basics | 4 | 408 | 基础篇 |
| models | 7 | 1,333 | 并发模型 |
| practice | 9 | 1,658 | 实战内容与路线 |
| research | 5 | 379 | 调研底稿 |
| sync | 4 | 911 | 同步原语 |
| **合计** | **43** | **6,908** | 含 SUMMARY；可构建内容页 42 篇 |

统计复核命令：遍历 `docs/*.md` 和 `docs/*/*.md` 后逐文件计算行数。`docs/SUMMARY.md:3` 对页面数的描述是“正文 36 个页面与调研底稿 5 页”；现有实际正文主题目录为 33 页，另有引言、知识总纲、术语表、首页，调研 5 页，合计 42 个可构建页面，故该描述口径需要更新或解释首页等页面是否计入（中，事实口径过时；此处不改原文件）。

### 组织轴盘点

按内容入口与导航用途归纳为 **6 套轴**；其中目录主题轴是主体，指南/索引/调研/术语/遗留映射属于辅助轴。没有独立 API 目录或 history 目录。

| 组织轴 | 条目数 | 命名规律 | 有无编号 | 编号连续性 |
|---|---:|---|---|---|
| 主题目录：`basics/`、`sync/`、`models/`、`advanced/`、`practice/` | 33 篇（4/4/7/9/9） | 小写英文 slug、短横线分词；目录承担分类 | 否（文件名无数字前缀） | 不适用 |
| 根级引言章节：`chapter_1.md` | 1 | `chapter_数字`，下划线 | 是 | 只有 1，无可判定的断档；未发现跳号/重复 |
| 汇总/学习指南：`knowledge.md`、`practice/seven-weeks.md` | 2 个代表性入口 | 一个通用总纲，一个英文数字短横线路线名 | 文件名前者无、后者无 | `knowledge.md` 内条目 1–93 连续，见 `scripts/audit-structure.mjs` 检查结果 |
| 调研底稿：`research/` | 5 | 目录统一；文件为 `README.md` 或主题英文 slug | 否 | 不适用 |
| 术语参考：`glossary.md` | 1 | 根级单文件 | 否 | 不适用 |
| 兼容映射：`SUMMARY.md` | 1 | mdBook 遗留名称；保留链接映射 | 否 | 不适用；配置明确排除构建，见 `docs/.vitepress/config.mts:17-18` |

### 编号核查

- 文件名中符合数字前缀/章节号模式的正文只有 `docs/chapter_1.md`（命名实际为 `chapter_1`，不是 `1-...` 前缀）；排序后为 `[1]`，**没有断档、跳号或重复**。
- 章节正文小节编号见 `docs/chapter_1.md:5,15`，为 1.1–1.3。
- 可机器检查的连续序列是 `docs/knowledge.md` 的 93 条编号。`npm run docs:audit` 报告“knowledge 编号 93 条”，全部通过。
- 各文章内部反复从 1 编号是局部列表（例如 `docs/practice/producer-consumer.md:23,152,182`），不是章节编号冲突，不应按全站序列合并。

## 问题清单与证据

严重度定义：高=会造成内容不可达/链接失效；中=显著增加读者或维护者辨认成本；低=纯一致性、可延后。

1. **中：内容入口存在“主题分类 + 根级杂项”的双重心智模型。** 根级同时放引言、首页、知识总纲、术语表和 `SUMMARY.md`，主题正文在五个分类目录。侧栏又将总纲和术语表作为独立入口，而首页不在侧栏条目中。证据：`docs/` 根级 5 个 Markdown（上表）；`docs/.vitepress/config.mts:27-34,99-111`。影响是新内容该进根目录还是主题目录不够直观；现状仍可理解，不属于阻断问题。
2. **中：research 底稿可达方式与主题正文不同。** 侧栏只挂 `research/README`，其余 4 页仅靠底稿内链/页面互链可达，且 README 在其目录中再次出现。证据：`docs/.vitepress/config.mts:108-111`；文件为 `docs/research/books.md`、`memory-model-specs.md`、`applications.md`、`coverage-audit.md`；映射清单见 `docs/SUMMARY.md:46-51`。这对内部资料是合理的收纳方式，但页面发现性弱于主章节。
3. **中：同类概念有刻意交叉覆盖，边界需靠互链解释。** 有界队列/背压横跨 `docs/practice/producer-consumer.md:137-149`、`docs/practice/thread-pool.md:40-46`、`docs/practice/reactor.md:62-66`；资源耗尽与故障/安全分别见 `docs/practice/reliability.md:5-17,73-84`、`docs/advanced/security.md:31-43,87-96`；STM 的书籍章节追溯和模型正文汇合在 `docs/models/stm.md:83-121` 与 `docs/research/books.md:42-62`。现有交叉链接和关系章节缓解了重复，证据不足以直接删并章节；重构前应定清“概念主讲页 vs 场景引用”。
4. **低：命名样式有历史/用途差异。** `chapter_1.md` 用下划线和英文前缀（`docs/chapter_1.md`）；`seven-weeks.md`、`data-parallel.md` 用短横线；`README.md` 大写且在根和 `research/` 各有一份；主题 slug 小写。证据：`docs/` 根目录文件名及 `docs/research/README.md`。这是少量例外，不影响构建或链接，不建议仅为统一而批量改名。
5. **低：README 与 docs 首页用途需保持区分。** 根目录同时有 `README.md`（英文）和 `README.zh.md`（中文），两者通过互链提供双语仓库介绍（`README.md:3`、`README.zh.md:3`）；另有 `docs/index.md` 作为站点首页。它们不是重复文件，但中文读者若把 README 和站点首页理解成重复入口，容易产生歧义。证据：`README.md:16`、`README.zh.md:16`、`docs/index.md`。属于定位提示问题，不是删除依据。
6. **低：SUMMARY 的描述统计与当前页面数口径不一致。** 见上方统计和 `docs/SUMMARY.md:3`。该文件被配置明确作为 mdBook 遗留映射底稿而非站点导航（`docs/.vitepress/config.mts:17-18`），保留本身合理，但过期数字可能误导维护者。

### 侧边栏对账

解析 `docs/.vitepress/config.mts:34-113` 中实际 sidebar（不把顶部 nav 重复算作侧栏）：

| 对账方向 | 数量 | 条目 |
|---|---:|---|
| 配置了但目标文件不存在 | 0 | 无 |
| 文件存在但未进入侧边栏 | 5（不足 10） | `docs/index.md`（首页由 `/` 路由承载）；`docs/research/applications.md`；`docs/research/books.md`；`docs/research/coverage-audit.md`；`docs/research/memory-model-specs.md` |

核对方式：将 sidebar 路由与 `docs/*.md`、`docs/*/*.md`（排除 SUMMARY 映射底稿）对应。未进侧边栏不等于死页：仓库结构脚本确认 43/43 页可达（含排除构建的 SUMMARY 底稿口径），SUMMARY 双向核对也通过；具体四篇调研页由 `research/README.md` 链入。

### 死链与构建

- `npm run docs:audit`：通过。输出：`audit-links: 检查 2818 条站内链接，43 个页面；全部通过`；`audit-structure: 侧栏/导航 39 条，可达页面 43/43，SUMMARY 对账 41 条，knowledge 编号 93 条，来源节 32 页；全部通过`。
- 链接脚本 `scripts/audit-links.mjs` 扫描 `docs/.vitepress/dist` 构建产物。当前 `npm run docs:build` 未能运行：shell 报 `vitepress: not found`（`package.json:6-7`），本地依赖未安装。因此链接通过结果是针对仓库现存的 dist 产物，不能证明它与当前源码完全同版；**当前源码重建后的死链未核实**。报告不把它表述为源码构建验证。

### 根目录杂散文件

- 仓库根有 `README.md`、`README.zh.md`，是明确配对的英/中文项目说明，并非重复 README，应保留（合理）。`docs/index.md` 是文档站首页，功能不同，也不属重复。
- 仓库根未发现其他 Markdown、临时文件或未跟踪杂散文件；根级 `.gitignore`、`LICENSE`、`package.json`、锁文件、脚本和 `.github/` 属正常工程文件。工作区核查时干净。

## 判断与推荐

当前可归纳 **6 套组织轴**；不建议把它们强行压成单一目录树。建议长期维持 **3 个面向读者的入口轴**：①按主题/学习顺序组织正文（现有五个主题目录加引言）；②指南与速查（知识总纲、七周路线、术语表）；③研究依据（research 底稿）。另把 SUMMARY 明确维持为非面向读者的兼容映射；命名约定是横切规则，不另算内容轴。推荐以现有主题目录 + VitePress sidebar 为主轴，因为 33 篇主体已按基础、同步、模型、进阶、实战分类，导航目标全存在，站内链接审计和结构审计均通过；当前证据支持收口与澄清入口，不支持大规模搬迁。

**其实不乱、不用动：** 五个主题目录内部分类一致，数量分布合理；所有 sidebar 指向文件存在；knowledge 的 93 个编号连续；正文/调研在 SUMMARY 中有映射；根 README 双语配对而非重复；交叉主题有互链，未证明是必须合并的重复章节；`SUMMARY.md` 被注释和配置标明为兼容底稿，不应误当第二套线上导航。

## 三期收口方案

| 阶段 | 动作清单 | 影响范围 | 风险（链接/搜索/外链） | 用户拍板 |
|---|---|---|---|---|
| 一期：机械整理（≤1 小时，不断链接） | 更新 SUMMARY 的页面数口径；增加一份简短组织约定（主题正文、指南/索引、调研底稿、兼容映射分别放哪）；给未进 sidebar 的调研页加“调研底稿”入口说明或确保 README 索引完整；约定新文件 slug 小写短横线，历史文件不改名。 | `docs/SUMMARY.md`、可选新增贡献说明、`docs/research/README.md`；不移动页面。 | 低；不改路由、不改链接、不影响搜索或外链。 | 是否采用 3 个读者入口轴和 slug 约定需拍板；更新过时统计可直接执行。 |
| 二期：侧边栏与重定向 | 决定四篇 research 子页是否直接进入 sidebar；若要迁移 `chapter_1.md` 或重命名 slug，保留旧 URL 的重定向/别名并更新站内链接、SUMMARY、入口链接。 | `docs/.vitepress/config.mts`、目标 Markdown、SUMMARY 与所有引用。 | 中；sidebar 扩展会增加导航长度；路径迁移若遗漏会损坏历史外链、搜索索引与收藏。仅加 sidebar 不破坏 URL。 | **必须拍板** research 底稿是否面向普通读者；任何路径重命名/迁移及旧 URL 保留期限必须拍板。 |
| 三期：章节删并深度重构 | 以“唯一主讲页 + 其他页场景引用”为原则，先比较 producer-consumer/thread-pool/reactor 的背压内容，以及 reliability/security 的资源耗尽内容；根据逐段差异决定合并、删重或保留交叉讲解，再同步来源与知识总纲。 | 多篇主题页、knowledge、SUMMARY、sidebar、来源/参考链接。 | 中至高；删节可能改变锚点和搜索命中，合并可能破坏旧章节 URL、外链锚点及读者已有引用；需要逐段审阅和链接映射。 | **必须拍板** 哪页成为概念权威页、哪些重复段落删除，以及章节职责边界；不得仅据目录审计自动删并。 |

### 最该先做的三件事

1. 修正 `docs/SUMMARY.md:3` 的页面数量描述，并写清正文页面的计数口径。
2. 定下三种读者入口（正文、指南/速查、研究依据）与 SUMMARY 的兼容底稿角色，形成简短放置规则。
3. 由维护者决定四篇 research 子页要继续只经 README 进入，还是加入 sidebar；在此决定前不迁移或重命名任何 URL。


## 收口执行记录（2026-10-19）

定位口径：这是个人学习笔记、心得与工程经验分享，以游戏开发者视角记录，不是教程或课程。保留各主题页面，不按学习顺序重排。

### A：导航真源

- VitePress sidebar（`docs/.vitepress/config.mts`）是站点导航唯一真源；`docs/SUMMARY.md` 保留兼容映射，并明确其派生关系与更新顺序。手工改 SUMMARY 不改变站点导航；改 sidebar 后同步 SUMMARY。
- 实查 sidebar 内部路由无重复（重复数 0）；顶部 nav 的首页/正文链接不计入侧栏，跨组路由复用也不视为重复。调研底稿仍由侧栏总览和 `research/README.md` 索引承载。
- 页面计数校正：43 个可构建 Markdown 页面（首页、引言、33 个主题页、知识总纲、术语表、5 篇 research、结构审计报告），另有 SUMMARY 映射底稿 1 份。

### B：跨轴重复逐组判断

本次核查 **真重复合并 0 组；不同角度保留 3 组**。没有删除页面或正文段落；保留组补充/明确了互链与各自职责。

| 页面组 | 分类与文本对比证据 | 收口动作 |
|---|---|---|
| 生产者-消费者 / 线程池 / Reactor | 不同角度。`producer-consumer.md:137-148` 按通用缓冲区讨论阻塞、丢弃、降级和 Reactive Streams；`thread-pool.md:17-19,45-58` 写线程池队列、扩张与 Java 拒绝策略；`reactor.md:62-64` 写事件循环写缓冲水位线。策略、实现与事件驱动机制不是同一事实复述。 | 保留三页，在生产者页/线程池页互链并标清通用策略与具体实现；Reactor 原有水位线链接保留。 |
| 可靠性 / 并发安全 | 不同角度。`reliability.md:5-17,39-64` 讲崩溃、网络分区、租约、fencing、恢复和一致性；`security.md:31-43,55-76` 讲攻击者如何利用资源耗尽、TOCTOU 与侧信道。`security.md:94-95` 原已有相关页链接。 | 保留，互链说明安全页的攻击者视角与可靠性页的故障恢复视角。 |
| STM / 权威书籍调研 | 不同角度。`stm.md:85-121` 解释 Clojure 标识/值、四类引用与工程选择；`research/books.md:42-62` 核对版本、目录和本仓覆盖。前者是模型心得，后者是书目事实底稿。 | 保留；STM 页明确引到书目核对，书目表既有反向链接保留。 |

### C：口径与死条目

- 根 README 双语版不再使用“编写一本书/帮助读者掌握”的课程规划文案，改为个人笔记与游戏开发者分享口径，并列出现有真实主题目录；不再出现虚构篇数或不存在的目录。
- sidebar 注释改为唯一真源规则；当前配置项目标均存在，死条目 0。知识总纲、术语表均已在 sidebar；首页由顶栏“首页”路由承载。


## 本章来源

- 本报告依据仓库当前 Markdown 文件、`docs/.vitepress/config.mts`、`docs/SUMMARY.md` 与正文段落逐项核对；执行记录的链接和页面计数由 `pnpm docs:build`、`pnpm docs:audit` 复核。
