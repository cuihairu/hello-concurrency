# High Concurrency Knowledge Base: Main Document

This page consolidates the knowledge points scattered across the 35 pages of the main text and the four research documents under docs/research/ (authoritative books, official memory model specifications, application scenarios, and the coverage audit diff table) onto a single page, keeping only conclusions and navigation; the evidence-gathering process lives in the drafts.

Source attribution rules: specification-level conclusions defer to the four spec texts fetched on 2026-10-08 (JLS SE21, the C++ working draft, the Rust Reference, and the Go Memory Model); the item-by-item cross-check process is in [memory-model-specs.md](./research/memory-model-specs.md). Bibliographic metadata comes from publisher and Douban entries; scenario points come from public engineering articles and project READMEs, with sources on the corresponding page under research/. The research's own judgments are marked "research conclusion". As of the writing date (2026-10-10), this page has no unsubstantiated entries; later additions without a source will be marked "no source found" in place.

## 1. Core concepts

### Basics and synchronization primitives

1. **Concurrency and parallelism**: Concurrency interleaves multiple tasks within the same time window; parallelism executes them physically at the same moment. A single core relies on time-slice rotation; only multiple cores give true parallelism. I/O waits run to milliseconds, tens of thousands of CPU cycles, so the first value of concurrency is making waits overlap each other. See [basics/concepts.md](./basics/concepts.md).

2. **Threads and processes**: The process is the basic unit of resource allocation; the thread is the basic unit of CPU scheduling. Threads share an address space, so a context switch does not flush the TLB — flushing the TLB is the job of process switching. Thread models split into user-level, kernel-level, and two-level; goroutines and Java virtual threads are two-level. See [basics/thread-process.md](./basics/thread-process.md).

3. **Critical section and mutual exclusion**: The three elements of a critical section are a shared resource, the critical-section code, and a mutual-exclusion mechanism. Implementations of mutual exclusion fall into three layers: hardware atomic instructions (TSL, CAS, LL/SC), OS primitives (mutex, spinlock, semaphore), and language-library abstractions. See [basics/critical-section.md](./basics/critical-section.md).

4. **Memory semantics of locks**: Acquiring a lock has acquire semantics, releasing it has release semantics, and unlock hb lock forms a complete happens-before chain. A mutex = a binary semaphore + ownership, and ownership is the decisive difference between the two. See [sync/locks.md](./sync/locks.md), [sync/semaphores.md](./sync/semaphores.md).

5. **Condition variables**: A condition variable does not protect data; it only coordinates timing, and must be paired with a mutex. Three iron rules: wrap wait in a while loop (guards against spurious wakeup and lost signal), modify the condition and signal inside the same critical section, and use signal by default with broadcast only for global state changes. See [sync/condition-variables.md](./sync/condition-variables.md).

6. **Barriers**: CyclicBarrier is reusable and carries a barrier action, suiting iterative parallelism; CountDownLatch is one-shot, suiting startup and shutdown synchronization. Phaser supports dynamic registration and hierarchical trees; Go's WaitGroup is reusable once the count reaches zero, unlike the one-shot latch. See [sync/barriers.md](./sync/barriers.md).

7. **Deadlock, livelock, and starvation**: Coffman's four necessary conditions for deadlock are mutual exclusion, hold-and-wait, no preemption, and circular wait — breaking any one prevents it. The root cause of livelock is synchronized retry strategies; the fix is randomized backoff or queueing. The extreme form of starvation is priority inversion, solved by a priority-inheritance protocol. See [basics/deadlock-livelock.md](./basics/deadlock-livelock.md).

### Concurrency models

8. **Actor** (Hewitt 1973): Everything is an Actor — private state, asynchronous messages, in-order processing within a single Actor. Of the three message-delivery semantics, the engineering reality is "at least once", so the business layer must be idempotent. See [models/actor.md](./models/actor.md).

9. **CSP** (Hoare 1978): Processes communicate synchronously through channels and do not share memory. The rendezvous point of an unbuffered channel is an implicit barrier, and backpressure propagates automatically; send happens-before receive. Go made CSP a language builtin. See [models/csp.md](./models/csp.md).

10. **STM and the Clojure way**: Bring database transactions into in-memory concurrency — optimistic execution, conflict detection, automatic retry. It eliminates deadlock and is composable, but no I/O inside a transaction, and for high-contention write hotspots and real-time workloads it loses to locks. The body of chapter 4 is separating identity from state: values are immutable, identity points to values, ref coordinates multi-identity linkage, atom is single-identity CAS, agent updates asynchronously through a queue, and persistent data structures lean on structural sharing to "produce a snapshot by mutation". See [models/stm.md](./models/stm.md).

