# Official Memory Model Specification Verification

The [memory model](/advanced/memory-model) chapter in this repo covers JMM, C++, and the hardware model, but the page carries not a single spec citation, and it wrote "data race = undefined behavior" as a universal conclusion across four languages. This round pulled the original text of all four specifications and verified clause by clause. The conclusions land here first; the resulting page revisions are R1 and R2 in the [discrepancy table](./coverage-audit).

## Specification entry points

| Language/platform | Specification | Location verified this round |
|-----------|------|----------------|
| Java | [JLS SE21 Chapter 17 Threads and Locks](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html) | §17.4 memory model, §17.4.5 happens-before ordering and data races |
| C++ | [Working draft [intro.races]](https://eel.is/c++draft/intro.races) | 6.10.2.2 Data races |
| C++ | [Working draft [atomics.order]](https://eel.is/c++draft/atomics.order) | Ordering requirements for atomic operations, the total order S of seq_cst |
| Rust | [Reference: Behavior considered undefined](https://doc.rust-lang.org/reference/behavior-considered-undefined.html) | The UB list and entry `[undefined.race]` |
| Rust | [std::sync::atomic](https://doc.rust-lang.org/std/sync/atomic/index.html) | The "Memory model for atomic accesses" section |
| Go | [The Go Memory Model](https://go.dev/ref/mem) (2022-06-06 edition) | Introduction and Informal Overview |
| Rust advanced | [The Rustonomicon](https://doc.rust-lang.org/nomicon/) | unsafe semantics and aliasing rules; the official text states it is still incomplete |

## Data race consequences: the four specifications are not one and the same

This is the most important finding of this verification round. The same word "data race" yields different consequences in the four specifications, so writing it as a universal conclusion is wrong.

**Java (JLS §17.4)**. Original text: "When a program contains two conflicting accesses (§17.4.1) that are not ordered by a happens-before relationship, it is said to contain a data race (§17.4.5)." Followed by "A program is correctly synchronized if and only if all sequentially consistent executions are free of data races." and "a data race cannot cause incorrect behavior such as returning the wrong length for an array." The JLS also states explicitly that this chapter describes "the behaviors that multithreaded programs are allowed to exhibit" - in other words the JMM enumerates the behaviors a multithreaded program is permitted to show; it does not introduce a C++-style "undefined behavior". A data race takes the program out of the sequentially consistent guarantee of correct synchronization, so the value you read becomes unpredictable, but at the language level the behavior is still defined.

**C++ ([intro.races])**. Original text: "The execution of a program contains a data race if it contains two potentially concurrent conflicting actions, at least one of which is not atomic, and neither happens before the other ... Any such data race results in undefined behavior." A note in the same section adds that a program which eliminates all data races by using mutexes correctly and `memory_order::seq_cst` behaves as if it executed in a sequentially consistent order. That is, C++ treats a data race as UB and hands it to compiler optimization - the most aggressive of the four.

**Rust (Reference)**. The first entry of the UB list is "[undefined.race] Data races.", and the scope statement at the head of the list reads "This includes code within unsafe blocks and unsafe functions." Safe Rust is guaranteed by the borrow checker to be free of data races; once you write unsafe, you are on your own to uphold that constraint, and failure is UB - there is no gentle outcome such as "reading a stale value".

**Go (The Go Memory Model)**. Original text: "A data race is defined as a write to a memory location happening concurrently with another read or write to that same location, unless all the accesses involved are atomic data accesses as provided by the sync/atomic package." The scope of the guarantee is "In the absence of data races, Go programs behave as if all the goroutines were multiplexed onto a single processor" - that is DRF-SC. For the race itself the spec leaves only implementation freedom: "An implementation may always react to a data race by reporting the race and terminating the program." In other words it may report and exit as soon as it detects one; in practice that is exactly what `-race` does.

## Four-language comparison

| Dimension | Java | C++ | Rust | Go |
|------|------|-----|------|----|
| Data race consequence | Falls outside the sequentially consistent guarantee; behavior is constrained by the set the JMM allows, not UB | UB | UB (including inside unsafe blocks) | The implementation may report and terminate outright; the guarantee lapses while races remain |
| Criterion / clause | §17.4.5, conflicting accesses with no happens-before | [intro.races], potentially concurrent conflicting actions | Reference `[undefined.race]` | A write concurrent with a read or write to the same address, and not via `sync/atomic` |
| Atomic operation entry | `VarHandle`, `java.util.concurrent.atomic` | `std::atomic` plus 6 `memory_order` values | `std::sync::atomic`, following the C++20 [intro.races] rules and dropping consume | `sync/atomic` |
| Ordering guarantee | Correctly synchronized implies all executions appear sequentially consistent | A race-free program is observable as sequentially consistent | Same as C++ (read-modify-write and coherence constraints) | DRF-SC in the absence of races |
| On-the-spot detection | `jcstress`, load testing | TSan, model checking (GenMC/Nidhugg) | TSan, Miri | The built-in `-race` detector |

The Rust cell's original text is worth recording separately: "Rust atomics currently follow the same rules as C++20 atomics, specifically the rules from the intro.races section, without the 'consume' memory ordering." Rust did not reinvent the ruleset; it reused C++'s clause verbatim and quietly dropped consume, which nobody actually uses in practice. When writing a cross-language comparison, counting this as two separate spec citations would double-count - treat it as one rule.

## What seq_cst is actually strong at

The original text of [atomics.order]: "There is a single total order S on all memory_order::seq_cst operations, including fences, that satisfies the following constraints." Together with the four constraints derived from the coherence-ordered relation, this forms the half of the intuition that "all seq_cst operations are mutually ordered"; the other half is that release/acquire act only on a single object, along a single publish-subscribe chain, and do not connect across objects. `relaxed` guarantees atomicity but not ordering, and the corresponding statement appears in the Note of [atomics.order]: "Implementations must still guarantee that any given atomic access to a particular atomic object be indivisible with respect to all other atomic accesses to that object."

The "C++ memory_order -> x86 / ARM instruction" mapping table in `memory-model.md` belongs to the compiler-to-hardware implementation layer; the specification does not constrain specific instructions, so when reading it, distinguish which sentence is a clause and which is a common implementation.

## Conclusions for this repo

1. The generic section of `advanced/memory-model.md` must restrict "data race = undefined behavior" to C++/Rust, with Java and Go phrased separately; revised per R1.
2. The page gains a "Sources" section, one entry link per specification; landed per R2.
3. Rust occupies only one table row in `memory-model.md`; the expanded material defers to the Reference UB list and the memory model section of `std::sync::atomic`, and can be split into a standalone chapter if needed.

## References

- [Go memory model](https://go.dev/ref/mem)
- [Java memory model (JLS 17)](https://docs.oracle.com/javase/specs/jls/se8/html/jls-17.html)
- [C++ memory order](https://en.cppreference.com/w/cpp/atomic/memory_order)
- [C11 memory order](https://en.cppreference.com/w/c/atomic/memory_order)

<!-- BACKLINKS-AUTO -->
## Related pages

- [languages](/advanced/languages.md)
- [memory-model](/advanced/memory-model.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [README](README.md)
- [books](books.md)
- [coverage-audit](coverage-audit.md)
