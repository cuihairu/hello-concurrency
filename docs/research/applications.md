# Application Scenario Research: High-Concurrency Services and Game Servers

The README promises to cover application scenarios, and `chapter_1.md` section 1.2 gives only a six-row table. This page breaks apart the two most common scenario classes: internet high-concurrency services and game servers, with their respective concurrency shapes, traffic-handling techniques, and pitfalls, then gives a mapping from scenario to this repo's chapters.

## Scenario one: high-concurrency services

This refers to systems such as Web services, microservices, gateways, and messaging systems - "large numbers of short requests arriving at the same time". Their concurrency shape is thread pool plus async I/O: connection count is far larger than worker thread count, requests queue up on arrival, and are handed back immediately once processing finishes. The traffic-governance article on the Tencent Cloud developer community gives a blunt example: Tomcat defaults to 200 worker threads, and when requests outnumber threads the new requests can only spin in the browser, without even getting a Hello world response. That is really the most primitive form of rate limiting - except it limits the container rather than the business.

### The five levers of traffic governance

| Lever | What it does | Key points |
|------|--------|--------|
| Rate limiting | Set a numeric ceiling on a resource; buffer or reject the excess outright | Common algorithms: counter, leaky bucket, token bucket. The counter is not smooth; in practice the leaky bucket and token bucket are used more. Rate limiting is provided by the service side and protects the underlying resource |
| Circuit breaking | Cut off calls when a downstream fails and return a default result | Provided by the calling side, used on bypass requests, to stop a single failing C on an A->B->C chain from dragging down the whole thread pool |
| Degradation | Shut off non-core traffic broadly from the entry point | Best placed at an entry layer such as Nginx or DNS; during an e-commerce sale, turn off comments and recommendations first |
| Warm-up | Ramp new nodes up gradually | A JVM that just started has no JIT compilation, and a DB that just restarted has a cold cache - taking 1/N of the traffic directly may take it down |
| Backpressure | The callee continuously reports processing capacity, and the caller adjusts its rate accordingly | One layer of feedback on top of fixed rate limiting; the TCP sliding window is the prototype, and Reactive Streams turned it into a specification |

Where these five land in this repo: [thread pool design](/practice/thread-pool) (capacity and rejection policy), [producer-consumer](/practice/producer-consumer) (queue length and backpressure policy), [performance tuning](/advanced/performance) (the Little's Law capacity formula).

### The distributed cache side

After single-machine concurrency is sorted, the second layer for high-concurrency services is moving hot reads out of the database. Facebook's Memcache cluster (NSDI '13) is the standard answer on that route: place hot object caches across data centers, and use a lease mechanism to handle the race between cache expiry and repopulation so the same key is not fetched back concurrently. This repo's [concurrent data structures](/advanced/data-structures) covers atomic updates to a local cache; the cross-datacenter layer is out of scope, but the two share the same source of race: a read-modify-write that is not atomic. For the general shape of leases and fencing tokens see [reliability design](/practice/reliability).

### What this scenario tests

1. Queue depth and backpressure: an unbounded growing queue is just deferring the failure until an OOM.
2. Critical section length: doing a network call inside a lock makes throughput drop off a cliff.
3. False sharing and cache lines: counters updated together on one core make multicore slower instead; [performance tuning](/advanced/performance) has troubleshooting methods for this.
4. Graceful shutdown and rolling deploys: taking a node offline before connections drain shows up as a spike of errors the instant of restart.

## Scenario two: game servers

A game server's concurrency shape is very different from Web: a single player's actions are sequential, and only cross-player interaction needs concurrency, with highly shared state (coordinates, health, inventory on the same map). The mainstream solution is to funnel shared state into actors, where each actor processes messages single-threaded and relies on message passing instead of locks.

### The skynet route

The [skynet README](https://github.com/cloudwu/skynet) describes itself as "a multi-user Lua framework supporting the actor model, often used in games", and "heavily used in the Chinese game industry". C writes the framework, Lua writes the business logic; each actor is an independent Lua VM plus a message queue, and the scheduler dispatches messages by fair rotation. The Tencent Cloud design article splits it into three parts: the Actor model, message queues, and fair actor scheduling; hot updates and the network layer are separate, and it is suited to large online multiplayer games and real-time applications.

What this means for this repo: the three sections of the [Actor model](/models/actor) - "message delivery semantics", "supervision policy", and "anti-patterns and pitfalls" - can be read directly against this class of framework; the point that an actor has no shared mutable state within its single thread is the same principle as CSP's "communicate, do not share" in [CSP](/models/csp), just written two ways.

### Problems specific to game servers

| Problem | Shape | Common handling |
|------|------|----------|
| Logic frames and timers | Advance the world every frame; timed tasks fire on a frame number | Single-threaded main loop plus a timing wheel, avoiding blocking I/O inside a frame |
| State synchronization | Server broadcasts positions to dozens or hundreds of clients | Snapshot interpolation, interest management (sync only on-screen objects), per-frame batched sends |
| Broadcast storm | One event triggers N clients, each sending once | Merged writes, per-frame sends, a bandwidth budget |
| Disconnect and reconnect | Player drops but state remains | Session timeout plus state snapshot replay |
| Hot update | Change logic without downtime | Hot-swap at the Lua/script layer, leaving the C layer alone |
| Backpressure | A slow client drags down the network thread | Cap the write queue; kick the client when the limit is hit rather than blocking |

What to watch in the hot loop: the frame loop is extremely sensitive to latency jitter, and both GC pauses and lock contention show up directly as dropped frames. This is the concrete form in game scenarios of the "latency breakdown" analysis in [performance tuning](/advanced/performance).

## Scenario-to-chapter mapping

| Scenario need | Corresponding page |
|----------|----------|
| Queued execution of connections and tasks | [Thread pool design](/practice/thread-pool) |
| Bounded queues, backpressure, multiple consumers | [Producer-consumer](/practice/producer-consumer) |
| Read-heavy, write-light scenario state | [Reader-writer](/practice/reader-writer) |
| Actorized entities and messages | [Actor model](/models/actor) |
| Pipelined flows and cancellation | [CSP model](/models/csp) |
| Read-heavy, write-light shared cache | [Concurrent data structures](/advanced/data-structures) |
| Counting, latency, and capacity planning | [Performance tuning](/advanced/performance) |
| Framework and architecture selection | [Concurrency framework selection](/practice/framework-selection) |

## Sources

- [cloudwu/skynet README](https://github.com/cloudwu/skynet)
- [Tencent Cloud developer community: Skynet design principles and usage](https://cloud.tencent.com/developer/article/2519632)
- [Tencent Cloud developer community: rate limiting, circuit breaking, degradation, warm-up, backpressure](https://cloud.tencent.com/developer/article/1887928)
- [Scaling Memcache at Facebook (NSDI '13)](https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala)

## References

- [MapReduce paper](https://static.googleusercontent.com/media/research.google.com/en//archive/mapreduce-osdi04.pdf)
- [Raft consensus](https://raft.github.io/)
- [Lambda architecture](https://en.wikipedia.org/wiki/Lambda_architecture)

<!-- BACKLINKS-AUTO -->
## Related pages

- [performance](/advanced/performance.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [reliability](/practice/reliability.md)
- [README](README.md)
- [coverage-audit](coverage-audit.md)
