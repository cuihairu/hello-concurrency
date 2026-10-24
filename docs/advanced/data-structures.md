# Concurrent Data Structures

Concurrent data structures are the **standard parts library** of concurrent programming. Choosing the right structure and understanding its semantics and performance boundaries is key to building high-throughput, low-latency systems.

## A Panoramic Classification

| Category | Typical structures | Core techniques | Use cases |
|----------|-------------------|-----------------|-----------|
| **Queues** | Bounded/unbounded, blocking/lock-free, MPMC/SPSC | Ring buffers, CAS linked lists, LCRQ | Producer-consumer, task scheduling, log buffering |
| **Maps** | HashMap, SkipList, B+Tree, Trie | Segmented locking, CAS, RCU, HTM | Caches, routing tables, session storage |
| **Sets** | HashSet, TreeSet, BloomFilter | Same as maps | Deduplication, permission checks, bloom filtering |
| **Counters** | LongAdder, StripedCounter, AtomicLong | Sharding, false sharing elimination, CAS | Statistics, rate limiting, metric collection |
| **Stacks/deques** | Treiber Stack, Chase-Lev Deque | CAS, work stealing | Thread pool task queues, DFS |
| **Priority queues** | SkipList, Heap, Calendar Queue | Fine-grained locking, lock-free skiplists | Timed tasks, event simulation |
| **Synchronization utilities** | Latch, Barrier, Phaser, Semaphore | AQS, CAS, Park/Unpark | Orchestration, startup synchronization, resource control |

## Core Queue Comparison

| Queue | Model | Bounded | Blocking | Lock-free | Throughput | Latency | Typical implementation |
|-------|-------|---------|----------|-----------|-----------|---------|------------------------|
| `ArrayBlockingQueue` | MPMC | yes | yes | no | Medium | Stable | Ring array plus one lock with two conditions |
| `LinkedBlockingQueue` | MPMC | yes/no | yes | no | Medium | Stable | Linked list plus two locks |
| `ConcurrentLinkedQueue` | MPMC | no | no | yes | High | Low | Michael-Scott CAS linked list |
| `SynchronousQueue` | MPMC | 0 | yes | no | Low | High | Direct handoff, double-ended stacks |
| `Disruptor` | SPSC/MPMC | yes | Optional | yes (ring) | Very high | Very low | Ring plus sequence numbers plus wait strategies |
| `LCRQ` | MPMC | no | no | yes | High | Low | Segmented linked list plus CAS |
| `JCTools MpmcArrayQueue` | MPMC | yes | no | yes | Very high | Low | Ring plus multiplicative indexing |
| `crossbeam-channel` | MPMC | yes/no | yes | no | High | Low | Rust standard-library style |

### Selection Decision Tree
```
Do you need backpressure / a bound?
+-- yes -> Do you need to block and wait? -> ArrayBlockingQueue / Disruptor (high performance)
+-- no -> Pure in-memory high throughput? -> ConcurrentLinkedQueue / JCTools lock-free queues
```

## Core Map Comparison

| Map | Read performance | Write performance | Resizing | Memory | Ordered | Typical implementation |
|-----|------------------|-------------------|----------|--------|---------|------------------------|
| `ConcurrentHashMap` (JDK 8+) | High | High | Incremental | Medium | No | CAS plus synchronized on the head node plus a red-black tree |
| `ConcurrentSkipListMap` | Medium | Medium | None | High | Yes | Lock-free skiplist |
| `CHM (JDK 7)` | Medium | Medium | Full | High | No | Segmented locking (Segment[]) |
| `DashMap` (Rust) | High | High | Incremental | Medium | No | Sharded RWLock |
| `folly::AtomicHashMap` | High | High | None | Low | No | Open addressing plus CAS |
| `robin_hood::HashMap` | Very high | High | None | Low | No | Robin Hood probing |

### Key JDK 8+ CHM Optimizations
1. **Dropped Segment[]**, replaced with `Node[] table` plus `synchronized` on the head node plus CAS
2. **List treeification**: when a conflict chain exceeds length 8 it becomes a red-black tree, giving O(log n) lookups
3. **Resizing help**: multiple threads migrate in parallel, coordinated by `sizeCtl`
4. **`computeIfAbsent`/`merge`** as atomic compound operations, avoiding an outer lock

