# Seven-Week Concurrency Practice Log

This log maps seven concurrency practice topics to existing pages in this repo and lists the practice outputs and checkpoints I would track. When actually doing the work, I would put the exercises into my own projects and adjust for project constraints. The chapter mapping for the original book *Seven Concurrency Models in Seven Weeks* ([../research/books.md](../research/books.md)) is on the books page; this is a practice log organized for engineering scenarios.

## Outline: the shape of seven weeks

| Week | Topic | Landing page | Output |
|----|------|--------|------|
| 1 | Java concurrency | [Thread pools](./thread-pool.md), [concurrent data structures](../advanced/data-structures.md) | Bounded thread pool + a counting service with atomic compound operations |
| 2 | C++ concurrency | [Memory model](../advanced/memory-model.md), [lock-free programming](../advanced/lockfree.md) | Lock-free queue + memory order annotations |
| 3 | Go concurrency | [CSP](../models/csp.md), [producer-consumer](./producer-consumer.md) | A pipeline with backpressure |
| 4 | Python concurrency | [Programming languages and concurrency support](../advanced/languages.md), [Reactor](./reactor.md) | asyncio gateway + multiprocess compute pool |
| 5 | Actor (Akka) | [Actor](../models/actor.md), [framework selection](./framework-selection.md) | Chat room Actor tree + supervision |
| 6 | Event-driven (Netty) | [Reactor](./reactor.md), [async programming](./async.md) | Echo server + codec |
| 7 | Integration case | [Reliability design](./reliability.md), [performance tuning](../advanced/performance.md) | Full chain: load testing, failure drills, retrospective |

Across these exercises I would follow a few habits: **write tests before talking about concurrency** (race detection tools on the [concurrency security](../advanced/security.md) page), **introduce only one new concept at a time**, and **review [the knowledge outline](../knowledge.md) after finishing**.

## Week 1: Java - thread pools and atomic compound operations

