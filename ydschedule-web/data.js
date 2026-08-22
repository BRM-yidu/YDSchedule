/* ============================================================
   data.js · 数据层
   统一数据源：日程事件 / 设置 / 插件开关
   持久化：localStorage（模拟本地隐藏数据文件夹）
   ============================================================ */
(function (global) {
  'use strict';

  const KEYS = {
    events: 'ydschedule.events.v1',
    settings: 'ydschedule.settings.v1',
    plugins: 'ydschedule.plugins.v1',
    custom: 'ydschedule.plugins.custom.v1',
    removed: 'ydschedule.plugins.removed.v1'
  };

  const DEFAULT_SETTINGS = {
    theme: 'paper',            // paper | white | ink | night
    fontSize: 'md',            // sm | md | lg
    lang: 'zh-CN',             // 界面语言：zh-CN | zh-TW | en | fr | ru | es | ar
    inputSize: 'md',           // 首页输入框大小：sm | md | lg
    onboarded: false,          // 是否已展示首次使用指引
    cloudKey: '',              // 云端 AI 密钥（本地编码存储，界面隐藏明文）
    cloudMode: false,          // 云端模式开关：开启后才调用云端 API，否则用本地解析
    quickSet: 'longpress',     // 主页快捷设置：both | longpress | button | off
    bgType: 'none',            // 背景：none 默认 | color 纯色 | image 图片
    bgColor: '#F3F0E9',        // 纯色背景色值
    railMarkColor: 'green',    // 时间轴今日日程标点颜色：green | yellow
    railNowStyle: 'bar',       // 当前时间指示样式：bar 横杠 | dot 圆点
    navGlassOpacity: 100,      // 侧边导航毛玻璃不透明度：0~100（100=不透明=无效果，0=完全透明）
    inputGlassOpacity: 100,    // 首页输入框毛玻璃不透明度：0~100
    bgOpacity: 100,            // 背景遮罩不透明度：0~100（控制背景图片/颜色的可见度）
    updateUrl: 'https://brm-yidu.github.io/YDSchedule/updates/latest.json'
  };

  /* 预设插件已移除 —— 改为官方插件市场（从官网动态获取） */
  const DEFAULT_PLUGINS = {};

  /* ---------- 密钥本地编码（非明文存储，防直接查看） ---------- */
  function encodeKey(s) {
    if (!s) return '';
    try { return btoa(unescape(encodeURIComponent(s))); }
    catch (e) { return s; }
  }

  function decodeKey(s) {
    if (!s) return '';
    try { return decodeURIComponent(escape(atob(s))); }
    catch (e) { return ''; }
  }

  /* ---------- 日期工具 ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function toKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseKey(key) {
    const p = key.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function startOfDay(d) {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
  }

  function isoLocal(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function fmtDateCN(d) {
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function fmtTimeHM(d) {
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

  /* ---------- 种子数据 ---------- */
  function seedEvents() {
    const now = new Date();
    const today = startOfDay(now);
    const t = (dayOffset, h, m) => {
      const d = addDays(today, dayOffset);
      d.setHours(h, m, 0, 0);
      return d;
    };
    const ev = (title, start, end, tag, repeat, repeatInterval) => ({
      id: 'ev_' + Math.random().toString(36).slice(2, 10),
      title, tag: tag || '日程',
      start: isoLocal(start),
      end: isoLocal(end || addDays(start, 0)),
      allDay: false,
      repeat: repeat || 'none',
      repeatInterval: repeatInterval || 1,
      repeatEnd: null,
      pluginData: {}
    });

    const list = [
      ev('晨跑 5 公里', t(0, 6, 30), t(0, 7, 30), '运动'),
      ev('产品评审会', t(0, 9, 0), t(0, 10, 0), '工作'),
      ev('阅读《设计中的设计》', t(0, 12, 30), t(0, 13, 30), '学习'),
      ev('健身房 · 胸', t(0, 19, 0), t(0, 20, 0), '健身'),
      ev('写周报', t(1, 10, 0), t(1, 11, 0), '工作'),
      ev('英语口语练习', t(1, 20, 0), t(1, 21, 0), '学习'),
      ev('晨跑 3 公里', t(2, 6, 30), t(2, 7, 15), '运动'),
      ev('团队站会', t(2, 9, 30), t(2, 10, 0), '工作'),
      ev('瑜伽拉伸', t(3, 18, 30), t(3, 19, 30), '运动'),
      ev('整理读书笔记', t(4, 21, 0), t(4, 22, 0), '学习'),
      ev('周末骑行', t(5, 8, 0), t(5, 10, 0), '运动'),
      ev('家庭聚餐', t(5, 18, 0), t(5, 20, 0), '日程'),
      ev('每周复盘', t(6, 20, 0), t(6, 21, 0), '工作', 'weekly'),
      ev('晨跑 5 公里', t(0, 6, 30), t(0, 7, 30), '运动', 'daily'),
      ev('喝水提醒', t(0, 15, 0), t(0, 15, 5), '日程', 'interval', 3)
    ];
    return list;
  }

  /* ---------- 存储 ---------- */
  const Store = {
    events: [],
    settings: Object.assign({}, DEFAULT_SETTINGS),
    plugins: Object.assign({}, DEFAULT_PLUGINS),
    customPlugins: [],

    load() {
      try {
        const e = localStorage.getItem(KEYS.events);
        this.events = e ? JSON.parse(e) : seedEvents();
      } catch (err) {
        this.events = seedEvents();
      }
      try {
        const s = localStorage.getItem(KEYS.settings);
        this.settings = Object.assign({}, DEFAULT_SETTINGS, s ? JSON.parse(s) : {});
        this.settings.cloudKey = decodeKey(this.settings.cloudKey);
        /* 旧版 navGlass 布尔值迁移到 navGlassOpacity */
        if (typeof this.settings.navGlass === 'boolean') {
          this.settings.navGlassOpacity = this.settings.navGlass ? 70 : 100;
          delete this.settings.navGlass;
        }
        /* 确保新增设置有默认值（防止老用户数据缺字段） */
        if (typeof this.settings.inputGlassOpacity === 'undefined') this.settings.inputGlassOpacity = 100;
        if (typeof this.settings.bgOpacity === 'undefined') this.settings.bgOpacity = 100;
      } catch (err) {
        this.settings = Object.assign({}, DEFAULT_SETTINGS);
      }
      try {
        const p = localStorage.getItem(KEYS.plugins);
        this.plugins = Object.assign({}, DEFAULT_PLUGINS, p ? JSON.parse(p) : {});
      } catch (err) {
        this.plugins = Object.assign({}, DEFAULT_PLUGINS);
      }
      try {
        const c = localStorage.getItem(KEYS.custom);
        this.customPlugins = c ? JSON.parse(c) : [];
      } catch (err) {
        this.customPlugins = [];
      }
      this.save();
    },

    save() {
      try {
        localStorage.setItem(KEYS.events, JSON.stringify(this.events));
        const s = Object.assign({}, this.settings, { cloudKey: encodeKey(this.settings.cloudKey) });
        localStorage.setItem(KEYS.settings, JSON.stringify(s));
        localStorage.setItem(KEYS.plugins, JSON.stringify(this.plugins));
        localStorage.setItem(KEYS.custom, JSON.stringify(this.customPlugins));
      } catch (err) { /* 存储不可用时静默 */ }
    },

    addEvent(ev) {
      ev.id = ev.id || 'ev_' + Math.random().toString(36).slice(2, 10);
      this.events.push(ev);
      this.save();
      return ev;
    },

    updateEvent(id, patch) {
      const i = this.events.findIndex(e => e.id === id);
      if (i >= 0) {
        this.events[i] = Object.assign({}, this.events[i], patch);
        this.save();
        return this.events[i];
      }
      return null;
    },

    deleteEvent(id) {
      this.events = this.events.filter(e => e.id !== id);
      this.save();
    },

    clearAll() {
      this.events = [];
      this.save();
    },

    saveSettings(patch) {
      this.settings = Object.assign({}, this.settings, patch);
      this.save();
    },

    savePlugins(patch) {
      this.plugins = Object.assign({}, this.plugins, patch);
      this.save();
    },

    addCustomPlugin(plugin) {
      plugin.enabled = plugin.enabled !== false;
      this.customPlugins.push(plugin);
      this.save();
      return plugin;
    },

    updateCustomPlugin(id, patch) {
      const i = this.customPlugins.findIndex(x => x.id === id);
      if (i >= 0) {
        this.customPlugins[i] = Object.assign({}, this.customPlugins[i], patch);
        this.save();
        return this.customPlugins[i];
      }
      return null;
    },

    toggleCustomPlugin(id) {
      const p = this.customPlugins.find(x => x.id === id);
      if (p) {
        p.enabled = !p.enabled;
        this.save();
        return p;
      }
      return null;
    },

    removeCustomPlugin(id) {
      this.customPlugins = this.customPlugins.filter(p => p.id !== id);
      this.save();
    },

    /* 某日期某小时是否有事件（含重复规则展开） */
    eventsAt(date, hour) {
      const key = toKey(date);
      return this.events.filter(ev => {
        const s = new Date(ev.start);
        if (ev.allDay) return false;
        if (s.getHours() !== hour) return false;
        return this.matchesDate(ev, key);
      });
    },

    eventsOn(date) {
      const key = toKey(date);
      return this.events.filter(ev => this.matchesDate(ev, key));
    },

    matchesDate(ev, key) {
      const s = new Date(ev.start);
      if (ev.repeat === 'none') {
        return toKey(s) === key;
      }
      if (ev.repeat === 'daily') {
        return s.getTime() <= parseKey(key).getTime();
      }
      if (ev.repeat === 'weekday') {
        const d = parseKey(key);
        const wd = d.getDay();
        return wd >= 1 && wd <= 5 && s.getTime() <= d.getTime();
      }
      if (ev.repeat === 'weekly') {
        const d = parseKey(key);
        return s.getDay() === d.getDay() && s.getTime() <= d.getTime();
      }
      if (ev.repeat === 'interval') {
        const start = startOfDay(s);
        const d = startOfDay(parseKey(key));
        const diff = Math.round((d - start) / 86400000);
        return diff >= 0 && diff % ev.repeatInterval === 0;
      }
      return toKey(s) === key;
    }
  };

  global.Store = Store;
  global.DateUtil = { pad, toKey, parseKey, addDays, startOfDay, isoLocal, fmtDateCN, fmtTimeHM, WEEK_CN };
})(window);