11. **Dataflow**: Build computation as a DAG that fires when input is ready, so identical input always yields identical output, with no shared mutable state and backpressure propagating along edges. In the book it is day three of the functional chapter; this repo gives it a standalone page. See [models/dataflow.md](./models/dataflow.md).

12. **Functional concurrency**: Mutability is the root of concurrency problems; remove it first and locks have no reason to exist — pure functions, immutable data, and referential transparency make parallelism a natural property of the code. pmap/fold provide multi-core parallelization, and future/promise express execution order via data dependencies. See [models/functional.md](./models/functional.md).

13. **Data parallelism**: The same program applies to every slice of the data, so parallelism comes from the data itself — the opposite direction of Actor/CSP task parallelism. GPUs use massive threads to hide memory latency, and kernel/work-group/NDRange is a direct translation of SIMT; tree reduction is O(log n) but requires the combine operation to be associative. See [models/data-parallel.md](./models/data-parallel.md).

14. **Lambda architecture**: If it cannot finish, split into two paths — a batch layer that slowly computes the full set, a speed layer that quickly computes the increment, and a serving layer that merges at query time; an immutable main dataset lets errors be fully recomputed. The cost is writing the same logic twice; the Kappa architecture trades log replay for a single code path. See [models/lambda-architecture.md](./models/lambda-architecture.md).

### Lock-free and memory model

15. **Hardware and memory hierarchy**: Cache-coherence protocols (MESI/MOESI) set the cost of multi-core shared memory — writing shared data requires invalidating others' copies first; store buffers and invalidation queues introduce reordering, and barrier instructions plus language memory ordering are the constraints on them; NUMA and the memory hierarchy set the upper limit on concurrency gains. See [advanced/hardware.md](./advanced/hardware.md).

16. **OS and concurrency**: The surface appearances of locks, thread pools, and event loops all resolve in the kernel — futex determines the real cost of lock contention (user-space fast path plus kernel suspend/wake), scheduler classes and preemption determine latency jitter, and page tables/TLB/page faults plus cgroup limits determine periodic stalls in large-memory services and in-container OOM; two-level scheduling decouples parallelism from thread count. See [advanced/os.md](./advanced/os.md).

17. **Programming languages and concurrency support**: Four languages, four responsibility boundaries — Java has the largest library (concurrency package plus Loom virtual threads), C++ gives the most control (primitives only; you handle the memory model and reclamation yourself), Go builds scheduling into the runtime (goroutine + channel), and Python leaves parallelism to processes and the event loop (under the GIL, asyncio rules). Choosing a language is choosing "who is responsible for scheduling and correctness". See [advanced/languages.md](./advanced/languages.md).

18. **CAS and LL/SC**: The two major hardware primitives. CAS has the ABA problem (A→B→A misjudged as success); fixes are tagged pointers, version numbers, or Hazard Pointers. LL/SC has no ABA, but no system call or interrupt may be inserted between the two instructions. See [advanced/lockfree.md](./advanced/lockfree.md).

19. **Lock-free memory reclamation**: The Achilles' heel of lock-free programming. When a node is removed, other threads may still be accessing it, so you cannot free it immediately; Hazard Pointers give low latency, EBR high throughput, RCU zero read overhead — choose by scenario. See [advanced/lockfree.md](./advanced/lockfree.md).

20. **Progress guarantees**: Three tiers — wait-free (guaranteed completion in a bounded number of steps), lock-free (the system as a whole makes progress, individual threads may starve), obstruction-free (guaranteed completion when executing alone); most lock-free data structures are lock-free rather than wait-free. See [advanced/lockfree.md](./advanced/lockfree.md).

21. **happens-before**: The partial-order tool for reasoning about visibility, with six rules: program order, monitor locks, volatile and same-variable atomics, thread start, thread termination, and transitivity. Sequential consistency is strongest but slowest. See [advanced/memory-model.md](./advanced/memory-model.md).

22. **A data race has different consequences across the four languages**: The same "data race" draws different consequences in the four specs — C++/Rust make it UB, Java loses the sequential-consistency guarantee but the behavior remains defined, and Go invalidates the DRF-SC guarantee when races are not eliminated, with implementations permitted to detect and abort. When writing cross-language concurrent code, sort out this difference first. Sources in [memory-model-specs.md](./research/memory-model-specs.md); body page [advanced/memory-model.md](./advanced/memory-model.md).

