# 操作系统与并发

[硬件与内存层次](./hardware.md)讲的是多核与内存的物理约束，本页讲内核在两者之间做的事：把 CPU 时间分给线程、把虚拟内存映射到物理内存。用户态看不到调度器，但延迟毛刺、锁的真实成本、容器里的怪现象，表象都要经过它——调度、抢占、缺页、限额都由操作系统兑现。

## 内核里的并发机制

- **中断与系统调用**：中断上下文不能睡眠，内核里用自旋锁；系统调用是用户态与内核的同步边界，锁在内核态的行为（睡眠 vs 自旋）由这段代码处在哪个上下文决定
- **内核锁的演进**：Linux 2.4 用一把 Big Kernel Lock 串行化所有内核路径，2.6 起拆除，换成细粒度锁 + 专用原语——`seqlock`（读侧无锁乐观，读方重试）、`RCU`（读者零开销，宽限期后回收，见[无锁编程](./lockfree.md)的回收对比表）、`per-CPU` 数据（把共享变私有，思路与计数器分片同源，见[并发数据结构](./data-structures.md)）
- **临界区必须短**：内核临界区往往关抢占甚至关中断，窗口长度直接变成全系统其他 CPU 的延迟抖动——这与用户态「锁里不做 I/O」是同一条纪律（见[临界区与互斥](../basics/critical-section.md)）

## 线程管理

| 项 | 内核线程 | 用户线程（两级模型） |
|----|---------|---------------------|
| 调度者 | 内核 | 用户态运行时再映射到内核线程 |
| 创建成本 | 系统调用，内核结构 + 独立栈/TLS | 用户态快速路径，可到微秒级 |
| 阻塞影响 | 只挂当前线程 | 映射的内核线程被占住则整组停摆（除非运行时接管） |
| 代表 | pthreads、Java 平台线程 | goroutine、Java 虚拟线程（见[线程与进程](../basics/thread-process.md)的线程模型表） |

