# STM Software Transactional Memory

STM (Software Transactional Memory) brings database **ACID transactions** to memory concurrency: it bundles a group of shared-memory operations into an **atomic transaction**, with optimistic execution, conflict detection, and automatic retry. It makes shared-memory concurrency as simple as writing sequential code.

## Core concepts

### Transaction boundaries
```haskell
-- Haskell STM
atomically $ do
    x <- readTVar varX
    y <- readTVar varY
    writeTVar varX (x + y)
    writeTVar varY (x - y)
```

```scala
// Scala STM (Akka STM / ScalaSTM)
atomic { implicit txn =>
    val x = refX()
    val y = refY()
    refX() = x + y
    refY() = x - y
}
```

```clojure
;; Clojure STM
(dosync
  (let [x @ref-x
        y @ref-y]
    (ref-set ref-x (+ x y))
    (ref-set ref-y (- x y))))
```

### Key properties
| Property | Meaning |
|------|------|
| **Atomicity** | operations inside a transaction either all succeed or all roll back |
| **Consistency** | a transaction moves the system from one consistent state to another |
| **Isolation** | concurrent transactions do not interfere with each other (serializable / snapshot isolation) |
| **Durability** | in-memory STM has no persistence; state is lost on restart (can pair with WAL) |

## Execution model: optimistic concurrency control

```
┌─────────────────────────────────────────────────────┐
│ 1. Begin transaction: record read-set / write-set    │
│    version numbers                                   │
├─────────────────────────────────────────────────────┤
│ 2. Execute the transaction body:                     │
│    - read: record (address, version) into read set   │
│    - write: cache in write set, do not touch memory  │
├─────────────────────────────────────────────────────┤
│ 3. Commit validation:                                │
│    - read-set versions unchanged?                    │
│    - write set conflict-free?                        │
│    ✓ → install write set atomically → success        │
│    ✗ → discard write set → retry / abort             │
└─────────────────────────────────────────────────────┘
```

### Version management strategies
| Strategy | Read cost | Write cost | Suitable scenarios |
|------|--------|--------|----------|
| **Global version number** | low | high (global lock) | read-heavy write-light, low contention |
| **Object-level version number** | medium | medium | general purpose |
| **Timestamp ordering** | low | low | distributed STM |
| **Multi-version concurrency control (MVCC)** | low (snapshot reads) | high (garbage collection) | read-intensive, long transactions |

## Language support compared

| Language/library | Key API | Character |
|---------|----------|------|
| **Haskell** | `TVar`, `atomically`, `retry`, `orElse` | language-level native, type safe, composable |
| **Clojure** | `ref`, `dosync`, `alter`, `commute`, `ensure` | persistent data structures, commute optimization |
| **Scala** | `Ref`, `atomic`, `Ref.View` | ScalaSTM, Akka STM, type safe |
| **Java** | `TransactionalMap`, `AtomicReference` (simplified) | Multiverse, DeuceSTM (bytecode weaving) |
| **C++** | `stm::transaction`, `stm::atomic` | libstm, GCC experimental branch |
| **Rust** | `stm::TVar`, `atomically` | compile-time borrow checking + runtime STM |
| **Python** | `stm.Transaction`, `TVar` | lightweight, GIL limits parallelism |
| **Go** | no mature library | use channels/CSP instead |

## The Clojure way: separating identity from state

The main topic of Chapter 4 of *Seven Concurrency Models in Seven Weeks* is not STM but Clojure's separation of "identity" from "value" — STM (ref) is only one of four reference types. This section records the model concepts and engineering tradeoffs; for version numbers, chapter structure, and coverage of the whole book, see [authoritative book research](../research/books.md).

### Identity and value

- **Value**: immutable; never changed once created; can be shared freely (see persistent data structures in [functional concurrency](./functional.md))
- **Identity**: a name pointing at some value; the value changes over time
- **State**: the value an identity points to at some moment

Changing state means pointing the identity at a new value, not mutating the old value. Contention is compressed to the single point of "switching the identity", and the ordering of that switch is guaranteed by each of the four reference types below.

### Four reference types

