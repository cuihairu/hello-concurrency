# hello-concurrency directory and content organization audit

Audit date: 2026-10-19. Scope: Markdown currently tracked by the repo, `docs/.vitepress/config.mts`, `docs/SUMMARY.md`, root-level files, and the repo's existing audit scripts. This report is the only addition; no existing content or navigation was adjusted.

## Quantitative facts

### Markdown count and line count of first-level directories under docs

Line counts are measured by splitting each file's text on newlines; `docs/SUMMARY.md` is included, generated artifacts inside `.vitepress` are excluded.

| First-level directory under docs | .md count | Total lines | Notes |
|---|---:|---:|---|
| Root | 5 | 675 | Includes `SUMMARY.md`, homepage, knowledge overview, glossary, introduction |
| advanced | 9 | 1,549 | Advanced topics |
| basics | 4 | 408 | Basics part |
| models | 7 | 1,333 | Concurrency models |
| practice | 9 | 1,662 | Practice content and roadmap |
| research | 5 | 379 | Research notes |
| review | 2 | 182 | Structure audit and content review reports (content review report 56 lines) |
| sync | 4 | 911 | Synchronization primitives |
| **Total** | **45** | **7,099** | Includes SUMMARY; 44 buildable content pages |

Counting basis: traverse `docs/*.md` and `docs/*/*.md` and compute line counts per file. The actual body topic directories total 33 pages; plus the introduction, knowledge overview, glossary, homepage, 5 research pages, and 2 audit reports, for 44 buildable pages in total; plus 1 SUMMARY mapping draft that does not participate in the build.

### Inventory of organizational axes

Grouped by content entry point and navigation use into **6 sets of axes**; the directory-topic axis is the main body, and guide/index/research/glossary/legacy mapping are auxiliary axes. There is no standalone API directory or history directory.

| Organizational axis | Entry count | Naming pattern | Numbered? | Numbering continuity |
|---|---:|---|---|---|
| Topic directories: `basics/`, `sync/`, `models/`, `advanced/`, `practice/` | 33 pages (4/4/7/9/9) | Lowercase English slug, hyphen-separated words; the directory carries the classification | No (no numeric prefix in filenames) | N/A |
| Root-level introduction chapter: `chapter_1.md` | 1 | `chapter_number`, underscore | Yes | Only 1, no detectable gap; no skipped or duplicate numbers found |
| Overview / learning guide: `knowledge.md`, `practice/seven-weeks.md` | 2 representative entries | One general overview, one English number-hyphen route name | Filenames: former no, latter no | Entries 1-93 inside `knowledge.md` are contiguous; see the `scripts/audit-structure.mjs` check result |
| Research notes: `research/` | 5 | Uniform directory; files are `README.md` or a topic English slug | No | N/A |
| Glossary reference: `glossary.md` | 1 | Single root-level file | No | N/A |
| Compatibility mapping: `SUMMARY.md` | 1 | mdBook legacy name; link mapping retained | No | N/A; the config explicitly excludes it from the build, see `docs/.vitepress/config.mts:17-18` |

### Numbering check

- Only `docs/chapter_1.md` matches a numeric-prefix/chapter-number pattern in filenames (actually named `chapter_1`, not a `1-...` prefix); sorted it is `[1]`, with **no gaps, skipped numbers, or duplicates**.
- Chapter body subsection numbering is at `docs/chapter_1.md:5,15`, running 1.1-1.3.
- The machine-checkable contiguous sequence is the 93 numbered entries in `docs/knowledge.md`. `npm run docs:audit` reports "knowledge numbering: 93 entries", all passing.
- Individual articles restarting numbering at 1 internally are local lists (for example `docs/practice/producer-consumer.md:23,152,182`), not chapter-number conflicts, and should not be merged into a site-wide sequence.

## Issue list and evidence

Severity definitions: High = causes content to be unreachable / links to break; Medium = significantly increases reader or maintainer disambiguation cost; Low = pure consistency, can be deferred.

