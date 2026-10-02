# 并发数据结构

并发数据结构是并发编程的**标准零件库**。选择合适的结构、理解其语义与性能边界，是构建高吞吐、低延迟系统的关键。

## 分类全景

| 类别 | 典型结构 | 核心技术 | 适用场景 |
|------|----------|----------|----------|
| **队列** | 有界/无界、阻塞/无锁、MPMC/SPSC | 环形缓冲、CAS 链表、LCRQ | 生产消费、任务调度、日志缓冲 |
| **映射** | HashMap、SkipList、B+Tree、Trie | 分段锁、CAS、RCU、HTM | 缓存、路由表、会话存储 |
| **集合** | HashSet、TreeSet、BloomFilter | 同映射 | 去重、权限检查、布隆过滤 |
| **计数器** | LongAdder、StripedCounter、AtomicLong | 分片、伪共享消除、CAS | 统计、限流、指标采集 |
| **栈/双端队列** | Treiber Stack、Chase-Lev Deque | CAS、工作窃取 | 线程池任务队列、DFS |
| **优先队列** | SkipList、Heap、Calendar Queue | 细粒度锁、无锁跳表 | 定时任务、事件模拟 |
| **同步工具** | Latch、Barrier、Phaser、Semaphore | AQS、CAS、Park/Unpark | 编排、启动同步、资源控制 |

## 核心队列对比

| 队列 | 模型 | 有界 | 阻塞 | 无锁 | 吞吐 | 延迟 | 典型实现 |
|------|------|------|------|------|------|------|----------|
| `ArrayBlockingQueue` | MPMC | ✓ | ✓ | ✗ | 中 | 稳定 | 环形数组 + 单锁双条件 |
| `LinkedBlockingQueue` | MPMC | ✓/✗ | ✓ | ✗ | 中 | 稳定 | 链表 + 双锁 |
| `ConcurrentLinkedQueue` | MPMC | ✗ | ✗ | ✓ | 高 | 低 | Michael-Scott CAS 链表 |
| `SynchronousQueue` | MPMC | 0 | ✓ | ✗ | 低 | 高 | 直接移交、双栈 |
| `Disruptor` | SPSC/MPMC | ✓ | 可选 | ✓ (环形) | 极高 | 极低 | 环形 + 序号 + 等待策略 |
| `LCRQ` | MPMC | ✗ | ✗ | ✓ | 高 | 低 | 分段链表 + CAS |
| `JCTools MpmcArrayQueue` | MPMC | ✓ | ✗ | ✓ | 极高 | 低 | 环形 + 乘法索引 |
| `crossbeam-channel` | MPMC | ✓/✗ | ✓ | ✗ | 高 | 低 | Rust 标准库风格 |

### 选型决策树
```
是否需要背压/有界？
├─ 是 → 需阻塞等待？ → ArrayBlockingQueue / Disruptor (高性能)
└─ 否 → 纯内存高吞吐？ → ConcurrentLinkedQueue / JCTools 无锁队列
```

## 核心映射对比

| Map | 读性能 | 写性能 | 扩容 | 内存 | 顺序 | 典型实现 |
|-----|--------|--------|------|------|------|----------|
| `ConcurrentHashMap` (JDK 8+) | 高 | 高 | 渐进式 | 中 | 无 | CAS + synchronized 分桶 + 红黑树 |
| `ConcurrentSkipListMap` | 中 | 中 | 无 | 高 | 有序 | 无锁跳表 |
| `CHM (JDK 7)` | 中 | 中 | 全量 | 高 | 无 | 分段锁 (Segment[]) |
| `DashMap` (Rust) | 高 | 高 | 渐进 | 中 | 无 | 分片 RWLock |
| `folly::AtomicHashMap` | 高 | 高 | 无 | 低 | 无 | 开放寻址 + CAS |
| `robin_hood::HashMap` | 极高 | 高 | 无 | 低 | 无 | Robin Hood 探测 |

### JDK 8+ CHM 关键优化
1. **摒弃 Segment[]**，改用 `Node[] table` + `synchronized` 锁首节点 + CAS
2. **链表树化**：冲突链长 > 8 → 红黑树，查询 O(log n)
3. **扩容协助**：多线程并行迁移，`sizeCtl` 协调
4. **`computeIfAbsent`/`merge`** 原子复合操作，避免外层锁

## 计数器与聚合器

| 结构 | 原理 | 吞吐 | 扩展性 | 场景 |
|------|------|------|--------|------|
| `AtomicLong` | CAS 单变量 | 低 | 差 | 低并发、精确计数 |
| `LongAdder` | 基础值 + Cell[] 分片 | 高 | 好 | 高并发计数、指标 |
| `LongAccumulator` | 自定义累加函数 + 分片 | 高 | 好 | 非加法聚合 (max/min) |
| `Striped64` (基类) | 伪共享消除、动态扩容 | - | - | 自定义分片聚合 |
| `DoubleAdder` | 浮点分片累加 | 高 | 好 | 浮点指标 |

**伪共享消除**：`@Contended` (JDK 8+，JEP 142；JDK 内部类直接生效，应用类需 `-XX:-RestrictContended`) / `alignas(64)` / `Cell` 数组每元素独占缓存行。

## 并发集合最佳实践

### 1. 复合操作原子化
```java
// 错误：check-then-act 竞态
if (map.containsKey(k)) map.remove(k);
// 正确：原子复合
map.remove(k, expectedValue);
map.computeIfAbsent(k, v -> new V());
map.merge(k, v, (old, n) -> old + n);
```

