# Threads and processes

A process is the basic unit of OS resource allocation, and a thread is the basic unit of CPU scheduling. Understanding their relationship is the starting point of concurrent programming.

## Processes

A process owns an independent address space containing a code segment, data segment, heap, stack, and other resources. Processes are strongly isolated from one another, but creation and switching are expensive.

### Process characteristics
- **Independence**: each owns a complete virtual address space and does not interfere with others
- **Dynamism**: a process is one execution of a program and has a lifecycle
- **Concurrency**: multiple processes can execute in parallel at the macro level
- **Structure**: composed of program, data, and PCB

### Process states
```
ready → running → blocked
 ↑          ↓
 └──────────┘
```

## Threads

A thread is a stream of execution inside a process. It shares the process's address space and resources, owning only a private stack, registers, and program counter.

### Thread advantages
- **Lightweight**: creation, destruction, and switching cost far less than for a process
- **Sharing**: naturally shares process memory, making communication efficient
- **Responsiveness**: a single multi-threaded process can serve many requests concurrently

### Thread models
| Model | Characteristics | Typical implementation |
|------|------|----------|
| User-level thread | Invisible to the kernel, fast switching, but blocking affects the whole process | Green threads |
| Kernel-level thread | Scheduled by the kernel, blocking does not affect other threads, high switching overhead | pthreads, Windows threads |
| Two-level model | Combines the advantages of both, mapping user threads onto kernel threads | Go goroutines, Java virtual threads |

How the two-level model is realized in each language (goroutines, virtual threads) is covered in [programming languages and concurrency support](../advanced/languages.md).

## Thread vs process comparison

| Dimension | Process | Thread |
|------|------|------|
| Address space | Independent | Shared |
| Creation cost | High (copies page tables, file descriptors, etc.) | Low (only allocates a stack and registers) |
| Switching cost | High (TLB flush, context switch) | Low (save/restore registers and stack pointer) |
| Communication | IPC (pipes, sockets, shared memory) | Shared memory, locks, condition variables |
| Stability | A crash does not affect other processes | One crashed thread terminates the whole process |
| Parallelism | Limited by the number of processes | High concurrency within a single process |

## Thread lifecycle

```
new → ready → running → blocked → terminated
           ↑        ↓
           └────────┘
```

## Context switching

Switching between threads involves: saving the current thread's registers, program counter, and stack pointer → restoring the target thread's context → flushing and refilling the pipeline. Threads share an address space, so a switch **does not flush the TLB** (page table entries are still valid); flushing the TLB is the job of a **process** switch, needed only after switching address spaces (PCID/ASID can further amortize that cost). Frequent switching severely hurts performance. Who decides to switch, and where the cost of preempted threads comes from, is covered in the scheduling section of [operating systems and concurrency](../advanced/os.md).

## Best practices

1. **I/O-bound**: multithreading significantly raises throughput; the thread count can be set to 2× the CPU core count
2. **CPU-bound**: the thread count should be roughly equal to the CPU core count, to avoid excessive switching
3. **Avoid thread leaks**: use a thread pool to manage lifecycle
4. **Thread-local storage**: keep per-thread private data in ThreadLocal to avoid synchronization overhead

## References

- [Wikipedia · Thread](https://en.wikipedia.org/wiki/Thread_(computing))
- [POSIX threads (man7)](https://man7.org/linux/man-pages/man7/pthreads.7.html)
- [Linux kernel documentation](https://www.kernel.org/doc/html/latest/)

<!-- BACKLINKS-AUTO -->
## Related pages

- [languages](/advanced/languages.md)
- [os](/advanced/os.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
