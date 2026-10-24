# Locks

Locks are the most basic and most commonly used synchronization primitive in concurrent programming. This chapter systematically covers lock classification, implementation principles, advanced properties, and engineering selection.

## Core lock classifications

### By implementation mechanism
| Type | Principle | Use case | Typical implementation |
|------|------|----------|----------|
| Spinlock | CAS busy-waiting | Very short critical section, no system calls | `spinlock_t`, `atomic_flag` |
| Mutex | Kernel block/wake | General, critical section may block | `pthread_mutex`, `std::mutex` |
| Reader-writer lock | Shared read / exclusive write | Many reads, few writes | `pthread_rwlock`, `ReentrantReadWriteLock` |
| Recursive lock | Counter + owner | Recursing into the same critical section | `PTHREAD_MUTEX_RECURSIVE` |
| Condition-variable lock | Paired with a condition variable | Complex wait/notify protocols | `pthread_cond_t` + mutex |

### By fairness
- **Fair lock**: FIFO queue, first-come-first-served, lower throughput
- **Unfair lock**: preemptive, high throughput, may starve (the default)

### By reentrancy
- **Reentrant lock**: the same thread can acquire it repeatedly, incrementing/decrementing a counter
- **Non-reentrant lock**: re-acquiring it deadlocks itself, slightly better performance

## Lock API comparison across mainstream languages

| Operation | Java | C++17 | Go | Rust | Python |
|------|------|-------|-----|------|--------|
| Create | `new ReentrantLock()` | `std::mutex m` | `sync.Mutex{}` | `Mutex::new()` | `threading.Lock()` |
| Lock | `lock.lock()` | `m.lock()` | `m.Lock()` | `m.lock()` | `lock.acquire()` |
| Unlock | `lock.unlock()` | `m.unlock()` | `m.Unlock()` | `m.unlock()` | `lock.release()` |
| Try lock | `lock.tryLock()` | `m.try_lock()` | `m.TryLock()` | `m.try_lock()` | `lock.acquire(block=False)` |
| With timeout | `tryLock(t, unit)` | `try_lock_for/until` | No native support | No native support | `acquire(timeout)` |
| Condition variable | `lock.newCondition()` | `std::condition_variable` | `sync.Cond` | `Condvar` | `threading.Condition` |

## Memory semantics of locks

### Acquiring a lock = acquire semantics
- Subsequent reads and writes cannot be reordered before the lock acquisition
- Guarantees seeing all writes made before another thread releases the lock

### Releasing a lock = release semantics
- Reads and writes before the release cannot be reordered after it
- Guarantees that writes before the release are visible to threads that acquire the lock afterward

**Locks provide a complete happens-before guarantee**: thread A releases a lock → thread B acquires the same lock, all of A's writes are visible to B.

## Java locks in depth

### synchronized vs ReentrantLock
| Property | synchronized | ReentrantLock |
|------|--------------|---------------|
| Syntax | Implicit (keyword sugar) | Explicit API |
| Interruptible | No | `lockInterruptibly()` |
| Timeout | No | `tryLock(timeout)` |
| Fairness | Unfair | Fair or unfair |
| Condition variables | `wait/notify` | `newCondition()`, multiple conditions |
| Performance | Slow in older versions, comparable after JDK 6+ optimizations | Stable |

> Note: "lock downgrade (write lock → read lock)" is a property of **reader-writer locks** (`ReentrantReadWriteLock` / `StampedLock`), not of the two mutexes in the table above — a mutex has no read/write distinction, so downgrade does not apply.

### The evolution of lock optimization
1. **Biased lock**: with no contention, a CAS records the thread ID, so later acquisitions are free
2. **Lightweight lock**: CAS contention with spinning, avoiding kernel switching
3. **Heavyweight lock**: heavy contention, kernel blocking queue
4. **Lock elision**: JIT escape analysis removes the lock when there is no sharing
5. **Lock coarsening**: merges adjacent synchronized blocks, reducing lock/unlock calls

Heavyweight locks ultimately fall back to a kernel blocking queue. The real cost of lock contention (the futex user-space fast path and kernel suspend/wake) is covered in [operating systems and concurrency](../advanced/os.md).

### StampedLock (JDK 8+)
- Three modes: write lock, pessimistic read lock, optimistic read lock
- Optimistic reads are lock-free, validating a version number; on conflict they degrade to a pessimistic read
- **Does not support reentrancy** and does not support condition variables
- Suited to read-heavy workloads with short read durations