两级模型把调度下沉到运行时：Go runtime 负责 M:N 调度与工作窃取，Java 虚拟线程在阻塞点 mount/unmount（[JEP 444](https://openjdk.org/jeps/444)）。收益是百万级并发单元的成本，代价是「线程数 = 并行度」的直觉失效——并行度由运行时的调度载体数决定。

**futex 是锁的成本底座**：`pthread_mutex`、`pthread_cond`、Go 与 JVM 的同步原语，无竞争时在用户态用原子指令直接完成（fast path），竞争时经 `FUTEX_WAIT/FUTEX_WAKE` 进内核挂起/唤醒。所以**锁的代价不在临界区里的指令，而在竞争时进内核的那次挂起与唤醒**——这也是[锁](../sync/locks.md)与[条件变量](../sync/condition-variables.md)在低竞争下近乎免费、高竞争下断崖的机制解释。

## 调度算法与抢占

Linux 按调度类分层，实时类永远优先于公平类：

| 调度类 | 策略 | 适用 |
|--------|------|------|
| Deadline | EDF + 带宽硬限制 | 周期性实时任务，带宽超限即限死 |
| Realtime | SCHED_FIFO / SCHED_RR | 低延迟控制类，靠权限与 `RLIMIT_RTPRIO` 设限 |
| Fair | CFS（vruntime 红黑树） | 绝大多数业务线程 |
| Idle / Batch | 空闲与批处理 | 后台计算 |

- **抢占的两种形态**：线程自愿让出（阻塞、`sched_yield`）与被抢占（时间片用完）。频繁的被动抢占是「核数够但延迟抖」的常见来源
- **切换成本的构成**：保存/恢复寄存器只是零头，真正贵的是调度器本身的开销（运行队列锁、迁移）与缓存/TLB 变冷（见[上下文切换](../basics/thread-process.md)与[延迟阶梯](./hardware.md)）
- **亲和性与隔离**：`taskset`/`cgroup cpuset` 绑核、IRQ affinity 把中断钉在指定核、`isolcpus`/`nohz_full` 把核从调度器手里隔离出来给延迟敏感负载；NUMA 下还要配 `numactl` 让内存落在本地节点（见[硬件与内存层次](./hardware.md)的 NUMA 一节）

## 内存管理与虚拟内存

- **页表与 TLB**：多级页表 + TLB 缓存翻译结果；TLB miss 要走页表，代价远高于缓存 miss。大页（Huge Page）摊薄页表项数量、PCID/ASID 让切换不必全刷 TLB
- **缺页与抖动**：minor fault 只补页表，major fault 要等磁盘；工作集超过物理内存后进入回收/换页，表现为延迟断崖式上升。高并发服务的常态做法是常驻工作集 + 监控缺页率
- **OOM 与 cgroup 限额**：宿主机 OOM killer 挑进程杀，容器里由 `memory.max` 触发、只杀容器内进程——线上「进程无故被杀」先分清是哪一层的 OOM
- **页缓存与 writeback**：读走缓存、写回写盘，`fsync` 才保证落盘，边界已在[硬件与内存层次](./hardware.md)的存储一节讲过，不再重复

## 内核机制与用户态表象

| 内核机制 | 用户态表象 | 去哪页 |
|----------|-----------|--------|
| 调度延迟与抢占 | p99 延迟毛刺、吞吐不稳 | [性能调优](./performance.md) |
| 两级调度与 futex | 锁竞争的代价远超临界区本身 | [锁](../sync/locks.md) |
| 页表、TLB 与缺页 | 大内存服务的周期性卡顿 | [硬件与内存层次](./hardware.md) |
| NUMA 首次触碰 | 核加了、吞吐没涨 | [硬件与内存层次](./hardware.md) |
| cgroup CPU/内存限额 | 容器内按宿主机核数配线程、周期性 OOM | [线程池设计](../practice/thread-pool.md) |

## 陷阱

| 陷阱 | 后果 | 修正 |
|------|------|------|
| SCHED_FIFO 线程死循环 | RT 类永远优先，整机（含看门狗）被饿死 | 限定 `RLIMIT_RTPRIO`，RT 线程留守护任务，或改用带宽受限的 Deadline 类 |
| 超额订阅下用自旋等待 | 忙等线程占着时间片，被等的线程排不上队 | 核数富余且临界区极短才自旋，其余走 futex 挂起 |
| 忽视 major fault | 内存超限时周期性卡顿，误判为 GC 或锁竞争 | 监控缺页率与 PSI，为工作集预留物理内存 |
| 透明大页（THP）放任不管 | 折叠/compaction 造成不可预期的长停顿 | 延迟敏感进程显式关 THP 或预分配 hugetlb |
| 盲目提高线程优先级 | 优先级通胀，高优线程互相等低优线程持有的资源 | 优先级继承由锁协议处理，业务层不乱设优先级 |

## 本章小结

操作系统是并发性能的兑现层：**调度器决定谁在什么时候跑、跑在哪**（调度类、抢占、亲和性），**futex 决定锁在竞争时的真实代价**（用户态快路径 + 内核挂起/唤醒），**虚拟内存决定数据什么时候能被碰到**（TLB、缺页、回收）。排查高并发系统的延迟与吞吐问题，先把「是不是这一层的事」分清——很多软件层的优化，其实是在补偿一次错误的调度或一次缺页。租约、超时与故障切换这类分布式机制的时延，最终也兑现在这层，见[可靠性设计](../practice/reliability.md)。

## 本章来源

- 系统调用与 futex 语义以 [Linux man-pages futex(2)](https://man7.org/linux/man-pages/man2/futex.2.html) 为准，调度策略与实时类约束以 [sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html) 为准
- 内核锁演进（Big Kernel Lock 拆除、seqlock、RCU）以 D. Bovet & M. Cesati, *Understanding the Linux Kernel*（O'Reilly）为参考
- 虚拟内存、缺页与 OOM 以 M. Gorman, *Understanding the Linux Virtual Memory Manager*（O'Reilly, 2004）为参考
- 两级调度的运行时实现以 [OpenJDK JEP 444（Virtual Threads）](https://openjdk.org/jeps/444)与 Go 官方 FAQ 的 goroutine 一节（[go.dev](https://go.dev/doc/faq#goroutines)）为准
- 本页对应 README 规划目录第 4 章「操作系统与并发」，此前全仓空缺，是[权威书籍调研](../research/books.md)之外自加的一页
