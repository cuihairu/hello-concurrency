# Producer-Consumer

The producer-consumer pattern is the **most classic and most frequently used** cooperation model in concurrent programming: producers generate data and place it into a buffer, and consumers take it from the buffer for processing. The core tension: **production rate != consumption rate**, which requires buffer decoupling plus backpressure control.

## Core model

```
Producer -> [Bounded buffer] -> Consumer
              ^
         Backpressure signal (block/drop/degrade)
```

### Key elements
| Element | Choice | Impact |
|------|------|------|
| **Buffer type** | Array/list/ring/lock-free | Memory, throughput, latency, boundedness |
| **Synchronization mechanism** | Lock + condition variable / semaphore / lock-free / Channel | Complexity, performance, fairness |
| **Backpressure strategy** | Block / drop new / drop old / degrade / expand | Throughput vs latency vs loss rate |
| **Consumption pattern** | Single consumer / multi-consumer / broadcast / partitioned | Ordering, parallelism, consistency |

## Classic implementation comparison

### 1. Lock + condition variable (textbook)
```java
class BoundedBuffer<T> {
    final Lock lock = new ReentrantLock();
    final Condition notFull = lock.newCondition();
    final Condition notEmpty = lock.newCondition();
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
- **Pros**: Clear correctness, supports fairness, interruptible, timeout
- **Cons**: Lock contention, context switches, single-lock serialization

### 2. Semaphore (minimal)
```java
class SemaphoreBuffer<T> {
    final Semaphore slots, items;
    final T[] buf;
    final int cap;          // Constructor parameter promoted to a field so put/take can use it for modulo
    int head, tail;

    SemaphoreBuffer(int cap) {
        this.cap = cap;
        slots = new Semaphore(cap);
        items = new Semaphore(0);
        buf = (T[]) new Object[cap];
    }

    void put(T x) throws InterruptedException {
        slots.acquire();
        synchronized(this) { buf[tail] = x; tail = (tail+1)%cap; }
        items.release();
    }

    T take() throws InterruptedException {
        items.acquire();
        T x; synchronized(this) { x = buf[head]; head = (head+1)%cap; }
        slots.release();
        return x;
    }
}
```
- **Pros**: Minimal code, clear semantics
- **Cons**: Double synchronization (semaphore + mutex), no fairness guarantee

### 3. Blocking queue library (engineering default)
```java
// Java
BlockingQueue<Task> q = new ArrayBlockingQueue<>(1024);
q.put(task);           // Blocks
q.offer(task, 1, s);  // Timeout
q.offer(task);        // Non-blocking, returns boolean

// Go
ch := make(chan Task, 1024)
ch <- task             // Blocks
select { case ch <- task: default: }  // Non-blocking

// Rust (crossbeam, synchronous API)
let (s, r) = crossbeam_channel::bounded(1024);
s.send(task).unwrap(); // Blocks the current thread when full
s.try_send(task);      // Non-blocking, returns Err when full

// Rust (async, using tokio)
let (tx, mut rx) = tokio::sync::mpsc::channel(1024);
tx.send(task).await;   // Yields execution when full (async wait)
tx.try_send(task);     // Non-blocking
```

### 4. Lock-free queue (maximum throughput)
```java
// JCTools MpmcArrayQueue
MpmcArrayQueue<Task> q = new MpmcArrayQueue<>(1024);
q.offer(task);      // Lock-free, non-blocking, returns boolean
Task t = q.poll();  // Lock-free, non-blocking, returns null/element
```
- **Use cases**: Single-node extreme throughput, no blocking wait needed, backpressure can be implemented in-house

### 5. Disruptor (ring + sequence + wait strategy)
```java
RingBuffer<Event> ring = RingBuffer.createSingleProducer(factory, 1024);
// Publish
long seq = ring.next();
try { ring.get(seq).setValue(data); } finally { ring.publish(seq); }

