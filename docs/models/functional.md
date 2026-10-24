# Functional Concurrency

Functional concurrency is the topic of Chapter 3 of *Seven Concurrency Models in Seven Weeks* (the Chinese edition titles the chapter "functional programming"; its day 3, "functional concurrency", corresponds to the original Day 3 Dataflow Programming with Futures and Promises). The core claim: **mutability is the root of concurrency problems; remove it and locks become unnecessary**.

## Why immutability solves concurrency

Shared mutable state causes data races and requires happens-before relationships to guarantee visibility (see the [memory model](../advanced/memory-model.md)). Functional programming removes that premise at the source:

| Functional property | Concurrency implication |
|-----------|----------|
| **Immutability** | data is never changed once created; any number of threads can read it, no races |
| **Pure functions** | they never touch external state; output depends only on input; parallelize freely |
| **Referential transparency** | an expression can be replaced by its value at any time; execution order does not matter |
| **Higher-order functions** | map/filter/reduce separate "what to do" from "how to parallelize" |

Concurrency control changes from "carefully arrange every step" to "there is no shared write at all" — the essential divide from the [threads and locks](../basics/concepts.md) route.

## Immutable data structures

Every "modification" returns a new value while the old value stays usable:

```clojure
(def list-1 '(1 2 3))
(def list-2 (conj list-1 4))   ; (4 1 2 3), list-1 unchanged
; the two lists share the same tail nodes, not a deep copy
```

The engineering key is **structural sharing**: the new version shares the unchanged parts with the old one, making writes close to O(log n) rather than O(n). Clojure's persistent vector (a 32-ary tree) and Haskell's purely functional data structures both take this route; Chapter 4 builds it into a complete state-management scheme, see [STM and the Clojure way](./stm.md#the-clojure-way-separating-identity-from-state).

## Functional parallelization

### Parallel map

```clojure
; pmap: one task per element, executed on a thread pool
(def imgs (pmap process-image image-urls))
```

Processing of each element is independent (guaranteed by purity), so the scheduler never worries about who mutated whose data.

### Parallel reduce (fold)

```clojure
(require '[clojure.core.reducers :as r])
; fold: chunked tree reduction, parallel between chunks, sequential within
(def total (r/fold + (r/map :price orders)))
```

The reduction tree is a natural fit for multiple cores: process chunks, merge partial results — data parallelism applied to a single machine's cores.

### Lazy sequences

```clojure
(def big-seq (map heavy-compute (range 1e9)))  ; returns immediately, nothing computed
(realize (nth big-seq 100))                     ; computed only when used
```

Evaluation time is decoupled from construction time, so producer and consumer need no explicit synchronization — laziness is itself a concurrency buffer.

## Future and Promise: dataflow programming

This is the day 3 content of the book's chapter 3: use `future` for "a value that will exist later" and `promise` for "a value written exactly once", with data dependencies determining execution order.

```clojure
; future returns immediately, the main thread is not blocked
(def prices  (future (fetch-prices)))
(def rates   (future (fetch-rates)))

; deref waits when the result is needed; dependencies are explicit
(def total (future (* @(fetch-prices) @rates)))

; promise: single assignment, multiple readers wait
(def result (promise))
(future (deliver result (heavy-compute)))
; ...other threads wait on @result for delivery
```

future/promise turns control flow into a dataflow graph: every future is a node, every value dependency an edge. This is the same idea as this repo's [dataflow model](./dataflow.md) at two levels — the book teaches dataflow programming inside the functional chapter, while this repo gives it a page of its own.

## Comparison with other models

| Dimension | Functional concurrency | Threads and locks | Actor | CSP |
|------|-----------|---------|-------|-----|
| Shared state | none (immutable) | yes, protected by locks | actor-private | passed over channels |
| Synchronization | none needed (a ready value is usable) | explicit locking | message queue | channel rendezvous |
| Deadlock possible | no | yes | low (when mailboxes are acyclic) | low |
| Best for | compute-intensive, side-effect-free transforms | low-level control, existing shared structures | stateful services | pipelines |

## Applicability

| Suitable for | Unsuitable for |
|------|--------|
| transform-heavy work: ETL, numerical computation, collection transforms | inherently mutable state machines (wrapping immutable values only adds indirection) |
| read-heavy write-light, snapshot semantics suffice | large buffers that need in-place updates (copy overhead) |
| multicore parallel processing of independent elements | code deeply integrated with existing mutable APIs |

## Pitfalls

| Pitfall | Consequence | Fix |
|------|------|------|
| closures capturing mutable objects | a "immutable" shell around a mutable core, races all the same | capture only immutable values; route mutable parts through STM/actors |
| pmap granularity too fine | task dispatch overhead eats the parallel gain | chunk first (partition then pmap) or use fold |
| realizing lazy sequences across threads | first evaluation runs on an unexpected thread, contending for locked resources | force on the producer side, read only on the consumer side |
| fake immutability | a `final` field in Java pointing at a mutable List | make internal state immutable too, or use persistent collections |
| treating futures as a thread pool | unbounded submission, piled-up OOM | explicit fixed-size executor, see [thread pools](../practice/thread-pool.md) |

## Chapter summary

Functional concurrency replaces **controlling mutability** with **eliminating it**: pure functions and immutable data make parallelism a natural property of the code, and future/promise encode dependencies into the dataflow. It does not solve "how to run a stateful service concurrently" — that is the territory of [actors](./actor.md), [CSP](./csp.md), and [STM](./stm.md). Choose among the four high-level models by state requirements; they do not substitute for one another.

## Sources

- *Seven Concurrency Models in Seven Weeks*, Chapter 3; see [authoritative book research](../research/books.md) for version information and the seven-day structure. The day 3 title follows the original Day 3 Dataflow Programming with Futures and Promises; the Chinese edition's table of contents lists it as the Chinese term for "functional concurrency"
- Example code is written fresh (Clojure 1.11 syntax), not copied from the book; `r/fold` and `pmap` semantics defer to the [clojure.org reference documentation](https://clojure.org/reference/reducers)

## References

- [Clojure refs (persistent data structures + STM)](https://clojure.org/reference/refs)
- [Scala Futures](https://docs.scala-lang.org/overviews/core/futures.html)

<!-- BACKLINKS-AUTO -->
## Related pages

- [security](/advanced/security.md)
- [trends](/advanced/trends.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [actor](actor.md)
- [data-parallel](data-parallel.md)
- [lambda-architecture](lambda-architecture.md)
- [stm](stm.md)
- [books](/research/books.md)
