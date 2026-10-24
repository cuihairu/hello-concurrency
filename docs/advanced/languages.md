# Programming Languages and Concurrency Support

Concurrency primitives take very different shapes across languages: some push scheduling down into the runtime (Go), some offer only libraries and leave the rest to you (C++), and some carry historical baggage forward (Python's GIL). This page makes the horizontal comparison; for a deep dive into each language's memory semantics see [Memory Model](./memory-model.md), and for framework-level selection see [Concurrent Framework Selection](../practice/framework-selection.md).

## Master Comparison Table

| Language | Concurrency unit | Synchronization | Scheduler | Memory model |
|----------|------------------|-----------------|-----------|--------------|
| Java | Platform threads, virtual threads | synchronized, the AQS family (ReentrantLock etc.), the concurrency package | Platform threads = kernel threads; virtual threads scheduled by Loom | JMM (happens-before) |
| C++ | `std::thread` / `jthread` | `mutex`, `atomic`, `condition_variable` | No runtime; threads are 1:1 with kernel threads | C++ memory ordering (weak ordering optional) |
| Go | goroutine | The `sync` package, channels | Runtime M:N scheduling with work stealing | DRF-SC (the Go Memory Model) |
| Python | Threads, coroutines, processes | `threading`, `asyncio.Lock` | GIL, a single interpreter lock; coroutines on an event loop | Atomicity mostly via the GIL; no formal memory model |

## Java: Virtual Threads Added on Top of Platform Threads

`java.util.concurrent` is the most complete standard concurrency library of the four languages: AQS abstracts the skeleton of locks and synchronizers, and the thread pools, concurrent containers, and atomic classes cover most of the engineering practice pages in this repository (see [Thread Pool Design](../practice/thread-pool.md) and [Concurrent Data Structures](./data-structures.md)).

- **Platform threads**: 1:1 with kernel threads; their count is bounded by kernel scheduling and stack memory
- **Virtual threads** ([JEP 444](https://openjdk.org/jeps/444), finalized in JDK 21): mount/unmount at blocking points, million-scale concurrency units; suitable for I/O-heavy workloads, **they do not speed up CPU-heavy work** — the number of carrier threads is still set by the core count
- The memory semantics are defined by the JMM; see [Memory Model](./memory-model.md) and the [spec cross-check working notes](../research/memory-model-specs.md)

## C++: A Library Language with No Runtime

C++ leaves concurrency entirely to the standard library and the programmer: `std::thread` maps 1:1 onto kernel threads, and C++20's `jthread` plus `stop_token` adds structured cancellation.

- The `memory_order` of `std::atomic` maps directly onto hardware barrier instructions, and you are on your own for every choice in the weakly-ordered model (see the barriers section of [Hardware and the Memory Hierarchy](./hardware.md))
- There is no built-in scheduler; for thread pools you either use a library like TBB or build your own (see [Thread Pool Design](../practice/thread-pool.md))
- Nobody reclaims memory for you either; lock-free structures must handle it themselves (Hazard Pointers, EBR, RCU; see [Lock-Free Programming](./lockfree.md))

The cost matches the freedom: the most control over performance and behavior, and the heaviest consequences when things go wrong (a data race is undefined behavior in C++).

## Go: The Scheduler Made Part of the Language

- **goroutine**: M:N scheduling, dynamically growing stacks, microsecond-level creation cost; `GOMAXPROCS` determines the true parallelism
- **Channels are first-class citizens**: CSP semantics are built into the language (see the [CSP Model](../models/csp.md)); the `sync` package supplements with mutexes, atomics, and WaitGroup
- **Container awareness**: starting with Go 1.25 `GOMAXPROCS` reads the cgroup CPU quota by default; before that, parallelism inside containers was mismatched to the host's core count (see [Operating Systems and Concurrency](./os.md))
- When a data race exists the DRF-SC guarantee stops applying and the implementation may terminate the process; `-race` is standard during development

## Python: The GIL, Coroutines, and Multiprocessing

- **GIL**: CPython uses a single interpreter-level mutex to serialize bytecode execution — multithreaded CPU-heavy work **does not run in parallel**, but multithreaded I/O-heavy work still has value
- **asyncio**: a single-threaded event loop plus coroutines with cooperative yielding; in essence it is the Python form of the [Reactor pattern](../practice/reactor.md); the first choice for high-connectivity I/O services
- **multiprocessing / process pools**: sidesteps the GIL at the cost of inter-process communication and serialization overhead
- **Free-threaded builds**: the GIL-free interpreter of [PEP 703](https://peps.python.org/pep-0703/) has shipped since CPython 3.13 as an experimental optional build; the default build still has the GIL

## Selection Advice

| Scenario | First choice | Reason |
|----------|--------------|--------|
| CPU-heavy parallelism | C++ / Java thread pools; Python with multiprocessing or free-threaded | Multithreading is useless for Python under the default GIL |
| Massive I/O connections | Go goroutine, Java virtual threads, Python asyncio, C++ with a Reactor | All are structures that flatten out waiting |
| Extremely low tail latency | C++ (no GC, no runtime), Java with a low-pause GC | One fewer uncontrollable pause |
| Ecosystem and delivery speed | Java / Go | Complete standard-library concurrency parts, mature diagnostics |

## How this page relates to others

| Question | Go to |
|----------|-------|
| happens-before and data race consequences across the four languages | [Memory Model](./memory-model.md) |
| Thread models and the cost of context switching | [Threads and Processes](../basics/thread-process.md) |
| Framework-level selection (Netty/Akka/TBB/asyncio) | [Concurrent Framework Selection](../practice/framework-selection.md) |
| goroutine and channel semantics | [CSP Model](../models/csp.md) |
| The trend tier of virtual threads and structured concurrency | [Frontier Trends and Outlook](./trends.md) |

## Traps

| Trap | Consequence | Fix |
|------|-------------|-----|
| Running CPU-heavy work in Python threads | The GIL serializes it; no parallelism even at full core count | multiprocessing, NumPy/extensions that release the GIL, or free-threaded builds |
| Using virtual threads for CPU parallelism | The carrier thread count still approximates the core count; no speedup for computation | Split CPU-heavy work into tasks onto ForkJoinPool; keep virtual threads for I/O |
| Careless tuning of memory_order in C++ | Saved barriers turn into weak-ordering bugs that only surface on weakly-ordered hardware | Start with seq_cst for correctness, then relax step by step under load testing (see [Memory Model](./memory-model.md)) |
| Estimating parallelism in a Go container by the host's core count | Before Go 1.25 GOMAXPROCS defaults to the host's cores, causing over-subscription | Upgrade the version or set GOMAXPROCS explicitly, and cross-check the cgroup quota (see [Operating Systems and Concurrency](./os.md)) |

## Chapter summary

The four languages are four answers to "who is responsible": **Java makes the library as complete as possible** (the concurrency package plus Loom), **C++ leaves the most control with you** (the standard library provides only primitives), **Go builds scheduling into the runtime** (goroutine plus channel), and **Python hands parallelism to processes and the event loop** (asyncio leads under the GIL). Choosing a language is choosing a responsibility boundary — first see the cost of the concurrency unit and who the scheduler is, then decide whether to hand correctness to the language or keep it for yourself.

## Sources

- Java memory semantics follow [JLS SE21 section 17](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html), and virtual threads follow [JEP 444](https://openjdk.org/jeps/444)
- C++ memory ordering follows the [C++ working draft](https://eel.is/c++draft/intro.races)
- Go concurrency semantics follow [The Go Memory Model](https://go.dev/ref/mem), and container-aware GOMAXPROCS follows the [Go 1.25 release notes](https://go.dev/doc/go1.25)
- The Python GIL follows the [CPython documentation](https://docs.python.org/3/glossary.html#term-GIL), and GIL-free builds follow [PEP 703](https://peps.python.org/pep-0703/)
- This page corresponds to Chapter 5, "Programming Languages and Concurrency Support," of the planned README outline; it is a page added beyond the [Authoritative Book Survey](../research/books.md)

## References

- [Go Language Documentation](https://go.dev/doc/)
- [Rust Concurrency Chapter](https://doc.rust-lang.org/book/ch16-00-concurrency.html)
- [Erlang Documentation](https://www.erlang.org/docs)
- [C++ Multithreading](https://en.cppreference.com/w/cpp/language/multithread)
- [.NET Managed Threading](https://learn.microsoft.com/en-us/dotnet/standard/threading/managed-threading-basics)

<!-- BACKLINKS-AUTO -->
## Related pages

- [memory-model](memory-model.md)
- [security](security.md)
- [trends](trends.md)
- [thread-process](/basics/thread-process.md)
- [knowledge](/knowledge.md)
- [framework-selection](/practice/framework-selection.md)
- [frameworks](/practice/frameworks.md)
- [seven-weeks](/practice/seven-weeks.md)
