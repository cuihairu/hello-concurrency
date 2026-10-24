# Performance Tuning

Concurrent performance tuning is a closed-loop engineering process of **measure -> analyze -> optimize -> verify**. The core principles: **do not change what you have not measured, separate measuring from changing, follow the bottleneck, and make trade-offs explicit**.

## The Performance Model

### General Latency Decomposition
```
Total latency = serial part + parallel part / parallelism + synchronization overhead + scheduling overhead + interference
```
- **Amdahl's law**: speedup <= 1 / (serial fraction + parallel fraction / core count)
- **Gustafson's law**: as the problem size grows with core count, speedup approaches linear

### Concurrency Bottleneck Profiles
| Bottleneck type | Typical symptoms | Diagnostic metrics |
|-----------------|------------------|--------------------|
| **Lock contention** | Low CPU, high context switches, threads BLOCKED | `perf sched`, `jstack`, `lockstat` |
| **Cache contention** | Poor scaling, high cache-miss, false sharing | `perf c2c`, `perf mem`, `perf stat` |
| **Memory bandwidth** | No speedup on multiple cores, saturated memory controllers | `perf stat` uncore metrics, Intel PCM (`pcm-memory`), `numastat` |
| **CPU saturation** | Long run queues, high load average | `mpstat`, `pidstat`, `top` |
| **I/O wait** | Low CPU, high iowait, saturated disk/network | `iostat`, `sar -n DEV`, `ss -s` |
| **GC/allocation** | STW pauses, high allocation rate, bloating old generation | `jstat -gc`, `async-profiler`, GC logs |
| **NUMA remote access** | High cross-socket latency | `numastat`, `perf c2c` |

The hardware causes behind cache contention, memory bandwidth, and NUMA — the cache hierarchy and latency ladder, cache coherence protocols, NUMA topology — are in [Hardware and the Memory Hierarchy](./hardware.md).

## The Measurement Toolkit

### Linux System Level
| Tool | Purpose | Key commands |
|------|---------|-------------|
| `perf` | CPU sampling, caches, scheduling, memory access | `perf record -g -p PID`, `perf stat -e cycles,instructions,cache-misses,branch-misses` |
| `perf c2c` | Cache line contention / false sharing analysis | `perf c2c record -p PID`, `perf c2c report` |
| `perf sched` | Scheduling latency, migration, wakeup | `perf sched record`, `perf sched latency` |
| `bcc / bpftrace` | Kernel-level dynamic tracing | `biolatency`, `runqlat`, `offcputime` |
| `vmstat / pidstat / mpstat` | System/process/CPU-core metrics | `pidstat -w -p PID 1` (context switches) |
| `numastat` | NUMA local/remote access | `numastat -p PID` |

For the kernel-side causes of scheduling latency, preemption, and context switching (scheduling classes, affinity, cgroup quotas), see [Operating Systems and Concurrency](./os.md).

### JVM-Specific
| Tool | Purpose |
|------|---------|
| **JMH** | Microbenchmarks, throughput/latency distribution |
| **async-profiler** | Low-overhead CPU/memory/lock/GC flame graphs |
| **JFR (Java Flight Recorder)** | Production-grade event recording, post-hoc analysis |
| **jstack / jcmd Thread.print** | Thread snapshots, deadlock detection |
| **jstat -gc / GC logs** | GC causes, frequency, pauses |
| **Arthas** | Live diagnostics, monitoring, decompilation |
| **HdrHistogram** | High-precision latency distribution recording |

### Go/Rust/C++
| Ecosystem | Tools |
|-----------|-------|
| Go | `pprof` (CPU/memory/blocking/mutex), `trace`, drag-and-drop flame graphs |
| Rust | `perf` plus `cargo bench`, `flamegraph`, `criterion.rs` |
| C++ | `perf`, `Google Benchmark`, `VTune`, `gperftools` |

## Analysis Methodology

### 1. The RED / USE Rules
- **RED** (request perspective): Rate, Errors, Duration
- **USE** (resource perspective): Utilization, Saturation, Errors

### 2. Reading Flame Graphs
- **Width = sample count / time share**: a wide block at the top = a hotspot
- **Flat tops**: lock waiting, I/O, Park
- **Saw teeth**: recursion, frequent function calls
- **Color**: usually colored by package/module

### 3. Critical Path Analysis
```
User request -> Network -> Deserialization -> Business logic (locks/caches/DB) -> Serialization -> Network
                                   ^                                    ^
                            concurrency bottleneck            concurrency bottleneck
```

