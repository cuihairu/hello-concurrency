# Lock-Free Programming

Lock-free programming uses **hardware atomic instructions (CAS/LL-SC)** to build concurrent data structures, avoiding the blocking, priority inversion, deadlock, and context-switch overhead of locks. The core trade-off: **algorithmic complexity in exchange for maximum throughput and latency determinism**.

## Core Primitives

### Compare-And-Swap (CAS)
```c
// Pseudocode: atomic compare and swap
bool CAS(addr *ptr, old_val expected, new_val desired) {
    atomic {
        if (*ptr == expected) {
            *ptr = desired;
            return true;
        }
        return false;
    }
}
```
- **Semantics**: if `*ptr == expected`, write `desired` and return true; otherwise leave it unchanged and return false
- **x86**: `LOCK CMPXCHG` (locks the entire cache line)
- **ARM/RISC-V**: `LDXR/STXR` (Load-Linked/Store-Conditional)

The hardware explanation for the throughput collapse under CAS contention — writing a shared cache line requires invalidating other copies first — is in [Hardware and the Memory Hierarchy](./hardware.md).

### Load-Linked / Store-Conditional (LL/SC)
```asm
// ARMv8
LDXR  W0, [X1]      // load and set an exclusive monitor
...                 // compute the new value
STXR  W2, W0, [X1]  // conditional store; W2=0 on success
CBNZ  W2, retry     // retry on failure
```
- **Advantages**: no ABA problem (fine-grained hardware monitor), supports multi-word atomics
- **Limitations**: no system calls, interrupts, or cache evictions may occur between LL and SC

### Memory Ordering
| Order | Semantics | Typical use |
|-------|-----------|-------------|
| `seq_cst` | A single global total order | Default, simple correctness |
| `acquire` | Subsequent reads/writes are not reordered before this one | Locking, reading flags |
| `release` | Prior reads/writes are not reordered after this one | Unlocking, writing flags |
| `acq_rel` | acquire plus release | RMW operations (CAS, FAA) |
| `relaxed` | Guarantees only atomicity | Counters, statistics, no synchronization needs |

**Golden rule**: start with `seq_cst` for correctness, then optimize down to weaker orders under load testing.

## Classic Lock-Free Data Structures

### 1. Lock-Free Stack (Treiber Stack)
```c
struct Node { T value; Node* next; };
atomic<Node*> head;

void push(T val) {
    Node* n = new Node{val, nullptr};
    do { n->next = head.load(); } 
    while (!head.compare_exchange_weak(n->next, n));
}

bool pop(T& out) {
    Node* h;
    do {
        h = head.load();
        if (!h) return false;
    } while (!head.compare_exchange_weak(h, h->next));
    out = h->value;
    delete h;  // deferred reclamation (Hazard Pointer / Epoch)
    return true;
}
```
**ABA problem**: during a pop, head goes A->B->A and CAS wrongly succeeds. Fixes: tagged pointers, version numbers, Hazard Pointers.

### 2. Lock-Free Queue (Michael-Scott Queue)
```c
struct Node { T value; atomic<Node*> next; };
atomic<Node*> head, tail;

void enqueue(T val) {
    Node* n = new Node{val, nullptr};
    Node* t;
    do {
        t = tail.load();
        Node* next = t->next.load();
        if (t != tail.load()) continue;
        if (next) { tail.compare_exchange_weak(t, next); continue; }
        if (t->next.compare_exchange_weak(next, n)) break;
    } while (true);
    tail.compare_exchange_weak(t, n);
}

bool dequeue(T& out) {
    Node* h;
    do {
        h = head.load();
        Node* t = tail.load();
        Node* next = h->next.load();
        if (h != head.load()) continue;
        if (h == t) {
            if (!next) return false;
            tail.compare_exchange_weak(t, next);
            continue;
        }
        out = next->value;
        if (head.compare_exchange_weak(h, next)) break;
    } while (true);
    delete h;  // deferred reclamation
    return true;
}
```
**Key point**: the tail pointer may lag behind and needs helping to advance.

### 3. Lock-Free Hash Table
- **Segmented locking plus lock-free buckets**: Java `ConcurrentHashMap` (JDK 8+)
- **Fully lock-free**: `Cliff Click` non-blocking hash tables, C++ `folly::AtomicHashMap`, Rust `dashmap` (segmented locking)
- **Core techniques**: open addressing plus CAS, split ordered lists, RCU lock-free readers

## Memory Reclamation: The Hardest Part of Lock-Free Programming

When deleting a node, other threads may still be accessing it. **You cannot `free` immediately**; you need safe reclamation.

| Approach | Principle | Overhead | Suitability |
|----------|-----------|----------|-------------|
| **Hazard Pointer** | Threads declare which pointers they are accessing; scan before reclaiming | Low (O(thread count)) | General purpose, low latency |
| **Epoch-Based Reclamation (EBR)** | Advance a global epoch; reclaim after two epochs | Very low (batched) | High throughput, tolerable to deferred reclamation |
| **RCU (Read-Copy-Update)** | Lock-free readers, writers copy and modify, reclaim after a grace period | Zero-cost reads | Read-heavy/write-light, kernels, databases |
| **Reference counting / shared pointers** | Atomic reference counts | High (cache line bouncing) | Simple scenarios, C++ `shared_ptr` |
| **Garbage collector** | Automatic runtime management | Non-deterministic | Suitable for Java/Go (the GC reclaims retired nodes automatically); Rust has no GC so this does not apply, and one of the manual approaches above is required |

