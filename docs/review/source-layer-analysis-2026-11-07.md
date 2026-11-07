# Source Layering Analysis (2026-11-07)

This repository is a **pure documentation site** (VitePress + audit scripts). There is no application runtime, no service layer, no database/Redis state, no in-memory state store, and no file-based state store beyond the source Markdown itself. The abstraction layers below therefore describe how the repository *organizes, validates, builds, and ships* its documentation, not how a server serves requests.

## Glossary

| Term | English | Definition | file:line |
|------|---------|------------|-----------|
| Content layer | Content | The bilingual Markdown corpus (English at `docs/`, Chinese at `docs/zh/`), grouped by topic into fundamentals, sync primitives, models, advanced, practice, research and review pages. | `docs/index.md:1`, `docs/glossary.md:1` |
| Navigation layer | Navigation | The VitePress sidebar/nav declared once per locale in `config.mts`; the single source of truth for site structure. `SUMMARY.md` is a derived compatibility map, not a source of truth. | `docs/.vitepress/config.mts:7-8`, `docs/SUMMARY.md:1` |
| Build layer | Build | The VitePress build pipeline (`docs:build`) that turns Markdown into static HTML in `docs/.vitepress/dist`. | `package.json:7`, `docs/.vitepress/config.mts:191` |
| Validation layer | Validation | Three audit scripts (`audit-links`, `audit-structure`, `audit-security`) that guard link/anchor integrity, source structure, and dependency security thresholds. | `scripts/audit-links.mjs:1`, `scripts/audit-structure.mjs:1`, `scripts/audit-security.mjs:1` |
| Theme layer | Theme | The VitePress custom theme (`theme/`) that styles the rendered docs; brand-color slots remain placeholders. | `docs/.vitepress/theme/index.mjs:1`, `docs/.vitepress/theme/style.css:1` |
| Delivery layer | Delivery | GitHub Actions workflow that installs, tests, builds, audits, and deploys the static site to GitHub Pages. | `.github/workflows/deploy-pages.yml:1` |
| Glossary reference | Glossary | The site-wide terminology table; 44 terms, each with an inline authoritative source. | `docs/glossary.md:11`, `docs/glossary.md:44` |

## Architecture directory walkthrough

### 1. Content layer (`docs/`, `docs/zh/`)

- **Implementation**: English pages at `docs/<topic>/*.md`; Chinese mirror at `docs/zh/<topic>/*.md`. Topic directories: `basics/`, `sync/`, `models/`, `advanced/`, `practice/`, `research/`, `review/`. Cross-cutting pages `index.md`, `chapter_1.md`, `knowledge.md`, `glossary.md`.
- **Configuration schema**: none — content is plain Markdown, no YAML frontmatter beyond the home-page `layout: home` block (`docs/index.md:1-3`).
- **Dedicated protocol file**: none — pages link to each other via relative Markdown links (e.g. `docs/knowledge.md:20` links to `basics/concepts.md`).
- **Copy (文案)**: the copy *is* the content; English copy lives in `docs/`, Chinese in `docs/zh/`. Search UI strings live in the VitePress config, not in the pages (`docs/.vitepress/config.mts:262-278`).

### 2. Navigation layer (`docs/.vitepress/config.mts`, `docs/SUMMARY.md`)

- **Implementation**: `enSidebar`/`enNav` and `zhSidebar`/`zhNav` declared in `config.mts` (`docs/.vitepress/config.mts:11-160`).
- **Configuration schema**: the `locales` block keys per-language `themeConfig.sidebar/nav` (`docs/.vitepress/config.mts:206-241`); `srcExclude: ['**/SUMMARY.md']` excludes the compatibility map from the build (`docs/.vitepress/config.mts:201`).
- **Dedicated protocol file**: `docs/SUMMARY.md` — explicitly a *derived* compatibility map, not authoritative (`docs/SUMMARY.md:1-3`).
- **Copy**: sidebar labels are inline strings in `config.mts` (e.g. `{ text: 'Locks', link: '/sync/locks' }`, `docs/.vitepress/config.mts:36`).

### 3. Build layer (`package.json`, `docs/.vitepress/config.mts`)