### 4. Comparative Baselines
| Comparison dimension | Purpose |
|---------------------|---------|
| Single-threaded vs multithreaded | Quantify the benefit of parallelism and the cost of synchronization |
| Lock-free vs locked | Evaluate the benefit/cost of lock-free |
| Different queues/maps | Validate a selection |
| Different JVM parameters | GC/compiler tuning |
| Different hardware | Capacity planning, selection |

## An Optimization Pattern Library

### 1. Reducing Synchronization Overhead
| Pattern | Applies to | Benefit | Cost |
|---------|-----------|---------|------|
| **Lock-free / atomics** | Simple state, counters | Eliminates blocking and context switches | ABA, complex memory ordering |
| **Sharding / segmented locking** | High-concurrency maps/caches | Parallelism times the shard count | Memory, complex resizing |
| **Read-write locks / RCU** | Read-heavy/write-light | Lock-free reads | Write amplification, reclamation latency |
| **ThreadLocal / thread-local aggregation** | Statistics, buffering | Zero synchronization | Merging overhead, memory |
| **Batch/merge operations** | High-frequency small operations | Amortized synchronization cost | Latency jitter |
| **Async/pipelining** | Serial dependency chains | Higher throughput | Increased latency, complexity |

### 2. Eliminating False Sharing
```java
// JDK 8+ @Contended (JEP 142; application classes need -XX:-RestrictContended)
@Contended class Counter { volatile long value; }

// Manual padding
class Counter { 
    volatile long value;
    long p1, p2, p3, p4, p5, p6, p7; // a cache line is 64 bytes
}
```
**Verify**: watch `LLC Misses` and `Remote HITM` fall under `perf c2c`.

### 3. Cache-Friendly Layout
| Technique | Description |
|-----------|-------------|
| **Struct of Arrays (SoA) from Array of Structs (AoS)** | Hot fields contiguous, prefetch-friendly |
| **Compact objects** | `-XX:+UseCompressedOops`, avoid object-header bloat |
| **Prefetching** | `__builtin_prefetch` / `PrefetchHint` |
| **Large pages** | `-XX:+UseLargePages` / `hugepages` to reduce TLB misses |

### 4. Thread Pool Tuning
```java
// CPU-bound: core count + 1
int cpu = Runtime.getRuntime().availableProcessors();
ThreadPoolExecutor cpuPool = new ThreadPoolExecutor(
    cpu, cpu, 0, TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(1024)
);

// I/O-bound: 2 * core count or more (rule of thumb)
ThreadPoolExecutor ioPool = new ThreadPoolExecutor(
    cpu * 2, cpu * 4, 60, TimeUnit.SECONDS,
    new LinkedBlockingQueue<>()
);
```
**Key parameters**: core/max threads, queue type/bounds, rejection policy, thread factory (naming, priority).

### 5. JVM Concurrency Tuning Parameters
| Parameter | Description | Typical value |
|-----------|-------------|---------------|
| ~~`-XX:+UseBiasedLocking`~~ | Biased locking: deprecated in JDK 15 (JEP 374), removed in JDK 18; passing it to JDK 21 reports `Unrecognized VM option` directly, so do not tune it in newer versions | Removed |
| ~~`-XX:BiasedLockingStartupDelay=0`~~ | Same as above, removed along with biased locking | Removed |
| `-XX:+UseHeavyMonitors` | A diagnostic switch: force heavyweight monitors (for debugging), **disabled by default**, not an "optimization that is on by default" | Debugging |
| `-XX:+EliminateLocks` | Lock elimination via escape analysis | Enabled by default |
| `-XX:+UseContainerSupport` | Container-aware CPU/memory | Enabled by default |
| `-XX:ActiveProcessorCount=N` | Override the available core count | Set when container-limited |
| `-XX:ParallelGCThreads=N` | GC parallel threads | All cores when <= 8, about 5/8 when > 8 |
| `-XX:ConcGCThreads=N` | G1/ZGC concurrent threads | Default `(ParallelGCThreads + 2) / 4` |

## A Full-Link Tuning Case Study

### Scenario: a high-concurrency HTTP gateway misses its throughput target
```
Symptoms: a 16-core machine, target 100k QPS, measured 35k QPS, CPU 45%, p99 latency 200ms
```

#### Step 1: TOP-DOWN Localization
```bash
perf stat -e cycles,instructions,cache-misses,branch-misses -p PID
# CPI 2.8 (ideal < 1.0), cache-miss 12%, branch-miss 3%
```

#### Step 2: Flame Graph
```bash
async-profiler -d 60 -f flame.html -e cpu -p PID
# Wide blocks: ConcurrentHashMap.get (35%), ArrayBlockingQueue.put (28%), JSON serialization (15%)
```

