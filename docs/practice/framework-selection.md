# Concurrency Framework Selection

Concurrency framework selection is an **architecture decision**, not a library choice. It requires weighing four dimensions: **problem domain, team capability, operational cost, and evolution path**. This chapter provides a decision map and a pitfall avoidance guide.

## Selection decision matrix

| Dimension | Key questions | Suggested weight |
|------|----------|----------|
| **Problem domain** | CPU-intensive / IO-intensive / stream processing / state machine / distributed coordination | 30% |
| **Consistency requirements** | Strong / eventual / idempotent / transaction boundaries (criteria on [reliability design](./reliability.md)) | 25% |
| **Team stack** | Language ecosystem, existing frameworks, learning curve, hiring cost | 20% |
| **Operational maturity** | Monitoring, debugging, deployment, upgrades, incident recovery | 15% |
| **Performance goals** | Throughput, latency, scalability, resource efficiency | 10% |

## Classification panorama

```
┌──────────────────────────────────────────────────────────────────────┐
│              Concurrency Programming Abstraction Levels              │
├──────────────────────────────────────────────────────────────────────┤
│  Application frameworks   │ Spring Boot / Quarkus / Micronaut / Go kit │
│  Orchestration            │ Temporal / Cadence / Conductor / Camunda │
│  Stream processing        │ Flink / Kafka Streams / Spark / Pulsar Functions │
│  Actor                    │ Akka / Orleans / Proto.Actor / Erlang/OTP │
│  CSP/Channel              │ Go stdlib / Kotlin Flow / Reactor / crossbeam │
│  Thread pool/task         │ ExecutorService / rayon / tokio / java.util.c. │
│  Synchronization primitives │ Lock / Channel / Semaphore / Barrier / STM │
│  Hardware primitives      │ CAS / LL-SC / Memory Barrier / HTM │
└──────────────────────────────────────────────────────────────────────┘
```

## Recommended routes per language ecosystem

For a horizontal comparison of each language's concurrency units, schedulers, and memory models, see [programming languages and concurrency support](../advanced/languages.md).

### Java / Kotlin (JVM)

| Scenario | First choice | Alternatives | Watch out for |
|------|------|------|------|
| **General business** | `CompletableFuture` / `ExecutorService` + `StructuredTaskScope` (JDK 21 preview, JEP 453, requires `--enable-preview`) | `Virtual Threads` (JDK 21) | Don't use a virtual thread pool for blocking IO |
| **High-concurrency services** | **Virtual Threads** (JDK 21+) + Spring Boot 3.2+ | Quarkus / Helidon | Migrate legacy codebases gradually, watch for pinning |
| **Reactive/streaming** | **Project Reactor** (Spring WebFlux) / **Kotlin Flow** | RxJava 3 / Mutiny | Don't mix blocking APIs, backpressure must flow end to end |
| **Actor/state machine** | **Akka Typed** (Scala) / **Akka Classic** (Java) | Proto.Actor / Orleans (.NET) | Akka license change (BSL), assess commercial risk |
| **Distributed stream processing** | **Flink** (stateful, exactly-once) | Kafka Streams (lightweight embed) / Spark Streaming | Flink operations are heavy, needs dedicated staff |
| **Workflow/long transactions** | **Temporal** (strongly consistent, retryable, visible) | Camunda / Conductor | Temporal needs a cluster, steep learning curve |

#### JDK 21 virtual thread decision tree
```
On JDK 21+?
├─ No → keep using platform thread pools, CompletableFuture, Reactor
└─ Yes → business type?
    ├─ High-concurrency blocking IO (Servlet, JDBC, HTTP Client) → virtual threads ★
    ├─ CPU-intensive computation → platform thread pools (virtual threads give no advantage, pinning can be worse)
    ├─ Already on Reactor/Kotlin Flow → evaluate migration ROI, coexistence is fine
    └─ Legacy synchronous blocking libraries (old drivers, sync SDKs) → virtual threads transparently unblock them
```

### Go

| Scenario | First choice | Alternatives |
|------|------|------|
| **General concurrency** | `goroutine` + `channel` + `sync` | `errgroup` / `workerpool` |
| **High-performance gateway/proxy** | Standard library `net/http` + `goroutine` | `fasthttp` / `gnet` (direct epoll/kqueue) |
| **Async task orchestration** | `temporal-go` / `asynq` (Redis) | `machinery` / `go-flow` |
| **Stream processing** | `Redpanda` / `Benthos` / `Bytewax` | Few options, ecosystem weaker than JVM |
| **Actor** | `Proto.Actor` / `go-actor` | Non-mainstream, prefer CSP |

