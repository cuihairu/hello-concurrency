# 知识点总纲

> 本页把散在正文二十二页与 [research 调研](/research/README) 四份文档里的知识点收拢成一页：核心概念、权威书籍、官方规范、应用场景、常见坑。每条注明站内出处并链接回原文；规范类结论以原文核对为准，核对过程与缺口清单在[覆盖核对差异表](/research/coverage-audit)。查无实据的条目不收。

## 核心概念

### 基础与硬件

- 并发是同一时间段内交替处理多任务，并行是同一时刻物理上同时执行；单核靠时间片轮转，多核才有真并行。IO 等待是 CPU 周期的数万倍，并发的第一价值是让等待彼此重叠。见[并发基础概念](/basics/concepts)。
- 进程是资源分配的基本单位，线程是 CPU 调度的基本单位。线程共享地址空间，切换不刷 TLB；刷 TLB 是进程切换的事。线程模型分用户级、内核级、两级，goroutine 与 Java 虚拟线程属两级。见[线程与进程](/basics/thread-process)。
- 临界区三要素：共享资源、临界区代码、互斥机制。互斥的实现分三层：硬件原子指令（TSL、CAS、LL/SC）、操作系统原语（mutex、spinlock、semaphore）、语言库抽象。见[临界区与互斥](/basics/critical-section)。
- 锁的获取是 acquire 语义、释放是 release 语义，unlock hb lock 构成完整的 happens-before 链。互斥锁 = 二值信号量 + 所有权，所有权是两者最要紧的差别。见[锁](/sync/locks)、[信号量](/sync/semaphores)。
- 条件变量不保护数据，只协调时序，必须配互斥锁。铁律三条：wait 包在 while 循环里（防虚假唤醒与信号丢失）、修改条件与 signal 在同一临界区、默认用 signal 仅全局状态变化用 broadcast。见[条件变量](/sync/condition-variables)。
- 屏障分两类：CyclicBarrier 可重用、带屏障动作，适合迭代并行；CountDownLatch 一次性，适合启动与关闭同步。Phaser 支持动态注册与分层树，Go 的 WaitGroup 计数归零后可复用，与 latch 的一次性不同。见[屏障](/sync/barriers)。
- 死锁四必要条件（Coffman）：互斥、请求与保持、不可剥夺、循环等待，破坏任一即可预防。活锁的根因是重试策略同步，解法是随机退避与队列化。饥饿的极端形态是优先级反转，靠优先级继承协议解。见[死锁与活锁](/basics/deadlock-livelock)。

### 并发模型

- Actor 模型（Hewitt 1973）：一切皆 Actor，状态私有、异步消息、单 Actor 内顺序处理。消息投递三语义里工程现实是「至少一次」，业务层必须幂等。见[Actor 模型](/models/actor)。
- CSP（Hoare 1978）：进程经通道同步通信，不共享内存。无缓冲通道的会合点是隐式屏障，背压自动传导；发送 happens-before 接收。Go 把 CSP 做成了语言内置。见[CSP 模型](/models/csp)。
- STM 把数据库事务引入内存并发：乐观执行、冲突检测、自动重试。它消除死锁、可组合，但事务内不能做 I/O，高竞争写热点与实时场景不如锁。见[STM 软件事务内存](/models/stm)。
- 数据流模型把计算建成 DAG：输入就绪即触发，相同输入必得相同输出，无共享可变状态，背压沿边传导。见[数据流模型](/models/dataflow)。

### 无锁与内存模型

- CAS 与 LL/SC 是两大硬件原语。CAS 有 ABA 问题（A→B→A 误判成功），解法是标记指针、版本号或 Hazard Pointer；LL/SC 无 ABA，但两指令间不能插入系统调用与中断。见[无锁编程](/advanced/lockfree)。
- 无锁编程的命门是内存回收：节点删除时其他线程可能仍在访问，不能立即 free。Hazard Pointer 低延迟、EBR 高吞吐、RCU 读零开销，按场景选。见[无锁编程](/advanced/lockfree)。
- 进度保证分三级：wait-free（有限步骤必完成）、lock-free（系统整体推进、个别线程可能饿）、obstruction-free（独占执行时必完成）。多数无锁数据结构是 lock-free 而非 wait-free。见[无锁编程](/advanced/lockfree)。
- happens-before 是推理可见性的偏序工具，六条规则：程序顺序、监视器锁、volatile 与同变量原子、线程启动、线程终止、传递性。顺序一致性最强但性能最差。见[内存模型](/advanced/memory-model)。
- 同一个「数据竞争」，四份规范给的后果不同：C++/Rust 是 UB，Java 脱离顺序一致保证但行为仍有定义，Go 未消除竞争时 DRF-SC 保证失效、实现可检测并终止。写跨语言并发代码，这条差异先分清。见[内存模型](/advanced/memory-model)与[官方内存模型规范核对](/research/memory-model-specs)。
- seq_cst 的全部操作落在单一全序 S 上；release/acquire 只在单个对象、单条发布-订阅链上生效，跨对象不连通；relaxed 只保原子性不保顺序。先用 seq_cst 保证正确，再按压测降序。见[内存模型](/advanced/memory-model)。

