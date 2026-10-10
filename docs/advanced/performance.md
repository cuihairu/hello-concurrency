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
| **内存带宽** | 多核不加速、内存控制器饱和 | `perf stat` uncore 指标、Intel PCM (`pcm-memory`)、`numastat` |
| **CPU 饱和** | 运行队列长、load average 高 | `mpstat`, `pidstat`, `top` |
| **I/O 等待** | CPU 低、iowait 高、磁盘/网络饱和 | `iostat`, `sar -n DEV`, `ss -s` |
| **GC/内存分配** | STW 停顿、分配率高、老年代膨胀 | `jstat -gc`, `async-profiler`, GC 日志 |
| **NUMA 远程访问** | 跨 Socket 延迟高 | `numastat`, `perf c2c` |

缓存争用、内存带宽与 NUMA 三条的硬件成因——缓存层次与延迟阶梯、缓存一致性协议、NUMA 拓扑——见[硬件与内存层次](./hardware.md)。

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

调度延迟、抢占与上下文切换的内核侧成因（调度类、亲和性、cgroup 限额）见 [操作系统与并发](./os.md)。

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
// JDK 8+ @Contended（JEP 142；应用类需 -XX:-RestrictContended）
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
| ~~`-XX:+UseBiasedLocking`~~ | 偏向锁：JDK 15 废弃（JEP 374）、JDK 18 移除；JDK 21 传入直接报 `Unrecognized VM option`，新版本不要再调 | 已移除 |
| ~~`-XX:BiasedLockingStartupDelay=0`~~ | 同上，随偏向锁一并移除 | 已移除 |
| `-XX:+UseHeavyMonitors` | 诊断开关：强制重量级监视器（调试用），**默认关闭**，并非「默认开启的优化」 | 调试 |
| `-XX:+EliminateLocks` | 逃逸分析消除锁 | 默认开启 |
| `-XX:+UseContainerSupport` | 容器感知 CPU/内存 | 默认开启 |
| `-XX:ActiveProcessorCount=N` | 覆盖可用核数 | 容器限制时设置 |
| `-XX:ParallelGCThreads=N` | GC 并行线程 | 核数 ≤ 8 全部，>8 约 5/8 |
| `-XX:ConcGCThreads=N` | G1/ZGC 并发线程 | 默认 `(ParallelGCThreads + 2) / 4` |

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
- 稆定 100k QPS、p99 < 20ms、CPU 70%、零错误、4 小时无泄漏

## 负载均衡

单机优化到头之后，吞吐的下一跳是把请求摊到多台机器——均衡策略决定摊得均不均：