1. **Medium: content entry points have a dual mental model of "topic classification + root-level miscellaneous".** The root level holds the introduction, homepage, knowledge overview, glossary, and `SUMMARY.md` together, while the topic body lives in five classified directories. The sidebar then gives the overview and glossary standalone entries, yet the homepage is not among the sidebar entries. Evidence: the 5 root-level Markdown files under `docs/` (table above); `docs/.vitepress/config.mts:27-34,99-111`. The effect is that whether new content belongs in root or a topic directory is not obvious; the current state is still comprehensible and is not a blocking issue.
2. **Medium: research notes are reachable differently from the topic body.** The sidebar mounts only `research/README`; the other 4 pages are reachable solely via in-page links within the notes / page cross-links, and the README reappears inside its own directory. Evidence: `docs/.vitepress/config.mts:108-111`; files are `docs/research/books.md`, `memory-model-specs.md`, `applications.md`, `coverage-audit.md`; mapping list in `docs/SUMMARY.md:46-51`. This is a reasonable way to store internal material, but page discoverability is weaker than for the main chapters.
3. **Medium: the same concepts are deliberately cross-covered, and boundaries have to be explained by cross-links.** Bounded queues/backpressure span `docs/practice/producer-consumer.md:137-149`, `docs/practice/thread-pool.md:40-46`, `docs/practice/reactor.md:62-66`; resource exhaustion versus fault/security appear separately in `docs/practice/reliability.md:5-17,73-84` and `docs/advanced/security.md:31-43,87-96`; the book-chapter traceability of STM and the model body converge at `docs/models/stm.md:83-121` and `docs/research/books.md:42-62`. The existing cross-links and relationship sections mitigate the duplication; the evidence is not sufficient to delete or merge chapters outright. Before restructuring, settle "primary concept page versus scenario reference".
4. **Low: naming style has historical/use differences.** `chapter_1.md` uses an underscore and an English prefix (`docs/chapter_1.md`); `seven-weeks.md` and `data-parallel.md` use hyphens; `README.md` is uppercase and exists once at root and once in `research/`; topic slugs are lowercase. Evidence: filenames in the root of `docs/` and `docs/research/README.md`. These are a few exceptions that do not affect the build or links, so bulk renaming for the sake of uniformity alone is not recommended.
5. **Low: the README and the docs homepage need to stay distinguished in purpose.** The root holds both `README.md` (English) and `README.zh.md` (Chinese), which cross-link to provide a bilingual repo introduction (`README.md:3`, `README.zh.md:3`); separately, `docs/index.md` serves as the site homepage. They are not duplicate files, but if Chinese readers interpret the README and the site homepage as duplicate entry points, ambiguity arises. Evidence: `README.md:16`, `README.zh.md:16`, `docs/index.md`. This is a positioning-hint issue, not grounds for deletion.
6. **Low (fixed): the counting basis was previously stale.** After recounting in this review, both the statistics table in this report and `docs/SUMMARY.md:3` have been corrected in sync; the current figures are 44 buildable pages plus 1 SUMMARY mapping draft. SUMMARY is explicitly designated by the config as an mdBook legacy mapping rather than site navigation (`docs/.vitepress/config.mts:17-18`).

### Sidebar reconciliation

Parsed the actual sidebar in `docs/.vitepress/config.mts:34-113` (the top nav is not double-counted as sidebar):

| Reconciliation direction | Count | Entries |
|---|---:|---|
| Configured but the target file does not exist | 0 | none |
| File exists but is not in the sidebar | 5 (fewer than 10) | `docs/index.md` (the homepage is carried by the `/` route); `docs/research/applications.md`; `docs/research/books.md`; `docs/research/coverage-audit.md`; `docs/research/memory-model-specs.md` |

Method: map sidebar routes against `docs/*.md` and `docs/*/*.md` (excluding the SUMMARY mapping draft). Not being in the sidebar does not mean a dead page: the repo structure script confirms 45/45 Markdown routes are reachable (including the non-built SUMMARY draft), and the two-way SUMMARY reconciliation also passes; the four specific research pages are linked in from `research/README.md`.

### Dead links and build

