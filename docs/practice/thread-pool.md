# Thread Pool Design

A thread pool is the **resource management hub** of a concurrent program: it reuses threads, controls concurrency, isolates business logic, and provides monitoring hooks. A well-designed thread pool is the foundation of system stability.

This page focuses on queue capacity, thread expansion, and rejection policy in thread pool implementations; general buffering and backpressure strategies are on the [producer-consumer](./producer-consumer.md) page, and event loop watermarks are on the [Reactor](./reactor.md) page.

## Core components

```
Task submission -> [Work queue] -> Worker thread group -> Execute task
                ^           ^
           Rejection policy  Thread factory / lifecycle
```

| Component | Responsibility | Key decision |
|------|------|----------|
| **Core pool size** | Resident threads, not reclaimed when idle | CPU-intensive = core count; IO-intensive = 2x core count |
| **Max pool size** | Peak concurrency ceiling | Effective only with a bounded queue; never triggered with an unbounded queue |
| **Work queue** | Task buffering, backpressure | Bounded/unbounded, fair/priority, coordinated with rejection policy |
| **Thread factory** | Naming, priority, daemon, context | Observability, isolation |
| **Rejection policy** | Handling when queue + threads are full | Abort/Discard/CallerRuns/Custom |
| **Keep-alive time** | Idle reclamation of non-core threads | Avoid thread leaks, adapt to load fluctuations |

## Java ThreadPoolExecutor fully analyzed

### Execution flow
```java
public void execute(Runnable command) {
    int c = ctl.get();
    if (workerCount < corePoolSize) {           // 1. Core pool not full -> create a core thread
        if (addWorker(command, true)) return;
    }
    if (isRunning() && workQueue.offer(command)) { // 2. Enqueue succeeded
        if (!isRunning() || workerCount == 0)   // Double check
            ensureQueuedTaskHandled(command);
    } else if (!addWorker(command, false)) {    // 3. Non-core pool not full -> create a non-core thread
        reject(command);                         // 4. Everything full -> reject
    }
}
```

### Key parameter combination pitfalls

| Queue type | core/max effect | Typical misuse |
|----------|---------------|----------|
| **Unbounded queue** (LinkedBlockingQueue) | maxPoolSize **never takes effect**, only corePoolSize works | Tasks pile up -> OOM |
| **Bounded queue** (ArrayBlockingQueue) | maxPoolSize takes effect, non-core threads created when queue is full | No rejection policy configured -> default AbortPolicy throws an exception |
| **Synchronous handoff** (SynchronousQueue) | No buffering, handoff directly to a thread, maxPoolSize is critical | Core pool set to 0 -> frequent thread creation/destruction |

### Recommended configuration templates

```java
// CPU-intensive: compute, encode, encrypt, compress
static ThreadPoolExecutor cpuPool() {
    int n = Runtime.getRuntime().availableProcessors();
    return new ThreadPoolExecutor(
        n, n, 0L, TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(1024),  // Bounded, prevents pile-up
        namedFactory("cpu-pool"),
        new ThreadPoolExecutor.CallerRunsPolicy()  // Propagate backpressure to the caller
    );
}

// IO-intensive: HTTP, DB, RPC, file
static ThreadPoolExecutor ioPool() {
    int n = Runtime.getRuntime().availableProcessors();
    return new ThreadPoolExecutor(
        n, n * 4, 60L, TimeUnit.SECONDS,
        new LinkedBlockingQueue<>(4096),  // Can be larger to absorb bursts
        namedFactory("io-pool"),
        new ThreadPoolExecutor.AbortPolicy()  // Fail explicitly, upper layer circuit-breaks
    );
}

// Scheduled/periodic tasks: ScheduledThreadPoolExecutor
static ScheduledExecutorService scheduledPool() {
    return new ScheduledThreadPoolExecutor(
        4, namedFactory("scheduler"),
        new ThreadPoolExecutor.DiscardOldestPolicy()  // Scheduled tasks may drop old ones
    );
}

// Thread factory best practices
static ThreadFactory namedFactory(String prefix) {
    return new ThreadFactoryBuilder()
        .setNameFormat(prefix + "-%d")
        .setDaemon(false)
        .setPriority(Thread.NORM_PRIORITY)
        .setUncaughtExceptionHandler((t, e) -> log.error("Thread {} error", t.getName(), e))
        .build();
}
```

