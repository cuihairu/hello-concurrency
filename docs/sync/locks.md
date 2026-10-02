# 锁

锁是并发编程中最基础、最常用的同步原语。本章系统梳理锁的分类、实现原理、进阶特性与工程选型。

## 锁的核心分类

### 按实现机制分
| 类型 | 原理 | 适用场景 | 典型实现 |
|------|------|----------|----------|
| 自旋锁 | CAS 忙等待 | 临界区极短、无系统调用 | `spinlock_t`, `atomic_flag` |
| 互斥锁 | 内核阻塞/唤醒 | 通用、临界区可能阻塞 | `pthread_mutex`, `std::mutex` |
| 读写锁 | 读共享/写独占 | 读多写少 | `pthread_rwlock`, `ReentrantReadWriteLock` |
| 递归锁 | 计数器+持有者 | 递归调用同临界区 | `PTHREAD_MUTEX_RECURSIVE` |
| 条件变量锁 | 配合条件变量 | 复杂等待/通知协议 | `pthread_cond_t` + mutex |

### 按公平性分
- **公平锁**：FIFO 队列，先来先得，吞吐较低
- **非公平锁**：抢占式，吞吐高，可能饥饿（默认）

### 按可重入性分
- **可重入锁**：同线程可重复获取，计数器+1/-1
- **不可重入锁**：重复获取自死锁，性能略优

## 主流语言锁 API 对照

| 操作 | Java | C++17 | Go | Rust | Python |
|------|------|-------|-----|------|--------|
| 创建 | `new ReentrantLock()` | `std::mutex m` | `sync.Mutex{}` | `Mutex::new()` | `threading.Lock()` |
| 加锁 | `lock.lock()` | `m.lock()` | `m.Lock()` | `m.lock()` | `lock.acquire()` |
| 解锁 | `lock.unlock()` | `m.unlock()` | `m.Unlock()` | `m.unlock()` | `lock.release()` |
| 尝试加锁 | `lock.tryLock()` | `m.try_lock()` | `m.TryLock()` | `m.try_lock()` | `lock.acquire(block=False)` |
| 带超时 | `tryLock(t, unit)` | `try_lock_for/until` | 无原生支持 | 无原生支持 | `acquire(timeout)` |
| 条件变量 | `lock.newCondition()` | `std::condition_variable` | `sync.Cond` | `Condvar` | `threading.Condition` |

## 锁的内存语义

### 获取锁 = Acquire 语义
- 后续读写不能重排到加锁之前
- 保证看到其他线程释放锁前的所有写入

### 释放锁 = Release 语义
- 释放锁前的读写不能重排到释放之后
- 保证释放锁前的写入对后续加锁线程可见

**锁提供完整的 happens-before 保证**：线程 A 释放锁 → 线程 B 获取同一把锁，A 的所有写入对 B 可见。

## Java 锁进阶

### synchronized vs ReentrantLock
| 特性 | synchronized | ReentrantLock |
|------|--------------|---------------|
| 语法 | 隐式（语法糖） | 显式 API |
| 可中断 | 否 | `lockInterruptibly()` |
| 超时 | 否 | `tryLock(timeout)` |
| 公平性 | 非公平 | 可选公平/非公平 |
| 条件变量 | `wait/notify` | `newCondition()` 多条件 |
| 性能 | 旧版本慢，JDK 6+ 优化后相当 | 稳定 |

> 注意：「锁降级（写锁 → 读锁）」是**读写锁**（`ReentrantReadWriteLock` / `StampedLock`）的语义，与上表两把互斥锁无关——互斥锁没有读写之分，也就无所谓升降级。

### 锁优化演进
1. **偏向锁**：无竞争时，CAS 记录线程 ID，后续零开销
2. **轻量级锁**：CAS 竞争，自旋等待，避免内核切换
3. **重量级锁**：竞争激烈，内核阻塞队列
4. **锁消除**：JIT 逃逸分析，无共享则删除锁
5. **锁粗化**：合并相邻同步块，减少加解锁

### StampedLock（JDK 8+）
- 三种模式：写锁、悲观读锁、乐观读锁
- 乐观读无锁，验证版本号，冲突降级悲观读
- **不支持重入**，不支持条件变量
- 适合读多写少、读耗时短的场景

## C++ 锁最佳实践

### RAII 守卫：永远用 `std::lock_guard` / `std::unique_lock`
```cpp
std::mutex m;
void foo() {
    std::lock_guard<std::mutex> g(m);  // 析构自动解锁
    // 临界区
}
```

### 多锁死锁避免：`std::lock` 同时获取
```cpp
std::lock(m1, m2);  // 原子性获取多锁，避免死锁
std::lock_guard<std::mutex> g1(m1, std::adopt_lock);
std::lock_guard<std::mutex> g2(m2, std::adopt_lock);
```

### `std::shared_mutex` 读写锁（C++17）
```cpp
std::shared_mutex rw;
void read() { std::shared_lock g(rw); }
void write() { std::unique_lock g(rw); }
```

## Go 同步原语

### sync.Mutex / sync.RWMutex
- 非重入，重复 Lock 死锁
- RWMutex: `RLock()` 读锁，`Lock()` 写锁
- **写锁优先**：新读锁等待写锁释放，防止写饥饿

### sync.WaitGroup / sync.Once
- `WaitGroup`: 等待协程组完成
- `Once`: 仅执行一次初始化（双重检查 + 原子）

### sync.Map / atomic 包
- `sync.Map`: 读多写少场景优化
- `atomic`: 无锁原子操作，`Load/Store/Add/CAS`

## Rust 所有权与锁

### `Mutex<T>` / `RwLock<T>`
- **锁保护数据所有权**：`lock()` 返回 `MutexGuard<T>`，解锁即 Drop
- **编译期防死锁**：类型系统强制临界区作用域
- **Send + Sync**：自动推导线程安全性

```rust
let m = Mutex::new(0);
*m.lock().unwrap() += 1;  // Guard 离开作用域自动解锁
```

### 无锁编程：Atomic 系列
`AtomicBool`, `AtomicUsize`, `AtomicPtr` 等，配合 `Ordering` 控制内存序。

## 锁性能优化清单

1. **缩小临界区**：仅保护共享数据访问，I/O、计算移出
2. **降低锁粒度**：分段锁、分桶锁、细粒度锁
3. **读写分离**：读多写少用读写锁或无锁结构
4. **避免锁竞争**：ThreadLocal、无锁队列、Actor 模型
5. **批量操作**：合并多次加锁为一次
6. **锁分级**：热锁/冷锁分离，热路径无锁

## 常见锁 Bug 模式

| Bug | 症状 | 修复 |
|-----|------|------|
| 忘记解锁 | 死锁、吞吐骤降 | RAII / try-finally / defer |
| 锁对象变化 | 互斥失效 | final/不可变锁对象 |
| 双重检查失效 | 对象未初始化可见 | volatile / AtomicReference |
| 锁过粗 | 并发度低 | 细粒度锁、分段锁 |
| 死锁 | 系统挂起 | 固定锁序、tryLock 超时 |
| 优先级反转 | 高优先级任务延迟 | 优先级继承协议 |

## 本章小结

锁是并发控制的基石。掌握**锁分类、内存语义、语言特有 API、性能优化与反模式**，是写出正确高效并发代码的必修功。下一章讲解信号量、条件变量等更灵活的同步原语。