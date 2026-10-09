# 官方内存模型规范核对

本仓 [内存模型](/advanced/memory-model) 一章写过 JMM、C++ 与硬件模型，但整页没有一条规范引用，而且把「数据竞争 = 未定义行为」写成了四语言通用结论。这一轮把四份规范的原文抓下来逐条核对，结论先落在这里，页面上的修订见[差异表](./coverage-audit)的 R1、R2。

## 规范入口

| 语言/平台 | 规范 | 本次核对的位置 |
|-----------|------|----------------|
| Java | [JLS SE21 第 17 章 Threads and Locks](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html) | §17.4 内存模型，§17.4.5 happens-before 顺序与数据竞争 |
| C++ | [工作草案 [intro.races]](https://eel.is/c++draft/intro.races) | 6.10.2.2 Data races |
| C++ | [工作草案 [atomics.order]](https://eel.is/c++draft/atomics.order) | 原子操作的顺序要求、seq_cst 全序 S |
| Rust | [Reference: Behavior considered undefined](https://doc.rust-lang.org/reference/behavior-considered-undefined.html) | UB 清单与条目编号 `[undefined.race]` |
| Rust | [std::sync::atomic](https://doc.rust-lang.org/std/sync/atomic/index.html) | Memory model for atomic accesses 一节 |
| Go | [The Go Memory Model](https://go.dev/ref/mem)（2022-06-06 版） | Introduction 与 Informal Overview |
| Rust 进阶 | [The Rustonomicon](https://doc.rust-lang.org/nomicon/) | unsafe 语义与别名规则，官方自述仍不完整 |

## 数据竞争的后果：四份规范不是一回事

这是本轮核对最要紧的一条。同一个词「data race」，四种规范给出的后果不同，写成通用结论就是错的。

**Java（JLS §17.4）**。原文：「When a program contains two conflicting accesses (§17.4.1) that are not ordered by a happens-before relationship, it is said to contain a data race (§17.4.5).」接着是「A program is correctly synchronized if and only if all sequentially consistent executions are free of data races.」以及「a data race cannot cause incorrect behavior such as returning the wrong length for an array.」JLS 还明确说这一章描述的是「the behaviors that multithreaded programs are allowed to exhibit」，即 JMM 是在枚举多线程程序允许出现的行为，不引入 C++ 那种「未定义行为」：数据竞争让程序脱离「正确同步」的顺序一致保证，读到什么值变得不可预测，但语言层面仍然有定义。

**C++（[intro.races]）**。原文：「The execution of a program contains a data race if it contains two potentially concurrent conflicting actions, at least one of which is not atomic, and neither happens before the other ... Any such data race results in undefined behavior.」同一节的注释还写明，正确使用互斥锁与 `memory_order::seq_cst` 消除全部数据竞争的程序，表现得如同按顺序一致执行。也就是说 C++ 把数据竞争当 UB 交给编译器优化，这是四者中最激进的一种。

**Rust（Reference）**。UB 清单第一条就是「[undefined.race] Data races.」，清单开头的适用范围写的是「This includes code within unsafe blocks and unsafe functions.」安全 Rust 由借用检查器保证不产生数据竞争，写进 unsafe 之后这条约束自己兜底，出事就是 UB，没有「读到旧值」这种温和结局。

**Go（The Go Memory Model）**。原文：「A data race is defined as a write to a memory location happening concurrently with another read or write to that same location, unless all the accesses involved are atomic data accesses as provided by the sync/atomic package.」保证范围是「In the absence of data races, Go programs behave as if all the goroutines were multiplexed onto a single processor」，这就是 DRF-SC。对竞争本身，规范只留了实现空间：「An implementation may always react to a data race by reporting the race and terminating the program.」即可以检测到就报错退出，实践中 `-race` 就是干这个的。

## 四语言对照

| 维度 | Java | C++ | Rust | Go |
|------|------|-----|------|----|
| 数据竞争后果 | 脱离顺序一致保证，行为由 JMM 允许集合约束，非 UB | UB | UB（含 unsafe 块） | 实现可直接报错终止，未消除竞争时保证失效 |
| 判据/章节 | §17.4.5，冲突访问无 happens-before | [intro.races]，潜在并发的冲突动作 | Reference `[undefined.race]` | 写与并发读写同址且非 `sync/atomic` |
| 原子操作入口 | `VarHandle`、`java.util.concurrent.atomic` | `std::atomic` + 6 种 `memory_order` | `std::sync::atomic`，沿用 C++20 [intro.races] 规则、去掉 consume | `sync/atomic` |
| 顺序保证 | 正确同步 ⇒ 所有执行看起来顺序一致 | 数据竞争自由程序可见顺序一致 | 同 C++（读改写与一致性约束） | 无竞争时 DRF-SC |
| 现场检测 | `jcstress`、压测 | TSan、模型检查（GenMC/Nidhugg） | TSan、Miri | `-race` 内建检测器 |

Rust 那一格的原文值得单独记一句：「Rust atomics currently follow the same rules as C++20 atomics, specifically the rules from the intro.races section, without the 'consume' memory ordering.」Rust 没另起炉灶，直接复用 C++ 的条文，还顺手删掉了实践里没人真正用的 consume。写跨语言对照时把它当两个规范引用会重复计数，按一条规则算。

## seq_cst 到底强在哪

[atomics.order] 的原文：「There is a single total order S on all memory_order::seq_cst operations, including fences, that satisfies the following constraints.」加上 coherence-ordered 关系推出的四条约束，构成了「所有 seq_cst 操作彼此有序」的那半个直觉；另一半是 release/acquire 只在单个对象、单个发布-订阅链上生效，跨对象不连通。`relaxed` 只保原子性不保顺序，这条注释在 [atomics.order] 的 Note 里也有对应表述：「Implementations must still guarantee that any given atomic access to a particular atomic object be indivisible with respect to all other atomic accesses to that object.」

`memory-model.md` 里那张「C++ memory_order → x86 / ARM 指令」映射表属于编译器到硬件的实现层，规范不约束具体指令，读的时候要区分哪句是条文、哪句是常见实现。

## 对本仓的结论

1. `advanced/memory-model.md` 的通用小节里「数据竞争 = 未定义行为」必须限定到 C++/Rust，Java 与 Go 的表述另写，已按 R1 修订。
2. 页面补「本章来源」一节，四份规范各给一条入口链接，已按 R2 落地。
3. Rust 在 `memory-model.md` 只有一行表格，展开的材料以 Reference 的 UB 清单与 `std::sync::atomic` 的内存模型一节为准，需要时再开独立章节。
