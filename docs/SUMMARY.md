# Summary

> VitePress 结构映射文件。对应正文 25 个页面与调研底稿 5 页，导航结构以 .vitepress/config.mts 的 sidebar 为准，本文件仅作兼容性底稿。

- [引言](./chapter_1.md)
- [基础篇]
    - [并发基础概念](./basics/concepts.md)
    - [线程与进程](./basics/thread-process.md)
    - [临界区与互斥](./basics/critical-section.md)
    - [死锁与活锁](./basics/deadlock-livelock.md)
- [同步原语]
    - [锁](./sync/locks.md)
    - [信号量](./sync/semaphores.md)
    - [条件变量](./sync/condition-variables.md)
    - [屏障](./sync/barriers.md)
- [并发模型]
    - [Actor 模型](./models/actor.md)
    - [CSP 模型](./models/csp.md)
    - [数据流模型](./models/dataflow.md)
    - [STM 软件事务内存](./models/stm.md)
    - [函数式并发](./models/functional.md)
    - [数据并行](./models/data-parallel.md)
    - [Lambda 架构](./models/lambda-architecture.md)
- [进阶主题]
    - [无锁编程](./advanced/lockfree.md)
    - [内存模型](./advanced/memory-model.md)
    - [并发数据结构](./advanced/data-structures.md)
    - [性能调优](./advanced/performance.md)
- [实战篇]
    - [生产者-消费者](./practice/producer-consumer.md)
    - [读者-写者](./practice/reader-writer.md)
    - [线程池设计](./practice/thread-pool.md)
    - [并发框架选型](./practice/framework-selection.md)
- [知识点总纲](./knowledge.md)
- [调研底稿]
    - [调研总览与来源总表](./research/README.md)
    - [权威书籍调研](./research/books.md)
    - [官方内存模型规范](./research/memory-model-specs.md)
    - [应用场景调研](./research/applications.md)
    - [覆盖核对差异表](./research/coverage-audit.md)
