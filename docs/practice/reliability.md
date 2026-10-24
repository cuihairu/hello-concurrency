# Reliability Design

High-concurrency systems run on parts that fail: machines go down, networks break, disks go bad, clocks drift. The goal of reliability design is not "no errors" but **correct service even after errors occur**. Four things hold this chapter up -- fault tolerance mechanisms, consistency and distributed locks, persistence and recovery, and distributed transactions -- corresponding to README planning chapter 10.

## Failure model: first distinguish what is failing

| Failure type | Symptom | Countermeasure |
|----------|------|------|
| **Crash failure** | A process or machine stops completely | Redundant replicas, health checks, automatic restart |
| **Network partition** | Nodes are sometimes reachable, sometimes not | Majority decision, handle partitions explicitly |
| **Slow node / timeout** | Requests never return, the result is unknown | Timeout + retry with jitter + circuit breaker |
| **Partial failure** | A distributed call succeeds only halfway | Idempotent keys, reconciliation, transactional outbox |
| **Byzantine** | Nodes return wrong data | Validation and signatures, not covered in this page |

Two easily ignored facts: **a timeout is not the same as failure** -- after a call times out, the other side may already have executed successfully; before retrying you must first answer "is repeated execution harmful or not"; **a partition is not "the other side died"** -- network unreachability and node crash are indistinguishable from the client's view, which is exactly the root of the split-brain problem discussed below.

## Fault tolerance: redundancy, detection, and failover

High availability relies on redundancy, and the form of redundancy determines how failover happens:

| Form | Structure | Failover | Consistency cost |
|------|------|------|-----------|
| **Primary-hot-standby** | One write primary, several read-only replicas | Detect death, promote a replica | The promotion instant may lose acknowledged writes |
| **Multi-primary** | All nodes can write | No failover, but conflicts must be merged | Conflict resolution (CRDTs, business rules) |
| **Leaderless (quorum)** | Every node can write, writes go to a majority | No single point, failover is natural | Write latency rises with replica count |

**Detection should use leases, not heartbeats**: a heartbeat only says "I haven't heard from you in a while," while a lease says "I guarantee you are the primary for this period." Both can misjudge, so the write path also needs a **fencing token** -- a monotonically increasing token attached at lease issue, with the storage side rejecting writes carrying an older token. A lock-holding process pausing in GC for tens of seconds and then returning with an expired lease to write data is the real-world incident when there is no token. Facebook's Memcache lease mechanism handles the race between cache invalidation and repopulation, the same idea applied at the caching layer (see the [application scenario survey](../research/applications.md)).

Beyond detection and failover there is also **degradation**: return defaults when a dependency fails, turn off non-core features, bulkhead isolation to shrink the failure domain -- the full list of measures is in [the traffic governance section of the knowledge outline](../knowledge.md).

## Consistency and distributed locks

Consistency is a spectrum, not a switch:

| Level | Guarantee | Cost | Typical scenarios |
|------|------|------|----------|
| **Linearizable** | A single global order, reads see the latest write | Every read/write goes through a majority, highest latency | Locks, leader election, inventory deduction |
| **Causal consistency** | Causally related operations are ordered | Causal metadata must be maintained | Social feeds, comment trees |
| **Eventual consistency** | Converges after writes stop | Lowest latency | Counters, logs, geo-replication |

**The correct implementation of a distributed lock is not "SETNX with an expiry."** The lock service itself must be a majority (if single-node Redis goes down, the lock is gone), the lock must carry a fencing token, and a client's local clock is untrustworthy -- only the lock holder itself can estimate its expiry; this is the core criticism in Kleppmann's "How to do distributed locking" article (the Redlock controversy also stems from this). Engineering rules of thumb:

| Means | Guarantee | When it is enough |
|------|------|----------|
| Distributed lock + fencing | Mutual exclusion | Strongly consistent write paths, highest cost |
| Lease | Time-limited exclusivity | Can tolerate repeated execution after the lease expires |
| Idempotent keys | Correct results under at-least-once execution | The default answer for most business scenarios |

**If idempotence can solve it, do not use a lock**: a lock is coordination, idempotence is autonomy. Coordination pays an availability cost; autonomy does not.

## Persistence and recovery

The foundation of crash recovery is the **WAL (write-ahead log)**: append to the log first, then modify the data; on recovery, replay or roll back per the log. Checkpoints exist to shorten the replay window -- recovery time is proportional to the amount of log between "the last checkpoint and the crash point."

| Metric | Meaning | Typical target |
|------|------|----------|
| **RPO** | How much data can be lost at most | Determines replication and backup frequency |
| **RTO** | How long recovery takes | Determines failover and replay strategy |

A backup counts as a backup only if **recovery has been validated**: a backup file that will not open, an archive missing a WAL segment -- both are time bombs exposed only on the day of the incident. Recovery drills must be measured against the RTO, not estimated.

## Distributed transactions

| Pattern | Consistency | Cost | Use cases |
|------|--------|------|------|
| **Two-phase commit (2PC)** | Strong consistency | Coordinator is a single point, participants block waiting | Short transactions, same datacenter, XA scenarios |
| **Saga (compensating transactions)** | Eventual consistency | Each step needs an inverse operation, no isolation | Long flows: ordering, payment, fulfillment |
| **Local message table** | At least once | Consumer must be idempotent | Linking a business DB with a message queue |
| **TCC** | Eventual consistency | Business intrusion, three-phase implementation | Scenarios needing freeze semantics, such as funds |

