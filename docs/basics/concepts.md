# Concurrency fundamentals

Multi-core processors have made concurrency a common engineering concern. A single-threaded program cannot make full use of multi-core resources, but concurrency also introduces races, deadlocks, and visibility problems. This page records the concepts and judgments I rely on when understanding these problems.

## What is concurrency

Concurrency is the ability of a system to handle multiple tasks at the same time. On a single-core CPU, concurrency achieves the appearance of tasks "running at the same time" through time-slice round-robin; on a multi-core CPU, multiple tasks can truly execute simultaneously, which is parallelism.

The difference between concurrency and parallelism:
- **Concurrency**: handling multiple tasks within the same time span, interleaved at the micro level
- **Parallelism**: physically executing multiple tasks at the same instant

## Why concurrency is needed

1. **Higher throughput**: using multi-core CPUs to process in parallel completes more work per unit of time
2. **Lower latency**: I/O-bound tasks can switch to other work while waiting on I/O
3. **Responsiveness**: GUI programs and web servers must keep the foreground responsive while handling background tasks
4. **Resource utilization**: avoid spinning the CPU while waiting on I/O, improving the return on hardware investment

## Challenges of concurrent programming

Concurrency introduces complexity that does not exist in single-threaded programs:

| Challenge | Description |
|------|------|
| Race condition | Multiple threads access shared data, and the execution order affects result correctness |
| Deadlock | Threads wait in a cycle for resources each other holds, stalling the system |
| Livelock | Threads keep retrying but never make progress |
| Starvation | Low-priority threads cannot obtain the CPU or resources for a long time |
| Memory visibility | Whether modifications a thread makes to a shared variable are visible to others |
| Instruction reordering | Compiler and CPU optimizations cause the execution order to differ from the code order |

## Core concepts

### Critical section
A code segment that accesses a shared resource; only one thread is allowed to execute it at a time.

### Mutual exclusion
The mechanism that guarantees only one thread enters the critical section at a time.

### Synchronization
Coordinating multiple threads to execute in a predetermined order, including mutual exclusion, barriers, event notification, and so on.

### Atomic operation
An indivisible operation: it either runs to completion or not at all, with no intermediate state.

## Chapter summary

The essence of concurrent programming is **coordinating multiple streams of execution to run correctly and efficiently under the constraints of shared resources**. Subsequent pages record synchronization primitives, concurrency models, the memory model, and the problems and trade-offs in engineering practice.

## Sources

- The provenance of Amdahl's law in the concurrency book comes from the JCiP book-site blurb; see [authoritative books research](../research/books.md)
- Concurrency/parallelism and synchronous/asynchronous use standard conceptual definitions; this page did no dedicated literature research. Later additions without a source will be marked "no source found" in place.

## References

- [POSIX threads (man7)](https://man7.org/linux/man-pages/man7/pthreads.7.html)
- [Java Concurrency Tutorial (external link)](https://docs.oracle.com/javase/tutorial/essential/concurrency/)
- [Wikipedia · Race condition](https://en.wikipedia.org/wiki/Race_condition)

<!-- BACKLINKS-AUTO -->
## Related pages

- [hardware](/advanced/hardware.md)
- [chapter_1](/chapter_1.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [data-parallel](/models/data-parallel.md)
- [functional](/models/functional.md)
- [books](/research/books.md)
