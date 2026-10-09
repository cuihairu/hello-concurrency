# 覆盖核对差异表

调研四份文档里引用的站内页面、许诺过的页面修订，逐条对照仓库现状核对。差异与处置都记在这一页：缺口进待办清单，改掉的进修订记录。复核按编号引用，不在别处另开账本。

## 逐页核对结果

调研文档以站内链接引用了 16 个页面。核对口径：链接能落到 `docs/` 下的真实文件才算存在，只有提法没有文件的不算。结果 14 个存在、2 个不存在。

| 引用页面 | 核对结果 | 引用处 |
|----------|----------|--------|
| /basics/concepts | 存在 | [books](./books)（Amdahl 定律出处） |
| /practice/thread-pool | 存在 | [books](./books)、[applications](./applications) |
| /practice/producer-consumer | 存在 | [books](./books)、[applications](./applications) |
| /practice/reader-writer | 存在 | [applications](./applications) |
| /practice/framework-selection | 存在 | [applications](./applications) |
| /advanced/data-structures | 存在 | [books](./books)、[applications](./applications) |
| /advanced/performance | 存在 | [books](./books)、[applications](./applications) |
| /advanced/lockfree | 存在 | [books](./books) |
| /advanced/memory-model | 存在 | [books](./books)、[memory-model-specs](./memory-model-specs) |
| /sync/locks | 存在 | [books](./books) |
| /models/actor | 存在 | [books](./books)、[applications](./applications) |
| /models/csp | 存在 | [books](./books)、[applications](./applications) |
| /models/dataflow | 存在 | [books](./books)（自加页，与七周书目录对不齐，口径见 books） |
| /models/stm | 存在 | [books](./books) |
| /models/functional | 存在（G1 已补） | [books](./books) 七模型表第 3 章 |
| /models/data-parallel | 存在（G2 已补） | [books](./books) 七模型表第 7 章 |
| /models/lambda-architecture | 存在（G3 已补） | [books](./books) 七模型表第 8 章 |

## 缺口清单

| 编号 | 缺口 | 状态 |
|------|------|------|
| G1 | 函数式并发页未落盘 | 已补：`models/functional.md`（2026-10-10） |
| G2 | 数据并行页未落盘 | 已补：`models/data-parallel.md`（2026-10-10） |
| G3 | Lambda 架构（七周书第 8 章）未覆盖 | 已补：`models/lambda-architecture.md`（2026-10-10） |
| G4 | STM 章只覆盖事务部分 | 已补：`models/stm.md` 增「Clojure 之道：分离标识与状态」一节（2026-10-10） |

## 修订记录

| 编号 | 修订 | 状态 |
|------|------|------|
| R1 | `advanced/memory-model.md` 把「数据竞争 = 未定义行为」写成四语言通用结论，与[规范核对](./memory-model-specs)的结论冲突。已限定到 C++/Rust：核心概念的数据竞争定义改为按语言分述，模型对比表 Go 一行改为 DRF-SC 口径，本章小结同步改写 | 已完成 |
| R2 | `advanced/memory-model.md` 全页没有一条规范引用。已补「本章来源」一节，JMM、C++、Rust、Go 四份规范各给一条入口链接 | 已完成 |
| R3 | books 七模型表两行的「调研后补了」与页面现状不符。已改为未覆盖并指向本表 G1、G2，第 4、8 章两行补 G3、G4 指向 | 已完成 |
| R4 | G1–G4 四个缺口一次补齐：新增 `models/functional.md`、`models/data-parallel.md`、`models/lambda-architecture.md` 三页，`models/stm.md` 增 Clojure 之道一节；books 七模型表第 3、4、7、8 章状态改为已覆盖，`chapter_1.md`、`barriers.md`、`stm.md` 的模型枚举与篇末指向同步更新 | 已完成 |
| R6 | 巡检复核三项：①首页 hero 与 features 文案原写「设计模式 / 语言与框架 / 性能·可靠·安全」等本仓未设专章的块（继承自旧 mdbook 规划），已改写为实际覆盖的四块（基础与同步原语 / 七种并发模型 / 无锁与内存模型 / 性能与实战），tagline 同步；②`research/` 五页原为孤儿页（无侧栏入口，只能靠页内链到达），侧栏末加「调研底稿」组挂总览页一条，其余四份由总览页内链；③统计口径复核：knowledge.md 条目编号 1–70 连续无断号、侧栏 25 条全部指向真实文件、正文 25 页口径自洽，核对用文件清单、侧栏 grep、编号 awk 三项脚本完成 | 已完成 |
| R5 | 全站来源标注补齐：models 四页（actor/csp/stm/dataflow）与进阶、实战篇共 13 页补「本章来源」。依据分三类——书目映射页按 books.md 对应章引用（thread-pool/producer-consumer/data-structures/lockfree/locks）；API 行为页引官方文档（semaphores/condition-variables/barriers/reader-writer/performance 的 JDK 文档、man7、pkg.go.dev、JEP 374、Brendan Gregg）；算法出处页引原始论文（deadlock-livelock 的 Coffman 1971、Sha/Rajkumar/Lehoczky 1990；lockfree 的 Treiber 1986、Michael-Scott 1996、Hazard Pointer 2004；performance 的 Little 1961）。`basics/thread-process`、`basics/critical-section` 无专项调研支撑，维持无来源节（宁缺毋假）；concepts 页只引 Amdahl 出处（books.md 记录）。selection 类页面（framework-selection）标注为选型经验框架而非文献综述 | 已完成 |

## 待办

G1–G4 已全部销账，本页无待办。后续新增调研引用若出现「只有提法没有文件」的页面，按本页口径记新缺口编号（G5 起）。