### Rust

| Scenario | First choice | Alternatives |
|------|------|------|
| **CPU-intensive data parallelism** | **rayon** (fork-join, zero-cost abstraction) | `pariter` for custom cases |
| **Async IO / network services** | **tokio** (fullest ecosystem, mature runtime) | `async-std` / `smol` |
| **Actor/state machine** | **Actix** / **Ractor** / **kameo** | Non-mainstream |
| **Lock-free data structures** | **crossbeam** / **dashmap** / **evmap** | `parking_lot` (faster locks) |
| **Embedded/no standard library** | `embassy` (async no_std) | bare metal `cortex-m-rt` |

### Python

| Scenario | First choice | Alternatives |
|------|------|------|
| **IO-intensive async** | **asyncio** + `aiohttp` / `httpx` / `asyncpg` | `trio` / `anyio` |
| **CPU-intensive** | `multiprocessing` / `concurrent.futures.ProcessPoolExecutor` | `ray` / `joblib` / `dask` |
| **Distributed task queue** | **Celery** (Redis/RabbitMQ) / **Dramatiq** | `RQ` / `Huey` |
| **Stream processing** | **Faust** (Kafka) / **Bytewax** | `Fluvio` / `Redpanda` |
| **Actor** | `thespian` / `kaleido` | Non-mainstream |

### .NET

| Scenario | First choice | Alternatives |
|------|------|------|
| **General concurrency** | `Task` / `Task.WhenAll` / `Parallel` / `Channels` | `Dataflow` (TPL Dataflow) |
| **Actor/virtual actor** | **Orleans** (cloud-native, auto-activation, persistent) | `Proto.Actor` / `Akka.NET` |
| **High-performance networking** | `Kestrel` / `Socket` / `Pipelines` | `DotNext` / `NetworkPrimitives` |
| **Workflow** | **Temporal .NET SDK** / **Elsa Workflows** | `MassTransit` State Machine |

## Architecture pattern selection

### 1. Request-response (RPC/HTTP API)
| QPS | Latency requirement | Recommended architecture |
|-----|----------|----------|
| < 10k | p99 < 100ms | Synchronous blocking + thread pool (Spring MVC / Go net/http / .NET Minimal API) |
| 10k-100k | p99 < 50ms | Virtual threads / Reactor / Go goroutine / tokio |
| > 100k | p99 < 10ms | Virtual threads / lock-free queues / Disruptor / gnet / custom Reactor |

### 2. Event-driven / CQRS / Event Sourcing
| Complexity | Recommendation |
|--------|------|
| Simple event notification | Kafka / Redis Streams / NATS + consumer groups |
| Complex aggregates/projections | Axon Framework / Eventuous / Akka Persistence |
| Cross-service Saga | Temporal / Camunda / manual orchestration + compensation |

The underlying structure of event-driven systems is the Reactor pattern (I/O multiplexing + event dispatch). Netty, Node.js, and Redis are all implementations of it, see [Reactor and event-driven](./reactor.md).

### 3. Real-time stream processing / CEP
| Scenario | Recommendation |
|------|------|
| Windowed aggregation, joins, exactly-once | **Flink** |
| Lightweight embedding, Kafka-native | **Kafka Streams** |
| Micro-batch, unified batch and stream | **Spark Structured Streaming** |
| Low latency (<10ms), rule engine | **Flink SQL** / **RisingWave** / **Timeplus** |

### 4. Long-running workflow / manual approval / retry orchestration
| Requirement | Recommendation |
|------|------|
| Strong consistency, observable, versioned, polyglot | **Temporal** |
| BPMN standard, business analyst involvement | **Camunda 8** / **Zeebe** |
| Simple DAG, already on Kafka | **Conductor** / **Airflow** (batch-oriented) |

### 5. High-concurrency stateful services (gaming, trading, sessions)
| Pattern | Recommendation |
|------|------|
| Single/few nodes, Actor is a natural fit | **Akka Cluster** / **Orleans** / **Erlang/OTP** |
| Distributed, strong consistency needed, sharded | **Akka Cluster Sharding** / **Orleans** / **Temporal** |
| Extreme performance, C++/Rust | **Seastar** / **Actix** / build in-house |

## Pitfall checklist

