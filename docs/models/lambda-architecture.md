# Lambda Architecture

The Lambda architecture is the topic of Chapter 8 of *Seven Concurrency Models in Seven Weeks*, proposed by Nathan Marz at BackType/Twitter when processing full-scale data. The question it answers: **the data is too large and the queries too many — what to do when real-time computation cannot keep up**. The answer: a batch layer computes the full set slowly, a speed layer computes the increment quickly, and the two layers' results are merged at query time.

## Core structure

```
            ┌────────────── batch layer ──────────────┐
  new data → │ master dataset (immutable, append-only) │
            │   ↓ MapReduce batch jobs, recomputed     │
            │     periodically                          │
            │ batch views                               │
            └──────────────┬───────────────────────────┘
                           ↓ merge
  queries ────────────→  serving layer ──→ results
                           ↑ merge
            ┌──────────────┴───────────────────────────┐
            │ speed layer: incremental data outside     │
            │ the batch window (Storm / stream           │
            │ processing, real-time views)               │
            └───────────────────────────────────────────┘
```

The three layers' responsibilities:

| Layer | Responsibility | Latency | Technology |
|----|------|------|------|
| **Batch layer** | stores the full master dataset, periodically recomputes batch views | hours | Hadoop/MapReduce, Spark |
| **Speed layer** | fills in the increments inside the batch window, computes real-time views | seconds | Storm, Flink, Spark Streaming |
| **Serving layer** | merges batch views with real-time views for queries | — | specialized databases (ElephantDB, etc.) |

## Key design decisions

### Immutable master dataset

All data is append-only, never modified, so any view can be recomputed from the master dataset at any time. This buys three properties:

- **Simple fault tolerance**: if a machine fails, recompute that batch; no complex distributed recovery protocol is needed
- **Human fault tolerance**: if the code is wrong, fix it and recompute, and the bad data is completely overwritten — Marz calls this human-fault tolerance
- **Free evolution**: when a view algorithm is upgraded, just recompute the full set once; the old data never degrades

This is the immutability idea from [functional concurrency](./functional.md) moved into a distributed data system: data is not changed, so concurrency (and crash recovery) shifts from "control" to "recomputation".

### Batch views = precomputation

Queries never touch the raw data, only the precomputed views (indexes, aggregation tables). A view function must be **idempotent under arbitrary recomputation**: given the same master dataset input, the output view is always the same.

### The two layers merge at query time

The batch views are old but accurate, the real-time views are new but rough; the serving layer stitches them together to answer queries. Once the batch layer catches up, the corresponding increments from the speed layer are voided.

## Costs and criticisms

| Cost | Explanation |
|------|------|
| **the same logic written twice** | batch and speed layers use different frameworks, so the same aggregation logic needs two implementations and two maintenance paths; changing the semantics means changing two places |
| operating two sets of systems | Hadoop + stream processing + serving layer, many components |
| recomputation cost | a full recomputation consumes resources; the batch window is a tradeoff between latency and cost |

The standard response to "logic twice" is the **Kappa architecture** (Jay Kreps, 2014): drop the batch layer and keep only stream processing; when a recomputation is needed, replay the log from the beginning with a new consumer group (Kafka retains the full log). Kappa buys a single code path, at the cost of pushing recomputation pressure onto the streaming system. The two are different tradeoffs on the same problem, not substitutes: when the batch window is controllable and recomputation cost is budgetable, Lambda is more stable; when logic changes frequently and operations capacity is thin, Kappa is cheaper.

## Relationship to concurrency models

The Lambda architecture introduces no new synchronization primitive; its concurrency comes from the three-layer structure:

- batch jobs and stream shards are naturally parallel — [data parallelism](./data-parallel.md) (shards running the same aggregation logic) shares a root with the reduce semantics of MapReduce (associative reduction)
- the immutable master dataset makes reads and writes race-free — immutability from [functional concurrency](./functional.md) applied at big-data scale
- the two paths, batch and stream, are the [dataflow model](./dataflow.md)'s DAG expressed at system level

## Applicability

| Suitable for | Unsuitable for |
|------|--------|
| queries where huge historical data and real-time requirements coexist | purely real-time small data (one streaming system suffices) |
| views that can be fully recomputed, with stable aggregation logic | strongly transactional updates (an immutable master dataset does not help) |
| high fault-tolerance requirements, errors that must be fully traceable | teams that cannot maintain two sets of systems |

## Chapter summary

The Lambda architecture splits "cannot compute fast enough" into two paths — "slow and complete" and "fast and incremental" — relying on an immutable master dataset to guarantee that both eventually converge and that errors can be recomputed. Its high-level abstractions — separation of batch and stream, precomputed views, append-only storage — are the common source for understanding modern data systems (unified batch-stream, materialized views, log-as-database); Kappa is the direction it simplified toward after streaming matured.

## Sources

- *Seven Concurrency Models in Seven Weeks*, Chapter 8; see [authoritative book research](../research/books.md) for version information
- The original definition of the Lambda architecture is on the companion site [lambda-architecture.net](http://lambda-architecture.net/) to Nathan Marz and James Warren, *Big Data* (Manning, 2015); the Kappa architecture comes from Jay Kreps's 2014 article *Questioning the Lambda Architecture* (O'Reilly Radar)

## References

- [Wikipedia · Lambda architecture](https://en.wikipedia.org/wiki/Lambda_architecture)
- [MapReduce paper](https://static.googleusercontent.com/media/research.google.com/en//archive/mapreduce-osdi04.pdf)

<!-- BACKLINKS-AUTO -->
## Related pages

- [trends](/advanced/trends.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [data-parallel](data-parallel.md)
- [dataflow](dataflow.md)
- [stm](stm.md)
- [books](/research/books.md)