23. **Three tiers of memory ordering**: seq_cst places all operations on a single total order S; release/acquire takes effect only on a single object along a single publish–subscribe chain and does not connect across objects; relaxed guarantees only atomicity, not order. Start with seq_cst for correctness, then downgrade based on load testing. See [advanced/memory-model.md](./advanced/memory-model.md).

### Data structures and performance

24. **Choosing queues and Maps**: For queue selection, first decide whether you need backpressure — if yes, choose a bounded blocking queue or a Disruptor; if no, choose a lock-free queue (JCTools, ConcurrentLinkedQueue). For Maps, default to ConcurrentHashMap (JDK 8+ dropped segmented locks in favor of CAS plus locking the first node of a bucket); for order, use ConcurrentSkipListMap. See [advanced/data-structures.md](./advanced/data-structures.md).

25. **Atomizing composite operations**: Splitting check-then-act into two steps creates a race; use atomic composite methods such as remove(k, v), computeIfAbsent, and merge. Iterators are weakly consistent — they do not throw CME, and size() is an estimate. See [advanced/data-structures.md](./advanced/data-structures.md).

26. **Counter sharding and false sharing**: For high-concurrency counting, use LongAdder rather than AtomicLong — sharding eliminates single-point CAS contention and reads merge the shards. Eliminate false sharing with @Contended, padding, or alignas(64); verify with perf c2c. See [advanced/data-structures.md](./advanced/data-structures.md).

27. **Capacity planning**: Little's Law: concurrency = throughput × average latency. W is the mean, not p99; using p99 systematically overestimates thread count. See [advanced/performance.md](./advanced/performance.md).

28. **The tuning loop**: Four steps — measure, analyze, optimize, verify. RED (request view) and USE (resource view) set the metrics; read width and plateaus in flame graphs; do not change what you have not measured. See [advanced/performance.md](./advanced/performance.md).

29. **Two-tier amplification from scaling and caching**: Once a single machine is exhausted, scale out with load balancing and caching — consistent hashing is the steadiest spread (insufficient virtual nodes cause skew), and retry amplification plus the false-positive window of health checks are the balancer's own cost. Use a Bloom filter or short-TTL null values for cache penetration, single-flight rebuild for breakdown, and TTL jitter for avalanche; when invalidation notifications are unreliable, strong-consistency scenarios use double delete or binlog-subscribed invalidation. Load testing must precede scaling to find the inflection point and failure modes. See [advanced/performance.md](./advanced/performance.md).

### Practice

30. **Thread-pool parameter combinations**: The pitfalls concentrate on queue type — an unbounded queue makes maxPoolSize never take effect, so tasks pile up until OOM; only a bounded queue gives the rejection policy a chance to run. Matching thread count to cores for CPU-bound and 2× cores for I/O-bound is a starting point, not an answer. See [practice/thread-pool.md](./practice/thread-pool.md).

31. **Producer-consumer**: The engineering triangle is buffering, synchronization, and backpressure. Bounded is the iron rule; the six backpressure strategies (blocking, drop-new, drop-old, degrade, scale out, Reactive Streams) are chosen by business need; multiple consumers come in three modes — competing consumption, broadcast, and sharded ordered. See [practice/producer-consumer.md](./practice/producer-consumer.md).

32. **Reader-writer**: The three variants are reader-priority (writers may starve), writer-priority (readers may starve), and fair rotation; lock downgrade is supported, lock upgrade deadlocks. StampedLock is not reentrant and does not support Condition; once the optimistic-read failure rate exceeds 5%, fall back to pessimistic. See [practice/reader-writer.md](./practice/reader-writer.md).

33. **Framework selection**: An architectural decision, balanced across four axes — problem domain, consistency requirements, team stack, and operational maturity. Use simple tools for simple problems: thread pool > Actor > workflow; team familiarity outweighs technological sophistication. See [practice/framework-selection.md](./practice/framework-selection.md).

34. **Reactor and event-driven**: The answer to C10K is event-driven, not more threads — a few threads use I/O multiplexing to wait for events and dispatch only when ready. Handlers must be non-blocking (push expensive work down to a business thread pool), event-loop count ≈ core count, and backpressure rides on write-buffer watermarks. Master-worker Reactor (Netty boss/worker) is the default structure for high connection counts. See [practice/reactor.md](./practice/reactor.md).

