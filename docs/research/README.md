# 知识调查与来源总表

写这本书之前做了三类调研：权威书籍、官方内存模型规范、应用场景。调研结论落成四份文档，覆盖核对的差异与处置见差异表。

- [权威书籍调研](./books)：三本指定书加《七周七并发模型》的版本、章节结构与本仓对应关系
- [官方内存模型规范](./memory-model-specs)：JMM、C++、Rust、Go 四份规范的原文核对
- [应用场景调研](./applications)：高并发服务与游戏服务器
- [覆盖核对差异表](./coverage-audit)：逐页核对结果、补缺口清单与修订记录

## 取材方式

书目元数据取自出版社或豆瓣条目，规范引文取自各规范站点 2026-10-08 抓取的原文，场景要点取自公开工程文章与项目 README。每条引文都注明章节号或页面，方便复核。规范类来源以官方站点为准，中文版书目以版权页信息为准，两边冲突时按版权页写。

## 来源总表

| # | 类别 | 来源 | 核对到的要点 |
|---|------|------|--------------|
| 1 | 书籍 | [Java Concurrency in Practice 官方书站](https://jcip.net/) | 全书目录、代码示例与勘误入口 |
| 2 | 书籍 | [《Java并发编程实战》豆瓣条目](https://book.douban.com/subject/10484692/) | 机械工业出版社 2012-2，童云兰译，ISBN 9787111370048，293 页 |
| 3 | 书籍 | [C++ Concurrency in Action, Second Edition（Manning）](https://www.manning.com/books/c-plus-plus-concurrency-in-action-second-edition) | Anthony Williams，2019-02，ISBN 9781617294693，592 页 |
| 4 | 书籍 | [《C++并发编程实战（第2版）》豆瓣条目](https://book.douban.com/subject/35653912/) | 人民邮电出版社·异步图书 2021-11，吴天明译，ISBN 9787115573551，393 页 |
| 5 | 书籍 | [Seven Concurrency Models in Seven Weeks（PragProg）](https://pragprog.com/titles/pb7con/seven-concurrency-models-in-seven-weeks/) | Paul Butcher，2014-07，ISBN 9781937785659，296 页，七章目录 |
| 6 | 书籍 | [《七周七并发模型》豆瓣条目](https://book.douban.com/subject/26337939/) | 人民邮电出版社 2015-3，黄炎译，ISBN 9787115386069，244 页 |
| 7 | 书籍 | [《七周七并发模型》目录（360百科）](https://baike.so.com/doc/25698266-26784455.html) | 中文版第 2–8 章的七个模型排列 |
| 8 | 书籍 | [The Rustonomicon](https://doc.rust-lang.org/nomicon/) | Rust 官方维护的 unsafe 专著，自述仍不完整 |
| 9 | 官方规范 | [JLS SE21 第 17 章 Threads and Locks](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html) | §17.4 内存模型、§17.4.5 数据竞争定义与「正确同步」判据 |
| 10 | 官方规范 | [C++ 工作草案 [intro.races]](https://eel.is/c++draft/intro.races) | 「Any such data race results in undefined behavior」 |
| 11 | 官方规范 | [C++ 工作草案 [atomics.order]](https://eel.is/c++draft/atomics.order) | seq_cst 单一全序 S、coherence 四条约束 |
| 12 | 官方规范 | [Rust Reference: Behavior considered undefined](https://doc.rust-lang.org/reference/behavior-considered-undefined.html) | UB 清单第一条就是 Data races，unsafe 块同样适用 |
| 13 | 官方规范 | [std::sync::atomic 的内存模型说明](https://doc.rust-lang.org/std/sync/atomic/index.html) | Rust 原子操作沿用 C++20 [intro.races] 规则，去掉 consume |
| 14 | 官方规范 | [The Go Memory Model（2022-06-06 版）](https://go.dev/ref/mem) | DRF-SC 结论与「有竞争就检测并终止」的实现空间 |
| 15 | 场景 | [cloudwu/skynet README](https://github.com/cloudwu/skynet) | 多用户 Lua actor 框架，README 自述「often used in games」 |
| 16 | 场景 | [腾讯云开发者社区：Skynet 设计原理](https://cloud.tencent.com/developer/article/2519632) | Actor 模型、消息队列、actor 公平调度三节的写法 |
| 17 | 场景 | [腾讯云开发者社区：限流、熔断、降级、预热、背压](https://cloud.tencent.com/developer/article/1887928) | 五种流量手段的定义、限流算法清单、Tomcat 默认 200 工作线程 |
| 18 | 场景 | [Scaling Memcache at Facebook（NSDI '13）](https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala) | 跨机房热点缓存与 lease 一致性 |

## 下一步

差异与处置在[覆盖核对差异表](./coverage-audit)，已补的缺口与已修订的条目在同一页逐条列出，待办项也留在那里，不藏在别处。
