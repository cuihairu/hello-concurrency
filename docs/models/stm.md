# STM 软件事务内存

STM (Software Transactional Memory) 将数据库 **ACID 事务** 引入内存并发：将一组共享内存操作打包为**原子事务**，乐观执行、冲突检测、自动重试。让共享内存并发像写顺序代码一样简单。

## 核心概念

### 事务边界
```haskell
-- Haskell STM
atomically $ do
    x <- readTVar varX
    y <- readTVar varY
    writeTVar varX (x + y)
    writeTVar varY (x - y)
```

```scala
// Scala STM (Akka STM / ScalaSTM)
atomic { implicit txn =>
    val x = refX()
    val y = refY()
    refX() = x + y
    refY() = x - y
}
```

```clojure
;; Clojure STM
(dosync
  (let [x @ref-x
        y @ref-y]
    (ref-set ref-x (+ x y))
    (ref-set ref-y (- x y))))
```

### 关键属性
| 属性 | 含义 |
|------|------|
| **原子性** | 事务内操作要么全成功、要么全回滚 |
| **一致性** | 事务将系统从一致状态转移到一致状态 |
| **隔离性** | 并发事务互不干扰 (可串行化/快照隔离) |
| **持久性** | 内存 STM 无持久化，重启丢失 (可配合 WAL) |

## 执行模型：乐观并发控制

```
┌─────────────────────────────────────┐
│  1. 开始事务：记录读集、写集版本号   │
├─────────────────────────────────────┤
│  2. 执行事务体：                     │
│     - 读：记录 (地址, 版本) 到读集   │
│     - 写：缓存到写集，不修改内存     │
├─────────────────────────────────────┤
│  3. 提交验证：                       │
│     - 读集版本未变？                 │
│     - 写集无冲突？                   │
│     ✓ → 原子安装写集 → 成功         │
│     ✗ → 丢弃写集 → 重试/回滚        │
└─────────────────────────────────────┘
```

### 版本管理策略
| 策略 | 读开销 | 写开销 | 适用场景 |
|------|--------|--------|----------|
| **全局版本号** | 低 | 高 (全局锁) | 读多写少、低竞争 |
| **对象级版本号** | 中 | 中 | 通用 |
| **时间戳排序** | 低 | 低 | 分布式 STM |
| **多版本并发控制 (MVCC)** | 低 (快照读) | 高 (垃圾回收) | 读密集、长事务 |

## 语言支持对比

| 语言/库 | 关键 API | 特色 |
|---------|----------|------|
| **Haskell** | `TVar`, `atomically`, `retry`, `orElse` | 语言级原生、类型安全、可组合 |
| **Clojure** | `ref`, `dosync`, `alter`, `commute`, `ensure` | 持久化数据结构、commute 优化 |
| **Scala** | `Ref`, `atomic`, `Ref.View` | ScalaSTM、Akka STM、类型安全 |
| **Java** | `TransactionalMap`, `AtomicReference` (简化) | Multiverse、DeuceSTM (字节码织入) |
| **C++** | `stm::transaction`, `stm::atomic` | libstm、GCC 实验分支 |
| **Rust** | `stm::TVar`, `atomically` | 编译期借用检查 + 运行时 STM |
| **Python** | `stm.Transaction`, `TVar` | 轻量、GIL 限制并行度 |
| **Go** | 无成熟库 | 推荐用 Channel/CSP 替代 |

## Clojure 之道：分离标识与状态

《七周七并发模型》第 4 章的主体不是 STM，而是 Clojure 对「标识」与「值」的分离——STM（ref）只是四种引用类型之一。

### 标识与值

- **值（value）**：不可变，创建后不改，可任意共享（见[函数式并发](./functional.md)的持久化数据结构）
- **标识（identity）**：指向某个值的名字，值随时间变化
- **状态（state）**：标识在某个时刻指向的值

改状态 = 把标识指向新值，而不是改旧值。竞争被压缩到「标识切换」这一个点，而切换的有序性由下面四类引用分别保证。

