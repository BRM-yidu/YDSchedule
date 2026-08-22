/* ============================================================
   YDSchedule · 多语言国际化（i18n）
   ============================================================ */
(function (global) {
  'use strict';

  const I18N = {
    'zh-CN': {
      nav: {
        home: '首页',
        today: '今日日程',
        week: '周日程',
        month: '月日程',
        plugins: '插件视图'
      },
      settings: { title: '设置' },
      quick: {
        title: '快捷设置日程',
        date: '日期',
        period: '时段',
        time: '时间',
        minute: '分钟',
        tag: '标签',
        confirm: '添加到日程'
      }
    }
  };

  global.I18N = I18N;
})(window);
