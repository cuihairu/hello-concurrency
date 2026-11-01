<div align="center"><img src="docs/public/logo.svg" width="64" height="64" alt="logo" /> <img src="docs/public/badges/topic.svg" alt="topic" /> <img src="docs/public/badges/docs.svg" alt="docs" /> <img src="docs/public/badges/license.svg" alt="license" /> <img src="docs/public/badges/langs.svg" alt="langs" /> <a href="https://cuihairu.github.io/hello-concurrency/zh/"><img src="https://img.shields.io/badge/docs-文档-blue" alt="docs"></a></div>

---

这里记录我作为游戏开发者在并发问题上的项目经验、技术取舍和踩坑过程，按主题整理成笔记与参考资料，供遇到类似问题时查阅。

站点导航以 [`docs/.vitepress/config.mts`](docs/.vitepress/config.mts) 中的 VitePress sidebar 为准。现有笔记按主题分为：[基础](docs/basics/)、[同步原语](docs/sync/)、[并发模型](docs/models/)、[进阶主题](docs/advanced/)和[工程实践](docs/practice/)。[知识点总纲](docs/knowledge.md)、[术语表](docs/glossary.md)与[调研底稿](docs/research/README.md)是横向参考入口。

`docs/SUMMARY.md` 作为兼容映射保留，由 sidebar 派生；手工修改它不会改变站点导航。新增或调整页面时，先更新 sidebar，再同步 SUMMARY 的页面映射。

## License

本作品采用 [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) 许可协议发布。