- Re-ran `pnpm docs:build` and `pnpm docs:audit` during the review; both passed. Latest results in `docs/review/content-review-2026-10-19.md`; the HTML link count includes 404 pages, and the structure script's route count includes the non-built SUMMARY mapping draft.
- The link script `scripts/audit-links.mjs` scans the `docs/.vitepress/dist` build output. This review built successfully from the current source (VitePress 1.6.4), then re-ran the in-site link and structure audits; the link check after rebuilding from source passed.

### Stray files in the root

- The repo root has `README.md` and `README.zh.md`, a clearly paired English/Chinese project description, not duplicate READMEs, and should be kept (reasonable). `docs/index.md` is the docs site homepage, serving a different function, and is also not a duplicate.
- No other Markdown, temporary files, or untracked stray files were found in the repo root; the root-level `.gitignore`, `LICENSE`, `package.json`, lock files, scripts, and `.github/` are normal engineering files. The working tree was clean at the time of the check.

## Judgments and recommendations

The current state can be summarized as **6 organizational axes**; forcing them into a single directory tree is not recommended. Recommend maintaining **3 reader-facing entry axes** long term: (1) body organized by topic / learning order (the existing five topic directories plus the introduction); (2) guide and quick reference (knowledge overview, seven-week route, glossary); (3) research basis (research notes). Also keep SUMMARY explicitly as a non-reader-facing compatibility mapping; naming conventions are a cross-cutting rule and do not count as a content axis. Recommend keeping the existing topic directories plus the VitePress sidebar as the main axis, because the 33 body pages are already classified into basics, synchronization, models, advanced, and practice, all navigation targets exist, and both the in-site link audit and the structure audit pass; the current evidence supports tightening and clarifying entry points, not large-scale relocation.

**In fact it is not messy and needs no action:** the five topic directories are internally consistent in classification with a reasonable count distribution; all sidebar targets resolve to existing files; the 93 numbers in knowledge are contiguous; body and research both have mappings in SUMMARY; the root README is a bilingual pair rather than duplicates; cross-cutting topics have cross-links, with no evidence they are duplicate chapters that must be merged; `SUMMARY.md` is marked by comments and config as a compatibility draft and should not be mistaken for a second live navigation.

## Three-phase closeout plan

| Phase | Action list | Impact scope | Risk (links/search/external) | User decision |
|---|---|---|---|---|
| Phase 1: mechanical tidy-up (<=1 hour, no broken links) | Update the page-count basis in SUMMARY; add a short organizational convention (where topic body, guide/index, research notes, and compatibility mapping each go); add a "research notes" entry note for the research pages not in the sidebar, or ensure the README index is complete; agree that new file slugs are lowercase hyphen-separated, with historical files left unrenamed. | `docs/SUMMARY.md`, optionally a new contribution note, `docs/research/README.md`; no pages moved. | Low; no route changes, no link changes, no effect on search or external links. | Adopting the 3 reader entry axes and the slug convention needs a decision; updating the stale statistics can proceed directly. |
| Phase 2: sidebar and redirects | Decide whether the four research sub-pages enter the sidebar directly; if migrating `chapter_1.md` or renaming a slug, keep redirects/aliases for the old URL and update in-site links, SUMMARY, and entry links. | `docs/.vitepress/config.mts`, the target Markdown, SUMMARY, and all references. | Medium; expanding the sidebar lengthens navigation; path migration missed in places would damage historical external links, search indexes, and bookmarks. Adding sidebar entries alone does not break URLs. | **Decision required** on whether research notes face general readers; any path rename/migration and the retention period for old URLs must be decided. |
| Phase 3: deep chapter merge/split restructuring | On the principle of "one primary page plus scenario references elsewhere", first compare the backpressure content across producer-consumer/thread-pool/reactor and the resource-exhaustion content in reliability/security; then decide to merge, dedupe, or keep the cross-explanation based on paragraph-level differences, and sync sources and the knowledge overview. | Multiple topic pages, knowledge, SUMMARY, sidebar, source/reference links. | Medium to high; deletions may change anchors and search hits, merges may break old chapter URLs, external link anchors, and readers' existing citations; needs paragraph-level review and a link map. | **Decision required** on which page becomes the authoritative concept page, which duplicate paragraphs to delete, and the chapter responsibility boundaries; must not auto-merge based on a directory audit alone. |

