import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: 'zh-CN',
  title: 'Hello Concurrency',
  description: '高并发知识体系——从硬件基础到设计模式、主流框架与七周实战',
  base: '/hello-concurrency/',
  cleanUrls: true,
  lastUpdated: true,

  head: [
    // 品牌资产空位：favicon.svg 到位后启用
    // ['link', { rel: 'icon', type: 'image/svg+xml', href: '/hello-concurrency/favicon.svg' }]
  ],

  // mdbook 遗留的目录文件保留在仓库作映射底稿，不作为页面构建
  srcExclude: ['**/SUMMARY.md'],



  themeConfig: {
    // 品牌资产空位：logo.svg 到位后启用
    // logo: '/logo.svg',
    siteTitle: 'Hello Concurrency',

    nav: [
      { text: '首页', link: '/' },
      { text: '正文', link: '/chapter_1' }
    ],

    // 由 mdbook SUMMARY.md 结构映射而来；后续章节按 SUMMARY 继续追加。
    // 基础篇 / 同步原语 / 并发模型 / 进阶主题收录已落盘的内容页（仅收录已存在文件，不挂死链）。
    sidebar: [
      {
        text: '正文',
        items: [
          { text: '引言', link: '/chapter_1' }
        ]
      },
      {
        text: '基础篇',
        items: [
          { text: '并发基础概念', link: '/basics/concepts' },
          { text: '线程与进程', link: '/basics/thread-process' },
          { text: '临界区与互斥', link: '/basics/critical-section' },
          { text: '死锁与活锁', link: '/basics/deadlock-livelock' }
        ]
      },
      {
        text: '同步原语',
        items: [
          { text: '锁', link: '/sync/locks' },
          { text: '信号量', link: '/sync/semaphores' },
          { text: '条件变量', link: '/sync/condition-variables' },
          { text: '屏障', link: '/sync/barriers' }
        ]
      },
      {
        text: '并发模型',
        items: [
          { text: 'Actor 模型', link: '/models/actor' },
          { text: 'CSP 模型', link: '/models/csp' },
          { text: '数据流模型', link: '/models/dataflow' },
          { text: 'STM 软件事务内存', link: '/models/stm' },
          { text: '函数式并发', link: '/models/functional' },
          { text: '数据并行', link: '/models/data-parallel' },
          { text: 'Lambda 架构', link: '/models/lambda-architecture' }
        ]
      },
      {
        text: '进阶主题',
        items: [
          { text: '硬件与内存层次', link: '/advanced/hardware' },
          { text: '无锁编程', link: '/advanced/lockfree' },
          { text: '内存模型', link: '/advanced/memory-model' },
          { text: '并发数据结构', link: '/advanced/data-structures' },
          { text: '性能调优', link: '/advanced/performance' }
        ]
      },
      {
        text: '实战篇',
        items: [
          { text: '生产者-消费者', link: '/practice/producer-consumer' },
          { text: '读者-写者', link: '/practice/reader-writer' },
          { text: '线程池设计', link: '/practice/thread-pool' },
          { text: '并发框架选型', link: '/practice/framework-selection' },
          { text: 'Reactor 与事件驱动', link: '/practice/reactor' }
        ]
      },
      {
        text: '知识点总纲',
        link: '/knowledge'
      },
      {
        text: '调研底稿',
        items: [
          { text: '调研总览与来源总表', link: '/research/README' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cuihairu/hello-concurrency' }
    ],

    footer: {
      message: 'Hello Concurrency',
      copyright: '© 2025 cuihairu'
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索' },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清除查询条件',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
          }
        }
      }
    },

    outline: {
      label: '页面导航',
      level: [2, 3]
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },

    lastUpdated: {
      text: '最后更新'
    },

    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式'
  },

  markdown: {
    lineNumbers: false
  }
})
