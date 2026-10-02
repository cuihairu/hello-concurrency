# 无锁编程

无锁编程利用 **硬件原子指令 (CAS/LL-SC)** 实现并发数据结构，避免锁的阻塞、优先级反转、死锁、上下文切换开销。核心权衡：**算法复杂度换取极致吞吐与延迟确定性**。

## 核心原语

### Compare-And-Swap (CAS)
```c
// 伪代码：原子比较并交换
bool CAS(addr *ptr, old_val expected, new_val desired) {
    atomic {
        if (*ptr == expected) {
            *ptr = desired;
            return true;
        }
        return false;
    }
}
```
- **语义**：若 `*ptr == expected` 则写入 `desired` 并返回 true，否则不修改返回 false
- **x86**：`LOCK CMPXCHG` (全缓存行锁定)
- **ARM/RISC-V**：`LDXR/STXR` (Load-Linked/Store-Conditional)

### Load-Linked / Store-Conditional (LL/SC)
```asm
// ARMv8
LDXR  W0, [X1]      // 加载并标记独占监视
...                 // 计算新值
STXR  W2, W0, [X1]  // 条件存储，成功 W2=0
CBNZ  W2, retry     // 失败重试
```
- **优势**：无 ABA 问题 (硬件监视粒度细)、支持多字原子
- **限制**：LL/SC 间不能有系统调用、中断、缓存驱逐

### 内存序
| 序 | 语义 | 典型用途 |
|----|------|----------|
| `seq_cst` | 全局单一全序 | 默认、简单正确 |
| `acquire` | 后续读写不重排到此前 | 加锁、读标志位 |
| `release` | 此前读写不重排到此后 | 解锁、写标志位 |
| `acq_rel` | acquire + release | RMW 操作 (CAS、FAA) |
| `relaxed` | 仅保证原子性 | 计数器、统计、无同步需求 |

**黄金法则**：先用 `seq_cst` 保证正确，再经压测优化为弱序。

## 经典无锁数据结构

### 1. 无锁栈 (Treiber Stack)
```c
struct Node { T value; Node* next; };
atomic<Node*> head;

void push(T val) {
    Node* n = new Node{val, nullptr};
    do { n->next = head.load(); } 
    while (!head.compare_exchange_weak(n->next, n));
}

bool pop(T& out) {
    Node* h;
    do {
        h = head.load();
        if (!h) return false;
    } while (!head.compare_exchange_weak(h, h->next));
    out = h->value;
    delete h;  // 延迟回收 (Hazard Pointer / Epoch)
    return true;
}
```
**ABA 问题**：pop 期间 head A→B→A，CAS 误判成功。解法：标记指针、版本号、Hazard Pointer。

### 2. 无锁队列 (Michael-Scott Queue)
```c
struct Node { T value; atomic<Node*> next; };
atomic<Node*> head, tail;

void enqueue(T val) {
    Node* n = new Node{val, nullptr};
    Node* t;
    do {
        t = tail.load();
        Node* next = t->next.load();
        if (t != tail.load()) continue;
        if (next) { tail.compare_exchange_weak(t, next); continue; }
        if (t->next.compare_exchange_weak(next, n)) break;
    } while (true);
    tail.compare_exchange_weak(t, n);
}

bool dequeue(T& out) {
    Node* h;
    do {
        h = head.load();
        Node* t = tail.load();
        Node* next = h->next.load();
        if (h != head.load()) continue;
        if (h == t) {
            if (!next) return false;
            tail.compare_exchange_weak(t, next);
            continue;
        }
        out = next->value;
        if (head.compare_exchange_weak(h, next)) break;
    } while (true);
    delete h;  // 延迟回收
    return true;
}
```
**关键点**：尾指针可能滞后，需帮助推进。

### 3. 无锁哈希表
- **分段锁 + 无锁桶**：Java `ConcurrentHashMap` (JDK 8+)
- **全无锁**：`Cliff Click` 非阻塞哈希表、C++ `folly::AtomicHashMap`、Rust `dashmap` (分段锁)
- **核心技术**：开放寻址 + CAS、分裂有序列表、RCU 读侧无锁

## 内存回收：无锁编程最大难点

删除节点时，其他线程可能仍在访问。**不能立即 `free`**，需安全回收。

