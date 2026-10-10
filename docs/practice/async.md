# 异步编程与 Future 模式

[Reactor 与事件驱动](./reactor.md)讲的是底层的事件分发结构，本页讲建在它之上的编程模型：怎么表达「结果稍后才有」（Future 模式）、怎么表达「变化发生时通知我」（Observer 与响应式流），以及两者如何收敛成今天的主流语法 async/await。核心问题是同一个：**把等待从线程里拿出来之后，代码怎么写**。

## Future 模式：结果是一个对象

Future 模式立即返回一个占位对象，真正的结果稍后填入。等待被从「线程挂起」换成「拿到占位符以后再取」：

| 形态 | 等待方式 | 代表 |
|------|---------|------|
| 阻塞取结果 | `future.get()` 挂起当前线程 | Java `Future`、C++ `std::future` |
| 回调注册 | 结果就绪时调用回调 | Node.js 回调、Guava `ListenableFuture` |
| 组合子 | `thenApply`/`thenCompose` 链式变换 | Java `CompletableFuture`、JS `Promise` |
| async/await | 挂起点显式标注，编译成状态机 | JS、C#、Rust、Kotlin 协程 |

关键区别在**组合**：`CompletableFuture`/`Promise` 的链式与 `all`/`any` 组合能表达任务间的数据依赖，而阻塞式 `get()` 只能把异步写回同步——每个阶段排干等待，并行度被写法吃掉。

**异常、取消与超时也要沿链传播**：Java 用 `exceptionally`/`whenComplete`，JS 用 `.catch`，Go 的对应物是 `context.Context`（取消与超时贯穿整个调用链），Kotlin 协程取消沿结构化作用域传导。只传值不传取消，泄漏与悬挂任务是必然结果。

**结构化并发**是这条线的收敛点：并发的任务必须活在某个作用域内，作用域退出前等所有子任务结束，异常自动向上冒泡——Trio 的 Nursery、Kotlin 的 `coroutineScope`、OpenJDK 的结构化并发（[JEP 453](https://openjdk.org/jeps/453) 起预览）。

## Observer 模式与响应式流

Observer 把「数据变了」做成推送：被观察者维护订阅者列表，变化发生时通知。它与事件驱动同源，区别在粒度——事件驱动推送的是就绪信号，响应式流推送的是**数据流本身**。

裸 Observer 的问题是被观察者不知道订阅者多快，快生产慢消费时缓冲无限涨。**Reactive Streams** 规范（[reactive-streams.org](https://www.reactive-streams.org/)）用 `request(n)` 把速率决定权交还订阅者，四条规矩：非阻塞背压、有界缓冲、`request(n)` 拉取、错误终止传播。实现有 RxJava、Project Reactor、Kotlin Flow、Akka Streams。

这与[生产者-消费者](./producer-consumer.md)的背压策略是同一个问题的两种解法：有界队列阻塞是线程世界的答案，`request(n)` 是流世界的答案。

## 异步编程模型对照

| 模型 | 控制流 | 适用 |
|------|--------|------|
| 回调 | 函数嵌套，就绪即调 | 单层简单逻辑（嵌套即回调地狱） |
| Future/Promise | 单个结果的占位与组合 | 一次请求-响应、有限并行 |
| 响应式流 | 数据流的推送 + 背压 | 流式处理、端到端背压 |
| 协程 async/await | 顺序代码，挂起点显式 | 大多数业务逻辑的默认选择 |
| CSP / goroutine | 通信即同步，阻塞式写法 | 管道式流水线（见[CSP 模型](../models/csp.md)） |

**async/await 不是免费的**：它把函数编译成状态机，挂起点之间仍占用执行线程——协程里做 CPU 密集会饿死整个事件循环，与[Reactor 的 Handler 阻塞](./reactor.md)是同一个坑的两种形态。协程的调度成本、事件循环的载体线程都落在内核调度上，见[操作系统与并发](../advanced/os.md)。

## 与其他页的关系

| 问题 | 去哪页 |
|------|--------|
| 事件循环与多路复用的底层结构 | [Reactor 与事件驱动](./reactor.md) |
| 背压的线程世界解法（有界队列、水位线） | [生产者-消费者](./producer-consumer.md) |
| 耗时任务的归宿（业务线程池） | [线程池设计](./thread-pool.md) |
| 阻塞式等待的原语 | [条件变量](../sync/condition-variables.md) |
| goroutine 与 channel 的语义 | [CSP 模型](../models/csp.md) |

## 陷阱

| 陷阱 | 后果 | 修正 |
|------|------|------|
| 异步链里逐段 `get()` 等待 | 并行任务被串行化，比同步版还慢 | 用组合子/await 串起依赖，不逐段阻塞 |
| Future 里的异常无人接 | 吞掉失败或线程池里静默丢失 | `exceptionally`/`catch` 显式收口，结构化作用域自动冒泡 |
| 响应式流不设背压 | 快生产慢消费，缓冲无限涨到 OOM | `request(n)` 或有界缓冲，端到端拉取 |
| 取消不传播 | 任务取消后下游还在算，资源泄漏 | Go 传 context、协程用结构化作用域 |
| 协程里做 CPU 密集 | 事件循环饿死，全部请求延迟飙升 | 下沉计算线程池（同 Reactor Handler 约束） |

## 本章小结

异步编程的演化是一条「表达力收敛」的线：回调能表达但难组合，Future 解决单结果组合但取消与作用域缺失，响应式流补上背压但 API 重，async/await 把它收回成顺序代码、由结构化并发兜住作用域。落地只需抓住三点：**组合而非等待**、**取消要贯穿全链**、**协程里不做重活**。

## 本章来源

- Future 模式的 Java 落点见 `java.util.concurrent.Future`/`CompletableFuture` 的 [OpenJDK API 文档](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CompletableFuture.html)
- 背压与非阻塞规范以 [Reactive Streams 规范](https://www.reactive-streams.org/)为准
- 结构化并发以 [JEP 453](https://openjdk.org/jeps/453)（JDK 21 预览）为准，取消传播以 [Go context 包文档](https://pkg.go.dev/context)与 [Kotlin 协程指南](https://kotlinlang.org/docs/coroutines-guide.html)为参考
- 本页对应 README 规划目录 6.3（Future 模式）、6.4（Observer 模式）与 7.1（异步编程模型），是[权威书籍调研](../research/books.md)之外自加的一页
