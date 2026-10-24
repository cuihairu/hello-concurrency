---
layout: home

hero:
  name: Hello Concurrency
  text: 项目里的并发问题
  tagline: 并发问题的项目笔记：从游戏开发里的线程协作、状态同步，到锁、Actor 与内存模型的取舍。
  image:
    src: /illustrations/hero.png
    alt: hello-concurrency hero illustration
  actions:
    - theme: brand
      text: 看项目笔记
      link: /zh/chapter_1
    - theme: alt
      text: 知识点总纲
      link: /zh/knowledge
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
  - title: 工程现场
    details: 并发数据结构、性能调优与容量规划；线程池、生产者-消费者、读者-写者、框架选型。
---

## 参考资料

- [Go 内存模型](https://go.dev/ref/mem)
- [Java 并发教程（外部链接）](https://docs.oracle.com/javase/tutorial/essential/concurrency/)