### 四类引用类型

| 类型 | 坐标 | 同步方式 | 典型用途 |
|------|------|---------|---------|
| **ref** | 共享 | STM 事务协调（`dosync` + `alter`/`commute`） | 多标识必须一起变 |
| **atom** | 共享 | 单标识无协调（`swap!`，底层 CAS） | 计数器、缓存、独立配置项 |
| **agent** | 共享 | 异步：`send`/`send-off` 投递函数，队列串行执行 | 更新代价高的状态（写盘、调远程） |
| **var** | 线程本地 | 每线程独立绑定 | 动态作用域、线程内上下文 |

```clojure
;; atom：无协调的单点更新，CAS 循环
(def counter (atom 0))
(swap! counter inc)

;; agent：异步更新，发送后立即返回
(def log (agent []))
(send log conj "event-1")   ; 更新在 agent 自己的线程排队执行

;; ref：多标识协调，才有 STM
(dosync
  (alter account-a - 100)
  (alter account-b + 100))
```

选择口诀：**能 atom 不 ref，能 ref 锁不死**——atom 没有事务开销，ref 只在多个标识需要原子联动时上场；agent 把「更新慢」与「调用方等待」解耦。

### 持久化数据结构

atom/ref 能装任何值，但「改出快照」的前提是旧值不被破坏——这靠持久化数据结构（persistent data structure）实现：每次更新返回新版本，与旧版本**结构共享**未改动部分，不深拷贝。

- Vector：32 叉前缀树，按索引读写近似 O(log₃₂ n)，常数级很小
- Map/List/Set：HAMT（哈希数组映射前缀树）与链式共享
- 更新的是路径上的少数节点，内存开销与树高成正比，不是全量复制

没有持久化结构，不可变状态管理只是理论；有了它，Clojure 才能把「共享一切、竞争为零」落到实处——这也是本章落进并发模型篇的真正原因：**ref 协调的是持久化值的切换，不是可变内存的修改**。

## 进阶特性

### 1. 组合性
```haskell
-- 事务可组合：小事务组合成大事务
transfer :: Account -> Account -> Amount -> STM ()
transfer from to amt = do
    withdraw from amt
    deposit to amt

-- orElse：备选事务
tryTransfer = transferA `orElse` transferB `orElse` retry
```

### 2. 条件等待 (`retry` / `orElse`)
```haskell
-- 余额不足时重试，而非阻塞线程
withdraw acc amt = do
    bal <- readTVar acc
    if bal < amt then retry  -- 释放锁、等待相关 TVar 变化
    else writeTVar acc (bal - amt)
```
**优势**：无忙等待、无死锁、自动唤醒。

### 3. 交换律优化 (`commute`)
```clojure
;; 交换律操作：加法、集合合并、Map 更新键值
(commute counter + 1)  ;; 无冲突，直接应用
```
**原理**：交换律操作顺序不影响结果，可并行应用，大幅降低冲突。

### 4. 嵌套事务
```haskell
-- 嵌套 = 组合：内层只是一段 STM 动作（类型 STM a），直接放进外层 do 块
inner :: STM Int
inner = do
    a <- readTVar tvA
    b <- readTVar tvB
    pure (a + b)

outer :: IO ()
outer = atomically $ do
    x <- inner        -- 内层读写集并入外层事务
    writeTVar tvC x

-- 注意：atomically 里面再调用 atomically 会抛 NestedAtomically 异常；
-- 「内层事务」的正确形态是组合 STM 动作，而不是嵌套 atomically
```
**扁平化**：多数实现将嵌套事务扁平化为单一顶层事务；内层的效果仅对外层可见，外层回滚则一并回滚。

## 性能特征

