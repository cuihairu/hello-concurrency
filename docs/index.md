---
layout: home

hero:
  name: Hello Concurrency
  text: 高并发知识体系
  tagline: 从并发基础到内存模型，从同步原语到七种并发模型——无锁、性能调优与工程实战，一章一章把高并发讲透。
  actions:
    - theme: brand
      text: 开始阅读
      link: /chapter_1
    - theme: alt
      text: 知识点总纲
      link: /knowledge
    - theme: alt
      text: GitHub
      link: https://github.com/cuihairu/hello-concurrency

features:
  - title: 基础与同步原语
    details: 并发与并行、线程与进程、临界区、死锁与活锁；锁、信号量、条件变量、屏障。
  - title: 七种并发模型
    details: Actor、CSP、数据流、STM 与 Clojure 之道、函数式并发、数据并行、Lambda 架构。
  - title: 无锁与内存模型
    details: CAS 与 LL/SC、内存回收、happens-before 与内存序；四份规范的数据竞争口径对照。
  - title: 性能与实战
    details: 并发数据结构、性能调优与容量规划；线程池、生产者-消费者、读者-写者、框架选型。
---