1. I would first read [thread pool design](./thread-pool.md), then replace all `Executors` factory methods in my own project with explicit `ThreadPoolExecutor`: bounded queue, named thread factory, explicit rejection policy
2. I would replace all check-then-act with `ConcurrentHashMap`'s atomic compound methods (see [concurrent data structures](../advanced/data-structures.md))
3. I would write a race reproduction test with [jcstress](https://github.com/openjdk/jcstress): first make it fail (reproduce the race), then make it pass (fix it)

**Acceptance**: push to 3x target traffic; when the queue fills, the rejection policy kicks in rather than OOM; the jcstress report shows no contention.

## Week 2: C++ - memory orders and lock-free structures

1. I would first read the [memory model](../advanced/memory-model.md), then convert a queue protected by `std::mutex` into a Treiber stack ([lock-free programming](../advanced/lockfree.md), section 1), annotating each `memory_order`
2. I would first run everything with `seq_cst`, then relax one at a time to `acquire/release`, verifying each relaxation with [Relacy](https://github.com/4shenAery/Relacy_Race_Editor) or TSan
3. I would deliberately relax one to `relaxed` and use a test or model checking to expose it -- **you only understand it after seeing it fail**

**Acceptance**: TSan clean; able to explain verbally what would happen if each memory order were removed.

## Week 3: Go - pipelines and backpressure

1. I would first read [CSP](../models/csp.md) and [producer-consumer](./producer-consumer.md), then implement a three-stage pipeline (generate -> process -> output), with `context` threading through cancellation
2. I would add a watermark to each stage: when queue depth exceeds the threshold, the upstream slows down (a blocking send is natural backpressure; record why Go's blocking send produces backpressure)
3. I would run the full test suite with `-race`; deliberately close the task queue to cause a panic, then revert to the correct "closed flag + context" approach

**Acceptance**: `-race` clean; after downstream stops consuming, the upstream stops within a bounded time; Ctrl-C graceful exit with no leaks.

## Week 4: Python - the boundaries of the GIL

1. I would first read the Python section of [programming languages and concurrency support](../advanced/languages.md), then run the same CPU-intensive task three ways -- threading, multiprocessing, and a C extension that releases the GIL -- and record the timings, **observing the GIL's effect on this kind of task**
2. I would write a small gateway with asyncio: concurrently forwarding 1000 requests, with timeouts and cancellation propagating along the call chain (compare the cancellation section of [async programming](./async.md))
3. I would rewrite back and forth between callback hell and `async/await`, feeling out what "the cost of async" actually means

**Acceptance**: the multithreaded version does not speed up CPU tasks (unless the GIL is released); after the target downstream times out, the gateway releases all connections within 1 second.

## Week 5: Actor - state and messaging

1. I would first read [Actor](../models/actor.md), then rewrite a shared-mutable-state counter/account system as Actors: one Actor per entity, message-driven
2. I would implement a supervision tree: make a child Actor panic deliberately and verify "restart rather than propagate"; add a mailbox limit and reproduce the unbounded mailbox problem from the [pitfall list](../knowledge.md)
3. I would add cross-Actor request-response, making timeouts and the idempotence the business layer must implement under "at-least-once" semantics explicit

**Acceptance**: inject 10% message loss/duplication and the system state is still correct (idempotent keys work); a single Actor crash does not drag the system down.

## Week 6: Netty - event loop in practice

1. I would first read [Reactor](./reactor.md), then write an echo server with Netty: a custom codec handling sticky/half packets, main-sub Reactor configured to match the core count
2. Deliberately add one blocking DB call inside a Handler and reproduce a full loop stall under load testing; then sink the time-consuming operation to a business thread pool and compare p99
3. I would configure high and low watermarks on the write buffer and use a slow consumer to reproduce and fix write buffer accumulation

**Acceptance**: 100k idle connections with memory and CPU within budget; one Handler blocking no longer affects other connections.

## Week 7: Integration - push the system to the edge of failure

1. I would implement a small service using any stack from the previous six weeks (suggestion: order placement, including inventory deduction and a downstream call)
2. I would execute the five load testing stages from [performance tuning](../advanced/performance.md): baseline -> knee point -> long run at target load -> failure drill (remove a node, break a dependency, inject latency)
3. I would self-check line by line against the pitfall list on [reliability design](./reliability.md): are retries idempotent, do locks have tokens, has any backup been drill-restored
4. I would write a retrospective: which bottleneck was guessed wrong, which degradation actually triggered, which pitfall list entry got hit

**Acceptance**: 4 hours at target load with no leaks; after breaking one dependency the service degrades rather than avalanches; a one-page retrospective document.

## Two notes on the practice arrangement

- **Weeks can be reordered**: with Go experience, start from the week 3 topic and use Java/C++ as a contrast; the four-dimension weighing on [concurrency framework selection](./framework-selection.md) can also guide the order of practice
- **Loop back to the outline every week**: after finishing each week's exercises, I would find the corresponding entry in [the knowledge outline](../knowledge.md) and add "done" to my notes; after seven weeks, what remains is not just code, but also a mapped-out net

## Sources

- The week structure follows P. Butcher, *Seven Concurrency Models in Seven Weeks* (PragProg, 2014)'s seven-chapter arrangement; the chapter-by-chapter mapping to this repo is on the [authoritative book survey](../research/books.md) page
- Tool entry points for each week (jcstress, TSan, Relacy, `-race`) are governed by their respective official documentation; links are in the body of each section
- The acceptance criteria are this repo's engineering standards back-derived from each page's pitfall list (a research conclusion), not from the original book
- This page corresponds to README planning section 12, "seven-week concurrency practice"; this repo is a knowledge base without an attached code repository, so the practice is completed in individual projects

## References

- [Seven Concurrency Models in Seven Weeks (PragProg)](https://pragprog.com/titles/pb7con/seven-concurrency-models-in-seven-weeks/)

<!-- BACKLINKS-AUTO -->
## Related pages

- [knowledge](/knowledge.md)
