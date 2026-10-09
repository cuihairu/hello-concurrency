# 函数式并发

函数式并发是《七周七并发模型》第 3 章的主题（中文版章名「函数式编程」，第三天「函数式并发」对应原版 Day 3 Dataflow Programming with Futures and Promises）。核心主张：**可变性是并发问题的根源，先消掉它，锁就没必要存在**。

## 为什么不可变性能解决并发

共享可变状态引发数据竞争，需要 happens-before 关系保证可见性（见[内存模型](../advanced/memory-model.md)）。函数式编程从源头拆掉这个前提：

| 函数式性质 | 并发含义 |
|-----------|----------|
| **不可变性** | 数据创建后不改，多线程随便读，无竞争 |
| **纯函数** | 不碰外部状态，输出只由输入决定，任意并行 |
| **引用透明** | 表达式随时可替换为其值，执行顺序无关紧要 |
| **高阶函数** | map/filter/reduce 把「做什么」与「怎么并行」分离 |

并发控制从「小心安排每一步」变成「根本没有共享的写」，这正是与[线程与锁](../basics/concepts.md)路线的本质分野。

## 不可变数据结构

每次「修改」返回新值，旧值继续可用：

```clojure
(def list-1 '(1 2 3))
(def list-2 (conj list-1 4))   ; (4 1 2 3)，list-1 不变
; 两个列表共享同一份尾部节点，不是深拷贝
```

工程要点是**结构共享**：新版本与旧版本共享未改动部分，写操作接近 O(log n) 而非 O(n)。Clojure 的持久化 Vector（32 叉树）与 Haskell 的纯函数式数据结构都走这条路，第 4 章把它推进为完整的状态管理方案，见 [STM 与 Clojure 之道](./stm.md#clojure-之道分离标识与状态)。

## 函数式并行化

### 并行 map

```clojure
; pmap：每个元素一个任务，线程池执行
(def imgs (pmap process-image image-urls))
```

每个元素的处理互相独立（纯函数保证），调度器不用担心谁改了谁的数据。

### 并行 reduce（fold）

```clojure
(require '[clojure.core.reducers :as r])
; fold：分块树形归约，块间并行、块内顺序
(def total (r/fold + (r/map :price orders)))
```

归约树天然适合多核：分块处理、部分结果合并，这是[数据并行](./data-parallel.md)思想在单机多核上的形态。

### 惰性序列

```clojure
(def big-seq (map heavy-compute (range 1e9)))  ; 立即返回，啥也没算
(realize (nth big-seq 100))                     ; 用到才算
```

求值时机与构造时机解耦，生产者消费者之间不需要显式同步——惰性本身就是一种并发缓冲。

## Future 与 Promise：数据流编程

书第 3 章第三天的内容：用 future 表示「将来才有的值」，promise 表示「只写一次的值」，数据依赖关系决定执行顺序。

```clojure
; future 立即返回，主线程不阻塞
(def prices  (future (fetch-prices)))
(def rates   (future (fetch-rates)))

; deref 在需要结果时等待，依赖关系显式可见
(def total (future (* @(fetch-prices) @rates)))

; promise：单次赋值，多读者等待
(def result (promise))
(future (deliver result (heavy-compute)))
; ...其他线程 @result 等待交付
```

future/promise 把控制流写成数据流图：每个 future 是一个节点，值依赖是边。这与本仓[数据流模型](./dataflow.md)是同一思想的两个层次——书里把数据流编程放在函数式章内讲，本仓单开一页展开。

## 与其他模型对比

| 维度 | 函数式并发 | 线程与锁 | Actor | CSP |
|------|-----------|---------|-------|-----|
| 共享状态 | 无（不可变） | 有，靠锁保护 | Actor 私有 | 通道传递 |
| 同步方式 | 无需（值就绪即可用） | 显式加锁 | 消息队列 | 通道会合 |
| 死锁可能 | 无 | 有 | 低（邮箱无环时） | 低 |
| 适用 | 计算密集、无副作用变换 | 底层控制、已有共享结构 | 有状态服务 | 流水线 |

## 适用性判断

| 适合 | 不适合 |
|------|--------|
| 转换密集：ETL、数值计算、集合变换 | 本质可变的状态机（引不可变值反而绕） |
| 读多写少，快照语义够用 | 需要就地更新的大缓冲（拷贝开销） |
| 多核并行处理独立元素 | 与现有可变 API 深度集成的代码 |

## 陷阱

| 陷阱 | 后果 | 修正 |
|------|------|------|
| 闭包捕获可变对象 | 「不可变」外壳包着可变内核，照样竞争 | 只捕获不可变值，可变处走 STM/Actor |
| pmap 粒度过细 | 任务派发开销吞掉并行收益 | 分块（partition 后再 pmap）或 fold |
| 惰性序列跨线程 realize | 首次求值在意外线程执行，竞争锁内资源 | 在生产侧 force，消费侧只读 |
| 假不可变 | Java 里 final 字段指向可变 List | 连内部状态一起不可变，或用持久化集合 |
| 把 future 当线程池用 | 无界提交，堆积 OOM | 显式定长 executor，见[线程池](../practice/thread-pool.md) |

## 本章小结

函数式并发用**消除可变性**替代**控制可变性**：纯函数与不可变数据让并行变成代码的自然属性，future/promise 把依赖关系写进数据流。它不解决「有状态服务怎么并发」——那正是 [Actor](./actor.md)、[CSP](./csp.md) 与 [STM](./stm.md) 的领地。四种高层模型按状态需求选型，不要互相替代。

## 本章来源

- 《七周七并发模型》第 3 章，版本信息与七天结构见[权威书籍调研](../research/books.md)；第三天标题以原版 Day 3 Dataflow Programming with Futures and Promises 为准，中文版目录写作「函数式并发」
- 示例代码现写（Clojure 1.11 语法），不抄书；`r/fold` 与 `pmap` 语义以 [clojure.org 参考文档](https://clojure.org/reference/reducers)为准