## Advanced design patterns

### 1. Isolated pools
```java
// Core transaction pool: high priority, small queue, fast failure
ExecutorService txPool = new ThreadPoolExecutor(
    16, 16, 0, TimeUnit.MILLISECONDS,
    new ArrayBlockingQueue<>(256),
    namedFactory("tx-core"),
    (r, e) -> { metrics.rejectTx(); throw new RejectedExecutionException(); }
);

// Background batch pool: low priority, large queue, pile-up allowed
ExecutorService batchPool = new ThreadPoolExecutor(
    4, 8, 300, TimeUnit.SECONDS,
    new LinkedBlockingQueue<>(10000),
    namedFactory("batch-low"),
    new ThreadPoolExecutor.CallerRunsPolicy()
);
```

### 2. Dynamic adjustment
```java
// Dynamically scale based on queue backlog
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

### 3. Priority task queue
```java
// PriorityBlockingQueue + custom Comparator
class PriorityTask implements Runnable, Comparable<PriorityTask> {
    final Priority priority;
    final Runnable task;
    final long submitTime;  // FIFO within the same priority

    @Override public int compareTo(PriorityTask o) {
        int c = o.priority.compareTo(this.priority);  // Higher priority executes first
        return c != 0 ? c : Long.compare(submitTime, o.submitTime);
    }
}
```

### 4. Context inheritance
```java
// MDC / TraceID / SecurityContext propagation
// Note: MDC.setContextMap returns void (cannot be used as a try-with-resources resource),
// backup/restore must be paired manually, placed in finally
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

## Go Worker Pool pattern

Shutdown semantics are the easiest thing to get wrong in this kind of pool: **do not close the task queue**. `close` and a concurrent `ch <- task` have no synchronization point; if they race it is `panic: send on closed channel`. The correct approach is a `closed` flag (protected by a lock) plus `context` cancellation to broadcast shutdown, and the queue is never closed:

```go
type WorkerPool struct {
    workers int
    queue   chan Task
    wg      sync.WaitGroup
    ctx     context.Context
    cancel  context.CancelFunc
    mu      sync.RWMutex // Protects closed, eliminates the "Submit after close" panic
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
                    // Graceful drain: empty already-enqueued tasks before exiting (non-blocking drain)
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
        return ErrQueueFull // Non-blocking rejection
    }
}

func (p *WorkerPool) Shutdown(timeout time.Duration) error {
    p.mu.Lock()
    p.closed = true // Block new Submit first, then cancel, eliminating the close/send race
    p.mu.Unlock()
    p.cancel() // Broadcast shutdown: workers drain the queue then exit
    done := make(chan struct{})
    go func() { p.wg.Wait(); close(done) }()
    select {
    case <-done:
        return nil
    case <-time.After(timeout):
        return ErrShutdownTimeout // Goroutines cannot be force-killed, only a timeout can be reported
    }
}
```

Key points: while `Submit` holds the read lock, `Shutdown`'s write lock waits for in-flight submissions to complete, so the two cannot interleave; after a worker receives cancellation it drains the queue before exiting, guaranteeing accepted tasks are not lost.

## Rust thread pools