35. **Async programming and Future**: Once you take waiting out of the thread, the expression style keeps converging — callbacks are hard to compose, Future/Promise solve single-result composition, reactive streams add backpressure via request(n), and async/await pulls it back into sequential code with structured concurrency holding the scope. Three implementation disciplines: compose rather than wait, cancellation propagates through the whole chain (Go context, Kotlin structured scope), and no CPU-bound work inside coroutines. See [practice/async.md](./practice/async.md).

36. **Reliability design**: Reliability is not "no failures" but "serve correctly even when failing". Three main lines: failure is the norm, so timeouts, retries, and degradation are everyday code; a timeout is not a failure, so answer "is repeated execution harmful" before retrying — idempotency keys come before retries, and a fencing token comes before trusting a lease; strong consistency must be bought with cost, and the consistency level is a business decision, not a technical default. A distributed lock is not SETNX plus expiry — the lock service needs a majority, and the write path must validate the token. See [practice/reliability.md](./practice/reliability.md).

37. **Concurrency and security**: An attacker actively manufactures interleavings, so "low race probability" is not a security argument. Three shapes in which a race becomes a vulnerability — TOCTOU and double-fetch are root-cured by making check and use atomic, resource exhaustion (locks, queues, connections) is root-cured by making every shared resource explicitly bounded, and timing/cache side channels are suppressed with constant-time comparison and isolation. See [advanced/security.md](./advanced/security.md).

38. **Frontier trends and outlook**: Read trends by tier — hardware in place (virtual threads, io_uring), engineering-validated (structured concurrency, Rust async, CRDT), paper/early (quantum concurrency, CXL pooling); the three tiers carry completely different implications for action. Three converging lines: structured concurrency replaces raw task submission, virtual threads make blocking cheap, and Rust moves data races into the compiler. Quantum parallelism and classical concurrency are not the same thing, and their direct input to concurrency engineering today is zero. See [advanced/trends.md](./advanced/trends.md).

39. **Seven-week concurrency practice log**: Week by week — Java thread pools and atomic composites, C++ lock-free and memory ordering, Go pipelines and backpressure, Python's GIL boundary, Actor supervision trees, Netty event-loop discipline, plus integrated load testing and failure drills. See [practice/seven-weeks.md](./practice/seven-weeks.md).

40. **Five responsibility boundaries across frameworks and tools**: Five ecosystems, five answers — Java gives only primitives with scheduling left to you, Akka takes over both state and scheduling leaving only messages, Netty manages just the event loop with business discipline yours, Go builds concurrency into the language leaving discipline to humans, and Python hands parallelism to processes and async to the event loop. Tools cannot replace principles: critical sections, bounded buffers, and the memory model all hold in every ecosystem. See [practice/frameworks.md](./practice/frameworks.md).

## 2. Key points from authoritative books

Four books support the skeleton of this repo; full editions, chapter structure, and the mapping to this repo are in [books.md](./research/books.md).

41. **Java Concurrency in Practice**: Brian Goetz and five co-authors, Addison-Wesley; Chinese edition translated by Tong Yunlan, China Machine Press 2012-2. Corresponding knowledge points: the skeleton of thread safety → object sharing → building blocks → task execution, plus thread-pool parameters, blocking queues, concurrent containers, and atomic variables, landing in [thread-pool.md](./practice/thread-pool.md), [data-structures.md](./advanced/data-structures.md), [producer-consumer.md](./practice/producer-consumer.md). A blurb by Doron Rajwan on the book's site is cited as the source of Amdahl's Law in concurrency books, see [concepts.md](./basics/concepts.md).

42. **C++ Concurrency in Action (2nd edition)**: Anthony Williams, Manning 2019-02; Chinese edition translated by Wu Tianming, Posts & Telecom Press · Asynchronous Books 2021-11. Corresponding knowledge points: the chapter order of memory ordering first, then lock-free algorithms, plus CAS, memory reclamation, and std::lock multi-lock acquisition, landing in [memory-model.md](./advanced/memory-model.md), [lockfree.md](./advanced/lockfree.md), [locks.md](./sync/locks.md).

