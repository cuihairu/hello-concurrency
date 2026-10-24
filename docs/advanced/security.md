# Concurrency and Security

Concurrency problems can lose more than data — they can lose permissions, money, and secrets. Races are a major source of security vulnerabilities: **the time window between a check and its use** is the attacker's window of opportunity. Almost all the classic cases in security are concurrency problems — symlink attacks, kernel double-fetch, cache side channels — and at their core they are all "state was changed between two steps." This page corresponds to Chapter 11 of the planned README outline.

## How Races Become Vulnerabilities

| Vulnerability form | Where the race is | Consequence |
|--------------------|-------------------|-------------|
| **TOCTOU** (time-of-check to time-of-use) | Between the permission check and the actual operation, the file is swapped for a symlink | Unauthorized read/write, privilege escalation |
| **double-fetch** | The user buffer is read once in user space and once in kernel space, and the length changes between the two reads | Kernel heap out-of-bounds, privilege escalation |
| **Unshared shared state** | The configuration used for validation and the one used for execution are not the same | Validation bypass |
| **Initialization race** | An object is observed by other threads before initialization completes | Reads of dirty data, invariant bypass |
| **Random/keystore races** | Multiple threads share one PRNG state | Predictable keys, encryption rendered useless |

The common structure is that **a two-step operation is not atomic**: the critical section problem covered on the single-machine concurrency pages gains another meaning in the security setting — the attacker is **the party that actively creates the interleaving**, not random scheduling jitter. So "the race is unlikely" is not a security argument.

**There is only one fix: put the check and the use in the same atomic operation.**

```
# Wrong: check and use are separated, so the window can be crossed freely
if (os.access(path, W_OK)):
    write(path, data)     # at this moment path may point anywhere

# Right: one system call completes check plus use, or use O_NOFOLLOW / openat to close the window
fd = os.open(path, O_WRONLY | O_NOFOLLOW)   # checked on open; the fd no longer follows a rename
write(fd, data)
```

The countermeasure for a kernel double-fetch is the same in spirit: copy the buffer **only once** (a single `copy_from_user`), and use the kernel-side copy for everything after that.

## Deadlocks and Resource Exhaustion Are Security Problems Too

The availability side of concurrency is an attack surface as well:

| Attack | Mechanism | Countermeasure |
|--------|-----------|----------------|
| **Lock exhaustion** | Malicious requests trigger a large number of slow paths waiting on locks | Lock wait timeouts, bounded wait queues |
| **Slowloris** | Slowly holds connections; a one-thread-per-connection model is pinned | Connection limits, read timeouts, event-driven |
| **Unbounded queues exhaust memory** | Request rate exceeds processing rate and the queue grows without limit | Bounded queues plus a rejection policy; see [Thread Pool Design](../practice/thread-pool.md) |
| **Deadlock triggering** | The attacker constructs a specific interleaving that makes the service lock itself | Lock ordering, timed acquisition (`tryLock` with a timeout) |
| **Coroutine/connection leaks** | Each request leaves an uncollected task behind | Resource limits plus leak detection; see [Reliability Design](../practice/reliability.md) |

The common fix for these vulnerabilities is to **set an upper bound on every shared resource**: thread count, queue length, lock wait time, and connection count all need explicit limits. Unbounded means exhaustible — the same constraint as "bounded is an iron rule" in [Producer-Consumer](../practice/producer-consumer.md), except that in the security setting the one crossing the boundary is an attacker.

## Side Channels: "At the Same Time" Beyond Contention

Even without shared mutable state, "executing at the same time" leaks information:

| Side channel | Principle | Countermeasure |
|--------------|-----------|----------------|
| **Cache side channel** (Flush+Reload, Spectre) | Contend for the same cache line and infer a key from access times | Constant-time comparison, cache flushing (`clflush`), isolation (core scheduling) |
| **Timing attacks** | `strcmp` returns early, letting a key be guessed byte by byte | Use fixed-time comparison (`MessageDigest.isEqual`, `CRYPTO_memcmp`) |
| **Resource contention probing** | Observe how long a shared lock/queue is held and infer another party's load | Jitter, isolated resource pools |

The one engineering discipline this concurrency page emphasizes: **security-sensitive comparisons must be constant-time**. String equality comparisons in most languages return early; that is not an implementation defect but the very nature of the optimization — and applied to key comparison it is a vulnerability. Constant-time comparison is not a topic of this repository; it lives in each language's standard library functions, see [Programming Languages and Concurrency Support](../advanced/languages.md).

## Secure Coding Practices

Applied to concurrency, along the protection principles of Saltzer & Schroeder:

| Principle | Form in the concurrency setting |
|-----------|--------------------------------|
| **Economy** | Minimize shared mutable state — make things immutable when you can; see [Functional Concurrency](../models/functional.md) |
| **Complete mediation** | Re-check on every access; cached authorization decisions must be bound to their context and an expiry |
| **Fail-safe** | Default deny: when a lock times out, a queue is full, or a token has expired, deny rather than allow |
| **Psychological acceptability** | Correctness is backed by the type system and encapsulation, not by "the caller remembers to lock" |
| **Separation of privilege** | The validating thread and the executing thread hold different privileges, so an attacker must cross two steps |

Three items for the checklist:

