# Introduction

Concurrency is the programming problem of "handling many things at once" on a single machine: several streams of execution share memory, CPU and IO, and make progress interleaved. It brings two things at once — **capability** (saturating many cores, hiding IO waits) and **trouble** (races, deadlocks, visibility). These notes revolve around that contradiction, recording the hardware foundations, synchronization primitives, concurrency models and engineering tradeoffs.

## 1.1 What "high concurrency" means and why it matters

"High concurrency" means the system must handle a large volume of requests or tasks arriving at the same time. After Moore's law stopped being a free lunch, single-core clock speed plateaued, and the source of performance moved from "higher clocks" to "more cores" — parallelism is no longer an optional optimization, but the basic shape of how hardware is used.

Concurrency matters at three levels:

1. **Resource utilization**: IO waits (disk, network) run to the millisecond, tens of thousands of times a CPU cycle. A single thread waiting serially means the whole machine sits idle; concurrency lets waits overlap each other.
2. **Throughput and latency**: handling many requests in parallel raises throughput; splitting long jobs and pushing them forward in parallel lowers latency.
3. **Structured expression**: GUI event loops, background jobs, streaming — all of these are concurrent structures at their core, and even on a single core, a concurrency model is a way of organizing a program.

## 1.2 Where high-concurrency systems show up

| Scenario | Concurrency shape | Typical challenges |
|----------|-------------------|--------------------|
| Web services / microservices | Thread pool + async IO | Connection counts, backpressure, graceful shutdown |
| Databases / storage engines | Read–write locks + lock-free structures + MVCC | Cache contention, false sharing, persistence consistency |
| Message systems / stream processing | Producer–consumer + partitioning | Backlog control, ordering and exactly-once |
| Games / simulation | Actors / fixed-step loops | State synchronization, frame-rate stability |
| Compilers / build tools | Work-stealing thread pool | Task granularity, dependency-graph scheduling |
| OS kernels | Interrupts + locks + RCU | Priority inversion, critical-section length |

## 1.3 What these notes cover

Content is grouped as "principles → primitives → models → engineering practice", so you can look up whatever problem you are holding:

- **Fundamentals**: the difference between concurrency and parallelism, threads and processes, critical sections and mutual exclusion, deadlock and livelock — the concepts and the problem definitions.
- **Synchronization primitives**: locks, semaphores, condition variables, barriers — the toolbox the OS and the languages hand you.
- **Concurrency models**: Actors, CSP, dataflow, STM, functional concurrency, data parallelism, Lambda architecture — programming paradigms and system shapes built on top of the primitives, which decide the shape of the program.
- **Advanced topics**: hardware and the memory hierarchy, the OS and concurrency, lock-free programming, memory models, concurrent data structures, performance tuning, language support, concurrency and security, trends and outlook — digging into hardware, kernel, compiler and runtime behavior.
- **Engineering practice**: producer–consumer, readers–writers, thread pool design, framework selection, Reactor and event-driven, async programming and Futures, frameworks and tools, reliability design, plus a seven-week practice log.

While organizing this, I grouped fundamentals, synchronization, models and engineering practice separately. When you hit a specific problem on a project, start from the matching topic and follow the page links back to the related concepts. The selection tables and the trap checklists record the tradeoffs I think are worth noticing. Code examples cover Java / Go / Rust / C++; reading them side by side helps separate language features from things that are true of concurrency in general.

---

The concurrency basics page holds the terminology and the common misconceptions, and works as an index into the related pages: [Concurrency Basics](/basics/concepts).

## References

- [Wikipedia · Race condition](https://en.wikipedia.org/wiki/Race_condition)
- [POSIX threads (man7)](https://man7.org/linux/man-pages/man7/pthreads.7.html)

<!-- BACKLINKS-AUTO -->
## Related pages

- [glossary](glossary.md)
