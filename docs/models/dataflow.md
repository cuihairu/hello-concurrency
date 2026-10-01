# 数据流模型

数据流模型将计算建模为**有向无环图 (DAG)**：节点为算子，边为数据依赖。数据驱动执行——**输入就绪即触发计算**，天然并行、无锁、确定性。

## 核心概念

### 数据流图
```
Source → Map → Filter → Reduce → Sink
              ↘
               → Branch → Join
```

| 元素 | 含义 |
|------|------|
| **节点** | 无副作用纯函数 / 有状态算子 |
| **边** | 数据通道，传递不可变消息 |
| **Token** | 流经边的数据单元 |
| **Firing Rule** | 节点触发条件：所有输入有 token |

### 执行语义
- **静态数据流**：编译期确定拓扑，每节点固定触发规则
- **动态数据流**：运行时构建图，支持数据依赖控制流 (if/while)

### 关键性质
| 性质 | 说明 |
|------|------|
| **确定性** | 相同输入 → 相同输出，与调度无关 |
| **无锁** | 无共享可变状态，Token 单向流动 |
| **天然并行** | 无依赖节点可任意并发 |
| **背压传导** | 下游慢 → 缓冲满 → 上游阻塞 |

## 经典模型对比

| 模型 | 代表系统 | 特点 |
|------|----------|------|
| **Kahn Process Networks (KPN)** | 理论基石 | 无限缓冲、阻塞读、确定性 |
| **Synchronous Dataflow (SDF)** | 信号处理、Ptolemy | 固定产消速率、编译期调度 |
| **Boolean Dataflow** | 硬件综合 | Token 带布尔标签、条件触发 |
| **Dynamic Dataflow** | TensorFlow、Flink | 运行时图构建、控制流算子 |
| **Reactive Streams** | RxJava、Project Reactor | 背压标准、组合式 API |

## 编程模式

### 1. 声明式流构建
```java
// Java Stream / Reactor Flux
Flux.range(1, 100)
    .parallel()
    .runOn(Schedulers.parallel())
    .map(x -> expensive(x))
    .filter(x -> x % 2 == 0)
    .reduce(0, Integer::sum)
    .subscribe(System.out::println);
```

```go
// Go 生成器模式
func gen(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        for _, n := range nums { out <- n }
        close(out)
    }()
    return out
}
func sq(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        for n := range in { out <- n * n }
        close(out)
    }()
    return out
}
// 管道组合
for n := range sq(sq(gen(2, 3))) { fmt.Println(n) }  // 16, 81
```

### 2. 有状态算子
```java
// 窗口聚合
stream
    .keyBy(Event::getUserId)
    .window(TumblingEventTimeWindows.of(Time.minutes(5)))
    .reduce((a, b) -> a.add(b))
    .addSink(...);
```

```python
# Faust (Python 流处理)
class PageView(faust.Record):
    url: str
    user: str

page_views = app.topic('page_views', value_type=PageView)

@app.agent(page_views)
async def count_views(stream):
    async for view in stream.group_by(PageView.url):
        count = view.url.count()  # 状态存储在 RocksDB
        await count_sink.send(key=view.url, value=count)
```

### 3. 迭代/循环 (动态数据流)
```python
# TensorFlow 控制流
i = tf.constant(0)
c = lambda i: tf.less(i, 10)
b = lambda i: tf.add(i, 1)
r = tf.while_loop(c, b, [i])  # 图中嵌入循环
```

```java
// Flink 迭代
DataSet<Vertex> vertices = ...
DataSet<Edge> edges = ...

IterativeDataSet<Vertex> iteration = vertices.iterate(maxIterations);
DataSet<Vertex> newVertices = iteration
    .join(edges).where("id").equalTo("src")
    .map(...);
iteration.closeWith(newVertices);
```

## 背压机制