#### Step 3: Drill-Down Analysis
- **CHM.get is hot**: contention on hot keys -> read-heavy/write-light -> switch to `StampedLock` optimistic reads / local cache / `Caffeine` cache
- **ABQ.put is hot**: bounded queue saturated and blocking -> producer-consumer falls behind -> resize / fan out into multiple queues / Disruptor
- **JSON is hot**: serialization overhead is large -> switch to a `Jackson` backend / `simdjson` / Protobuf

#### Step 4: Verify Each Change
| Optimization | QPS improvement | p99 latency change |
|--------------|-----------------|--------------------|
| Local cache for hot keys | 35k -> 52k | 200ms -> 80ms |
| Disruptor replacing ABQ | 52k -> 78k | 80ms -> 35ms |
| Protobuf replacing JSON | 78k -> 95k | 35ms -> 18ms |
| Separate IO/CPU thread pools | 95k -> 110k | 18ms -> 12ms |

#### Step 5: Acceptance Under Stress
- Sustained 100k QPS, p99 < 20ms, CPU 70%, zero errors, no leaks over 4 hours

## Load Balancing

After single-machine optimization is exhausted, the next jump in throughput is to spread requests across many machines — and the balancing strategy decides how evenly they spread:

| Strategy | Criterion | Suitable for | Traps |
|----------|-----------|--------------|-------|
| Round-robin / weighted round-robin | Order or weights | Homogeneous backends, uniform cost | Weights for heterogeneous backends are hard to tune |
| Least connections | Current active connection count | Highly variable request durations | Connection count does not equal load |
| Consistent hashing | Hash of the request key | Stateful caches, session stickiness | Adding/removing nodes shifts only 1/N of the keys ([Karger 1997](https://dl.acm.org/doi/10.1145/258533.258660)); too few virtual nodes cause skew |
| Consistent hashing plus least connections hybrid | Pick the best within a hash shard | Cache clusters | Structurally complex; prove you need it first |

Three costs of the balancer itself must be accounted for: **the false-negative window of health checks** (requests keep hitting a bad node until the next probe), **retry amplification** (one failure retried once at each layer yields exponentially many downstream requests), and **the conflict between session stickiness and scaling** (the stickier it is, the more a rolling scale-out hurts). Rate limiting, circuit breaking, and degradation at the entry layer belong to traffic governance; see [Application Survey](../research/applications.md). Connection dispatch under event-driven structures is in [Reactor and Event-Driven](../practice/reactor.md).

## Caching Strategy

Caching is the single largest "trade space and consistency for latency" item in a high-concurrency system; design the read and write paths separately:

| Pattern | Read | Write | Consistency |
|---------|------|-------|-------------|
| **Cache-Aside** | Check the cache first, fall back to the DB and refill on a miss | Write the DB first, then invalidate the cache | Highest latency, most general |
| **Read-Through** | The cache proxy goes back to the source and refills | Same as Cache-Aside | DB access funnels through the cache layer |
| **Write-Through** | Same as above | Write the cache first, which synchronously writes the DB | Higher write latency, reads almost always hit |
| **Write-Behind** | Same as above | Write the cache only, flush to the DB asynchronously | Fastest writes, data lost on crash, only for discardable data |

Three classic cache failures and their fixes:

1. **Penetration** (queries for a nonexistent key bypass the cache and hit the DB): put a bloom filter in front, or cache the null value with a short TTL
2. **Breakdown** (the instant a single hot key expires, a flood of requests all go to the source): make the hot key never expire or rebuild it asynchronously, and add singleflight/mutual exclusion around the source fetch — the race during rebuild has the same root as Facebook Memcache's lease fix; see [Application Survey](../research/applications.md)
3. **Avalanche** (large batches of keys expire at once or the cache is invalidated wholesale): add jitter to TTLs to spread them, back the cache layer up with rate limiting and degradation, and pre-warm before switching traffic

The reliability of invalidation notification is hidden foundation: under replication, "the DB write succeeded but the invalidation message was lost" leaves permanent dirty data, and strongly consistent scenarios need double-delete or binlog-driven subscribed invalidation.

## Stress Testing and Monitoring

Stress testing is not "send a bunch of requests and see if it holds"; it is **finding the capacity boundary and the failure modes before going to production**:

| Phase | What to do | Key points |
|-------|-----------|-----------|
| Modeling | Set concurrency and request mix from target QPS times the peak factor | The mix should follow the real production distribution, not just the hottest endpoints |
| Baseline | Stress a single machine/instance, find the knee | Increase load step by step until throughput stops rising and latency starts jumping |
| Full link | Stress the shadow DB/shadow path at the peak factor | All dependencies are either real or proportionally scaled down; stress both warm and cold caches |
| Stability | Hold the target load for 4-24 hours | Watch memory, connections, and thread counts for monotonic growth (slow leaks) |
| Fault drills | Pull nodes, cut dependencies, inject latency | Verify that degradation and circuit breakers actually trigger, not just in the runbook |

Monitor along both the RED (request rate, error rate, latency distribution) and USE (utilization, saturation, errors) lines, then fold in the PSI (CPU/memory/IO pressure) from the [Operating Systems and Concurrency](./os.md) layer — application-layer latency spikes often only become distinguishable as your own lock contention versus machine-level queuing once PSI is included. How to read flame graphs and `perf` is covered in the measurement toolkit above; SLO definitions and Little's Law capacity estimates are in the next section.

## Capacity Planning Formulas

### Little's Law
```
L = lambda x W
Concurrency = throughput x average latency
```
- **Thread pool size** is approximately target QPS times **average** latency (seconds) — note that this is the mean, not p99: the W in Little's Law is the average residence time, and using p99 systematically overestimates the concurrency
- **Queue length** is approximately burst traffic times processing time

### Scaling Trigger Thresholds
| Metric | Alert threshold | Scaling action |
|--------|-----------------|----------------|
| CPU utilization | > 70% (sustained 5 min) | Scale horizontally |
| Queue backlog | > 80% of queue capacity | Scale out consumers / rate-limit upstream |
| p99 latency | > 2x the SLA | Circuit break / degrade / scale |
| GC pauses | > 200ms or > 3 times per hour | Tune GC / add heap / off-heap |

## Performance Regression Protection

### CI-Integrated Benchmarks
```yaml
# GitHub Actions snippet
- name: Run JMH benchmarks
  run: ./gradlew jmh -Pjmh.includes="MyBenchmark"
- name: Compare with baseline
  run: |
    python compare.py baseline.json current.json --threshold 0.05
    # fail on a performance regression over 5%
```

### Checklist of Protected Key Benchmarks
- [ ] Core queue throughput/latency
- [ ] Map mixed read/write workload
- [ ] Lock contention microbenchmark (different thread counts)
- [ ] Allocation rate, GC frequency
- [ ] End-to-end API p50/p99/p999

## Chapter summary

Performance tuning is **experimental science**, not mysticism:
1. **Establish a baseline**: RED/USE metrics, microbenchmarks, full-link stress tests
2. **Localize the bottleneck**: `perf` plus flame graphs plus the critical path; refuse to guess
3. **Optimize with patterns**: reduce synchronization, eliminate false sharing, go cache-friendly, pool, and go async
4. **Verify quantitatively**: A/B comparisons, regression tests, long-run stability
5. **Document the trade-offs**: throughput vs latency, consistency vs performance, complexity vs benefit

Beyond the single machine there are two more amplifiers: **load balancing** spreads requests across many machines (consistent hashing spreads them most steadily), and **caching** blocks repeated computation before it reaches the DB (penetration/breakdown/avalanche each have their own fix) — both scaling and caching must first use stress tests to find the knee and the failure modes, or you are merely postponing the failure until the day the peak arrives.

**The ultimate tenet**: premature optimization is the root of all evil; **refusing to optimize is the immortal root of all evil**. On top of correctness, optimize ruthlessly where the bottleneck is, and let the non-bottlenecks be.

## Sources

- Little's Law comes from J. D. C. Little, *A Proof for the Queuing Formula L = lambdaW*, Operations Research 9(3), 1961
- The USE method and how to read flame graphs are in [Brendan Gregg: USE Method](https://www.brendangregg.com/usemethod.html) and [Flame Graphs](https://www.brendangregg.com/flamegraphs.html)
- Consistent hashing comes from D. Karger et al., *Consistent Hashing and Random Trees* (STOC 1997)
- The engineering source for cache invalidation and singleflight source fetches: P. Nishtala et al., *Scaling Memcache at Facebook* (NSDI 2013), dissected in [Application Survey](../research/applications.md)
- The disablement and deprecation of biased locking come from [JEP 374](https://openjdk.org/jeps/374) (JDK 15), removed starting with JDK 18

## References

- [Wikipedia: Amdahl's law](https://en.wikipedia.org/wiki/Amdahl%27s_law)
- [Wikipedia: Little's law](https://en.wikipedia.org/wiki/Little%27s_law)
- [Wikipedia: Sequential consistency](https://en.wikipedia.org/wiki/Sequential_consistency)

<!-- BACKLINKS-AUTO -->
## Related pages

- [hardware](hardware.md)
- [os](os.md)
- [trends](trends.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [reliability](/practice/reliability.md)
- [seven-weeks](/practice/seven-weeks.md)
- [applications](/research/applications.md)
