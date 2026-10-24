# Hardware and the Memory Hierarchy

The performance and correctness of concurrent programs ultimately rest on hardware: cache coherence determines what cores "see" of each other, the memory hierarchy determines "how long you wait," and NUMA and I/O determine "where the data comes from." This page covers the hardware-side causes; for the language-side rules see [Memory Model](./memory-model.md), and for software-side tuning see [Performance Tuning](./performance.md).

## Memory Hierarchy and the Latency Ladder

| Level | Typical Capacity | Typical Latency (cycles) | Ownership |
|-------|-----------------|--------------------------|-----------|
| Registers | Hundreds of bytes | 0–1 | Single core |
| L1 cache | 32–64 KB | ~4 | Private per core |
| L2 cache | 256 KB–2 MB | ~12 | Private per core |
| L3 cache | Several MB to tens of MB | ~40 | Shared across cores |
| Main memory (DRAM) | GB scale | ~200 | Shared across the machine |
| NVMe SSD | TB scale | Tens of thousands | Shared across the machine |
| Network/disk | — | Hundreds of thousands+ | Cross-machine |

Rule of thumb for orders of magnitude: main memory is about two orders of magnitude slower than L1, and SSD is two more orders of magnitude slower still. The value of concurrency is precisely to overlap these waits (see [Concurrency Basics](../basics/concepts.md)), and the cache coherence protocol determines the cost of that overlap across cores.

A **cache line** is the smallest unit transferred; x86 and ARM commonly use 64 bytes. Two unrelated variables landing on the same line, with one core writing and another reading, will be flagged as a conflict by the protocol — this is the hardware cause of [false sharing](./data-structures.md). On the software side, padding and `@Contended` split the line; on the hardware side it cannot be avoided.

## Cache Coherence Protocols: MESI and Its Variants

Each core has its own cache, and replicas of the same address must stay consistent. The mainstream protocol is MESI, on the **write-invalidate** line, with four states for each cache line:

