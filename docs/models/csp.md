# CSP 模型

CSP (Communicating Sequential Processes) 由 Tony Hoare 1978 年提出，核心思想：**进程通过通道同步通信，不共享内存**。「Don't communicate by sharing memory; share memory by communicating.」—— Go 语言座右铭。

## 核心概念

### 进程
顺序执行的控制流，拥有私有状态。CSP 进程轻量，可数万并发。

### 通道
**同步、无缓冲、类型化** 的通信管道。发送方与接收方**会合**：
- 发送阻塞直到接收就绪
- 接收阻塞直到发送就绪
- **同步点 = 隐式屏障**，天然协调时序

### 选择
进程可同时在多个通道上等待，第一个就绪者胜出，实现非确定性选择。

## 代数定律 (Hoare)

| 定律 | 形式 | 含义 |
|------|------|------|
| 前缀 | `a → P` | 先做事件 a，再表现为 P |
| 选择 | `P □ Q` | 外部选择：环境决定执行 P 或 Q |
| 内部选择 | `P ⊓ Q` | 内部非确定选择 P 或 Q |
| 并行 | `P || Q` | 共享事件同步，其余交织 |
| 隐藏 | `P \ A` | 将事件集 A 变为内部 τ |
| 重命名 | `P [f]` | 事件按函数 f 重命名 |

**进程代数**支持形式化验证：死锁自由、活性、细化检查 (FDR 工具)。

## 经典模式

### 1. 管道
```
生产者 → [ch1] → 处理器 → [ch2] → 消费者
```
```go
func producer(out chan<- int) {
    for i := 0; i < 100; i++ { out <- i }
    close(out)
}
func processor(in <-chan int, out chan<- int) {
    for v := range in { out <- v * 2 }
}
func consumer(in <-chan int) {
    for v := range in { fmt.Println(v) }
}
```

### 2. 扇出/扇入
```go
// 扇出：把每个值分发给一个工作者（竞争消费，每值恰好被处理一次）
func fanOut(in <-chan int, workers int) []chan int {
    outs := make([]chan int, workers)
    for i := range outs { outs[i] = make(chan int) }
    go func() {
        i := 0
        for v := range in {
            outs[i%len(outs)] <- v // 轮询分发
            i++
        }
        for _, out := range outs { close(out) }
    }()
    return outs
}

// 对比：广播——每个值发给所有输出通道（每个订阅者都收到一份）
func broadcast(in <-chan int, subs int) []chan int {
    outs := make([]chan int, subs)
    for i := range outs { outs[i] = make(chan int) }
    go func() {
        for v := range in {
            for _, out := range outs { out <- v }
        }
        for _, out := range outs { close(out) }
    }()
    return outs
}

// 扇入：合并多通道
func fanIn(ins ...<-chan int) <-chan int {
    out := make(chan int)
    var wg sync.WaitGroup
    wg.Add(len(ins))
    for _, in := range ins {
        go func(c <-chan int) {
            for v := range c { out <- v }
            wg.Done()
        }(in)
    }
    go func() { wg.Wait(); close(out) }()
    return out
}
```

### 3. 工作池
```go
func workerPool(jobs <-chan Job, results chan<- Result, n int) {
    var wg sync.WaitGroup
    wg.Add(n)
    for i := 0; i < n; i++ {
        go func() {
            for job := range jobs { results <- process(job) }
            wg.Done()
        }()
    }
    go func() { wg.Wait(); close(results) }()
}
```

### 4. 超时与取消
```go
select {
case result := <-ch:
    return result
case <-time.After(5 * time.Second):
    return ErrTimeout
case <-ctx.Done():
    return ctx.Err()
}
```

### 5. 速率限制
```go
limiter := time.Tick(100 * time.Millisecond)
for req := range requests {
    <-limiter  // 令牌桶
    go handle(req)
}
```

## Go 语言实现细节

### 通道类型
| 类型 | 语法 | 特点 |
|------|------|------|
| 无缓冲 | `make(chan T)` | 同步会合、背压自动传导 |
| 有缓冲 | `make(chan T, N)` | 异步缓冲、解耦快慢、N=0 退化同步 |
| 单向 | `chan<- T` / `<-chan T` | 编译期约束方向、API 安全 |