// Consumer group (worker pool)
WorkerPool<Event> pool = new WorkerPool<>(ring, barrier, handler, workers);
```
- **Advantages**: Batch publish, no false sharing, configurable wait strategies (busy-spin/block/mixed), sequence numbers naturally deduplicate/replay

## Backpressure strategies in detail

| Strategy | Implementation | Pros | Cons | Use cases |
|------|------|------|------|----------|
| **Blocking wait** | `put` / `offer(timeout)` / `channel` | No data loss, natural rate limiting | Producer threads block, possible deadlock | Core business, strong consistency |
| **Drop new tasks** | `offer` returns false / `try_send` fails | Producer does not block, protects downstream | New data lost | Monitoring, logging, non-critical |
| **Drop old tasks** | `poll` then `offer` when full / `RingBuffer` overwrite | Retains the latest data | Old data lost | Real-time quotes, latest state |
| **Degraded handling** | Fall through to degraded logic when full (local cache / degraded service) | Business availability | Complex logic | Circuit breaking, fallback after rate limiting |
| **Dynamic expansion** | Unbounded queue / expanding blocking queue | Absorbs bursts | OOM risk, uncontrolled latency | Batch processing, non-real-time |
| **Reactive Streams** | `request(n)` explicit pull | End-to-end backpressure, standardized | Complex API | Microservice streaming, reactive architecture |

This page documents backpressure strategies at the buffer coordination level; how a thread pool turns them into queue capacity and rejection policy is covered on the [thread pool design](./thread-pool.md) page. Backpressure in event-driven structures relies on write buffer watermarks (high watermark stops writing, low watermark resumes), which is the concrete form of this table in the Reactor scenario, see [Reactor and event-driven](./reactor.md); the streaming programming model (request(n) pull, reactive stream API) is covered on the [async programming and Future](./async.md) page.

## Multi-consumer patterns

### 1. Competitive consumption (Work Queue)
```
Producer -> [Queue] -> Consumer 1
                   -> Consumer 2
                   -> Consumer 3
```
- Each message is handled by **one** consumer only
- Linear throughput scaling, ordering not guaranteed
- Implementation: `BlockingQueue`, Channel, Kafka partition consumption

### 2. Broadcast / publish-subscribe
```
Producer -> [Topic] -> Consumer group A (receives every message)
                -> Consumer group B
```
- Every message is handled by **all** subscribers
- Implementation: Redis Pub/Sub, independent Kafka consumer groups, in-process listener list + `CopyOnWriteArrayList`
- Note: `SynchronousQueue` is not broadcast -- it is a zero-capacity queue where each element is handed directly to one waiter, one-to-one pairing

### 3. Sharding / ordered partitions
```
Producer -> keyHash -> Partition 0 -> Consumer 0 (ordered)
                    Partition 1 -> Consumer 1
                    Partition 2 -> Consumer 2
```
- Same-key ordering, cross-key parallelism
- Implementation: Kafka/RocketMQ partitions, consistent hashing, ShardingSphere

## Advanced patterns

### 1. Batch production/consumption
```java
// Batch submit to reduce CAS/lock overhead
List<Task> batch = new ArrayList<>(32);
while (batch.size() < 32 && (task = source.poll()) != null) batch.add(task);
queue.addAll(batch);  // Single CAS/lock

// Consumer-side batch processing
List<Task> batch = new ArrayList<>();
queue.drainTo(batch, 32);
processBatch(batch);
```

### 2. Priority queue
```java
// Delay queue / priority queue
PriorityBlockingQueue<Task> pq = new PriorityBlockingQueue<>(1024, 
    Comparator.comparingLong(Task::getPriority));
