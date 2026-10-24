import { defineConfig, type DefaultTheme } from 'vitepress'

// https://vitepress.dev/reference/site-config

const GITHUB = 'https://github.com/cuihairu/hello-concurrency'

// English (root) navigation; sidebar 是站点导航唯一真源，
// SUMMARY.md 仅保留为兼容映射，需随 sidebar 同步。
const enNav: DefaultTheme.NavItem[] = [
  { text: 'Home', link: '/' },
  { text: 'Project Notes', link: '/chapter_1' }
]

const enSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Project Notes',
    items: [
      { text: 'Introduction', link: '/chapter_1' }
    ]
  },
  {
    text: 'Fundamentals',
    items: [
      { text: 'Concurrency Basics', link: '/basics/concepts' },
      { text: 'Threads and Processes', link: '/basics/thread-process' },
      { text: 'Critical Sections and Mutual Exclusion', link: '/basics/critical-section' },
      { text: 'Deadlock and Livelock', link: '/basics/deadlock-livelock' }
    ]
  },
  {
    text: 'Synchronization Primitives',
    items: [
      { text: 'Locks', link: '/sync/locks' },
      { text: 'Semaphores', link: '/sync/semaphores' },
      { text: 'Condition Variables', link: '/sync/condition-variables' },
      { text: 'Barriers', link: '/sync/barriers' }
    ]
  },
  {
    text: 'Concurrency Models',
    items: [
      { text: 'The Actor Model', link: '/models/actor' },
      { text: 'The CSP Model', link: '/models/csp' },
      { text: 'The Dataflow Model', link: '/models/dataflow' },
      { text: 'Software Transactional Memory', link: '/models/stm' },
      { text: 'Functional Concurrency', link: '/models/functional' },
      { text: 'Data Parallelism', link: '/models/data-parallel' },
      { text: 'Lambda Architecture', link: '/models/lambda-architecture' }
    ]
  },
  {
    text: 'Advanced Topics',
    items: [
      { text: 'Hardware and the Memory Hierarchy', link: '/advanced/hardware' },
      { text: 'The OS and Concurrency', link: '/advanced/os' },
      { text: 'Lock-free Programming', link: '/advanced/lockfree' },
      { text: 'Memory Models', link: '/advanced/memory-model' },
      { text: 'Concurrent Data Structures', link: '/advanced/data-structures' },
      { text: 'Performance Tuning', link: '/advanced/performance' },
      { text: 'Languages and Concurrency Support', link: '/advanced/languages' },
      { text: 'Concurrency and Security', link: '/advanced/security' },
      { text: 'Trends and Outlook', link: '/advanced/trends' }
    ]
  },
  {
    text: 'Engineering Practice',
    items: [
      { text: 'Producer–Consumer', link: '/practice/producer-consumer' },
      { text: 'Readers–Writers', link: '/practice/reader-writer' },
      { text: 'Thread Pool Design', link: '/practice/thread-pool' },
      { text: 'Choosing a Concurrency Framework', link: '/practice/framework-selection' },
      { text: 'Reactor and Event-Driven Architectures', link: '/practice/reactor' },
      { text: 'Async Programming and Futures', link: '/practice/async' },
      { text: 'Concurrency Frameworks and Tools', link: '/practice/frameworks' },
      { text: 'Reliability Engineering', link: '/practice/reliability' },
      { text: 'A Seven-Week Practice Log', link: '/practice/seven-weeks' }
    ]
  },
  {
    text: 'Knowledge Map',
    link: '/knowledge'
  },
  {
    text: 'Glossary',
    link: '/glossary'
  },
  {
    text: 'Research Notes',
    items: [
      { text: 'Research Overview and Sources', link: '/research/README' },
      { text: 'Structure Audit Report', link: '/review/structure-audit-2026-10-19' },
      { text: 'Content Review Report', link: '/review/content-review-2026-10-19' }
    ]
  }
]

// 简体中文导航；链接带 /zh/ 前缀。
const zhNav: DefaultTheme.NavItem[] = [
  { text: '首页', link: '/zh/' },
  { text: '项目笔记', link: '/zh/chapter_1' }
]

const zhSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '项目笔记',
    items: [
      { text: '引言', link: '/zh/chapter_1' }
    ]
  },
  {
    text: '基础主题',
    items: [
      { text: '并发基础概念', link: '/zh/basics/concepts' },
      { text: '线程与进程', link: '/zh/basics/thread-process' },
      { text: '临界区与互斥', link: '/zh/basics/critical-section' },
      { text: '死锁与活锁', link: '/zh/basics/deadlock-livelock' }
    ]
  },
  {
    text: '同步原语',
    items: [
      { text: '锁', link: '/zh/sync/locks' },
      { text: '信号量', link: '/zh/sync/semaphores' },
      { text: '条件变量', link: '/zh/sync/condition-variables' },
      { text: '屏障', link: '/zh/sync/barriers' }
    ]
  },
  {
    text: '并发模型',
    items: [
      { text: 'Actor 模型', link: '/zh/models/actor' },
      { text: 'CSP 模型', link: '/zh/models/csp' },
      { text: '数据流模型', link: '/zh/models/dataflow' },
      { text: 'STM 软件事务内存', link: '/zh/models/stm' },
      { text: '函数式并发', link: '/zh/models/functional' },
      { text: '数据并行', link: '/zh/models/data-parallel' },
      { text: 'Lambda 架构', link: '/zh/models/lambda-architecture' }
    ]
  },
  {
    text: '进阶主题',
    items: [
      { text: '硬件与内存层次', link: '/zh/advanced/hardware' },
      { text: '操作系统与并发', link: '/zh/advanced/os' },
      { text: '无锁编程', link: '/zh/advanced/lockfree' },
      { text: '内存模型', link: '/zh/advanced/memory-model' },
      { text: '并发数据结构', link: '/zh/advanced/data-structures' },
      { text: '性能调优', link: '/zh/advanced/performance' },
      { text: '编程语言与并发支持', link: '/zh/advanced/languages' },
      { text: '并发与安全', link: '/zh/advanced/security' },
      { text: '前沿趋势与展望', link: '/zh/advanced/trends' }
    ]
  },
  {
    text: '工程实践',
    items: [
      { text: '生产者-消费者', link: '/zh/practice/producer-consumer' },
      { text: '读者-写者', link: '/zh/practice/reader-writer' },
      { text: '线程池设计', link: '/zh/practice/thread-pool' },
      { text: '并发框架选型', link: '/zh/practice/framework-selection' },
      { text: 'Reactor 与事件驱动', link: '/zh/practice/reactor' },
      { text: '异步编程与 Future', link: '/zh/practice/async' },
      { text: '并发框架与工具', link: '/zh/practice/frameworks' },
      { text: '可靠性设计', link: '/zh/practice/reliability' },
      { text: '七周并发练习记录', link: '/zh/practice/seven-weeks' }
    ]
  },
  {
    text: '知识点总纲',
    link: '/zh/knowledge'
  },
  {
    text: '术语表',
    link: '/zh/glossary'
  },
  {
    text: '调研底稿',
    items: [
      { text: '调研总览与来源总表', link: '/zh/research/README' },
      { text: '结构审计报告', link: '/zh/review/structure-audit-2026-10-19' },
      { text: '内容复核报告', link: '/zh/review/content-review-2026-10-19' }
    ]
  }
]

export default defineConfig({
  lang: 'en-US',
  title: 'Hello Concurrency',
  description:
    'Concurrency project notes from a game developer: thread cooperation, state synchronization, and the tradeoffs behind locks, Actors, and memory models.',
  base: '/hello-concurrency/',
  cleanUrls: true,
  lastUpdated: true,

  head: [
    // 品牌资产空位：favicon.svg 到位后启用
    // ['link', { rel: 'icon', type: 'image/svg+xml', href: '/hello-concurrency/favicon.svg' }]
  ],

  // mdbook 遗留的目录文件保留在仓库作映射底稿，不作为页面构建
  srcExclude: ['**/SUMMARY.md'],

  // 迁移期临时放行死链；英文翻译全部落盘后移除，恢复严格检查
  ignoreDeadLinks: true,

  // 站点语言定义：英文在根目录，中文在 /zh/。
  // VitePress 用顶层 locales[x].themeConfig 做每语言主题覆盖（浅合并，同名键整键替换）；
  // 旧写法 themeConfig.locales 在 1.x 不被读取，会导致中文页渲染英文导航，故不采用。
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
        outline: { label: 'On this page', level: [2, 3] },
        docFooter: { prev: 'Previous', next: 'Next' },
        lastUpdated: { text: 'Last updated' },
        returnToTopLabel: 'Return to top',
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Appearance',
        lightModeSwitchTitle: 'Switch to light theme',
        darkModeSwitchTitle: 'Switch to dark theme'
      }
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      description: '游戏开发者的并发项目笔记与工程经验，记录问题、取舍和踩坑过程',
      themeConfig: {
        nav: zhNav,
        sidebar: zhSidebar,
        outline: { label: '页面导航', level: [2, 3] },
        docFooter: { prev: '上一篇', next: '下一篇' },
        lastUpdated: { text: '最后更新' },
        returnToTopLabel: '回到顶部',
        sidebarMenuLabel: '菜单',
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式'
      }
    }
  },

  // 两语言共享的主题配置。nav/sidebar 由 locales[x].themeConfig 按语言覆盖，
  // 因此这里不声明 nav/sidebar，避免被浅合并整键替换掉。
  themeConfig: {
    // 品牌资产空位：logo.svg 到位后启用
    // logo: '/logo.svg',
    siteTitle: 'Hello Concurrency',

    socialLinks: [
      { icon: 'github', link: GITHUB }
    ],

    footer: {
      message: 'Hello Concurrency',
      copyright: '© 2025 cuihairu'
    },

    search: {
      provider: 'local',
      options: {
        // 英文（root）默认文案；中文走 options.locales.zh.translations
        translations: {
          button: { buttonText: 'Search docs', buttonAriaLabel: 'Search' },
          modal: {
            noResultsText: 'No results found',
            resetButtonTitle: 'Clear search query',
            footer: { selectText: 'Select', navigateText: 'Navigate', closeText: 'Close' }
          }
        },
        locales: {
          zh: {
            translations: {
              button: { buttonText: '搜索文档', buttonAriaLabel: '搜索' },
              modal: {
                noResultsText: '没有找到结果',
                resetButtonTitle: '清除查询条件',
                footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
              }
            }
          }
        }
      }
    }
  },

  markdown: {
    lineNumbers: false
  }
})
