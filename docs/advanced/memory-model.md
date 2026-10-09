# 内存模型

内存模型定义了**多线程程序中内存操作的可见性与顺序保证**，是并发正确性的形式化基石。理解内存模型是编写正确无锁代码、排查诡异并发 Bug 的前提。

## 为什么需要内存模型

### 硬件重排
| 来源 | 行为 | 例子 |
|------|------|------|
| **编译器** | 寄存器分配、公共子表达式消除、循环不变量外提 | `x = a; y = b;` → `y = b; x = a;` |
| **CPU 流水线** | 乱序执行、投机执行、存储转发 | Store Buffer 延迟写入可见 |
| **缓存层级** | 多核缓存一致性协议 (MESI) 传播延迟 | 核 0 写入，核 1 稍后读到 |

**单线程语义不变**：重排不改变单线程观测结果。**多线程则可见重排效应**。

## 核心概念

### Happens-Before (HB)
**偏序关系**：`A hb B` 表示 A 的效果对 B 可见，且 A 先于 B 发生。

| 规则 | 来源 |
|------|------|
| 程序顺序 | 单线程内代码顺序 |
| 监视器锁 | `unlock hb lock` (同一把锁) |
| volatile/原子 | `write hb read` (同一变量) |
| 线程启动 | `Thread.start hb` 线程内首动作 |
| 线程终止 | 线程内末动作 `hb Thread.join` |
| 传递性 | `A hb B ∧ B hb C ⇒ A hb C` |

**数据竞争定义**：两次冲突访问 (读写/写写) 无 HB 关系即构成数据竞争。后果按语言而异：C++/Rust 是未定义行为 (UB)；Java 脱离顺序一致保证，行为仍由 JMM 允许集合约束，不是 UB；Go 未消除竞争时 DRF-SC 保证失效。规范原文逐条核对见[官方内存模型规范核对](/research/memory-model-specs)。

### 顺序一致性 (SC)
**最强模型**：所有线程操作存在全局单一总序，且与各线程程序顺序一致。
- 直觉符合、推理简单
- 性能最差：禁止所有重排、需全栅栏

### 现代语言模型对比

| 语言 | 模型类型 | 关键特性 |
|------|----------|----------|
| **Java (JMM)** | HB + 因果性 | `volatile`、`final`、安全初始化 |
| **C++11** | HB + `memory_order` | 细粒度序、无 `volatile` 线程语义 |
| **Go** | HB + Channel 同步 | 通道通信建立 HB、无竞争时顺序一致 (DRF-SC) |
| **Rust** | HB + 所有权类型系统 | 编译期防数据竞争、无 `volatile` 线程语义 |
| **Python** | GIL + HB | GIL 序列化字节码、仅 C 扩展需关心 |
| **JavaScript** | 单线程 + Worker | `SharedArrayBuffer` + `Atomics` 引入 HB |

## Java 内存模型 (JMM) 深度

### volatile 语义
```java
volatile int v = 0;
// 写
v = 1;  // StoreStore + StoreLoad 屏障
// 读
int x = v;  // LoadLoad + LoadStore 屏障
```
- **可见性**：写 HB 后续读
- **有序性**：禁止 `volatile` 读写与普通读写重排
- **不保证复合操作原子性**：`v++` 是读-改-写三步，`volatile` 挡不住交错，计数用 `AtomicLong`/`LongAdder`；单次 `volatile long`/`double` 读写自 Java 5（JLS §17.7）起就是原子的，32 位平台也不例外

### final 语义
```java
class Foo {
    final int x;  // 写 final 域
    Foo() { x = 1; }  // 构造函数末尾 Freeze
}
// 读 final 域：构造函数 HB 读 final
```
- **安全发布**：正确构造的 `final` 对象无需同步即可安全共享

### 锁语义
```java
synchronized(lock) {  // lock: LoadLoad+LoadStore (acquire)
    // 临界区
}  // unlock: StoreStore+StoreLoad (release)
```
- `unlock hb lock`：释放锁前写入对获取锁后可见

### 双重检查锁定 (DCL) 修复
```java
// JDK 5+ volatile 修复
class Singleton {
    private static volatile Singleton instance;
    static Singleton get() {
        Singleton local = instance;  // 读 volatile
        if (local == null) {
            synchronized (Singleton.class) {
                local = instance;
                if (local == null) instance = local = new Singleton();
            }
        }
        return local;
    }
}
```
**关键**：`volatile` 禁止 `new Singleton()` 重排 (分配内存 → 初始化 → 赋值引用)。

## C++11 内存模型深度

### 原子操作 memory_order
```cpp
std::atomic<int> x{0}, y{0};

// 线程 1
x.store(1, std::memory_order_release);
y.store(1, std::memory_order_relaxed);

// 线程 2
if (y.load(std::memory_order_acquire)) {
    assert(x.load(std::memory_order_relaxed) == 1);  // 保证成立
}
```

| 序 | 适用操作 | 典型场景 |
|----|----------|----------|
| `relaxed` | 所有 | 计数器、统计、无同步 |
| `acquire` | load | 读标志位、获取锁 |
| `release` | store | 写标志位、释放锁 |
| `acq_rel` | RMW (CAS/FAA) | 自旋锁、引用计数 |
| `seq_cst` | 所有 | 默认、全局序、简单正确 |

