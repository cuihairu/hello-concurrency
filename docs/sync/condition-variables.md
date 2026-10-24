# Condition variables

A condition variable is the core primitive of a **wait/notify** mechanism: it lets a thread wait for some condition to become true, and combined with a mutex implements complex synchronization protocols.

## Core concepts

### Definition
A condition variable does not protect data; it **only coordinates thread timing**. It must be used together with a mutex:
- **The lock protects the shared state** (the predicate)
- **The condition variable waits for the state to change**

### The three operations
| Operation | Semantics |
|------|------|
| `wait(mutex)` | Atomically releases the lock and blocks; re-acquires the lock after being woken |
| `signal()` / `notify_one()` | Wakes at least one waiting thread |
| `broadcast()` / `notify_all()` | Wakes all waiting threads |

### Standard wait pattern
```c
pthread_mutex_lock(&mutex);
while (!condition) {          // must use while, to guard against spurious wakeup
    pthread_cond_wait(&cond, &mutex);
}
// condition holds, lock is held, run the critical section
pthread_mutex_unlock(&mutex);
```

### Notification pattern
```c
pthread_mutex_lock(&mutex);
condition = true;
pthread_cond_signal(&cond);  // or broadcast
pthread_mutex_unlock(&mutex);
```

## Why a while loop?

### Spurious wakeup
A thread may be woken without any `signal` (POSIX permits it; it is a Linux futex implementation detail).

### Lost signal
Between `signal` and `wait` re-acquiring the lock, another thread may preempt and change the condition.

### Multiple conditions sharing one CV
Different conditions share a single `cond`, so a woken thread must re-check.

**Conclusion: `wait` must be inside a `while (!predicate)` loop.**

## Classic synchronization patterns

### Producer-consumer (bounded queue)
```java
class BoundedQueue<T> {
    final Lock lock = new ReentrantLock();
    final Condition notEmpty = lock.newCondition();
    final Condition notFull = lock.newCondition();
    final T[] items;
    int head, tail, count;

    void put(T x) throws InterruptedException {
        lock.lock();
        try {
            while (count == items.length) notFull.await();
            items[tail] = x;
            if (++tail == items.length) tail = 0;
            ++count;
            notEmpty.signal();
        } finally { lock.unlock(); }
    }

    T take() throws InterruptedException {
        lock.lock();
        try {
            while (count == 0) notEmpty.await();
            T x = items[head];
            items[head] = null;
            if (++head == items.length) head = 0;
            --count;
            notFull.signal();
            return x;
        } finally { lock.unlock(); }
    }
}
```

### Reader-writer (writer priority)
```java
class RWLock {
    final Lock mutex = new ReentrantLock();
    final Condition readCond = mutex.newCondition();
    final Condition writeCond = mutex.newCondition();
    int readers = 0, writers = 0, waitingWriters = 0;

    void readLock() {
        mutex.lock();
        try {
            while (writers > 0 || waitingWriters > 0) readCond.await();
            readers++;
        } finally { mutex.unlock(); }
    }

    void readUnlock() {
        mutex.lock();
        try {
            if (--readers == 0) writeCond.signal();
        } finally { mutex.unlock(); }
    }

    void writeLock() {
        mutex.lock();
        try {
            waitingWriters++;
            while (readers > 0 || writers > 0) writeCond.await();
            waitingWriters--;
            writers = 1;
        } finally { mutex.unlock(); }
    }

    void writeUnlock() {
        mutex.lock();
        try {
            writers = 0;
            if (waitingWriters > 0) writeCond.signal();
            else readCond.signalAll();
        } finally { mutex.unlock(); }
    }
}
```

### Thread pool task queue
```java
class ThreadPool {
    final Lock lock = new ReentrantLock();
    final Condition taskAvailable = lock.newCondition();
    final Deque<Runnable> queue = new ArrayDeque<>();
    final int maxSize;

    void submit(Runnable task) {
        lock.lock();
        try {
            while (queue.size() == maxSize) taskAvailable.await();
            queue.add(task);
            taskAvailable.signal();
        } finally { lock.unlock(); }
    }

    Runnable takeTask() {
        lock.lock();
        try {
            while (queue.isEmpty()) taskAvailable.await();
            return queue.poll();
        } finally { lock.unlock(); }
    }
}
```

## Choosing between signal and broadcast

| Scenario | Choice | Reason |
|------|------|------|
| Single producer, single consumer | `signal` | Only one needs waking |
| Multiple producers, multiple consumers | `signal` | Avoids a thundering herd, higher throughput |
| State broadcast (e.g. shutdown) | `broadcast` | All waiters must be informed |
| A condition may be satisfied by multiple threads | `broadcast` | Prevents a lost signal |

**Rule of thumb**: default to `signal`, and use `broadcast` only when "the state changes globally and all waiters must re-evaluate".

## Language support comparison