### 关键操作
| 操作 | 语法 | 行为 |
|------|------|------|
| 发送 | `ch <- v` | 阻塞直到接收就绪 (无缓冲) 或有空槽 (有缓冲) |
| 接收 | `v := <-ch` | 阻塞直到有值；关闭通道返回零值 + `ok=false` |
| 关闭 | `close(ch)` | 仅发送方关闭；重复关闭 panic；发往关闭通道 panic |
| 选择 | `select { case ... }` | 多路复用、随机公平、可含 `default` 非阻塞 |
| 遍历 | `for v := range ch` | 直到通道关闭并耗尽 |

### 内存模型保证
**发送 happens-before 接收**：
```go
var x int
ch := make(chan struct{})
go func() { x = 1; ch <- struct{}{} }()
<-ch
println(x)  // 保证打印 1
```

## 进阶模式

### 管道取消传播
```go
func pipeline(ctx context.Context, in <-chan In) <-chan Out {
    out := make(chan Out)
    go func() {
        defer close(out)
        for {
            select {
            case v, ok := <-in:
                if !ok { return }
                out <- process(v)
            case <-ctx.Done():
                return  // 向上游传播取消
            }
        }
    }()
    return out
}
```

### 优雅关闭
```go
func gracefulShutdown(server *http.Server, sigs <-chan os.Signal) {
    <-sigs
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    server.Shutdown(ctx)  // 等待进行中请求完成
}
```

### 信号量模式 (有缓冲通道)
```go
sem := make(chan struct{}, MAX_CONCURRENT)
for _, task := range tasks {
    sem <- struct{}{}  // 获取许可
    go func(t Task) {
        defer func() { <-sem }()  // 释放许可
        doTask(t)
    }(task)
}
```

## 形式化验证

### FDR (Failures-Divergences Refinement)
- 输入：CSP 代数描述 (CSPM 语言)
- 检查：死锁自由、活锁自由、确定性、细化关系
- 应用：T9000 处理器、火星探测器、铁路信号系统

### Go 静态分析
- `go vet`：捕获部分误用模式（如复制含锁结构 `copylocks`、`context` 取消函数被丢弃 `lostcancel`）；**不能**检测通道死锁、负缓冲、关闭已关闭通道——这类问题没有可靠的静态检查保证
- `go test -race`：动态竞态检测（需要测试真正触发竞态路径）
- `staticcheck` / `golangci-lint`：更广的静态可疑模式检查
- 通道死锁/重复关闭主要靠运行时暴露：重复关闭直接 panic，死锁用 goroutine dump（`SIGQUIT` 或 pprof `/debug/pprof/goroutine`）定位

## CSP vs Actor 对比

| 维度 | CSP (Go) | Actor (Erlang/Akka) |
|------|----------|---------------------|
| 通信实体 | 通道 (一等公民) | Actor 引用 |
| 同步性 | 同步会合 (无缓冲) | 异步投递 |
| 选择机制 | `select` 多路复用 | 模式匹配单邮箱 |
| 网络透明 | 需额外框架 (gRPC) | 原生位置透明 |
| 容错模型 | 显式错误传递 | 监管树、自动重启 |
| 类型系统 | 通道类型化 | 消息类型松散 |
| 形式化验证 | CSP 代数、FDR | 难度大 |

## 适用场景

| 适合 | 不适合 |
|------|--------|
| 管道流、流水线、流处理 | 复杂状态机、长生命周期实体 |
| 高并发 I/O、微服务网关 | 需分布式透明、热升级场景 |
| 显式取消、超时控制 | 需自动故障恢复、监管 |
| 团队熟悉 Go/类 C 语法 | 团队偏好 JVM/函数式生态 |

## 本章小结

CSP 以**通道同步通信**替代共享内存，将并发协调显式化为数据流拓扑。Go 将 CSP 工程化为语言内置特性，配合 `select`、`context`、单向通道，成为云原生时代并发编程的主流范式。核心心法：**用通道传递所有权，而非共享锁保护数据**。下一章讲解数据流模型——声明式并行计算图。通道适合编排流程；数据分片各自独立、每片跑同一段逻辑时，[数据并行](./data-parallel.md)才是主场。

## 本章来源

- 《七周七并发模型》第 6 章通信顺序进程，版本信息见[权威书籍调研](../research/books.md)
- 原始理论出处为 C. A. R. Hoare, *Communicating Sequential Processes*, CACM 1978；Go 侧语义以 [Go 官方文档](https://go.dev/doc/)与语言规范为准
- 示例代码现写，不抄书