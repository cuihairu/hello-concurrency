<div align="center"><img src="docs/public/logo.svg" width="64" height="64" alt="logo" /> <img src="docs/public/badges/topic.svg" alt="topic" /> <img src="docs/public/badges/docs.svg" alt="docs" /> <img src="docs/public/badges/license.svg" alt="license" /> <img src="docs/public/badges/langs.svg" alt="langs" /> <a href="https://cuihairu.github.io/hello-concurrency//"><img src="https://img.shields.io/badge/docs-docs-blue" alt="docs"></a> <a href="https://cuihairu.github.io/hello-concurrency/"><img src="https://img.shields.io/badge/docs-blue" alt="docs"></a>
</div>

---

I keep these concurrency notes from the perspective of a game developer, recording project experience, tradeoffs, and problems I have run into. The repository groups those notes and references by topic.

The VitePress sidebar in [`docs/.vitepress/config.mts`](docs/.vitepress/config.mts) is the authoritative site navigation. The current notes are grouped by topic: [fundamentals](docs/basics/), [synchronization primitives](docs/sync/), [concurrency models](docs/models/), [advanced topics](docs/advanced/), and [engineering practice](docs/practice/). The [knowledge map](docs/knowledge.md), [glossary](docs/glossary.md), and [research notes](docs/research/README.md) are cross-cutting references.

`docs/SUMMARY.md` remains as a compatibility map. It is derived from the sidebar; editing it does not change site navigation. When adding or moving a page, update the sidebar first, then keep SUMMARY’s page map in sync.

## License

This work is licensed under the [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) license.