## Counters and Aggregators

| Structure | Principle | Throughput | Scalability | Scenarios |
|-----------|-----------|-----------|-------------|-----------|
| `AtomicLong` | CAS on a single variable | Low | Poor | Low concurrency, exact counting |
| `LongAdder` | Base value plus a Cell[] shard | High | Good | High-concurrency counting, metrics |
| `LongAccumulator` | Custom accumulation function plus sharding | High | Good | Non-additive aggregation (max/min) |
| `Striped64` (base class) | False sharing elimination, dynamic resizing | - | - | Custom sharded aggregation |
| `DoubleAdder` | Floating-point sharded accumulation | High | Good | Floating-point metrics |

**False sharing elimination**: `@Contended` (JDK 8+, JEP 142; JDK internal classes take effect directly, application classes need `-XX:-RestrictContended`) / `alignas(64)` / a `Cell` array where each element owns its own cache line. The hardware cause of false sharing — the cache line is the smallest transfer unit and the coherence protocol flags conflicts within a line — is in [Hardware and the Memory Hierarchy](./hardware.md).

## Concurrent Collection Best Practices

### 1. Make Compound Operations Atomic
```java
// Wrong: check-then-act race
if (map.containsKey(k)) map.remove(k);
// Correct: atomic compound operations
map.remove(k, expectedValue);
map.computeIfAbsent(k, v -> new V());
map.merge(k, v, (old, n) -> old + n);
```

### 2. Batch Operations
```java
// forEach / search / reduce for parallel iteration
map.forEach(16, (k, v) -> process(k, v));  // parallelism 16
long sum = map.reduceValues(16, Long::sum);
```

### 3. View Consistency
```java
// Weakly consistent iterators: do not throw CME, may reflect partial updates
for (Entry e : map.entrySet()) { ... }
// size() is not exact: an estimated value while being modified concurrently
```

### 4. Avoid Locking the Whole Structure
```java
// Wrong: lock the entire table
synchronized(map) { for (v : map.values()) ... }
// Correct: parallel streams / forEach / spliterator
map.values().parallelStream().forEach(...);
```

## Language Ecosystem Standard Library Comparison

| Language | Queues | Maps | Sets | Counters | Synchronization utilities |
|----------|--------|------|------|----------|--------------------------|
| **Java** | `java.util.concurrent.*` | `ConcurrentHashMap` | `ConcurrentSkipListSet` | `LongAdder` | `CountDownLatch`, `Phaser` |
| **Go** | `chan` / `sync.Mutex` plus slices | `sync.Map` (read-heavy/write-light) | No standard option | `sync/atomic` | `sync.WaitGroup`, `errgroup` |
| **Rust** | `crossbeam::queue` / `flume` | `dashmap` / `evmap` | `dashset` | `atomic` / `crossbeam-utils` | `crossbeam::sync` / `tokio::sync` |
| **C++** | `moodycamel::ConcurrentQueue` | `folly::AtomicHashMap` | `tsl::hopscotch_set` | `std::atomic` | `std::latch`, `std::barrier` (C++20) |
| **C#** | `ConcurrentQueue` / `BlockingCollection` | `ConcurrentDictionary` | `ConcurrentBag` | `Interlocked` | `CountdownEvent`, `Barrier` |

## High-Performance Specialized Structures

### Disruptor (Ring Buffer plus Sequence Numbers)
```java
// Single producer, multiple consumers
RingBuffer<Event> ring = RingBuffer.createSingleProducer(factory, 1024);
ring.publishEvent((event, seq) -> event.setValue(data));

// Consumer group
WorkerPool<Event> pool = new WorkerPool<>(ring, barrier, exceptionHandler, workers);
```
- **Mechanical sympathy**: cache-friendly, no false sharing, batch publishing, configurable wait strategies (busy-spin/blocking/adaptive)
- **Suitable for**: ultra-high throughput, low latency, event sourcing, logging, trade matching

