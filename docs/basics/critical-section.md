# Critical sections and mutual exclusion

A critical section is a code segment that accesses a shared resource; a mutual exclusion mechanism guarantees that only one thread enters the critical section at a time. It is the foundation of concurrent programming.

## The critical section problem

### Definition
When multiple threads concurrently access a shared resource (a variable, file, device, etc.), if left uncontrolled the final result depends on the execution timing. This is the critical section problem.

### Classic example: bank account transfer
```java
// Not thread-safe
class Account {
    private int balance = 1000;
    void transfer(int amount) {
        balance = balance - amount;  // Non-atomic: read-modify-write
    }
}
```
Two threads each transfer 100, expecting a balance of 800, but may actually get 900 (lost update).

### Three elements of a critical section
1. **Shared resource**: data or devices accessed by multiple threads
2. **Critical section code**: the code segment that accesses the shared resource
3. **Mutual exclusion mechanism**: guarantees that only one thread enters the critical section at a time

## Layers of mutual exclusion implementation

### Hardware layer: atomic instructions
- **Test-and-Set (TSL)**: atomically read and write
- **Compare-and-Swap (CAS)**: compare and swap, a core primitive of modern CPUs
- **Load-Linked/Store-Conditional (LL/SC)**: common on ARM and RISC-V

### OS layer: system calls
- **Mutex**: blocking mutual exclusion, with an ownership concept
- **Spinlock**: busy-waiting, suitable for very short critical sections
- **Semaphore**: a counter mechanism, able to provide both mutual exclusion and synchronization

### Language/library layer: high-level abstractions
- `synchronized` (Java), `lock` (C#), `std::mutex` (C++)
- `threading.Lock` (Python), `sync.Mutex` (Go)
- Advanced locks such as `ReentrantLock`, reader-writer locks, and StampedLock

## Core properties of a mutex

| Property | Description |
|------|------|
| **Mutual exclusion** | Only one thread holds the lock at a time |
| **Visibility** | Writes made before unlocking are visible to threads that lock afterward |
| **Reentrancy** | The same thread can acquire the same lock repeatedly (recursive lock) |
| **Fairness** | The waiting queue acquires the lock in request order (fair lock) |

## Lock classification and selection

### By implementation
| Type | Use case | Pros | Cons |
|------|----------|------|------|
| Spinlock | Very short critical section, no blocking operations | No context-switch overhead | Consumes CPU, disastrous for long critical sections |
| Mutex | General scenarios, may block | A sleeping thread does not occupy CPU | High switching overhead |
| Reader-writer lock | Many reads, few writes | Concurrent reads, exclusive writes | Write starvation, complex implementation |
| Recursive lock | Recursively calling the same critical section | Simplifies recursive logic | Can mask design flaws |

### By fairness
- **Fair lock**: acquires in request order, lower throughput, no starvation
- **Unfair lock**: preemptive, high throughput, possible starvation (the default choice)

## Deadlock prevention: lock ordering rules

In multi-lock scenarios a **globally fixed acquisition order** is mandatory, otherwise deadlock is certain:
```java
// Thread A: lock(X) → lock(Y)
// Thread B: lock(Y) → lock(X)  // deadlock!

// Fix: unify the order lock(X) → lock(Y)
```

## Lock granularity trade-off

| Granularity | Concurrency | Overhead | Complexity | Typical scenario |
|------|--------|------|--------|----------|
| Coarse-grained (global lock) | Low | Low | Low | Simple business logic, low concurrency |
| Fine-grained (segmented locks, bucketed locks) | High | High | High | High-concurrency containers, databases |
| Lock-free (CAS, atomic variables) | Very high | Medium | Very high | Counters, queues, references |

## Common error patterns

1. **Double-checked locking failure**: instruction reordering makes the object visible before it is fully initialized
2. **Changing lock object**: `synchronized(list)` followed by `list = new ArrayList()`
3. **Lock too coarse**: the critical section contains expensive operations such as I/O, sleeping, or logging
4. **Forgetting to unlock**: exception paths do not release; must use `try-finally` or `defer`
5. **Inconsistent nested lock order**: leads to deadlock

## Lock-free alternatives

- **ThreadLocal**: a per-thread private copy, avoiding sharing
- **Immutable objects**: naturally thread-safe, no locking needed
- **Atomic classes**: `AtomicInteger`, `LongAdder`, and so on
- **Concurrent containers**: `ConcurrentHashMap`, `CopyOnWriteArrayList`
- **Actor/CSP model**: avoiding shared state through message passing

## Chapter summary

Mutual exclusion is the core means of solving the critical section problem. When handling a mutual exclusion problem I first look at lock classification, properties, selection principles, and common pitfalls. Related pages also cover richer synchronization primitives such as semaphores and condition variables.

## References

- [Dijkstra · Mutual exclusion (EWD108)](https://www.cs.utexas.edu/users/EWD/transcriptions/EWD01xx/EWD108.html)
- [Wikipedia · Semaphore](https://en.wikipedia.org/wiki/Semaphore_(programming))
- [POSIX pthread.h](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/pthread.h.html)

<!-- BACKLINKS-AUTO -->
## Related pages

- [os](/advanced/os.md)
- [security](/advanced/security.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [frameworks](/practice/frameworks.md)
- [reliability](/practice/reliability.md)
