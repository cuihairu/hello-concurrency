# 并发框架与工具

README 规划目录第 8 章列了五样：Java 并发包、Akka、Netty、Go 并发工具、Python 并发库。本仓的写法是**不重复讲 API**——每个框架的原理都已在对应页讲透，这一页做的是地图：五个生态各自「给了什么、没给什么、去哪页深读」。选框架的决策方法在[并发框架选型](./framework-selection.md)，这里只讲工具本身。

## 五个生态的责任边界

| 生态 | 代表工具 | 给你的 | 不给你的 |
|------|----------|--------|----------|
| **Java** | `java.util.concurrent`、虚拟线程 | 全套原语与容器：池、队列、锁、原子类、并发容器 | 调度策略（虚拟线程例外，见下） |
| **JVM 上的 Actor** | Akka（Typed） | 实体化的 Actor、监督树、位置透明的消息 | 共享内存的逃生口（设计上不给） |
| **网络层** | Netty | Reactor 事件循环、编解码管道、零拷贝缓冲 | 业务线程池（必须自己下沉） |
| **Go** | goroutine、channel、`context` | 语言内置的并发原语，无第三方依赖 | 超时/取消的统一对象（要靠 context 传递纪律） |
| **Python** | `asyncio`、`concurrent.futures`、`multiprocessing` | 事件循环与任务组合、进程池绕过 GIL | 真并行的多线程（GIL 之下没有，见[语言页](../advanced/languages.md)） |

## Java：从并发包到虚拟线程

`java.util.concurrent` 是五个生态里最完整的**库**：线程池（[thread-pool](./thread-pool.md)）、并发容器与原子类（[data-structures](../advanced/data-structures.md)）、锁与同步原语（[locks](../sync/locks.md)、[semaphores](../sync/semaphores.md)、[barriers](../sync/barriers.md)）、任务组合（[async](./async.md)）都在包内。它的哲学是**只给原语，不给调度**——线程数、队列类型、拒绝策略全由你定，所以[参数组合](./thread-pool.md)才会是重头戏。

JEP 444 的虚拟线程改变了这个形状：线程变成廉价资源后，「池化线程」的心智负担消失，剩下的正确性问题还是原来的——[锁的语义](../sync/locks.md)、[有界资源](./producer-consumer.md)、[临界区纪律](../basics/critical-section.md)一条没少。虚拟线程砍掉的是「线程贵所以要省」这条假设，不是并发问题本身。

## Akka：把状态收进 Actor

Akka Typed 把[Actor 模型](../models/actor.md)做成框架：每个实体是一个 Actor（私有状态 + 邮箱），交互只走类型化消息，监督树负责「子 Actor 挂了谁来重启」。它给并发正确性提供的是**结构保证**——不共享状态就没有竞态，邮箱串行处理就没有交错。

代价同样明确：邮箱无界会拖垮进程（见 [actor 陷阱](../models/actor.md)），跨节点的消息是至少一次投递、业务必须幂等，故障切换与一致性要按[可靠性设计](./reliability.md)补。选 Akka 等于选择「用消息语义换掉共享内存的全部便利」。

## Netty：只做事件循环这一层

Netty 是[Reactor 模式](./reactor.md)的工业实现：boss 组 accept 连接、worker 组跑 EventLoop，每绑一个线程管一批 Channel，编解码走 pipeline。它把网络层的半包粘包、零拷贝、水位线背压都做掉了，但划了一条硬线——**EventLoop 里不许阻塞**。业务逻辑要么快速非阻塞，要么扔自己的业务线程池（EventLoop + BusinessExecutor 两池分离是 Netty 服务的标准形状）。

## Go：语言即框架

Go 没有第三方并发框架，因为不需要：goroutine 是廉价执行流、channel 是 CSP 通道、`select` 做多路等待、`context` 传导超时与取消。这套组合的表达力见 [CSP 页](../models/csp.md)与 [thread-pool 的 worker pool 一节](./thread-pool.md)。

它的空位也清楚：没有 Future 类型（结果用 channel 传，见[async 页](./async.md)的对照），没有结构化并发的强制约束（goroutine 泄漏只能靠纪律与 `go tool pprof` 抓），取消靠 context 逐层手动传递——漏传一层，下游就永远等不到。**Go 把并发做进了语言，也就把并发的纪律留给了人。**

