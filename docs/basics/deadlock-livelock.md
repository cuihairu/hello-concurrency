# Deadlock and livelock

Deadlock and livelock are the trickiest pathological phenomena in concurrent programming; understanding their causes, detection, and prevention is key to building robust concurrent systems.

## Deadlock

### Definition
Two or more threads permanently block because each waits for a resource held by another, and the system cannot proceed.

### The four necessary conditions of deadlock (Coffman conditions)
1. **Mutual exclusion**: resources are used exclusively
2. **Hold and wait**: a thread holds resources while requesting new ones
3. **No preemption**: resources can only be released voluntarily
4. **Circular wait**: a cycle of waiting forms

**All four conditions hold ⇔ deadlock occurs**; breaking any one condition prevents deadlock.

### Classic deadlock example
```java
// Dining philosophers: 5 philosophers share 5 chopsticks
// Each philosopher needs the left and right chopsticks to eat
// Everyone picks up the left → everyone waits for the right → deadlock
```

### Deadlock prevention strategies

| Strategy | Condition broken | Implementation | Cost |
|------|----------|----------|------|
| Acquire all at once | Hold and wait | Request all resources at startup | Low resource utilization, starvation |
| Ordered resource allocation | Circular wait | Globally number, request in order | Programming constraint, poor flexibility |
| Allow resource preemption | No preemption | Release on timeout, priority preemption | Complex implementation, may starve |
| Timeout mechanism | Circular wait | `lock.tryLock(timeout)` | Requires retryable business logic |

### Deadlock avoidance: the banker's algorithm
Dynamically judges at run time whether a resource allocation is safe. Used only for scenarios with a fixed set of resource types and known processes; rarely used in engineering practice.

### Deadlock detection and recovery
- **Detection**: find cycles in the resource allocation graph / wait graph
- **Recovery**: terminate a process, preempt resources, roll back

### Engineering practice: deadlock investigation checklist
1. **Fix the lock order**: a global convention, enforced in code review
2. **Avoid nested locks**: single-lock design; where necessary use `tryLock` + fallback
3. **Lock timeout**: replace all blocking locks with timed versions
4. **Deadlock monitoring**: periodic inspections with jstack / `go tool pprof`
5. **Lock hierarchy**: number by business layer; higher layers do not call lower-layer locks

## Livelock

### Definition
Threads are not blocked but keep retrying and yielding, never making progress. Analogy: two people stepping aside for each other repeatedly in a hallway, neither able to pass.

### Typical scenario
```java
// Classic livelock: both detect the conflict, both back off, both retry at once
while (!tryAcquire()) {
    backoff();  // fixed backoff → synchronized retry → permanent conflict
}
```

### Livelock vs deadlock

| Feature | Deadlock | Livelock |
|------|------|------|
| Thread state | Blocked | Running (but no progress) |
| CPU usage | Low | High (busy-waiting) |
| Root cause | Circular wait on resources | Synchronized retry strategy |
| Fix | Break one of the four conditions | Random backoff, queuing |

### Livelock prevention
- **Random backoff**: `ThreadLocalRandom.current().nextInt(100)` breaks the synchronization
- **Exponential backoff**: the more failures, the longer the wait
- **Queuing**: turn contention into a queue, e.g. `ReentrantLock` fair mode
- **Avoid symmetric logic**: introduce randomness or priority differentiation

## Starvation

### Definition
A thread cannot obtain a CPU time slice or its required resource for a long time, so its task cannot proceed.

### Common causes
- **Priority inversion**: a high-priority thread waits for a lock held by a low-priority thread
- **Unfair locks**: newly arriving threads keep preempting, starving older threads
- **Resource exhaustion**: connection pools or thread pools are exhausted with no new resource

### Solutions
- **Priority inheritance/ceiling**: temporarily raise the priority of the lock-holding thread
- **Fair locks / waiting queue**: guarantee first-come-first-served
- **Resource quotas**: rate limiting, tiered isolation
- **Monitoring and alerting**: queue backlog, wait-duration metrics

## Priority inversion and priority inheritance

### Scenario
```
High-priority H waits for lock L
Medium-priority M preempts the CPU
Low-priority L holds the lock but cannot run → H waits forever
```

### Priority inheritance protocol
While L holds the lock it temporarily inherits H's priority, preempting M to run, and restores it after releasing the lock.

### Implementation support
- pthread: `pthread_mutexattr_setprotocol(PTHREAD_PRIO_INHERIT)`
- FreeRTOS: `configUSE_PRIORITY_INHERITANCE`
- Linux futex: `FUTEX_LOCK_PI`

## Chapter summary

| Phenomenon | Core cause | Core countermeasure |
|------|----------|----------|
| Deadlock | Circular wait | Fixed lock order, timeouts, avoid nesting |
| Livelock | Synchronized retry | Random backoff, queuing |
| Starvation | Unfair scheduling | Fair locks, priority inheritance, quotas |

Preventing deadlock beats detecting it, and detecting beats recovering from it. In engineering the highest-value combination is **fixed lock order + timed locks + deadlock monitoring**.

## Sources

- The four necessary conditions of deadlock come from E. G. Coffman, M. J. Elphick, A. Shoshani, *System Deadlocks*, Computing Surveys 3(2), 1971
- Priority inversion and the priority inheritance protocol come from L. Sha, R. Rajkumar, J. P. Lehoczky, *Priority Inheritance Protocols*, IEEE Transactions on Computers 39(9), 1990
- Random backoff and queuing for livelock are a general engineering-practice summary, not based on a single reference

## References

- [Wikipedia · Deadlock](https://en.wikipedia.org/wiki/Deadlock)
- [Wikipedia · Livelock](https://en.wikipedia.org/wiki/Livelock)
- [Wikipedia · Dining philosophers](https://en.wikipedia.org/wiki/Dining_philosophers_problem)

<!-- BACKLINKS-AUTO -->
## Related pages

- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [reliability](/practice/reliability.md)