| Type | Coordinate | Synchronization | Typical use |
|------|------|---------|---------|
| **ref** | shared | STM transaction coordination (`dosync` + `alter`/`commute`) | multiple identities must change together |
| **atom** | shared | single identity, no coordination (`swap!`, CAS underneath) | counters, caches, independent config entries |
| **agent** | shared | asynchronous: `send`/`send-off` dispatches a function, executed serially on a queue | expensive updates (writing to disk, calling remote services) |
| **var** | thread-local | each thread has its own binding | dynamic scoping, in-thread context |

```clojure
;; atom: uncoordinated single-point update, CAS loop
(def counter (atom 0))
(swap! counter inc)

;; agent: asynchronous update, returns immediately after dispatch
(def log (agent []))
(send log conj "event-1")   ; the update is queued and runs on the agent's own thread

;; ref: coordinated multi-identity update — only here do you get STM
(dosync
  (alter account-a - 100)
  (alter account-b + 100))
```

Rule of thumb for choosing: **prefer atom over ref, and ref only when multiple identities must change together** — atom has no transaction overhead, and ref only comes in when several identities need an atomic, coordinated update; agent decouples "slow update" from "the caller waiting".

### Persistent data structures

atom/ref can hold any value, but taking a "snapshot on update" requires the old value to remain intact — this is achieved with persistent data structures: every update returns a new version that **shares structure** with the old version for the unchanged parts, rather than deep-copying.

- Vector: a 32-ary prefix tree; reads and writes by index are approximately O(log₃₂ n), with very small constants
- Map/List/Set: HAMT (Hash Array Mapped Trie) with linked sharing
- Only a few nodes along the path are updated, so memory overhead scales with tree height, not with a full copy

Without persistent structures, immutable state management is just theory; with them, Clojure can actually deliver "share everything, zero contention" — and this is the real reason this chapter belongs in the concurrency-models section: **ref coordinates the switching of persistent values, not the mutation of mutable memory**.

## Advanced features

### 1. Compositionality
```haskell
-- Transactions compose: small transactions combine into larger ones
transfer :: Account -> Account -> Amount -> STM ()
transfer from to amt = do
    withdraw from amt
    deposit to amt

-- orElse: fallback transaction
tryTransfer = transferA `orElse` transferB `orElse` retry
```

### 2. Conditional waiting (`retry` / `orElse`)
```haskell
-- Retry on insufficient balance instead of blocking the thread
withdraw acc amt = do
    bal <- readTVar acc
    if bal < amt then retry  -- release locks, wait for the relevant TVar to change
    else writeTVar acc (bal - amt)
```
**Advantage**: no busy waiting, no deadlock, automatic wakeup.

### 3. Commutativity optimization (`commute`)
```clojure
;; Commutative operations: addition, set union, map key-value update
(commute counter + 1)  ;; no conflict, applied directly
```
**Principle**: the result of commutative operations is unaffected by order, so they can be applied in parallel, dramatically reducing conflicts.

### 4. Nested transactions
```haskell
-- Nesting = composition: the inner part is just an STM action (type STM a),
-- placed directly inside the outer do block
inner :: STM Int
inner = do
    a <- readTVar tvA
    b <- readTVar tvB
    pure (a + b)

outer :: IO ()
outer = atomically $ do
    x <- inner        -- the inner read/write sets merge into the outer transaction
    writeTVar tvC x

-- Note: calling atomically inside atomically throws a NestedAtomically exception;
-- the correct form of an "inner transaction" is composing STM actions, not nesting atomically
```
**Flattening**: most implementations flatten nested transactions into a single top-level transaction; the inner effects are visible only to the outer one, and an outer rollback rolls the inner back too.

## Performance characteristics

| Metric | Typical value | Influencing factors |
|------|--------|----------|
| Transaction overhead | 50-200 ns (no conflict) | read/write set size, conflict rate |
| Conflict retry rate | < 5% (low contention) | critical-section size, degree of concurrency |
| Throughput | comparable to fine-grained locks | locks win under contention |
| Memory overhead | 2-5× the original data | version chains, read/write sets, logs |

