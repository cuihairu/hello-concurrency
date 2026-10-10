# 生产者-消费者

生产者-消费者是并发编程中**最经典、最高频**的协作模式：生产者生成数据放入缓冲区，消费者从缓冲区取出处理。核心张力：**生产速率 ≠ 消费速率**，需缓冲区解耦 + 背压控制。

## 核心模型

```
生产者 → [有界缓冲区] → 消费者
              ↑
         背压信号 (阻塞/丢弃/降级)
```

### 关键要素
| 要素 | 选择 | 影响 |
|------|------|------|
| **缓冲区类型** | 数组/链表/环形/无锁 | 内存、吞吐、延迟、有界性 |
| **同步机制** | 锁+条件变量/信号量/无锁/Channel | 复杂度、性能、公平性 |
| **背压策略** | 阻塞/丢弃新/丢弃旧/降级/扩容 | 吞吐 vs 延迟 vs 丢失率 |
| **消费模式** | 单消费/多消费/广播/分组 | 顺序性、并行度、一致性 |

## 经典实现对比

### 1. 锁 + 条件变量 (教科书级)
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
- **优点**：正确性清晰、支持公平、可中断、超时
- **缺点**：锁竞争、上下文切换、单锁串行

### 2. 信号量 (极简)
```java
class SemaphoreBuffer<T> {
    final Semaphore slots, items;
    final T[] buf;
    final int cap;          // 构造参数需提为字段，供 put/take 取模使用
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
- **优点**：代码极少、语义清晰
- **缺点**：双同步 (信号量+互斥)、无公平保证

### 3. 阻塞队列库 (工程首选)
```java
// Java
BlockingQueue<Task> q = new ArrayBlockingQueue<>(1024);
q.put(task);           // 阻塞
q.offer(task, 1, s);  // 超时
q.offer(task);        // 非阻塞，返回 boolean

// Go
ch := make(chan Task, 1024)
ch <- task             // 阻塞
select { case ch <- task: default: }  // 非阻塞

// Rust (crossbeam，同步 API)
let (s, r) = crossbeam_channel::bounded(1024);
s.send(task).unwrap(); // 满时阻塞当前线程
s.try_send(task);      // 非阻塞，满时返回 Err

// Rust (异步用 tokio)
let (tx, mut rx) = tokio::sync::mpsc::channel(1024);
tx.send(task).await;   // 满时让出执行权（异步等待）
tx.try_send(task);     // 非阻塞
```

### 4. 无锁队列 (极致吞吐)
```java
// JCTools MpmcArrayQueue
MpmcArrayQueue<Task> q = new MpmcArrayQueue<>(1024);
q.offer(task);      // 无锁、非阻塞、返回 boolean
Task t = q.poll();  // 无锁、非阻塞、返回 null/元素
```
- **适用**：单机极高吞吐、无需阻塞等待、可自行实现背压

### 5. Disruptor (环形 + 序号 + 等待策略)
```java
RingBuffer<Event> ring = RingBuffer.createSingleProducer(factory, 1024);
// 发布
long seq = ring.next();
try { ring.get(seq).setValue(data); } finally { ring.publish(seq); }

// 消费者组 (工作池)
WorkerPool<Event> pool = new WorkerPool<>(ring, barrier, handler, workers);
```
- **优势**：批量发布、无伪共享、等待策略可配 (忙等/阻塞/混合)、序号天然去重/重放

## 背压策略详解

| 策略 | 实现 | 优点 | 缺点 | 适用场景 |
|------|------|------|------|----------|
| **阻塞等待** | `put` / `offer(timeout)` / `channel` | 无数据丢失、自然限流 | 生产者线程阻塞、可能死锁 | 核心业务、强一致性 |
| **丢弃新任务** | `offer` 返回 false / `try_send` 失败 | 生产者不阻塞、保护下游 | 新数据丢失 | 监控、日志、非关键 |
| **丢弃旧任务** | 满时 `poll` 再 `offer` / `RingBuffer` 覆盖 | 保留最新数据 | 旧数据丢失 | 实时行情、最新状态 |
| **降级处理** | 满时走降级逻辑 (本地缓存/降级服务) | 业务可用性 | 逻辑复杂 | 熔断、限流后备 |
| **动态扩容** | 无界队列 / 扩容阻塞队列 | 吸收突发 | OOM 风险、延迟失控 | 批处理、非实时 |
| **Reactive Streams** | `request(n)` 显式拉取 | 端到端背压、标准化 | API 复杂 | 微服务流式、响应式架构 |

事件驱动结构里的背压靠写缓冲水位线实现（高水位停写、低水位恢复），是这张表在 Reactor 场景的具体化，见 [Reactor 与事件驱动](./reactor.md)；流式编程模型（request(n) 拉取、响应式流 API）见 [异步编程与 Future](./async.md)。

## 多消费者模式

### 1. 竞争消费 (Work Queue)
```
生产者 → [Queue] → 消费者1
                   → 消费者2
                   → 消费者3
