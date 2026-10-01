# 性能调优

并发性能调优是**测量 → 分析 → 优化 → 验证**的闭环工程。核心原则：**不测不改、测改分离、瓶颈导向、权衡显性**。

## 性能模型

### 通用延迟分解
```
总延迟 = 串行部分 + 并行部分/并行度 + 同步开销 + 调度开销 + 干扰
```
- **阿姆达尔定律**：加速比 ≤ 1 / (串行比例 + 并行比例/核数)
- **古斯塔夫森定律**：问题规模随核数增长，加速比近似线性

### 并发瓶颈画像
| 瓶颈类型 | 典型症状 | 排查指标 |
|----------|----------|----------|
| **锁竞争** | CPU 低、上下文切换高、线程 BLOCKED | `perf sched`, `jstack`, `lockstat` |
| **缓存争用** | 扩展性差、cache-miss 高、伪共享 | `perf c2c`, `perf mem`, `perf stat` |
| **内存带宽** | 多核不加速、内存控制器饱和 | `perf stat -e memory_bandwidth` |
| **CPU 饱和** | 运行队列长、load average 高 | `mpstat`, `pidstat`, `top` |
| **I/O 等待** | CPU 低、iowait 高、磁盘/网络饱和 | `iostat`, `sar -n DEV`, `ss -s` |
| **GC/内存分配** | STW 停顿、分配率高、老年代膨胀 | `jstat -gc`, `async-profiler`, GC 日志 |
| **NUMA 远程访问** | 跨 Socket 延迟高 | `numastat`, `perf c2c` |

## 测量工具箱

### Linux 系统级
| 工具 | 用途 | 关键命令 |
|------|------|----------|
| `perf` | CPU 采样、缓存、调度、内存访问 | `perf record -g -p PID`, `perf stat -e cycles,instructions,cache-misses,branch-misses` |
| `perf c2c` | 缓存行争用/伪共享分析 | `perf c2c record -p PID`, `perf c2c report` |
| `perf sched` | 调度延迟、迁移、唤醒 | `perf sched record`, `perf sched latency` |
| `bcc / bpftrace` | 内核级动态追踪 | `biolatency`, `runqlat`, `offcputime` |
| `vmstat / pidstat / mpstat` | 系统/进程/CPU 核指标 | `pidstat -w -p PID 1` (上下文切换) |
| `numastat` | NUMA 本地/远程访问 | `numastat -p PID` |

### JVM 专用
| 工具 | 用途 |
|------|------|
| **JMH** | 微基准、吞吐/延迟分布 |
| **async-profiler** | 低开销 CPU/内存/锁/GC 火焰图 |
| **JFR (Java Flight Recorder)** | 生产级事件记录、事后分析 |
| **jstack / jcmd Thread.print** | 线程快照、死锁检测 |
| **jstat -gc / GC 日志** | GC 原因、频次、停顿 |
| **Arthas** | 线上诊断、监控、反编译 |
| **HdrHistogram** | 延迟分布高精度记录 |

### Go/Rust/C++
| 生态 | 工具 |
|------|------|
| Go | `pprof` (CPU/内存/阻塞/互斥)、`trace`、拖拽火焰图 |
| Rust | `perf` + `cargo bench`、 `flamegraph`、 `criterion.rs` |
| C++ | `perf`、 `Google Benchmark`、 `VTune`、 `gperftools` |

## 分析方法论

### 1. RED / USE 法则
- **RED** (请求视角)：Rate、Errors、Duration
- **USE** (资源视角)：Utilization、Saturation、Errors

### 2. 火焰图阅读
- **宽度 = 采样次数/时间占比**：顶层宽板 = 热点
- **平顶**：锁等待、I/O、Park
- **锯齿**：递归、频繁函数调用
- **颜色**：通常按包/模块着色

### 3. 关键路径分析
```
用户请求 → 网络 → 反序列化 → 业务逻辑 (锁/缓存/DB) → 序列化 → 网络
                    ↑                                    ↑
              并发瓶颈点                          并发瓶颈点
```

### 4. 对比基线
| 对比维度 | 目的 |
|----------|------|
| 单线程 vs 多线程 | 量化并行收益、同步开销 |
| 无锁 vs 有锁 | 评估无锁收益/代价 |
| 不同队列/Map | 选型验证 |
| 不同 JVM 参数 | GC/编译器调优 |
| 不同硬件 | 容量规划、选型 |

## 优化模式库

### 1. 减少同步开销
| 模式 | 适用 | 收益 | 代价 |
|------|------|------|------|
| **无锁/原子变量** | 简单状态、计数器 | 消除阻塞、上下文切换 | ABA、内存序复杂 |
| **分片/分段锁** | 高并发 Map/缓存 | 并发度 × 分片数 | 内存、扩容复杂 |
| **读写锁/RCU** | 读多写少 | 读零竞争 | 写放大、回收延迟 |
| **ThreadLocal/线程局部聚合** | 统计、缓冲 | 零同步 | 合并开销、内存 |
| **批量/合并操作** | 高频小操作 | 摊销同步成本 | 延迟抖动 |
| **异步/流水线** | 串行依赖链 | 吞吐提升 | 延迟增加、复杂度 |

### 2. 消除伪共享
```java
// JDK 12+ @Contended
@Contended class Counter { volatile long value; }

// 手工 padding
class Counter { 
    volatile long value;
    long p1, p2, p3, p4, p5, p6, p7; // 缓存行 64 字节
}
```
**验证**：`perf c2c` 观察 `LLC Misses`、`Remote HITM` 下降。

