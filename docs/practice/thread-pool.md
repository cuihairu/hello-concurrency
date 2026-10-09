# 线程池设计

线程池是并发程序的**资源管理中枢**：复用线程、控制并发度、隔离业务、提供监控钩子。设计良好的线程池是系统稳定性的基石。

## 核心组件

```
任务提交 → [工作队列] → 工作线程组 → 执行任务
                ↑           ↑
           拒绝策略    线程工厂/生命周期
```

| 组件 | 职责 | 关键决策 |
|------|------|----------|
| **核心线程数** | 常驻线程，无任务不回收 | CPU 密集 = 核数；IO 密集 = 2×核数 |
| **最大线程数** | 峰值并发上限 | 队列有界时生效；无界队列永不触发 |
| **工作队列** | 任务缓冲、背压 | 有界/无界、公平/优先级、拒绝策略配合 |
| **线程工厂** | 命名、优先级、守护、上下文 | 可观测性、隔离性 |
| **拒绝策略** | 队列满 + 线程满时处理 | Abort/Discard/CallerRuns/Custom |
| **存活时间** | 非核心线程空闲回收 | 避免线程泄漏、适应负载波动 |

## Java ThreadPoolExecutor 全解析

### 执行流程
```java
public void execute(Runnable command) {
    int c = ctl.get();
    if (workerCount < corePoolSize) {           // 1. 核心池未满 → 创建核心线程
        if (addWorker(command, true)) return;
    }
    if (isRunning() && workQueue.offer(command)) { // 2. 入队成功
        if (!isRunning() || workerCount == 0)   // 双重检查
            ensureQueuedTaskHandled(command);
    } else if (!addWorker(command, false)) {    // 3. 非核心池未满 → 创建非核心线程
        reject(command);                         // 4. 全满 → 拒绝
    }
}
```

### 关键参数组合陷阱

| 队列类型 | core/max 效果 | 典型误用 |
|----------|---------------|----------|
| **无界队列** (LinkedBlockingQueue) | maxPoolSize **永不生效**，仅 corePoolSize 工作 | 任务堆积 → OOM |
| **有界队列** (ArrayBlockingQueue) | maxPoolSize 生效，队列满创建非核心线程 | 拒绝策略未配 → 默认 AbortPolicy 抛异常 |
| **同步移交** (SynchronousQueue) | 无缓冲，直接移交线程，maxPoolSize 关键 | 核心池设为 0 → 频繁创建销毁线程 |

### 推荐配置模板

```java
// CPU 密集型：计算、编码、加密、压缩
static ThreadPoolExecutor cpuPool() {
    int n = Runtime.getRuntime().availableProcessors();
    return new ThreadPoolExecutor(
        n, n, 0L, TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(1024),  // 有界，防堆积
        namedFactory("cpu-pool"),
        new ThreadPoolExecutor.CallerRunsPolicy()  // 背压传导给调用方
    );
}

// IO 密集型：HTTP、DB、RPC、文件
static ThreadPoolExecutor ioPool() {
    int n = Runtime.getRuntime().availableProcessors();
    return new ThreadPoolExecutor(
        n, n * 4, 60L, TimeUnit.SECONDS,
        new LinkedBlockingQueue<>(4096),  // 可大一些吸收突发
        namedFactory("io-pool"),
        new ThreadPoolExecutor.AbortPolicy()  // 明确失败，上层熔断
    );
}

// 定时/周期任务：ScheduledThreadPoolExecutor
static ScheduledExecutorService scheduledPool() {
    return new ScheduledThreadPoolExecutor(
        4, namedFactory("scheduler"),
        new ThreadPoolExecutor.DiscardOldestPolicy()  // 定时任务允许丢弃旧的
    );
}

// 线程工厂最佳实践
static ThreadFactory namedFactory(String prefix) {
    return new ThreadFactoryBuilder()
        .setNameFormat(prefix + "-%d")
        .setDaemon(false)
        .setPriority(Thread.NORM_PRIORITY)
        .setUncaughtExceptionHandler((t, e) -> log.error("Thread {} error", t.getName(), e))
        .build();
}
```

## 进阶设计模式

