# 前沿趋势与展望

并发领域的变化速度比操作系统与内存模型快得多——后两者十年一变，前者每年都有新词。本页按「有硬件支撑的」「有工程验证的」「还在论文阶段的」三档梳理，避免把趋势当结论。对应 README 规划目录第 13 章。

## 分档：读趋势先问在哪一档

| 档位 | 判据 | 例子 |
|------|------|------|
| **硬件已就位** | 芯片在售、内核与语言已对接 | 虚拟线程、io_uring、PMEM（有限场景） |
| **工程已验证** | 大规模生产用过，生态在跟进 | 结构化并发、Rust async、CRDT 协作编辑 |
| **论文/早期** | 规范未定、生态零散、成本未明 | 量子并发、CXL 内存池、存算一体 |

落库判断：第一档进[编程语言与并发支持](./languages.md)这类正文页，第二档进[并发框架选型](../practice/framework-selection.md)的决策矩阵，第三档只在本页跟踪——**趋势页的职责是标注档位，不是预测赢家**。

## 硬件层：并发的土壤在变

| 方向 | 现状 | 对并发编程的影响 |
|------|------|------------------|
| **性能核 + 能效核（big.LITTLE）** | 手机与服务器均已普及 | 线程亲和性从「按核数配」变成「按核类型配」，任务要分等级 |
| **CXL 内存池化** | 规范 3.0，服务器试点 | 内存从「属于这台机器」变成「池里租的一段」，NUMA 模型更复杂也更灵活 |
| **PMem / 字节寻址持久化** | 商用收缩（Optane 停产），生态沉淀 | 持久化内存要求「崩溃一致的数据结构」，与[可靠性设计](../practice/reliability.md)的 WAL 思路合流 |
| **DPU / 智能网卡** | 数据中心标配 | 网络与加解密下沉网卡，主机 CPU 专注业务逻辑 |
| **GPU 通用计算与 AI 加速器** | 成熟 | 数据并行已是常规选项，见[数据并行](../models/data-parallel.md) |

不变的部分先记住：缓存层次、缓存一致性、NUMA 这三样在可预见的将来不会消失，[硬件与内存层次](./hardware.md)仍是地基。变的是「多少核、什么类型的核、内存挂在哪」这些参数。

## 语言与运行时：三条收敛线

**一、结构化并发取代裸任务提交。** 线程池加 Future 的年代，任务的生命周期与作用域脱钩——父任务结束了，子任务还在跑。结构化并发把并发单元嵌进词法作用域：作用域退出前必须等所有子任务结束，取消自动向下传导。Kotlin 协程作用域、Swift TaskGroup、Java StructuredTaskScope（Loom 后续）都是这条线，见[异步编程与 Future](../practice/async.md)。

**二、虚拟线程把「便宜的阻塞」变成默认。** Java 21 虚拟线程、Go goroutine、Erlang 进程、C# async 之外的 .NET 线程池，方向一致：**编程上是线程，实现上是 M:N 调度**。阻塞不再昂贵，锁竞争与[操作系统调度](./os.md)的分析口径随之改变——瓶颈从「线程数」移向「真正持有 CPU 的时间」。

**三、Rust 把数据竞争移出运行时、移进编译期。** `Send`/`Sync` 契约让「能否跨线程共享」变成编译期检查，竞争类 bug 从「压测时偶现」变成「编译不过」。它没有消灭[内存模型](./memory-model.md)——unsafe 边界内一切照旧——但把 99% 的代码移出了风险区。这条路线对其他语言的启发是：安全要靠类型与所有权，不能靠纪律。

## 架构层：并发单元在变大

并发的粒度正在从「单机线程/协程」上移到「服务与区域」：

| 方向 | 内容 | 落点 |
|------|------|------|
| **事件溯源与 CQRS** | 状态由事件流重放得出，写读分离 | [并发框架选型](../practice/framework-selection.md) |
| **流批一体（Kappa）** | 用日志重放取代 Lambda 双份逻辑 | [Lambda 架构](../models/lambda-architecture.md) |
| **CRDT 与本地优先（local-first）** | 无中心协调的合并收敛，协作编辑的基础 | 一致性谱系的最松一档，见[可靠性设计](../practice/reliability.md) |
| **WASM 组件模型** | 跨语言沙箱并发单元，线性内存隔离 | 早期，观测中 |

共同点：**用不可变与重放换掉共享状态协调**——[函数式并发](../models/functional.md)与[Actor](../models/actor.md)的老思想，在分布式尺度上重新长出来。

## 量子计算：单独说一段

量子并发（quantum concurrency）常被列进趋势清单，但要先分清：**量子并行**是叠加态同时探索解空间（Grover、Shor 算法的加速来源），与经典并发的「多执行流共享资源」不是一回事——量子比特不能拆给两个线程用，退相干与测量反而让「多任务共享一台量子机」比经典更难。工程现实：当前 NISQ 时代的量子机由经典调度器排队提交，谈量子并发编程还早。**对并发工程的直接输入目前为零**，跟踪即可，不进架构决策。

## 本章小结

趋势阅读的三条纪律：**先问档位**——硬件、工程、论文三档的行动含义完全不同；**先记不变量**——缓存层次、happens-before、有界资源、幂等这四样不随趋势变，变的是它们的参数与载体；**让趋势进正文而不是进焦虑**——档位升到「硬件已就位」时，它自然会成为[性能调优](./performance.md)或[编程语言与并发支持](./languages.md)里的正式章节。

## 本章来源

- 虚拟线程与结构化并发：[JEP 444](https://openjdk.org/jeps/444)、[JEP 453](https://openjdk.org/jeps/453)、Kotlin 协程文档之[结构化并发](https://kotlinlang.org/docs/coroutines-basics.html)
- CXL 规范与生态：[CXL Consortium](https://www.computeexpresslink.org/)；DPU 与智能网卡见各厂商（AWS Nitro、NVIDIA BlueField）公开文档
- Rust 并发契约：[Rust Reference 的 Send/Sync 条目](https://doc.rust-lang.org/reference/send-and-sync.html)
- 结构化并发的命名出处：J. Lea, *Structured Concurrency with Structured Tasks*（InfoQ, 2018）；思想源头是 N. D. Jones 调研的多线程资源管理问题（1970s）
- CRDT：M. Shapiro 等，*A Comprehensive Study of Convergent and Commutative Replicated Data Types*（INRIA, 2011）
- 量子并行与经典并发的区分：Nielsen & Chuang, *Quantum Computation and Quantum Information*（剑桥大学出版社）；本页只作区分，不作预测
- 本页对应 README 规划目录第 13 章「新兴趋势与未来」，此前全仓空缺；档位划分是本仓判断（调研结论），不引用预测性文章
