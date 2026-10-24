# Frontier Trends and Outlook

The concurrency field changes far faster than operating systems and memory models do — the latter shift once a decade, while the former picks up new terms every year. This page sorts the landscape into three tiers — "backed by hardware," "validated in engineering," and "still at the paper stage" — so that trends are not mistaken for conclusions. It corresponds to Chapter 13 of the planned README outline.

## Tiers: Ask Which Tier First When Reading Trends

| Tier | Criterion | Examples |
|------|-----------|----------|
| **Hardware is ready** | Chips on sale, the kernel and languages have caught up | Virtual threads, io_uring, PMEM (in limited scenarios) |
| **Engineering-validated** | Used at large production scale, with the ecosystem following | Structured concurrency, Rust async, CRDT collaborative editing |
| **Paper / early** | Spec unsettled, ecosystem fragmented, cost unclear | Quantum concurrency, CXL memory pooling, compute-in-memory |

Placement decision: the first tier moves into main-text pages such as [Programming Languages and Concurrency Support](./languages.md), the second tier into the decision matrix of [Concurrent Framework Selection](../practice/framework-selection.md), and the third tier stays tracked here only — **the job of a trends page is to label tiers, not to predict winners**.

## The Hardware Layer: The Soil of Concurrency Is Shifting

| Direction | Current state | Effect on concurrent programming |
|-----------|---------------|----------------------------------|
| **Performance cores plus efficiency cores (big.LITTLE)** | Ubiquitous in phones and servers alike | Thread affinity shifts from "per core count" to "per core type"; tasks need priority levels |
| **CXL memory pooling** | Spec 3.0, server pilots | Memory becomes "a segment rented from a pool" rather than "belonging to this machine," making the NUMA model both more complex and more flexible |
| **PMem / byte-addressable persistence** | Commercial pullback (Optane discontinued), ecosystem settling | Persistent memory demands "crash-consistent data structures," converging with the WAL thinking of [Reliability Design](../practice/reliability.md) |
| **DPU / smart NICs** | Data center standard | Networking and encryption offload onto the NIC, leaving the host CPU for business logic |
| **General-purpose GPU compute and AI accelerators** | Mature | Data parallelism is a routine option; see [Data Parallelism](../models/data-parallel.md) |

Remember what does not change first: the cache hierarchy, cache coherence, and NUMA will not disappear in the foreseeable future, and [Hardware and the Memory Hierarchy](./hardware.md) remains the foundation. What changes are parameters — how many cores, what kind of cores, where memory hangs off.

## Languages and Runtimes: Three Convergence Lines

**One, structured concurrency replaces bare task submission.** In the era of thread pools plus Futures, a task's lifecycle was decoupled from its scope — the parent task ended while the child task was still running. Structured concurrency embeds concurrent units into lexical scope: before the scope exits, all child tasks must be joined, and cancellation propagates downward automatically. Kotlin coroutine scopes, Swift TaskGroup, and Java StructuredTaskScope (after Loom) are all on this line; see [Async Programming and Future](../practice/async.md).

**Two, virtual threads make "cheap blocking" the default.** Java 21 virtual threads, Go goroutines, Erlang processes, and .NET thread pools outside C# async all point the same direction: **they are threads from the programmer's perspective but M:N scheduling under the hood**. Blocking is no longer expensive, and the frame for analyzing lock contention and [OS scheduling](./os.md) changes with it — the bottleneck moves from "thread count" to "time actually holding the CPU."

**Three, Rust moves data races out of the runtime and into compile time.** The `Send`/`Sync` contracts make "can this be shared across threads" a compile-time check, turning race-class bugs from "occasional under stress" into "will not compile." It does not abolish the [Memory Model](./memory-model.md) — inside an `unsafe` boundary everything is as before — but it moves 99% of code out of the risk zone. The lesson for other languages is: safety has to come from types and ownership, not from discipline.

## The Architecture Layer: Concurrent Units Are Getting Bigger

