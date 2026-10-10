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
| R7 | 选题续写：新增 `advanced/hardware.md`（硬件与内存层次：缓存层次与延迟阶梯、MESI/MOESI 一致性、store buffer 与屏障指令、NUMA、DMA 与 I/O 多路复用、加速器位置），对应 README 规划目录第 3 章「硬件层面的高并发设计」，此前全仓空缺；挂侧栏「进阶主题」组首位、SUMMARY 与 knowledge.md（新条目 15，后续编号顺移，共 71 条），并与 memory-model/data-structures/performance/data-parallel/lockfree 五页互链。来源以 Drepper 2007 论文、Intel SDM、Arm ARM、io_uring 文档为准 | 已完成 |
| R6 | 巡检复核三项：①首页 hero 与 features 文案原写「设计模式 / 语言与框架 / 性能·可靠·安全」等本仓未设专章的块（继承自旧 mdbook 规划），已改写为实际覆盖的四块（基础与同步原语 / 七种并发模型 / 无锁与内存模型 / 性能与实战），tagline 同步；②`research/` 五页原为孤儿页（无侧栏入口，只能靠页内链到达），侧栏末加「调研底稿」组挂总览页一条，其余四份由总览页内链；③统计口径复核：knowledge.md 条目编号 1–70 连续无断号、侧栏 25 条全部指向真实文件、正文 25 页口径自洽，核对用文件清单、侧栏 grep、编号 awk 三项脚本完成 | 已完成 |
| R5 | 全站来源标注补齐：models 四页（actor/csp/stm/dataflow）与进阶、实战篇共 13 页补「本章来源」。依据分三类——书目映射页按 books.md 对应章引用（thread-pool/producer-consumer/data-structures/lockfree/locks）；API 行为页引官方文档（semaphores/condition-variables/barriers/reader-writer/performance 的 JDK 文档、man7、pkg.go.dev、JEP 374、Brendan Gregg）；算法出处页引原始论文（deadlock-livelock 的 Coffman 1971、Sha/Rajkumar/Lehoczky 1990；lockfree 的 Treiber 1986、Michael-Scott 1996、Hazard Pointer 2004；performance 的 Little 1961）。`basics/thread-process`、`basics/critical-section` 无专项调研支撑，维持无来源节（宁缺毋假）；concepts 页只引 Amdahl 出处（books.md 记录）。selection 类页面（framework-selection）标注为选型经验框架而非文献综述 | 已完成 |
| R8 | 选题续写：新增 `practice/reactor.md`（Reactor 模式与事件驱动：每连接一线程 vs 事件驱动对照、Reactor/Handler 结构、单 Reactor 单/多线程与主从变体、Proactor 对照、六条陷阱），对应 README 规划目录 6.5 与 7.2；挂侧栏「实战篇」组末位、SUMMARY 与 knowledge.md（新条目 31，编号 1–72 连续），并与 hardware/thread-pool/producer-consumer/framework-selection/condition-variables 六页互链。来源以 Schmidt 1995 Reactor 论文、io_uring 文档、Netty 官方文档为准 | 已完成 |
| R9 | 交叉链接与侧栏对账：①`chapter_1.md` 1.3 结构清单补入硬件与内存层次、Reactor 与事件驱动（原缺两页）；②R7 声称 hardware 与五页互链，实测只有 memory-model 回链，补 data-structures（伪共享硬件成因）、performance（缓存/NUMA 硬件成因）、data-parallel（加速器选型）、lockfree（CAS 竞争硬件解释）四条回链；③reactor 补三条内容页回链（thread-pool 业务池下沉、producer-consumer 水位线背压、framework-selection Reactor 底层结构）；④knowledge.md 场景映射表加 Reactor 行、坑清单加第 73 条（Handler 阻塞） | 已完成 |
| R10 | 选题续写：新增 `advanced/os.md`（操作系统与并发：内核并发机制与锁演进、内核线程与两级模型/futex、调度类与抢占、虚拟内存与 cgroup 限额、内核机制到用户态表象对照、五条陷阱），对应 README 规划目录第 4 章「操作系统与并发」，此前全仓空缺；挂侧栏「进阶主题」组 hardware 之后、SUMMARY（正文 28 页口径同步）与 chapter_1.md 1.3 进阶主题清单；knowledge.md 新增条目 16（OS 与并发）与坑清单 RT 线程条目，编号 1–75 连续，场景映射表加操作系统调度行；回链补 hardware（关系表）、thread-process（上下文切换）、performance（调度成因）、locks（重量级锁落内核）四条。来源以 futex(2)/sched(7) man 页、Bovet & Cesati 与 Gorman 两书、JEP 444 与 Go FAQ 为准 | 已完成 |
| R11 | 选题续写：新增 `advanced/languages.md`（编程语言与并发支持：四语言对照总表、Java 虚拟线程、C++ 库语言、Go 运行时调度、Python GIL/asyncio/free-threaded、选型建议、四条陷阱），对应 README 规划目录第 5 章「编程语言与并发支持」，此前全仓空缺；挂侧栏「进阶主题」组末位、SUMMARY（正文 29 页口径同步）与 chapter_1.md 1.3 进阶主题清单；knowledge.md 新增条目 17（语言与并发支持）与坑清单 Python GIL 条目，编号 1–77 连续，场景映射表加语言对比行；回链补 memory-model（四语言对照）、framework-selection（语言生态路线）、thread-process（两级模型落地）三条。来源以 JLS §17/JEP 444、C++ 工作草案、Go Memory Model 与 go1.25 发布说明、CPython GIL 文档与 PEP 703 为准 | 已完成 |
| R12 | 选题续写：新增 `practice/reliability.md`（可靠性设计：故障模型五类、冗余三形态与租约+fencing token、一致性谱系与分布式锁正解、WAL 与 RPO/RTO、分布式事务四模式），对应 README 规划目录第 10 章「可靠性设计」，此前全仓空缺；挂侧栏「实战篇」组末位、SUMMARY（正文 31 页口径同步）与 chapter_1.md 1.3 实战篇清单；knowledge.md 新增条目 35（可靠性设计）与坑清单两条（重试治超时、SETNX 当分布式锁），编号 1–83 连续，场景映射表加容错行；回链补 knowledge（流量治理五手段）、applications（Memcache lease）、framework-selection（一致性进决策矩阵）、locks、actor（至少一次与幂等）、performance、os 七条。来源以 Dynamo（SOSP '07）、Chubby（TOCS '09）、Kleppmann 分布式锁批评、Helland 幂等、Saga（SIGMOD '87）、Herlihy-Wing 线性一致为准 | 已完成 |
| R13 | 选题续写：新增 `practice/async.md`（异步编程与 Future 模式：Future 四形态对照、结构化并发、Observer 与响应式流 request(n) 背压、五种异步模型对照、五条陷阱），对应 README 规划目录 6.3、6.4 与 7.1（此前全仓空缺的最后三节设计模式/技术）；挂侧栏「实战篇」组末位、SUMMARY（正文 30 页口径同步）与 chapter_1.md 1.3 实战篇清单；knowledge.md 新增条目 34（异步编程与 Future）与坑清单两条（逐段 get、取消不传播），编号 1–80 连续，场景映射表加异步组合行；回链补 reactor（编程模型对照）、producer-consumer（流式背压）、csp（与组合式异步对照）三条。来源以 Reactive Streams 规范、JEP 453、Go context 文档与 Kotlin 协程指南为准 | 已完成 |
| R14 | 选题续写：新增 `advanced/security.md`（并发与安全：竞态漏洞五形态 TOCTOU/double-fetch、并发 DoS 与资源上限、缓存与侧信道、Saltzer-Schroeder 原则的并发形态、TSan/Helgrind/jcstress 工具表、七条陷阱），对应 README 规划目录第 11 章「高并发系统的安全」，此前全仓空缺；挂侧栏「进阶主题」组末位、SUMMARY（正文 32 页口径同步）与 chapter_1.md 1.3 进阶主题清单；knowledge.md 新增条目 37（并发与安全）与坑清单两条（str 比较密钥、检查后重开文件），编号 1–89 连续，场景映射表加安全行；回链补 critical-section（交错即竞态）、locks（超时获取）、memory-model（数据竞争后果）、producer-consumer/thread-pool（有界铁律）、reliability（资源耗尽）、languages（常量时间比较落点）、functional（不可变即最小共享）、actor（状态私有）、sync/locks 九条。来源以 Cowan TOCTOU（1998）、Barrack double-fetch（2003）、Bernstein 缓存时序（2005）、Spectre（2019）、Saltzer-Schroeder（1975）与 TSan/jcstress/Helgrind 官方文档为准 | 已完成 |
| R15 | 选题续写：`advanced/performance.md` 补齐 README 规划目录 9.3–9.5 三节——负载均衡（四策略对照、一致性哈希、健康检查误判/重试放大/黏性与扩容三成本）、缓存策略（四种读写模式、穿透/击穿/雪崩修法、失效通知可靠性）、压测与监控（建模到故障演练五阶段、RED/USE 加 PSI）；本章小结补两级放大器段，来源加 Karger 1997 与 Memcache NSDI'13 两条。knowledge.md 新增条目 29（扩容与缓存）与坑清单两条（热点过期裸奔、重试放大），编号 1–86 连续，场景映射表加负载均衡缓存行；无新页面，不改侧栏 | 已完成 |
| R16 | 选题续写：新增 `advanced/trends.md`（前沿趋势与展望：档位三分法、硬件五方向、语言运行时三条收敛线、架构层并发单元上移、量子单列澄清），对应 README 规划目录第 13 章「新兴趋势与未来」，此前全仓空缺；挂侧栏「进阶主题」组末位、SUMMARY（正文 33 页口径同步）与 chapter_1.md 1.3 进阶主题清单；knowledge.md 新增条目 38（前沿趋势与展望），编号 1–91 连续，场景映射表加趋势档位行。来源以 JEP 444/453、CXL Consortium、Rust Reference Send/Sync、Shapiro CRDT 2011、Nielsen & Chuang 为准，档位划分为本仓判断 | 已完成 |

| R16 | 选题续写：新增 `advanced/trends.md`（前沿趋势与展望：硬件/工程/论文三档判据、硬件层五方向 big.LITTLE/CXL/PMem/DPU/加速器、语言与运行时三条收敛线——结构化并发、虚拟线程、Rust 编译期竞争检查、架构层四方向事件溯源/Kappa/CRDT/WASM、量子并行与经典并发的区分），对应 README 规划目录第 13 章「新兴趋势与未来」，此前全仓空缺；挂侧栏「进阶主题」组末位、SUMMARY（正文 33 页口径同步）与 chapter_1.md 1.3 进阶主题清单；knowledge.md 新增条目 38（趋势三档与三条收敛线）与场景映射表趋势行，编号 1–90 连续；回链补 hardware（新硬件档位）、languages（虚拟线程与结构化并发档位）两条。来源以 JEP 444/453、CXL Consortium、Rust Reference Send/Sync、Shapiro CRDT（INRIA 2011）、Nielsen & Chuang 为准；档位划分标注为本仓判断 | 已完成 |

## 待办

G1–G4 已全部销账，本页无待办。后续新增调研引用若出现「只有提法没有文件」的页面，按本页口径记新缺口编号（G5 起）。
