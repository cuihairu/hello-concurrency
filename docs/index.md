---
layout: home

hero:
  name: Hello Concurrency
  text: Concurrency problems from the project
  tagline: Project notes on concurrency: from thread cooperation and state synchronization in game development, to the tradeoffs behind locks, Actors and memory models.
  image:
    src: /illustrations/hero.png
    alt: hello-concurrency hero illustration
  actions:
    - theme: brand
      text: Read the project notes
      link: /chapter_1
    - theme: alt
      text: Knowledge outline
      link: /knowledge
    - theme: alt
      text: GitHub
      link: https://github.com/cuihairu/hello-concurrency

features:
  - title: Fundamentals and primitives
    details: Concurrency vs parallelism, threads and processes, critical sections, deadlock and livelock; locks, semaphores, condition variables, barriers.
  - title: Seven concurrency models
    details: Actors, CSP, dataflow, STM and the Clojure way, functional concurrency, data parallelism, Lambda architecture.
  - title: Lock-free and memory models
    details: CAS and LL/SC, memory reclamation, happens-before and memory ordering; how four specifications differ on data races.
  - title: In the trenches
    details: Concurrent data structures, performance tuning and capacity planning; thread pools, producer–consumer, readers–writers, framework selection.
---

## References

- [Go Memory Model](https://go.dev/ref/mem)
- [Java Concurrency Tutorial (external link)](https://docs.oracle.com/javase/tutorial/essential/concurrency/)