| State | Meaning | Readable by this core | Writable by this core |
|-------|---------|----------------------|----------------------|
| **M** Modified | Modified, held only by this core, inconsistent with main memory | Yes | Yes |
| **E** Exclusive | Exclusive, not modified, consistent with main memory | Yes | Yes (transitions to M) |
| **S** Shared | Shared, held by multiple cores, none modified | Yes | No (must invalidate others' copies first) |
| **I** Invalid | Invalid | No | No |

Writing to a line in state S requires this core to first broadcast an invalidate request and wait for other cores to acknowledge before it can enter M — **this is why writing shared data is slower than writing private data**, and it is the hardware-level explanation for the throughput collapse under CAS contention in lock-free programming.

The MOESI variant adds the O (Owned) state, keeping "modified but shareable" dirty lines at the holder and reducing write-backs to main memory; AMD and some ARM implementations adopt it. Bus snooping suits low core-count scenarios; once core counts grow, the **directory protocol** takes over, using a central directory to record which core holds which line and avoiding broadcast storms.

Coherence protocols guarantee **eventual consistency of a single address**, not ordering across addresses — ordering is left to the barrier rules of the [Memory Model](./memory-model.md).

## Barrier Instructions and the Store Buffer

Modern CPUs hide write latency by parking writes in a **store buffer** first, while load requests go straight to cache (the source of store-load not being ordered); invalidate requests also go through an **invalidate queue**, and are not acted on immediately upon arrival (the source of store-store and load-load not being ordered).

| Reordering | Hardware mechanism | Barrier that fixes it |
|------------|-------------------|----------------------|
| Store-Load | Store buffer forwarding | Full barrier (mfence / DMB SY) |
| Store-Store | Write combining and buffering | sfence / DMB ST |
| Load-Load | Out-of-order execution and invalidate queue | lfence / DMB LD |

- **x86/TSO**: Total Store Order model, allows only Store-Load reordering; `mfence` and the `lock` prefix suffice, so few barriers are needed in daily work
- **ARM/POWER**: Weakly-ordered model, all four kinds of reordering can occur, requiring explicit `DMB/DSB/ISB`; this is also why concurrency bugs surface more easily on ARM

`memory_order_acquire/release`, `volatile`, and `std::atomic` in language code ultimately compile down to these instructions. Reading language rules side by side with hardware instructions is how you learn what each line of code actually costs (the reason [C++ books put memory ordering before lock-free design](../research/books.md) is exactly this).

## NUMA: Memory Is No Longer Equidistant

On multi-socket servers each CPU has its own local memory controller, so accessing local memory is faster than crossing nodes (typically a 1.5–2× difference). Two consequences:

- **Thread affinity**: pin threads to cores and memory to the local node, so the hidden cost of cross-node access stays manageable (`numactl`, `taskset` on Linux)
- **First touch**: a page is allocated to the node where the first thread that writes it lives; if initialization runs single-threaded, all subsequent multithreaded work then crosses nodes — parallelize the initialization of large arrays

A NUMA mismatch shows up as "added cores but throughput did not rise"; when investigating, check `numastat` for the remote-hit rate first.

## Storage and I/O

- **DMA**: peripherals read and write main memory directly, the CPU does not take part in the data movement and only handles the completion notification; zero-copy (sendfile, mmap) further eliminates the round trips between user space and kernel space
- **Page cache**: reads go through the cache, writes are written back to disk, and only `fsync` guarantees the data hits the disk — the boundary of persistence semantics is here, not in the language layer
- **High-concurrency I/O multiplexing**: epoll (Linux), kqueue (BSD/macOS), and io_uring (the async submission/completion ring in Linux 5.1+) pull "waiting on I/O" out of thread switching; they are the common foundation under Netty, asyncio, and the Go runtime netpoller. The upper-layer structure is in [Reactor Pattern and Event-Driven](../practice/reactor.md)
- **SSD and queue depth**: NVMe supports high-concurrency queues, and single-disk throughput is built up by queue depth; when concurrency is insufficient, latency rises instead of falling

The key insight on the I/O side: **every optimization between the CPU and memory can be invalidated by a single missed I/O**, so the first layer of design for a high-concurrency system is often "don't let requests wait on I/O."

## Where Accelerators Fit in High-Concurrency Systems

| Accelerator | Parallel form | Suitable for |
|-------------|---------------|-------------|
| SIMD (AVX/NEON) | Single instruction, multiple data, 128–512 bits wide | Vectorized regular computation, automatic at compile time/run time or hand-written |
| GPU | SIMT, thousands of lightweight threads | Compute-intensive, regular data (see [Data Parallelism](../models/data-parallel.md)) |
| FPGA | Hardware circuit-level pipeline | Fixed algorithms, ultra-low latency (network packet processing, market data parsing) |
| DPU/SmartNIC | Offload on the NIC | Offload of the network and storage protocol stacks |

The selection rule: only move computation to an accelerator when parallelism is naturally high, branches are few, and data volume is large; otherwise the cost of data movement will exceed the benefit (same root as [the transfer trap in data parallelism](../models/data-parallel.md)).

## How this page relates to others

| Question | Go to |
|----------|-------|
| happens-before, memory ordering semantics, consequences of data races | [Memory Model](./memory-model.md) |
| Scheduling, preemption, context switching, and the kernel-side causes of virtual memory | [Operating Systems and Concurrency](./os.md) |
| Software fixes for false sharing, sharded counters | [Concurrent Data Structures](./data-structures.md) |
| Latency and capacity planning, flame graphs and perf | [Performance Tuning](./performance.md) |
| GPU execution model and OpenCL | [Data Parallelism](../models/data-parallel.md) |
| Atomic instructions and algorithmic use of CAS | [Lock-Free Programming](./lockfree.md) |
| Tier judgments for new hardware such as CXL, DPU, big.LITTLE | [Frontier Trends and Outlook](./trends.md) |

## Chapter summary

Three sentences for the hardware layer: **cache coherence makes shared memory across cores possible, at the cost of paying an invalidate charge when writing shared data**; **the store buffer and invalidate queue introduce reordering, and barrier instructions and language memory ordering are the constraints placed on them**; **the memory hierarchy and NUMA set the order of magnitude of latency, and the upper bound of concurrency's benefit is defined by them**. Every software-side concurrency technique — locks, atomics, lock-free, sharding, affinity — is an engineering solution under these three constraints.

## Sources

- The cache hierarchy, MESI/MOESI, and memory barriers follow U. Drepper, *What Every Programmer Should Know About Memory* (Red Hat, 2007) and the [Intel 64 and IA-32 Architecture Software Developer's Manual](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- The weakly-ordered model and barrier instructions follow the [Arm Architecture Reference Manual](https://developer.arm.com/documentation)
- I/O multiplexing and io_uring follow the [io_uring kernel documentation](https://kernel.dk/io_uring.pdf) and the Linux man pages
- This page corresponds to Chapter 3, "High-Concurrency Design at the Hardware Layer," of the planned README outline; it is a page added beyond the [Authoritative Book Survey](../research/books.md) and is not tied to a single textbook

## References

- [Wikipedia: Cache coherence](https://en.wikipedia.org/wiki/Cache_coherence)
- [Wikipedia: MESI protocol](https://en.wikipedia.org/wiki/MESI_protocol)
- [Wikipedia: Memory barrier](https://en.wikipedia.org/wiki/Memory_barrier)

<!-- BACKLINKS-AUTO -->
## Related pages

- [data-structures](data-structures.md)
- [languages](languages.md)
- [lockfree](lockfree.md)
- [memory-model](memory-model.md)
- [os](os.md)
- [performance](performance.md)
- [trends](trends.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [data-parallel](/models/data-parallel.md)
- [reactor](/practice/reactor.md)
