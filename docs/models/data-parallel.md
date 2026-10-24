# Data Parallelism

Data parallelism is the topic of Chapter 7 of *Seven Concurrency Models in Seven Weeks*: **the same program, applied to every shard of the data**. Tasks are regular, and the parallelism comes from the data itself; this is the opposite direction from the "task parallelism" of actors/CSP — different tasks doing different things.

## Two kinds of parallelism

| Dimension | Data parallelism | Task parallelism |
|------|---------|---------|
| What is partitioned | data shards | tasks / functions |
| Executor behavior | each shard runs the same code | each task runs its own logic |
| Upper bound on parallelism | data size (easily thousands of ways) | task decomposition (usually tens of ways) |
| Load balancing | naturally even (shards are equal-sized) | needs a scheduler to balance heterogeneous tasks |
| Typical scenarios | image processing, numerical simulation, matrix math | microservice orchestration, pipelines, event handling |

The other concurrency-model pages in this repo ([actors](./actor.md), [CSP](./csp.md), [dataflow](./dataflow.md)) are all on the task-parallelism side; data parallelism is the other half of the map.

## Hardware foundation: from SIMD to SIMT

- **SIMD** (single instruction, multiple data): CPU vector instructions (x86 SSE/AVX, ARM NEON); one instruction computes on multiple data items at once, widths of 128/256/512 bits
- **SIMT** (single instruction, multiple threads): the GPU execution model, with thousands of lightweight threads running the same instruction in batches; NVIDIA schedules in warps of 32 threads

GPU and CPU designs point in opposite directions: CPUs use large caches and out-of-order execution to minimize single-thread latency, while GPUs use massive threads to hide memory latency — when one thread waits on memory, the scheduler immediately switches to another warp. The throughput-versus-latency tradeoff determines each one's sweet-spot workload.

## The OpenCL programming model

OpenCL is an open standard maintained by Khronos, one API targeting multiple device classes (CPU/GPU/FPGA); the book's chapter 7 uses it as the GPGPU teaching vehicle.

```
Host (CPU)                          Device (GPU)
──────────                          ──────────────
1. Select platform and device
2. Create context + command queue
3. Allocate buffer, copy data in   ─────────→  Global memory
4. Submit kernel                     NDRange partitioning:
                                     ┌─────────────┐
                                     │ WG  WG  WG  │  ← work-group
                                     │ WI WI WI WI │  ← work-item
                                     └─────────────┘
5. Copy results back                 ←─────────
```

| Concept | Meaning | CUDA equivalent |
|------|------|-----------|
| work-item | smallest execution unit, handling one (or a slice of) data | thread |
| work-group | a group of work-items; members can synchronize and share local memory | block |
| NDRange | global index space (1/2/3 dimensional) | grid |
| local memory | fast on-chip memory shared within a work-group | shared memory |

A kernel is a function running on the device; each work-item uses its own global id to work out which data shard it owns — "the same code × different data" is data parallelism translated directly.

## Classic pattern: reduction

Sum and max-style "many inputs folded into one output" operations have a naive serial form (O(n) steps); the parallel form is a **tree reduction** (O(log n) steps):

```
serial: 1 → +2 → +3 → +4 → ...          n steps
tree:   (1+2)(3+4)(5+6)(7+8)        log n steps
         ↓      ↓
         (a+b) (c+d)
             ↓
            sum
```

The key constraint on tree reduction: the merge operation must be **associative**. Floating-point addition is not strictly associative, so a parallel reduction may differ from a serial accumulation by rounding error — leave a tolerance in numerically sensitive cases; this is not a bug. Reduction is the single-machine prototype of the reduce semantics in [MapReduce and the Lambda architecture](./lambda-architecture.md).

## Performance characteristics

| Factor | Effect |
|------|------|
| Data transfer | host↔device goes over PCIe, far lower bandwidth than inside the GPU's own memory; small data or many round trips can eat up the entire computational gain (for accelerator placement and selection, see [hardware and the memory hierarchy](../advanced/hardware.md)) |
| Branch divergence | inside one warp, both sides of an if/else run and are then masked per thread; more branches means lower effective throughput |
| Access pattern | adjacent work-items must touch adjacent addresses to coalesce transfers; strided access collapses bandwidth |
| Occupancy | register and shared-memory usage determine the number of resident warps; too few resident warps and latency hiding fails |

## Applicability

| Suitable for | Unsuitable for |
|------|--------|
| compute-intensive: images, physics simulation, matrix math | branch-heavy logic |
| regular data structures: dense arrays, regular grids | pointer chasing: linked lists, tree traversal |
| large data, low share of transfer overhead | small data (not worth the kernel launch cost) |
| independent operations, or known patterns like reduction/scan | strong serial dependencies between steps |

## Pitfalls

| Pitfall | Consequence | Fix |
|------|------|------|
| ignoring transfer cost | the GPU computes fast but transfers slowly, total time exceeds the CPU | keep data resident on the device, batch transfers, use pinned memory |
| complex branches inside a kernel | divergence drags down the whole warp | keep logic branches on the host, or reorganize the data by branch |
| ignoring associativity | a floating-point reduction result differing from the serial version is mistaken for a bug | treat it as an inherent property of parallel reduction and accept on tolerance |
| using shared memory inside a work-group without synchronizing | data race, nondeterministic results | read only after a work-group barrier |
| writing kernels with CPU thinking | each thread does complex control flow, registers blow up, occupancy drops | each thread does simple uniform work, move control flow up |

## How this page relates to others

- fold/pmap in [functional concurrency](./functional.md) is data parallelism on multiple cores; this chapter extends it to heterogeneous accelerators
- the [dataflow model](./dataflow.md) is an orchestration abstraction (DAG scheduling), orthogonal to this chapter: each node inside a dataflow engine commonly executes with data parallelism
- [Amdahl's law](../basics/concepts.md): the serial part sets the upper bound on speedup; GPUs cannot save serial code

## Chapter summary

Data parallelism swaps the source of parallelism from "task decomposition" to "data sharding", at the cost of requiring the algorithm to accommodate the hardware's execution and memory-access models. The three-step engineering judgment: is the computation intensive, is the data regular, are branches rare — only when all three hold should you reach for a GPU; otherwise multicore data parallelism (fold in [functional concurrency](./functional.md)) is usually the cheaper answer.

## Sources

- *Seven Concurrency Models in Seven Weeks*, Chapter 7; see [authoritative book research](../research/books.md) for version information
- The OpenCL concept comparison defers to the [Khronos OpenCL specification](https://www.khronos.org/opencl/); CUDA terminology defers to the [NVIDIA CUDA documentation](https://docs.nvidia.com/cuda/)

## References

- [CUDA Toolkit](https://developer.nvidia.com/cuda-toolkit)
- [OpenMP specification](https://www.openmp.org/specifications/)
- [MPI documentation](https://www.mpi-forum.org/docs/)

<!-- BACKLINKS-AUTO -->
## Related pages

- [hardware](/advanced/hardware.md)
- [trends](/advanced/trends.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [actor](actor.md)
- [csp](csp.md)
- [functional](functional.md)
- [lambda-architecture](lambda-architecture.md)
- [stm](stm.md)
- [books](/research/books.md)