| 策略 | 判据 | 适用 | 陷阱 |
|------|------|------|------|
| 轮询 / 加权轮询 | 顺序或权重 | 后端同构、成本一致 | 异构后端权重难配准 |
| 最少连接 | 当前活跃连接数 | 请求耗时差异大 | 连接数不等于负载 |
| 一致性哈希 | 请求键哈希 | 有状态缓存、会话黏性 | 节点增减只抖动 1/N 键（[Karger 1997](https://dl.acm.org/doi/10.1145/258533.258660)）；虚拟节点数不足会倾斜 |
| 一致性哈希 + 最少连接混合 | 哈希分片内再择优 | 缓存集群 | 结构复杂，先证明需要 |

均衡器自身的三个成本要算进去：**健康检查的误判窗口**（探测间隔内请求照样打到坏节点）、**重试放大**（一次失败在多层各重试一次，下游收到指数级请求）、**会话黏性与扩容的矛盾**（黏性越高，滚动扩容越伤）。入口层的限流、熔断与降级属于流量治理，见[应用场景调研](../research/applications.md)；事件驱动结构下的连接分发见 [Reactor 与事件驱动](../practice/reactor.md)。

## 缓存策略

缓存是高并发系统里「用空间与一致性换延迟」的最大单项，读写路径分开设计：

| 模式 | 读 | 写 | 一致性 |
|------|---|-----|--------|
| **Cache-Aside** | 先查缓存，未命中查库并回填 | 先写库，再失效缓存 | 延迟最高，最通用 |
| **Read-Through** | 缓存代理回源并回填 | 同 Cache-Aside | 库访问收敛在缓存层 |
| **Write-Through** | 同上 | 先写缓存，缓存同步写库 | 写延迟变高，读几乎总命中 |
| **Write-Behind** | 同上 | 只写缓存，异步刷库 | 写最快，宕机丢数据，只适合可丢数据的场景 |

缓存的三个经典故障及其修法：

1. **穿透**（查不存在的 key，绕过缓存打库）：布隆过滤器挡在前面，或缓存空值并给短 TTL
2. **击穿**（单个热点 key 过期瞬间，海量请求同时回源）：热点 key 不过期或异步重建，回源加单飞（singleflight/互斥）——重建期并发的竞态与 Facebook Memcache 的 lease 解法同源，见[应用场景调研](../research/applications.md)
3. **雪崩**（大批 key 同时过期或缓存整体失效）：TTL 加抖动打散，缓存层限流降级兜底，预热后再切流量

失效通知的可靠性是隐藏地基：主从复制下「写库成功但失效消息丢失」会留下永久脏数据，强一致场景要走双删或以 binlog 为准的订阅失效。

## 压测与监控

压测不是「发一堆请求看能不能扛住」，而是**在上生产前把容量边界与失效模式找出来**：

| 阶段 | 做什么 | 关键点 |
|------|--------|--------|
| 建模 | 按目标 QPS × 峰值系数定并发与请求配比 | 配比按线上真实分布，不是全用最热接口 |
| 基线 | 单机/单实例压测，扫出拐点 | 逐级加压，找到吞吐不再涨、延迟开始跳的点 |
| 全链路 | 影子库/影子链路按峰值系数压 | 依赖全部真实或等比缩小，缓存冷热两种都压 |
| 稳定性 | 目标负载 4–24 小时 | 盯内存、连接、线程数是否单调上涨（慢泄漏） |
| 故障演练 | 摘节点、断依赖、注入延迟 | 验证降级与熔断真的触发，而非只在预案里 |

监控面按 RED（请求率、错误率、延迟分布）与 USE（利用率、饱和度、错误）两条线布指标，再把[操作系统与并发](./os.md)一层的 PSI（CPU/内存/IO 压力）纳入——应用层延迟毛刺经常要靠 PSI 才能分清是自家锁争用还是机器层面的排队。火焰图与 `perf` 的读法在上文测量工具箱，SLO 口径与 Little's Law 的容量推算见下节。

## 容量规划公式

### Little's Law
```
L = λ × W
并发数 = 吞吐率 × 平均延迟
```
- **线程池大小** ≈ 目标 QPS × **平均**延迟 (秒)——注意取均值而非 p99：Little's Law 里的 W 是平均逗留时间，用 p99 会系统性高估并发数
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

单机之外还有两级放大器：**负载均衡**把请求摊到多台机器（一致性哈希摊得最稳），**缓存**把重复计算挡在库前（穿透/击穿/雪崩各有修法）——扩容与缓存都要先用压测把拐点和失效模式找出来，否则只是把故障推迟到峰值那天。

**终极心法**：过早优化是万恶之源；**不优化是万恶不灭之源**。在正确性基础上，对瓶颈无情优化，对非瓶颈仁慈放过。

## 本章来源

- Little's Law 出自 J. D. C. Little, *A Proof for the Queuing Formula L = λW*, Operations Research 9(3), 1961
- USE 方法与火焰图读法见 [Brendan Gregg: USE Method](https://www.brendangregg.com/usemethod.html) 与 [Flame Graphs](https://www.brendangregg.com/flamegraphs.html)
- 一致性哈希出自 D. Karger 等, *Consistent Hashing and Random Trees*（STOC 1997）
- 缓存失效与单飞回源的工程出处：P. Nishtala 等, *Scaling Memcache at Facebook*（NSDI 2013），拆解在[应用场景调研](../research/applications.md)
- 偏向锁停用并废弃出自 [JEP 374](https://openjdk.org/jeps/374)（JDK 15），JDK 18 起移除
