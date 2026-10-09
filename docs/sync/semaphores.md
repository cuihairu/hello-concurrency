# 信号量

信号量是 Dijkstra 提出的经典同步原语，本质是一个**受保护的整数计数器** + **等待队列**，支持原子的 `P(wait)` 与 `V(signal)` 操作。

## 核心概念

### 定义
```c
struct Semaphore {
    int value;           // 计数器
    Queue<Thread> waitq; // 等待队列
}
```

### 原语操作
- **P / wait / acquire / down**：
  ```c
  void P() {
      atomic {
          value--;
          if (value < 0) block_current_thread();
      }
  }
  ```
- **V / signal / release / up**：
  ```c
  void V() {
      atomic {
          value++;
          if (value <= 0) wake_one_thread();
      }
  }
  ```

### 计数器语义
| value | 含义 |
|-------|------|
| > 0 | 可用资源数 / 允许通过的线程数 |
| = 0 | 无可用资源，后续 P 将阻塞 |
| < 0 | 绝对值 = 阻塞线程数 |

## 信号量 vs 互斥锁

| 维度 | 互斥锁 | 信号量 |
|------|--------|--------|
| 计数器 | 隐式 0/1 | 显式非负整数 |
| 所有权 | 有（仅持有者可释放） | 无（任意线程可 V） |
| 用途 | 互斥 | 互斥 + 同步 + 资源计数 |
| 条件变量 | 需配合 mutex | 自带等待队列 |

**互斥锁 = 二值信号量 + 所有权**。信号量更通用，但易误用。

## 两大经典用法

### 1. 互斥：二值信号量
```c
Semaphore mutex = 1;

P(mutex);
// 临界区
V(mutex);
```
等价于 mutex，但无所有权保护，易误释放。

### 2. 资源计数：计数信号量
```c
Semaphore pool = N;  // N 个资源

// 获取资源
P(pool);
use_resource();
// 归还资源
V(pool);
```
典型场景：连接池、线程池、对象池、限流器。

### 3. 线程同步：信号量作信号
```c
Semaphore ready = 0;  // 初始 0

// 生产者
produce();
V(ready);

// 消费者
P(ready);
consume();
```
替代条件变量，更简洁但功能受限。

## 经典同步问题

### 生产者-消费者（有界缓冲区）
```c
Semaphore empty = N;   // 空槽位
Semaphore full = 0;    // 满槽位
Semaphore mutex = 1;   // 缓冲区互斥

// 生产者
P(empty);
P(mutex);
put(item);
V(mutex);
V(full);

// 消费者
P(full);
P(mutex);
item = get();
V(mutex);
V(empty);
```

### 读者-写者
```c
// 读者优先
Semaphore rmutex = 1;   // 保护 read_count
Semaphore wmutex = 1;   // 写互斥 / 读写互斥
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

### 哲学家进餐
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
**死锁隐患**：全拿左叉 → 全等右叉。解法：编号有序、限制并发数、服务员模式。

## 语言支持对照

| 语言 | API | 备注 |
|------|-----|------|
| POSIX C | `sem_t`, `sem_init/wait/post/destroy` | 命名/未命名信号量 |
| Java | `Semaphore` (java.util.concurrent) | 公平/非公平、可中断 |
| Go | 无原生信号量 | 用 `chan struct{}` 或 `sync.Semaphore` (x/sync) |
| Rust | `std::sync::Semaphore` (nightly) / `tokio::sync::Semaphore` | 异步优先 |
| Python | `threading.Semaphore` / `asyncio.Semaphore` | 同步/异步均有 |
| C++20 | `std::counting_semaphore` / `std::binary_semaphore` | 标准库支持 |

## 信号量常见陷阱

| 陷阱 | 后果 | 规避 |
|------|------|------|
| P/V 不配对 | 计数器漂移、死锁/泄漏 | RAII 封装、代码审查 |
| 信号量作互斥 | 无所有权、误释放 | 优先用互斥锁 |
| 忽略溢出 | V 过多导致计数器异常 | 有界信号量、断言检查 |
| 饥饿 | 非公平唤醒 | 公平信号量、监控等待时长 |
| 优先级反转 | 高优先级被低优先级阻塞 | 优先级继承信号量 |

## 信号量实现原理

### 用户态快速路径
1. 原子 decrement/increment
2. 值未跨零 → 直接返回
3. 跨零 → 系统调用入内核

### 内核态慢速路径
- **P 阻塞**：当前线程入等待队列，调度器切换
- **V 唤醒**：从等待队列取线程，标记就绪，触发调度

### 优化：自旋 + 休眠混合
短临界区先自旋几千次，再入内核，减少上下文切换。

## 现代替代方案

| 场景 | 传统信号量 | 现代替代 |
|------|------------|----------|
| 资源池 | 计数信号量 | `BlockingQueue`、连接池库 |
| 限流 | 信号量 | 令牌桶、漏桶算法库 |
| 生产消费 | 信号量 | `BlockingQueue`、Channel、Disruptor |
| 同步屏障 | 信号量 | `CountDownLatch`、`CyclicBarrier`、`Phaser` |
| 异步等待 | 无 | `CompletableFuture`、Promise/Future、async/await |

## 本章小结

信号量是**计数器 + 等待队列**的优雅抽象，统一了互斥、资源计数、线程同步三大场景。工程实践中，**优先使用更高级的并发工具（队列、Latch、Channel、线程池）**，仅在需要精细计数控制时直接用信号量。下一章讲解条件变量——更灵活的等待/通知机制。

## 本章来源

- POSIX 信号量语义以 [sem_overview(7)](https://man7.org/linux/man-pages/man7/sem_overview.7.html) 为准
- Java Semaphore 的 acquire/release 与许可语义以 [JDK 文档](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/Semaphore.html)为准
- 信号量与互斥锁的所有权辨析是操作系统教科书通用内容