```
- 每条消息仅被**一个**消费者处理
- 吞吐线性扩展、顺序性不保证
- 实现：`BlockingQueue`、Channel、Kafka 分区消费

### 2. 广播/发布订阅
```
生产者 → [Topic] → 消费者组A (每条消息全收)
                → 消费者组B
```
- 每条消息被**所有**订阅者处理
- 实现：Redis Pub/Sub、Kafka 各消费组独立订阅、进程内监听器列表 + `CopyOnWriteArrayList`
- 注意：`SynchronousQueue` 不是广播——它是 0 容量队列，每元素直接移交给一个等待者，一对一配对

### 3. 分片/有序分区
```
生产者 → keyHash → 分区0 → 消费者0 (有序)
                    分区1 → 消费者1
                    分区2 → 消费者2
```
- 同 Key 顺序、跨 Key 并行
- 实现：Kafka/RocketMQ 分区、一致性哈希、ShardingSphere

## 进阶模式

### 1. 批量生产/消费
```java
// 批量提交减少 CAS/锁开销
List<Task> batch = new ArrayList<>(32);
while (batch.size() < 32 && (task = source.poll()) != null) batch.add(task);
queue.addAll(batch);  // 单次 CAS/锁

// 消费端批量处理
List<Task> batch = new ArrayList<>();
queue.drainTo(batch, 32);
processBatch(batch);
```

### 2. 优先级队列
```java
// 延迟队列 / 优先级队列
PriorityBlockingQueue<Task> pq = new PriorityBlockingQueue<>(1024, 
    Comparator.comparingLong(Task::getPriority));
```
- 适用：定时任务、优先级作业、加权公平调度

### 3. 延迟/定时消费
```java
// DelayQueue (JDK) / 时间轮 / Quartz
DelayQueue<DelayedTask> dq = new DelayQueue<>();
dq.put(new DelayedTask(task, 5, SECONDS));
// 消费者 take() 自动阻塞至到期
```

### 4. 幂等消费 (消息去重)
```java
// 业务层幂等键
String idempotentKey = msg.getBizId() + ":" + msg.getSeq();
if (redis.setnx(idempotentKey, "1", 24, HOURS)) {
    process(msg);
} else {
    log.warn("Duplicate msg ignored: {}", idempotentKey);
}
```
- **必须配合**至少一次投递语义

## 监控指标体系

| 指标 | 含义 | 告警阈值 |
|------|------|----------|
| `queue.size` | 当前积压 | > 80% 容量 |
| `queue.offer.fail` | 入队失败率 (非阻塞) | > 1% |
| `queue.take.latency` | 取出等待时间 | > 100ms |
| `producer.rate` | 生产速率 | 突变 ±50% |
| `consumer.rate` | 消费速率 | < 生产速率持续 5min |
| `consumer.lag` | 积压条数 (Kafka) | > 100k |
| `end2end.latency` | 入队到处理完成 | > SLA |

## 选型决策表

| 场景 | 推荐 | 备选 |
|------|------|------|
| 单机、强一致、中等吞吐 | `ArrayBlockingQueue` | `LinkedBlockingQueue` |
| 单机、极高吞吐、可自管背压 | `JCTools MpmcArrayQueue` | Disruptor |
| 单机、需优先级/延迟 | `PriorityBlockingQueue` / `DelayQueue` | 时间轮 |
| 分布式、持久化、重放 | Kafka / RocketMQ | Pulsar / RabbitMQ |
| 分布式、低延迟、流式 | gRPC Streaming / NATS JetStream | Redis Streams |
| 响应式/背压标准 | Reactor / RxJava / Flow API | Kotlin Flow |

## 反模式与陷阱

| 反模式 | 后果 | 修正 |
|--------|------|------|
| **无界队列** | OOM、延迟失控、背压失效 | 必须有界、显式拒绝策略 |
| **生产者阻塞在业务锁中** | 死锁、级联超时 | 隔离队列操作与业务锁 |
| **消费者处理耗时在锁内** | 吞吐崩塌 | 取出后释放锁再处理 |
| **忽略中断/超时** | 线程泄漏、优雅停机失败 | 统一 `InterruptedException` 处理 |
| **消费异常吞掉不重试** | 数据静默丢失 | 重试策略 + 死信队列 + 告警 |
| **单消费者顺序依赖** | 扩展性为 0 | 分区/分片设计 |

## 本章小结

生产者-消费者是**缓冲 + 同步 + 背压**的工程三角。选型心法：
- **默认用成熟库**：`ArrayBlockingQueue` / Channel / Kafka
- **有界是铁律**：无界 = 定时炸弹
- **背压显式化**：阻塞/丢弃/降级，业务层知情
- **监控全链路**：积压、速率、延迟、失败率四件套

下一章讲解**读者-写者**——读多写少场景的并发优化经典。

## 本章来源

- 《Java Concurrency in Practice》阻塞队列一节同源，对应关系见[权威书籍调研](../research/books.md)
- BlockingQueue 行为以 [JDK 文档](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/BlockingQueue.html)为准