### 数据竞争 = UB
```cpp
// UB：无同步并发读写
int x = 0;
thread t1([&]{ x = 1; });
thread t2([&]{ x = 2; });
```
**编译器可假设无数据竞争，优化删除读写、无限循环、任意结果**。

## 硬件内存模型

### x86-TSO (Total Store Order)
- **Store Buffer**：写入先入 Store Buffer，再异步刷 L1
- **Load 可越过 Store**：读取同核未刷新的 Store Buffer (Store Forwarding)
- **仅允许 Store-Load 重排**：其他重排禁止
- **`MFENCE` / `LOCK` 前缀** 全栅栏

### ARMv8 / RISC-V (Weak Ordering)
- **允许所有重排**：Load-Load、Load-Store、Store-Load、Store-Store
- **显式屏障**：`DMB` (Data Memory Barrier)、`DSB` (Data Synchronization Barrier)
- **独占监视器**：`LDXR/STXR` 实现原子 RMW

### 编译器到硬件映射
| C++ memory_order | x86 指令 | ARMv8 指令 |
|------------------|----------|------------|
| `relaxed` | `mov` | `ldr/str` |
| `acquire` (load) | `mov` | `ldar` (Load-Acquire) |
| `release` (store) | `mov` | `stlr` (Store-Release) |
| `acq_rel` (RMW) | `lock cmpxchg` | `ldaxr/stlxr` |
| `seq_cst` | `lock` + `mfence` | `dmb ish` + `ldar/stlr` |

## 经典并发 Bug 与内存模型

### 1. 发布未完全初始化对象
```java
// 错误：引用发布可能早于字段初始化
object = new MyObject();  // 重排：分配 → 赋值引用 → 初始化字段
// 修正：volatile / final / synchronized / 静态初始化
```

### 2. 标志位同步失效
```c
// 错误：无内存序保证
int ready = 0;
int data = 0;
// 线程 1
data = 42;
ready = 1;  // 编译器/CPU 可重排

// 线程 2
if (ready) use(data);  // 可能读到 data=0
// 修正：atomic + release/acquire
```

### 3. 双重检查锁定 (非 volatile)
```java
// JDK 5 前错误
if (instance == null) {
    synchronized (Singleton.class) { if (instance == null) instance = new T(); }
}
// 修正：volatile instance
```

### 4. 惰性初始化竞态
```java
// 错误：多线程并发初始化
if (cache == null) cache = new HashMap<>();
// 修正：ConcurrentHashMap.computeIfAbsent / DCL / 静态内部类
```

## 内存模型验证工具

| 工具 | 语言 | 功能 |
|------|------|------|
| **CDSChecker** | C/C++ | 模型检查、数据竞争、HB 违规 |
| **Nidhugg** | C/C++ | 无锁算法验证、TSO/PSO/RC11 |
| **GenMC** | C/C++ | 模型检查、弱内存模型 |
| **Herder** | C/C++ | 一致性检查 |
| **jcstress** | Java | 并发压测、JMM 验证 |
| **Litmus** | 通用 | 硬件内存模型测试套件 |
| **TLA+ / PlusCal** | 规约 | 算法级正确性证明 |

## 最佳实践清单

1. **优先用高级并发工具**：`ConcurrentHashMap`、`BlockingQueue`、Channel、Actor
2. **必须用原子/volatile 时**：
   - 明确标注 `memory_order` / `volatile`
   - 画出 HB 图，确认关键路径
   - 单元测试 + `jcstress` / TSan 压测
3. **避免数据竞争**：编译器假设无竞争优化极其激进
4. **理解发布-订阅模式**：写发布 `release` → 读订阅 `acquire`
5. **final/不可变优先**：编译期/运行时免疫重排
6. **文档化同步约定**：哪个变量建立 HB、哪把锁保护哪些数据

## 本章小结

内存模型是**并发程序与硬件/编译器优化的契约**。核心心法：
- **HB 是推理工具**：画图、找链、验证可见性
- **数据竞争零容忍**：C++/Rust 是 UB，Java/Go 不判 UB 也必须消除，TSan/模型检查全覆盖
- **弱序需显式同步**：`release/acquire`、`volatile`、锁、Channel
- **库隐藏复杂性**：99% 场景用库，仅 1% 底层库需手写原子

下一章讲解**并发数据结构**——内存模型之上的工程化构建块。

## 本章来源

规范类结论以原文为准，四份内存模型规范的入口：

- [JLS SE21 §17.4 Threads and Locks](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html)：JMM、happens-before 与数据竞争定义 (§17.4.5)
- [C++ 工作草案 [intro.races]](https://eel.is/c++draft/intro.races)：数据竞争即未定义行为的条文出处
- [Rust Reference: Behavior considered undefined](https://doc.rust-lang.org/reference/behavior-considered-undefined.html)：UB 清单第一条，同样适用于 unsafe 块
- [The Go Memory Model](https://go.dev/ref/mem)：DRF-SC 结论与「检测到竞争可报错终止」条款

Rust 原子操作的内存模型沿用 C++20 规则、去掉 consume，见 [std::sync::atomic](https://doc.rust-lang.org/std/sync/atomic/index.html)；seq_cst 单一全序的条文在 [atomics.order](https://eel.is/c++draft/atomics.order)。逐条核对过程与四语言对照表在[官方内存模型规范核对](/research/memory-model-specs)。