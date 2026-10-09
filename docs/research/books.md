# 权威书籍调研

四本书撑起这本书的骨架：三本是指定的《Java 并发编程实战》《C++ Concurrency in Action》《The Rustonomicon》，第四本是 README 里点名要参考的《七周七并发模型》。下面按「版本 → 结构 → 对本仓的用法」逐本核对。

## Java Concurrency in Practice

| 项 | 值 |
|----|----|
| 原版 | Java Concurrency in Practice，Brian Goetz、Tim Peierls、Joshua Bloch、Joseph Bowbeer、David Holmes、Doug Lea 著，Addison-Wesley |
| 官方书站 | <https://jcip.net/>（目录、示例代码 source jar、并发注解 jar、勘误） |
| 中文版 | 《Java并发编程实战》，童云兰译，机械工业出版社 2012-2，ISBN 9787111370048，293 页 |

结构上这本书按「线程安全性 → 对象共享 → 对象组合 → 基础构建模块 → 任务执行 → 取消与关闭 → 构建并发应用」推进，落点是 `java.util.concurrent` 的正确用法：线程池参数、阻塞队列、同步容器与并发容器、原子变量类、`@ThreadSafe`/`@GuardedBy` 这类标注。

对本仓的用法：`practice/thread-pool.md` 的参数组合陷阱对应它的任务执行与线程池章节，`advanced/data-structures.md` 的并发容器与原子变量对应基础构建模块章，`practice/producer-consumer.md` 的阻塞队列一节同源。书站上 Intel 研究员 Doron Rajwan 的推荐语「For the past 30 years, computer performance has been driven by Moore's Law; from now on, it will be driven by Amdahl's Law」被引到[并发基础概念](/basics/concepts)的并行收益一节，当作 Amdahl 定律在并发书里的出处。

## C++ Concurrency in Action

| 项 | 值 |
|----|----|
| 原版 | C++ Concurrency in Action, Second Edition，Anthony Williams 著，Manning |
| 出版信息 | 2019-02，ISBN 9781617294693，592 页（Manning 页面所载） |
| 中文版 | 《C++并发编程实战（第2版）》，吴天明译，人民邮电出版社·异步图书 2021-11，ISBN 9787115573551，393 页 |
| 书页 | <https://www.manning.com/books/c-plus-plus-concurrency-in-action-second-edition> |

章节骨架是：并发初体验 → 内存模型 → 线程管理 → 共享数据 → 同步操作 → 基于锁的数据结构 → 无锁数据结构 → 无锁设计与内存序 → 并发代码设计。书中把内存序放在无锁设计之前讲，这个顺序值得抄：先讲清楚 `memory_order` 与硬件的关系，再谈 Treiber 栈、Michael-Scott 队列这类算法才有依据。

对本仓的用法：`advanced/memory-model.md` 的 `memory_order` 表、`advanced/lockfree.md` 的 CAS 与内存回收、`sync/locks.md` 的 `std::lock` 同时获取多把锁，都能在书里找到对应章节。第 2 版元数据以 Manning 页面为准，中文版元数据以版权页为准，两边页数不同是因为中英文排版与开本不同，不是两本书。

## The Rustonomicon

| 项 | 值 |
|----|------|
| 定位 | Rust 官方文档体系里的 unsafe 进阶读物，副标题 The Dark Arts of Unsafe Rust |
| 地址 | <https://doc.rust-lang.org/nomicon/> |
| 状态 | 首页自带「This book is incomplete」的警告与 issue 列表 |

它不是并发专著，但 Rust 内存模型里最要命的部分都在这：别名规则、`Send`/`Sync` 的契约、`&T` 与内部可变性、跨线程裸指针的合法边界。配合 Rust Reference 的 UB 清单读才有用：Reference 列规矩，Rustonomicon 讲这些规矩为什么长这样。

对本仓的用法：`sync/locks.md` 的「Rust 所有权与锁」一节、`advanced/memory-model.md` 的 Rust 一列，都以它和 [std::sync::atomic](https://doc.rust-lang.org/std/sync/atomic/index.html) 为准。原文核对结论在[官方内存模型规范](./memory-model-specs)。

## 七周七并发模型

| 项 | 英文原版 | 中文版 |
|----|----------|--------|
| 作者 | Paul Butcher | 同 |
| 出版 | PragProg，2014-07，ISBN 9781937785659，296 页 | 人民邮电出版社 2015-3，黄炎译，ISBN 9787115386069，244 页 |
| 书页 | <https://pragprog.com/titles/pb7con/seven-concurrency-models-in-seven-weeks/> | [豆瓣条目](https://book.douban.com/subject/26337939/)、[中文版目录](https://baike.so.com/doc/25698266-26784455.html) |

七个模型的中英文对照，按中文版第 2–8 章排：

| 章 | 中文 | 原文 | 本仓状态 |
|----|------|------|----------|
| 2 | 线程与锁 | Threads and Locks | 基础篇与同步原语六页已覆盖 |
| 3 | 函数式编程 | Functional Programming | [函数式并发](/models/functional) 已覆盖（G1 已补） |
| 4 | Clojure 之道：分离标识与状态 | The Clojure Way: Separating Identity from State | [STM 与 Clojure 之道](/models/stm) 已覆盖：事务部分加 atom/agent/持久化数据结构（G4 已补） |
| 5 | Actor | Actors | [Actor 模型](/models/actor) 已覆盖 |
| 6 | 通信顺序进程 | Communicating Sequential Processes | [CSP 模型](/models/csp) 已覆盖 |
| 7 | 数据并行 | Data Parallelism（GPGPU/OpenCL） | [数据并行](/models/data-parallel) 已覆盖（G2 已补） |
| 8 | Lambda 架构 | Lambda Architecture（MapReduce/批处理层/速度层） | [Lambda 架构](/models/lambda-architecture) 已覆盖（G3 已补） |

两点值得写下来。第一，中文版目录把第 3 章的第三天写成「函数式并发」，原版对应的是 Day 3 Dataflow Programming with Futures and Promises，也就是说数据流在书里是函数式章的第三天，不是独立的一章；本仓的 [数据流模型](/models/dataflow) 是自加的一页，跟这本书的七模型清单对不齐，核对时按这个口径处理。第二，第 4 章的 STM 只是「分离标识与状态」的一部分，atom 与持久化数据结构才是那章的主体；`stm.md` 已补「Clojure 之道」一节，第 4 章按已覆盖计。

## 本仓怎么用这几本

写页面时的引用口径：概念定义与陷阱清单参考书，能落到规范条文的（数据竞争后果、内存序语义）以规范原文为准，书与规范冲突时按规范写并在页面注明来源。四本书只提供结构和解释，示例代码一律现写，不抄书。