1. **Shared state must have an owner**: either encapsulated inside a single actor/thread (see the [Actor Model](../models/actor.md)), or explicitly protected by a lock (see [Locks](../sync/locks.md)); there is no third option.
2. **Check and use are the same atomic**: every check of permission, rate limit, or balance must have its immediately following use in the same critical section or the same atomic operation.
3. **Every resource has a limit**: threads, queues, connections, and lock waits are all explicitly bounded, and over-limit requests are rejected.

## Detection Tools

| Tool | What it finds | Where it is used |
|------|---------------|------------------|
| **ThreadSanitizer (TSan)** | Data races, lock ordering errors | C/C++/Go/Rust (`-fsanitize=thread`, `-race`) |
| **Helgrind / DRD** | Data races and deadlocks | The Valgrind suite, C/C++ |
| **jcstress** | The real interleavings of concurrent code | JVM, an official OpenJDK tool |
| **rr / time-travel debugging** | Reproducing intermittent races | Linux x86 |
| **lockdep** | Lock ordering violations (runtime warnings) | The Linux kernel; portable to parts of user space |

The shared limitation: **a detector only covers the interleavings it actually ran**. The root cure for race-class vulnerabilities is structure (encapsulation, atomicity, immutability); detection is a supplement, not a replacement — the same point as "correctness comes from the model, not from luck" on the [Lock-Free Programming](../advanced/lockfree.md) page.

## Related pages

This page treats races and resource exhaustion as an attack surface; for fault detection, recovery goals, and cross-node consistency see [Reliability Design](../practice/reliability.md). The two pages share the question of resource boundaries but target different goals.

| Question | Go to |
|----------|-------|
| The definitions of a race and a critical section | [Critical Sections and Mutual Exclusion](../basics/critical-section.md) |
| Lock acquisition and timeout semantics | [Locks](../sync/locks.md) |
| Data race consequences across the four languages (including UB) | [Memory Model](../advanced/memory-model.md) |
| Bounded queues and resource limits | [Producer-Consumer](../practice/producer-consumer.md), [Thread Pool Design](../practice/thread-pool.md) |
| Fault models and resource exhaustion | [Reliability Design](../practice/reliability.md) |
| Per-language type/ownership guardrails | [Programming Languages and Concurrency Support](../advanced/languages.md) |

## Traps

| Trap | Consequence | Fix |
|------|-------------|-----|
| "The race is unlikely, so it is safe" | An attacker can actively create interleavings rather than waiting for random jitter | Assume interleavings are reachable and argue by atomicity |
| Reopening a file after a permission check | TOCTOU, the path was swapped | Get an fd with a single open and use only the fd afterwards |
| Reading a buffer twice | Kernel double-fetch out-of-bounds | Copy once and use the kernel-side copy |
| Comparing keys with `strcmp` | A timing attack guesses the key byte by byte | A fixed-time comparison function |
| Sharing a `Random`/key generator | Shared state across threads, predictable keys | One independent instance per thread, or use a CSPRNG |
| Relying on an unbounded queue to absorb traffic | An attacker fills the memory | Bounds plus rejection; see [Thread Pool Design](../practice/thread-pool.md) |
| Trusting a green TSan light alone | A detector only covers the interleavings it ran | Structural guarantees first, detection second |

## Chapter summary

Concurrency security in one sentence: **an attacker will actively create interleavings, so "occasional" does not hold**. Each of the three vulnerability classes has its own fix — TOCTOU and double-fetch are cured by "check and use in one atomic," resource exhaustion by "every shared resource explicitly bounded," and timing/cache side channels are suppressed by "constant time plus isolation." These are not new disciplines but a restatement, in front of an attacker, of principles already established on the [Critical Sections](../basics/critical-section.md), [Bounded Buffers](../practice/producer-consumer.md), and [Reliability Design](../practice/reliability.md) pages: state that can be changed concurrently can be attacked concurrently.

## Sources

- A systematic treatment of TOCTOU vulnerabilities: C. Cowan et al., *Covering the System Security Holes: TOCTOU* (1998) and T. Budden's analysis of Linux kernel TOCTOU (P0, 2022)
- The original analysis of double-fetch: D. A. Barrack et al. (2003); for the kernel-side countermeasure see the single-copy practice in Linux `copy_from_user`
- Cache side channels and constant-time comparison: P. Kocher et al., *Spectre Attacks* (2019) and D. J. Bernstein's *Cache-timing attacks* (2005)
- The protection principles: J. Saltzer & M. Schroeder, *The Protection of Information in Computer Systems* (Proc. IEEE, 1975)
- Detection tools: the [ThreadSanitizer documentation](https://clang.llvm.org/docs/ThreadSanitizer.html), the [jcstress documentation](https://openjdk.org/projects/code-tools/jcstress/), and the [Helgrind manual](https://valgrind.org/docs/manual/hg-manual.html)
- This page corresponds to Chapter 11, "The Security of High-Concurrency Systems," of the planned README outline, which was previously an empty slot across the whole repository; the example code was written here and is not copied from a book

## References

- [Wikipedia: Time-of-check to time-of-use](https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use)
- [Wikipedia: Race condition](https://en.wikipedia.org/wiki/Race_condition)

<!-- BACKLINKS-AUTO -->
## Related pages

- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [frameworks](/practice/frameworks.md)
- [seven-weeks](/practice/seven-weeks.md)
