# Actor 模型

Actor 模型由 Carl Hewitt 1973 年提出，是**面向并发的对象模型**：「一切皆 Actor」。Erlang、Akka、Orleans、Pulsar Functions 等系统的核心理论基石。

## 核心公理

> **Actor 是并发计算的基本单位，通过异步消息通信，拥有私有状态，通过创建新 Actor、发送消息、指定下一行为来响应消息。**

### 三大基本操作
1. **创建 Actor** → 获取引用
2. **发送消息** → 异步、非阻塞、尽力投递
3. **指定行为** → 接收消息时执行的逻辑，可改变状态、创建 Actor、发送消息

### 关键特性
| 特性 | 含义 |
|------|------|
| **封装性** | 状态私有，仅通过消息交互，无共享内存 |
| **异步性** | 发送即返回，不等待处理完成 |
| **位置透明** | 本地/远程 Actor 统一引用，网络透明 |
| **邮箱有序** | 单 Actor 消息顺序处理（FIFO） |
| **监管树** | 父 Actor 监管子 Actor，故障隔离与恢复 |

## Actor 生命周期

```
创建 → 运行 (处理消息) → 暂停/恢复 → 停止 → 终止
                ↓
          故障 → 重启/升级/停止 (由监管策略决定)
```

## 消息投递语义

| 语义 | 描述 | 典型实现 |
|------|------|----------|
| **至多一次** | 消息可能丢失，不重试 | UDP、火后不理 |
| **至少一次** | 消息不丢，可能重复 | ACK + 重试、幂等处理 |
| **精确一次** | 精确投递一次 | 事务性邮箱、幂等 + 去重 |

**工程现实**：分布式系统通常只能保证「至少一次」，需业务层幂等设计。

## 经典模式

### 1. 请求-响应
```scala
// Ask 模式：发送消息返回 Future
val future: Future[Response] = actor ? Request
future.onComplete { case Success(r) => ... }
```
**注意**：需设置超时，避免无限等待。

### 2. 转发/代理
```scala
def receive = {
  case msg => target.forward(msg)  // 保持原发送者引用
}
```

### 3. 聚合/散射-收集
```scala
def receive = {
  case Aggregate(keys) =>
    val futures = keys.map(key => worker ? Fetch(key))
    Future.sequence(futures).map(results => sender() ! Result(results))
}
```

### 4. 状态机
```scala
def idle: Receive = {
  case Start => context.become(active)
}
def active: Receive = {
  case Data(d) => update(d)
  case Stop => context.become(idle)
}
```

### 5. 监管策略
```scala
override val supervisorStrategy = OneForOneStrategy(maxNrOfRetries = 3) {
  case _: ArithmeticException => Resume      // 忽略错误继续
  case _: NullPointerException => Restart    // 重置状态重启
  case _: IllegalArgumentException => Stop   // 永久停止
  case _: Exception => Escalate              // 上报父级
}
```

## Actor 系统架构

### 层级结构
```
Guardian (/) 
  ├─ System Guardian (/system)  // 系统级 Actor
  └─ User Guardian (/user)      // 用户 Actor 根
       ├─ /user/service-a
       │    ├─ /user/service-a/worker-1
       │    └─ /user/service-a/worker-2
       └─ /user/service-b
```

### 地址与引用
- **ActorPath**：`akka://system@host:port/user/service-a/worker-1`
- **ActorRef**：可序列化、网络透明的引用，支持 `tell` / `ask`

## 分布式 Actor

### 位置透明
```scala
// 本地与远程统一 API
val local = system.actorOf(Props[Worker], "worker")
val remote = system.actorSelection("akka://remote@host:2552/user/worker")
remote ! Msg  // 网络透明
```

### 集群感知
- **分片**：`ClusterSharding` 自动均衡 Actor 分布
- **单例**：`ClusterSingleton` 保证全集群唯一
- **发布订阅**：`DistributedPubSub` 主题解耦

## 主流实现对比

| 框架 | 语言 | 特色 | 典型场景 |
|------|------|------|----------|
| **Erlang/OTP** | Erlang/Elixir | 原生轻量进程、热升级、九个九可用性 | 电信、即时通讯、金融 |
| **Akka** | Scala/Java | 完整生态、集群、流、HTTP、持久化 | 高并发服务、流处理 |
| **Akka.NET** | C#/.NET | .NET 原生移植 | 企业级 .NET 应用 |
| **Orleans** | C# | 虚拟 Actor、自动激活、持久化 | 云原生、游戏服务器 |
| **Proto.Actor** | Go/C#/Python/JS | 跨语言、轻量、无运行时依赖 | 微服务、边缘计算 |
| **Ractor** | Ruby 3+ | 语言原生、GVL 释放 | Ruby 并发 |
| **Pony** | Pony | 类型系统保证无数据竞争 | 高性能并发 |

## 性能特征

| 指标 | 典型值 | 影响因素 |
|------|--------|----------|
| Actor 创建 | ~微秒级 | 比线程轻 100-1000 倍 |
| 消息派发 | ~百纳秒 | 邮箱实现、调度器 |
| 单 Actor 吞吐 | ~百万 msg/s | 消息复杂度、状态大小 |
| 内存/ Actor | ~KB 级 | 邮箱、状态、栈 |

## 适用性判断

| 适合 | 不适合 |
|------|--------|
| 高并发、状态分散、消息驱动 | 紧密耦合共享状态、高频同步计算 |
| 需容错、自愈、热升级 | 简单并发、数据并行、数值计算 |
| 分布式、异构、长生命周期 | 单机、短生命周期、确定性同步 |

## 反模式与陷阱

| 反模式 | 后果 | 修正 |
|--------|------|------|
| 同步阻塞调用 (`Await.result`) | 线程饥饿、死锁 | 全异步、Future 组合 |
| 大消息传递 | 序列化开销、GC 压力 | 引用传递、共享存储、分块 |
| 无界邮箱 | OOM、背压失效 | 有界邮箱、流控、Pull 模式 |
| 业务逻辑在监管策略 | 耦合、难测 | 监管只管生命周期 |
| 忽略幂等 | 重复处理导致错误 | 幂等键、去重、事务性 |

## 现代演进

- **Virtual Actor (Orleans)**：无需显式创建/查找，运行时自动激活、分布、故障转移
- **Event Sourcing + CQRS**：Actor 持久化事件日志，状态重放、读写分离
- **Serverless Actor**：函数即 Actor，按需激活、自动伸缩 (CloudState、Wasmer)
- **类型安全 Actor**：TypeScript (Runtypes)、Rust (Actix)、Pony 编译期无竞争

## 本章小结

Actor 模型以**「共享内存即通信」→「通信即共享内存」**反转了并发范式。核心价值：
- **封装并发复杂性**：开发者关注单 Actor 逻辑
- **天然分布式**：位置透明、监管容错
- **弹性伸缩**：轻量 Actor 支持百万级并发

工程选型建议：**JVM 生态首选 Akka，.NET 首选 Orleans，跨语言/轻量首选 Proto.Actor，极致可用性选 Erlang/OTP**。下一章讲解 CSP 模型——通信顺序进程。Actor 的反面是数据并行：任务彼此独立、不需要长驻状态时，[函数式并发](./functional.md)与[数据并行](./data-parallel.md)的开销远低于建 actor 系统。