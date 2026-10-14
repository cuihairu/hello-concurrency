# 并发术语表

本表收录本站并发文档的核心术语，按主题分组。每条给出中英对照、一句话定义、权威出处与相关页。

**维护口径**：新增条目必须给出可点的权威出处；查不到就写「未找到权威出处（待核）」，不得凭印象编造链接。

## 基础概念

### 并发与并行（Concurrency / Parallelism）
并发是多执行流交错推进的结构问题；并行是多核同时执行。
**出处**：[Go 并发章节（Effective Go 附带）](https://go.dev/doc/)
**相关页**：[basics/concepts](/basics/concepts)、[chapter_1](/chapter_1)

### 进程与线程（Process / Thread）
进程是资源分配单位，线程是调度执行单位，同进程线程共享地址空间。
**出处**：[维基 · 线程](https://en.wikipedia.org/wiki/Thread_(computing))、[POSIX 线程（man7）](https://man7.org/linux/man-pages/man7/pthreads.7.html)
**相关页**：[basics/thread-process](/basics/thread-process)、[advanced/os](/advanced/os)

### 竞态条件（Race Condition）
结果依赖执行时序的错误，多见于无同步的共享访问。
**出处**：[维基 · 竞态条件](https://en.wikipedia.org/wiki/Race_condition)
**相关页**：[basics/concepts](/basics/concepts)、[advanced/security](/advanced/security)

### 临界区（Critical Section）
访问共享资源的代码段，须互斥进入。
**出处**：[Dijkstra · EWD108](https://www.cs.utexas.edu/users/EWD/transcriptions/EWD01xx/EWD108.html)
**相关页**：[basics/critical-section](/basics/critical-section)、[sync/locks](/sync/locks)

### 死锁（Deadlock）
互等待循环：互斥、持有等待、不可剥夺、循环等待四条件齐备。
**出处**：[维基 · 死锁](https://en.wikipedia.org/wiki/Deadlock)
**相关页**：[basics/deadlock-livelock](/basics/deadlock-livelock)

### 活锁（Livelock）
进程不断改变状态却无进展的「礼让循环」。
**出处**：[维基 · 活锁](https://en.wikipedia.org/wiki/Livelock)
**相关页**：[basics/deadlock-livelock](/basics/deadlock-livelock)

### 饥饿（Starvation）
线程因调度不公长期得不到资源或 CPU。
**出处**：[维基 · 死锁（含饥饿）](https://en.wikipedia.org/wiki/Deadlock)
**相关页**：[basics/deadlock-livelock](/basics/deadlock-livelock)、[sync/semaphores](/sync/semaphores)

## 同步原语

### 互斥锁（Mutex）
保证临界区互斥进入的锁，持有者独占。
**出处**：[POSIX pthread.h（mutex）](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/pthread.h.html)、[维基 · 监视器](https://en.wikipedia.org/wiki/Monitor_(synchronization))
**相关页**：[sync/locks](/sync/locks)

### 读写锁（Readers–Writer Lock）
允许多读者并发、写者独占的锁，读多写少场景优化。
**出处**：[维基 · 读写锁](https://en.wikipedia.org/wiki/Readers%E2%80%93writer_lock)
**相关页**：[sync/locks](/sync/locks)、[practice/reader-writer](/practice/reader-writer)

### 信号量（Semaphore）
Dijkstra 提出的计数同步原语，P/V 操作控制资源配额。
**出处**：[维基 · 信号量](https://en.wikipedia.org/wiki/Semaphore_(programming))、[The Little Book of Semaphores](https://greenteapress.com/wp/semaphores/)
**相关页**：[sync/semaphores](/sync/semaphores)

### 条件变量（Condition Variable）
让线程在谓词不满足时挂起、被唤醒后重查的同步原语，须配互斥锁。
**出处**：[POSIX pthread.h（条件变量）](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/pthread.h.html)
**相关页**：[sync/condition-variables](/sync/condition-variables)

### 屏障（Barrier）
所有线程到达才一起放行的汇合点。
**出处**：[维基 · 屏障](https://en.wikipedia.org/wiki/Barrier_(computer_science))、[OpenMP 规范](https://www.openmp.org/specifications/)
**相关页**：[sync/barriers](/sync/barriers)

### 监视器（Monitor）
把锁与条件变量封装为对象的同步构造（如 synchronized/wait/notify）。
**出处**：[维基 · 监视器](https://en.wikipedia.org/wiki/Monitor_(synchronization))
**相关页**：[sync/locks](/sync/locks)、[advanced/os](/advanced/os)

### 哲学家就餐（Dining Philosophers）
共享资源死锁的经典教学问题。
**出处**：[维基 · 哲学家就餐](https://en.wikipedia.org/wiki/Dining_philosophers_problem)
**相关页**：[basics/deadlock-livelock](/basics/deadlock-livelock)

## 并发模型

### Actor 模型（Actor Model）
一切皆 Actor：私有状态 + 消息邮箱，无共享内存。
**出处**：[维基 · Actor 模型](https://en.wikipedia.org/wiki/Actor_model)、[Erlang 并发编程](https://www.erlang.org/doc/getting_started/conc_prog.html)
**相关页**：[models/actor](/models/actor)、[practice/frameworks](/practice/frameworks)

### CSP（Communicating Sequential Processes）
Hoare 提出的进程代数：以通道传递消息同步，Go 并发的理论根基。
**出处**：[维基 · CSP](https://en.wikipedia.org/wiki/Communicating_sequential_processes)
**相关页**：[models/csp](/models/csp)

### STM（Software Transactional Memory）
以乐观事务 + 冲突回滚替代锁的内存同步方式。
**出处**：[维基 · STM](https://en.wikipedia.org/wiki/Software_transactional_memory)、[Clojure refs](https://clojure.org/reference/refs)
**相关页**：[models/stm](/models/stm)

### 数据流编程（Dataflow Programming）
以数据依赖驱动计算节点执行的声明式模型。
**出处**：[维基 · 数据流编程](https://en.wikipedia.org/wiki/Dataflow_programming)
**相关页**：[models/dataflow](/models/dataflow)

### 数据并行（Data Parallelism）
同一操作分布于多数据分片（SIMD/CUDA/OpenMP）。
**出处**：[CUDA 工具包](https://developer.nvidia.com/cuda-toolkit)、[OpenMP 规范](https://www.openmp.org/specifications/)
**相关页**：[models/data-parallel](/models/data-parallel)

### 函数式并发（Functional Concurrency）
以不可变数据消除共享，函数式风格天然并发安全。
**出处**：[Clojure refs](https://clojure.org/reference/refs)、[Scala Futures](https://docs.scala-lang.org/overviews/core/futures.html)
**相关页**：[models/functional](/models/functional)

### Lambda 架构（Lambda Architecture）
批层 + 速层 + 合并视图的流批一体数据处理架构。
**出处**：[维基 · Lambda 架构](https://en.wikipedia.org/wiki/Lambda_architecture)
**相关页**：[models/lambda-architecture](/models/lambda-architecture)

## 内存模型

### 内存模型（Memory Model）
定义读写可见性与重排约束的语言/硬件契约。
**出处**：[Go 内存模型](https://go.dev/ref/mem)、[Java 内存模型（JLS 17）](https://docs.oracle.com/javase/specs/jls/se8/html/jls-17.html)、[C++ 内存序](https://en.cppreference.com/w/cpp/atomic/memory_order)
**相关页**：[advanced/memory-model](/advanced/memory-model)、[research/memory-model-specs](/research/memory-model-specs)

### 内存屏障（Memory Barrier）
阻止指令与访存重排的 CPU 指令。
**出处**：[维基 · 内存屏障](https://en.wikipedia.org/wiki/Memory_barrier)
**相关页**：[advanced/hardware](/advanced/hardware)、[advanced/memory-model](/advanced/memory-model)

### 缓存一致性（Cache Coherence）
多核缓存行一致性协议（MESI 等）。
**出处**：[维基 · 缓存一致性](https://en.wikipedia.org/wiki/Cache_coherence)、[维基 · MESI](https://en.wikipedia.org/wiki/MESI_protocol)
**相关页**：[advanced/hardware](/advanced/hardware)

### 顺序一致性（Sequential Consistency）
所有操作按某全局单一顺序对观察者可见。
**出处**：[维基 · 顺序一致性](https://en.wikipedia.org/wiki/Sequential_consistency)
**相关页**：[advanced/memory-model](/advanced/memory-model)、[advanced/performance](/advanced/performance)

### 线性一致性（Linearizability）
单对象强一致：操作呈现原子瞬时生效。
**出处**：[维基 · 线性一致性](https://en.wikipedia.org/wiki/Linearizability)
**相关页**：[advanced/data-structures](/advanced/data-structures)、[practice/reliability](/practice/reliability)

### 伪共享（False Sharing）
不同线程变量落同一缓存行导致的一致性弹跳。
**出处**：[维基 · 缓存一致性](https://en.wikipedia.org/wiki/Cache_coherence)
**相关页**：[advanced/hardware](/advanced/hardware)、[advanced/performance](/advanced/performance)

## 无锁与原子

### CAS（Compare-and-Swap）
条件原子替换指令，无锁算法的基石。
**出处**：[维基 · CAS](https://en.wikipedia.org/wiki/Compare-and-swap)
**相关页**：[advanced/lockfree](/advanced/lockfree)

### 无锁/无等待（Lock-free / Wait-free）
系统级前进保证：至少一线程前进（lock-free）/ 全部线程有界步数完成（wait-free）。
**出处**：[维基 · 无锁与无等待算法](https://en.wikipedia.org/wiki/Lock-free_and_wait-free_algorithms)
**相关页**：[advanced/lockfree](/advanced/lockfree)

### ABA 问题（ABA Problem）
值 A→B→A 变化骗过 CAS 的经典缺陷。
**出处**：[维基 · CAS（含 ABA）](https://en.wikipedia.org/wiki/Compare-and-swap)
**相关页**：[advanced/lockfree](/advanced/lockfree)

### 原子操作（Atomic Operation）
不可分割的读写/替换操作，映射到硬件原子指令。
**出处**：[C++ 原子与内存序](https://en.cppreference.com/w/cpp/atomic/memory_order)、[C11 内存序](https://en.cppreference.com/w/c/atomic/memory_order)
**相关页**：[advanced/lockfree](/advanced/lockfree)、[advanced/memory-model](/advanced/memory-model)

## 工程模式

### 线程池（Thread Pool）
预建线程复用任务提交，避免线程创建开销。
**出处**：[维基 · 线程池](https://en.wikipedia.org/wiki/Thread_pool)、[Java 并发工具包](https://docs.oracle.com/en/java/javase/21/api/java.base/java/util/concurrent/package-summary.html)
**相关页**：[practice/thread-pool](/practice/thread-pool)

### 工作窃取（Work Stealing）
空闲线程从忙线程队列尾部偷任务的调度策略。
**出处**：[维基 · 工作窃取](https://en.wikipedia.org/wiki/Work_stealing)
**相关页**：[practice/thread-pool](/practice/thread-pool)

### Fork/Join（Fork/Join Model）
分治任务并行框架：fork 子任务、join 汇总。
**出处**：[维基 · Fork/Join](https://en.wikipedia.org/wiki/Fork%E2%80%93join_model)
**相关页**：[practice/thread-pool](/practice/thread-pool)

### 生产者-消费者（Producer–Consumer）
以缓冲队列解耦生产与消费速率的经典模式。
**出处**：[维基 · 生产者-消费者](https://en.wikipedia.org/wiki/Producer%E2%80%93consumer_problem)
**相关页**：[practice/producer-consumer](/practice/producer-consumer)

### Reactor 模式（Reactor Pattern）
单/少事件循环分发 IO 事件给 handler（同步 IO 多路复用）。
**出处**：[Reactor（Schmidt 论文）](https://www.dre.vanderbilt.edu/~schmidt/PDF/Reactor.pdf)
**相关页**：[practice/reactor](/practice/reactor)

### Proactor 模式（Proactor Pattern）
操作系统完成 IO 后回调通知的异步 IO 模式。
**出处**：[Proactor（Schmidt 论文）](https://www.dre.vanderbilt.edu/~schmidt/PDF/Proactor.pdf)
**相关页**：[practice/reactor](/practice/reactor)

### 协程与 async/await（Coroutine / async-await）
用户态可挂起执行流，以异步风格写同步逻辑。
**出处**：[Rust 异步书](https://rust-lang.github.io/async-book/)、[Python asyncio](https://docs.python.org/3/library/asyncio.html)
**相关页**：[practice/async](/practice/async)

## 分布式与可靠性

### CAP 定理（CAP Theorem）
一致性、可用性、分区容忍三者不可兼得。
**出处**：[维基 · CAP](https://en.wikipedia.org/wiki/CAP_theorem)、[Brewer · PODC 演讲稿](https://www.eecs.berkeley.edu/~brewer/cs262b-2004/PODC-keynote.pdf)
**相关页**：[practice/reliability](/practice/reliability)

### 共识（Consensus）
多节点对单值达成一致的分布式基础问题。
**出处**：[维基 · 共识](https://en.wikipedia.org/wiki/Consensus_(computer_science))、[Paxos Made Simple](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf)
**相关页**：[practice/reliability](/practice/reliability)、[research/applications](/research/applications)

### Raft（Raft）
以领导者日志复制实现共识的可理解算法。
**出处**：[Raft 论文](https://raft.github.io/raft.pdf)
**相关页**：[practice/reliability](/practice/reliability)、[research/applications](/research/applications)

### Amdahl 定律（Amdahl's Law）
串行部分限制并行加速上限。
**出处**：[维基 · Amdahl](https://en.wikipedia.org/wiki/Amdahl%27s_law)
**相关页**：[advanced/performance](/advanced/performance)

### Little 定律（Little's Law）
L = λW：系统中平均数 = 到达率 × 停留时间。
**出处**：[维基 · Little 定律](https://en.wikipedia.org/wiki/Little%27s_law)
**相关页**：[advanced/performance](/advanced/performance)

### TOCTOU（Time-of-check to Time-of-use）
检查与使用之间状态被改的竞态安全漏洞。
**出处**：[维基 · TOCTOU](https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use)
**相关页**：[advanced/security](/advanced/security)

## 本章来源

- 本表不设集中出处表：每条术语的权威出处已内联在该条的「出处」一行，可逐条点击核对
- 表内出处共四类——官方规范与语言文档（[Go 内存模型](https://go.dev/ref/mem)、Java 语言规范 JLS 17、C++ 参考手册的 [memory_order](https://en.cppreference.com/w/cpp/atomic/memory_order)、C11 内存序）；原始论文（C. A. R. Hoare 的 CSP 1978、Schmidt 的 Reactor/Proactor、Dijkstra 的信号量与 [EWD108](https://www.cs.utexas.edu/users/EWD/transcriptions/EWD01xx/EWD108.html)、[Paxos Made Simple](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf)、[Raft 论文](https://raft.github.io/raft.pdf)）；教材与手册（《The Little Book of Semaphores》、Effective Go 附带章节）；维基百科条目（用于快速定位定义）
- 规范性与定义性表述以官方规范和原始论文为准，维基条目不承担规范性依据
- 条目分组依本站章节结构划分，术语取舍与[知识点总纲](knowledge.md)及各条「相关页」互链对账

---

**维护口径**：新增条目必须给出可点的权威出处；查不到就写「未找到权威出处（待核）」，不得凭印象编造链接。

<!-- BACKLINKS-AUTO -->
## 相关页面

- [knowledge](knowledge.md)
