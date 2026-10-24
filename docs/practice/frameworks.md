# Concurrency Frameworks and Tools

The README planning table of contents for chapter 8 lists five things: the Java concurrency package, Akka, Netty, Go concurrency tools, and Python concurrency libraries. This repo's approach is **not to re-explain APIs** -- each framework's principles are already covered on their own page. What this page provides is a map: what each of the five ecosystems "gives you, does not give you, and where to read deeper." The decision method for choosing a framework is on [concurrency framework selection](./framework-selection.md); this page only covers the tools themselves.

## Responsibility boundaries of the five ecosystems

| Ecosystem | Representative tool | What it gives you | What it does not give you |
|------|----------|--------|----------|
| **Java** | `java.util.concurrent`, virtual threads | The full set of primitives and containers: pools, queues, locks, atomic classes, concurrent containers | Scheduling policy (virtual threads are the exception, see below) |
| **Actor on the JVM** | Akka (Typed) | Materialized Actors, supervision trees, location-transparent messaging | An escape hatch to shared memory (not given by design) |
| **Network layer** | Netty | Reactor event loops, codec pipelines, zero-copy buffers | A business thread pool (you must sink it yourself) |
| **Go** | goroutine, channel, `context` | Language-builtin concurrency primitives, no third-party dependency | A unified timeout/cancellation object (relies on context-passing discipline) |
| **Python** | `asyncio`, `concurrent.futures`, `multiprocessing` | Event loop and task composition, process pools to bypass the GIL | True parallel multithreading (it does not exist under the GIL; see [the languages page](../advanced/languages.md)) |

## Java: from the concurrency package to virtual threads

`java.util.concurrent` is the most complete **library** among the five ecosystems: thread pools ([thread-pool](./thread-pool.md)), concurrent containers and atomic classes ([data structures](../advanced/data-structures.md)), locks and synchronization primitives ([locks](../sync/locks.md), [semaphores](../sync/semaphores.md), [barriers](../sync/barriers.md)), task composition ([async](./async.md)) are all in the package. Its philosophy is **primitives only, no scheduling** -- thread counts, queue types, and rejection policies are all yours to decide, which is why [parameter combinations](./thread-pool.md) become the main event.

JEP 444's virtual threads changed that shape: once threads became a cheap resource, the mental burden of "thread pooling" disappeared, and the remaining correctness questions are the same ones as before -- [lock semantics](../sync/locks.md), [bounded resources](./producer-consumer.md), and [critical section discipline](../basics/critical-section.md) are all still present. What virtual threads eliminate is the assumption that "threads are expensive so they must be saved," not the concurrency problem itself.

## Akka: confine state inside an Actor

Akka Typed turns the [Actor model](../models/actor.md) into a framework: each entity is an Actor (private state + mailbox), interaction goes only through typed messages, and the supervision tree handles "who restarts a child Actor when it dies." What it gives you for concurrency correctness is a **structural guarantee** -- no shared state means no races, and mailbox serial processing means no interleaving.

The cost is equally clear: an unbounded mailbox drags the process down (see [Actor pitfalls](../models/actor.md)), cross-node messages are at-least-once delivery and business logic must be idempotent, and failover plus consistency need to be filled in per [reliability design](./reliability.md). Choosing Akka means choosing to "trade away all the convenience of shared memory for messaging semantics."

## Netty: only the event loop layer

Netty is the industrial implementation of the [Reactor pattern](./reactor.md): the boss group accepts connections, the worker group runs EventLoops, each bound thread manages a batch of Channels, and codec processing goes through the pipeline. It takes care of half-packets/sticky packets, zero-copy, and watermark backpressure at the network layer, but it draws a hard line -- **no blocking inside the EventLoop**. Business logic is either fast and non-blocking, or it goes to your own business thread pool (EventLoop + BusinessExecutor pool separation is the standard shape of a Netty service).

## Go: the language is the framework

Go has no third-party concurrency framework, because it does not need one: goroutines are cheap execution flows, channels are CSP channels, `select` does multi-way waiting, and `context` propagates timeouts and cancellation. The expressiveness of this combination is covered on [the CSP page](../models/csp.md) and [the worker pool section of thread-pool](./thread-pool.md).

Its gaps are also clear: there is no Future type (results travel on a channel; see the comparison on [the async page](./async.md)), there is no enforced constraint for structured concurrency (goroutine leaks can only be caught by discipline and `go tool pprof`), and cancellation is passed layer by layer manually via context -- miss a layer and downstream waits forever. **Go put concurrency into the language, and so it left concurrency discipline to the human.**

## Python: three routes each covering one segment

