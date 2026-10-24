# Actor Model

The Actor model was proposed by Carl Hewitt in 1973 and is an **object model oriented toward concurrency**: "everything is an actor." It is the theoretical foundation of systems such as Erlang, Akka, Orleans, and Pulsar Functions.

## Core axioms

> **An actor is the fundamental unit of concurrent computation. It communicates through asynchronous messages, owns private state, and responds to messages by creating new actors, sending messages, and specifying its next behavior.**

### Three fundamental operations
1. **Create an actor** → obtain a reference
2. **Send a message** → asynchronous, non-blocking, best-effort delivery
3. **Specify behavior** → the logic executed when a message is received; can change state, create actors, send messages

### Key properties
| Property | Meaning |
|------|------|
| **Encapsulation** | State is private; interaction only through messages; no shared memory |
| **Asynchrony** | Send returns immediately without waiting for processing to complete |
| **Location transparency** | Local/remote actors share a unified reference; the network is transparent |
| **Mailbox ordering** | Messages to a single actor are processed in order (FIFO) |
| **Supervision tree** | Parent actors supervise children, isolating and recovering from faults |

## Actor lifecycle

```
create → run (process messages) → suspend/resume → stop → terminate
                ↓
          fault → restart/escalate/stop (determined by supervision strategy)
```

## Message delivery semantics

| Semantics | Description | Typical implementation |
|------|------|----------|
| **At most once** | Messages may be lost; no retry | UDP, fire-and-forget |
| **At least once** | Messages are not lost; duplicates possible | ACK + retry, idempotent handling |
| **Exactly once** | Exactly one delivery | Transactional mailbox, idempotency + deduplication |

**Engineering reality**: distributed systems can usually only guarantee "at least once"; idempotent design at the business layer is required.

## Classic patterns

### 1. Request-response
```scala
// Ask pattern: send a message and get back a Future
val future: Future[Response] = actor ? Request
future.onComplete { case Success(r) => ... }
```
**Note**: a timeout must be set to avoid waiting indefinitely.

### 2. Forwarding/proxy
```scala
def receive = {
  case msg => target.forward(msg)  // preserves the original sender reference
}
```

### 3. Aggregate / scatter-gather
```scala
def receive = {
  case Aggregate(keys) =>
    val futures = keys.map(key => worker ? Fetch(key))
    Future.sequence(futures).map(results => sender() ! Result(results))
}
```

### 4. State machine
```scala
def idle: Receive = {
  case Start => context.become(active)
}
def active: Receive = {
  case Data(d) => update(d)
  case Stop => context.become(idle)
}
```

### 5. Supervision strategy
```scala
override val supervisorStrategy = OneForOneStrategy(maxNrOfRetries = 3) {
  case _: ArithmeticException => Resume      // ignore the error and continue
  case _: NullPointerException => Restart    // reset state and restart
  case _: IllegalArgumentException => Stop   // stop permanently
  case _: Exception => Escalate              // escalate to the parent
}
```

## Actor system architecture

### Hierarchy
```
Guardian (/) 
  ├─ System Guardian (/system)  // system-level actors
  └─ User Guardian (/user)      // root of user actors
       ├─ /user/service-a
       │    ├─ /user/service-a/worker-1
       │    └─ /user/service-a/worker-2
       └─ /user/service-b
```

### Addresses and references
- **ActorPath**: `akka://system@host:port/user/service-a/worker-1`
- **ActorRef**: a serializable, network-transparent reference that supports `tell` / `ask`

## Distributed actors

### Location transparency
```scala
// Unified API for local and remote
val local = system.actorOf(Props[Worker], "worker")
val remote = system.actorSelection("akka://remote@host:2552/user/worker")
remote ! Msg  // network transparent
```

### Cluster awareness
- **Sharding**: `ClusterSharding` automatically balances actor distribution
- **Singleton**: `ClusterSingleton` guarantees a unique instance across the cluster
- **Publish-subscribe**: `DistributedPubSub` decouples topics

## Mainstream implementations compared