43. **The Rustonomicon**: Rust's official unsafe monograph, subtitled The Dark Arts of Unsafe Rust; the authors themselves state it remains incomplete. Corresponding knowledge points: aliasing rules, the Send/Sync contract, and unsafe boundaries — read alongside the UB list in the Rust Reference, landing in [locks.md](./sync/locks.md), [memory-model.md](./advanced/memory-model.md).

44. **Seven Concurrency Models in Seven Weeks**: Paul Butcher, PragProg 2014-07; Chinese edition translated by Huang Yan, Posts & Telecom Press 2015-3. Corresponding knowledge points: the list and arrangement of the seven models, with chapters 2-8 all landed in this repo (threads and locks, functional programming, the Clojure way, Actor, CSP, data parallelism, Lambda architecture); the comparison table is in [books.md](./research/books.md). The dataflow page is added by this repo; in the book it is day three of the functional chapter, and the scope follows books.md.

45. **Citation scope** (research conclusion): For concept definitions and trap lists, consult the books; where a rule can be traced to a spec clause, the spec text governs; when a book and a spec conflict, write it per the spec and note the source on the page. The four books supply only structure and explanation; all example code is written fresh, never copied from the books. See [books.md](./research/books.md).

## 3. Key points from official documentation (with links)

Specification-level conclusions defer to the source text; the six entry points are below. The item-by-item cross-check and the four-language comparison table are in [memory-model-specs.md](./research/memory-model-specs.md).

46. **JLS SE21 §17.4 Threads and Locks**: [docs.oracle.com](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html). The whole JMM chapter; §17.4.5 is the source of the data race definition and the "properly synchronized" criterion.

