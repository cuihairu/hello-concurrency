# 七周实战路线

README 规划目录第 12 章安排「每周一个实战案例」。本仓是知识库而非代码仓库，所以这一页把七周的路线钉在已有章节上：**每周给出目标、要读的页、要做的练习与验收标准**——练习在你自己的工程里做，本页负责不让你漏掉关键环节。原书《[七周七并发模型](../research/books.md)》的章节映射已在 books 页核对过，本页是工程化改写。

## 总纲：七周的形状

| 周 | 主题 | 落点页 | 产出 |
|----|------|--------|------|
| 1 | Java 并发 | [线程池](./thread-pool.md)、[并发数据结构](../advanced/data-structures.md) | 有界线程池 + 原子复合的计数服务 |
| 2 | C++ 并发 | [内存模型](../advanced/memory-model.md)、[无锁编程](../advanced/lockfree.md) | 无锁队列 + 内存序标注 |
| 3 | Go 并发 | [CSP](../models/csp.md)、[生产者-消费者](./producer-consumer.md) | 有背压的流水线 |
| 4 | Python 并发 | [编程语言与并发支持](../advanced/languages.md)、[Reactor](./reactor.md) | asyncio 网关 + 多进程计算池 |
| 5 | Actor（Akka） | [Actor](../models/actor.md)、[框架选型](./framework-selection.md) | 聊天室 Actor 树 + 监督 |
| 6 | 事件驱动（Netty） | [Reactor](./reactor.md)、[异步编程](./async.md) | echo 服务器 + 编解码器 |
| 7 | 综合案例 | [可靠性设计](./reliability.md)、[性能调优](../advanced/performance.md) | 全链路：压测、故障演练、复盘 |

每周的公共纪律：**先写测试再谈并发**（含[并发安全](../advanced/security.md)一节的竞态检测工具），**每次只引入一个新概念**，**做完回跳[知识点总纲](../knowledge.md)对号入座**。

## 第 1 周：Java——把线程池用对

1. 读[线程池设计](./thread-pool.md)，在你的工程里把 `Executors` 工厂方法全部换成显式 `ThreadPoolExecutor`：有界队列、命名线程工厂、显式拒绝策略
2. 把所有 check-then-act 换成 `ConcurrentHashMap` 的原子复合方法（见[并发数据结构](../advanced/data-structures.md)）
3. 用 [jcstress](https://github.com/openjdk/jcstress) 写一个竞态复现测试：先让它失败（复现竞态），再让它通过（修复）

**验收**：压到 3 倍目标流量，队列打满时拒绝策略生效而非 OOM；jcstress 报告无竞争。

## 第 2 周：C++——与内存序搏斗

1. 读[内存模型](../advanced/memory-model.md)，把一个 `std::mutex` 保护的队列改成 Treiber 栈（[无锁编程](../advanced/lockfree.md)第一节），标注每处 `memory_order`
2. 先全用 `seq_cst` 跑通，再逐个放宽到 `acquire/release`，每放宽一处用 [Relacy](https://github.com/4shenAery/Relacy_Race_Editor) 或 TSan 验证
3. 故意把一处放宽成 `relaxed`，用测试或模型检查让它暴露——**见过失败，才算理解**

**验收**：TSan 干净；能口头解释每处内存序删掉会发生什么。

## 第 3 周：Go——流水线与背压

1. 读[CSP](../models/csp.md)与[生产者-消费者](./producer-consumer.md)，实现三阶段流水线（生成 → 处理 → 输出），用 `context` 贯穿取消
2. 给每段加水位线：队列深度超阈值时上游减速（阻塞发送即天然背压，先理解为什么 Go 不需要额外机制）
3. 用 `-race` 跑全量测试；故意 close 任务队列制造 panic，再改回「closed 标志 + context」的正确写法

**验收**：`-race` 干净；下游停止消费后，上游在有界时间内停下；Ctrl-C 优雅退出无泄漏。

## 第 4 周：Python——GIL 的边界

1. 读[编程语言与并发支持](../advanced/languages.md)的 Python 一节，同一段 CPU 密集任务分别用 threading、multiprocessing、C 扩展释放 GIL 三种写法跑，记录耗时——**亲眼看 GIL 的墙**
2. 用 asyncio 写一个小网关：并发转发 1000 个请求，超时与取消沿调用链传播（对照[异步编程](./async.md)的取消一节）
3. 在回调地狱与 `async/await` 两种写法间来回改一遍，体会「异步化代价」指的是什么

**验收**：多线程版本不加速 CPU 任务（除非释放 GIL）；网关在目标下游超时后 1 秒内释放全部连接。

## 第 5 周：Actor——状态收进邮箱

1. 读[Actor](../models/actor.md)，把一个共享可变状态的计数/账户系统改写成 Actor：每个实体一个 Actor，消息驱动
2. 实现监督树：让子 Actor 故意 panic，验证「重启而非传播」；给邮箱加上限，复现[坑清单](../knowledge.md)里的无界邮箱问题
3. 加跨 Actor 的请求-响应，明确超时与「至少一次」语义下业务要做的幂等

**验收**：注入 10% 消息丢失/重复，系统状态仍正确（幂等键生效）；单 Actor 崩溃不拖垮系统。

## 第 6 周：Netty——事件循环的纪律

1. 读[Reactor](./reactor.md)，用 Netty 写 echo 服务器：自定义编解码器处理粘包/半包，主从 Reactor 配置对齐核数
2. 在 Handler 里故意加一次阻塞的 DB 调用，用压测复现整条循环卡死；再把耗时操作下沉业务线程池，对比 p99
3. 配置写缓冲高低水位线，用慢消费者复现并修复写缓冲堆积

**验收**：10 万连接空载内存与 CPU 在预算内；任一 Handler 阻塞不再影响其他连接。

## 第 7 周：综合——把系统压到失效边缘

1. 用前六周任一技术栈实现一个小服务（建议：订单下单，含库存扣减与下游调用）
2. 按[性能调优](../advanced/performance.md)的压测五阶段执行：基线 → 拐点 → 目标负载长稳 → 故障演练（摘节点、断依赖、注入延迟）
3. 按[可靠性设计](./reliability.md)的陷阱表逐条自查：重试有没有幂等、锁有没有 token、备份有没有恢复演练
4. 写复盘：哪个瓶颈是猜错的、哪个降级真的触发了、哪条坑清单条目被你踩中了

**验收**：目标负载 4 小时无泄漏；断掉一个依赖后服务降级而非雪崩；一页复盘文档。

## 路线之外的两条建议

- **顺序不是强制的**：有 Go 经验就从第 3 周开始，把 Java/C++ 当对照读——[并发框架选型](./framework-selection.md)的四维权衡同样适用于选学习路线
- **每周都回跳总纲**：做完练习在[知识点总纲](../knowledge.md)里找到对应条目，把「做过」补进你自己的笔记——七周后你得到的不只是代码，还有一张对过号的网

## 本章来源

- 周次结构参照 P. Butcher, *Seven Concurrency Models in Seven Weeks*（PragProg, 2014）的七章安排，逐章与本仓的映射见[权威书籍调研](../research/books.md)
- 各周工具入口（jcstress、TSan、Relacy、`-race`）以各自官方文档为准，链接在正文各节
- 验收标准是本仓按各页陷阱清单反推的工程口径（调研结论），非原书内容
- 本页对应 README 规划目录第 12 章「七周并发实战」；本仓为知识库不附代码仓库，练习在读者侧完成
