# 并发框架选型

并发框架选型是**架构决策**，而非库选择。需在**问题域、团队能力、运维成本、演进路径**四维权衡。本章提供决策地图与避坑指南。

## 选型决策矩阵

| 维度 | 关键问题 | 权重建议 |
|------|----------|----------|
| **问题域** | CPU 密集 / IO 密集 / 流处理 / 状态机 / 分布式协调 | 30% |
| **一致性要求** | 强一致 / 最终一致 / 幂等 / 事务边界 | 25% |
| **团队栈** | 语言生态、现有框架、学习曲线、招聘成本 | 20% |
| **运维成熟度** | 监控、调试、部署、升级、故障恢复 | 15% |
| **性能目标** | 吞吐、延迟、扩展性、资源效率 | 10% |

## 分类全景图

```
┌─────────────────────────────────────────────────────────────────┐
│                    并发编程抽象层级                                │
├─────────────────────────────────────────────────────────────────┤
│  应用框架层  │ Spring Boot / Quarkus / Micronaut / Go kit       │
│  编排层      │ Temporal / Cadence / Conductor / Camunda         │
│  流处理层    │ Flink / Kafka Streams / Spark / Pulsar Functions │
│  Actor层     │ Akka / Orleans / Proto.Actor / Erlang/OTP        │
│  CSP/Channel │ Go stdlib / Kotlin Flow / Reactor / crossbeam    │
│  线程池/任务 │ ExecutorService / rayon / tokio / java.util.c.   │
│  同步原语层  │ Lock / Channel / Semaphore / Barrier / STM       │
│  硬件原语层  │ CAS / LL-SC / Memory Barrier / HTM               │
└─────────────────────────────────────────────────────────────────┘
```

## 语言生态推荐路线

### Java / Kotlin (JVM)

| 场景 | 首选 | 备选 | 避坑 |
|------|------|------|------|
| **通用业务** | `CompletableFuture` / `ExecutorService` + `StructuredTaskScope` (JDK 21 预览，JEP 453，需 `--enable-preview`) | `Virtual Threads` (JDK 21) | 别在阻塞 IO 用虚拟线程池 |
| **高并发服务** | **Virtual Threads** (JDK 21+) + Spring Boot 3.2+ | Quarkus / Helidon | 旧代码库逐步迁移、注意 pinning |
| **响应式/流式** | **Project Reactor** (Spring WebFlux) / **Kotlin Flow** | RxJava 3 / Mutiny | 别混用阻塞 API、背压必通到底 |
| **Actor/状态机** | **Akka Typed** (Scala) / **Akka Classic** (Java) | Proto.Actor / Orleans (.NET) | Akka 许可证变更 (BSL)，评估商业风险 |
| **分布式流处理** | **Flink** (有状态、Exactly-once) | Kafka Streams (轻量嵌入) / Spark Streaming | Flink 运维重、需专人 |
| **工作流/长事务** | **Temporal** (强一致、可重试、可见性) | Camunda / Conductor | Temporal 需集群、学习曲线陡 |

#### JDK 21 虚拟线程决策树
```
是否 JDK 21+？
├─ 否 → 继续用平台线程池、CompletableFuture、Reactor
└─ 是 → 业务类型？
    ├─ 高并发阻塞 IO (Servlet、JDBC、HTTP Client) → 虚拟线程 ★
    ├─ CPU 密集计算 → 平台线程池 (虚拟线程无优势、甚至 pinning 更差)
    ├─ 已用 Reactor/Kotlin Flow → 评估迁移 ROI、可共存
    └─ 遗留同步阻塞库 (旧驱动、同步 SDK) → 虚拟线程透明解除阻塞
```

### Go

| 场景 | 首选 | 备选 |
|------|------|------|
| **通用并发** | `goroutine` + `channel` + `sync` | `errgroup` / `workerpool` |
| **高性能网关/代理** | 标准库 `net/http` + `goroutine` | `fasthttp` / `gnet` (epoll/kqueue 直驱) |
| **异步任务编排** | `temporal-go` / `asynq` (Redis) | `machinery` / `go-flow` |
| **流处理** | `Redpanda` / `Benthos` / `Bytewax` | 少，生态弱于 JVM |
| **Actor** | `Proto.Actor` / `go-actor` | 非主流，首选 CSP |

