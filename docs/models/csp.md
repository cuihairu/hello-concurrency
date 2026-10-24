# CSP Model

CSP (Communicating Sequential Processes) was proposed by Tony Hoare in 1978. Core idea: **processes communicate synchronously through channels, with no shared memory**. "Don't communicate by sharing memory; share memory by communicating." — Go's motto.

## Core concepts

### Processes
Sequential control flow with private state. CSP processes are lightweight; tens of thousands can run concurrently.

### Channels
A communication pipe that is **synchronous, unbuffered, and typed**. Sender and receiver **meet**:
- Send blocks until a receiver is ready
- Receive blocks until a send is ready
- **The synchronization point is an implicit barrier**, coordinating timing naturally

### Selection
A process can wait on multiple channels simultaneously; the first to become ready wins, implementing nondeterministic choice.

## Algebraic laws (Hoare)

| Law | Form | Meaning |
|------|------|------|
| Prefix | `a → P` | Perform event a first, then behave as P |
| Choice | `P □ Q` | External choice: the environment decides P or Q |
| Internal choice | `P ⊓ Q` | Internal nondeterministic choice of P or Q |
| Parallel | `P || Q` | Shared events synchronize; the rest interleave |
| Hide | `P \ A` | Make event set A internal τ |
| Rename | `P [f]` | Rename events by function f |

**Process algebra** supports formal verification: deadlock freedom, liveness, refinement checking (FDR tool).

## Classic patterns

### 1. Pipe
```
producer → [ch1] → processor → [ch2] → consumer
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

### 2. Fan-out / fan-in
```go
// Fan-out: dispatch each value to a worker (competing consumption; each value handled exactly once)
func fanOut(in <-chan int, workers int) []chan int {
    outs := make([]chan int, workers)
    for i := range outs { outs[i] = make(chan int) }
    go func() {
        i := 0
        for v := range in {
            outs[i%len(outs)] <- v // round-robin dispatch
            i++
        }
        for _, out := range outs { close(out) }
    }()
    return outs
}

// Contrast: broadcast — send each value to every output channel (each subscriber gets a copy)
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

// Fan-in: merge multiple channels
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

### 3. Worker pool
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

### 4. Timeout and cancellation
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

### 5. Rate limiting
```go
limiter := time.Tick(100 * time.Millisecond)
for req := range requests {
    <-limiter  // token bucket
    go handle(req)
}
```

## Go implementation details

### Channel types
| Type | Syntax | Character |
|------|------|------|
| Unbuffered | `make(chan T)` | synchronous rendezvous, backpressure propagates automatically |
| Buffered | `make(chan T, N)` | asynchronous buffering, decouples fast/slow, N=0 degrades to synchronous |
| Unidirectional | `chan<- T` / `<-chan T` | compile-time direction constraint, API safety |

### Key operations
| Operation | Syntax | Behavior |
|------|------|------|
| Send | `ch <- v` | blocks until a receiver is ready (unbuffered) or a slot is free (buffered) |
| Receive | `v := <-ch` | blocks until a value is available; a closed channel returns the zero value + `ok=false` |
| Close | `close(ch)` | only the sender closes; closing twice panics; sending to a closed channel panics |
| Select | `select { case ... }` | multiplexing, random fair scheduling, may include `default` for non-blocking |
| Range | `for v := range ch` | until the channel is closed and drained |

### Memory model guarantee
**Send happens-before receive**:
```go
var x int
ch := make(chan struct{})
go func() { x = 1; ch <- struct{}{} }()
<-ch
println(x)  // guaranteed to print 1
```

## Advanced patterns

