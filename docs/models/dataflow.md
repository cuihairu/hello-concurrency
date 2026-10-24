# Dataflow Model

The dataflow model models computation as a **directed acyclic graph (DAG)**: nodes are operators, edges are data dependencies. Execution is data-driven — **computation fires when inputs are ready** — which is naturally parallel, lock-free, and deterministic.

## Core concepts

### Dataflow graph
```
Source → Map → Filter → Reduce → Sink
              ↘
               → Branch → Join
```

| Element | Meaning |
|------|------|
| **Node** | side-effect-free pure function / stateful operator |
| **Edge** | data channel carrying immutable messages |
| **Token** | the unit of data flowing along an edge |
| **Firing rule** | the node's trigger condition: all inputs have tokens |

### Execution semantics
- **Static dataflow**: topology determined at compile time, fixed firing rules per node
- **Dynamic dataflow**: graph built at runtime, supports data-dependent control flow (if/while)

### Key properties
| Property | Explanation |
|------|------|
| **Determinism** | same inputs → same outputs, regardless of scheduling |
| **Lock-free** | no shared mutable state, tokens flow in one direction |
| **Natural parallelism** | independent nodes can run concurrently at will |
| **Backpressure propagation** | slow downstream → buffer fills → upstream blocks |

## Classic models compared

| Model | Representative systems | Character |
|------|----------|------|
| **Kahn Process Networks (KPN)** | theoretical foundation | unbounded buffers, blocking reads, deterministic |
| **Synchronous Dataflow (SDF)** | signal processing, Ptolemy | fixed production/consumption rates, compile-time scheduling |
| **Boolean Dataflow** | hardware synthesis | tokens carry boolean tags, conditional firing |
| **Dynamic Dataflow** | TensorFlow, Flink | runtime graph construction, control-flow operators |
| **Reactive Streams** | RxJava, Project Reactor | backpressure standard, composable API |

## Programming patterns

### 1. Declarative stream construction
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
// Go generator pattern
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
// pipeline composition
for n := range sq(sq(gen(2, 3))) { fmt.Println(n) }  // 16, 81
```

### 2. Stateful operators
```java
// windowed aggregation
stream
    .keyBy(Event::getUserId)
    .window(TumblingEventTimeWindows.of(Time.minutes(5)))
    .reduce((a, b) -> a.add(b))
    .addSink(...);
```

```python
# Faust (Python stream processing)
class PageView(faust.Record):
    url: str
    user: str

page_views = app.topic('page_views', value_type=PageView)

@app.agent(page_views)
async def count_views(stream):
    async for view in stream.group_by(PageView.url):
        count = view.url.count()  # state stored in RocksDB
        await count_sink.send(key=view.url, value=count)
```

### 3. Iteration/loops (dynamic dataflow)
```python
# TensorFlow control flow
i = tf.constant(0)
c = lambda i: tf.less(i, 10)
b = lambda i: tf.add(i, 1)
r = tf.while_loop(c, b, [i])  # loop embedded in the graph
```

```java
// Flink iteration
DataSet<Vertex> vertices = ...
DataSet<Edge> edges = ...

IterativeDataSet<Vertex> iteration = vertices.iterate(maxIterations);
DataSet<Vertex> newVertices = iteration
    .join(edges).where("id").equalTo("src")
    .map(...);
iteration.closeWith(newVertices);
```

## Backpressure mechanism

### Reactive Streams spec (JDK 9+ Flow API)
```
Publisher → Subscription → Subscriber
                ↓
          request(n)  ← backpressure signal
          onNext(t)   → data flow
          onComplete / onError
