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
    theme: 'paper',        // paper | white | ink | night
    fontSize: 'md',        // sm | md | lg
    cloudKey: '',          // 云端 AI 密钥（本地编码存储，界面隐藏明文）
    cloudMode: false,      // 云端模式开关：开启后才调用云端 API，否则用本地解析
    quickSet: 'both',      // 主页快捷设置：both 长按+按钮 | longpress 仅长按 | button 仅按钮 | off 关闭
    bgType: 'none',        // 背景：none 默认 | color 纯色 | image 图片
    bgColor: '#F3F0E9',    // 纯色背景色值
    railMarkColor: 'green',// 时间轴今日日程标点颜色：green | yellow
    railNowStyle: 'bar',   // 当前时间指示样式：bar 横杠 | dot 圆点
    navGlass: true,        // 侧边导航毛玻璃：true 开启 | false 关闭
    updateUrl: ''          // 更新源：指向 latest.json 版本清单的 URL，留空则检查更新不可用
  };

  const DEFAULT_PLUGINS = {
    card: false,           // 样式包：卡片式
    weather: false,        // 样式包：带天气栏
    progress: false,       // 样式包：带进度条
    fitness: false,        // 健身插件（扩展点击标签）
    wechat: false          // 微信通知插件
  };

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
    removedPlugins: [],

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
      try {
        const r = localStorage.getItem(KEYS.removed);
        this.removedPlugins = r ? JSON.parse(r) : [];
      } catch (err) {
        this.removedPlugins = [];
      }
      /* 已删除的预设插件不因默认值合并而复活 */
      this.removedPlugins.forEach(k => delete this.plugins[k]);
      this.save();
    },

    save() {
      try {
        localStorage.setItem(KEYS.events, JSON.stringify(this.events));
        const s = Object.assign({}, this.settings, { cloudKey: encodeKey(this.settings.cloudKey) });
        localStorage.setItem(KEYS.settings, JSON.stringify(s));
        localStorage.setItem(KEYS.plugins, JSON.stringify(this.plugins));
        localStorage.setItem(KEYS.custom, JSON.stringify(this.customPlugins));
        localStorage.setItem(KEYS.removed, JSON.stringify(this.removedPlugins));
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

    reseed() {
      this.events = seedEvents();
      this.save();
      return this.events;
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

    /* 预设插件：删除（记录到 removedPlugins）/ 恢复 */
    removePresetPlugin(key) {
      if (!(key in DEFAULT_PLUGINS)) return false;
      if (!this.removedPlugins.includes(key)) this.removedPlugins.push(key);
      delete this.plugins[key];
      this.save();
      return true;
    },

    restorePresetPlugin(key) {
      this.removedPlugins = this.removedPlugins.filter(k => k !== key);
      this.plugins[key] = false;
      this.save();
      return true;
    },

    isPluginRemoved(key) {
      return this.removedPlugins.includes(key);
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
