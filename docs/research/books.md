# Authoritative Books Research

I use four books as references for the concurrency notes: *Java Concurrency in Practice*, *C++ Concurrency in Action*, *The Rustonomicon*, and *Seven Concurrency Models in Seven Weeks*. Below are their versions, structure, and how they map to this repo's topics.

## Java Concurrency in Practice

| Item | Value |
|----|----|
| Original | Java Concurrency in Practice, by Brian Goetz, Tim Peierls, Joshua Bloch, Joseph Bowbeer, David Holmes, Doug Lea; Addison-Wesley |
| Official book site | <https://jcip.net/> (TOC, sample code source jar, concurrency annotations jar, errata) |
| Chinese edition | "Java Concurrency in Practice" (zh-CN), translated by Tong Yunlan, China Machine Press 2012-02, ISBN 9787111370048, 293 pages |

Structurally the book proceeds "thread safety -> object sharing -> object composition -> foundational building blocks -> task execution -> cancellation and shutdown -> building concurrent applications", landing on correct use of `java.util.concurrent`: thread pool parameters, blocking queues, synchronized and concurrent containers, atomic variable classes, and annotations like `@ThreadSafe`/`@GuardedBy`.

How this repo uses it: `practice/thread-pool.md`'s parameter-combination pitfalls map to its task execution and thread pool chapters, `advanced/data-structures.md`'s concurrent containers and atomics map to the foundational building blocks chapter, and the blocking queue section of `practice/producer-consumer.md` shares the same source. The Intel researcher Doron Rajwan quote on the book site, "For the past 30 years, computer performance has been driven by Moore's Law; from now on, it will be driven by Amdahl's Law", is cited in the parallel-speedup section of [concurrency basics concepts](/basics/concepts) as the source for Amdahl's law inside a concurrency book.

## C++ Concurrency in Action

| Item | Value |
|----|----|
| Original | C++ Concurrency in Action, Second Edition, by Anthony Williams; Manning |
| Publication info | 2019-02, ISBN 9781617294693, 592 pages (as listed on the Manning page) |
| Chinese edition | "C++ Concurrency in Action" 2nd ed. (zh-CN), translated by Wu Tianming, POSTS & Telecom Press / Async Books 2021-11, ISBN 9787115573551, 393 pages |
| Book page | <https://www.manning.com/books/c-plus-plus-concurrency-in-action-second-edition> |

The chapter skeleton is: a first taste of concurrency -> memory model -> thread management -> shared data -> synchronization primitives -> lock-based data structures -> lock-free data structures -> lock-free design and memory order -> designing concurrent code. The book puts memory order before lock-free design; that order is worth copying: explain `memory_order` and its relation to hardware first, then Treiber stacks and Michael-Scott queues have grounding.

How this repo uses it: `advanced/memory-model.md`'s `memory_order` table, `advanced/lockfree.md`'s CAS and memory reclamation, and `sync/locks.md`'s `std::lock` for acquiring multiple locks at once all have matching chapters in the book. For 2nd edition metadata, the Manning page is authoritative; for the Chinese edition, the copyright page is authoritative. The page counts differ because Chinese and English typesetting and trim differ, not because they are two books.

## The Rustonomicon

| Item | Value |
|----|------|
| Positioning | The unsafe advanced reader in Rust's official docs, subtitle The Dark Arts of Unsafe Rust |
| Address | <https://doc.rust-lang.org/nomicon/> |
| Status | Homepage carries the warning "This book is incomplete" plus an issue list |

It is not a concurrency book, but the most critical parts of Rust's memory model are here: aliasing rules, the `Send`/`Sync` contract, `&T` and interior mutability, and the legal boundaries for raw pointers across threads. It is only useful read alongside the Rust Reference UB list: the Reference lists the rules, and the Rustonomicon explains why those rules look the way they do.