### 1. 隔离池
```java
// 核心交易池：高优先级、小队列、快速失败
ExecutorService txPool = new ThreadPoolExecutor(
    16, 16, 0, TimeUnit.MILLISECONDS,
    new ArrayBlockingQueue<>(256),
    namedFactory("tx-core"),
    (r, e) -> { metrics.rejectTx(); throw new RejectedExecutionException(); }
);

// 后台批处理池：低优先级、大队列、允许堆积
ExecutorService batchPool = new ThreadPoolExecutor(
    4, 8, 300, TimeUnit.SECONDS,
    new LinkedBlockingQueue<>(10000),
    namedFactory("batch-low"),
    new ThreadPoolExecutor.CallerRunsPolicy()
);
```

### 2. 动态调整
```java
// 根据队列积压动态扩缩容
class AdaptivePool extends ThreadPoolExecutor {
    private final MetricRegistry metrics;
    
    @Override
    protected void afterExecute(Runnable r, Throwable t) {
        super.afterExecute(r, t);
        int queueSize = getQueue().size();
        int active = getActiveCount();
        if (queueSize > 1000 && active < getMaximumPoolSize()) {
            setCorePoolSize(Math.min(getCorePoolSize() + 2, getMaximumPoolSize()));
        } else if (queueSize < 100 && active > getCorePoolSize()) {
            setCorePoolSize(Math.max(getCorePoolSize() - 1, 4));
        }
        metrics.gauge("pool.core", getCorePoolSize());
        metrics.gauge("pool.queue", queueSize);
    }
}
```

### 3. 优先级任务队列
```java
// PriorityBlockingQueue + 自定义 Comparator
class PriorityTask implements Runnable, Comparable<PriorityTask> {
    final Priority priority;
    final Runnable task;
    final long submitTime;  // 同优先级 FIFO

    @Override public int compareTo(PriorityTask o) {
        int c = o.priority.compareTo(this.priority);  // 高优先级先执行
        return c != 0 ? c : Long.compare(submitTime, o.submitTime);
    }
}
```

### 4. 继承上下文
```java
// MDC / TraceID / SecurityContext 传递
// 注意：MDC.setContextMap 返回 void（不能当 try-with-resources 资源），
// 备份/恢复需手工配对，放在 finally 里
class ContextAwareExecutor extends ThreadPoolExecutor {
    @Override
    public void execute(Runnable command) {
        Map<String, String> ctx = MDC.getCopyOfContextMap();
        super.execute(() -> {
            Map<String, String> backup = MDC.getCopyOfContextMap();
            if (ctx != null) MDC.setContextMap(ctx);
            else MDC.clear();
            try {
                command.run();
            } finally {
                if (backup != null) MDC.setContextMap(backup);
                else MDC.clear();
            }
        });
    }
}
```

## Go Worker Pool 模式

关闭语义是这类池最容易写错的地方：**不要 close 任务队列**。`close` 与并发的 `ch <- task` 之间没有同步手段，一旦竞态就是 panic: send on closed channel。正确做法是用 `closed` 标志（锁保护）+ `context` 取消来广播停机，队列自始至终不关闭：

```go
type WorkerPool struct {
    workers int
    queue   chan Task
    wg      sync.WaitGroup
    ctx     context.Context
    cancel  context.CancelFunc
    mu      sync.RWMutex // 保护 closed，杜绝「关闭后再 Submit」panic
    closed  bool
}

func NewWorkerPool(workers, queueSize int) *WorkerPool {
    ctx, cancel := context.WithCancel(context.Background())
    return &WorkerPool{
        workers: workers,
        queue:   make(chan Task, queueSize),
        ctx:     ctx,
        cancel:  cancel,
    }
}

func (p *WorkerPool) Start() {
    for i := 0; i < p.workers; i++ {
        p.wg.Add(1)
        go func(id int) {
            defer p.wg.Done()
            for {
                select {
                case task := <-p.queue:
                    task.Execute()
                case <-p.ctx.Done():
                    // 优雅收尾：把已入队的任务排空再退出（非阻塞排空）
                    for {
                        select {
                        case task := <-p.queue:
                            task.Execute()
                        default:
                            return
                        }
                    }
                }
            }
        }(i)
    }
}

func (p *WorkerPool) Submit(task Task) error {
    p.mu.RLock()
    defer p.mu.RUnlock()
    if p.closed {
        return ErrPoolClosed
    }
    select {
    case p.queue <- task:
        return nil
    case <-p.ctx.Done():
        return ErrPoolClosed
    default:
        return ErrQueueFull // 非阻塞拒绝
    }
}

func (p *WorkerPool) Shutdown(timeout time.Duration) error {
    p.mu.Lock()
    p.closed = true // 先挡住新 Submit，再取消，杜绝 close/send 竞态
    p.mu.Unlock()
    p.cancel() // 广播停机：worker 排空队列后退出
    done := make(chan struct{})
    go func() { p.wg.Wait(); close(done) }()
    select {
    case <-done:
        return nil
    case <-time.After(timeout):
        return ErrShutdownTimeout // goroutine 无法强杀，只能超时上报
    }
}
```