| Language | Type | Key API |
|------|------|----------|
| POSIX C | `pthread_cond_t` | `wait`, `signal`, `broadcast`, `timedwait` |
| Java | `Condition` (Lock.newCondition) | `await`, `signal`, `signalAll`, `awaitNanos` |
| C++11 | `std::condition_variable` | `wait`, `notify_one`, `notify_all`, `wait_for` |
| Go | `sync.Cond` | `Wait`, `Signal`, `Broadcast` (requires a manual mutex) |
| Rust | `std::sync::Condvar` | `wait`, `notify_one`, `notify_all` |
| Python | `threading.Condition` | `wait`, `notify`, `notify_all` |

### Special usage of Go sync.Cond
```go
var mu sync.Mutex
cond := sync.NewCond(&mu)

cond.L.Lock()
for !condition {
    cond.Wait()
}
cond.L.Unlock()
```
**Note**: Go's `Cond` does not own a lock; you must pass an external `L *sync.Mutex`.

## Condition variables vs semaphores

| Dimension | Condition variable | Semaphore |
|------|----------|--------|
| Wait condition | Any boolean predicate | Counter >= 0 |
| Notification precision | Single/broadcast | Single (the V operation) |
| State check | Explicit while loop | Implicit inside P |
| Flexibility | High (complex protocols) | Low (counting synchronization) |
| Ease of use | Error-prone (requires a lock) | Relatively simple |

## Common errors and best practices

### Error 1: calling wait without holding the lock
```c
// wrong
pthread_cond_wait(&cond, &mutex);  // mutex not locked
```

### Error 2: modifying the condition without holding the lock
```c
// wrong: a race between the condition change and the waiter's check → lost wakeup
condition = true;                   // change the condition without the lock
pthread_cond_signal(&cond);         // the waiter may not have entered wait yet, so the signal evaporates
```
**Fix**: **modifying the condition** must be done while holding the mutex (the waiter checks the condition inside the lock, and `pthread_cond_wait` atomically performs "release lock + wait"). Note the distinction: under POSIX, calling `pthread_cond_signal` **without holding the lock is legal**, at worst causing the woken thread to immediately fail to grab the lock (a performance issue); Java's `Condition.signal()`, by contrast, must be called while holding the lock or it throws `IllegalMonitorStateException`.

### Error 3: using if instead of while
```c
// wrong
if (!condition) pthread_cond_wait(&cond, &mutex);
```

### Error 4: releasing the lock before signal in Java
```java
// wrong: Java's Condition.signal() must be called while holding the lock
lock.lock();
condition = true;
lock.unlock();   // release the lock first
cond.signal();   // no longer holding the lock → IllegalMonitorStateException
```
**Fix**: signal inside the critical section, then release the lock. Compare with POSIX pthread: signaling outside the lock is also correct, and "signal outside the lock" avoids the woken thread immediately colliding with the lock (hurry-up-and-wait), a common micro-optimization — the two APIs' constraints point in opposite directions, which is the easiest thing to get wrong when mixing them.

### Best practice checklist
1. **Always wait in a while loop**
2. **Modify the condition and signal in the same critical section**
3. **Prefer signal, use broadcast only when necessary**
4. **Wrap it in higher-level tools**: BlockingQueue, Latch, Barrier, Channel
5. **Timeout waits**: `awaitNanos` / `wait_for` to prevent deadlock
6. **Avoid nested wait**: extremely hard to reason about; refactor into a state machine

## Modern alternatives

| Scenario | Traditional CV | Modern alternative |
|------|---------|----------|
| Task queue | CV + queue | `BlockingQueue`, Channel, Disruptor |
| One-shot wait | CV + bool | `CountDownLatch`, `CompletableFuture` |
| Cyclic barrier | CV + counter | `CyclicBarrier`, `Phaser` |
| Lifecycle control | CV + state | Structured concurrency, cancellation tokens |
| Asynchronous orchestration | CV + callback | `async/await`, Reactive Streams |

## Chapter summary

The condition variable is the infrastructure for **waiting on and notifying arbitrary predicates**; combined with a mutex it can build arbitrarily complex synchronization protocols. The core rules: **while loop + modify the condition while holding the lock + signal**. In engineering, prefer the higher-level concurrency tools your language library provides, and manipulate a CV directly only when implementing a low-level protocol. See the related page on barriers — a synchronization point for multiple threads to advance together.

## Sources

- POSIX condition variable semantics (spurious wakeup, signaling outside the lock is legal) follow [pthread_cond_wait(3)](https://man7.org/linux/man-pages/man3/pthread_cond_wait.3.html)
- The constraint that Java's Condition must signal while holding the lock follows the [JDK documentation](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/Condition.html)

## References

- [POSIX pthread.h (condition variables)](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/pthread.h.html)
- [Wikipedia · Monitor](https://en.wikipedia.org/wiki/Monitor_(synchronization))
- [Java Concurrency Locks Package](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/package-summary.html)

<!-- BACKLINKS-AUTO -->
## Related pages

- [os](/advanced/os.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [async](/practice/async.md)
- [reactor](/practice/reactor.md)
