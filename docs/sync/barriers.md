# 屏障

屏障是让一组线程在某个同步点**集合等待**，直到所有线程到达后再**同时继续**的同步原语。适用于分阶段并行计算、迭代算法、多阶段流水线。

## 核心概念

### 定义
屏障维护一个**到达计数器**和**代数**，线程调用 `await()` 阻塞，计数器达 N 时：
1. 唤醒所有等待线程
2. 重置计数器
3. 代数 +1（区分新旧轮次）

### 两种基本类型
| 类型 | 特点 | 适用场景 |
|------|------|----------|
| **CyclicBarrier** | 可重复使用，自动重置 | 迭代计算、周期性同步 |
| **CountDownLatch** | 单次使用，不可重置 | 启动等待、关闭确认、一次性汇聚 |

## CyclicBarrier（循环屏障）

### Java 实现
```java
CyclicBarrier barrier = new CyclicBarrier(N, () -> {
    // 可选：所有线程到达后、释放前执行的屏障动作
    mergePartialResults();
});

void worker() {
    while (!done) {
        computePartial();
        barrier.await();  // 等待所有线程完成本轮
        // 所有线程同步释放，进入下一轮
    }
}
```

### 核心方法
| 方法 | 语义 |
|------|------|
| `await()` | 阻塞至屏障打开，返回到达索引 |
| `await(timeout, unit)` | 超时返回，抛出 TimeoutException |
| `reset()` | 打破屏障，重置计数器，已等待线程抛 BrokenBarrierException |
| `getNumberWaiting()` | 当前等待线程数 |
| `isBroken()` | 是否处于打破状态 |

### BrokenBarrierException
- `reset()` 调用时
- 等待线程被中断
- 超时
- **处理**：捕获异常 → 清理状态 → 重新同步或退出

## CountDownLatch（倒计时门闩）

### Java 实现
```java
CountDownLatch startGate = new CountDownLatch(1);
CountDownLatch endGate = new CountDownLatch(N);

// 主线程准备就绪，开启所有工作线程
startGate.countDown();

// 工作线程
startGate.await();  // 等待开启信号
doWork();
endGate.countDown();  // 完成计数

// 主线程等待全部完成
endGate.await();
```

### 核心方法
| 方法 | 语义 |
|------|------|
| `countDown()` | 计数器 -1，为 0 时唤醒所有等待者 |
| `await()` | 阻塞至计数器为 0 |
| `await(timeout, unit)` | 超时返回 boolean |
| `getCount()` | 当前计数 |

**不可重置、不可复用**，一次性同步。

## 对比总结

| 维度 | CyclicBarrier | CountDownLatch |
|------|---------------|----------------|
| 可重用 | 是 | 否 |
| 计数方向 | 递增（到达数） | 递减（剩余数） |
| 核心动作 | `await()` 等待 | `countDown()` 递减 + `await()` 等待 |
| 屏障动作 | 支持 Runnable | 不支持 |
| 典型场景 | 迭代并行、多阶段流水线 | 启动同步、关闭等待、分发汇聚 |

## Phaser（阶段器，JDK 7+）

更灵活的屏障，支持**动态注册/注销**、**分层树结构**、**阶段号管理**。

```java
Phaser phaser = new Phaser(1);  // 主线程注册
for (int i = 0; i < N; i++) {
    phaser.register();  // 动态注册工作线程
    new Thread(() -> {
        while (!done) {
            doPhase1();
            phaser.arriveAndAwaitAdvance();  // 到达并等待下阶段
        }
        phaser.arriveAndDeregister();  // 退出注销
    }).start();
}
// 主线程也可参与同步
while (!done) {
    coordinate();
    phaser.arriveAndAwaitAdvance();
}
phaser.arriveAndDeregister();
```