### The three things to do first

1. Fix the page-count description at `docs/SUMMARY.md:3` and spell out the counting basis for body pages.
2. Settle the three reader entry points (body, guide/quick reference, research basis) and the compatibility-draft role of SUMMARY, forming a short placement rule.
3. Let maintainers decide whether the four research sub-pages continue to be entered only via README, or join the sidebar; do not migrate or rename any URL before that decision.

## Closeout execution record (2026-10-19)

Positioning basis: this is personal study notes, insights, and engineering experience sharing, recorded from a game developer's perspective, not a tutorial or course. Keep the topic pages as they are; do not reorder them by learning sequence.

### A: source of truth for navigation

- The VitePress sidebar (`docs/.vitepress/config.mts`) is the sole source of truth for site navigation; `docs/SUMMARY.md` retains the compatibility mapping, with its derived relationship and update order made explicit. Hand-editing SUMMARY does not change site navigation; after changing the sidebar, sync SUMMARY.
- Checked in practice: no duplicate internal routes in the sidebar (duplicate count 0); the homepage/body links in the top nav are not counted into the sidebar, and route reuse across groups is also not treated as duplication. The research notes are still carried by the sidebar overview and the `research/README.md` index.
- Page-count correction: 43 buildable Markdown pages (homepage, introduction, 33 topic pages, knowledge overview, glossary, 5 research pieces, structure audit report; this was the count at that time), plus 1 SUMMARY mapping draft.

### B: cross-axis duplication judged group by group

This check found **0 genuinely duplicate groups merged; 3 groups kept as different angles**. No pages or body paragraphs were deleted; the kept groups gained or clarified cross-links and their respective responsibilities.

| Page group | Classification and text-comparison evidence | Closeout action |
|---|---|---|
| Producer-consumer / thread pool / Reactor | Different angles. `producer-consumer.md:137-148` discusses blocking, dropping, degradation, and Reactive Streams from a generic buffer standpoint; `thread-pool.md:17-19,45-58` covers thread pool queues, scaling, and the Java rejection policy; `reactor.md:62-64` covers event-loop write-buffer watermarks. Strategy, implementation, and the event-driven mechanism are not a restatement of the same fact. | Keep all three pages; cross-link between the producer page and the thread pool page and mark clearly which is the generic strategy versus the concrete implementation; the existing watermark link in Reactor is retained. |
| Reliability / concurrency security | Different angles. `reliability.md:5-17,39-64` covers crashes, network partitions, leases, fencing, recovery, and consistency; `security.md:31-43,55-76` covers how an attacker exploits resource exhaustion, TOCTOU, and side channels. `security.md:94-95` already had a related-page link. | Keep; cross-link explaining the attacker perspective of the security page against the fault-recovery perspective of the reliability page. |
| STM / authoritative books research | Different angles. `stm.md:85-121` explains Clojure identity/value, the four reference types, and engineering choices; `research/books.md:42-62` verifies versions, table of contents, and coverage in this repo. The former is model insight; the latter is a bibliographic fact sheet. | Keep; the STM page points explicitly to the book verification, and the existing reverse links in the book table are retained. |

### C: basis and dead entries

- The bilingual root README no longer uses course-planning copy of the form "writing a book / helping readers master"; it now uses personal-notes and game-developer-sharing framing, and lists the existing real topic directories; no more fictional page counts or non-existent directories.
- The sidebar comment is changed to the sole-source-of-truth rule; all targets in the current configuration exist, with 0 dead entries. The knowledge overview and glossary are both already in the sidebar; the homepage is carried by the "Home" route in the top bar.

## Sources

- This report was checked item by item against the repo's current Markdown files, `docs/.vitepress/config.mts`, `docs/SUMMARY.md`, and body paragraphs; the links and page counts in the execution record were re-verified with `pnpm docs:build` and `pnpm docs:audit`.
