# Operating Systems and Concurrency

[Hardware and the Memory Hierarchy](./hardware.md) covers the physical constraints of multicore and memory; this page covers what the kernel does between the two: it hands CPU time to threads and maps virtual memory onto physical memory. User space cannot see the scheduler, but latency spikes, the true cost of locks, and the oddities inside containers all surface through it — scheduling, preemption, page faults, and quotas are all delivered by the operating system.

## Concurrency Mechanisms Inside the Kernel

- **Interrupts and system calls**: interrupt context cannot sleep, so the kernel uses spinlocks; a system call is the synchronization boundary between user space and the kernel, and whether a lock sleeps or spins inside the kernel depends on which context the code runs in
- **Evolution of kernel locks**: Linux 2.4 serialized every kernel path with a single Big Kernel Lock; starting with 2.6 it was torn out and replaced by fine-grained locks and dedicated primitives — `seqlock` (lock-free optimistic readers that retry), `RCU` (zero-cost readers, reclamation after a grace period; see the reclamation comparison in [Lock-Free Programming](./lockfree.md)), and `per-CPU` data (turning shared into private, the same idea as sharded counters; see [Concurrent Data Structures](./data-structures.md))
- **Critical sections must be short**: kernel critical sections often disable preemption and even interrupts, so the length of the window becomes latency jitter for every other CPU on the system — the same discipline as "do no I/O inside a lock" in user space (see [Critical Sections and Mutual Exclusion](../basics/critical-section.md))

## Thread Management

| Item | Kernel thread | User thread (two-level model) |
|------|--------------|------------------------------|
| Scheduler | Kernel | A user-space runtime maps onto kernel threads |
| Creation cost | System call, kernel structures plus a dedicated stack/TLS | Fast user-space path, down to microseconds |
| Blocking impact | Only the current thread is parked | If the mapped kernel thread is occupied the whole group stalls (unless the runtime takes over) |
| Examples | pthreads, Java platform threads | goroutine, Java virtual threads (see the thread model table in [Threads and Processes](../basics/thread-process.md)) |

