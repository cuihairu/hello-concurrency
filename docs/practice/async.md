# Async Programming and the Future Pattern

The [Reactor and event-driven](./reactor.md) page covers the low-level event dispatch structure; this page covers the programming models built on top of it: how to express "the result will only be available later" (the Future pattern), how to express "notify me when something changes" (Observer and reactive streams), and how both converge into today's mainstream syntax, async/await. The core question is the same: **once waiting is pulled out of threads, how do you write the code?**

## The Future pattern: the result is an object

The Future pattern returns a placeholder object immediately, and the real result is filled in later. Waiting is replaced from "suspend the thread" to "hold the placeholder and take the result later":

| Form | How waiting works | Representatives |
|------|---------|------|
| Blocking result retrieval | `future.get()` suspends the current thread | Java `Future`, C++ `std::future` |
| Callback registration | The callback is invoked when the result is ready | Node.js callbacks, Guava `ListenableFuture` |
| Combinators | `thenApply`/`thenCompose` chained transformation | Java `CompletableFuture`, JS `Promise` |
| async/await | Suspension points explicitly marked, compiled into a state machine | JS, C#, Rust, Kotlin coroutines |

The key difference is in **composition**: the chaining of `CompletableFuture`/`Promise` and the `all`/`any` combinators can express data dependencies between tasks, whereas a blocking `get()` can only write async back into synchronous -- each stage drains waiting, and the parallelism is eaten by the writing style.

**Exceptions, cancellation, and timeouts must also propagate along the chain**: Java uses `exceptionally`/`whenComplete`, JS uses `.catch`, Go's equivalent is `context.Context` (cancellation and timeout flow through the entire call chain), and Kotlin coroutine cancellation propagates along the structured scope. Passing values without passing cancellation guarantees leaked resources and hung tasks.

**Structured concurrency** is the convergence point of this line: concurrent tasks must live inside a scope, the scope waits for all child tasks to finish before exiting, and exceptions automatically bubble up -- Trio's Nursery, Kotlin's `coroutineScope`, and OpenJDK's structured concurrency (preview since [JEP 453](https://openjdk.org/jeps/453)).

## The Observer pattern and reactive streams

The Observer turns "data changed" into a push: the observable maintains a subscriber list and notifies it when a change occurs. It shares its origin with event-driven, but the granularity differs -- event-driven pushes readiness signals, while reactive streams push the **data stream itself**.

The problem with a bare Observer is that the observable does not know how fast its subscribers are; when production is fast and consumption is slow, the buffer grows without limit. The **Reactive Streams** specification ([reactive-streams.org](https://www.reactive-streams.org/)) hands the rate decision back to the subscriber with `request(n)`, under four rules: non-blocking backpressure, bounded buffering, `request(n)` pulling, and error-termination propagation. Implementations include RxJava, Project Reactor, Kotlin Flow, and Akka Streams.

This and the backpressure strategies on [producer-consumer](./producer-consumer.md) are two answers to the same problem: bounded-queue blocking is the thread world's answer, and `request(n)` is the stream world's answer.

## Async programming models compared

| Model | Control flow | Use cases |
|------|--------|------|
| Callbacks | Function nesting, invoked on readiness | Single-layer simple logic (nesting becomes callback hell) |
| Future/Promise | Placeholder and composition of a single result | One request-response, limited parallelism |
| Reactive streams | Data-stream push + backpressure | Stream processing, end-to-end backpressure |
| Coroutines async/await | Sequential code, explicit suspension points | The default choice for most business logic |
| CSP / goroutine | Communication is synchronization, blocking style | Pipeline-style workflows (see [CSP model](../models/csp.md)) |

**async/await is not free**: it compiles functions into state machines, and execution threads are still occupied between suspension points -- CPU-intensive work inside a coroutine starves the entire event loop, which is the same pitfall as [Reactor Handler blocking](./reactor.md) in two different forms. Coroutine scheduling cost and the carrier threads of the event loop both fall on kernel scheduling; see [operating systems and concurrency](../advanced/os.md).

## Relationship to other pages

| Question | Go to which page |
|------|--------|
| Event loop and multiplexing low-level structure | [Reactor and event-driven](./reactor.md) |
| Backpressure answers in the thread world (bounded queues, watermarks) | [Producer-consumer](./producer-consumer.md) |
| Where time-consuming tasks go (business thread pool) | [Thread pool design](./thread-pool.md) |
| Primitives for blocking waits | [Condition variables](../sync/condition-variables.md) |
| Semantics of goroutine and channel | [CSP model](../models/csp.md) |

## Pitfalls

| Pitfall | Consequence | Fix |
|------|------|------|
| `get()` waiting stage by stage in an async chain | Parallel tasks serialized, slower than the synchronous version | Chain dependencies with combinators/await, do not block stage by stage |
| Exceptions in a Future nobody catches | Failures swallowed or silently lost in a thread pool | Close explicitly with `exceptionally`/`catch`; structured scopes bubble automatically |
| No backpressure in reactive streams | Fast production, slow consumption, buffer grows to OOM | `request(n)` or bounded buffering, end-to-end pulling |
| Cancellation does not propagate | Tasks canceled but downstream still computing, resource leaks | Pass context in Go, use structured scopes in coroutines |
| CPU-intensive work in a coroutine | Event loop starved, all request latency spikes | Sink computation to a thread pool (same constraint as Reactor Handlers) |

## Chapter summary

The evolution of async programming is a line of "expressive convergence": callbacks can express but are hard to compose, Futures solve single-result composition but lack cancellation and scope, reactive streams add backpressure but the API is heavy, and async/await folds it back into sequential code with structured concurrency holding the scope. In practice, three things to grasp: **compose rather than wait**, **cancellation must flow through the whole chain**, and **do not do heavy work inside a coroutine**.

## Sources

- The Java landing point of the Future pattern is in the [OpenJDK API documentation](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CompletableFuture.html) for `java.util.concurrent.Future`/`CompletableFuture`
- Backpressure and the non-blocking specification per the [Reactive Streams specification](https://www.reactive-streams.org/)
- Structured concurrency per [JEP 453](https://openjdk.org/jeps/453) (JDK 21 preview); cancellation propagation per the [Go context package documentation](https://pkg.go.dev/context) and the [Kotlin coroutines guide](https://kotlinlang.org/docs/coroutines-guide.html)
- This page corresponds to README planning sections 6.3 (Future pattern), 6.4 (Observer pattern), and 7.1 (async programming models) and is a page added beyond the [authoritative book survey](../research/books.md)

## References

- [The Rust async book](https://rust-lang.github.io/async-book/)
- [The Tokio tutorial (external link)](https://tokio.rs/tokio/tutorial)
- [Python asyncio](https://docs.python.org/3/library/asyncio.html)
- [Node.js async programming](https://nodejs.org/en/learn/asynchronous-work/javascript-asynchronous-programming-and-callbacks)

<!-- BACKLINKS-AUTO -->
## Related pages

- [trends](/advanced/trends.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [csp](/models/csp.md)
- [frameworks](frameworks.md)
- [producer-consumer](producer-consumer.md)
- [reactor](reactor.md)
- [seven-weeks](seven-weeks.md)