### Reactive Streams 规范 (JDK 9+ Flow API)
```
Publisher → Subscription → Subscriber
                ↓
          request(n)  ← 背压信号
          onNext(t)   → 数据流动
          onComplete / onError
```

### 实现策略
| 策略 | 优点 | 缺点 |
|------|------|------|
| **无界缓冲** | 简单 | OOM 风险 |
| **有界缓冲 + 阻塞** | 自然背压 | 可能死锁 |
| **显式 request(n)** | 精确控制 | API 复杂 |
| **丢弃/采样** | 保护下游 | 数据丢失 |
| **响应式拉取** | 端到端背压 | 实现复杂 |

## 主流框架对比

| 框架 | 语言 | 模型 | 适用场景 |
|------|------|------|----------|
| **Apache Flink** | Java/Scala | 动态数据流、事件时间、Exactly-once | 实时流处理、CEP、有状态计算 |
| **Apache Spark Structured Streaming** | Scala/Python | 微批 + 数据流 | 统一批流、ETL、机器学习管线 |
| **Kafka Streams** | Java | KTable/KStream、本地状态 | 轻量级流处理、嵌入式 |
| **Akka Streams** | Scala/Java | 响应式流、图形化 DSL | Actor 系统内流处理 |
| **RxJava / Reactor** | Java/Kotlin | 组合式 Observable/Flowable | 客户端响应式、API 网关 |
| **Project Reactive Streams** | 多语言 | SPI 规范 | 库互操作 |
| **TensorFlow / PyTorch** | Python/C++ | 静态/动态图、自动微分 | 深度学习训练推理 |
| **Apache Beam** | Java/Python/Go | 统一批流模型、多 Runner | 可移植管线 |
| **Bytewax / Faust** | Python | 数据流、状态管理 | Python 生态流处理 |

## 图调度与优化

### 编译期优化 (静态图)
- **算子融合**：消除中间缓冲、减少调度开销
- **常量折叠**：编译期计算常量表达式
- **死代码消除**：移除无输出路径
- **内存规划**：Tensor 生命周期分析、内存复用

### 运行时调度 (动态图)
- **任务图**：DAG → Task DAG → 物理执行图
- **资源感知**：数据本地性、异构调度 (CPU/GPU)
- **投机执行**：慢任务备份
- **容错**：Checkpoint + 血统重放 / 状态后端

## 适用性判断

| 适合 | 不适合 |
|------|--------|
| ETL 管线、特征工程 | 复杂事务、强一致性业务 |
| 实时分析、CEP、监控告警 | 低延迟 RPC、请求-响应 |
| 机器学习管线、模型服务 | 简单 CRUD、单机并发 |
| 流式连接、窗口聚合 | 随机访问、点查询 |

## 反模式

| 反模式 | 后果 | 修正 |
|--------|------|------|
| 算子内副作用 (写 DB、发 HTTP) | 非确定性、重复执行 | Sink 算子隔离、幂等设计 |
| 巨大状态无分区 | 单点热点、扩展受限 | KeyBy 分区、RocksDB 状态后端 |
| 忽略水印/事件时间 | 乱序数据结果错误 | 事件时间 + 水印 + 允许迟到 |
| 无背压保护 | 级联 OOM、雪崩 | 显式 request、限流、缓冲上限 |
| 过早优化融合 | 调试困难、序列化瓶颈 | 先正确、再融合、监控指标 |

## 本章小结

数据流模型以 **DAG + Token 驱动** 统一了批/流、CPU/GPU、单机/分布式。核心优势：
- **声明式**：描述「是什么」而非「怎么做」
- **可组合**：算子即乐高，管线即图
- **可优化**：编译器/运行时全局视角优化
- **可容错**：血统/检查点天然支持 Exactly-once

工程选型：**Flink (重状态流)、Spark (批流一体)、Kafka Streams (轻量嵌入)、Beam (可移植)、TensorFlow/PyTorch (ML)**。下一章讲解 STM——软件事务内存，为共享内存并发带来数据库级 ACID。