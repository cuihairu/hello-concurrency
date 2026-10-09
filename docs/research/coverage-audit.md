# 覆盖核对差异表

调研四份文档里引用的站内页面、许诺过的页面修订，逐条对照仓库现状核对。差异与处置都记在这一页：缺口进待办清单，改掉的进修订记录。复核按编号引用，不在别处另开账本。

## 逐页核对结果

调研文档以站内链接引用了 16 个页面。核对口径：链接能落到 `docs/` 下的真实文件才算存在，只有提法没有文件的不算。结果 14 个存在、2 个不存在。

| 引用页面 | 核对结果 | 引用处 |
|----------|----------|--------|
| /basics/concepts | 存在 | [books](./books)（Amdahl 定律出处） |
| /practice/thread-pool | 存在 | [books](./books)、[applications](./applications) |
| /practice/producer-consumer | 存在 | [books](./books)、[applications](./applications) |
| /practice/reader-writer | 存在 | [applications](./applications) |
| /practice/framework-selection | 存在 | [applications](./applications) |
| /advanced/data-structures | 存在 | [books](./books)、[applications](./applications) |
| /advanced/performance | 存在 | [books](./books)、[applications](./applications) |
| /advanced/lockfree | 存在 | [books](./books) |
| /advanced/memory-model | 存在 | [books](./books)、[memory-model-specs](./memory-model-specs) |
| /sync/locks | 存在 | [books](./books) |
| /models/actor | 存在 | [books](./books)、[applications](./applications) |
| /models/csp | 存在 | [books](./books)、[applications](./applications) |
| /models/dataflow | 存在 | [books](./books)（自加页，与七周书目录对不齐，口径见 books） |
| /models/stm | 存在 | [books](./books) |
| /models/functional | **不存在**，记缺口 G1 | [books](./books) 七模型表第 3 章 |
| /models/data-parallel | **不存在**，记缺口 G2 | [books](./books) 七模型表第 7 章 |

## 缺口清单

| 编号 | 缺口 | 说明 |
|------|------|------|
| G1 | 函数式并发页未落盘 | books 七模型表第 3 章原写「调研后补了」，核对时页面不存在，表内状态已改为未覆盖。待写 `models/functional.md` |
| G2 | 数据并行页未落盘 | 同上，对应第 7 章。待写 `models/data-parallel.md` |
| G3 | Lambda 架构（七周书第 8 章）未覆盖 | books 原有记录，维持待办 |
| G4 | STM 章只覆盖事务部分 | atom/agent/持久化数据结构未写，books 原有记录，维持待办 |

## 修订记录

| 编号 | 修订 | 状态 |
|------|------|------|
| R1 | `advanced/memory-model.md` 把「数据竞争 = 未定义行为」写成四语言通用结论，与[规范核对](./memory-model-specs)的结论冲突。已限定到 C++/Rust：核心概念的数据竞争定义改为按语言分述，模型对比表 Go 一行改为 DRF-SC 口径，本章小结同步改写 | 已完成 |
| R2 | `advanced/memory-model.md` 全页没有一条规范引用。已补「本章来源」一节，JMM、C++、Rust、Go 四份规范各给一条入口链接 | 已完成 |
| R3 | books 七模型表两行的「调研后补了」与页面现状不符。已改为未覆盖并指向本表 G1、G2，第 4、8 章两行补 G3、G4 指向 | 已完成 |

## 待办

G1–G4 留在本页，写一页销一条。缺口补齐后，本页核对结果表与 books 的七模型表要同步改。