### 3. 缓存友好布局
| 技巧 | 说明 |
|------|------|
| **结构数组 (SoA) → 数组结构 (AoS)** | 热字段连续、预取友好 |
| **紧凑对象** | `-XX:+UseCompressedOops`、避免对象头膨胀 |
| **预取** | `__builtin_prefetch` / `PrefetchHint` |
| **大页内存** | `-XX:+UseLargePages` / `hugepages` 减少 TLB miss |

### 4. 线程池调优
```java
// CPU 密集：核数 + 1
int cpu = Runtime.getRuntime().availableProcessors();
ThreadPoolExecutor cpuPool = new ThreadPoolExecutor(
    cpu, cpu, 0, TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(1024)
);

// IO 密集：2 * 核数 或 更多 (经验公式)
ThreadPoolExecutor ioPool = new ThreadPoolExecutor(
    cpu * 2, cpu * 4, 60, TimeUnit.SECONDS,
    new LinkedBlockingQueue<>()
);
```
**关键参数**：核心/最大线程、队列类型/有界、拒绝策略、线程工厂 (命名、优先级)。

### 5. JVM 并发调优参数
| 参数 | 说明 | 典型值 |
|------|------|--------|
| `-XX:+UseBiasedLocking` | 偏向锁 (JDK 15 废弃) | 单线程重入场景 |
| `-XX:BiasedLockingStartupDelay=0` | 偏向锁启动延迟 | 0 |
| `-XX:+UseHeavyMonitors` | 重量级监视器优化 | JDK 16+ 默认开启 |
| `-XX:+EliminateLocks` | 逃逸分析消除锁 | 默认开启 |
| `-XX:+UseContainerSupport` | 容器感知 CPU/内存 | 默认开启 |
| `-XX:ActiveProcessorCount=N` | 覆盖可用核数 | 容器限制时设置 |
| `-XX:ParallelGCThreads=N` | GC 并行线程 | 核数 ≤ 8 全部，>8 约 5/8 |
| `-XX:ConcGCThreads=N` | CMS/G1 并发线程 | 并行线程 / 2 |

## 全链路调优案例

### 场景：高并发 HTTP 网关吞吐不达标
```
现象：16 核机器，目标 100k QPS，实测 35k QPS，CPU 45%，延迟 p99 200ms
```

#### 步骤 1：TOP-DOWN 定位
```bash
perf stat -e cycles,instructions,cache-misses,branch-misses -p PID
# CPI 2.8 (理想 <1.0)，cache-miss 12%，branch-miss 3%
```

#### 步骤 2：火焰图
```bash
async-profiler -d 60 -f flame.html -e cpu -p PID
# 宽板：ConcurrentHashMap.get (35%)、ArrayBlockingQueue.put (28%)、JSON 序列化 (15%)
```

#### 步骤 3：钻取分析
- **CHM.get 热**：热 Key 竞争 → 读多写少 → 改 `StampedLock` 乐观读 / 本地缓存 / `Caffeine` 缓存
- **ABQ.put 热**：有界队列饱和阻塞 → 生产消费失速 → 扩容 / 离散队列 / Disruptor
- **JSON 热**：序列化开销大 → 换 `Jackson` 后端 / `simdjson` / Protobuf

#### 步骤 4：逐项验证
| 优化 | QPS 提升 | 延迟 p99 变化 |
|------|----------|---------------|
| 本地缓存热 Key | 35k → 52k | 200ms → 80ms |
| Disruptor 替换 ABQ | 52k → 78k | 80ms → 35ms |
| Protobuf 替换 JSON | 78k → 95k | 35ms → 18ms |
| 线程池分离 IO/CPU | 95k → 110k | 18ms → 12ms |

#### 步骤 5：压测验收
- 稳定 100k QPS、p99 < 20ms、CPU 70%、零错误、4 小时无泄漏

## 容量规划公式

### Little's Law
```
L = λ × W
并发数 = 吞吐率 × 平均延迟
```
- **线程池大小** ≈ 目标 QPS × 目标 p99 延迟 (秒)
- **队列长度** ≈ 突发流量 × 处理时间

### 扩容触发阈值
| 指标 | 告警阈值 | 扩容动作 |
|------|----------|----------|
| CPU 利用率 | > 70% (持续 5min) | 横向扩容 |
| 队列积压 | > 队列容量 80% | 扩容消费者 / 限流上游 |
| 延迟 p99 | > SLA 2× | 熔断 / 降级 / 扩容 |
| GC 停顿 | > 200ms / 1h > 3 次 | 调优 GC / 增加堆 / 离堆 |

## 性能回归防护

### CI 集成基准测试
```yaml
# GitHub Actions 片段
- name: Run JMH benchmarks
  run: ./gradlew jmh -Pjmh.includes="MyBenchmark"
- name: Compare with baseline
  run: |
    python compare.py baseline.json current.json --threshold 0.05
    # 性能回归 >5% 失败
```

### 关键基准保护清单
- [ ] 核心队列吞吐/延迟
- [ ] Map 读写混合负载
- [ ] 锁竞争微基准 (不同线程数)
- [ ] 内存分配率、GC 频次
- [ ] 端到端 API p50/p99/p999

## 本章小结

性能调优是**科学实验**，非玄学：
1. **建立基线**：RED/USE 指标、微基准、全链路压测
2. **定位瓶颈**：`perf` + 火焰图 + 关键路径，拒绝猜测
3. **模式化优化**：减同步、消伪共享、缓存友好、池化、异步
4. **量化验证**：A/B 对比、回归测试、长时稳定性
5. **文档化权衡**：吞吐 vs 延迟、一致性 vs 性能、复杂度 vs 收益

**终极心法**：过早优化是万恶之源；**不优化是万恶不灭之源**。在正确性基础上，对瓶颈无情优化，对非瓶颈仁慈放过。