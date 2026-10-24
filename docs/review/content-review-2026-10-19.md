# Content review of structural changes (2026-10-19)

## Review scope

First ran `git fetch origin && git pull --rebase origin main`, result `Already up to date`, with the working tree clean beforehand. Reviewed the most recent 4 commits against real history (not an assumed A/B/C trio):

- `dddd873 Align repository notes with project scope` (C: README positioning and audit record)
- `fdc4bf5 Clarify cross-topic note boundaries` (B: cross-topic boundaries)
- `916a4e1 Clarify sidebar navigation source` (A: navigation source of truth)
- `e41b3ad docs: audit repository structure` (structure audit baseline)

Diff range `HEAD~4..HEAD`: 10 files, 148 insertions / 266 deletions. The main deletions are concentrated in the bilingual README's original proposed book table of contents and chapter introductions; commit B itself has only 2 rewrites plus cross-link additions, and deletes no body paragraph in full.

## Four checks

### 1. Content loss: no published body content was mistakenly deleted

- B's `docs/practice/producer-consumer.md:148`: before the change there was the full sentence "backpressure in an event-driven structure relies on write-buffer watermarks ... see Reactor; the streaming programming model ... see async"; after the change that sentence is preserved and only a thread-pool implementation link is added in front of it. The targets are `docs/practice/reactor.md` (event-loop watermarks) and `docs/practice/async.md` (Reactive Streams / `request(n)`), and the meaning is consistent.
- B's `docs/models/stm.md:85`: before the change it explained that chapter 4 of Seven Concurrency Models in Seven Weeks focuses on Clojure identity/value separation and that an STM ref is one of the four reference types; after the change the original sentence is preserved in full and a pointer to `docs/research/books.md` is added for version, table of contents, and coverage verification. No model explanation was lost.
- The large README block deleted by C (`README.md` and `README.zh.md`, roughly lines 22-155 before, lines 22-26 after): what was deleted is the future-planning TOC of the form "writing a book / this book aims to ..." and the corresponding chapter introductions, not finished body text; after the change the README states clearly that the repo is continuously organized personal notes, not a tutorial or course. The topic body remains in `docs/basics/`, `sync/`, `models/`, `advanced/`, `practice/`; the research material remains in `docs/research/`. After searching item by item, the future topic list in the old TOC is not the sole copy of the content of its respective existing pages, so no published knowledge paragraph that should be restored was found. **Not restored**: the old copy was intentionally removed as "book planning" by the positioning change, and restoring it would conflict with the new positioning.
- `docs/SUMMARY.md:5-53` still lists page by page the introduction, 33 topic pages, knowledge overview, glossary, 5 research pages, and 2 audit reports; no large-scale trimming that dropped content-bearing entries was found.

### 2. Misstatements and counts: 1 counting error found, fixed

- The README's new positioning is at `README.md:22-26` and `README.zh.md:22-26`; "notes and engineering experience, game developer perspective, not a tutorial/course" matches the repo's actual content. Checked the newly added topic classification descriptions sentence by sentence; all five directories exist and correspond to their classification, and there is no reversal of technical meaning such as writing "unsupported" as "supported".
- Recounted this time: 45 Markdown files under docs in total (including SUMMARY); excluding `SUMMARY.md` there are 44 buildable pages, of which 33 are topic pages, 4 are homepage/introduction/overview/glossary, 5 are research pages, plus 2 audit reports. `docs/SUMMARY.md:3` says 44, which is correct.
- **Issue (low, internal quantitative inconsistency in the report itself)**: in the reviewed `docs/review/structure-audit-2026-10-19.md`, lines 13-20 before the change still used the directory statistics from before the audit reports were added, reporting 43 Markdown files, 6,908 lines, and 42 buildable pages; the same report later counts in the structure audit report at line 105, creating a contradiction. The statistics table has been updated to include the audit report file; the current figures are 45 Markdown files, 7,099 lines, and 44 buildable pages. The correction is included in this review's commit.

### 3. Links and navigation: no missing targets or topic mismatches found

- The new sidebar entry from A's change at `docs/.vitepress/config.mts:110` points to `/review/structure-audit-2026-10-19`; the file `docs/review/structure-audit-2026-10-19.md` exists and its topic matches. Each topic page in the sidebar was checked item by item against actual file paths; the audit report entries in SUMMARY at `docs/SUMMARY.md:53-54` also point to the same file.
- The directory links C added to the README at `README.md:24` and `README.zh.md:24` land in the actually existing `docs/basics/`, `docs/sync/`, `docs/models/`, `docs/advanced/`, `docs/practice/`; the overview, glossary, and research entry points point to `docs/knowledge.md`, `docs/glossary.md`, and `docs/research/README.md` respectively, with matching topics.
- Spot-checked the newly added cross-links by hand: `docs/practice/thread-pool.md:5` -> the producer-consumer and Reactor pages; `docs/practice/producer-consumer.md:148` -> the thread pool, Reactor, and async pages; `docs/practice/reliability.md:75` <-> `docs/advanced/security.md:89` discuss fault recovery and attack surface respectively; `docs/models/stm.md:85` -> the books research. All targets exist and the topics match.
- Ran `pnpm docs:build` successfully; then `pnpm docs:audit` passed: 3,017 in-site links; the link script scanned 45 HTML files (including 404 pages), the structure script confirmed 45/45 Markdown routes reachable (including the non-built SUMMARY mapping draft), and 43 SUMMARY mappings reconciled. `docs/.vitepress/config.mts:17-18` explicitly excludes SUMMARY from the build.

### 4. Unverified items

- Did not verify the actual rendering of GitHub Pages after deployment or the external search index; this verification covers the current source's build output, repo-relative links, and navigation configuration, and does not access the published site.
- The deployment availability of external online links in the README, such as the "knowledge overview" link, was not visited one by one in a browser; the corresponding in-repo files exist, and the local build and internal link audit pass.
- Whether the proposed book TOC in the README was ever broadcast externally as a standalone promise cannot be judged from the repo history and this round of file content; this review only confirms that the repo currently has no complete book body written to that TOC. This is a positioning trade-off and was not used as grounds for restoring the old copy.

## Issue list

| Severity | Issue | Handling | Fix commit |
|---|---|---|---|
| Low | The structure audit report's statistics table omitted the report itself, and its page and line counts conflict with the report's later text | Statistics, description, and stale audit numbers corrected | Corrected and committed with the review report as `71120b9` |

No content loss, technical meaning reversal, or navigation mis-linking at high or medium severity was found; there are no merge/split trade-offs requiring a user decision.

## Conclusion

Within the commit range reviewed this time, the README positioning adjustment and the B/A navigation changes were not found to damage published body, reverse technical meaning, or point links at the wrong topic. The only confirmed issue is the internal contradiction in the audit report's own counting basis, which can be considered accepted once the report was corrected; the deployed rendering remains unverified.

## Sources

- Basis for this review: `git diff HEAD~4..HEAD`, the repo's Markdown and VitePress config, `scripts/audit-links.mjs`, `scripts/audit-structure.mjs`. Verification commands: `pnpm docs:build`, `pnpm docs:audit`.