| Pitfall | Symptom | Prevention |
|----|------|------|
| **Framework churn period** | Breaking changes in new versions, community splits | Lock to LTS, evaluate migration cost, keep an abstraction layer |
| **Blocking pollutes async** | Calling blocking IO inside Reactor/virtual threads → throughput collapse | Strict layering, tool scanning (BlockHound), test verification |
| **Over-abstraction** | Wrapping simple business in Actor/workflow → complexity explosion | YAGNI, start from a simple model, introduce on demand |
| **Ignoring backpressure** | Producers unaware, downstream avalanche | End-to-end backpressure design, circuit breaking, rate limiting, bounded queues |
| **Distributed lock abuse** | Redis distributed lock protecting a hot key → single point, latency | Local cache + optimistic lock / sharding / lock-free design |
| **Monitoring blind spots** | No metrics for thread pool/queue/tasks → incidents found late | Adopt standard metrics from Micrometer / Prometheus / OpenTelemetry |

## Evolution path recommendations

### Monolith → microservices evolution
```
Stage 1: monolith + thread pool + CompletableFuture
Stage 2: introduce a message queue (Kafka) → decouple production and consumption
Stage 3: split core domain services → gRPC + virtual threads/Reactor
Stage 4: complex business flows → Temporal / state machine framework
Stage 5: real-time analytics → Flink / stream processing platform
```

### Legacy system modernization
```
Current state: synchronous blocking, large thread pools, shared database
Target: reactive/virtual threads, domain isolation, event-driven
Path:
1. Introduce Structured Concurrency / Virtual Threads (zero-code-change pilot)
2. Identify blocking boundaries, annotate @Blocking / Scheduler.boundedElastic()
3. Migrate module by module to Reactor/Kotlin Flow (new code first)
4. Introduce an event bus, peel off read-only query models (CQRS)
5. Put Actor/workflow on core write paths (Temporal)
```

## Cost model estimation

| Option | Development cost | Operational cost | Hardware cost | Applicable stage |
|------|----------|----------|----------|----------|
| Thread pool + blocking IO | Low | Low | High (thread memory) | MVP, small-to-medium traffic |
| Virtual Threads | Low (JDK 21+) | Low | Low | Upgrading existing JVM systems |
| Reactor/Kotlin Flow | Medium (mindset shift) | Medium | Low | New reactive systems |
| Go goroutine | Low | Low | Low | New Go systems |
| Akka/Orleans | High (model learning) | High (cluster ops) | Medium | Complex state, high availability |
| Temporal | High (new stack) | High (cluster) | Medium | Long transactions, strongly consistent orchestration |
| Flink | High (stream computing model) | High (cluster, state backend) | High | Real-time analytics, CEP |

## Decision checklist (for architecture review)

- [ ] Problem domain clear: CPU/IO/stream/state machine/orchestration
- [ ] Consistency boundary: strong/eventual/compensating/idempotent
- [ ] Team skill map: current stack, learning window, hiring
- [ ] Baseline performance test: current QPS/latency/resources, target values
- [ ] Operational capability: monitoring, logging, tracing, deployment, incident drills
- [ ] License risk: Akka BSL, Confluent, commercial support
- [ ] Migration path: strangler pattern, dual writes, canary, rollback plan
- [ ] Cost model: 3-year TCO of development/ops/hardware/opportunity cost

## Chapter summary

There is no silver bullet in framework selection; **constraints drive the decision**:
- **Simple tools for simple problems**: thread pool > Actor > workflow
- **Team familiarity > technical novelty**: can be driven, can be operated, can be hired for
- **Evolution > big bang**: strangler pattern, dual-write verification, reversible migration
- **Observability built in**: selection includes monitoring metrics, tracing, logging standards

**End of the book**. The concurrency programming knowledge system: basics → synchronization primitives → concurrency models → advanced → practice → selection. May you **hit fewer pitfalls, deliver more, and go home earlier** in the world of concurrency.

## Sources

- This page is a selection experience framework, not a literature survey: facts about specific frameworks are governed by each project's official documentation (Akka, Orleans, skynet, Flink, etc.)
- The four-dimension weighing of problem domain, consistency, team stack, and operational maturity is this repo's research conclusion

## References

- [Seven Concurrency Models in Seven Weeks](https://pragprog.com/titles/pb7con/seven-concurrency-models-in-seven-weeks/)
- [The Go Memory Model](https://go.dev/ref/mem)
- [Rust concurrency chapter](https://doc.rust-lang.org/book/ch16-00-concurrency.html)

<!-- BACKLINKS-AUTO -->
## Related pages

- [languages](/advanced/languages.md)
- [trends](/advanced/trends.md)
- [knowledge](/knowledge.md)
- [frameworks](frameworks.md)
- [reactor](reactor.md)
- [reliability](reliability.md)
- [seven-weeks](seven-weeks.md)
- [applications](/research/applications.md)
