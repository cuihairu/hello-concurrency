# Memory Model

The memory model defines **the visibility and ordering guarantees of memory operations in a multithreaded program**, and is the formal foundation of concurrent correctness. Understanding the memory model is a prerequisite for writing correct lock-free code and diagnosing baffling concurrency bugs. For the hardware-side reasons why reordering happens — cache coherence, store buffers, and barrier instructions — see [Hardware and the Memory Hierarchy](./hardware.md); for a cross-language comparison of concurrency support see [Programming Languages and Concurrency Support](./languages.md).

## Why a Memory Model Is Needed

### Hardware Reordering
| Source | Behavior | Example |
|--------|----------|---------|
| **Compiler** | Register allocation, common subexpression elimination, loop-invariant code motion | `x = a; y = b;` -> `y = b; x = a;` |
| **CPU pipeline** | Out-of-order execution, speculative execution, store forwarding | Writes become visible late via the Store Buffer |
| **Cache hierarchy** | Multicore cache coherence protocols (MESI) have propagation delay | Core 0 writes, core 1 reads slightly later |

**Single-threaded semantics are unchanged**: reordering does not change what a single thread observes. **With multiple threads, reordering effects become visible**.

## Core Concepts

### Happens-Before (HB)
A **partial order**: `A hb B` means the effects of A are visible to B, and A happens before B.

| Rule | Source |
|------|--------|
| Program order | Code order within a single thread |
| Monitor locks | `unlock hb lock` (the same lock) |
| volatile/atomic | `write hb read` (the same variable) |
| Thread start | `Thread.start hb` the first action in the thread |
| Thread join | The last action in the thread `hb Thread.join` |
| Transitivity | `A hb B and B hb C implies A hb C` |

**Definition of a data race**: two conflicting accesses (read-write/write-write) with no happens-before relationship constitute a data race. Consequences vary by language: in C++/Rust it is undefined behavior (UB); Java falls outside sequentially consistent guarantees, but the behavior is still constrained by the JMM's allowed set, not UB; in Go, once a race is present the DRF-SC guarantee stops applying. For a clause-by-clause check against the spec originals, see [Official Memory Model Spec Cross-Check](/research/memory-model-specs).

### Sequential Consistency (SC)
The **strongest model**: all threads' operations have a single global total order, and that order is consistent with each thread's program order.
- Matches intuition and is easy to reason about
- Worst performance: it forbids all reordering and requires full fences

### Comparison of Modern Language Models

| Language | Model type | Key features |
|----------|-----------|--------------|
| **Java (JMM)** | HB plus causality | `volatile`, `final`, safe initialization |
| **C++11** | HB plus `memory_order` | Fine-grained orders, no thread semantics for `volatile` |
| **Go** | HB plus channel synchronization | Channel communication establishes HB, sequentially consistent when race-free (DRF-SC) |
| **Rust** | HB plus the ownership type system | Compile-time prevention of data races, no thread semantics for `volatile` |
| **Python** | GIL plus HB | The GIL serializes bytecode; only C extensions need care |
| **JavaScript** | Single-threaded plus Workers | `SharedArrayBuffer` plus `Atomics` introduce HB |

## Depth: The Java Memory Model (JMM)

### volatile Semantics
```java
volatile int v = 0;
// write
v = 1;  // StoreStore + StoreLoad barrier
// read
int x = v;  // LoadLoad + LoadStore barrier
```
- **Visibility**: a write happens-before a subsequent read
- **Ordering**: forbids reordering of `volatile` reads/writes with ordinary reads/writes
- **Does not guarantee atomicity of compound operations**: `v++` is a three-step read-modify-write, and `volatile` cannot stop the interleaving; use `AtomicLong`/`LongAdder` for counting. A single `volatile long`/`double` read or write has been atomic since Java 5 (JLS section 17.7), on 32-bit platforms as well

### final Semantics
```java
class Foo {
    final int x;  // write to a final field
    Foo() { x = 1; }  // Freeze at the end of the constructor
}
// reading a final field: the constructor happens-before reading the final field
```
- **Safe publication**: a `final` object that is constructed correctly can be shared without synchronization