```
- Use cases: scheduled tasks, priority jobs, weighted fair scheduling

### 3. Delayed / timed consumption
```java
// DelayQueue (JDK) / time wheel / Quartz
DelayQueue<DelayedTask> dq = new DelayQueue<>();
dq.put(new DelayedTask(task, 5, SECONDS));
// Consumer take() automatically blocks until due
```

### 4. Idempotent consumption (message deduplication)
```java
// Business-layer idempotent key
String idempotentKey = msg.getBizId() + ":" + msg.getSeq();
if (redis.setnx(idempotentKey, "1", 24, HOURS)) {
    process(msg);
} else {
    log.warn("Duplicate msg ignored: {}", idempotentKey);
}
```
- **Must be paired with** at-least-once delivery semantics

## Monitoring metrics

| Metric | Meaning | Alert threshold |
|------|------|----------|
| `queue.size` | Current backlog | > 80% of capacity |
| `queue.offer.fail` | Enqueue failure rate (non-blocking) | > 1% |
| `queue.take.latency` | Take wait time | > 100ms |
| `producer.rate` | Production rate | Sudden change of +/-50% |
| `consumer.rate` | Consumption rate | < production rate for 5 min |
| `consumer.lag` | Backlog count (Kafka) | > 100k |
| `end2end.latency` | From enqueue to processing complete | > SLA |

## Selection decision table

| Scenario | Recommended | Alternative |
|------|------|------|
| Single-node, strong consistency, moderate throughput | `ArrayBlockingQueue` | `LinkedBlockingQueue` |
| Single-node, extreme throughput, can self-manage backpressure | `JCTools MpmcArrayQueue` | Disruptor |
| Single-node, needs priority/delay | `PriorityBlockingQueue` / `DelayQueue` | Time wheel |
| Distributed, persistent, replay | Kafka / RocketMQ | Pulsar / RabbitMQ |
| Distributed, low latency, streaming | gRPC Streaming / NATS JetStream | Redis Streams |
| Reactive / backpressure standard | Reactor / RxJava / Flow API | Kotlin Flow |

## Anti-patterns and pitfalls

| Anti-pattern | Consequence | Fix |
|--------|------|------|
| **Unbounded queue** | OOM, uncontrolled latency, backpressure failure | Must be bounded, explicit rejection policy |
| **Producer blocked in a business lock** | Deadlock, cascading timeouts | Isolate queue operations from business locks |
| **Consumer does slow work inside the lock** | Throughput collapse | Take the item, release the lock, then process |
| **Ignoring interrupts/timeouts** | Thread leaks, graceful shutdown failure | Unified `InterruptedException` handling |
| **Consumer swallows exceptions without retry** | Silent data loss | Retry policy + dead-letter queue + alerts |
| **Single-consumer ordering dependency** | Zero scalability | Partition/shard design |

## Chapter summary

The producer-consumer pattern is an engineering triangle of **buffer + synchronization + backpressure**. Selection principles:
- **Default to mature libraries**: `ArrayBlockingQueue` / Channel / Kafka
- **Bounded is the iron rule**: unbounded = time bomb
- **Make backpressure explicit**: block/drop/degrade, keep the business layer informed
- **Monitor the whole chain**: the four-piece set of backlog, rate, latency, and failure rate

See also the related page **reader-writer** -- the classic concurrency optimization for read-heavy, write-light scenarios.

## Sources

- Same source as the blocking queue section of *Java Concurrency in Practice*; see the correspondence on the [authoritative book survey](../research/books.md) page
- BlockingQueue behavior per [JDK documentation](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/BlockingQueue.html)

## References

- [Wikipedia: Producer-consumer problem](https://en.wikipedia.org/wiki/Producer%E2%80%93consumer_problem)
- [Wikipedia: Queue](https://en.wikipedia.org/wiki/Queue_(abstract_data_type))

<!-- BACKLINKS-AUTO -->
## Related pages

- [security](/advanced/security.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [async](async.md)
- [frameworks](frameworks.md)
- [reactor](reactor.md)
- [seven-weeks](seven-weeks.md)
- [applications](/research/applications.md)