The granularity of concurrency is moving up from "single-machine thread/coroutine" to "service and region":

| Direction | Content | Landing spot |
|-----------|---------|--------------|
| **Event sourcing and CQRS** | State is replayed from an event stream, with read and write separated | [Concurrent Framework Selection](../practice/framework-selection.md) |
| **Stream-batch unity (Kappa)** | Log replay replaces the duplicated logic of the Lambda architecture | [Lambda Architecture](../models/lambda-architecture.md) |
| **CRDT and local-first** | Merge converges with no central coordinator, the basis of collaborative editing | The loosest tier of the consistency spectrum; see [Reliability Design](../practice/reliability.md) |
| **WASM component model** | Cross-language sandboxed concurrent units, linear memory isolation | Early, under observation |

The common point: **trade away shared-state coordination for immutability and replay** — the old ideas of [Functional Concurrency](../models/functional.md) and [Actors](../models/actor.md), regrowing at distributed scale.

## Quantum Computing: One Paragraph of Its Own

Quantum concurrency is often listed on trend checklists, but the distinction comes first: **quantum parallelism** explores the solution space simultaneously through superposition (the source of speedups for the Grover and Shor algorithms), which is not the same thing as classical concurrency's "multiple execution flows sharing resources" — a qubit cannot be split for two threads, and decoherence plus measurement actually make "multi-tasking on one quantum machine" harder than the classical case. The engineering reality: today's quantum machines in the NISQ era are queued and submitted by classical schedulers, so talking about programming quantum concurrency is still early. **Its direct input to concurrency engineering is currently zero** — track it, do not let it into architecture decisions.

## Chapter summary

Three disciplines for reading trends: **ask which tier first** — hardware, engineering, and paper tiers carry completely different action implications; **remember the invariants first** — the cache hierarchy, happens-before, bounded resources, and idempotence do not change with trends, what changes are their parameters and carriers; **let trends move into main text rather than into anxiety** — when a tier reaches "hardware is ready," it naturally becomes a formal chapter in [Performance Tuning](./performance.md) or [Programming Languages and Concurrency Support](./languages.md).

## Sources

- Virtual threads and structured concurrency: [JEP 444](https://openjdk.org/jeps/444), [JEP 453](https://openjdk.org/jeps/453), and the [structured concurrency](https://kotlinlang.org/docs/coroutines-basics.html) section of the Kotlin coroutine documentation
- The CXL spec and ecosystem: the [CXL Consortium](https://www.computeexpresslink.org/); for DPUs and smart NICs see the public documentation of each vendor (AWS Nitro, NVIDIA BlueField)
- Rust's concurrency contracts: the [Send/Sync entries of the Rust Reference](https://doc.rust-lang.org/reference/send-and-sync.html)
- The name of structured concurrency: J. Lea, *Structured Concurrency with Structured Tasks* (InfoQ, 2018); the idea traces back to the multitasking resource-management problem surveyed by N. D. Jones (1970s)
- CRDT: M. Shapiro et al., *A Comprehensive Study of Convergent and Commutative Replicated Data Types* (INRIA, 2011)
- Distinguishing quantum parallelism from classical concurrency: Nielsen & Chuang, *Quantum Computation and Quantum Information* (Cambridge University Press); this page only distinguishes, it does not predict
- This page corresponds to Chapter 13, "Emerging Trends and the Future," of the planned README outline, which was previously an empty slot across the whole repository; the tier division is this repository's judgment (a research conclusion) and does not cite predictive articles

## References

- [The Rust Async Book](https://rust-lang.github.io/async-book/)
- [Tokio Tutorial (external link)](https://tokio.rs/tokio/tutorial)
- [Go Memory Model](https://go.dev/ref/mem)

<!-- BACKLINKS-AUTO -->
## Related pages

- [hardware](hardware.md)
- [languages](languages.md)
- [knowledge](/knowledge.md)
