# Reader-Writer

The reader-writer problem is the classic concurrency optimization for **read-heavy, write-light** scenarios: it allows many readers to read concurrently, while a writer gets exclusive access to write, maximizing read concurrency under the premise of data consistency.

## Problem definition

| Role | Behavior | Constraint |
|------|------|------|
| **Reader** | Reads shared data only | Multiple readers may run concurrently, data is not modified |
| **Writer** | Modifies shared data | Exclusive access, blocks all readers/writers |

### Correctness requirements
1. **Write exclusivity**: A writer is mutually exclusive with any reader/writer
2. **Read sharing**: When there is no writer, any number of readers may run concurrently
3. **No starvation**: Reasonable scheduling prevents reader/writer starvation

## Three classic variants

| Variant | Priority | Use cases | Cons |
|------|--------|----------|------|
| **Reader-preferred** | Readers | Reads extremely frequent, writes rare, write latency tolerable | Writers may starve |
| **Writer-preferred** | Writers | Write timeliness is critical, config hot-reload | Readers may starve, read concurrency suffers |
| **Fair / round-robin** | First-come first-served | Predictable latency, no starvation | Complex implementation, read concurrency compromised |

## Java implementation comparison

### 1. ReentrantReadWriteLock (JDK standard)
```java
class RWCache<K,V> {
    final ReentrantReadWriteLock rwl = new ReentrantReadWriteLock();
    final Lock r = rwl.readLock(), w = rwl.writeLock();
    final Map<K,V> map = new HashMap<>();

    V get(K key) {
        r.lock();
        try { return map.get(key); }
        finally { r.unlock(); }
    }

    V put(K key, V value) {
        w.lock();
        try { return map.put(key, value); }
        finally { w.unlock(); }
    }

    // Downgrade: write lock -> read lock (supported)
    V putIfAbsent(K key, V value) {
        w.lock();
        try {
            V v = map.get(key);
            if (v != null) return v;       // Value already present: read lock not yet acquired, return directly
            map.put(key, value);
            r.lock();                       // Downgrade step 1: acquire the read lock first
            try {
                return map.get(key);
            } finally {
                r.unlock();                 // Critical: always release the read lock, otherwise the write lock downgrades to a read lock and holds it forever, blocking writers permanently
            }
        } finally {
            w.unlock();                     // Downgrade step 2: then release the write lock
        }
    }
}
```
- **Default is unfair**: New readers may jump ahead of a waiting writer
- **Fair mode**: `new ReentrantReadWriteLock(true)`, FIFO queue
- **Lock downgrade supported**: write lock -> read lock (acquire read lock before releasing write lock)
- **Lock upgrade not supported**: read lock -> write lock will deadlock

### 2. StampedLock (JDK 8+ optimistic read)
```java
class StampedCache<K,V> {
    final StampedLock sl = new StampedLock();
    final Map<K,V> map = new HashMap<>();

    V get(K key) {
        // 1. Optimistic read: lock-free, very fast, may fail
        long stamp = sl.tryOptimisticRead();
        V v = map.get(key);
        if (sl.validate(stamp)) return v;  // No write happened during this window, validation passed

        // 2. Pessimistic read: shared lock, blocks writers
        stamp = sl.readLock();
        try { return map.get(key); }
        finally { sl.unlockRead(stamp); }
    }

    V put(K key, V value) {
        long stamp = sl.writeLock();
        try { return map.put(key, value); }
        finally { sl.unlockWrite(stamp); }
    }

    // Start with a read lock, upgrade to write lock if needed (tryConvertToWriteLock converts in place when uncontended)
    V computeIfAbsent(K key, Function<K,V> fn) {
        long stamp = sl.readLock();
        try {
            V v = map.get(key);
            if (v != null) return v;
            // Read->write cannot upgrade in place: tryConvertToWriteLock converts directly when uncontended (stamp becomes a write stamp);
            // when contended it returns 0, in which case the read lock must be released first and the write lock acquired the normal way
            long ws = sl.tryConvertToWriteLock(stamp);
            if (ws == 0L) {
                sl.unlockRead(stamp);
                stamp = sl.writeLock();
            } else {
                stamp = ws;
            }
            // At this point a write lock is definitely held; another party may have written the same key in the meantime,
            // computeIfAbsent checks before computing, so fn is not called redundantly
            return map.computeIfAbsent(key, fn);
        } finally {
            sl.unlock(stamp);  // stamp corresponds to either read or write lock; unlock releases correctly in both cases
        }
    }
}
```
| Pattern | Concurrency | Latency | Use cases |
|------|--------|------|------|
| Optimistic read | Unlimited (lock-free) | Very low | Reads > 99%, writes extremely rare |
| Pessimistic read | Multi-read sharing | Low | General read-heavy, write-light |
| Write lock | Exclusive | Medium | Write operations |
- **Note**: StampedLock is **non-reentrant** and does not support Condition; use with caution.

