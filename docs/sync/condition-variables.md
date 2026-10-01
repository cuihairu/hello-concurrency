# 条件变量

条件变量是**等待/通知**机制的核心原语，允许线程等待某个条件成立，配合互斥锁实现复杂的同步协议。

## 核心概念

### 定义
条件变量不保护数据，**仅协调线程时序**。必须配合互斥锁使用：
- **锁保护共享状态**（谓词）
- **条件变量等待状态变化**

### 三大操作
| 操作 | 语义 |
|------|------|
| `wait(mutex)` | 原子释放锁并阻塞，被唤醒后重新获取锁 |
| `signal()` / `notify_one()` | 唤醒至少一个等待线程 |
| `broadcast()` / `notify_all()` | 唤醒所有等待线程 |

### 标准等待模式
```c
pthread_mutex_lock(&mutex);
while (!condition) {          // 必须用 while，防虚假唤醒
    pthread_cond_wait(&cond, &mutex);
}
// condition 成立，持有锁，执行临界区
pthread_mutex_unlock(&mutex);
```

### 通知模式
```c
pthread_mutex_lock(&mutex);
condition = true;
pthread_cond_signal(&cond);  // 或 broadcast
pthread_mutex_unlock(&mutex);
```

## 为什么要 while 循环？

### 虚假唤醒
线程可能在无 `signal` 的情况下被唤醒（POSIX 允许、Linux futex 实现细节）。

### 信号丢失
`signal` 到 `wait` 重新获锁之间，其他线程可能抢先改变条件。

### 多条件共享同一 CV
不同条件共用一个 `cond`，被唤醒需重新检查。

**结论：`wait` 必须在 `while (!predicate)` 循环中。**

## 经典同步模式

### 生产者-消费者（有界队列）
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

### 读者-写者（写者优先）
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

### 线程池任务队列
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

## signal vs broadcast 选型

| 场景 | 选择 | 理由 |
|------|------|------|
| 单生产单消费 | `signal` | 仅需唤醒一个 |
| 多生产多消费 | `signal` | 避免惊群，吞吐更高 |
| 状态广播（如关闭） | `broadcast` | 所有等待者需知晓 |
| 条件可能被多线程满足 | `broadcast` | 防止信号丢失 |

**经验法则**：默认用 `signal`，仅在「状态全局变化、所有等待者均需重新评估」时用 `broadcast`。

## 语言支持对照

| 语言 | 类型 | 关键 API |
|------|------|----------|
| POSIX C | `pthread_cond_t` | `wait`, `signal`, `broadcast`, `timedwait` |
| Java | `Condition` (Lock.newCondition) | `await`, `signal`, `signalAll`, `awaitNanos` |
| C++11 | `std::condition_variable` | `wait`, `notify_one`, `notify_all`, `wait_for` |
| Go | `sync.Cond` | `Wait`, `Signal`, `Broadcast` (需手工配 mutex) |
| Rust | `std::sync::Condvar` | `wait`, `notify_one`, `notify_all` |
| Python | `threading.Condition` | `wait`, `notify`, `notify_all` |

### Go sync.Cond 特殊用法
```go
var mu sync.Mutex
cond := sync.NewCond(&mu)

cond.L.Lock()
for !condition {
    cond.Wait()
}
cond.L.Unlock()
```
**注意**：Go `Cond` 不持有锁，需外部传入 `L *sync.Mutex`。

## 条件变量 vs 信号量

| 维度 | 条件变量 | 信号量 |
|------|----------|--------|
| 等待条件 | 任意布尔谓词 | 计数器 >= 0 |
| 通知精度 | 单个/广播 | 单个（V 操作） |
| 状态检查 | 显式 while 循环 | 隐式在 P 内部 |
| 灵活性 | 高（复杂协议） | 低（计数同步） |
| 易用性 | 易错（需配合锁） | 相对简单 |

## 常见错误与最佳实践

### 错误 1：wait 外未持有锁
```c
// 错误
pthread_cond_wait(&cond, &mutex);  // mutex 未加锁
```

### 错误 2：signal 前未持有锁
```c
// 错误：竞态窗口
condition = true;
pthread_cond_signal(&cond);  // mutex 未加锁
```
**修正**：持有锁修改条件再 signal，保证原子性。

### 错误 3：用 if 替代 while
```c
// 错误
if (!condition) pthread_cond_wait(&cond, &mutex);
```

### 错误 4：notify 后立即释放锁导致竞态
```java
// 可接受但次优
lock.lock();
condition = true;
lock.unlock();  // 释放锁
cond.signal();  // 唤醒线程需竞争锁
```
**优化**：持有锁 signal，减少一次上下文切换。

### 最佳实践清单
1. **永远用 while 循环等待**
2. **修改条件与 signal 在同一临界区**
3. **优先用 signal，仅必要时 broadcast**
4. **封装为高级工具**：BlockingQueue、Latch、Barrier、Channel
5. **超时等待**：`awaitNanos` / `wait_for` 防死锁
6. **避免嵌套 wait**：极难推理，重构为状态机

## 现代替代方案

| 场景 | 传统 CV | 现代替代 |
|------|---------|----------|
| 任务队列 | CV + 队列 | `BlockingQueue`、Channel、Disruptor |
| 单次等待 | CV + bool | `CountDownLatch`、`CompletableFuture` |
| 循环屏障 | CV + 计数器 | `CyclicBarrier`、`Phaser` |
| 生命周期控制 | CV + 状态 | 结构化并发、取消令牌 |
| 异步编排 | CV + 回调 | `async/await`、Reactive Streams |

## 本章小结

条件变量是**任意谓词等待/通知**的基础设施，配合互斥锁可构建任意复杂的同步协议。核心铁律：**while 循环 + 持有锁修改条件 + signal**。工程上优先使用语言库提供的高级并发工具，仅在底层协议实现时直接操作 CV。下一章讲解屏障——多线程协同推进的同步点。