### Lock Semantics
```java
synchronized(lock) {  // lock: LoadLoad+LoadStore (acquire)
    // critical section
}  // unlock: StoreStore+StoreLoad (release)
```
- `unlock hb lock`: writes before releasing a lock are visible after acquiring it

### Double-Checked Locking (DCL) Fix
```java
// Fixed with volatile in JDK 5+
class Singleton {
    private static volatile Singleton instance;
    static Singleton get() {
        Singleton local = instance;  // read volatile
        if (local == null) {
            synchronized (Singleton.class) {
                local = instance;
                if (local == null) instance = local = new Singleton();
            }
        }
        return local;
    }
}
```
**Key point**: `volatile` forbids reordering of `new Singleton()` (allocate memory -> initialize -> assign the reference).

## Depth: The C++11 Memory Model

### Atomic Operations and memory_order
```cpp
std::atomic<int> x{0}, y{0};

// thread 1
x.store(1, std::memory_order_release);
y.store(1, std::memory_order_relaxed);

// thread 2
if (y.load(std::memory_order_acquire)) {
    assert(x.load(std::memory_order_relaxed) == 1);  // guaranteed to hold
}
```

| Order | Applicable operations | Typical scenarios |
|-------|----------------------|-------------------|
| `relaxed` | All | Counters, statistics, no synchronization |
| `acquire` | load | Reading flags, acquiring locks |
| `release` | store | Writing flags, releasing locks |
| `acq_rel` | RMW (CAS/FAA) | Spinlocks, reference counts |
| `seq_cst` | All | Default, global order, simple correctness |

### Data Race Equals UB
```cpp
// UB: concurrent read/write without synchronization
int x = 0;
thread t1([&]{ x = 1; });
thread t2([&]{ x = 2; });
```
**The compiler may assume there is no data race, and optimize away reads/writes, turn loops into infinite loops, or produce arbitrary results**.

## Hardware Memory Models

### x86-TSO (Total Store Order)
- **Store Buffer**: writes enter the Store Buffer first, then asynchronously flush to L1
- **Loads may pass stores**: a load reads an unflushed Store Buffer on the same core (Store Forwarding)
- **Only Store-Load reordering is allowed**: all other reorderings are forbidden
- **`MFENCE` / `LOCK` prefix** as full fences

### ARMv8 / RISC-V (Weak Ordering)
- **All reorderings allowed**: Load-Load, Load-Store, Store-Load, Store-Store
- **Explicit barriers**: `DMB` (Data Memory Barrier), `DSB` (Data Synchronization Barrier)
- **Exclusive monitor**: `LDXR/STXR` implements atomic RMW

### Compiler-to-Hardware Mapping
| C++ memory_order | x86 instruction | ARMv8 instruction |
|------------------|-----------------|-------------------|
| `relaxed` | `mov` | `ldr/str` |
| `acquire` (load) | `mov` | `ldar` (Load-Acquire) |
| `release` (store) | `mov` | `stlr` (Store-Release) |
| `acq_rel` (RMW) | `lock cmpxchg` | `ldaxr/stlxr` |
| `seq_cst` | `lock` plus `mfence` | `dmb ish` plus `ldar/stlr` |

## Classic Concurrency Bugs and the Memory Model

### 1. Publishing a Fully Uninitialized Object
```java
// Wrong: publishing the reference may happen before the fields are initialized
object = new MyObject();  // reordering: allocate -> assign reference -> initialize fields
// Fix: volatile / final / synchronized / static initialization
```

### 2. Flag Synchronization Failing
```c
// Wrong: no memory ordering guarantee
int ready = 0;
int data = 0;
// thread 1
data = 42;
ready = 1;  // the compiler/CPU may reorder this

// thread 2
if (ready) use(data);  // may read data=0
// Fix: atomic plus release/acquire
```

### 3. Double-Checked Locking (Without volatile)
```java
// Wrong before JDK 5
if (instance == null) {
    synchronized (Singleton.class) { if (instance == null) instance = new T(); }
}
// Fix: make instance volatile
```