### Rust

| 场景 | 首选 | 备选 |
|------|------|------|
| **CPU 密集数据并行** | **rayon** (fork-join、零成本抽象) | `pariter` 自定义 |
| **异步 IO / 网络服务** | **tokio** (生态最全、运行时成熟) | `async-std` / `smol` |
| **Actor/状态机** | **Actix** / **Ractor** / **kameo** | 非主流 |
| **无锁数据结构** | **crossbeam** / **dashmap** / **evmap** | `parking_lot` (锁更快) |
| **嵌入式/无标准库** | `embassy` (async no_std) | 裸金属 `cortex-m-rt` |

### Python

| 场景 | 首选 | 备选 |
|------|------|------|
| **IO 密集异步** | **asyncio** + `aiohttp` / `httpx` / `asyncpg` | `trio` / `anyio` |
| **CPU 密集** | `multiprocessing` / `concurrent.futures.ProcessPoolExecutor` | `ray` / `joblib` / `dask` |
| **分布式任务队列** | **Celery** (Redis/RabbitMQ) / **Dramatiq** | `RQ` / `Huey` |
| **流处理** | **Faust** (Kafka) / **Bytewax** | `Fluvio` / `Redpanda` |
| **Actor** | `thespian` / `kaleido` | 非主流 |

### .NET

| 场景 | 首选 | 备选 |
|------|------|------|
| **通用并发** | `Task` / `Task.WhenAll` / `Parallel` / `Channels` | `Dataflow` (TPL Dataflow) |
| **Actor/虚拟Actor** | **Orleans** (云原生、自动激活、持久化) | `Proto.Actor` / `Akka.NET` |
| **高性能网络** | `Kestrel` / `Socket` / `Pipelines` | `DotNext` / `NetworkPrimitives` |
| **工作流** | **Temporal .NET SDK** / `Elsa Workflows` | `MassTransit` State Machine |

## 架构模式选型

### 1. 请求-响应 (RPC/HTTP API)
| QPS | 延迟要求 | 推荐架构 |
|-----|----------|----------|
| < 10k | p99 < 100ms | 同步阻塞 + 线程池 (Spring MVC / Go net/http / .NET Minimal API) |
| 10k-100k | p99 < 50ms | 虚拟线程 / Reactor / Go goroutine / tokio |
| > 100k | p99 < 10ms | 虚拟线程 / 无锁队列 / Disruptor / gnet / 自定义 Reactor |

### 2. 事件驱动 / CQRS / Event Sourcing
| 复杂度 | 推荐 |
|--------|------|
| 简单事件通知 | Kafka / Redis Streams / NATS + 消费者组 |
| 复杂聚合/投影 | Axon Framework / Eventuous / Akka Persistence |
| 跨服务 Saga | Temporal / Camunda / 手工编排 + 补偿 |

事件驱动的底层结构是 Reactor 模式（I/O 多路复用 + 事件分派），Netty、Node.js、Redis 都是它的实现，见 [Reactor 与事件驱动](./reactor.md)。

### 3. 实时流处理 / CEP
| 场景 | 推荐 |
|------|------|
| 窗口聚合、连接、Exactly-once | **Flink** |
| 轻量嵌入、Kafka 原生 | **Kafka Streams** |
| 微批、统一批流 | **Spark Structured Streaming** |
| 低延迟 (<10ms)、规则引擎 | **Flink SQL** / **RisingWave** / **Timeplus** |

### 4. 长运行工作流 / 人工审批 / 重试编排
| 需求 | 推荐 |
|------|------|
| 强一致、可观测、版本化、多语言 | **Temporal** |
| BPMN 标准、业务分析师参与 | **Camunda 8** / **Zeebe** |
| 简单 DAG、已用 Kafka | **Conductor** / **Airflow** (批向) |

### 5. 高并发状态服务 (游戏、交易、会话)
| 模式 | 推荐 |
|------|------|
| 单机/少量节点、Actor 天然 | **Akka Cluster** / **Orleans** / **Erlang/OTP** |
| 分布式、需强一致、分片 | **Akka Cluster Sharding** / **Orleans** / **Temporal** |
| 极致性能、C++/Rust | **Seastar** / **Actix** / 自行开发 |

## 避坑清单