### LMAX Architecture
```
Receiver -> Decoder -> Business processor (single-threaded, lock-free) -> Publisher -> Persistence/gateway
```
- Core: single-threaded business logic plus the Disruptor for transfer, avoiding all lock contention

### RCU (Read-Copy-Update)
```c
// Zero-cost read side
rcu_read_lock();
p = rcu_dereference(ptr);
use(p);
rcu_read_unlock();

// Copy-and-modify write side
new = kmalloc(...);
copy_old(new);
modify(new);
rcu_assign_pointer(ptr, new);
synchronize_rcu();  // wait for all readers to exit
kfree(old);
```
- **The read-heavy/write-light extreme**: readers take no locks, no atomics, no cache line contention
- **Widely used in the Linux kernel, databases (MySQL MVCC), Redis, and TiKV**

## Performance Testing Methodology

### JMH (Java) / Google Benchmark (C++) Key Points
```java
@Benchmark
@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(TimeUnit.SECONDS)
@Threads(16)
@Fork(3)
@Warmup(iterations = 5, time = 3)
@Measurement(iterations = 10, time = 3)
public void throughput(QueueState s) {
    s.queue.offer(s.value);
}
```

### Key Metrics
| Metric | Meaning | How to collect |
|--------|---------|----------------|
| **Throughput** | ops/sec | JMH Throughput |
| **Latency distribution** | p50/p99/p999 | JMH Sample / HdrHistogram |
| **Scalability** | Throughput as thread count varies | Sweep 1..N threads |
| **Cache misses** | L1/L2/L3 miss rate | `perf stat -e cache-misses` |
| **False sharing** | Cache lines bouncing back and forth | `perf c2c` / `perf mem` |
| **Allocation rate** | MB/sec, GC frequency | `jstat -gc` / `async-profiler` |

## Common Performance Traps

| Trap | Symptoms | How to investigate | Fix |
|------|----------|--------------------|-----|
| **False sharing** | Poor multicore scaling, high cache-misses | `perf c2c` | `@Contended` / padding / thread-local aggregation |
| **Resizing storms** | Periodic latency spikes | GC logs, JFR | Pre-set initial capacity, incremental resizing |
| **Hash collision attacks** | 100% CPU, soaring latency | Flame graph | Key hash perturbation, SipHash, treeification threshold |
| **Lock-free queue ABA** | Very rare data corruption | Model checking, stress testing | Versioned pointers, Hazard Pointers |
| **Blocking queue saturation** | Producers blocked, backpressure propagating | Queue length monitoring | Bounds plus rejection policy / resize / circuit breaker |

## Chapter summary

Concurrent data structures are the engineering crystallization of **algorithms plus a memory model plus hardware properties**. Selection tenets:
- **Queues**: for bounded blocking choose `ArrayBlockingQueue`/Disruptor; for unbounded high throughput choose lock-free queues
- **Maps**: default to `ConcurrentHashMap` (JDK 8+); for ordering choose `ConcurrentSkipListMap`; for extreme read performance choose RCU/immutable snapshots
- **Counters**: always use `LongAdder`/sharded counters under high concurrency
- **Testing**: JMH plus `perf` plus stress testing plus model checking

For related pages see **Performance Tuning** — a systematic methodology from microbenchmarks to full-link tuning.

## Sources

- The building-block chapters (concurrent containers, atomic variables) of *Java Concurrency in Practice*; see the mapping in [Authoritative Book Survey](../research/books.md)
- ConcurrentHashMap and LongAdder behavior follow the [JDK Concurrent Package Documentation](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/package-summary.html)

## References

- [Wikipedia: Concurrent data structure](https://en.wikipedia.org/wiki/Concurrent_data_structure)
- [Java Concurrency Utilities](https://docs.oracle.com/en/java/javase/21/api/java.base/java/util/concurrent/package-summary.html)
- [Wikipedia: Linearizability](https://en.wikipedia.org/wiki/Linearizability)

<!-- BACKLINKS-AUTO -->
## Related pages

- [hardware](hardware.md)
- [languages](languages.md)
- [os](os.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [frameworks](/practice/frameworks.md)
- [seven-weeks](/practice/seven-weeks.md)
- [applications](/research/applications.md)