### 数据结构与性能

- 队列选型先看要不要背压：要背压选有界阻塞队列或 Disruptor，不要背压选无锁队列（JCTools、ConcurrentLinkedQueue）。Map 默认 ConcurrentHashMap（JDK 8+ 摒弃分段锁，改 CAS + 锁桶首节点），有序选 ConcurrentSkipListMap。见[并发数据结构](/advanced/data-structures)。
- 复合操作必须原子化：check-then-act 拆成两步就有竞态，用 remove(k, v)、computeIfAbsent、merge 这类原子复合方法。迭代器是弱一致的，不抛 CME，size() 是估算值。见[并发数据结构](/advanced/data-structures)。
- 高并发计数用 LongAdder 不用 AtomicLong：分片消除单点 CAS 竞争，读时合并。伪共享靠 @Contended、padding 或 alignas(64) 消除，验证用 perf c2c。见[并发数据结构](/advanced/data-structures)。
- 容量规划用 Little's Law：并发数 = 吞吐率 × 平均延迟，W 取均值不取 p99，用 p99 会系统性高估线程数。见[性能调优](/advanced/performance)。
- 调优闭环是测量、分析、优化、验证：RED（请求视角）与 USE（资源视角）定指标，火焰图读宽度与平顶，不测不改。见[性能调优](/advanced/performance)。

### 实战

- 线程池参数组合的坑集中在队列类型：无界队列让 maxPoolSize 永不生效，任务堆积直到 OOM；有界队列才让拒绝策略有机会执行。CPU 密集配核数、IO 密集配 2×核数是起点不是答案。见[线程池设计](/practice/thread-pool)。
- 生产者-消费者的工程三角是缓冲、同步、背压。有界是铁律；背压六策略（阻塞、丢新、丢旧、降级、扩容、Reactive Streams）按业务选；多消费者分竞争消费、广播、分片有序三种模式。见[生产者-消费者](/practice/producer-consumer)。
- 读者-写者三变体：读者优先（写可能饿）、写者优先（读可能饿）、公平轮转。锁降级支持、锁升级死锁；StampedLock 不可重入、不支持 Condition，乐观读失败率超 5% 就该退回悲观。见[读者-写者](/practice/reader-writer)。
- 框架选型是架构决策，四维权衡：问题域、一致性要求、团队栈、运维成熟度。简单问题用简单工具：线程池 > Actor > 工作流；团队熟悉度优先于技术先进性。见[并发框架选型](/practice/framework-selection)。

## 权威书籍要点

| 书名 | 作者/年代 | 对应知识点 | 站内出处 |
| --- | --- | --- | --- |
| Java Concurrency in Practice | Brian Goetz 等，Addison-Wesley | 线程安全性→对象共享→构建模块→任务执行的骨架；线程池参数、阻塞队列、并发容器、原子变量 | [线程池设计](/practice/thread-pool)、[并发数据结构](/advanced/data-structures)、[生产者-消费者](/practice/producer-consumer) |
| C++ Concurrency in Action（第 2 版） | Anthony Williams，Manning 2019 | 内存序与硬件的关系先讲、无锁算法后讲；CAS、内存回收、std::lock 多锁获取 | [内存模型](/advanced/memory-model)、[无锁编程](/advanced/lockfree)、[锁](/sync/locks) |
| The Rustonomicon | Rust 官方（自述仍不完整） | 别名规则、Send/Sync 契约、unsafe 边界；配合 Rust Reference 的 UB 清单读 | [锁](/sync/locks)、[内存模型](/advanced/memory-model) |
| 七周七并发模型 | Paul Butcher，PragProg 2014 | 七个模型的清单与排列；本仓并发模型四页按它核对，函数式、数据并行、Lambda 三块未覆盖 | [Actor 模型](/models/actor)、[CSP 模型](/models/csp)、[STM 软件事务内存](/models/stm)、[数据流模型](/models/dataflow) |