| 指标 | 典型值 | 影响因素 |
|------|--------|----------|
| 事务开销 | 50-200 ns (无冲突) | 读写集大小、冲突率 |
| 冲突重试率 | < 5% (低竞争) | 临界区大小、并发度 |
| 吞吐量 | 细粒度锁相当 | 冲突时锁更优 |
| 内存开销 | 2-5× 原数据 | 版本链、读写集、日志 |

### 何时 STM 胜过锁
- **复杂不变量**：多对象一致性约束 (如树结构、图不变量)
- **动态数据结构**：链表、树、图的并发修改
- **组合性需求**：库代码需组合调用方事务
- **低竞争、读多写少**：MVCC 读零开销

### 何时锁胜过 STM
- **高竞争写热点**：计数器、队列头尾
- **长临界区含 I/O**：STM 不支持 I/O 回滚
- **实时/低延迟**：重试抖动不可接受
- **简单互斥**：单对象、粗粒度锁足够

## 经典应用场景

### 1. 并发数据结构
```haskell
-- 并发红黑树：插入/删除需维护多节点不变量
insert k v = atomically $ do
    root <- readTVar rootRef
    newRoot <- insertNode root k v
    writeTVar rootRef newRoot
```

### 2. 内存数据库 / 缓存
```scala
// 多键一致性读写
atomic { implicit txn =>
    val user = users.get(id)
    val orders = ordersByUser.get(id)
    // 保证 user 与 orders 快照一致
}
```

### 3. 游戏状态 / 仿真
```clojure
;; 实体组件系统 (ECS) 并发更新
(dosync
  (doseq [entity entities]
    (commute entity :position #(update-pos % dt))))
```

### 4. 配置热更新
```java
// 多配置项原子切换
atomic { txn ->
    configA.set(newA)
    configB.set(newB)
    configC.set(newC)
}  // 读者看到旧配置或新配置，不会看到混合态
```

## STM 实现难点

| 难点 | 解决方案 |
|------|----------|
| **I/O 不可回滚** | 禁止事务内 I/O / 延迟执行 / 补偿动作 |
| **不可变对象逃逸** | 类型系统约束 (Haskell) / 运行时检查 |
| **长事务饥饿** | 优先级、时间戳排序、冲突管理器 |
| **垃圾回收版本链** | 增量 GC、epoch-based reclamation |
| **与锁代码互操作** | 事务内获取锁 → 死锁风险 / 锁升级为事务 |

## 现代演进

- **硬件事务内存 (HTM, Intel TSX)**：CPU 缓存行级事务，STM 落地加速
- **混合 TM**：HTM 快速路径 + STM 回退路径
- **持久化 STM (PSTM)**：NVM (Optane) 上直接事务，崩溃恢复
- **分布式 STM**：跨节点事务 (RSTM、Transaction Chains)
- **类型系统集成**：Rust 所有权 + STM、Linear Types 防逃逸

## 本章小结

STM 为共享内存并发提供了 **ACID 语义**，核心价值：
- **消除死锁**：乐观执行、无锁等待
- **组合性**：事务可嵌套、组合，库代码友好
- **简化推理**：顺序代码思维写并发

**工程现状**：Haskell/Clojure 生产级成熟；JVM 有 ScalaSTM/Multiverse；其他语言多实验性。**主流选择**：简单场景用锁/原子变量/Channel；复杂不变量、组合性需求强时考虑 STM。并发模型篇还剩两页：[函数式并发](./functional.md)换一条路线——先消可变性再谈并发；[数据并行](./data-parallel.md)与[Lambda 架构](./lambda-architecture.md)把并行推到异构硬件与全量数据。进阶主题（无锁编程、内存模型、并发数据结构、性能调优）见侧边栏。

## 本章来源

- 《七周七并发模型》第 4 章 Clojure 之道：分离标识与状态（STM 是其中 ref 一部分），版本信息见[权威书籍调研](../research/books.md)
- 语言 API 以官方参考为准（[Clojure 参考文档](https://clojure.org/reference/refs)、[GHC STM 文档](https://hackage.haskell.org/package/stm)）
- 示例代码现写，不抄书