### When STM beats locks
- **Complex invariants**: multi-object consistency constraints (e.g. tree structures, graph invariants)
- **Dynamic data structures**: concurrent modification of lists, trees, graphs
- **Compositionality requirements**: library code that must compose the caller's transactions
- **Low contention, read-heavy**: zero-cost MVCC reads

### When locks beat STM
- **Highly contended write hotspots**: counters, queue heads and tails
- **Long critical sections with I/O**: STM cannot roll back I/O
- **Real-time / low latency**: retry jitter is unacceptable
- **Simple mutual exclusion**: single object, a coarse-grained lock is enough

## Classic application scenarios

### 1. Concurrent data structures
```haskell
-- Concurrent red-black tree: insert/delete must maintain multi-node invariants
insert k v = atomically $ do
    root <- readTVar rootRef
    newRoot <- insertNode root k v
    writeTVar rootRef newRoot
```

### 2. In-memory database / cache
```scala
// Multi-key consistent read/write
atomic { implicit txn =>
    val user = users.get(id)
    val orders = ordersByUser.get(id)
    // guarantees user and orders are a consistent snapshot
}
```

### 3. Game state / simulation
```clojure
;; Entity component system (ECS) concurrent updates
(dosync
  (doseq [entity entities]
    (commute entity :position #(update-pos % dt))))
```

### 4. Configuration hot reload
```java
// Atomic switch of multiple config entries
atomic { txn ->
    configA.set(newA)
    configB.set(newB)
    configC.set(newC)
}  // readers see either the old config or the new config, never a mixed state
```

## Implementation challenges for STM

| Challenge | Solution |
|------|----------|
| **I/O is not rollbackable** | forbid I/O in transactions / deferred execution / compensating actions |
| **immutable objects escaping** | type-system constraints (Haskell) / runtime checks |
| **long-transaction starvation** | priorities, timestamp ordering, conflict managers |
| **garbage collecting version chains** | incremental GC, epoch-based reclamation |
| **interoperating with locked code** | acquiring a lock inside a transaction → deadlock risk / promote locks to transactions |

## Modern evolution

- **Hardware transactional memory (HTM, Intel TSX)**: cache-line-level CPU transactions, accelerating STM in practice
- **Hybrid TM**: HTM fast path + STM fallback path
- **Persistent STM (PSTM)**: transactions directly on NVM (Optane), crash recovery
- **Distributed STM**: cross-node transactions (RSTM, Transaction Chains)
- **Type-system integration**: Rust ownership + STM, Linear Types to prevent escapes

## Chapter summary

STM provides **ACID semantics** for shared-memory concurrency. Core value:
- **Eliminates deadlock**: optimistic execution, no waiting on locks
- **Compositionality**: transactions can be nested and composed; library-friendly
- **Simplifies reasoning**: write concurrency with a sequential-code mindset

**Engineering status quo**: Haskell/Clojure are production-mature; the JVM has ScalaSTM/Multiverse; other languages are mostly experimental. **Mainstream choice**: use locks/atomics/channels for simple cases; consider STM for complex invariants and strong compositionality needs. Two pages remain in the concurrency-models section: [functional concurrency](./functional.md) takes a different route — eliminate mutability before talking about concurrency; [data parallelism](./data-parallel.md) and the [Lambda architecture](./lambda-architecture.md) push parallelism onto heterogeneous hardware and full-scale data. For advanced topics (lock-free programming, memory model, concurrent data structures, performance tuning), see the sidebar.

## Sources

- *Seven Concurrency Models in Seven Weeks*, Chapter 4, The Clojure Way: Separating Identity and State (STM is the ref portion of it); see [authoritative book research](../research/books.md) for version information
- Language APIs defer to official references ([Clojure reference documentation](https://clojure.org/reference/refs), [GHC STM documentation](https://hackage.haskell.org/package/stm))
- Example code is written fresh, not copied from the book

## References

- [Clojure refs (STM)](https://clojure.org/reference/refs)
- [Wikipedia · Software transactional memory](https://en.wikipedia.org/wiki/Software_transactional_memory)

<!-- BACKLINKS-AUTO -->
## Related pages

- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [functional](functional.md)
- [books](/research/books.md)