2PC's blocking is most fatal when the coordinator crashes: participants wait holding locks, and the whole chain stalls. That is why cross-datacenter, long-flow transactions are all moving toward Saga and the local message table -- **trade blocking for compensability, trade isolation for idempotence**. The theoretical premise of this practice is acknowledging that "exactly once does not exist when the network is unreliable"; the best you can do is at-least-once plus idempotence (Helland, *Idempotence Is Not a Medical Condition*).

## Relationship to other pages

This page discusses failures, recovery, and cross-node correctness; the concurrency security page discusses resource exhaustion and race vulnerabilities from the angle of an attacker actively creating interleaving, see [concurrency and security](../advanced/security.md). The two pages intersect at resource limits, with different angles of judgment.

| Question | Go to which page |
|------|--------|
| Single-node races, deadlock, and starvation | [Critical sections and mutual exclusion](../basics/critical-section.md), [deadlock and livelock](../basics/deadlock-livelock.md) |
| Lock acquire/release semantics and timeouts | [Locks](../sync/locks.md) |
| At-least-once delivery and idempotence of Actor messages | [The Actor model](../models/actor.md) |
| The five measures: rate limiting, circuit breaking, degradation, backpressure | [The knowledge outline](../knowledge.md), scenario chapter |
| Selection: consistency requirements in the decision matrix | [Concurrency framework selection](./framework-selection.md) |
| Load test acceptance and latency jitter sources | [Performance tuning](../advanced/performance.md), [operating systems and concurrency](../advanced/os.md) |

## Pitfalls

| Pitfall | Consequence | Fix |
|------|------|------|
| Retrying to treat a timeout | The timed-out request may already have executed; duplicate charges, duplicate messages | Idempotent keys + retry with jitter; first answer "is repeated execution harmful" |
| Lock without a fencing token | After the lease expires, an old primary returns and writes, causing double writes | Token monotonic, storage side validates and rejects old tokens |
| Treating a partition as a crash | The minority self-elects as primary, split-brain double writes | Only a majority can win election, obey the majority after the partition heals |
| 2PC coordinator without high availability | Coordinator crashes, all participants block holding locks | Shorten transactions, or switch to Saga / local message table |
| Backups never validated by restore | Only discovered at incident time that the backup is unusable | Regular recovery drills, measure RPO/RTO rather than estimating |
| Primary-standby failover never rehearsed | The failover script fails in a real incident, RTO becomes RTO x N | Regular drills, fold failover into the release process |
| Saga compensation failure with no fallback | Half-completed state hangs forever | Compensation retries + manual intervention channel + reconciliation |

## Chapter summary

The main thread of reliability design has three strands: **failure is the normal state**, so timeouts, retries, and degradation are normal code, not exception paths; **a timeout is not failure**, so idempotence comes before retries and fencing comes before trusting a lease; **strong consistency must be bought with cost**, so the consistency level is a business decision, not a technical default. Single-node [locks and synchronization primitives](../sync/locks.md) solve "how do multiple threads avoid fighting each other"; this chapter solves "how do multiple machines not lose correctness when they fight" -- the former is a concurrency problem, the latter a distributed problem, and in engineering the latter is always layered on top of the former.

## Sources

- Engineering origin of redundancy and eventual consistency: Amazon, *Dynamo: Amazon's Highly Available Key-value Store* (SOSP 2007)
- Leases and lock service: Google, *The Chubby Lock Service for Loosely-Coupled Distributed Systems* (ACM TOCS 2009); the systematic criticism of fencing tokens is M. Kleppmann, [*How to do distributed locking*](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html) (2016, later collected in ACM SIGACT News)
- The argument that "exactly once does not exist": P. Helland, *Idempotence Is Not a Medical Condition* (ACM Queue, 2012)
- Original source of the Saga pattern: H. Garcia-Molina & K. Salem, *Sagas* (ACM SIGMOD 1987); 2PC's blocking property per J. Gray, *Concurrency Control and Recovery in Database Systems* (1987)
- Definition of linearizability: M. Herlihy & J. Wing, *Linearizability: A Correctness Condition for Concurrent Objects* (ACM TOPLAS 1990), same source as the progress guarantees on this repo's [lock-free programming](../advanced/lockfree.md) page
- This page corresponds to README planning chapter 10, "reliability design," which was previously missing across the whole repo; the Memcache lease scenario details are on the [application scenario survey](../research/applications.md) page

## References

- [Wikipedia: CAP theorem](https://en.wikipedia.org/wiki/CAP_theorem)
- [Brewer: CAP keynote](https://www.eecs.berkeley.edu/~brewer/cs262b-2004/PODC-keynote.pdf)
- [Raft consensus](https://raft.github.io/raft.pdf)

<!-- BACKLINKS-AUTO -->
## Related pages

- [os](/advanced/os.md)
- [security](/advanced/security.md)
- [trends](/advanced/trends.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [actor](/models/actor.md)
- [framework-selection](framework-selection.md)
- [frameworks](frameworks.md)
- [seven-weeks](seven-weeks.md)
- [applications](/research/applications.md)
- [locks](/sync/locks.md)