### 关键特性
- **动态成员**：`register()` / `arriveAndDeregister()`
- **分层 Phaser**：父子树结构，减少根节点竞争
- **阶段号**：`getPhase()` 单调递增，支持跨阶段等待
- **到达与等待分离**：`arrive()` 仅到达不等待，`awaitAdvance(phase)` 等待特定阶段

## 语言支持对照

| 语言 | CyclicBarrier | CountDownLatch | Phaser 等价 |
|------|---------------|----------------|-------------|
| Java | `java.util.concurrent.CyclicBarrier` | `CountDownLatch` | `Phaser` |
| C++20 | `std::barrier` / `std::latch` | `std::latch` | `std::barrier` (灵活模板) |
| Go | `sync.WaitGroup`（计数到零后可复用）/ `sync.Cond` 实现 | `sync.WaitGroup` | 无标准库，第三方 |
| Rust | `std::sync::Barrier` | 无标准库 | `tokio::sync::Barrier` |
| Python | `threading.Barrier` | 无标准库 | `asyncio.Barrier` |
| C# | `Barrier` | `CountdownEvent` | 无直接等价 |

### C++20 std::barrier / std::latch
```cpp
std::barrier<> barrier(N, []{ merge(); });  // 可重用，带完成函数
std::latch latch(N);  // 单次

// 工作线程
barrier.arrive_and_wait();  // 或 latch.count_down(); latch.wait();
```

### Go sync.WaitGroup（计数归零后可复用）
```go
var wg sync.WaitGroup
wg.Add(N)
for i := 0; i < N; i++ {
    go func() {
        defer wg.Done()
        work()
    }()
}
wg.Wait()  // 等待所有完成
```
> 与 `CountDownLatch`/`std::latch` 的「一次性」不同：`Wait` 返回、计数归零后可再次 `Add` 复用（但禁止在计数未归零时并发 `Add` 与 `Wait`，且禁止复制使用中的 `WaitGroup`）。

## 典型应用场景

### 1. 并行迭代算法（PageRank、K-means、矩阵乘法）
```
循环:
  并行计算本轮增量
  barrier.await()  // 同步点
  串行聚合/判断收敛
  barrier.await()  // 广播新参数
```

### 2. 多阶段流水线
```
阶段 1: 读取数据 → barrier
阶段 2: 预处理 → barrier
阶段 3: 模型推理 → barrier
阶段 4: 后处理写入
```

### 3. 分布式一致性检查点
```
定期:
  本地状态持久化
  barrier.await()  // 所有节点同步
  全局一致性校验
```

### 4. 测试并发场景
```java
// 并发启动 N 个线程同时执行
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
end.await();  // 全部完成
```

## 性能考量

### 争用热点
- 所有线程汇聚同一屏障 → 缓存行抖动
- **优化**：分层屏障（Phaser 树结构）、本地聚合后再全局同步

### 负载不均
- 快线程等待慢线程 → 效率 = 最慢线程 / 平均线程
- **优化**：工作窃取、动态任务分配、减少同步频率

### 替代方案
| 场景 | 屏障 | 更优替代 |
|------|------|----------|
| 流水线 | 屏障 | Channel/BlockingQueue 级联 |
| 数据并行 | 屏障 | ForkJoinPool、并行流、Rayon |
| 参数服务器 | 屏障 | 异步 SGD、AllReduce (NCCL/MPI) |
| 微服务编排 | 屏障 | Saga、编排引擎、事件驱动 |

## 本章小结

| 原语 | 核心语义 | 关键选择 |
|------|----------|----------|
| CyclicBarrier | 全员到达同步释放，可重用 | 迭代并行、周期同步 |
| CountDownLatch | 计数归零触发，一次性 | 启动/关闭同步、分发汇聚 |
| Phaser | 动态成员、分层、阶段号 | 复杂动态并发编排 |

屏障将**时序耦合**显式化，是并行算法工程化的关键基建。下一章进入并发模型篇，讲解 Actor、CSP、数据流、STM 等高层抽象。