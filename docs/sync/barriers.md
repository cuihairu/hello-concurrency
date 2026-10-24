# Barriers

A barrier is a synchronization primitive that makes a group of threads **gather and wait** at a synchronization point, then **continue together** once all threads have arrived. It suits phased parallel computation, iterative algorithms, and multi-stage pipelines.

## Core concepts

### Definition
A barrier maintains an **arrival counter** and a **generation**. A thread calling `await()` blocks; when the counter reaches N:
1. Wake all waiting threads
2. Reset the counter
3. Increment the generation (distinguishing new rounds from old ones)

### The two basic types
| Type | Characteristics | Use case |
|------|------|----------|
| **CyclicBarrier** | Reusable, resets automatically | Iterative computation, periodic synchronization |
| **CountDownLatch** | Single use, cannot be reset | Startup waiting, shutdown confirmation, one-time join |

## CyclicBarrier

### Java implementation
```java
CyclicBarrier barrier = new CyclicBarrier(N, () -> {
    // optional: a barrier action run after all threads arrive, before release
    mergePartialResults();
});

void worker() {
    while (!done) {
        computePartial();
        barrier.await();  // wait for all threads to finish this round
        // all threads release together and enter the next round
    }
}
```

### Core methods
| Method | Semantics |
|------|------|
| `await()` | Blocks until the barrier opens, returning the arrival index |
| `await(timeout, unit)` | Returns on timeout, throwing TimeoutException |
| `reset()` | Breaks the barrier, resets the counter; waiting threads throw BrokenBarrierException |
| `getNumberWaiting()` | Number of threads currently waiting |
| `isBroken()` | Whether the barrier is in a broken state |

### BrokenBarrierException
- When `reset()` is called
- When a waiting thread is interrupted
- On timeout
- **Handling**: catch the exception → clean up state → resynchronize or exit

## CountDownLatch

### Java implementation
```java
CountDownLatch startGate = new CountDownLatch(1);
CountDownLatch endGate = new CountDownLatch(N);

// the main thread is ready, start all worker threads
startGate.countDown();

// worker threads
startGate.await();  // wait for the start signal
doWork();
endGate.countDown();  // count down on completion

// the main thread waits for all to finish
endGate.await();
```

### Core methods
| Method | Semantics |
|------|------|
| `countDown()` | Decrement the counter by 1; wake all waiters when it reaches 0 |
| `await()` | Blocks until the counter is 0 |
| `await(timeout, unit)` | Returns a boolean on timeout |
| `getCount()` | Current count |

**Cannot be reset or reused**; it is one-shot synchronization.

## Comparison summary

| Dimension | CyclicBarrier | CountDownLatch |
|------|---------------|----------------|
| Reusable | Yes | No |
| Count direction | Incrementing (arrivals) | Decrementing (remaining) |
| Core action | `await()` to wait | `countDown()` to decrement + `await()` to wait |
| Barrier action | Supports a Runnable | Not supported |
| Typical scenario | Iterative parallelism, multi-stage pipelines | Startup synchronization, shutdown waiting, fan-in/fan-out |

## Phaser (JDK 7+)

A more flexible barrier, supporting **dynamic registration/deregistration**, a **hierarchical tree structure**, and **phase number management**.

```java
Phaser phaser = new Phaser(1);  // the main thread registers
for (int i = 0; i < N; i++) {
    phaser.register();  // dynamically register a worker thread
    new Thread(() -> {
        while (!done) {
            doPhase1();
            phaser.arriveAndAwaitAdvance();  // arrive and wait for the next phase
        }
        phaser.arriveAndDeregister();  // deregister on exit
    }).start();
}
// the main thread can also take part in synchronization
while (!done) {
    coordinate();
    phaser.arriveAndAwaitAdvance();
}
phaser.arriveAndDeregister();
```

### Key features
- **Dynamic members**: `register()` / `arriveAndDeregister()`
- **Hierarchical phaser**: a parent-child tree structure, reducing contention at the root
- **Phase number**: `getPhase()` increases monotonically, supporting waiting across phases
- **Arrival and waiting separated**: `arrive()` only arrives without waiting, `awaitAdvance(phase)` waits for a specific phase

## Language support comparison