## C++ lock best practices

### RAII guards: always use `std::lock_guard` / `std::unique_lock`
```cpp
std::mutex m;
void foo() {
    std::lock_guard<std::mutex> g(m);  // unlocks on destruction
    // critical section
}
```

### Avoiding deadlock with multiple locks: acquire them together with `std::lock`
```cpp
std::lock(m1, m2);  // atomically acquire multiple locks, avoiding deadlock
std::lock_guard<std::mutex> g1(m1, std::adopt_lock);
std::lock_guard<std::mutex> g2(m2, std::adopt_lock);
```

### `std::shared_mutex` reader-writer lock (C++17)
```cpp
std::shared_mutex rw;
void read() { std::shared_lock g(rw); }
void write() { std::unique_lock g(rw); }
```

## Go synchronization primitives

### sync.Mutex / sync.RWMutex
- Non-reentrant; calling Lock twice deadlocks
- RWMutex: `RLock()` for a read lock, `Lock()` for a write lock
- **Write lock priority**: new read locks wait for the write lock to be released, preventing write starvation

### sync.WaitGroup / sync.Once
- `WaitGroup`: wait for a group of goroutines to finish
- `Once`: run initialization exactly once (double-checked + atomic)

### sync.Map / the atomic package
- `sync.Map`: optimized for read-heavy workloads
- `atomic`: lock-free atomic operations, `Load/Store/Add/CAS`

## Rust ownership and locks

### `Mutex<T>` / `RwLock<T>`
- **The lock guards data ownership**: `lock()` returns a `MutexGuard<T>`, and unlocking is a Drop
- **Compile-time deadlock prevention**: the type system enforces the critical section scope
- **Send + Sync**: thread safety is inferred automatically

```rust
let m = Mutex::new(0);
*m.lock().unwrap() += 1;  // the Guard unlocks when it leaves scope
```

### Lock-free programming: the Atomic family
`AtomicBool`, `AtomicUsize`, `AtomicPtr`, and so on, combined with `Ordering` to control memory ordering.

## Lock performance optimization checklist

1. **Shrink the critical section**: protect only shared data access, move I/O and computation out
2. **Lower lock granularity**: segmented locks, bucketed locks, fine-grained locks
3. **Separate reads and writes**: use a reader-writer lock or lock-free structure for read-heavy workloads
4. **Avoid lock contention**: ThreadLocal, lock-free queues, Actor model
5. **Batch operations**: merge multiple lock acquisitions into one
6. **Lock hierarchy**: separate hot locks from cold locks, keep the hot path lock-free

## Common lock bug patterns

| Bug | Symptom | Fix |
|-----|------|------|
| Forgetting to unlock | Deadlock, throughput collapse | RAII / try-finally / defer |
| Changing lock object | Mutual exclusion fails | final/immutable lock object |
| Double-checked locking failure | Object visible before initialization | volatile / AtomicReference |
| Lock too coarse | Low concurrency | Fine-grained locks, segmented locks |
| Deadlock | System hang | Fixed lock order, tryLock timeout |
| Priority inversion | High-priority task delayed | Priority inheritance protocol |

## Chapter summary

Locks are the cornerstone of concurrent control. The recurring key points in engineering are **lock classification, memory semantics, language-specific APIs, performance optimization, and anti-patterns**; these affect both the correctness and the efficiency of concurrent code. Across processes, "who acts as the lock" becomes a lock service, and expiration plus misjudgment bring the new constraint of fencing tokens — see [reliability design](../practice/reliability.md). Related pages cover more flexible synchronization primitives such as semaphores and condition variables.

## Sources

- The synchronization chapter of *C++ Concurrency in Action* (multi-lock acquisition with `std::lock`); the mapping is in [authoritative books research](../research/books.md)
- The Rust ownership-and-locks section follows [The Rustonomicon](https://doc.rust-lang.org/nomicon/) and the Rust standard library documentation
- The memory semantics of Java locks (unlock happens-before lock) are stated in [JLS §17.4](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html)

## References

- [Wikipedia · Monitor](https://en.wikipedia.org/wiki/Monitor_(synchronization))
- [POSIX pthread.h (mutex)](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/pthread.h.html)
- [Java Concurrency Locks Package](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/package-summary.html)

<!-- BACKLINKS-AUTO -->
## Related pages

- [os](/advanced/os.md)
- [security](/advanced/security.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [frameworks](/practice/frameworks.md)
- [reliability](/practice/reliability.md)
