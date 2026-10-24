# Semaphores

The semaphore is the classic synchronization primitive proposed by Dijkstra. In essence it is a **protected integer counter** plus a **waiting queue**, supporting atomic `P(wait)` and `V(signal)` operations.

## Core concepts

### Definition
```c
struct Semaphore {
    int value;           // counter
    Queue<Thread> waitq; // waiting queue
}
```

### Primitive operations
- **P / wait / acquire / down**:
  ```c
  void P() {
      atomic {
          value--;
          if (value < 0) block_current_thread();
      }
  }
  ```
- **V / signal / release / up**:
  ```c
  void V() {
      atomic {
          value++;
          if (value <= 0) wake_one_thread();
      }
  }
  ```

### Counter semantics
| value | Meaning |
|-------|------|
| > 0 | Number of available resources / number of threads allowed through |
| = 0 | No resources available; subsequent P blocks |
| < 0 | Absolute value = number of blocked threads |

## Semaphores vs mutexes

| Dimension | Mutex | Semaphore |
|------|--------|--------|
| Counter | Implicit 0/1 | Explicit non-negative integer |
| Ownership | Yes (only the holder can release) | No (any thread can V) |
| Use | Mutual exclusion | Mutual exclusion + synchronization + resource counting |
| Condition variable | Requires a mutex | Has its own waiting queue |

**Mutex = binary semaphore + ownership**. Semaphores are more general, but easy to misuse.

## Two classic uses

### 1. Mutual exclusion: binary semaphore
```c
Semaphore mutex = 1;

P(mutex);
// critical section
V(mutex);
```
Equivalent to a mutex, but without ownership protection, so it is easy to release by mistake.

### 2. Resource counting: counting semaphore
```c
Semaphore pool = N;  // N resources

// acquire a resource
P(pool);
use_resource();
// return the resource
V(pool);
```
Typical scenarios: connection pools, thread pools, object pools, rate limiters.

### 3. Thread synchronization: semaphore as a signal
```c
Semaphore ready = 0;  // starts at 0

// producer
produce();
V(ready);

// consumer
P(ready);
consume();
```
An alternative to condition variables — more concise but more limited in capability.

## Classic synchronization problems

### Producer-consumer (bounded buffer)
```c
Semaphore empty = N;   // empty slots
Semaphore full = 0;    // full slots
Semaphore mutex = 1;   // buffer mutual exclusion

// producer
P(empty);
P(mutex);
put(item);
V(mutex);
V(full);

// consumer
P(full);
P(mutex);
item = get();
V(mutex);
V(empty);
```

### Reader-writer
```c
// reader priority
Semaphore rmutex = 1;   // protects read_count
Semaphore wmutex = 1;   // write mutual exclusion / read-write mutual exclusion
int read_count = 0;

reader():
    P(rmutex);
    read_count++;
    if (read_count == 1) P(wmutex);
    V(rmutex);
    read();
    P(rmutex);
    read_count--;
    if (read_count == 0) V(wmutex);
    V(rmutex);

writer():
    P(wmutex);
    write();
    V(wmutex);
```

### Dining philosophers
```c
Semaphore fork[5] = {1,1,1,1,1};

philosopher(i):
    while (true) {
        think();
        P(fork[i]);
        P(fork[(i+1)%5]);
        eat();
        V(fork[i]);
        V(fork[(i+1)%5]);
    }
```
**Deadlock hazard**: everyone takes the left fork → everyone waits for the right. Solutions: numbered ordering, limiting concurrency, a waiter mode.

## Language support comparison

| Language | API | Notes |
|------|-----|------|
| POSIX C | `sem_t`, `sem_init/wait/post/destroy` | Named and unnamed semaphores |
| Java | `Semaphore` (java.util.concurrent) | Fair/unfair, interruptible |
| Go | No native semaphore | Use `chan struct{}` or `sync.Semaphore` (x/sync) |
| Rust | `std::sync::Semaphore` (nightly) / `tokio::sync::Semaphore` | Async-first |
| Python | `threading.Semaphore` / `asyncio.Semaphore` | Both sync and async |
| C++20 | `std::counting_semaphore` / `std::binary_semaphore` | Standard library support |

## Common semaphore pitfalls

| Pitfall | Consequence | Mitigation |
|------|------|------|
| Unpaired P/V | Counter drift, deadlock/leak | RAII wrappers, code review |
| Semaphore used as a mutex | No ownership, mistaken release | Prefer a mutex |
| Ignoring overflow | Too many V calls corrupt the counter | Bounded semaphore, assertions |
| Starvation | Unfair wakeup | Fair semaphore, monitor wait duration |
| Priority inversion | High priority blocked by low priority | Priority-inheritance semaphore |

## How semaphores are implemented

### User-space fast path
1. Atomic decrement/increment
2. The value did not cross zero → return directly
3. Crossed zero → enter the kernel via a system call

### Kernel slow path
- **P blocks**: the current thread joins the waiting queue, the scheduler switches
- **V wakes**: take a thread from the waiting queue, mark it ready, trigger scheduling

### Optimization: spin-then-sleep hybrid
Spin a few thousand times for short critical sections before entering the kernel, reducing context switches.

## Modern alternatives

| Scenario | Traditional semaphore | Modern alternative |
|------|------------|----------|
| Resource pool | Counting semaphore | `BlockingQueue`, connection pool libraries |
| Rate limiting | Semaphore | Token bucket, leaky bucket libraries |
| Production/consumption | Semaphore | `BlockingQueue`, Channel, Disruptor |
| Synchronization barrier | Semaphore | `CountDownLatch`, `CyclicBarrier`, `Phaser` |
| Asynchronous waiting | None | `CompletableFuture`, Promise/Future, async/await |

## Chapter summary

The semaphore is an elegant abstraction of **counter + waiting queue**, unifying the three scenarios of mutual exclusion, resource counting, and thread synchronization. In engineering practice, **prefer higher-level concurrency tools (queues, Latches, Channels, thread pools)**, and use a semaphore directly only when fine-grained counting control is needed — an inventory of the higher-level tools each language ecosystem offers is in [concurrency frameworks and tools](../practice/frameworks.md). See the related page on condition variables for a more flexible wait/notify mechanism.

## Sources

- POSIX semaphore semantics follow [sem_overview(7)](https://man7.org/linux/man-pages/man7/sem_overview.7.html)
- The acquire/release and permit semantics of Java Semaphore follow the [JDK documentation](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/Semaphore.html)
- The distinction between semaphore and mutex ownership is standard operating-systems textbook material

## References

- [Wikipedia · Semaphore](https://en.wikipedia.org/wiki/Semaphore_(programming))
- [The Little Book of Semaphores](https://greenteapress.com/wp/semaphores/)
- [Dijkstra · EWD108](https://www.cs.utexas.edu/users/EWD/transcriptions/EWD01xx/EWD108.html)

<!-- BACKLINKS-AUTO -->
## Related pages

- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [frameworks](/practice/frameworks.md)