## Python：三条路线各管一段

| 路线 | 用在哪 | 边界 |
|------|--------|------|
| `asyncio` | 高并发 I/O：网络、爬虫、网关 | 单线程事件循环，协程里不做 CPU 密集 |
| `multiprocessing` / `ProcessPoolExecutor` | CPU 密集计算 | 进程间传数据要序列化，启动有开销 |
| `concurrent.futures` | 两者的统一接口：`submit` + `Future` | 默认池大小要显式配 |

GIL 之下的多线程既不是真并行也不是纯开销——I/O 等待时会释放 GIL，所以「多线程做 I/O + 多进程做计算 + asyncio 做高并发」是标准三分法。free-threaded 构建（PEP 703）在改变第一条边界，进度见[语言页](../advanced/languages.md)。

## 工具速查

| 需求 | 首选工具 | 深读页 |
|------|----------|--------|
| 有界任务执行 | 线程池 / `TaskGroup` | [thread-pool](./thread-pool.md) |
| 有界队列与背压 | `ArrayBlockingQueue`、channel、Reactive Streams | [producer-consumer](./producer-consumer.md) |
| 并发容器 | `ConcurrentHashMap`、Go `sync.Map`（慎用） | [data-structures](../advanced/data-structures.md) |
| 竞态检测 | TSan / `-race`、jcstress | [security](../advanced/security.md) |
| 事件驱动网络 | Netty、asyncio、tokio | [reactor](./reactor.md) |
| 分布式协调 | etcd/ZooKeeper + fencing token | [reliability](./reliability.md) |

## 陷阱

| 陷阱 | 后果 | 修正 |
|------|------|------|
| 框架替代原理 | 换个框架又踩同一个坑（无界队列、阻塞回调） | 先懂[选型](./framework-selection.md)与各页陷阱表，再选工具 |
| 用 Akka 解决不该并发的问题 | 消息语义换来不必要的复杂度 | 简单问题用简单工具：线程池 > Actor |
| Netty 业务线程与 I/O 混池 | 一个慢业务拖垮全部连接 | EventLoop 与业务池分离 |
| Go 忘传 context | 下游任务永不超时，泄漏堆积 | context 作为首个参数的函数约定 |
| Python 协程里做 CPU 密集 | 事件循环卡死，全部请求排队 | 计算扔进程池 |
| 虚拟线程上池化线程池 | 双重调度，池反而成瓶颈 | 虚拟线程直接起，不再套池 |

## 本章小结

五个生态是五种「谁负责正确性」的答案：Java 把原语给你、把调度留给你；Akka 把状态与调度都收走、只留消息；Netty 只管事件循环、业务纪律归你；Go 把并发做进语言、把纪律留给你；Python 把并行交给进程、把异步交给事件循环。工具永远换不掉原理——[临界区](../basics/critical-section.md)、[有界缓冲](./producer-consumer.md)、[内存模型](../advanced/memory-model.md)三条在每个生态里都成立，这也是[框架选型](./framework-selection.md)从「会用哪个框架」转向「懂哪条原理」的原因。

## 本章来源

- Java 并发包语义以 [JDK 21 API 文档](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/package-summary.html)为准，虚拟线程见 [JEP 444](https://openjdk.org/jeps/444)
- Akka Typed 的监督与消息语义见 [Akka 官方文档](https://doc.akka.io/docs/akka/current/typed/guide/index.html)；本仓[Actor 页](../models/actor.md)按《七周七并发模型》第 5 章核对过模型口径
- Netty 线程模型以 [Netty 官方文档](https://netty.io/wiki/user-guide-for-4.x.html)为准，结构细节见[Reactor 页](./reactor.md)（Schmidt 1995 论文为原始出处）
- Go 并发原语以 [Go 文档](https://go.dev/doc/)与 [context 包文档](https://pkg.go.dev/context)为准
- Python 三路线以 [asyncio 文档](https://docs.python.org/3/library/asyncio-task.html)、[concurrent.futures 文档](https://docs.python.org/3/library/concurrent.futures.html)与 [PEP 703](https://peps.python.org/pep-0703/) 为准
- 本页对应 README 规划目录第 8 章「高并发框架与工具」；写法是地图不是 API 手册（调研结论：API 手册易过期，原理与边界长青），各工具的原理出处在被链接的页面