| 方案 | 原理 | 开销 | 适用性 |
|------|------|------|--------|
| **Hazard Pointer** | 线程声明正在访问的指针，回收前扫描 | 低 (O(线程数)) | 通用、低延迟 |
| **Epoch-Based Reclamation (EBR)** | 全局纪元推进，两个纪元后回收 | 极低 (批量) | 高吞吐、可容忍延迟回收 |
| **RCU (Read-Copy-Update)** | 读者无锁，写者复制修改，宽限期后回收 | 读零开销 | 读多写少、内核、数据库 |
| **引用计数 / 共享指针** | 原子引用计数 | 高 (缓存行抖动) | 简单场景、C++ `shared_ptr` |
| **垃圾回收器** | 运行时自动管理 | 不确定 | Java/Go 适用（GC 自动回收废弃节点）；Rust 无 GC，不适用，需上表手动方案 |

### Hazard Pointer 简述
```c
// 线程局部 hazard pointer 数组
__thread HPRecord hp[MAX_HP];

void retire(Node* p) {
    // 加入退休链表
    // 扫描所有线程 hp，无人引用则 free
}
```

### EBR 简述
```c
// 全局 epoch 计数器
atomic<uint64_t> global_epoch;

// 线程进入临界区
uint64_t local_epoch = global_epoch.load(acquire);
// ... 访问共享数据 ...
// 退出临界区

// 回收线程：推进 epoch，回收两个 epoch 前的退休对象
```

## 无锁算法设计模式

| 模式 | 核心思想 | 典型例子 |
|------|----------|----------|
| **复制修改 (Copy-on-Write)** | 读共享旧版本，写创建新版本 | `CopyOnWriteArrayList`、RCU |
| **乐观验证** | 读记录版本，写时验证版本未变 | 数据库 MVCC、STM |
| **帮助机制** | 线程协助完成他人未完成操作 | MS Queue 推进尾指针 |
| **消除竞争** | 线程局部缓冲、批量合并 | `LongAdder`、ThreadLocal |
| **分层/分片** | 将热点分散到多独立实例 | 分段锁、分桶计数器 |

## 语言生态对比

| 语言 | 原子操作 | 无锁库 | 回收机制 |
|------|----------|--------|----------|
| **C++11+** | `std::atomic<T>` | `folly`, `libcds`, `boost::lockfree` | 手工 (HP/EBR/RCU) |
| **Java** | `java.util.concurrent.atomic` | `jctools`, `netty` | GC 自动 |
| **Go** | `sync/atomic` | 标准库 Channel 为主 | GC 自动 |
| **Rust** | `std::sync::atomic` | `crossbeam`, `dashmap`, `arc-swap` | 所有权 + EBR (crossbeam-epoch) |
| **C#** | `Interlocked`, `Volatile` | `System.Collections.Concurrent` | GC 自动 |

## 性能分析工具

| 工具 | 用途 |
|------|------|
| `perf stat -e cycles,instructions,cache-misses` | 微架构指标 |
| `perf record -g` + `perf report` | 热点调用栈 |
| `valgrind --tool=drd` / `helgrind` | 数据竞争检测 |
| `ThreadSanitizer (TSan)` | 编译期插桩竞争检测 |
| `linux-perf` + `c2c` | 缓存行争用分析 (False Sharing) |
| `JMH` / `Google Benchmark` | 微基准测试 |

## 无锁编程清单

1. **先测后优**：锁是否真成瓶颈？`perf` 看上下文切换、缓存未命中
2. **优先用成熟库**：`ConcurrentHashMap`、`ConcurrentQueue`、`crossbeam`、`jctools`
3. **ABA 防护**：指针打标签、版本号、Hazard Pointer
4. **内存序最小化**：`acquire/release` 足够时勿用 `seq_cst`
5. **伪共享消除**：`alignas(64)` / `cacheline_padding` 热点计数器
6. **回收策略选型**：高吞吐选 EBR、低延迟选 HP、读多写少选 RCU
7. **正确性验证**：TSan、模型检查 (CBMC、TLA+)、压测注入故障
8. **文档化假设**：内存序依赖、进度保证 (lock-free/wait-free/obstruction-free)

## 进度保证分级

| 级别 | 定义 | 典型实现 |
|------|------|----------|
| **Wait-free** | 有限步骤必完成 | 原子 RMW、单生产者环形缓冲区 |
| **Lock-free** | 系统整体推进 (某线程可能饿) | CAS 循环、Treiber Stack、MS Queue |
| **Obstruction-free** | 独占执行时必完成 | STM、乐观验证 |

## 本章小结

无锁编程是**硬件原语 + 内存模型 + 安全回收**的系统工程。核心心法：
- **CAS 循环**是基石，**内存序**是护栏，**内存回收**是命门
- **库优于造**，**测优于猜**，**简单优于快**
- 多数业务代码**不需要**无锁，锁 + 良好设计已足够

下一章讲解**内存模型**——并发正确性的形式化基石。