### 4. Lazy Initialization Race
```java
// Wrong: concurrent initialization from multiple threads
if (cache == null) cache = new HashMap<>();
// Fix: ConcurrentHashMap.computeIfAbsent / DCL / static inner class
```

## Memory Model Verification Tools

| Tool | Language | Function |
|------|----------|----------|
| **CDSChecker** | C/C++ | Model checking, data races, HB violations |
| **Nidhugg** | C/C++ | Lock-free algorithm verification, TSO/PSO/RC11 |
| **GenMC** | C/C++ | Model checking, weak memory models |
| **Herder** | C/C++ | Consistency checking |
| **jcstress** | Java | Concurrency stress testing, JMM verification |
| **Litmus** | General | Hardware memory model test suite |
| **TLA+ / PlusCal** | Specification | Algorithm-level correctness proofs |

## Best Practices Checklist

1. **Prefer higher-level concurrency tools**: `ConcurrentHashMap`, `BlockingQueue`, channels, Actors
2. **When atomics/volatile are unavoidable**:
   - Explicitly mark `memory_order` / `volatile`
   - Draw the HB graph and confirm the critical path
   - Unit tests plus `jcstress` / TSan stress testing
3. **Avoid data races**: the compiler's no-race optimization assumptions are extremely aggressive
4. **Understand the publish-subscribe pattern**: write-publish with `release` -> read-subscribe with `acquire`
5. **Prefer final/immutable**: immune to reordering at compile time / run time
6. **Document synchronization conventions**: which variable establishes HB, which lock protects which data

## Chapter summary

The memory model is **a contract between a concurrent program and hardware/compiler optimizations**. The core tenets:
- **HB is a reasoning tool**: draw the graph, find the chain, verify visibility
- **Zero tolerance for data races**: C++/Rust treat it as UB, and Java/Go do not judge it as UB but still require it be eliminated; cover everything with TSan/model checking
- **Weak ordering needs explicit synchronization**: `release`/`acquire`, `volatile`, locks, channels
- **Libraries hide the complexity**: 99% of scenarios use libraries, and only the 1% of low-level libraries need hand-written atomics

For related pages see **Concurrent Data Structures** — the engineered building blocks layered on top of the memory model.

## Sources

Normative conclusions follow the originals; entry points to the four memory model specifications:

- [JLS SE21 section 17.4 Threads and Locks](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html): the JMM, the happens-before and data race definitions (section 17.4.5)
- [C++ working draft [intro.races]](https://eel.is/c++draft/intro.races): the source of the clause that a data race is undefined behavior
- [Rust Reference: Behavior considered undefined](https://doc.rust-lang.org/reference/behavior-considered-undefined.html): the first item on the UB list, and it applies equally inside `unsafe` blocks
- [The Go Memory Model](https://go.dev/ref/mem): the DRF-SC conclusion and the clause that a detected race may report an error and terminate

The memory model for Rust atomic operations follows the C++20 rules with `consume` removed; see [std::sync::atomic](https://doc.rust-lang.org/std/sync/atomic/index.html). The clause for the single total order of `seq_cst` is in [atomics.order](https://eel.is/c++draft/atomics.order). The clause-by-clause cross-check and the four-language comparison table are in [Official Memory Model Spec Cross-Check](/research/memory-model-specs).

## References

- [Go Memory Model](https://go.dev/ref/mem)
- [Java Memory Model (JLS 17)](https://docs.oracle.com/javase/specs/jls/se8/html/jls-17.html)
- [C++ Memory Ordering](https://en.cppreference.com/w/cpp/atomic/memory_order)

<!-- BACKLINKS-AUTO -->
## Related pages

- [hardware](hardware.md)
- [languages](languages.md)
- [security](security.md)
- [trends](trends.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [functional](/models/functional.md)
- [frameworks](/practice/frameworks.md)
- [seven-weeks](/practice/seven-weeks.md)
- [memory-model-specs](/research/memory-model-specs.md)
