# Reactor Pattern and Event-Driven

The standard answer to the C10K problem is not "more threads" but **event-driven**: a few threads wait for events via I/O multiplexing and dispatch for processing only when an event is ready. The Reactor pattern is the structural abstraction of this approach; Netty, Node.js, Redis, nginx, and asyncio are all implementations of it.

## Two approaches: one thread per connection vs event-driven

| Dimension | One thread per connection | Reactor event-driven |
|------|------------|-----------------|
| Concurrency unit | Thread (stack in MB) | Connection (state in KB) |
| Waiting method | Blocking I/O, thread suspended | Multiplexing (epoll), thread does not suspend |
| Cost at ten thousand connections | Ten thousand threads, context switching eats CPU | A single/few threads can carry them |
| Programming model | Sequential code, intuitive | Callbacks/state machines, async |
| Bottleneck | Thread scheduling and memory | Event dispatch and single-thread processing time |

As connection count grows, the former's cost rises linearly while the latter stays roughly flat -- this is the watershed of C10K. The prerequisite is hardware and kernel support for I/O multiplexing; see the I/O section of [hardware and memory hierarchy](../advanced/hardware.md).

## Structure: Reactor and Handler

```
                 ┌──────────────┐
   Event ───────→ │  Reactor     │  Wait for events (select/epoll_wait)
                 │  Dispatcher  │
                 └──────┬───────┘
                        │ Dispatch ready events
          ┌─────────────┼─────────────┐
          ↓             ↓             ↓
     ┌────────┐   ┌────────┐   ┌────────┐
     │Handler │   │Handler │   │Handler │   Non-blocking, fast return
     │ (conn1)│   │ (conn2)│   │ (conn3)│
     └────────┘   └────────┘   └────────┘
```

Four roles:

| Role | Responsibility |
|------|------|
| **Handle** | The resource being watched (socket, file descriptor) |
| **Event Demultiplexer** | Multiplexer, a wrapper around epoll/kqueue/select |
| **Reactor** | Event loop: wait for ready events, dispatch to the corresponding Handler |
| **Handler** | Handle a single event non-blockingly (read, write, connect, timeout) |

**Handlers must be fast**: the event loop is single-threaded (or multi-threaded with one thread pinned per connection). If any Handler blocks, every connection on that loop stalls together. Time-consuming operations (DB queries, disk I/O, CPU-intensive work) should be handed to a business thread pool and the result re-dispatched to the event loop -- this is the shared constraint of Netty's EventLoop + BusinessExecutor and Redis's single-threaded model.

## Variants: from single Reactor to main-sub

| Variant | Structure | Use cases |
|------|------|------|
| **Single Reactor, single thread** | One loop handles accept, read/write, business | Redis-style, logic is extremely fast, no blocking calls |
| **Single Reactor, multi-threaded** | One loop handles I/O, business goes to a thread pool | Medium connection counts, business has blocking operations |
| **Main-sub Reactor** | Main loop handles accept, multiple sub-loops each handle a batch of connections' read/write | Netty default (boss/worker groups), high connection counts |

Netty's boss group accepts connections and the worker group handles I/O; each EventLoop binds to one thread and manages multiple Channels. The number of event loops is configurable, and business logic sinks to an independent thread pool so as not to pollute the I/O threads.

## Proactor: another async form

The Reactor is a "readiness notification": when an event arrives, it notifies you to go read. The Proactor is a "completion notification": you submit a read request and are notified of the result when it finishes. Windows IOCP is a typical Proactor; io_uring on Linux also provides a completion-based interface. The difference is **who moves the data**: the Proactor has the kernel copy into a user buffer, while the Reactor has a user thread do it itself. Language-level async/await sugar is mostly built on the Reactor (Go netpoller, asyncio, Rust tokio); C#/Windows is closer to the Proactor.

## Relationship to other pages

| Question | Go to which page |
|------|--------|
| Kernel-side principles of epoll/io_uring | [Hardware and memory hierarchy](../advanced/hardware.md) |
| Business thread pool parameters and rejection policy | [Thread pool design](./thread-pool.md) |
| Backpressure: event loop overwhelmed by production rate | [Producer-consumer](./producer-consumer.md) |
| Future/async/await and reactive stream programming models | [Async programming and Future](./async.md) |
| Selection comparison with Actor/CSP | [Concurrency framework selection](./framework-selection.md) |
| Synchronization primitives for async waiting | [Condition variables](../sync/condition-variables.md) |

## Pitfalls

| Pitfall | Consequence | Fix |
|------|------|------|
| Blocking calls inside a Handler | Whole event loop stalls, all connections time out | Sink time-consuming work to a business thread pool |
| Event loop thread count mismatched with core count | Cross-core scheduling jitter, cache invalidation | Loop count ≈ core count, pin threads |
| Uncaught exceptions in callbacks | Event loop exits, service goes silently offline | Loop-level catch-all and logging |
| Unbounded write buffers | Slow consumers accumulate memory until OOM | High watermark stops writing, low watermark resumes (Netty watermarks) |
| Callback hell | Scattered state machines, hard to maintain | async/await or reactive streams (Reactive Streams) |
| Ignoring half-packets/sticky packets | Protocol parsing goes haywire | Fixed-length/separator/length-field codecs |

## Chapter summary

The Reactor pulls "waiting" out of threads and hands it to the kernel, using event dispatch to spread out I/O cost -- the default structure for high-concurrency services. When I deploy one, I first check three things: **Handlers do not block**, **event loop count matches core count**, and **backpressure has watermarks**. The cost of async is that control flow is scattered and the intuition of synchronous code no longer applies, which is exactly the dimension [concurrency framework selection](./framework-selection.md) has to weigh.

## Sources

- The Reactor pattern originates with D. C. Schmidt, *Reactor: An Object Behavioral Pattern for Concurrent Event Demultiplexing* (1995), later collected in POSA volume 2
- Proactor and IOCP comparison per Schmidt's Proactor paper; io_uring per [kernel documentation](https://kernel.dk/io_uring.pdf)
- Netty thread model and watermarks per [Netty official documentation](https://netty.io/wiki/user-guide-for-4.x.html)
- This page corresponds to README planning sections 6.5 and 7.2 (Reactor pattern, event-driven architecture) and is a page added beyond the [authoritative book survey](../research/books.md)

## References

- [The Reactor pattern (Schmidt)](https://www.dre.vanderbilt.edu/~schmidt/PDF/Reactor.pdf)
- [The Proactor pattern (Schmidt)](https://www.dre.vanderbilt.edu/~schmidt/PDF/Proactor.pdf)

<!-- BACKLINKS-AUTO -->
## Related pages

- [hardware](/advanced/hardware.md)
- [languages](/advanced/languages.md)
- [performance](/advanced/performance.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [async](async.md)
- [framework-selection](framework-selection.md)
- [frameworks](frameworks.md)
- [producer-consumer](producer-consumer.md)
- [seven-weeks](seven-weeks.md)
- [thread-pool](thread-pool.md)
