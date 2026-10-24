# Concurrency Glossary

This table collects the core terms used across this site's concurrency documentation, grouped by topic. Each entry gives the term, a one-sentence definition, an authoritative source and related pages.

**Maintenance note**: new entries must cite a clickable authoritative source; if none is found, write "no authoritative source found (to be verified)" — never fabricate links from memory.

## Basic concepts

### Concurrency / Parallelism
Concurrency is the structural problem of multiple execution flows interleaving; parallelism is simultaneous execution on multiple cores.
**Source**: [Go concurrency chapter (Effective Go companion)](https://go.dev/doc/)
**Related pages**: [basics/concepts](/basics/concepts), [chapter_1](/chapter_1)

### Process / Thread
A process is the unit of resource allocation; a thread is the unit of scheduling and execution. Threads within the same process share the address space.
**Source**: [Wikipedia · Thread](https://en.wikipedia.org/wiki/Thread_(computing)), [POSIX threads (man7)](https://man7.org/linux/man-pages/man7/pthreads.7.html)
**Related pages**: [basics/thread-process](/basics/thread-process), [advanced/os](/advanced/os)

### Race Condition
An error whose outcome depends on execution timing; common in unsynchronized shared access.
**Source**: [Wikipedia · Race condition](https://en.wikipedia.org/wiki/Race_condition)
**Related pages**: [basics/concepts](/basics/concepts), [advanced/security](/advanced/security)

### Critical Section
A code segment that accesses shared resources and must be entered under mutual exclusion.
**Source**: [Dijkstra · EWD108](https://www.cs.utexas.edu/users/EWD/transcriptions/EWD01xx/EWD108.html)
**Related pages**: [basics/critical-section](/basics/critical-section), [sync/locks](/sync/locks)

### Deadlock
A cycle of mutual waiting: all four conditions — mutual exclusion, hold-and-wait, no preemption, circular wait — are met.
**Source**: [Wikipedia · Deadlock](https://en.wikipedia.org/wiki/Deadlock)
**Related pages**: [basics/deadlock-livelock](/basics/deadlock-livelock)

### Livelock
A "politeness loop" in which processes keep changing state without making progress.
**Source**: [Wikipedia · Livelock](https://en.wikipedia.org/wiki/Livelock)
**Related pages**: [basics/deadlock-livelock](/basics/deadlock-livelock)

### Starvation
A thread kept long-term from resources or CPU by an unfair scheduler.
**Source**: [Wikipedia · Deadlock (incl. starvation)](https://en.wikipedia.org/wiki/Deadlock)
**Related pages**: [basics/deadlock-livelock](/basics/deadlock-livelock), [sync/semaphores](/sync/semaphores)

## Synchronization primitives

### Mutex
A lock that guarantees mutual exclusion on a critical section; the holder has exclusive access.
**Source**: [POSIX pthread.h (mutex)](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/pthread.h.html), [Wikipedia · Monitor](https://en.wikipedia.org/wiki/Monitor_(synchronization))
**Related pages**: [sync/locks](/sync/locks)

### Readers–Writer Lock
A lock that allows multiple concurrent readers and an exclusive writer; optimized for read-heavy workloads.
**Source**: [Wikipedia · Readers–writer lock](https://en.wikipedia.org/wiki/Readers%E2%80%93writer_lock)
**Related pages**: [sync/locks](/sync/locks), [practice/reader-writer](/practice/reader-writer)

### Semaphore
A counting synchronization primitive introduced by Dijkstra; P/V operations manage a resource quota.
**Source**: [Wikipedia · Semaphore](https://en.wikipedia.org/wiki/Semaphore_(programming)), [The Little Book of Semaphores](https://greenteapress.com/wp/semaphores/)
**Related pages**: [sync/semaphores](/sync/semaphores)

### Condition Variable
A synchronization primitive that suspends a thread while a predicate is unmet and makes it re-check after being woken; must be paired with a mutex.
**Source**: [POSIX pthread.h (condition variables)](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/pthread.h.html)
**Related pages**: [sync/condition-variables](/sync/condition-variables)

### Barrier
A rendezvous point that only releases once all threads have arrived.
**Source**: [Wikipedia · Barrier](https://en.wikipedia.org/wiki/Barrier_(computer_science)), [OpenMP specification](https://www.openmp.org/specifications/)
**Related pages**: [sync/barriers](/sync/barriers)

### Monitor
A synchronization construct that packages a lock and condition variables into an object (e.g. synchronized/wait/notify).
**Source**: [Wikipedia · Monitor](https://en.wikipedia.org/wiki/Monitor_(synchronization))
**Related pages**: [sync/locks](/sync/locks), [advanced/os](/advanced/os)

### Dining Philosophers
The classic teaching problem for deadlock over shared resources.
**Source**: [Wikipedia · Dining philosophers](https://en.wikipedia.org/wiki/Dining_philosophers_problem)
**Related pages**: [basics/deadlock-livelock](/basics/deadlock-livelock)

## Concurrency models

### Actor Model
Everything is an Actor: private state plus a message mailbox, with no shared memory.
**Source**: [Wikipedia · Actor model](https://en.wikipedia.org/wiki/Actor_model), [Erlang concurrency programming](https://www.erlang.org/doc/getting_started/conc_prog.html)
**Related pages**: [models/actor](/models/actor), [practice/frameworks](/practice/frameworks)

### CSP (Communicating Sequential Processes)
Hoare's process algebra: synchronizes by passing messages over channels; the theoretical foundation of Go concurrency.
**Source**: [Wikipedia · CSP](https://en.wikipedia.org/wiki/Communicating_sequential_processes)
**Related pages**: [models/csp](/models/csp)

### STM (Software Transactional Memory)
A memory-synchronization approach that replaces locks with optimistic transactions plus rollback on conflict.
**Source**: [Wikipedia · STM](https://en.wikipedia.org/wiki/Software_transactional_memory), [Clojure refs](https://clojure.org/reference/refs)
**Related pages**: [models/stm](/models/stm)

### Dataflow Programming
A declarative model in which data dependencies drive the execution of computation nodes.
**Source**: [Wikipedia · Dataflow programming](https://en.wikipedia.org/wiki/Dataflow_programming)
**Related pages**: [models/dataflow](/models/dataflow)

### Data Parallelism
The same operation distributed across multiple data shards (SIMD/CUDA/OpenMP).
**Source**: [CUDA toolkit](https://developer.nvidia.com/cuda-toolkit), [OpenMP specification](https://www.openmp.org/specifications/)
**Related pages**: [models/data-parallel](/models/data-parallel)

### Functional Concurrency
Eliminates sharing through immutable data; the functional style is naturally concurrency-safe.
**Source**: [Clojure refs](https://clojure.org/reference/refs), [Scala Futures](https://docs.scala-lang.org/overviews/core/futures.html)
**Related pages**: [models/functional](/models/functional)

### Lambda Architecture
A stream-batch integrated data-processing architecture with a batch layer, a speed layer and a merged serving view.
**Source**: [Wikipedia · Lambda architecture](https://en.wikipedia.org/wiki/Lambda_architecture)
**Related pages**: [models/lambda-architecture](/models/lambda-architecture)

## Memory model

### Memory Model
The language/hardware contract that defines read-write visibility and reordering constraints.
**Source**: [Go memory model](https://go.dev/ref/mem), [Java memory model (JLS 17)](https://docs.oracle.com/javase/specs/jls/se8/html/jls-17.html), [C++ memory ordering](https://en.cppreference.com/w/cpp/atomic/memory_order)
**Related pages**: [advanced/memory-model](/advanced/memory-model), [research/memory-model-specs](/research/memory-model-specs)

### Memory Barrier
A CPU instruction that blocks reordering of instructions and memory accesses.
**Source**: [Wikipedia · Memory barrier](https://en.wikipedia.org/wiki/Memory_barrier)
**Related pages**: [advanced/hardware](/advanced/hardware), [advanced/memory-model](/advanced/memory-model)

### Cache Coherence
The coherence protocol for cache lines across multiple cores (MESI, etc.).
**Source**: [Wikipedia · Cache coherence](https://en.wikipedia.org/wiki/Cache_coherence), [Wikipedia · MESI](https://en.wikipedia.org/wiki/MESI_protocol)
**Related pages**: [advanced/hardware](/advanced/hardware)

### Sequential Consistency
All operations are visible to observers in some single global order.
**Source**: [Wikipedia · Sequential consistency](https://en.wikipedia.org/wiki/Sequential_consistency)
**Related pages**: [advanced/memory-model](/advanced/memory-model), [advanced/performance](/advanced/performance)

### Linearizability
Strong consistency for a single object: operations appear to take effect atomically and instantly.
**Source**: [Wikipedia · Linearizability](https://en.wikipedia.org/wiki/Linearizability)
**Related pages**: [advanced/data-structures](/advanced/data-structures), [practice/reliability](/practice/reliability)

### False Sharing
Coherence thrashing caused by variables of different threads landing in the same cache line.
**Source**: [Wikipedia · Cache coherence](https://en.wikipedia.org/wiki/Cache_coherence)
**Related pages**: [advanced/hardware](/advanced/hardware), [advanced/performance](/advanced/performance)

## Lock-free and atomics

### CAS (Compare-and-Swap)
A conditional atomic replacement instruction; the foundation of lock-free algorithms.
**Source**: [Wikipedia · CAS](https://en.wikipedia.org/wiki/Compare-and-swap)
**Related pages**: [advanced/lockfree](/advanced/lockfree)

### Lock-free / Wait-free
System-level progress guarantees: at least one thread makes progress (lock-free) / all threads complete in a bounded number of steps (wait-free).
**Source**: [Wikipedia · Lock-free and wait-free algorithms](https://en.wikipedia.org/wiki/Lock-free_and_wait-free_algorithms)
**Related pages**: [advanced/lockfree](/advanced/lockfree)

### ABA Problem
The classic flaw in which a value changing A→B→A fools CAS.
**Source**: [Wikipedia · CAS (incl. ABA)](https://en.wikipedia.org/wiki/Compare-and-swap)
**Related pages**: [advanced/lockfree](/advanced/lockfree)

### Atomic Operation
An indivisible read/write/replace operation, mapped to hardware atomic instructions.
**Source**: [C++ atomics and memory ordering](https://en.cppreference.com/w/cpp/atomic/memory_order), [C11 memory ordering](https://en.cppreference.com/w/c/atomic/memory_order)
**Related pages**: [advanced/lockfree](/advanced/lockfree), [advanced/memory-model](/advanced/memory-model)

## Engineering patterns

### Thread Pool
Pre-created threads are reused to submit tasks, avoiding the overhead of thread creation.
**Source**: [Wikipedia · Thread pool](https://en.wikipedia.org/wiki/Thread_pool), [Java Concurrency Utilities](https://docs.oracle.com/en/java/javase/21/api/java.base/java/util/concurrent/package-summary.html)
**Related pages**: [practice/thread-pool](/practice/thread-pool)

### Work Stealing
A scheduling strategy in which idle threads steal tasks from the tail of busy threads' queues.
**Source**: [Wikipedia · Work stealing](https://en.wikipedia.org/wiki/Work_stealing)
**Related pages**: [practice/thread-pool](/practice/thread-pool)

### Fork/Join Model
A divide-and-conquer parallel framework: fork subtasks, join to aggregate.
**Source**: [Wikipedia · Fork/Join](https://en.wikipedia.org/wiki/Fork%E2%80%93join_model)
**Related pages**: [practice/thread-pool](/practice/thread-pool)

### Producer–Consumer
The classic pattern of decoupling production and consumption rates with a buffered queue.
**Source**: [Wikipedia · Producer–consumer](https://en.wikipedia.org/wiki/Producer%E2%80%93consumer_problem)
**Related pages**: [practice/producer-consumer](/practice/producer-consumer)

### Reactor Pattern
A single (or few) event loops dispatch IO events to handlers (synchronous IO multiplexing).
**Source**: [Reactor (Schmidt paper)](https://www.dre.vanderbilt.edu/~schmidt/PDF/Reactor.pdf)
**Related pages**: [practice/reactor](/practice/reactor)

### Proactor Pattern
An asynchronous IO pattern in which the OS notifies via callback after completing the IO.
**Source**: [Proactor (Schmidt paper)](https://www.dre.vanderbilt.edu/~schmidt/PDF/Proactor.pdf)
**Related pages**: [practice/reactor](/practice/reactor)

### Coroutine / async-await
A user-space suspendable execution flow; write synchronous logic in an asynchronous style.
**Source**: [Rust async book](https://rust-lang.github.io/async-book/), [Python asyncio](https://docs.python.org/3/library/asyncio.html)
**Related pages**: [practice/async](/practice/async)

## Distributed systems and reliability

### CAP Theorem
Consistency, availability and partition tolerance cannot all be guaranteed at once.
**Source**: [Wikipedia · CAP](https://en.wikipedia.org/wiki/CAP_theorem), [Brewer · PODC keynote](https://www.eecs.berkeley.edu/~brewer/cs262b-2004/PODC-keynote.pdf)
**Related pages**: [practice/reliability](/practice/reliability)

### Consensus
The fundamental distributed problem of multiple nodes reaching agreement on a single value.
**Source**: [Wikipedia · Consensus](https://en.wikipedia.org/wiki/Consensus_(computer_science)), [Paxos Made Simple](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf)
**Related pages**: [practice/reliability](/practice/reliability), [research/applications](/research/applications)

### Raft
An understandable consensus algorithm built on leader-based log replication.
**Source**: [Raft paper](https://raft.github.io/raft.pdf)
**Related pages**: [practice/reliability](/practice/reliability), [research/applications](/research/applications)

### Amdahl's Law
The serial fraction limits the upper bound of parallel speedup.
**Source**: [Wikipedia · Amdahl](https://en.wikipedia.org/wiki/Amdahl%27s_law)
**Related pages**: [advanced/performance](/advanced/performance)

### Little's Law
L = λW: the average number in the system = arrival rate × time spent.
**Source**: [Wikipedia · Little's law](https://en.wikipedia.org/wiki/Little%27s_law)
**Related pages**: [advanced/performance](/advanced/performance)

### TOCTOU (Time-of-check to Time-of-use)
A race-condition security vulnerability in which state changes between the check and the use.
**Source**: [Wikipedia · TOCTOU](https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use)
**Related pages**: [advanced/security](/advanced/security)

## Sources

- This glossary has no central source table: each term's authoritative source is inlined on its own "Source" line and can be clicked and verified one by one.
- Sources in this table fall into four categories — official specifications and language docs ([Go memory model](https://go.dev/ref/mem), the Java Language Specification JLS 17, the C++ reference manual's [memory_order](https://en.cppreference.com/w/cpp/atomic/memory_order), C11 memory ordering); original papers (C. A. R. Hoare's CSP 1978, Schmidt's Reactor/Proactor, Dijkstra's semaphores and [EWD108](https://www.cs.utexas.edu/users/EWD/transcriptions/EWD01xx/EWD108.html), [Paxos Made Simple](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf), [Raft paper](https://raft.github.io/raft.pdf)); textbooks and manuals (*The Little Book of Semaphores*, the Effective Go companion chapter); and Wikipedia entries (used to quickly locate definitions).
- Normative and definitional statements defer to official specifications and original papers; Wikipedia entries do not serve as a normative basis.
- Entries are grouped according to this site's chapter structure; the choice of terms is reconciled against the [knowledge outline](knowledge.md) and the "Related pages" cross-links of each entry.

---

**Maintenance note**: new entries must cite a clickable authoritative source; if none is found, write "no authoritative source found (to be verified)" — never fabricate links from memory.

<!-- BACKLINKS-AUTO -->
## Related pages

- [knowledge](knowledge.md)