### 2. 批量操作
```java
// forEach / search / reduce 并行遍历
map.forEach(16, (k, v) -> process(k, v));  // 并行度 16
long sum = map.reduceValues(16, Long::sum);
```

### 3. 视图一致性
```java
// 弱一致迭代器：不抛 CME，可能反映部分更新
for (Entry e : map.entrySet()) { ... }
// size() 非精确：并发修改时估算值
```

### 4. 避免序列化锁
```java
// 错误：整表加锁
synchronized(map) { for (v : map.values()) ... }
// 正确：并行流 / forEach / splititerator
map.values().parallelStream().forEach(...);
```

## 语言生态标准库对比

| 语言 | 队列 | Map | Set | 计数器 | 同步工具 |
|------|------|-----|-----|--------|----------|
| **Java** | `java.util.concurrent.*` | `ConcurrentHashMap` | `ConcurrentSkipListSet` | `LongAdder` | `CountDownLatch`, `Phaser` |
| **Go** | `chan` / `sync.Mutex` + 切片 | `sync.Map` (读多写少) | 无标准 | `sync/atomic` | `sync.WaitGroup`, `errgroup` |
| **Rust** | `crossbeam::queue` / `flume` | `dashmap` / `evmap` | `dashset` | `atomic` / `crossbeam-utils` | `crossbeam::sync` / `tokio::sync` |
| **C++** | `moodycamel::ConcurrentQueue` | `folly::AtomicHashMap` | `tsl::hopscotch_set` | `std::atomic` | `std::latch`, `std::barrier` (C++20) |
| **C#** | `ConcurrentQueue` / `BlockingCollection` | `ConcurrentDictionary` | `ConcurrentBag` | `Interlocked` | `CountdownEvent`, `Barrier` |

## 高性能专用结构

### Disruptor (环形缓冲 + 序号)
```java
// 单生产者多消费者
RingBuffer<Event> ring = RingBuffer.createSingleProducer(factory, 1024);
ring.publishEvent((event, seq) -> event.setValue(data));

// 消费者组
WorkerPool<Event> pool = new WorkerPool<>(ring, barrier, exceptionHandler, workers);
```
- **机械同情**：缓存友好、无伪共享、批量发布、等待策略可配 (忙等/阻塞/混合)
- **适用**：超高吞吐、低延迟、事件溯源、日志、交易撮合

### LMAX Architecture
```
接收器 → 解码器 → 业务处理器 (单线程、无锁) → 发布器 → 持久化/网关
```
- 核心：单线程业务逻辑 + Disruptor 传递，避免所有锁竞争

### RCU (Read-Copy-Update)
```c
// 读侧零开销
rcu_read_lock();
p = rcu_dereference(ptr);
use(p);
rcu_read_unlock();

// 写侧复制修改
new = kmalloc(...);
copy_old(new);
modify(new);
rcu_assign_pointer(ptr, new);
synchronize_rcu();  // 等待所有读侧退出
kfree(old);
```
- **读多写少极致**：读零锁、零原子、零缓存行争用
- **Linux 内核、数据库 (MySQL MVCC)、Redis、TiKV 广泛使用**

## 性能测试方法论

### JMH (Java) / Google Benchmark (C++) 关键点
```java
@Benchmark
@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(TimeUnit.SECONDS)
@Threads(16)
@Fork(3)
@Warmup(iterations = 5, time = 3)
@Measurement(iterations = 10, time = 3)
public void throughput(QueueState s) {
    s.queue.offer(s.value);
}
```

### 关键指标
| 指标 | 含义 | 采集方式 |
|------|------|----------|
| **吞吐** | ops/sec | JMH Throughput |
| **延迟分布** | p50/p99/p999 | JMH Sample / HdrHistogram |
| **可扩展性** | 吞吐随线程数变化 | 1..N 线程扫描 |
| **缓存未命中** | L1/L2/L3 miss rate | `perf stat -e cache-misses` |
| **伪共享** | 缓存行来回迁移 | `perf c2c` / `perf mem` |
| **内存分配率** | MB/sec、GC 频次 | `jstat -gc` / `async-profiler` |

## 常见性能陷阱

| 陷阱 | 症状 | 排查 | 修复 |
|------|------|------|------|
| **伪共享** | 多核扩展性差、cache-misses 高 | `perf c2c` | `@Contended` / padding / 线程局部聚合 |
| **扩容风暴** | 周期性延迟尖峰 | GC 日志、JFR | 预设初始容量、分段扩容 |
| **哈希冲突攻击** | CPU 100%、延迟飙升 | 火焰图 | Key 哈希扰动、SipHash、树化阈值 |
| **无锁队列 ABA** | 极罕见数据损坏 | 模型检查、压测 | 版本号指针、Hazard Pointer |
| **阻塞队列饱和** | 生产者阻塞、背压传导 | 队列长度监控 | 有界 + 拒绝策略 / 扩容 / 熔断 |

## 本章小结

并发数据结构是**算法 + 内存模型 + 硬件特性**的工程结晶。选型心法：
- **队列**：有界阻塞选 `ArrayBlockingQueue`/Disruptor；无界高吞吐选无锁队列
- **Map**：默认 `ConcurrentHashMap` (JDK 8+)；有序选 `ConcurrentSkipListMap`；极致读性能选 RCU/不可变快照
- **计数器**：高并发必用 `LongAdder`/分片计数器
- **测试**：JMH + `perf` + 压测 + 模型检查

下一章讲解**性能调优**——从微基准到全链路调优的系统方法论。