| Framework | Language | Distinguishing features | Typical use |
|------|------|------|----------|
| **Erlang/OTP** | Erlang/Elixir | native lightweight processes, hot upgrade, nine-nines availability | telecom, IM, finance |
| **Akka** | Scala/Java | full ecosystem, clustering, streams, HTTP, persistence | high-concurrency services, stream processing |
| **Akka.NET** | C#/.NET | native .NET port | enterprise .NET applications |
| **Orleans** | C# | virtual actors, automatic activation, persistence | cloud native, game servers |
| **Proto.Actor** | Go/C#/Python/JS | cross-language, lightweight, no runtime dependency | microservices, edge computing |
| **Ractor** | Ruby 3+ | language-native, releases the GVL | Ruby concurrency |
| **Pony** | Pony | type system guarantees data-race freedom | high-performance concurrency |

## Performance characteristics

| Metric | Typical value | Influencing factors |
|------|--------|----------|
| Actor creation | ~microsecond | 100-1000× lighter than a thread |
| Message dispatch | ~hundreds of nanoseconds | mailbox implementation, scheduler |
| Per-actor throughput | ~million msgs/s | message complexity, state size |
| Memory per actor | ~KB | mailbox, state, stack |

## Applicability

| Suitable for | Unsuitable for |
|------|--------|
| high concurrency, distributed state, message-driven | tightly coupled shared state, high-frequency synchronous computation |
| fault tolerance, self-healing, hot upgrade | simple concurrency, data parallelism, numerical computation |
| distributed, heterogeneous, long-lived | single machine, short-lived, deterministic synchronization |

## Anti-patterns and pitfalls

| Anti-pattern | Consequence | Fix |
|--------|------|------|
| synchronous blocking calls (`Await.result`) | thread starvation, deadlock | full async, Future composition |
| passing large messages | serialization overhead, GC pressure | pass by reference, shared storage, chunking |
| unbounded mailboxes | OOM, backpressure failure | bounded mailboxes, flow control, Pull pattern |
| business logic inside supervision strategy | coupling, hard to test | supervision handles only lifecycle |
| ignoring idempotency | duplicate processing causes errors | idempotency keys, deduplication, transactions |

## Modern evolution

- **Virtual Actor (Orleans)**: no explicit creation/lookup; the runtime activates, distributes, and fails over automatically
- **Event Sourcing + CQRS**: actors persist event logs; state is replayed; reads and writes are separated
- **Serverless Actor**: a function is an actor, activated on demand and scaled automatically (CloudState, Wasmer)
- **Type-safe actors**: TypeScript (Runtypes), Rust (Actix), Pony compile-time race freedom

## Chapter summary

The actor model inverts the concurrency paradigm from **"shared memory for communication" → "communication for shared memory"**. Core value:
- **Encapsulates concurrency complexity**: developers focus on single-actor logic
- **Inherently distributed**: location transparency, supervision fault tolerance
- **Elastic scaling**: lightweight actors support millions of concurrent connections

The supervision tree provides the fault-tolerance skeleton inside a process; once you cross node boundaries, you still need [reliability design](../practice/reliability.md) to supply idempotency for at-least-once delivery, failure detection, and failover.

Engineering selection guidance: **on the JVM, Akka is the default; on .NET, Orleans; for cross-language/lightweight, Proto.Actor; for extreme availability, Erlang/OTP**. For the related page see the CSP model — communicating sequential processes. The opposite of actors is data parallelism: when tasks are independent of each other and need no long-lived state, the overhead of [functional concurrency](./functional.md) and [data parallelism](./data-parallel.md) is far lower than building an actor system.

## Sources

- *Seven Concurrency Models in Seven Weeks*, Chapter 5, Actors; see [authoritative book research](../research/books.md) for version information
- The implementation comparison table and lifecycle sections defer to each project's official documentation ([Akka](https://akka.io/), [Erlang/OTP](https://www.erlang.org/), [Orleans](https://learn.microsoft.com/dotnet/orleans/), [Proto.Actor](https://proto.actor/))
- Example code is written fresh, not copied from the book

## References

- [Wikipedia · Actor model](https://en.wikipedia.org/wiki/Actor_model)
- [Erlang concurrency programming](https://www.erlang.org/doc/getting_started/conc_prog.html)
- [Akka official site](https://akka.io/)

<!-- BACKLINKS-AUTO -->
## Related pages

- [security](/advanced/security.md)
- [trends](/advanced/trends.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [data-parallel](data-parallel.md)
- [functional](functional.md)
- [frameworks](/practice/frameworks.md)
- [reliability](/practice/reliability.md)
- [seven-weeks](/practice/seven-weeks.md)
- [applications](/research/applications.md)
- [books](/research/books.md)