- **Implementation**: VitePress dev/build/preview scripts in `package.json:5-11`; `base: '/hello-concurrency/'` and `cleanUrls: true` in config (`docs/.vitepress/config.mts:191-192`).
- **Configuration schema**: `package.json` `devDependencies` (`vitepress ^1.6.4`) and `overrides` (`vite ^6.4.4`) at `package.json:12-17`.
- **Dedicated protocol file**: none — build output is plain static HTML in `docs/.vitepress/dist/` (gitignored, `.gitignore:2`).
- **Copy**: none beyond config `title`/`description` (`docs/.vitepress/config.mts:188-190`).

### 4. Validation layer (`scripts/`)

- **Implementation**: `audit-links.mjs` (dist link/anchor check), `audit-structure.mjs` (source structure check), `audit-security.mjs` (vite threshold guard).
- **Configuration schema**: hardcoded `DIST`, `BASE`, `DOCS`, `CONFIG` constants (`scripts/audit-links.mjs:7-8`, `scripts/audit-structure.mjs:10-11`); the vite threshold `FIXED = '6.4.4'` in `scripts/audit-security.mjs:4`.
- **Dedicated protocol file**: none — each script is self-contained.
- **Copy**: error/console messages in Chinese (e.g. `scripts/audit-structure.mjs:3-6`).

### 5. Theme layer (`docs/.vitepress/theme/`)

- **Implementation**: `index.mjs` (default theme import), `style.css` (typography/layout), `custom.css` (readability overrides).
- **Configuration schema**: brand-color placeholder comments in `style.css:3-11`.
- **Dedicated protocol file**: none.
- **Copy**: font stacks and CSS comments (e.g. `docs/.vitepress/theme/style.css:12-20`).

### 6. Delivery layer (`.github/workflows/`)

- **Implementation**: `deploy-pages.yml` — checkout, Node 20 setup, `npm ci`, `npm test`, `docs:build`, `docs:audit`, upload artifact, deploy.
- **Configuration schema**: `permissions`, `concurrency`, `env` at `.github/workflows/deploy-pages.yml:9-16`; runner via the `CI_RUNNER` repository variable, defaulting to `ubuntu-latest`.
- **Dedicated protocol file**: none — it is the CI protocol itself.
- **Copy**: step names in English (`.github/workflows/deploy-pages.yml:35-46`).

## Split rationale

Each numbered reason cites a concrete file:line. No "clear responsibilities" filler.

1. **Content is separated from build**: Markdown sources live under `docs/`, but the build pipeline and dependency config live at the repo root (`package.json`), so content authors never touch tooling. Evidence: `docs/index.md:1`, `package.json:5-11`.
2. **English and Chinese are mirrored, not merged**: `docs/` holds the English corpus and `docs/zh/` the Chinese mirror, so each locale can be reviewed independently and the audit script can walk each tree with a different prefix (`scripts/audit-structure.mjs:14-19`). Evidence: `docs/zh/index.md:1`, `scripts/audit-structure.mjs:14-19`.
3. **Navigation is decoupled from content**: the sidebar is the single source of truth in `config.mts`, and `SUMMARY.md` is only a derived map — this lets the sidebar change without editing every page. Evidence: `docs/.vitepress/config.mts:7-8`, `docs/SUMMARY.md:1-3`.
4. **Validation is scripted, not manual**: link/anchor, structure, and dependency-security checks are each a standalone Node script, so the same checks run locally and in CI. Evidence: `package.json:8-10`, `.github/workflows/deploy-pages.yml:36-43`.
5. **Security guard is separate from content**: `audit-security.mjs` reads the lockfile to enforce `vite >= 6.4.4`, isolating a dependency risk that content changes must not re-introduce. Evidence: `scripts/audit-security.mjs:1-6`, `package.json:15-16`.
6. **Deployment is its own concern**: the GitHub Pages workflow is the only place that knows about pages artifact upload and deployment, so publishing steps don't leak into content or scripts. Evidence: `.github/workflows/deploy-pages.yml:44-58`.

## Repository placement

The repository already has a docs site: `docs/` is the VitePress source root, and `docs/.vitepress/` is the site config. This analysis therefore goes into the existing English documentation path at `docs/review/source-layer-analysis-2026-11-07.md`, and is registered in the English sidebar under "Research Notes" alongside the other audit reports (`docs/.vitepress/config.mts:113-119`).

## Sources

- This analysis reads the repository source as of 2026-11-07; all file:line references point to the working tree at `8db62b3`.
- No external spec is cited; every layer claim is evidenced by a repository file and line.