47. **C++ working draft [intro.races]**: [eel.is](https://eel.is/c++draft/intro.races). The original wording of "Any such data race results in undefined behavior".

48. **C++ working draft [atomics.order]**: [eel.is](https://eel.is/c++draft/atomics.order). The single total order S for seq_cst and the four coherence constraints.

49. **Rust Reference: Behavior considered undefined**: [doc.rust-lang.org](https://doc.rust-lang.org/reference/behavior-considered-undefined.html). The first entry in the UB list is Data races, and the scope explicitly includes unsafe blocks. Read alongside [The Rustonomicon](https://doc.rust-lang.org/nomicon/) — the Reference states the rules, the Nomicon explains why.

50. **std::sync::atomic**: [doc.rust-lang.org](https://doc.rust-lang.org/std/sync/atomic/index.html). Rust atomics follow the C++20 [intro.races] rules minus consume; when comparing across languages, count it as one rule and do not double count.

51. **The Go Memory Model** (2022-06-06 edition): [go.dev/ref/mem](https://go.dev/ref/mem). The DRF-SC conclusion and the clause that "implementations may detect races and abort"; in practice -race is exactly what does this.

## 4. Application scenarios

The full breakdown and sources for both scenario classes are in [applications.md](./research/applications.md).

52. **Concurrency shape of high-concurrency services**: Thread pools plus async I/O, with connection counts far exceeding worker-thread counts — requests queue up and are returned as soon as processed. Tomcat defaults to 200 worker threads; when requests exceed threads, new requests can only spin. This is the most primitive form of rate limiting (source: Tencent Cloud developer community traffic-governance article).

53. **Five traffic-governance levers**:

| Lever | What it does | Key point |
| --- | --- | --- |
| Rate limiting | Cap the quantity of resources; buffer or directly reject the excess | Counters are not smoothed; in practice leaky bucket and token bucket are used more; rate limiting is provided by the service provider |
| Circuit breaking | Cut off the call when the downstream fails and return a default result | Provided by the caller, preventing a hung A→B→C chain from dragging down the thread pool |
| Degradation | Shut down non-core traffic in bulk at the entry | Best suited to the Nginx/DNS entry layer |
| Warm-up | Ramping traffic onto a new node slowly | With no JIT compilation and cold caches, taking 1/N of traffic directly may crash it |
| Backpressure | The callee continuously reports its processing capacity and the caller adjusts speed accordingly | One layer of feedback over fixed rate limiting; the TCP sliding window is the prototype |

54. **What this layer tests**: Four things — queue depth and backpressure (unbounded growth merely defers the failure to OOM), critical-section length (a network call inside a lock is a throughput cliff), false sharing, and graceful shutdown. The standard answer for cross-datacenter hot caches is Facebook's Memcache cluster (NSDI '13), which uses a lease to handle the race between cache invalidation and refill.

55. **Concurrency shape of game servers**: Unlike the Web, a single player's actions execute in order, so concurrency is only needed for cross-player interaction, and state is heavily shared. The mainstream solution is to collect shared state into actors, with each actor processing messages on a single thread. skynet is the representative of this line: the framework in C, business logic in Lua, each actor with its own isolated VM plus a message queue, and a scheduler dispatching in fair rotation (source: [cloudwu/skynet README](https://github.com/cloudwu/skynet)).

56. **Problems unique to game servers**: Logic frames and timers (single-threaded main loop plus a time wheel), state synchronization (snapshot interpolation, interest management), broadcast storms (merged writes, split-frame sending), disconnect/reconnect (session timeout and snapshot replay), hot updates (hot-swap at the script layer), backpressure (write-queue cap; kick over-limit players rather than block). The frame loop is extremely sensitive to latency jitter — GC pauses and lock contention turn directly into dropped frames.

57. **Scenario-to-chapter mapping**:

| Scenario need | Corresponding page |
| --- | --- |
| Queued execution of connections and tasks | [thread-pool.md](./practice/thread-pool.md) |
| Bounded queues, backpressure, multiple consumers | [producer-consumer.md](./practice/producer-consumer.md) |
| Read-heavy scenario state | [reader-writer.md](./practice/reader-writer.md) |
| Actor-ified entities and messages | [actor.md](./models/actor.md) |
| Pipeline-style flow and cancellation | [csp.md](./models/csp.md) |
| Read-heavy shared cache | [data-structures.md](./advanced/data-structures.md) |
| Cache coherence, NUMA, and memory hierarchy | [hardware.md](./advanced/hardware.md) |
| OS scheduling, context switching, and virtual memory | [os.md](./advanced/os.md) |
| Cross-language concurrency comparison and selection | [languages.md](./advanced/languages.md) |
| Massive historical data + real-time queries coexisting | [lambda-architecture.md](./models/lambda-architecture.md) |
| Counting, latency, and capacity planning | [performance.md](./advanced/performance.md) |
| Load balancing, cache invalidation, and load-test acceptance | [performance.md](./advanced/performance.md) |
| Framework and architecture selection | [framework-selection.md](./practice/framework-selection.md) |
| High connection counts, async I/O event dispatch | [reactor.md](./practice/reactor.md) |
| Fault tolerance, distributed locks, and transactions | [reliability.md](./practice/reliability.md) |
| Ecosystem tool quick reference and responsibility boundaries | [frameworks.md](./practice/frameworks.md) |
| Race vulnerabilities, resource exhaustion, and side channels | [security.md](./advanced/security.md) |
| Trend judgment and tiering | [trends.md](./advanced/trends.md) |
| Week-by-week practical exercises and acceptance | [seven-weeks.md](./practice/seven-weeks.md) |
| Async result composition, reactive backpressure, and cancellation propagation | [async.md](./practice/async.md) |

## 5. Common pitfalls and misconceptions

### Languages and memory model

58. **Treating "data race = UB" as a universal four-language conclusion**: It holds only for C++/Rust; Java loses the sequential-consistency guarantee but its behavior remains defined, and in Go the DRF-SC guarantee lapses. When writing cross-language comparisons, break it out separately per the four specs. See [memory-model.md](./advanced/memory-model.md).

59. **volatile does not block composite operations**: v++ is read-modify-write in three steps, so counting needs AtomicLong/LongAdder; a single volatile long read or write is atomic only from Java 5 onward. See [memory-model.md](./advanced/memory-model.md).

60. **Closing the task queue directly in a Go worker pool**: There is no synchronization mechanism between close and the concurrent `ch <- task`, so the race is `panic: send on closed channel`. The correct approach is a closed flag plus context cancellation, with the queue never closed from start to finish. See [thread-pool.md](./practice/thread-pool.md).

61. **Tuning the biased-lock parameters**: Deprecated in JDK 15, removed in JDK 18, and passing them in JDK 21 directly reports `Unrecognized VM option`. See [performance.md](./advanced/performance.md).

62. **Sizing threads by host core count inside a container**: When the cgroup CPU limit is below the host core count, too many threads contend; use ActiveProcessorCount or UseContainerSupport. See [thread-pool.md](./practice/thread-pool.md).

63. **Running CPU-intensive work on Python threads**: The GIL serializes bytecode execution, so maxing out core count still yields no parallelism; use multiprocessing, NumPy/C extensions that release the GIL, or the free-threaded build from 3.13 onward. See [languages.md](./advanced/languages.md).

### Locks and synchronization primitives

64. **Inconsistent lock ordering**: In multi-lock scenarios, not fixing a global lock order makes deadlock inevitable rather than incidental; avoid nested locks where possible, and when necessary acquire with std::lock simultaneously. See [critical-section.md](./basics/critical-section.md), [locks.md](./sync/locks.md).

65. **Using if instead of while for condition variables**: Both spurious wakeups and lost signals make the waiter miss the condition change, so wait must be wrapped in a while loop. See [condition-variables.md](./sync/condition-variables.md).

66. **Signal outside the lock in Java**: Java's Condition.signal() must be called while holding the lock, otherwise it throws IllegalMonitorStateException; POSIX is the opposite, where signaling outside the lock is legal and a common micro-optimization. The two APIs constrain in opposite directions, so mixing them is the easiest way to trip. See [condition-variables.md](./sync/condition-variables.md).

67. **Using StampedLock as a reentrant lock**: It is not reentrant and does not support Condition, so a second acquisition on the same thread deadlocks outright; once the optimistic-read failure rate stays above 5%, fall back to pessimistic reads. See [reader-writer.md](./practice/reader-writer.md).

68. **Upgrading a read-write lock**: Upgrading from a read lock to a write lock deadlocks; ReentrantReadWriteLock supports only downgrade. StampedLock's tryConvertToWriteLock returns 0 under contention, so you must release the read lock and then take the write lock. See [reader-writer.md](./practice/reader-writer.md).

69. **Doing network calls inside a lock**: A critical section containing I/O, sleeping, or logging sees throughput drop off a cliff; leave only shared-data access inside the critical section. See [critical-section.md](./basics/critical-section.md).

70. **Using fixed backoff for livelock**: Synchronized backoff on both sides produces synchronized retries and permanent contention; only randomized backoff or queueing breaks the symmetry. See [deadlock-livelock.md](./basics/deadlock-livelock.md).

71. **Unpaired semaphore P/V**: Counter drift causes deadlock or leaks, so wrap them in RAII; using a semaphore as a mutex drops the ownership protection. See [semaphores.md](./sync/semaphores.md).

72. **Priority inversion with no protection**: High priority waits on a lock held by low priority, medium priority preempts the CPU, and high priority waits forever — solved by a priority-inheritance protocol. See [deadlock-livelock.md](./basics/deadlock-livelock.md).

73. **Real-time priority threads never yielding**: SCHED_FIFO belongs to the real-time scheduling class and always outranks business threads, so an infinite loop starves the whole machine including the watchdog; cap RLIMIT_RTPRIO, leave RT threads with a guardian task, or switch to the bandwidth-limited Deadline class. See [os.md](./advanced/os.md).

### Lock-free and concurrency models

74. **Freeing lock-free nodes immediately**: Other threads may still be accessing them, so reclamation must go through Hazard Pointers, EBR, or RCU. See [lockfree.md](./advanced/lockfree.md).

75. **ABA with CAS**: During a pop, head goes A→B→A and CAS misjudges it as success; use tagged pointers or add a version number. See [lockfree.md](./advanced/lockfree.md).

76. **Unbounded Actor mailboxes**: A slow consumer drags the actor down, so mailboxes need a cap, flow control, and Pull mode. See [actor.md](./models/actor.md).

77. **Ignoring idempotency**: A distributed actor can only guarantee at-least-once delivery, so duplicate messages rely on an idempotency key for deduplication. See [actor.md](./models/actor.md).

78. **False immutability**: A closure captures a mutable object, so an immutable shell wraps a mutable core and still races; capture only immutable values, and route mutable sites through STM or Actor. See [functional.md](./models/functional.md).

### Practice and architecture

79. **Unbounded queues**: maxPoolSize never takes effect, and tasks pile up until OOM exposes the problem — a thread pool must be paired with an explicit rejection policy. See [thread-pool.md](./practice/thread-pool.md).

80. **Using p99 in Little's Law for thread count**: W is the average residence time, so using p99 systematically overestimates concurrency demand. See [performance.md](./advanced/performance.md).

81. **Ignoring GPU transfer cost**: host↔device traffic goes over PCIe, with bandwidth far below on-device memory, so shuttling data back and forth eats up the compute gains; keep data resident on the device and transfer in batches. See [data-parallel.md](./models/data-parallel.md).

82. **Treating floating-point differences in parallel reduction as bugs**: Floating-point addition does not satisfy strict associativity, so tree reduction and sequential accumulation can differ by rounding — an inherent property, so accept by tolerance. See [data-parallel.md](./models/data-parallel.md).

83. **Writing the same logic twice in the Lambda architecture**: The batch layer and speed layer use different frameworks, so the aggregation logic is double-implemented and changing the accounting rule means editing two places; when logic changes frequently, evaluate Kappa (log replay for a single code path). See [lambda-architecture.md](./models/lambda-architecture.md).

84. **Blocking calls inside a Handler**: The event loop dispatches all connections on a single thread, so if any Handler blocks (DB query, disk I/O, CPU-intensive work), every connection on that loop stalls; expensive operations must be pushed down to a business thread pool. See [reactor.md](./practice/reactor.md).

85. **Waiting segment by segment with get() in an async chain**: Using Future as a blocking handle serializes parallel tasks, making it slower than the synchronous version; use combinators or await to chain the dependencies. See [async.md](./practice/async.md).

86. **Cancellation does not propagate**: After cancelling upstream, downstream keeps computing, so tasks leak and resources hang; in Go pass a context and in coroutines use structured scope, so cancellation runs through the whole chain. See [async.md](./practice/async.md).

87. **Treating retries as a fix for timeouts**: A timed-out request may already have succeeded, so blind retries mean duplicate charges and duplicate messages; before retrying, answer "is repeated execution harmful", lead with idempotency keys, and add jitter to retries. See [reliability.md](./practice/reliability.md).

88. **Implementing a distributed lock as just SETNX plus expiry**: The lock service is a single point with no fencing token, so after a lock holder's GC pause expires the lease and it returns to write, double writes persist; the lock must go through a majority, with a monotonically increasing token validated by the storage side. See [reliability.md](./practice/reliability.md).

89. **Hot cache keys expiring into unshielded back-to-origin traffic**: A single hot key expires and a flood of requests hammers the database at once (breakdown); either keep hot keys from expiring or rebuild them asynchronously, and add single-flight to the origin fetch. See [performance.md](./advanced/performance.md).

90. **Independent retries at every layer amplifying**: One downstream failure retried once each at the gateway, service, and client means the downstream receives exponential requests; retries must converge (budget, backoff, idempotency), combined with circuit breaking to cut the chain. See [performance.md](./advanced/performance.md).

91. **Comparing keys with `str` comparison**: String comparison returns early, so comparison time depends on the key prefix and a timing attack can guess the key byte by byte; use a constant-time function for secure comparison (`MessageDigest.isEqual`, `CRYPTO_memcmp`). See [security.md](./advanced/security.md).

92. **Reopening the file after a permission check**: The check uses one path and the use opens it again, so between the two steps the path can be swapped for a symlink (TOCTOU); open once to get the fd, then use only the fd, or use `O_NOFOLLOW`. See [security.md](./advanced/security.md).

93. **Wrapping a thread pool around virtual threads**: Threads are already cheap, so pooling instead introduces a second scheduling and queueing pass, shifting the bottleneck from execution to submission; spawn virtual threads directly on demand, and reserve pools for genuinely scarce resources (DB connections, GPU). See [frameworks.md](./practice/frameworks.md).

## 6. Sources and navigation

Research drafts (item-by-item sources, fetch dates, cross-check records):

- [research/README.md](./research/README.md) — Research overview and master source table
- [research/books.md](./research/books.md) — Editions, chapter structure, and usage in this repo for the four books
- [research/memory-model-specs.md](./research/memory-model-specs.md) — Item-by-item cross-check of the four specs and the four-language comparison
- [research/applications.md](./research/applications.md) — Breakdown and chapter mapping for the two scenario classes
- [research/coverage-audit.md](./research/coverage-audit.md) — Coverage audit diff table (gaps G1-G4 all closed)

- [Glossary quick reference: glossary](./glossary.md) (Chinese-English pairs, one-line definitions, authoritative sources, and related pages).

## References

- [Go Memory Model](https://go.dev/ref/mem)
- [Java Memory Model (JLS 17)](https://docs.oracle.com/javase/specs/jls/se8/html/jls-17.html)
- [C/C++ memory ordering](https://en.cppreference.com/w/cpp/atomic/memory_order)

<!-- BACKLINKS-AUTO -->
## Related pages

- [reliability](/practice/reliability.md)
- [seven-weeks](/practice/seven-weeks.md)