The two-level model pushes scheduling down into the runtime: the Go runtime is responsible for M:N scheduling and work stealing, and Java virtual threads mount and unmount at blocking points ([JEP 444](https://openjdk.org/jeps/444)). The gain is million-scale concurrency units at the cost of the intuition "thread count = parallelism" breaking down — parallelism is now determined by the number of scheduling carriers in the runtime.

**futex is the cost floor of locks**: `pthread_mutex`, `pthread_cond`, and the synchronization primitives of Go and the JVM all complete directly in user space with atomic instructions when there is no contention (fast path), and go into the kernel to be parked or woken via `FUTEX_WAIT`/`FUTEX_WAKE` when there is contention. So **the cost of a lock lies not in the instructions inside the critical section but in that one park-and-wake into the kernel under contention** — this is also the mechanism behind why [locks](../sync/locks.md) and [condition variables](../sync/condition-variables.md) are nearly free under low contention and cliff-dive under high contention.

## Scheduling Algorithms and Preemption

Linux layers its scheduling classes, with the realtime class always taking priority over the fair class:

| Scheduling class | Policy | Suitable for |
|------------------|--------|-------------|
| Deadline | EDF plus a hard bandwidth limit | Periodic realtime tasks; bandwidth overuse is capped immediately |
| Realtime | SCHED_FIFO / SCHED_RR | Low-latency control tasks, bounded by privileges and `RLIMIT_RTPRIO` |
| Fair | CFS (vruntime red-black tree) | The vast majority of business threads |
| Idle / Batch | Idle and batch processing | Background computation |

- **Two forms of preemption**: a thread yielding voluntarily (blocking, `sched_yield`) and being preempted (time slice exhausted). Frequent involuntary preemption is a common source of "enough cores but jittery latency"
- **What switching actually costs**: saving and restoring registers is only the small change; the real cost is the scheduler's own overhead (run-queue locking, migration) plus cache and TLB going cold (see [Context Switching](../basics/thread-process.md) and [The Latency Ladder](./hardware.md))
- **Affinity and isolation**: `taskset` / `cgroup cpuset` pin threads to cores, IRQ affinity pins interrupts to designated cores, and `isolcpus` / `nohz_full` isolates cores from the scheduler for latency-sensitive loads; on NUMA you also need `numactl` so that memory lands on the local node (see the NUMA section of [Hardware and the Memory Hierarchy](./hardware.md))

## Memory Management and Virtual Memory

- **Page tables and the TLB**: multi-level page tables plus a TLB that caches translations; a TLB miss must walk the page table and is far more expensive than a cache miss. Huge Pages thin out the number of page-table entries, and PCID/ASID let context switches avoid flushing the whole TLB
- **Page faults and thrashing**: a minor fault only fills in the page table, a major fault must wait on disk; once the working set exceeds physical memory the system enters reclamation and paging, which shows up as a cliff-like rise in latency. The standard practice for high-concurrency services is to keep the working set resident and monitor the fault rate
- **OOM and cgroup quotas**: the host's OOM killer picks a process to kill, while inside a container `memory.max` triggers and only processes within the container are killed — when a production process is killed for no apparent reason, first establish which layer of OOM it was
- **Page cache and writeback**: reads go through the cache, writes are written back to disk, and only `fsync` guarantees the data hits the disk; this boundary was already covered in the storage section of [Hardware and the Memory Hierarchy](./hardware.md) and is not repeated here

## Kernel Mechanisms and Their User-Space Symptoms

| Kernel mechanism | User-space symptom | Go to |
|------------------|-------------------|-------|
| Scheduling latency and preemption | p99 latency spikes, unstable throughput | [Performance Tuning](./performance.md) |
| Two-level scheduling and futex | The cost of lock contention far exceeds the critical section itself | [Locks](../sync/locks.md) |
| Page tables, TLB, and page faults | Periodic stuttering in large-memory services | [Hardware and the Memory Hierarchy](./hardware.md) |
| NUMA first touch | Added cores but throughput did not rise | [Hardware and the Memory Hierarchy](./hardware.md) |
| cgroup CPU/memory quotas | Thread counts sized to the host's cores inside a container, periodic OOM | [Thread Pool Design](../practice/thread-pool.md) |

## Traps

| Trap | Consequence | Fix |
|------|------------|-----|
| SCHED_FIFO thread in an infinite loop | The realtime class always takes priority, so the whole machine (including the watchdog) starves | Cap `RLIMIT_RTPRIO`, leave the realtime thread a guardian task, or switch to the bandwidth-limited Deadline class |
| Spin-waiting under over-subscription | Busy-waiting threads hog the time slice, so the thread being waited on never gets scheduled | Only spin when cores are plentiful and the critical section is extremely short; otherwise park via futex |
| Ignoring major faults | Periodic stuttering once memory is exhausted, misdiagnosed as GC or lock contention | Monitor the fault rate and PSI, and reserve physical memory for the working set |
| Letting transparent huge pages (THP) run unchecked | Folding/compaction causes unpredictable long pauses | Explicitly disable THP for latency-sensitive processes or pre-allocate hugetlb |
| Raising thread priority blindly | Priority inflation; high-priority threads end up waiting on resources held by lower-priority ones | Priority inheritance is handled by lock protocols; do not set priorities arbitrarily at the business layer |

## Chapter summary

The operating system is the delivery layer of concurrent performance: **the scheduler decides who runs when and where** (scheduling classes, preemption, affinity), **futex decides the true cost of a lock under contention** (user-space fast path plus kernel park/wake), and **virtual memory decides when data can be reached** (TLB, page faults, reclamation). When debugging latency and throughput problems in a high-concurrency system, first establish whether the problem belongs to this layer at all — many software-level optimizations are actually compensating for a bad scheduling decision or a page fault. The latency of distributed mechanisms such as leases, timeouts, and failover is also ultimately delivered at this layer; see [Reliability Design](../practice/reliability.md).

## Sources

- System call and futex semantics follow [Linux man-pages futex(2)](https://man7.org/linux/man-pages/man2/futex.2.html), and scheduling policies and realtime class constraints follow [sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html)
- The evolution of kernel locks (Big Kernel Lock removal, seqlock, RCU) references D. Bovet & M. Cesati, *Understanding the Linux Kernel* (O'Reilly)
- Virtual memory, page faults, and OOM reference M. Gorman, *Understanding the Linux Virtual Memory Manager* (O'Reilly, 2004)
- The runtime implementations of two-level scheduling follow [OpenJDK JEP 444 (Virtual Threads)](https://openjdk.org/jeps/444) and the goroutine section of the official Go FAQ ([go.dev](https://go.dev/doc/faq#goroutines))
- This page corresponds to Chapter 4, "Operating Systems and Concurrency," of the planned README outline, which was previously an empty slot across the whole repository; it is a page added beyond the [Authoritative Book Survey](../research/books.md)

## References

- [Linux Kernel Documentation](https://www.kernel.org/doc/html/latest/)
- [POSIX Threads (man7)](https://man7.org/linux/man-pages/man7/pthreads.7.html)
- [Wikipedia: Monitor (synchronization)](https://en.wikipedia.org/wiki/Monitor_(synchronization))

<!-- BACKLINKS-AUTO -->
## Related pages

- [hardware](hardware.md)
- [languages](languages.md)
- [performance](performance.md)
- [trends](trends.md)
- [thread-process](/basics/thread-process.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [async](/practice/async.md)
- [reliability](/practice/reliability.md)
- [locks](/sync/locks.md)