要点：`Submit` 持读锁期间 `Shutdown` 的写锁会等在途提交完成，二者不可能交错；worker 收到取消后先排空队列再退出，保证已接受的任务不丢。

## Rust 线程池

```rust
// 使用 rayon (数据并行) 或 tokio (异步任务)
// rayon: 计算密集、fork-join
use rayon::ThreadPoolBuilder;
let pool = ThreadPoolBuilder::new()
    .num_threads(num_cpus::get())
    .thread_name(|i| format!("rayon-{}", i))
    .build()?;
pool.install(|| {
    data.par_iter().for_each(|x| heavy_compute(x));
});

// tokio: IO 密集、异步任务
let rt = tokio::runtime::Builder::new_multi_thread()
    .worker_threads(num_cpus::get())
    .thread_name("tokio-worker")
    .enable_all()
    .build()?;
rt.spawn(async { ... });
```

## 监控指标仪表盘

| 指标 | 含义 | 告警阈值 |
|------|------|----------|
| `pool.active` | 活跃线程数 | > 80% maxPoolSize |
| `pool.queue.size` | 积压任务数 | > 80% queueCapacity |
| `pool.completed.total` | 完成总数 | 速率突变 |
| `pool.rejected.total` | 拒绝总数 | > 0 (任何拒绝即告警) |
| `pool.thread.created` | 创建线程数 | 频繁创建销毁 |
| `task.latency.p99` | 任务执行延迟 | > SLA |
| `task.wait.latency` | 队列等待延迟 | > 100ms |

## 优雅关闭协议

```java
void gracefulShutdown(ThreadPoolExecutor pool, Duration timeout) {
    pool.shutdown();  // 拒绝新任务，处理完队列
    try {
        if (!pool.awaitTermination(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
            List<Runnable> remaining = pool.shutdownNow();  // 中断执行中、清空队列
            log.warn("Pool forced shutdown, {} tasks discarded", remaining.size());
            // 可选：持久化剩余任务、补偿处理
        }
    } catch (InterruptedException e) {
        pool.shutdownNow();
        Thread.currentThread().interrupt();
    }
}
```

## 容器化环境陷阱

| 陷阱 | 现象 | 修正 |
|------|------|------|
| **容器 CPU 限额 < 宿主机核数** | `availableProcessors()` 返回宿主机核数，线程过多争抢 | `-XX:+UseContainerSupport` (JDK 10+ 默认开) / `-XX:ActiveProcessorCount=4` |
| **cgroups v2 CPU quota** | CPU throttling 导致延迟抖动 | 监控 `cpu.throttled_us`、调整 quota/period |
| **内存限额 < 堆 + 线程栈** | OOM Killer 杀进程 | `-Xmx` + `-XX:ThreadStackSize=256k` × 最大线程数 < Memory Limit |

## 本章小结

线程池设计黄金法则：
1. **分类隔离**：CPU/IO/定时/核心/后台分池
2. **有界队列**：无界 = 定时炸弹，拒绝策略显式化
3. **可观测**：命名、指标、日志、追踪上下文传递
4. **优雅停机**：shutdown → awaitTermination → shutdownNow → 补偿
5. **容器感知**：`ActiveProcessorCount`、cgroups 监控

下一章讲解**并发框架选型**——从库到架构的决策地图。Reactor 事件驱动结构里，耗时业务逻辑下沉的目标就是线程池，见 [Reactor 与事件驱动](./reactor.md)。

## 本章来源

- 《Java Concurrency in Practice》任务执行与线程池章，对应关系见[权威书籍调研](../research/books.md)
- ThreadPoolExecutor 参数与拒绝策略语义以 [JDK 文档](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html)为准