### Pipeline cancellation propagation
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
                return  // propagate cancellation upstream
            }
        }
    }()
    return out
}
```

### Graceful shutdown
```go
func gracefulShutdown(server *http.Server, sigs <-chan os.Signal) {
    <-sigs
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    server.Shutdown(ctx)  // wait for in-flight requests to finish
}
```

### Semaphore pattern (buffered channel)
```go
sem := make(chan struct{}, MAX_CONCURRENT)
for _, task := range tasks {
    sem <- struct{}{}  // acquire a permit
    go func(t Task) {
        defer func() { <-sem }()  // release the permit
        doTask(t)
    }(task)
}
```

## Formal verification

### FDR (Failures-Divergences Refinement)
- Input: CSP algebraic description (CSPM language)
- Checks: deadlock freedom, livelock freedom, determinacy, refinement relations
- Applications: T9000 processor, Mars rover, railway signaling systems

### Go static analysis
- `go vet`: catches some misuse patterns (e.g. copying a struct containing a lock `copylocks`, a discarded `context` cancellation function `lostcancel`); **cannot** detect channel deadlocks, negative buffering, closing an already-closed channel — there is no reliable static guarantee for these
- `go test -race`: dynamic race detection (requires tests that actually trigger the racing paths)
- `staticcheck` / `golangci-lint`: broader checks for statically suspicious patterns
- Channel deadlocks and double-closes are mainly exposed at runtime: a double close panics directly; use a goroutine dump (`SIGQUIT` or pprof `/debug/pprof/goroutine`) to locate deadlocks

## CSP vs Actor comparison

| Dimension | CSP (Go) | Actor (Erlang/Akka) |
|------|----------|---------------------|
| Communication entity | channel (first-class citizen) | actor reference |
| Synchrony | synchronous rendezvous (unbuffered) | asynchronous delivery |
| Selection mechanism | `select` multiplexing | pattern matching on a single mailbox |
| Network transparency | requires an extra framework (gRPC) | native location transparency |
| Fault tolerance | explicit error passing | supervision tree, automatic restart |
| Type system | typed channels | loosely typed messages |
| Formal verification | CSP algebra, FDR | difficult |

## Suitable scenarios

| Suitable for | Unsuitable for |
|------|--------|
| pipelines, streams, stream processing | complex state machines, long-lived entities |
| high-concurrency I/O, microservice gateways | scenarios requiring distributed transparency or hot upgrade |
| explicit cancellation, timeout control | scenarios requiring automatic fault recovery / supervision |
| teams familiar with Go / C-like syntax | teams preferring the JVM / functional ecosystem |

For a contrast with "compose-the-result" async models such as Future/async/await, see [async programming and the Future pattern](../practice/async.md).

## Chapter summary

CSP replaces shared memory with **synchronous channel communication**, making concurrency coordination an explicit dataflow topology. Go turns CSP into a built-in language feature; combined with `select`, `context`, and unidirectional channels, it becomes the mainstream concurrency paradigm of the cloud-native era. Core maxim: **use channels to transfer ownership rather than shared locks to protect data**. The Go ecosystem tooling roundup is at [concurrency frameworks and tools](../practice/frameworks.md). For the related page see the dataflow model — declarative parallel computation graphs. Channels are for orchestrating flow; when data is sharded into independent pieces that each run the same logic, [data parallelism](./data-parallel.md) is the right home.

## Sources

- *Seven Concurrency Models in Seven Weeks*, Chapter 6, Communicating Sequential Processes; see [authoritative book research](../research/books.md) for version information
- The original theory is C. A. R. Hoare, *Communicating Sequential Processes*, CACM 1978; Go-side semantics defer to the [Go official documentation](https://go.dev/doc/) and language specification
- Example code is written fresh, not copied from the book

## References

- [Wikipedia · CSP](https://en.wikipedia.org/wiki/Communicating_sequential_processes)
- [Go memory model (channel visibility)](https://go.dev/ref/mem)

<!-- BACKLINKS-AUTO -->
## Related pages

- [languages](/advanced/languages.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [data-parallel](data-parallel.md)
- [functional](functional.md)
- [async](/practice/async.md)
- [frameworks](/practice/frameworks.md)
- [seven-weeks](/practice/seven-weeks.md)
- [applications](/research/applications.md)
- [books](/research/books.md)