```rust
// Using rayon (data parallelism) or tokio (async tasks)
// rayon: compute-intensive, fork-join
use rayon::ThreadPoolBuilder;
let pool = ThreadPoolBuilder::new()
    .num_threads(num_cpus::get())
    .thread_name(|i| format!("rayon-{}", i))
    .build()?;
pool.install(|| {
    data.par_iter().for_each(|x| heavy_compute(x));
});

// tokio: IO-intensive, async tasks
let rt = tokio::runtime::Builder::new_multi_thread()
    .worker_threads(num_cpus::get())
    .thread_name("tokio-worker")
    .enable_all()
    .build()?;
rt.spawn(async { ... });
```

## Monitoring dashboard

| Metric | Meaning | Alert threshold |
|------|------|----------|
| `pool.active` | Active thread count | > 80% of maxPoolSize |
| `pool.queue.size` | Backlogged task count | > 80% of queueCapacity |
| `pool.completed.total` | Total completed | Sudden rate change |
| `pool.rejected.total` | Total rejected | > 0 (any rejection alerts) |
| `pool.thread.created` | Threads created | Frequent creation/destruction |
| `task.latency.p99` | Task execution latency | > SLA |
| `task.wait.latency` | Queue wait latency | > 100ms |

## Graceful shutdown protocol

```java
void gracefulShutdown(ThreadPoolExecutor pool, Duration timeout) {
    pool.shutdown();  // Reject new tasks, process the queue
    try {
        if (!pool.awaitTermination(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
            List<Runnable> remaining = pool.shutdownNow();  // Interrupt in-flight, clear the queue
            log.warn("Pool forced shutdown, {} tasks discarded", remaining.size());
            // Optional: persist remaining tasks, compensating handling
        }
    } catch (InterruptedException e) {
        pool.shutdownNow();
        Thread.currentThread().interrupt();
    }
}
```

## Containerized environment pitfalls

| Pitfall | Symptom | Fix |
|------|------|------|
| **Container CPU limit < host core count** | `availableProcessors()` returns host core count, too many threads contend | `-XX:+UseContainerSupport` (default on JDK 10+) / `-XX:ActiveProcessorCount=4` |
| **cgroups v2 CPU quota** | CPU throttling causes latency jitter | Monitor `cpu.throttled_us`, adjust quota/period |
| **Memory limit < heap + thread stacks** | OOM Killer terminates the process | `-Xmx` + `-XX:ThreadStackSize=256k` x max threads < Memory Limit |

## Chapter summary

Golden rules for thread pool design:
1. **Categorize and isolate**: separate pools for CPU/IO/scheduled/core/background
2. **Bounded queues**: unbounded = time bomb, make rejection policy explicit
3. **Observable**: naming, metrics, logging, trace context propagation
4. **Graceful shutdown**: shutdown -> awaitTermination -> shutdownNow -> compensate
5. **Container-aware**: `ActiveProcessorCount`, cgroups monitoring

See also the related page **concurrency framework selection** -- the decision map from libraries to architecture. In the Reactor event-driven structure, the target for sinking time-consuming business logic is a thread pool, see [Reactor and event-driven](./reactor.md).

## Sources

- Task execution and thread pool chapter of *Java Concurrency in Practice*; see the correspondence on the [authoritative book survey](../research/books.md) page
- ThreadPoolExecutor parameters and rejection policy semantics per [JDK documentation](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html)

## References

- [Wikipedia: Thread pool](https://en.wikipedia.org/wiki/Thread_pool)
- [Java concurrent utilities (Executor)](https://docs.oracle.com/en/java/javase/21/api/java.base/java/util/concurrent/package-summary.html)
- [Wikipedia: Work stealing](https://en.wikipedia.org/wiki/Work_stealing)
- [Wikipedia: Fork/join](https://en.wikipedia.org/wiki/Fork%E2%80%93join_model)

<!-- BACKLINKS-AUTO -->
## Related pages

- [languages](/advanced/languages.md)
- [os](/advanced/os.md)
- [security](/advanced/security.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [functional](/models/functional.md)
- [async](async.md)
- [frameworks](frameworks.md)
- [reactor](reactor.md)
- [seven-weeks](seven-weeks.md)
- [applications](/research/applications.md)
