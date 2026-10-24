# Knowledge Research and Source Index

While organizing the concurrency notes, I checked three kinds of source material: authoritative books, official memory model specifications, and application scenarios. The research findings are collected into four documents; the coverage cross-check results and how discrepancies were handled are in the discrepancy table.

- [Authoritative books research](./books): versions, chapter structure, and correspondence to this repo for the three assigned books plus *Seven Concurrency Models in Seven Weeks*
- [Official memory model specifications](./memory-model-specs): verification against the original text of the JMM, C++, Rust, and Go specs
- [Application scenario research](./applications): high-concurrency services and game servers
- [Coverage cross-check discrepancy table](./coverage-audit): per-page cross-check results, gap list, and revision log

## Source gathering method

Book metadata comes from publisher pages or Douban entries; specification quotes come from the original text fetched from each spec site on 2026-10-08; scenario points come from public engineering articles and project READMEs. Every quote cites a chapter number or page for easy re-verification. For specification sources the official site is authoritative; for Chinese editions, the copyright page is authoritative. When the two disagree, the copyright page wins.

## Source index

| # | Category | Source | Points verified |
|---|------|------|--------------|
| 1 | Book | [Java Concurrency in Practice official book site](https://jcip.net/) | Full table of contents, code samples, and errata entry point |
| 2 | Book | ["Java Concurrency in Practice" Chinese edition, Douban entry](https://book.douban.com/subject/10484692/) | China Machine Press 2012-02, translated by Tong Yunlan, ISBN 9787111370048, 293 pages |
| 3 | Book | [C++ Concurrency in Action, Second Edition (Manning)](https://www.manning.com/books/c-plus-plus-concurrency-in-action-second-edition) | Anthony Williams, 2019-02, ISBN 9781617294693, 592 pages |
| 4 | Book | ["C++ Concurrency in Action" 2nd ed. Chinese edition, Douban entry](https://book.douban.com/subject/35653912/) | POSTS & Telecom Press / Async Books 2021-11, translated by Wu Tianming, ISBN 9787115573551, 393 pages |
| 5 | Book | [Seven Concurrency Models in Seven Weeks (PragProg)](https://pragprog.com/titles/pb7con/seven-concurrency-models-in-seven-weeks/) | Paul Butcher, 2014-07, ISBN 9781937785659, 296 pages, seven-chapter TOC |
| 6 | Book | [Seven Concurrency Models in Seven Weeks Chinese edition, Douban entry](https://book.douban.com/subject/26337939/) | POSTS & Telecom Press 2015-03, translated by Huang Yan, ISBN 9787115386069, 244 pages |
| 7 | Book | [Seven Concurrency Models in Seven Weeks TOC (360 Baike)](https://baike.so.com/doc/25698266-26784455.html) | Order of the seven models in chapters 2-8 of the Chinese edition |
| 8 | Book | [The Rustonomicon](https://doc.rust-lang.org/nomicon/) | Rust's official unsafe deep dive, self-described as still incomplete |
| 9 | Official spec | [JLS SE21 Chapter 17 Threads and Locks](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html) | §17.4 memory model, §17.4.5 data race definition and the "correctly synchronized" criterion |
| 10 | Official spec | [C++ working draft [intro.races]](https://eel.is/c++draft/intro.races) | "Any such data race results in undefined behavior" |
| 11 | Official spec | [C++ working draft [atomics.order]](https://eel.is/c++draft/atomics.order) | seq_cst single total order S, the four coherence constraints |
| 12 | Official spec | [Rust Reference: Behavior considered undefined](https://doc.rust-lang.org/reference/behavior-considered-undefined.html) | First entry in the UB list is Data races; applies to unsafe blocks too |
| 13 | Official spec | [std::sync::atomic memory model notes](https://doc.rust-lang.org/std/sync/atomic/index.html) | Rust atomics follow the C++20 [intro.races] rules, minus consume |
| 14 | Official spec | [The Go Memory Model (2022-06-06)](https://go.dev/ref/mem) | The DRF-SC result and the implementation freedom to report and terminate on a race |
| 15 | Scenario | [cloudwu/skynet README](https://github.com/cloudwu/skynet) | Multi-user Lua actor framework; README self-describes as "often used in games" |
| 16 | Scenario | [Tencent Cloud Developer Community: Skynet design principles](https://cloud.tencent.com/developer/article/2519632) | Treatment of the Actor model, message queues, and fair actor scheduling |
| 17 | Scenario | [Tencent Cloud Developer Community: rate limiting, circuit breaking, degradation, warm-up, backpressure](https://cloud.tencent.com/developer/article/1887928) | Definitions of the five traffic controls, rate-limiting algorithm list, Tomcat's 200 default worker threads |
| 18 | Scenario | [Scaling Memcache at Facebook (NSDI '13)](https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala) | Cross-datacenter hot object cache and lease consistency |

## Next steps

Discrepancies and their handling are in the [coverage cross-check discrepancy table](./coverage-audit); closed gaps and revised entries are each listed item by item on the same page, and open todos are left there too, not hidden elsewhere.

## References

- [Raft consensus](https://raft.github.io/)

<!-- BACKLINKS-AUTO -->
## Related pages

- [knowledge](/knowledge.md)