### Hazard Pointer Overview
```c
// Thread-local hazard pointer array
__thread HPRecord hp[MAX_HP];

void retire(Node* p) {
    // Add to the retired list
    // Scan every thread's hp; free if nobody references it
}
```

### EBR Overview
```c
// Global epoch counter
atomic<uint64_t> global_epoch;

// A thread enters the critical section
uint64_t local_epoch = global_epoch.load(acquire);
// ... access shared data ...
// Exit the critical section

// Reclaimer: advance the epoch, reclaim retired objects from two epochs ago
```

## Lock-Free Design Patterns

| Pattern | Core idea | Typical example |
|---------|-----------|-----------------|
| **Copy-on-Write** | Readers share the old version, writers create a new one | `CopyOnWriteArrayList`, RCU |
| **Optimistic validation** | Readers record a version, writers validate that the version has not changed | Database MVCC, STM |
| **Helping** | Threads assist in completing another thread's unfinished operation | MS Queue tail-pointer advancement |
| **Contention elimination** | Thread-local buffering, batched merging | `LongAdder`, ThreadLocal |
| **Layering/sharding** | Spread hotspots across many independent instances | Segmented locking, sharded counters |

## Language Ecosystem Comparison

| Language | Atomic operations | Lock-free libraries | Reclamation mechanism |
|----------|-------------------|--------------------|-----------------------|
| **C++11+** | `std::atomic<T>` | `folly`, `libcds`, `boost::lockfree` | Manual (HP/EBR/RCU) |
| **Java** | `java.util.concurrent.atomic` | `jctools`, `netty` | Automatic GC |
| **Go** | `sync/atomic` | Standard library channels first | Automatic GC |
| **Rust** | `std::sync::atomic` | `crossbeam`, `dashmap`, `arc-swap` | Ownership plus EBR (crossbeam-epoch) |
| **C#** | `Interlocked`, `Volatile` | `System.Collections.Concurrent` | Automatic GC |

## Performance Analysis Tools

| Tool | Purpose |
|------|---------|
| `perf stat -e cycles,instructions,cache-misses` | Microarchitectural metrics |
| `perf record -g` plus `perf report` | Hot call stacks |
| `valgrind --tool=drd` / `helgrind` | Data race detection |
| `ThreadSanitizer (TSan)` | Compile-time instrumented race detection |
| `linux-perf` plus `c2c` | Cache line contention analysis (False Sharing) |
| `JMH` / `Google Benchmark` | Microbenchmarking |

## Lock-Free Checklist

1. **Measure before optimizing**: is the lock really the bottleneck? Use `perf` to check context switches and cache misses
2. **Prefer mature libraries**: `ConcurrentHashMap`, `ConcurrentQueue`, `crossbeam`, `jctools`
3. **ABA protection**: tagged pointers, version numbers, Hazard Pointers
4. **Minimize memory ordering**: do not use `seq_cst` when `acquire`/`release` is enough
5. **Eliminate false sharing**: `alignas(64)` / `cacheline_padding` for hot counters
6. **Choose a reclamation strategy**: EBR for high throughput, HP for low latency, RCU for read-heavy/write-light
7. **Verify correctness**: TSan, model checking (CBMC, TLA+), load testing with injected faults
8. **Document assumptions**: memory ordering dependencies, progress guarantees (lock-free/wait-free/obstruction-free)

## Progress Guarantee Levels

| Level | Definition | Typical implementation |
|-------|-----------|------------------------|
| **Wait-free** | Always completes in a finite number of steps | Atomic RMW, single-producer ring buffers |
| **Lock-free** | The system as a whole always makes progress (some thread may starve) | CAS loops, Treiber Stack, MS Queue |
| **Obstruction-free** | Completes when run uncontended | STM, optimistic validation |

## Chapter summary

Lock-free programming is a systems engineering effort of **hardware primitives plus a memory model plus safe reclamation**. The core tenets:
- The **CAS loop** is the foundation, **memory ordering** is the guardrail, and **memory reclamation** is the lifeline
- **Libraries beat building**, **measuring beats guessing**, **simplicity beats speed**
- Most business code does **not** need lock-free; locks plus good design are already enough

For related pages see **Memory Model** — the formal foundation of concurrent correctness.

## Sources

- The lock-free data structures and memory ordering chapters of *C++ Concurrency in Action*; see the mapping in [Authoritative Book Survey](../research/books.md)
- Original algorithm sources: Treiber Stack (1986 technical report), Michael-Scott Queue (PODC 1996), Hazard Pointer (Michael, TPDS 2004), RCU (McKenney et al.)
- The engineering solutions for ABA and deferred reclamation are a summary of general practice

## References

- [Wikipedia: Lock-free and wait-free algorithms](https://en.wikipedia.org/wiki/Lock-free_and_wait-free_algorithms)
- [Wikipedia: Compare-and-swap](https://en.wikipedia.org/wiki/Compare-and-swap)
- [C++ Atomics and Memory Ordering](https://en.cppreference.com/w/cpp/atomic/memory_order)

<!-- BACKLINKS-AUTO -->
## Related pages

- [hardware](hardware.md)
- [languages](languages.md)
- [os](os.md)
- [security](security.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [reliability](/practice/reliability.md)
- [seven-weeks](/practice/seven-weeks.md)