> 引用口径：概念定义与陷阱清单参考书，能落到规范条文的以规范原文为准，书与规范冲突时按规范写并在页面注明来源。四本书只提供结构和解释，示例代码一律现写。详见[权威书籍调研](/research/books)。

## 官方文档要点（带链接）

规范类结论以原文为准，入口如下；逐条核对过程与四语言对照表在[官方内存模型规范核对](/research/memory-model-specs)。

- [JLS SE21 §17.4 Threads and Locks](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html)：JMM 全章，§17.4.5 是数据竞争定义与「正确同步」判据的出处。
- [C++ 工作草案 [intro.races]](https://eel.is/c++draft/intro.races)：「Any such data race results in undefined behavior」的原文。
- [C++ 工作草案 [atomics.order]](https://eel.is/c++draft/atomics.order)：seq_cst 单一全序 S 与 coherence 四条约束。
- [Rust Reference: Behavior considered undefined](https://doc.rust-lang.org/reference/behavior-considered-undefined.html)：UB 清单第一条就是 Data races，适用范围明确包含 unsafe 块。
- [std::sync::atomic](https://doc.rust-lang.org/std/sync/atomic/index.html)：Rust 原子操作沿用 C++20 [intro.races] 规则、去掉 consume；跨语言对照时按一条规则算，不重复计数。
- [The Go Memory Model](https://go.dev/ref/mem)（2022-06-06 版）：DRF-SC 结论与「实现可检测竞争并终止」条款。
- [The Rustonomicon](https://doc.rust-lang.org/nomicon/)：unsafe 语义与别名规则，官方自述仍不完整。

## 应用场景

### 高并发服务

并发形态是线程池加异步 IO：连接数远大于工作线程数，请求排队、处理完立刻还回去。Tomcat 默认 200 个工作线程，请求多于线程时新请求只能转圈，这是最朴素的限流。流量治理五个手段：

| 手段 | 做什么 | 关键点 |
| --- | --- | --- |
| 限流 | 给资源设数量上限，超出的缓冲或直接拒绝 | 计数器不平滑，工程里漏桶与令牌桶用得多；限流由服务提供方提供 |
| 熔断 | 下游故障时切断调用，返回默认结果 | 由调用端提供，防 A→B→C 链路挂拖垮线程池 |
| 降级 | 从入口大范围关掉非核心流量 | 适合放 Nginx、DNS 入口层 |
| 预热 | 新节点慢慢加量 | 没 JIT 编译、缓存是冷的，直接接 1/N 流量可能打挂 |
| 背压 | 被调用方持续反馈处理能力，调用方据此调速 | 比固定限流多一层反馈，TCP 滑动窗口是原型 |

这一层考验四件事：队列深度与背压（无限增长等于把故障推迟到 OOM）、临界区长度（锁里做网络调用吞吐断崖）、伪共享、优雅停机。跨机房热点缓存的标准答案是 Facebook 的 Memcache 集群（NSDI '13），用 lease 处理缓存失效与重新填充的竞态。见[应用场景调研](/research/applications)。

### 游戏服务器

并发形态与 Web 不同：单个玩家操作顺序执行，跨玩家交互才需要并发，状态高度共享。主流解法是把共享状态收进 actor，每个 actor 单线程处理消息。skynet 是这条路线的代表：C 写框架、Lua 写业务，每个 actor 一个独立虚拟机加消息队列，调度器公平轮转派发。

游戏服务器特有的问题：逻辑帧与定时器（单线程主循环加时间轮）、状态同步（快照插值、兴趣管理）、广播风暴（合并写、分帧发送）、断线重连（会话超时与快照回放）、热更新（脚本层热替换）、背压（写队列上限，超限踢人而不是阻塞）。帧循环对延迟抖动极敏感，GC 停顿与锁争用直接变成掉帧。见[应用场景调研](/research/applications)。

### 场景到章节的映射

| 场景需求 | 对应页面 |
| --- | --- |
| 连接与任务的排队执行 | [线程池设计](/practice/thread-pool) |
| 有界队列、背压、多消费者 | [生产者-消费者](/practice/producer-consumer) |
| 读多写少的场景状态 | [读者-写者](/practice/reader-writer) |
| actor 化的实体与消息 | [Actor 模型](/models/actor) |
| 管道式流水线与取消 | [CSP 模型](/models/csp) |
| 读多写少的共享缓存 | [并发数据结构](/advanced/data-structures) |
| 计数、延迟与容量规划 | [性能调优](/advanced/performance) |
| 框架与架构选型 | [并发框架选型](/practice/framework-selection) |

## 常见坑误区

- **把「数据竞争 = UB」当四语言通用结论**：只对 C++/Rust 成立；Java 脱离顺序一致保证但行为仍有定义，Go 是 DRF-SC 保证失效。写跨语言对照时按四份规范分述。见[内存模型](/advanced/memory-model)。
- **无界队列**：maxPoolSize 永不生效，任务堆积到 OOM 才暴露。线程池必须配显式拒绝策略。见[线程池设计](/practice/thread-pool)。
- **锁顺序不一致**：多锁场景不全局固定加锁顺序，死锁是必然不是偶发；嵌套锁能避就避，必要时用 std::lock 同时获取。见[临界区与互斥](/basics/critical-section)、[锁](/sync/locks)。
- **条件变量用 if 替代 while**：虚假唤醒与信号丢失都会让等待方错过条件变化，wait 必须包在 while 循环里。见[条件变量](/sync/condition-variables)。
- **Java 在锁外 signal**：Java 的 Condition.signal() 必须在持锁时调用，否则抛 IllegalMonitorStateException；POSIX 相反，锁外 signal 合法且是常见微优化。两套 API 约束方向相反，混用最容易踩。见[条件变量](/sync/condition-variables)。
- **Go worker pool 直接 close 任务队列**：close 与并发的 ch <- task 之间没有同步手段，竞态就是 panic: send on closed channel。正确做法是 closed 标志加 context 取消，队列自始至终不关闭。见[线程池设计](/practice/thread-pool)。
- **StampedLock 当重入锁用**：它不可重入、不支持 Condition，同线程二次获取直接死锁；乐观读失败率持续高于 5% 就该退回悲观读。见[读者-写者](/practice/reader-writer)。
- **读写锁升级**：读锁升写锁会死锁，ReentrantReadWriteLock 只支持降级；StampedLock 的 tryConvertToWriteLock 有竞争时返回 0，必须先放读锁再取写锁。见[读者-写者](/practice/reader-writer)。
- **volatile 挡不住复合操作**：v++ 是读-改-写三步，计数要用 AtomicLong/LongAdder；单次 volatile long 读写自 Java 5 起才是原子的。见[内存模型](/advanced/memory-model)。
- **锁里做网络调用**：临界区包含 I/O、睡眠、日志，吞吐断崖式下跌；临界区只留共享数据访问。见[临界区与互斥](/basics/critical-section)。
- **活锁用固定退避**：双方同步退避会同步重试、永久冲突；随机退避或队列化才打破对称。见[死锁与活锁](/basics/deadlock-livelock)。
- **无锁节点立即 free**：其他线程可能仍在访问，必须走 Hazard Pointer、EBR 或 RCU 回收。见[无锁编程](/advanced/lockfree)。
- **CAS 的 ABA**：pop 期间 head A→B→A，CAS 误判成功；指针打标签或加版本号。见[无锁编程](/advanced/lockfree)。
- **Little's Law 用 p99 算线程数**：W 是平均逗留时间，用 p99 会系统性高估并发需求。见[性能调优](/advanced/performance)。
- **调偏向锁参数**：JDK 15 废弃、JDK 18 移除，JDK 21 传入直接报 Unrecognized VM option。见[性能调优](/advanced/performance)。
- **Actor 无界邮箱**：慢消费者拖垮 actor，邮箱要有上限、流控、Pull 模式。见[Actor 模型](/models/actor)。
- **忽略幂等**：分布式 actor 只能保证至少一次投递，重复消息靠幂等键去重。见[Actor 模型](/models/actor)。
- **容器里按宿主机核数配线程**：cgroup CPU 限额小于宿主机核数时线程过多争抢，用 ActiveProcessorCount 或 UseContainerSupport。见[线程池设计](/practice/thread-pool)。
- **信号量 P/V 不配对**：计数器漂移导致死锁或泄漏，用 RAII 封装；信号量当互斥锁用会丢所有权保护。见[信号量](/sync/semaphores)。
- **优先级反转无防护**：高优先级等低优先级持有的锁，中优先级抢占 CPU，高优先级永久等待；靠优先级继承协议解。见[死锁与活锁](/basics/deadlock-livelock)。