| 坑 | 症状 | 预防 |
|----|------|------|
| **框架漏洞期** | 新版本破坏性变更、社区分裂 | 锁定 LTS、评估迁移成本、保留抽象层 |
| **阻塞污染异步** | Reactor/虚拟线程中调用阻塞 IO → 吞吐崩塌 | 严格分层、工具扫描 (BlockHound)、测试验证 |
| **过度抽象** | 简单业务套 Actor/工作流 → 复杂度爆炸 | YAGNI、从简单模型起步、按需引入 |
| **忽略背压** | 生产者无感知、下游雪崩 | 端到端背压设计、熔断、限流、队列有界 |
| **分布式锁滥用** | Redis 分布式锁保护热点 → 单点、延迟 | 本地缓存 + 乐观锁 / 分片 / 无锁设计 |
| **监控盲区** | 线程池/队列/任务无指标 → 故障发现晚 | 接入 Micrometer / Prometheus / OpenTelemetry 标准指标 |

## 演进路径建议

### 单体 → 微服务演进
```
阶段 1: 单体 + 线程池 + CompletableFuture
阶段 2: 引入消息队列 (Kafka) → 解耦生产消费
阶段 3: 核心域服务拆分 → gRPC + 虚拟线程/Reactor
阶段 4: 复杂业务流程 → Temporal / 状态机框架
阶段 5: 实时分析 → Flink / 流处理平台
```

### 遗留系统现代化
```
现状: 同步阻塞、大线程池、共享数据库
目标: 响应式/虚拟线程、领域隔离、事件驱动
路径:
1. 引入 Structured Concurrency / Virtual Threads (零代码改动试点)
2. 识别阻塞边界、标注 @Blocking / Scheduler.boundedElastic()
3. 逐模块迁移至 Reactor/Kotlin Flow (新代码优先)
4. 引入事件总线、剥离只读查询模型 (CQRS)
5. 核心写路径上 Actor/工作流 (Temporal)
```

## 成本模型估算

| 方案 | 开发成本 | 运维成本 | 硬件成本 | 适用阶段 |
|------|----------|----------|----------|----------|
| 线程池 + 阻塞 IO | 低 | 低 | 高 (线程内存) | MVP、中小流量 |
| Virtual Threads | 低 (JDK 21+) | 低 | 低 | 现有 JVM 系统升级 |
| Reactor/Kotlin Flow | 中 (思维转换) | 中 | 低 | 新建响应式系统 |
| Go goroutine | 低 | 低 | 低 | 新建 Go 系统 |
| Akka/Orleans | 高 (模型学习) | 高 (集群运维) | 中 | 复杂状态、高可用 |
| Temporal | 高 (新栈) | 高 (集群) | 中 | 长事务、强一致编排 |
| Flink | 高 (流计算模型) | 高 (集群、状态后端) | 高 | 实时分析、CEP |

## 决策检查单 (上会用)

- [ ] 问题域明确：CPU/IO/流/状态机/编排
- [ ] 一致性边界：强/最终/补偿/幂等
- [ ] 团队技能图谱：现有栈、学习窗口、招聘
- [ ] 基线性能测试：当前 QPS/延迟/资源、目标值
- [ ] 运维能力：监控、日志、追踪、部署、故障演练
- [ ] 许可证风险：Akka BSL、Confluent、商业支持
- [ ] 迁移路径：绞杀者模式、双写、灰度、回滚预案
- [ ] 成本模型：开发/运维/硬件/机会成本 3 年 TCO

## 本章小结

框架选型无银弹，**约束驱动决策**：
- **简单问题用简单工具**：线程池 > Actor > 工作流
- **团队熟悉度 > 技术先进性**：能驾驭、能运维、能招人
- **演进 > 大爆炸**：绞杀者模式、双写验证、可逆迁移
- **可观测性内置**：选型即包含监控指标、追踪、日志标准

**全书完**。并发编程知识体系：基础 → 同步原语 → 并发模型 → 进阶 → 实战 → 选型。愿你在并发世界里**少踩坑、多产出、早下班**。

## 本章来源

- 本页是选型经验框架，不是文献综述：涉及框架的事实以各项目官方文档为准（Akka、Orleans、skynet、Flink 等）
- 问题域、一致性、团队栈、运维成熟度四维权衡是本仓调研结论