How this repo uses it: the "Rust ownership and locks" section of `sync/locks.md` and the Rust column of `advanced/memory-model.md` both defer to it and to [std::sync::atomic](https://doc.rust-lang.org/std/sync/atomic/index.html). The source-verification conclusions are in [official memory model specifications](./memory-model-specs).

## Seven Concurrency Models in Seven Weeks

| Item | English original | Chinese edition |
|----|----------|--------|
| Author | Paul Butcher | same |
| Publication | PragProg, 2014-07, ISBN 9781937785659, 296 pages | POSTS & Telecom Press 2015-03, translated by Huang Yan, ISBN 9787115386069, 244 pages |
| Book page | <https://pragprog.com/titles/pb7con/seven-concurrency-models-in-seven-weeks/> | [Douban entry](https://book.douban.com/subject/26337939/), [Chinese edition TOC](https://baike.so.com/doc/25698266-26784455.html) |

Chinese/English correspondence for the seven models, ordered by chapters 2-8 of the Chinese edition:

| Chapter | Chinese | Original | Status in this repo |
|----|------|------|----------|
| 2 | Threads and Locks | Threads and Locks | Covered by the six basics and sync-primitive pages |
| 3 | Functional Programming | Functional Programming | [Functional concurrency](/models/functional) covers it (G1 closed) |
| 4 | The Clojure Way: Separating Identity from State | The Clojure Way: Separating Identity from State | [STM and The Clojure Way](/models/stm) covers it: transactions plus atom/agent/persistent data structures (G4 closed) |
| 5 | Actors | Actors | [Actor model](/models/actor) covers it |
| 6 | Communicating Sequential Processes | Communicating Sequential Processes | [CSP model](/models/csp) covers it |
| 7 | Data Parallelism | Data Parallelism (GPGPU/OpenCL) | [Data parallelism](/models/data-parallel) covers it (G2 closed) |
| 8 | Lambda Architecture | Lambda Architecture (MapReduce/batch layer/speed layer) | [Lambda architecture](/models/lambda-architecture) covers it (G3 closed) |

Two points are worth writing down. First, the Chinese edition TOC labels chapter 3's Day 3 as "functional concurrency", whereas the original's Day 3 is Dataflow Programming with Futures and Promises - in other words, in the book, dataflow is the third day of the functional chapter, not a standalone chapter. This repo's [dataflow model](/models/dataflow) is a page we added ourselves and does not line up with the book's list of seven models; cross-checking is done on that basis. Second, chapter 4's STM is only part of "Separating Identity from State"; atoms and persistent data structures are the body of that chapter. `stm.md` has had a "The Clojure Way" section added, so chapter 4 counts as covered.

## How this repo uses these books

Citation practice when writing pages: concept definitions and pitfall lists refer to the books; things that can be pinned to a specification clause (data race consequences, memory order semantics) defer to the spec's original text; when a book and a spec conflict, follow the spec and note the source on the page. The four books only supply structure and explanation; example code is always written fresh, never copied from the books.

## References

- [Seven Concurrency Models in Seven Weeks](https://pragprog.com/titles/pb7con/seven-concurrency-models-in-seven-weeks/)
- [The Little Book of Semaphores](https://greenteapress.com/wp/semaphores/)
- [Java Concurrency in Practice](https://jcip.net/)

<!-- BACKLINKS-AUTO -->
## Related pages

- [data-structures](/advanced/data-structures.md)
- [hardware](/advanced/hardware.md)
- [languages](/advanced/languages.md)
- [lockfree](/advanced/lockfree.md)
- [os](/advanced/os.md)
- [concepts](/basics/concepts.md)
- [knowledge](/knowledge.md)
- [actor](/models/actor.md)
- [csp](/models/csp.md)
- [data-parallel](/models/data-parallel.md)
- [dataflow](/models/dataflow.md)
- [functional](/models/functional.md)
- [lambda-architecture](/models/lambda-architecture.md)
- [stm](/models/stm.md)
- [async](/practice/async.md)
- [producer-consumer](/practice/producer-consumer.md)
- [reactor](/practice/reactor.md)
- [seven-weeks](/practice/seven-weeks.md)
- [thread-pool](/practice/thread-pool.md)
- [README](README.md)
- [coverage-audit](coverage-audit.md)
- [locks](/sync/locks.md)