### 3. ConcurrentHashMap (engineering default)
```java
// No need to hand-write an RW lock; CHM is already optimized internally
ConcurrentHashMap<K,V> map = new ConcurrentHashMap<>();
map.get(key);                    // Lock-free read (volatile + immutable Node)
map.put(key, value);             // CAS + synchronized on the first node
map.computeIfAbsent(k, fn);      // Atomic compound operation
map.forEach((k,v) -> ...);       // Weakly consistent traversal
```
- **Lock-free reads**: `get` is only a volatile read, zero contention
- **Fine-grained writes**: Only the first node of the bucket is locked, resizes assist
- **Applies to 99% of scenarios**: Unless cross-key transactions or complex invariants are needed

### 4. RCU / Immutable snapshot (extreme read performance)
```java
// Copy-on-write + atomic reference publish
class ImmutableCache<K,V> {
    final AtomicReference<Map<K,V>> ref = new AtomicReference<>(Map.of());

    V get(K key) { return ref.get().get(key); }  // Pure read, zero synchronization

    void put(K key, V value) {
        while (true) {
            Map<K,V> old = ref.get();
            Map<K,V> neu = new HashMap<>(old);
            neu.put(key, value);
            if (ref.compareAndSet(old, neu)) return;  // Publish the new version
        }
    }
}
```
- **Zero read overhead**: No volatile, no CAS, no cache-line contention
- **Write amplification**: Full copy, GC pressure, suitable for small Maps / low write frequency
- **Extensions**: Persistent data structures (Paguro, Clojure), CopyOnWriteArrayList

## Go / Rust implementations

### Go: sync.RWMutex
```go
var mu sync.RWMutex
var data map[string]string

func Read(key string) string {
    mu.RLock()
    defer mu.RUnlock()
    return data[key]
}

func Write(key, val string) {
    mu.Lock()
    defer mu.Unlock()
    data[key] = val
}
```
- **Writer-preferred**: New readers wait for the write lock to be released, preventing writer starvation

### Rust: RwLock / parking_lot / dashmap
```rust
use parking_lot::RwLock;  // Faster, no poisoning, supports try_lock
use std::collections::HashMap;

let cache: RwLock<HashMap<K, V>> = RwLock::new(HashMap::new());

fn get(key: &K) -> Option<V> {
    cache.read().get(key).cloned()  // Read lock released automatically
}

fn put(key: K, val: V) {
    cache.write().insert(key, val);
}
```
- **Rust type system**: Prevents mutation while a read lock is held and prevents deadlock at compile time

## Performance comparison (read-heavy, write-light scenarios)

The **order-of-magnitude relationship** among implementations is stable, but absolute numbers fluctuate widely with hardware, JDK/compiler version, key distribution, and contention level. Copying any specific number will mislead selection -- use JMH (Java) or criterion (Rust) to measure on your own workload when exact figures are needed. The table below gives only qualitative judgments:

| Implementation | Read path | Write path | Scalability | Complexity |
|------|--------|--------|--------|--------|
| `synchronized` / `Mutex` | Exclusive | Exclusive | Poor (single-point serialization) | Low |
| `ReentrantReadWriteLock` (unfair) | Read shared | Exclusive | Medium | Low |
| `ReentrantReadWriteLock` (fair) | Read shared | Exclusive | Medium (throughput slightly lower than unfair) | Low |
| `StampedLock` optimistic read | Lock-free validation | Exclusive | Excellent (reads nearly linear) | Medium |
| `ConcurrentHashMap` | Lock-free volatile read | Bucket-level fine-grained | Excellent | Low (library) |
| `RwLock` + `HashMap` (Rust) | Read shared | Exclusive | Good | Low |
| `dashmap` (sharded RwLock) | Sharded read shared | Sharded exclusive | Excellent | Low (library) |
| RCU / Immutable snapshot | Pure pointer read, zero synchronization | Full copy + CAS publish | Excellent (reads) | Medium (write amplification) |

Pattern: mutexes are about an order of magnitude slower; read-write locks are clearly better than mutexes when reads dominate; optimistic reads and sharded/immutable approaches can make reads nearly lock-free; the write path cost is the opposite (RCU writes are the most expensive).

## Selection decision tree

```
Read/write ratio?
├─ Reads > 99%, writes extremely rare, small data → RCU / Immutable snapshot / StampedLock optimistic read
├─ Read-heavy, write-light, general Map → ConcurrentHashMap / dashmap / CHM
├─ Cross-key transactions / complex invariants needed → ReentrantReadWriteLock / StampedLock pessimistic
├─ Write timeliness critical, config hot-reload → writer-preferred / fair RWLock
└─ Simple counters/flags → Atomic / StampedLock / lock-free
```

## Common pitfalls

| Pitfall | Symptoms | Fix |
|------|------|------|
| **Calling a write operation inside a read lock** | Deadlock (upgrade not supported) | Release the read lock then acquire the write lock / StampedLock upgrade |
| **Holding a read lock too long** | Writer starvation, resize blocking | Shrink the critical section, use CHM/optimistic read |
| **Ignoring lock downgrade semantics** | Data inconsistency | Write lock -> read lock -> release write lock, maintain HB |
| **Using StampedLock as a reentrant lock** | Deadlock on second acquisition by the same thread | Acknowledge non-reentrancy, use ReentrantReadWriteLock |
| **Using a mutex for read-heavy, write-light** | Throughput wasted 10-100x | Switch to RWLock / CHM / optimistic read |
| **Write amplification not evaluated** | RCU large Map OOM/GC storm | Evaluate write frequency x Map size, shard |

## Monitoring metrics

| Metric | Meaning | Alert |
|------|------|------|
| `rwlock.read.wait.time` | Read lock wait time | > 10ms |
| `rwlock.write.wait.time` | Write lock wait time | > 50ms |
| `rwlock.read.hold.time` | Read lock hold time | > 1ms (long critical section) |
| `rwlock.write.hold.time` | Write lock hold time | > 5ms |
| `stamped.optimistic.fail.rate` | Optimistic read failure rate | > 5% (degrades to pessimistic) |

## Chapter summary

The core of reader-writer optimization: **read sharing, write exclusivity, optimistic first, libraries over homegrown**.
- **First choice `ConcurrentHashMap` / `dashmap`**: mature engineering, lock-free reads, fine-grained writes
- **Extreme read performance**: `StampedLock` optimistic read / RCU / Immutable snapshot
- **Complex invariants / cross-key transactions**: `ReentrantReadWriteLock` / `StampedLock` pessimistic
- **Avoid hand-writing RWLocks**: easily leads to deadlock, starvation, upgrade/downgrade errors

See also the related page **thread pool design** -- the resource management hub for concurrent execution.

## Sources

- ReentrantReadWriteLock and StampedLock behavior per [JDK documentation](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/StampedLock.html)
- POSIX read-write locks per [pthread_rwlock_rdlock(3p)](https://man7.org/linux/man-pages/man3/pthread_rwlock_rdlock.3p.html) family
- Reader-preferred / writer-preferred / fair round-robin, the three variants, are standard content in operating systems textbooks

## References

- [Wikipedia: Read/write lock](https://en.wikipedia.org/wiki/Readers%E2%80%93writer_lock)
- [Java concurrent locks package](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/package-summary.html)

<!-- BACKLINKS-AUTO -->
## Related pages

- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [applications](/research/applications.md)
