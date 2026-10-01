# 读者-写者

读者-写者问题是**读多写少**场景的并发优化经典：允许多读者并发读，写者独占写，在保证数据一致性前提下最大化读并发度。

## 问题定义

| 角色 | 行为 | 约束 |
|------|------|------|
| **读者** | 仅读取共享数据 | 多读者可并发、不修改数据 |
| **写者** | 修改共享数据 | 独占访问、阻塞所有读者/写者 |

### 正确性要求
1. **写独占**：写者与任何读者/写者互斥
2. **读共享**：无写者时，任意数量读者可并发
3. **无饿死**：合理调度防止读者/写者饥饿

## 三大经典变体

| 变体 | 优先级 | 适用场景 | 缺点 |
|------|--------|----------|------|
| **读者优先** | 读者 | 读极多、写极少、写延迟容忍 | 写者可能饿死 |
| **写者优先** | 写者 | 写及时性关键、配置热更 | 读者可能饿死、读并发度受损 |
| **公平/轮转** | 先来先服务 | 延迟可预测、无饿死 | 实现复杂、读并发度折中 |

## Java 实现对比

### 1. ReentrantReadWriteLock (JDK 标准)
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

    // 降级：写锁 → 读锁 (支持)
    V putIfAbsent(K key, V value) {
        w.lock();
        try {
            V v = map.get(key);
            if (v != null) return v;
            map.put(key, value);
            // 降级：持有写锁获取读锁，释放写锁
            r.lock();
            return value;
        } finally { 
            w.unlock();  // 写锁释放后，读锁仍持有
        }
    }
}
```
- **默认非公平**：新读者可插队写者前
- **公平模式**：`new ReentrantReadWriteLock(true)`，FIFO 队列
- **锁降级支持**：写锁 → 读锁 (释放写锁前获取读锁)
- **不支持锁升级**：读锁 → 写锁会死锁

### 2. StampedLock (JDK 8+ 乐观读)
```java
class StampedCache<K,V> {
    final StampedLock sl = new StampedLock();
    final Map<K,V> map = new HashMap<>();

    V get(K key) {
        // 1. 乐观读：无锁、极快、可能失败
        long stamp = sl.tryOptimisticRead();
        V v = map.get(key);
        if (sl.validate(stamp)) return v;  // 期间无写入，验证通过

        // 2. 悲观读：共享锁、阻塞写者
        stamp = sl.readLock();
        try { return map.get(key); }
        finally { sl.unlockRead(stamp); }
    }

    V put(K key, V value) {
        long stamp = sl.writeLock();
        try { return map.put(key, value); }
        finally { sl.unlockWrite(stamp); }
    }

    // 升级：悲观读 → 写锁
    V computeIfAbsent(K key, Function<K,V> fn) {
        long stamp = sl.readLock();
        try {
            V v = map.get(key);
            if (v != null) return v;
            // 尝试升级
            long ws = sl.tryConvertToWriteLock(stamp);
            if (ws != 0) {  // 升级成功
                stamp = ws;
                v = map.computeIfAbsent(key, fn);
                return v;
            }
            // 升级失败：释放读锁，重新获取写锁
            sl.unlockRead(stamp);
            stamp = sl.writeLock();
            try { return map.computeIfAbsent(key, fn); }
            finally { sl.unlockWrite(stamp); }
        }
    }
}
```
| 模式 | 并发度 | 延迟 | 适用 |
|------|--------|------|------|
| 乐观读 | 无限 (无锁) | 极低 | 读占比 > 99%、写极罕见 |
| 悲观读 | 多读共享 | 低 | 一般读多写少 |
| 写锁 | 独占 | 中 | 写操作 |
- **注意**：StampedLock **不可重入**，不支持 Condition，慎用。

### 3. ConcurrentHashMap (工程首选)
```java
// 无需手写 RW 锁，CHM 内部已优化
ConcurrentHashMap<K,V> map = new ConcurrentHashMap<>();
map.get(key);                    // 无锁读 (volatile + 不变 Node)
map.put(key, value);             // CAS + synchronized 首节点
map.computeIfAbsent(k, fn);      // 原子复合
map.forEach((k,v) -> ...);       // 弱一致遍历
```
- **读无锁**：`get` 仅 volatile 读，零竞争
- **写细粒度**：仅锁桶首节点，扩容协助
- **适用 99% 场景**：除非需跨 Key 事务或复杂不变量

### 4. RCU / Immutable Snapshot (极致读性能)
```java
// 写时复制 + 原子引用发布
class ImmutableCache<K,V> {
    final AtomicReference<Map<K,V>> ref = new AtomicReference<>(Map.of());

