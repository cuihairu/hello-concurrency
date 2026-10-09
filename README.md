<div align="center">

[English](README.md) | [中文](README.zh.md)

<p align="center"><img src="docs/public/logo.svg" width="64" height="64" alt="logo" /> </p>

# Hello Concurrency

<p align="center">
  <img src="docs/public/badges/topic.svg" alt="topic" />
  <img src="docs/public/badges/docs.svg" alt="docs" />
  <img src="docs/public/badges/license.svg" alt="license" />
  <img src="docs/public/badges/langs.svg" alt="langs" />
</p>

High-Concurrency Knowledge Base · [Read Online](https://cuihairu.github.io/hello-concurrency/) · [Knowledge map](https://cuihairu.github.io/hello-concurrency/knowledge)

</div>

---

Writing a book on high concurrency — covering hardware and software design, common design patterns and designs, with references to the content of *Seven Concurrency Models in Seven Weeks* — can be planned with the following table of contents and chapter summaries:

### Table of Contents

1. **Introduction**
   - 1.1 Definition and Importance of High Concurrency
   - 1.2 Application Scenarios of High-Concurrency Systems
   - 1.3 Structure of This Book and Reading Suggestions

2. **Fundamentals of High-Concurrency Systems**
   - 2.1 Concurrency vs. Parallelism
   - 2.2 Threads and Processes
   - 2.3 Synchronous vs. Asynchronous
   - 2.4 Hardware Support for Concurrency (Multi-core Processors, GPUs, Memory Architecture)

3. **Hardware-Level High-Concurrency Design**
   - 3.1 Multi-core Processor Architecture
   - 3.2 Cache Coherence Protocols
   - 3.3 Hardware Accelerators (GPU, FPGA, etc.)
   - 3.4 Storage Systems and I/O Design

4. **Operating Systems and Concurrency**
   - 4.1 Concurrency Mechanisms in Operating Systems
   - 4.2 Thread Management
   - 4.3 Scheduling Algorithms
   - 4.4 Memory Management and Virtual Memory

5. **Programming Languages and Concurrency Support**
   - 5.1 Basic Concepts of Concurrent Programming
   - 5.2 Concurrency Support in Java
   - 5.3 Concurrency Support in C++
   - 5.4 Concurrency Support in Go
   - 5.5 Concurrency Support in Python

6. **High-Concurrency Design Patterns**
   - 6.1 Producer–Consumer Pattern
   - 6.2 Thread Pool Pattern
   - 6.3 Future Pattern
   - 6.4 Observer Pattern
   - 6.5 Reactor Pattern

7. **Common High-Concurrency Techniques**
   - 7.1 Asynchronous Programming Models
   - 7.2 Event-Driven Architecture
   - 7.3 The Actor Model
   - 7.4 CSP (Communicating Sequential Processes)
   - 7.5 Concurrent Data Structures (Locks, Lock-Free Data Structures)

8. **High-Concurrency Frameworks and Tools**
   - 8.1 Java Concurrency Framework
   - 8.2 The Akka Framework
   - 8.3 The Netty Framework
   - 8.4 Go Concurrency Toolkits
   - 8.5 Python Concurrency Libraries (asyncio, concurrent.futures)

9. **Performance Optimization of High-Concurrency Systems**
   - 9.1 Performance Bottleneck Analysis
   - 9.2 Performance Tuning Techniques
   - 9.3 Load Balancing
   - 9.4 Caching Strategies
   - 9.5 Stress Testing and Monitoring

10. **Reliability Design of High-Concurrency Systems**
    - 10.1 Fault Tolerance Mechanisms
    - 10.2 Consistency and Distributed Locks
    - 10.3 Data Persistence and Recovery
    - 10.4 Distributed Transactions

11. **Security of High-Concurrency Systems**
    - 11.1 Security Issues in Concurrency
    - 11.2 Data Races and Deadlocks
    - 11.3 Secure Programming Practices
    - 11.4 Security Tools and Libraries

12. **Seven Weeks of Hands-On Concurrency**
    - 12.1 Week 1: Concurrent Programming in Java
    - 12.2 Week 2: Concurrent Programming in C++
    - 12.3 Week 3: Concurrent Programming in Go
    - 12.4 Week 4: Concurrent Programming in Python
    - 12.5 Week 5: Hands-On with the Akka Framework
    - 12.6 Week 6: Hands-On with the Netty Framework
    - 12.7 Week 7: Comprehensive Case Studies

13. **Emerging Trends and the Future**
    - 13.1 New Trends in Concurrent Programming
    - 13.2 New Hardware Support for Concurrency
    - 13.3 Quantum Computing and Concurrency
    - 13.4 Looking Ahead

### Chapter Summaries

**Introduction**
Introduces the basic concepts of high concurrency, application scenarios, and the structure of this book along with reading suggestions, helping readers quickly understand the importance of high concurrency and how the book is organized.

**Fundamentals of High-Concurrency Systems**
Explains in detail fundamental concepts such as concurrency vs. parallelism, threads vs. processes, and synchronous vs. asynchronous, as well as hardware support for concurrency, laying the foundation for later chapters.

**Hardware-Level High-Concurrency Design**
Covers multi-core processor architecture, cache coherence protocols, hardware accelerators (such as GPUs and FPGAs), and storage systems and I/O design, showing the role hardware plays in high concurrency.

**Operating Systems and Concurrency**
Explores concurrency mechanisms in operating systems, including thread management, scheduling algorithms, and memory management, helping readers understand how operating systems support high concurrency.

**Programming Languages and Concurrency Support**
Analyzes concurrency support in mainstream programming languages such as Java, C++, Go, and Python, showing the characteristics and advantages of different languages when implementing high concurrency.

**High-Concurrency Design Patterns**
Provides a detailed introduction to common design patterns such as producer–consumer, thread pools, Future, observer, and Reactor, helping readers master the design techniques of high-concurrency systems.

**Common High-Concurrency Techniques**
Discusses high-concurrency techniques such as asynchronous programming models, event-driven architecture, the Actor model, CSP, and concurrent data structures, showing the many ways to achieve high concurrency.

**High-Concurrency Frameworks and Tools**
Introduces the Java Concurrency Framework, Akka, Netty, Go concurrency toolkits, and Python concurrency libraries, showing how to build high-concurrency systems with existing frameworks and tools.

**Performance Optimization of High-Concurrency Systems**
Covers performance bottleneck analysis, performance tuning techniques, load balancing, caching strategies, stress testing, and monitoring, helping readers improve the performance of high-concurrency systems.

**Reliability Design of High-Concurrency Systems**
Explains fault tolerance mechanisms, consistency and distributed locks, data persistence and recovery, and distributed transactions, helping readers build reliable high-concurrency systems.

**Security of High-Concurrency Systems**
Explores security issues in concurrency, data races and deadlocks, secure programming practices, and security tools and libraries, helping readers improve the security of high-concurrency systems.

**Seven Weeks of Hands-On Concurrency**
Drawing on the content of *Seven Concurrency Models in Seven Weeks*, it provides one hands-on case study per week, covering Java, C++, Go, Python, Akka, Netty, and other technologies, helping readers master concurrent programming through practice.

**Emerging Trends and the Future**
Looks ahead at new trends in concurrent programming, new hardware support for concurrency, quantum computing and concurrency, and other frontier topics, helping readers understand where high concurrency is headed.

This book aims to cover every aspect of high-concurrency systems. By combining theory with hands-on practice, it helps readers deeply understand and master the techniques of high-concurrency programming.

## License

This work is licensed under the [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) license.
