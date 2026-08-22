/* ============================================================
   api.js · 服务层桩（stub）
   函数签名即未来真实接口形状；接入后端时仅替换实现。
   TODO: 替换为真实接口，保持返回结构不变。
   ============================================================ */
(function (global) {
  'use strict';

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const API = {

    /* GET /api/events —— 获取全部日程 */
    async fetchEvents() {
      await delay(300);
      return { code: 0, data: Store.events };
    },

    /* POST /api/events —— 新建日程 */
    async createEvent(ev) {
      await delay(200);
      const saved = Store.addEvent(ev);
      return { code: 0, data: saved };
    },

    /* PATCH /api/events/:id —— 更新日程 */
    async updateEvent(id, patch) {
      await delay(150);
      const saved = Store.updateEvent(id, patch);
      return { code: 0, data: saved };
    },

    /* DELETE /api/events/:id —— 删除日程 */
    async deleteEvent(id) {
      await delay(120);
      Store.deleteEvent(id);
      return { code: 0 };
    },

    /* POST /api/parse —— 自然语言解析
       仅当「启用云端模式」且已配置密钥时才调用云端语义解析；
       否则默认使用本地语义解析引擎。 */
    async parseText(text) {
      const s = Store.settings;
      const useCloud = s.cloudMode && !!s.cloudKey;
      if (!useCloud) {
        await delay(120);
        const result = Parser.parse(text);
        return { code: 0, data: result, engine: 'local' };
      }
      /* 云端解析（演示桩：真实实现时在此调用云端 API） */
      await delay(400);
      const result = Parser.parse(text);
      return { code: 0, data: result, engine: 'cloud' };
    },

    /* GET /api/weather —— 天气简标（样式插件用，演示数据） */
    async fetchWeather() {
      await delay(400);
      const conds = ['晴', '多云', '小雨', '阴'];
      const cond = conds[Math.floor(Math.random() * conds.length)];
      const temp = 24 + Math.floor(Math.random() * 9);
      return { code: 0, data: { city: '北京', cond, temp, high: temp + 5, low: temp - 6 } };
    },

    /* GET /api/update —— 检查更新
       从设置中的更新源（updateUrl）拉取 latest.json 版本清单，与当前版本比较。
       latest.json 格式：{ "version": "v0.16", "url": "下载地址", "notes": "更新说明" }
       未配置更新源时提示不可用；拉取失败时给出明确错误。 */
    async checkUpdate() {
      const s = Store.settings;
      const VERSION = 'v0.16';
      if (!s.updateUrl) {
        await delay(300);
        return { code: 0, data: { hasUpdate: false, version: VERSION, latest: VERSION, source: 'none' } };
      }
      try {
        const res = await fetch(s.updateUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const m = await res.json();
        const latest = (m && m.version) || '';
        const hasUpdate = !!latest && latest !== VERSION;
        return { code: 0, data: {
          hasUpdate, version: VERSION, latest,
          url: (m && m.url) || '', notes: (m && m.notes) || '', source: 'remote'
        } };
      } catch (err) {
        return { code: 0, data: {
          hasUpdate: false, version: VERSION, latest: VERSION,
          error: '无法连接更新源，请检查网络或更新源地址', source: 'remote'
        } };
      }
    },

    /* GET /api/plugins/market —— 插件市场推荐列表（演示） */
    async fetchMarket() {
      await delay(400);
      return { code: 0, data: [
        { id: 'p_card', name: '卡片式样式包', desc: '让每个日程变成带圆角背景的小卡片。', meta: '样式 · 官方' },
        { id: 'p_weather', name: '带天气栏', desc: '在日程表格顶部增加当天的天气简标。', meta: '样式 · 官方' },
        { id: 'p_progress', name: '带进度条', desc: '在日程下方显示完成进度。', meta: '样式 · 官方' },
        { id: 'p_fitness', name: '健身插件', desc: '点击时间格时扩展出「健身」标签，可继续选择训练部位、组数、重量。', meta: '功能 · 社区' },
        { id: 'p_wechat', name: '微信通知插件', desc: '日程时间到达时，通过本地服务向微信发送提醒消息。', meta: '功能 · 社区' },
        { id: 'p_gridbg', name: '网格纸背景', desc: '上传一张网格纸照片作为日程表格背景。', meta: '样式 · 社区' }
      ]};
    }
  };

  global.API = API;
})(window);
