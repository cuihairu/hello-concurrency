# 编程语言与并发支持

并发原语在不同语言里的形态差别很大：有的把调度下沉进运行时（Go），有的只给库、其余自理（C++），有的背着历史包袱前行（Python 的 GIL）。本页做横向对照，各语言的内存语义深挖见[内存模型](./memory-model.md)，框架层选型见[并发框架选型](../practice/framework-selection.md)。

## 对照总表

| 语言 | 并发单元 | 同步手段 | 调度者 | 内存模型 |
|------|---------|---------|--------|---------|
| Java | 平台线程、虚拟线程 | synchronized、AQS 系（ReentrantLock 等）、并发包 | 平台线程=内核线程；虚拟线程由 Loom 调度 | JMM（happens-before） |
| C++ | `std::thread` / `jthread` | `mutex`、`atomic`、`condition_variable` | 无运行时，线程 1:1 内核线程 | C++ 内存序（弱序可选） |
| Go | goroutine | `sync` 包、channel | runtime M:N 调度，工作窃取 | DRF-SC（Go Memory Model） |
| Python | 线程、协程、进程 | `threading`、`asyncio.Lock` | GIL 单解释器锁；协程在事件循环上 | 原子性主要靠 GIL，无正式内存模型 |

## Java：平台线程之外多出虚拟线程

`java.util.concurrent` 是四个语言里最完整的标准并发库：AQS 抽象出锁与同步器的骨架，线程池、并发容器、原子类覆盖了本仓实战篇的大部分页面（见[线程池设计](../practice/thread-pool.md)、[并发数据结构](./data-structures.md)）。

- **平台线程**：与内核线程 1:1，数量受内核调度与栈内存约束
- **虚拟线程**（[JEP 444](https://openjdk.org/jeps/444)，JDK 21 转正）：阻塞点 mount/unmount，百万级并发单元；适合 IO 密集，**不加速 CPU 密集**——载体线程数仍由核数决定
- 内存语义由 JMM 规定，见[内存模型](./memory-model.md)与[规范核对底稿](../research/memory-model-specs.md)

## C++：库语言，没有运行时

C++ 把并发全交给标准库与程序员：`std::thread` 1:1 映射内核线程，C++20 的 `jthread` + `stop_token` 补上结构化取消。

- `std::atomic` 的 `memory_order` 直接对应硬件屏障指令，弱序模型下的每个选择都要自己负责（见[硬件与内存层次](./hardware.md)的屏障一节）
- 没有自带调度器，线程池要么用 TBB 之类的库，要么自建（见[线程池设计](../practice/thread-pool.md)）
- 内存回收也无人代劳，无锁结构必须自己处理（Hazard Pointer、EBR、RCU，见[无锁编程](./lockfree.md)）

代价与自由对等：性能与行为最可控，出错的后果也最重（数据竞争在 C++ 里是未定义行为）。

## Go：把调度器做成语言的一部分

- **goroutine**：M:N 调度，栈动态增长，创建成本微秒级；`GOMAXPROCS` 决定真并行度
- **channel 是一等公民**：CSP 语义内建于语言（见[CSP 模型](../models/csp.md)），`sync` 包补充互斥、原子、WaitGroup
- **容器感知**：Go 1.25 起 `GOMAXPROCS` 默认读 cgroup CPU 限额，此前容器里并行度会错配宿主核数（见[操作系统与并发](./os.md)）
- 数据竞争时 DRF-SC 保证失效、实现可终止进程，`-race` 是开发期标配

## Python：GIL、协程与多进程

- **GIL**：CPython 用一把解释器级互斥锁串行化字节码执行——CPU 密集的多线程**不并行**，IO 密集的多线程仍有价值
- **asyncio**：单线程事件循环 + 协程，协作式让出，本质就是 [Reactor 模式](../practice/reactor.md)的 Python 形态；高连接数 IO 服务的首选
- **multiprocessing / 进程池**：绕开 GIL，代价是进程间通信与序列化开销
- **free-threaded 构建**：[PEP 703](https://peps.python.org/pep-0703/) 的无 GIL 解释器自 CPython 3.13 起以实验性可选构建发布，默认构建仍带 GIL

## 选型建议

| 场景 | 首选 | 理由 |
|------|------|------|
| CPU 密集并行 | C++ / Java 线程池，Python 用多进程或 free-threaded | Python 默认 GIL 下多线程无效 |
| 海量 IO 连接 | Go goroutine、Java 虚拟线程、Python asyncio、C++ 配 Reactor | 都是把等待摊平的结构 |
| 极低延迟尾延迟 | C++（无 GC、无运行时），Java 配低停顿 GC | 少一层不可控的暂停 |
| 生态与交付速度 | Java / Go | 标准库并发件齐、排查工具成熟 |

## 与本仓其他页的关系

| 问题 | 去哪页 |
|------|--------|
| happens-before 与四语言数据竞争后果 | [内存模型](./memory-model.md) |
| 线程模型与上下文切换成本 | [线程与进程](../basics/thread-process.md) |
| 框架（Netty/Akka/TBB/asyncio）层选型 | [并发框架选型](../practice/framework-selection.md) |
| goroutine 与 channel 的语义 | [CSP 模型](../models/csp.md) |

## 陷阱

| 陷阱 | 后果 | 修正 |
|------|------|------|
| Python 多线程跑 CPU 密集 | GIL 串行化，核数加满也不并行 | multiprocessing、NumPy/扩展释放 GIL，或 free-threaded 构建 |
| 把虚拟线程当 CPU 并行用 | 载体线程数仍≈核数，计算不提速 | CPU 密集拆任务扔 ForkJoinPool，虚拟线程只管 IO |
| C++ 乱调 memory_order | 省屏障换来弱序 bug，且只在弱序硬件暴露 | 先 seq_cst 保证正确，再按压测逐级放宽（见[内存模型](./memory-model.md)） |
| Go 容器里按宿主机核数估并行度 | Go 1.25 前 GOMAXPROCS 默认取宿主核数，超额调度 | 版本升级或显式设 GOMAXPROCS，配合 cgroup 限额核对（见[操作系统与并发](./os.md)） |

## 本章小结

四个语言是四种「谁来负责」的答案：**Java 把库做到最大**（并发包 + Loom），**C++ 把控制权留得最全**（标准库只给原语），**Go 把调度做进运行时**（goroutine + channel），**Python 把并行交给进程与事件循环**（GIL 之下 asyncio 当家）。选语言就是选责任边界——先看清并发单元的成本与调度者是谁，再决定把正确性交给语言还是留给自己。

## 本章来源

- Java 内存语义以 [JLS SE21 §17](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html) 为准，虚拟线程以 [JEP 444](https://openjdk.org/jeps/444) 为准
- C++ 内存序以 [C++ 工作草案](https://eel.is/c++draft/intro.races)为准
- Go 并发语义以 [The Go Memory Model](https://go.dev/ref/mem) 为准，容器感知 GOMAXPROCS 以 [Go 1.25 发布说明](https://go.dev/doc/go1.25)为准
- Python GIL 以 [CPython 官方文档](https://docs.python.org/3/glossary.html#term-GIL)为准，无 GIL 构建以 [PEP 703](https://peps.python.org/pep-0703/) 为准
- 本页对应 README 规划目录第 5 章「编程语言与并发支持」，是[权威书籍调研](../research/books.md)之外自加的一页