```

### Implementation strategies
| Strategy | Pros | Cons |
|------|------|------|
| **Unbounded buffer** | simple | OOM risk |
| **Bounded buffer + blocking** | natural backpressure | may deadlock |
| **Explicit request(n)** | precise control | complex API |
| **Drop/sample** | protects downstream | data loss |
| **Reactive pull** | end-to-end backpressure | complex to implement |

## Mainstream frameworks compared

| Framework | Language | Model | Suitable scenarios |
|------|------|------|----------|
| **Apache Flink** | Java/Scala | dynamic dataflow, event time, exactly-once | real-time stream processing, CEP, stateful computation |
| **Apache Spark Structured Streaming** | Scala/Python | micro-batch + dataflow | unified batch/stream, ETL, ML pipelines |
| **Kafka Streams** | Java | KTable/KStream, local state | lightweight stream processing, embedded |
| **Akka Streams** | Scala/Java | reactive streams, graph DSL | stream processing inside actor systems |
| **RxJava / Reactor** | Java/Kotlin | composable Observable/Flowable | client-side reactive, API gateways |
| **Project Reactive Streams** | multi-language | SPI specification | library interop |
| **TensorFlow / PyTorch** | Python/C++ | static/dynamic graphs, autodiff | deep learning training and inference |
| **Apache Beam** | Java/Python/Go | unified batch/stream model, multiple runners | portable pipelines |
| **Bytewax / Faust** | Python | dataflow, state management | stream processing in the Python ecosystem |

## Graph scheduling and optimization

### Compile-time optimization (static graphs)
- **Operator fusion**: eliminates intermediate buffers, reduces scheduling overhead
- **Constant folding**: constant expressions computed at compile time
- **Dead code elimination**: removes output-less paths
- **Memory planning**: tensor lifetime analysis, memory reuse

### Runtime scheduling (dynamic graphs)
- **Task graph**: DAG → Task DAG → physical execution graph
- **Resource awareness**: data locality, heterogeneous scheduling (CPU/GPU)
- **Speculative execution**: backup for slow tasks
- **Fault tolerance**: checkpoints + lineage replay / state backends

## Applicability

| Suitable for | Unsuitable for |
|------|--------|
| ETL pipelines, feature engineering | complex transactions, strong-consistency business logic |
| real-time analytics, CEP, monitoring alerts | low-latency RPC, request-response |
| ML pipelines, model serving | simple CRUD, single-machine concurrency |
| streaming joins, windowed aggregation | random access, point queries |

## Anti-patterns

| Anti-pattern | Consequence | Fix |
|--------|------|------|
| side effects inside operators (DB writes, HTTP calls) | nondeterminism, duplicate execution | isolate in sink operators, idempotent design |
| huge unpartitioned state | single-point hotspots, limited scaling | keyBy partitioning, RocksDB state backend |
| ignoring watermarks / event time | wrong results from out-of-order data | event time + watermarks + allowed lateness |
| no backpressure protection | cascading OOM, avalanche | explicit request, rate limiting, buffer caps |
| premature fusion optimization | hard debugging, serialization bottlenecks | correctness first, fuse later, monitor metrics |

## Chapter summary

The dataflow model unifies batch/stream, CPU/GPU, and single-machine/distributed with **DAG + token-driven execution**. Core advantages:
- **Declarative**: describe "what", not "how"
- **Composable**: operators are Lego bricks, pipelines are graphs
- **Optimizable**: compilers/runtimes optimize from a global view
- **Fault tolerant**: lineage/checkpoints naturally support exactly-once

Engineering selection: **Flink (heavy stateful streaming), Spark (unified batch/stream), Kafka Streams (lightweight embedding), Beam (portability), TensorFlow/PyTorch (ML)**. For the related page see STM — software transactional memory bringing database-grade ACID to shared-memory concurrency. Scale a dataflow DAG up to full-dataset scale and you get the two paths — batch layer and speed layer — of the [Lambda architecture](./lambda-architecture.md).

## Sources

- This page is an addition by this repo: the book covers dataflow programming as day three of chapter 3, not a standalone chapter; see [authoritative book research](../research/books.md) for the accounting
- The framework sections defer to each project's official documentation ([Apache Flink](https://flink.apache.org/), [Spark](https://spark.apache.org/), [Kafka Streams](https://kafka.apache.org/documentation/streams/), [Beam](https://beam.apache.org/))
- Example code is written fresh, not copied from the book

## References

- [Wikipedia · Dataflow programming](https://en.wikipedia.org/wiki/Dataflow_programming)

<!-- BACKLINKS-AUTO -->
## Related pages

- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [data-parallel](data-parallel.md)
- [functional](functional.md)
- [lambda-architecture](lambda-architecture.md)
- [books](/research/books.md)