| Language | CyclicBarrier | CountDownLatch | Phaser equivalent |
|------|---------------|----------------|-------------|
| Java | `java.util.concurrent.CyclicBarrier` | `CountDownLatch` | `Phaser` |
| C++20 | `std::barrier` / `std::latch` | `std::latch` | `std::barrier` (flexible template) |
| Go | `sync.WaitGroup` (reusable after counting to zero) / implemented with `sync.Cond` | `sync.WaitGroup` | No standard library, third party |
| Rust | `std::sync::Barrier` | No standard library | `tokio::sync::Barrier` |
| Python | `threading.Barrier` | No standard library | `asyncio.Barrier` |
| C# | `Barrier` | `CountdownEvent` | No direct equivalent |

### C++20 std::barrier / std::latch
```cpp
std::barrier<> barrier(N, []{ merge(); });  // reusable, with a completion function
std::latch latch(N);  // one-shot

// worker threads
barrier.arrive_and_wait();  // or latch.count_down(); latch.wait();
```

### Go sync.WaitGroup (reusable after counting to zero)
```go
var wg sync.WaitGroup
wg.Add(N)
for i := 0; i < N; i++ {
    go func() {
        defer wg.Done()
        work()
    }()
}
wg.Wait()  // wait for all to finish
```
> Unlike the "one-shot" nature of `CountDownLatch`/`std::latch`: after `Wait` returns and the count reaches zero, you can call `Add` again to reuse it (but you may not call `Add` concurrently with `Wait` while the count is non-zero, and you may not copy a `WaitGroup` in use).

## Typical application scenarios

### 1. Parallel iterative algorithms (PageRank, K-means, matrix multiplication)
```
loop:
  compute this round's delta in parallel
  barrier.await()  // synchronization point
  aggregate serially / check for convergence
  barrier.await()  // broadcast new parameters
```

### 2. Multi-stage pipeline
```
stage 1: read data → barrier
stage 2: preprocess → barrier
stage 3: model inference → barrier
stage 4: postprocess and write
```

### 3. Distributed consistency checkpoints
```
periodically:
  persist local state
  barrier.await()  // all nodes synchronize
  global consistency check
```

### 4. Testing concurrent scenarios
```java
// start N threads to run at the same time
CountDownLatch start = new CountDownLatch(1);
CountDownLatch end = new CountDownLatch(N);
for (int i = 0; i < N; i++) {
    executor.submit(() -> {
        start.await();
        testConcurrentAccess();
        end.countDown();
    });
}
start.countDown();
end.await();  // all done
```

## Performance considerations

### Contention hotspot
- All threads converge on the same barrier → cache line bouncing
- **Optimization**: hierarchical barriers (Phaser tree structure), local aggregation before global synchronization

### Load imbalance
- Fast threads wait for slow ones → efficiency = slowest thread / average thread
- **Optimization**: work stealing, dynamic task allocation, reducing synchronization frequency

### Alternatives
| Scenario | Barrier | Better alternative |
|------|------|----------|
| Pipeline | Barrier | Cascading Channel/BlockingQueue |
| Data parallelism | Barrier | ForkJoinPool, parallel streams, Rayon |
| Parameter server | Barrier | Async SGD, AllReduce (NCCL/MPI) |
| Microservice orchestration | Barrier | Saga, orchestration engine, event-driven |

## Chapter summary

| Primitive | Core semantics | Key choice |
|------|----------|----------|
| CyclicBarrier | All arrive, release together, reusable | Iterative parallelism, periodic synchronization |
| CountDownLatch | Triggers when the count hits zero, one-shot | Startup/shutdown synchronization, fan-in/fan-out |
| Phaser | Dynamic members, hierarchical, phase numbers | Complex dynamic concurrent orchestration |

A barrier makes **temporal coupling** explicit and is key infrastructure for engineering parallel algorithms. The related concurrency model pages include Actor, CSP, dataflow, STM, functional concurrency, and data parallelism, among other higher-level abstractions.

## Sources

- The behavior of CyclicBarrier, CountDownLatch, and Phaser follows the [JDK concurrency package documentation](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/package-summary.html)
- The counting and reuse semantics of Go's WaitGroup follow [pkg.go.dev/sync](https://pkg.go.dev/sync)

## References

- [Wikipedia · Barrier](https://en.wikipedia.org/wiki/Barrier_(computer_science))
- [OpenMP specification](https://www.openmp.org/specifications/)

<!-- BACKLINKS-AUTO -->
## Related pages

- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [frameworks](/practice/frameworks.md)
