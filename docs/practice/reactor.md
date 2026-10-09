# Reactor 模式与事件驱动

C10K 问题的标准答案不是「更多线程」，而是**事件驱动**：少量线程用 I/O 多路复用等事件，事件就绪才分发处理。Reactor 模式是这套做法的结构抽象，Netty、Node.js、Redis、nginx、asyncio 都是它的实现。

## 两种思路：每连接一线程 vs 事件驱动

| 维度 | 每连接一线程 | Reactor 事件驱动 |
|------|------------|-----------------|
| 并发单元 | 线程（栈 MB 级） | 连接（状态 KB 级） |
| 等待方式 | 阻塞 I/O，线程挂起 | 多路复用（epoll），线程不挂 |
| 万连接成本 | 万线程，上下文切换吞掉 CPU | 单/少数线程即可承载 |
| 编程模型 | 顺序代码，直观 | 回调/状态机，异步化 |
| 瓶颈 | 线程调度与内存 | 事件分发与单线程处理时长 |

连接数增长后，前者的成本线性涨，后者近似平坦——这是 C10K 的分水岭。前提是 I/O 多路复用的硬件与内核支持，见[硬件与内存层次](../advanced/hardware.md)的 I/O 一节。

## 结构：Reactor 与 Handler

```
                 ┌──────────────┐
   事件 ────────→ │  Reactor     │  等待事件（select/epoll_wait）
                 │  分发器       │
                 └──────┬───────┘
                        │ 就绪事件分派
          ┌─────────────┼─────────────┐
          ↓             ↓             ↓
     ┌────────┐   ┌────────┐   ┌────────┐
     │Handler │   │Handler │   │Handler │   非阻塞处理，快速返回
     │ (连接1) │   │ (连接2) │   │ (连接3) │
     └────────┘   └────────┘   └────────┘
```

四个角色：

| 角色 | 职责 |
|------|------|
| **Handle** | 被监听的资源（socket、文件描述符） |
| **Event Demultiplexer** | 多路复用器，epoll/kqueue/select 的封装 |
| **Reactor** | 事件循环：等待就绪事件、分派给对应 Handler |
| **Handler** | 非阻塞地处理单个事件（读、写、连接、超时） |

**Handler 必须快**：事件循环是单线程（或多线程但每连接固定一线程），任一 Handler 阻塞，整条循环上的所有连接一起卡。耗时操作（DB 查询、磁盘 I/O、CPU 密集）要扔给业务线程池，处理完再回投事件循环——这是 Netty 的 EventLoop + BusinessExecutor、Redis 的单线程模型共同的约束。

## 变体：单 Reactor 到主从

| 变体 | 结构 | 适用 |
|------|------|------|
| **单 Reactor 单线程** | 一个循环管 accept、读写、业务 | Redis 式，逻辑极快、无阻塞调用 |
| **单 Reactor 多线程** | 一个循环管 I/O，业务扔线程池 | 连接数中等、业务有阻塞操作 |
| **主从 Reactor** | 主循环管 accept，多个从循环各管一批连接的读写 | Netty 默认（boss/worker 组），高连接数 |

Netty 的 boss 组接受连接、worker 组处理 I/O，每个 EventLoop 绑一个线程、管多个 Channel——事件循环数量可配，业务逻辑再下沉到独立线程池，避免污染 I/O 线程。

## Proactor：另一种异步形态

Reactor 是「就绪通知」：事件到了通知你去读。Proactor 是「完成通知」：你提交读请求，读完了通知你结果。Windows IOCP 是典型 Proactor，Linux 上 io_uring 也提供完成式接口。区别在于**谁做数据搬运**：Proactor 由内核搬到用户缓冲，Reactor 由用户线程自己搬。语言层的 async/await 语法糖多数建在 Reactor 上（Go netpoller、asyncio、Rust tokio），C#/Windows 侧更贴 Proactor。

## 与其他页的关系

| 问题 | 去哪页 |
|------|--------|
| epoll/io_uring 的内核侧原理 | [硬件与内存层次](../advanced/hardware.md) |
| 业务线程池的参数与拒绝策略 | [线程池设计](./thread-pool.md) |
| 背压：事件循环被生产速率压垮 | [生产者-消费者](./producer-consumer.md) |
| 与 Actor/CSP 的选型对比 | [并发框架选型](./framework-selection.md) |
| 异步等待的同步原语 | [条件变量](../sync/condition-variables.md) |

## 陷阱

| 陷阱 | 后果 | 修正 |
|------|------|------|
| Handler 里做阻塞调用 | 整条事件循环卡死，全部连接超时 | 耗时操作下沉业务线程池 |
| 事件循环线程数与核心数不匹配 | 跨核调度抖动，缓存失效 | 循环数≈核数，绑定线程 |
| 回调里抛异常未捕获 | 事件循环退出，服务静默失联 | 循环级兜底捕获与日志 |
| 写缓冲无界 | 慢消费者堆积内存直至 OOM | 高水位停写、低水位恢复（Netty 水位线） |
| 回调地狱 | 状态机散落，难维护 | async/await 或响应式流（Reactive Streams） |
| 忽视半包/粘包 | 协议解析错乱 | 定长/分隔符/长度字段编解码器 |

## 本章小结

Reactor 把「等待」从线程里拿出来交给内核，用事件分发把 I/O 成本摊平——高并发服务的默认结构。掌握三点即可落地：**Handler 不阻塞**、**事件循环数与核数匹配**、**背压要有水位线**。异步化的代价是控制流被打散，同步代码的直觉不再适用，这正是[并发框架选型](./framework-selection.md)要权衡的一维。

## 本章来源

- Reactor 模式原始出处为 D. C. Schmidt, *Reactor: An Object Behavioral Pattern for Concurrent Event Demultiplexing*（1995），后收入 POSA 卷二
- Proactor 与 IOCP 对照见 Schmidt 的 Proactor 论文；io_uring 见[内核文档](https://kernel.dk/io_uring.pdf)
- Netty 线程模型与水位线以 [Netty 官方文档](https://netty.io/wiki/user-guide-for-4.x.html)为准
- 本页对应 README 规划目录 6.5 与 7.2（Reactor 模式、事件驱动架构），是[权威书籍调研](../research/books.md)之外自加的一页