    V get(K key) { return ref.get().get(key); }  // 纯读、零同步

    void put(K key, V value) {
        while (true) {
            Map<K,V> old = ref.get();
            Map<K,V> neu = new HashMap<>(old);
            neu.put(key, value);
            if (ref.compareAndSet(old, neu)) return;  // 发布新版本
        }
    }
}
```
- **读零开销**：无 volatile、无 CAS、无缓存行争用
- **写放大**：全量复制、GC 压力、适合小 Map/低写频
- **扩展**：持久化数据结构 (Paguro、Clojure)、CopyOnWriteArrayList

## Go / Rust 实现

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
- **写优先**：新读者等待写锁释放，防止写饥饿

### Rust: RwLock / parking_lot / dashmap
```rust
use parking_lot::RwLock;  // 更快、无中毒、支持 try_lock
use std::collections::HashMap;

let cache: RwLock<HashMap<K, V>> = RwLock::new(HashMap::new());

fn get(key: &K) -> Option<V> {
    cache.read().get(key).cloned()  // 读锁自动释放
}

fn put(key: K, val: V) {
    cache.write().insert(key, val);
}
```
- **Rust 类型系统**：编译期防止读锁持有期间修改、防止死锁

## 性能对比 (典型 16 核、读 95% / 写 5%)

| 实现 | 吞吐 (ops/s) | p99 延迟 | 扩展性 | 复杂度 |
|------|--------------|----------|--------|--------|
| `synchronized` / `Mutex` | 1.2M | 500μs | 差 | 低 |
| `ReentrantReadWriteLock` (非公平) | 8M | 80μs | 中 | 低 |
| `ReentrantReadWriteLock` (公平) | 5M | 120μs | 中 | 低 |
| `StampedLock` 乐观读 | 45M | 5μs | 极好 | 中 |
| `ConcurrentHashMap` | 40M | 8μs | 极好 | 低 (库) |
| `RwLock` + `HashMap` (Rust) | 30M | 10μs | 好 | 低 |
| `dashmap` (分片 RWLock) | 50M | 5μs | 极好 | 低 (库) |
| RCU / Immutable Snapshot | 100M+ | <1μs | 极好 | 中 (写放大) |

## 选型决策树

```
读写比例？
├─ 读 > 99%、写极罕见、数据小 → RCU / Immutable Snapshot / StampedLock 乐观读
├─ 读多写少、通用 Map → ConcurrentHashMap / dashmap / CHM
├─ 需跨 Key 事务 / 复杂不变量 → ReentrantReadWriteLock / StampedLock 悲观
├─ 写及时性关键、配置热更 → 写者优先 / 公平 RWLock
└─ 简单计数器/标志位 → Atomic / StampedLock / 无锁
```

## 常见陷阱

| 陷阱 | 症状 | 修正 |
|------|------|------|
| **读锁中调用写操作** | 死锁 (升级不支持) | 释放读锁再获取写锁 / StampedLock 升级 |
| **长持有读锁** | 写者饥饿、扩容阻塞 | 缩小临界区、用 CHM/乐观读 |
| **忽略锁降级语义** | 数据不一致 | 写锁 → 读锁 → 释放写锁，保持 HB |
| **StampedLock 当重入锁用** | 同线程二次获取死锁 | 明确非重入、用 ReentrantReadWriteLock |
| **读多写少却用互斥锁** | 吞吐浪费 10-100 倍 | 换 RWLock / CHM / 乐观读 |
| **写放大未评估** | RCU 大 Map OOM/GC 风暴 | 评估写频 × Map 大小、分片 |

## 监控指标

| 指标 | 含义 | 告警 |
|------|------|------|
| `rwlock.read.wait.time` | 读锁等待时间 | > 10ms |
| `rwlock.write.wait.time` | 写锁等待时间 | > 50ms |
| `rwlock.read.hold.time` | 读锁持有时间 | > 1ms (长临界区) |
| `rwlock.write.hold.time` | 写锁持有时间 | > 5ms |
| `stamped.optimistic.fail.rate` | 乐观读失败率 | > 5% (退化悲观) |

## 本章小结

读者-写者优化核心：**读共享、写独占、乐观为先、库优于造**。
- **首选 `ConcurrentHashMap` / `dashmap`**：工程成熟、读无锁、写细粒度
- **极致读性能**：`StampedLock` 乐观读 / RCU / Immutable Snapshot
- **复杂不变量 / 跨 Key 事务**：`ReentrantReadWriteLock` / `StampedLock` 悲观
- **避免手写 RWLock**：极易死锁、饥饿、升级降级错误

下一章讲解**线程池设计**——并发执行的资源管理中枢。