| Route | Used for | Boundary |
|------|--------|------|
| `asyncio` | High-concurrency I/O: networking, crawlers, gateways | Single-threaded event loop, no CPU-intensive work inside coroutines |
| `multiprocessing` / `ProcessPoolExecutor` | CPU-intensive computation | Data passed between processes must be serialized, startup has overhead |
| `concurrent.futures` | A unified interface for both: `submit` + `Future` | Default pool sizes must be configured explicitly |

Multithreading under the GIL is neither true parallelism nor pure overhead -- the GIL is released during I/O waits, so "multithreading for I/O + multiprocess for compute + asyncio for high concurrency" is the standard three-way split. The free-threaded build (PEP 703) is changing that first boundary; see [the languages page](../advanced/languages.md) for progress.

## Tool quick reference

| Need | First-choice tool | Deep read page |
|------|----------|--------|
| Bounded task execution | Thread pool / `TaskGroup` | [thread-pool](./thread-pool.md) |
| Bounded queue and backpressure | `ArrayBlockingQueue`, channel, Reactive Streams | [producer-consumer](./producer-consumer.md) |
| Concurrent containers | `ConcurrentHashMap`, Go `sync.Map` (use with caution) | [data structures](../advanced/data-structures.md) |
| Race detection | TSan / `-race`, jcstress | [security](../advanced/security.md) |
| Event-driven networking | Netty, asyncio, tokio | [reactor](./reactor.md) |
| Distributed coordination | etcd/ZooKeeper + fencing token | [reliability](./reliability.md) |

## Pitfalls

| Pitfall | Consequence | Fix |
|------|------|------|
| Framework replaces principles | Switching frameworks and hitting the same pitfall (unbounded queues, blocking callbacks) | Understand [selection](./framework-selection.md) and each page's pitfalls first, then choose tools |
| Using Akka to solve a problem that should not be concurrent | Messaging semantics bring unnecessary complexity | Simple tools for simple problems: thread pool > Actor |
| Mixing Netty business threads with the I/O pool | One slow business stalls all connections | Separate EventLoop from the business pool |
| Forgetting to pass context in Go | Downstream tasks never time out, leaks accumulate | Function convention with context as the first parameter |
| CPU-intensive work in a Python coroutine | Event loop stalls, all requests queue | Sink compute to a process pool |
| Pooling threads on top of virtual threads | Double scheduling, the pool becomes the bottleneck | Start virtual threads directly, no extra pool |

## Chapter summary

The five ecosystems are five answers to "who is responsible for correctness": Java gives you the primitives and leaves scheduling to you; Akka takes both state and scheduling away, leaving only messages; Netty only manages the event loop and leaves business discipline to you; Go puts concurrency into the language and leaves discipline to you; Python hands parallelism to processes and async to the event loop. Tools can never replace principles -- [critical sections](../basics/critical-section.md), [bounded buffers](./producer-consumer.md), and [memory models](../advanced/memory-model.md) all hold in every ecosystem. That is also why [framework selection](./framework-selection.md) turns from "which framework can I use" to "which principle do I understand."

## Sources

- Java concurrency package semantics per the [JDK 21 API documentation](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/package-summary.html); virtual threads per [JEP 444](https://openjdk.org/jeps/444)
- Akka Typed supervision and messaging semantics per the [Akka official documentation](https://doc.akka.io/docs/akka/current/typed/guide/index.html); this repo's [Actor page](../models/actor.md) checked the model against chapter 5 of *Seven Concurrency Models in Seven Weeks*
- Netty thread model per the [Netty official documentation](https://netty.io/wiki/user-guide-for-4.x.html); structural details on [the Reactor page](./reactor.md) (the Schmidt 1995 paper is the original source)
- Go concurrency primitives per [Go documentation](https://go.dev/doc/) and the [context package documentation](https://pkg.go.dev/context)
- The three Python routes per [asyncio documentation](https://docs.python.org/3/library/asyncio-task.html), [concurrent.futures documentation](https://docs.python.org/3/library/concurrent.futures.html), and [PEP 703](https://peps.python.org/pep-0703/)
- This page corresponds to README planning section 8, "high concurrency frameworks and tools"; the writing style is a map, not an API manual (research conclusion: API manuals expire quickly, principles and boundaries are evergreen), and each tool's principle sources are on the linked pages

## References

- [Akka official site](https://akka.io/)
- [The Tokio tutorial (external link)](https://tokio.rs/tokio/tutorial)
- [Erlang documentation](https://www.erlang.org/docs)
- [Java concurrent utilities](https://docs.oracle.com/en/java/javase/21/api/java.base/java/util/concurrent/package-summary.html)
- [Boost.Thread](https://www.boost.org/doc/libs/release/doc/html/thread.html)

<!-- BACKLINKS-AUTO -->
## Related pages

- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [csp](/models/csp.md)
- [semaphores](/sync/semaphores.md)
