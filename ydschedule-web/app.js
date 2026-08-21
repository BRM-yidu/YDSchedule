/* ============================================================
   app.js · 应用主逻辑
   视图：首页 / 今日 / 周 / 月 / 插件
   交互：自然语言添加、点击标签添加、编辑/删除、设置面板、导出
   ============================================================ */
(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const App = {
    state: {
      view: 'home',
      currentDate: new Date(),
      weather: null
    },

    /* ---------- 初始化 ---------- */
    init() {
      Store.load();
      this.applySettings();
      this.applyPlugins();
      this.renderRail();
      this.bindShell();
      this.renderNav();
      this.switchView('home');
      setInterval(() => this.updateRailNow(), 60000);
    },

    applySettings() {
      const s = Store.settings;
      document.body.dataset.theme = s.theme;
      const sizes = { sm: { b: '13px', m: '15px', t: '19px', p: '23px' }, md: { b: '14px', m: '16px', t: '20px', p: '24px' }, lg: { b: '16px', m: '18px', t: '22px', p: '27px' } };
      const f = sizes[s.fontSize] || sizes.md;
      const root = document.documentElement.style;
      root.setProperty('--fs-aux', '12px');
      root.setProperty('--fs-body', f.b);
      root.setProperty('--fs-med', f.m);
      root.setProperty('--fs-title', f.t);
      root.setProperty('--fs-page', f.p);
      root.setProperty('--rail-mark-color', s.railMarkColor === 'yellow' ? '#E0B400' : '#3BA55D');
      document.body.classList.toggle('rail-now-dot', s.railNowStyle === 'dot');
      document.body.classList.toggle('nav-glass', s.navGlass !== false);
      document.body.style.backgroundImage = '';
      document.body.style.backgroundColor = '';
      if (s.bgType === 'color') {
        document.body.style.backgroundColor = s.bgColor || '#F3F0E9';
      } else if (s.bgType === 'image' && s.bgImage) {
        document.body.style.backgroundImage = `url("${s.bgImage}")`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
      }
    },

    applyPlugins() {
      const p = Store.plugins;
      document.body.classList.toggle('plug-card', !!p.card);
      document.body.classList.toggle('plug-weather', !!p.weather);
      document.body.classList.toggle('plug-progress', !!p.progress);

      /* 自定义插件样式覆盖（仅启用中的插件生效） */
      const root = document.documentElement.style;
      let rowH = null, eventBg = null, font = null;
      Store.customPlugins.forEach(pl => {
        if (pl.enabled === false) return;
        if (pl.styles) {
          if (pl.styles.rowHeight) rowH = pl.styles.rowHeight;
          if (pl.styles.eventBg) eventBg = pl.styles.eventBg;
          if (pl.styles.fontFamily) font = pl.styles.fontFamily;
        }
      });
      root.setProperty('--row-h', (rowH || 44) + 'px');
      root.setProperty('--event-bg', eventBg || 'var(--surface-2)');
      root.setProperty('--font', font || 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif');
    },

    /* ---------- 左侧导航：时间刻度窄条 ---------- */
    renderRail() {
      const ticks = $('#railTicks');
      let html = '';
      for (let h = 6; h <= 23; h++) {
        html += `<div class="rail-tick">${String(h).padStart(2, '0')}</div>`;
      }
      ticks.innerHTML = html;
      this.updateRailMarks();
      this.updateRailNow();
    },

    /* 今日有日程的小时 → 时间轴对应位置显示标点 */
    updateRailMarks() {
      const marks = $('#railMarks');
      if (!marks) return;
      const today = new Date();
      const hours = [];
      for (let h = 6; h <= 23; h++) {
        if (Store.eventsAt(today, h).length > 0) hours.push(h);
      }
      marks.innerHTML = hours.map(h => {
        const frac = Math.min(1, Math.max(0, (h - 6) / 17));
        return `<div class="rail-mark" style="top:${(frac * 100).toFixed(2)}%"></div>`;
      }).join('');
    },

    /* 当前时间指示：横杠（默认）或圆点 */
    updateRailNow() {
      const now = $('#railNow');
      if (!now) return;
      const d = new Date();
      const frac = Math.min(1, Math.max(0, (d.getHours() + d.getMinutes() / 60 - 6) / 17));
      now.style.top = (frac * 100).toFixed(2) + '%';
    },

    /* ---------- 外壳事件 ---------- */
    bindShell() {
      const rail = $('#navRail');
      const panel = $('#navPanel');

      rail.addEventListener('mouseenter', () => this.openNav());
      panel.addEventListener('mouseleave', () => this.closeNav());
      rail.addEventListener('touchstart', e => { e.preventDefault(); this.openNav(); }, { passive: false });

      document.addEventListener('click', e => {
        if (document.body.classList.contains('nav-open') &&
            !panel.contains(e.target) && !rail.contains(e.target)) {
          this.closeNav();
        }
        const pop = document.querySelector('.cell-pop');
        if (pop && !pop.contains(e.target)) this.closePop();
      });

      $$('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
          this.switchView(item.dataset.nav);
          this.closeNav();
        });
      });

      $('#settingsBtn').addEventListener('click', () => this.openSettings('plugins'));
      $('#settingsClose').addEventListener('click', () => this.closeSettings());
      $('#settingsMask').addEventListener('click', e => {
        if (e.target === $('#settingsMask')) this.closeSettings();
      });
      $('#quickClose').addEventListener('click', () => this.closeQuickSet());
      $('#quickConfirm').addEventListener('click', () => this.confirmQuickSet());
      $('#quickTitle').addEventListener('keydown', e => { if (e.key === 'Enter') this.confirmQuickSet(); });
      $('#quickMask').addEventListener('click', e => {
        if (e.target === $('#quickMask')) this.closeQuickSet();
      });

      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          this.closePop();
          this.closeSettings();
          this.closeQuickSet();
          this.closeNav();
        }
      });
    },

    openNav() { document.body.classList.add('nav-open'); },
    closeNav() { document.body.classList.remove('nav-open'); },

    /* ---------- 视图切换 ---------- */
    switchView(view) {
      this.state.view = view;
      document.body.dataset.view = view;
      $$('.nav-item').forEach(item => {
        if (item.dataset.custom) {
          item.classList.toggle('active', view === 'custom' && this.state.customPlugin && item.dataset.custom === this.state.customPlugin.id);
        } else {
          item.classList.toggle('active', item.dataset.nav === view);
        }
      });
      $$('.view').forEach(v => v.classList.remove('active'));
      const target = $('#view-' + view);
      target.classList.add('active');

      this.closePop();
      if (view === 'home') this.renderHome();
      else if (view === 'today') this.renderToday();
      else if (view === 'week') this.renderWeek();
      else if (view === 'month') this.renderMonth();
      else if (view === 'plugins') this.renderPlugins();
      else if (view === 'custom') this.renderCustomView();
    },

    /* ---------- 自定义插件导航入口 ---------- */
    renderNav() {
      const box = $('#navCustom');
      const plugins = Store.customPlugins.filter(p => p.enabled !== false && p.nav && p.nav.length);
      box.innerHTML = plugins.map(p =>
        p.nav.map(n => `<a class="nav-item" data-custom="${this.esc(p.id)}" data-key="${this.esc(n.key)}" tabindex="0">${this.esc(n.label)}</a>`).join('')
      ).join('');
      box.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
          const plugin = Store.customPlugins.find(x => x.id === item.dataset.custom);
          if (plugin) {
            this.state.customPlugin = plugin;
            this.switchView('custom');
          }
          this.closeNav();
        });
      });
    },

    renderCustomView() {
      const el = $('#view-custom');
      const p = this.state.customPlugin;
      if (!p) {
        el.innerHTML = `<div class="page-head"><div class="page-title">插件视图</div><div class="page-desc">未选择插件。</div></div>`;
        return;
      }
      const navLabel = (p.nav && p.nav.length) ? p.nav[0].label : p.name;
      let dataHtml = '';
      if (p.pluginData && Object.keys(p.pluginData).length) {
        const rows = Object.entries(p.pluginData).map(([k, v]) =>
          `<div class="setting-row"><div class="sr-label">${this.esc(k)}</div><div class="sr-control" style="color:var(--text-sub)">${this.esc(v)}</div></div>`).join('');
        dataHtml = `<div class="plugin-section"><h3>插件数据</h3><div class="plugin-list" style="max-width:640px">${rows}</div></div>`;
      }
      el.innerHTML = `
        <div class="page-head">
          <div class="page-title">${this.esc(navLabel)}</div>
          <div class="page-desc">${this.esc(p.description)}</div>
        </div>
        <div class="plugin-section">
          <h3>插件信息</h3>
          <div class="plugin-list" style="max-width:640px">
            <div class="plugin-item">
              <div class="pi-info">
                <div class="pi-name">${this.esc(p.name)}</div>
                <div class="pi-desc">类型：${this.esc(p.type)} · 版本：${this.esc(p.version)} · 作者：${this.esc(p.author || '未知')}</div>
              </div>
            </div>
          </div>
        </div>
        ${dataHtml}`;
    },

    /* ---------- 首页 ---------- */
    renderHome() {
      const el = $('#view-home');
      const qs = Store.settings.quickSet;
      const showBtn = qs === 'both' || qs === 'button';
      el.innerHTML = `
        <div class="home-view">
          <div class="home-input-wrap">
            <input class="home-input" id="homeInput" type="text" placeholder="输入计划，回车即添加" autocomplete="off" />
            ${showBtn ? '<button class="home-quick-btn" id="homeQuickBtn">快捷设置日程</button>' : ''}
            <div class="home-hint" id="homeHint">已添加</div>
          </div>
        </div>`;
      const input = $('#homeInput');
      input.focus();
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') this.addFromInput(input);
      });
      if (qs === 'both' || qs === 'longpress') this.bindLongPress(input);
      if (showBtn) $('#homeQuickBtn').addEventListener('click', () => this.openQuickSet());
    },

    bindLongPress(input) {
      let timer = null;
      const start = () => {
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
          this.openQuickSet();
        }, 600);
      };
      const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
      input.addEventListener('pointerdown', start);
      input.addEventListener('pointerup', cancel);
      input.addEventListener('pointerleave', cancel);
      input.addEventListener('pointercancel', cancel);
      input.addEventListener('touchmove', cancel, { passive: true });
    },

    async addFromInput(input) {
      const text = input.value.trim();
      if (!text) return;
      const res = await API.parseText(text);
      if (!res.data) { this.toast('未能识别，请换一种说法'); return; }
      const r = res.data;
      if (r.ambiguous) {
        this.openAmbiguityPop(r, input);
        return;
      }
      const start = new Date(r.date);
      start.setHours(r.hour, r.minute, 0, 0);
      const end = new Date(start);
      end.setHours(r.hour + 1, r.minute, 0, 0);
      await API.createEvent({
        title: r.title,
        tag: '日程',
        start: DateUtil.isoLocal(start),
        end: DateUtil.isoLocal(end),
        allDay: false,
        repeat: r.repeat,
        repeatInterval: r.repeatInterval,
        repeatEnd: null,
        pluginData: {}
      });
      input.value = '';
      const hint = $('#homeHint');
      hint.classList.add('show');
      clearTimeout(this._hintTimer);
      this._hintTimer = setTimeout(() => hint.classList.remove('show'), 2000);
      this.maybeWechatNotify(r.title, start);
    },

    /* 语义不完整（如"明天八点"）→ 弹出选项让用户选择 */
    openAmbiguityPop(r, input) {
      this.closePop();
      const pop = document.createElement('div');
      pop.className = 'cell-pop ambiguity-pop';
      pop.innerHTML = `
        <div class="pop-title">「${this.esc(r.title)}」的时间不明确</div>
        <div class="pop-meta" style="margin:4px 0 10px">${DateUtil.fmtDateCN(r.date)} · 请选择具体时间</div>
        <div class="pop-tags">
          ${r.options.map(o => `<button class="pop-tag" data-h="${o.hour}" data-m="${r.minute}">${this.esc(o.label)}</button>`).join('')}
        </div>`;
      document.body.appendChild(pop);
      this.positionPop(pop, input || $('#homeInput'));
      pop.querySelectorAll('.pop-tag').forEach(btn => {
        btn.addEventListener('click', () => {
          const start = new Date(r.date);
          start.setHours(Number(btn.dataset.h), Number(btn.dataset.m), 0, 0);
          const end = new Date(start);
          end.setHours(start.getHours() + 1, start.getMinutes(), 0, 0);
          API.createEvent({
            title: r.title,
            tag: '日程',
            start: DateUtil.isoLocal(start),
            end: DateUtil.isoLocal(end),
            allDay: false,
            repeat: r.repeat,
            repeatInterval: r.repeatInterval,
            repeatEnd: null,
            pluginData: {}
          }).then(() => {
            this.closePop();
            if (input) input.value = '';
            this.toast(`已添加「${r.title}」${DateUtil.fmtDateCN(start)} ${DateUtil.fmtTimeHM(start)}`);
            this.maybeWechatNotify(r.title, start);
            this.refreshView();
          });
        });
      });
    },

    /* ---------- 快捷设置日程面板 ---------- */
    openQuickSet() {
      this._qs = { date: 0, period: '早上', hour: 8, minute: 0, tag: '日程' };
      const q = this._qs;
      const opt = (attr, val, label, on) =>
        `<button class="quick-opt${on ? ' on' : ''}" data-attr="${attr}" data-val="${this.esc(String(val))}">${this.esc(label)}</button>`;

      $('#quickDate').innerHTML = [[0, '今天'], [1, '明天'], [2, '后天']]
        .map(([v, l]) => opt('date', v, l, q.date === v)).join('');
      $('#quickPeriod').innerHTML = ['早上', '上午', '中午', '下午', '晚上']
        .map(p => opt('period', p, p, q.period === p)).join('');
      const hours = [];
      for (let h = 1; h <= 12; h++) hours.push(h);
      $('#quickHour').innerHTML = hours.map(h => opt('hour', h, h, q.hour === h)).join('');
      $('#quickMin').innerHTML = [0, 15, 30, 45]
        .map(m => opt('minute', m, String(m).padStart(2, '0'), q.minute === m)).join('');

      const tags = ['日程', '工作', '运动', '学习'];
      Store.customPlugins.forEach(p => {
        if (p.enabled === false) return;
        (p.tags || []).forEach(t => { if (t.label && !tags.includes(t.label)) tags.push(t.label); });
      });
      if (Store.plugins.fitness && !tags.includes('健身')) tags.push('健身');
      $('#quickTag').innerHTML = tags.map(t => opt('tag', t, t, q.tag === t)).join('');

      $('#quickTitle').value = '';
      $('#quickMask').hidden = false;

      ['quickDate', 'quickPeriod', 'quickHour', 'quickMin', 'quickTag'].forEach(id => {
        const g = document.getElementById(id);
        g.querySelectorAll('.quick-opt').forEach(b => {
          b.addEventListener('click', () => {
            const attr = b.dataset.attr;
            this._qs[attr] = (attr === 'date' || attr === 'hour' || attr === 'minute') ? Number(b.dataset.val) : b.dataset.val;
            g.querySelectorAll('.quick-opt').forEach(x => x.classList.remove('on'));
            b.classList.add('on');
          });
        });
      });

      $('#quickTitle').focus();
    },

    closeQuickSet() {
      $('#quickMask').hidden = true;
    },

    confirmQuickSet() {
      const q = this._qs;
      const title = $('#quickTitle').value.trim();
      if (!title) { this.toast('请输入日程标题'); return; }
      const start = new Date();
      start.setDate(start.getDate() + q.date);
      start.setHours(0, 0, 0, 0);
      let h = q.hour;
      if (q.period === '中午') h = 12;
      else if ((q.period === '下午' || q.period === '晚上') && h < 12) h += 12;
      start.setHours(h, q.minute, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 1, start.getMinutes(), 0, 0);
      API.createEvent({
        title, tag: q.tag,
        start: DateUtil.isoLocal(start), end: DateUtil.isoLocal(end),
        allDay: false, repeat: 'none', repeatInterval: 1, repeatEnd: null, pluginData: {}
      }).then(() => {
        this.closeQuickSet();
        this.toast(`已添加「${title}」${DateUtil.fmtDateCN(start)} ${DateUtil.fmtTimeHM(start)}`);
        this.refreshView();
      });
    },

    /* ---------- 今日视图 ---------- */
    renderToday() {
      const el = $('#view-today');
      const d = this.state.currentDate;
      const title = `今日日程·${DateUtil.fmtDateCN(d)}`;
      const weatherHtml = Store.plugins.weather ? `<div class="weather-bar" id="weatherBar"><span>加载天气…</span></div>` : '';

      let rows = '';
      for (let h = 6; h <= 23; h++) {
        const evs = Store.eventsAt(d, h);
        const cell = evs.length
          ? `<div class="grid-cell has-event" data-h="${h}">${evs.map(ev => this.cellEventHtml(ev)).join('')}</div>`
          : `<div class="grid-cell" data-h="${h}"></div>`;
        rows += `<div class="grid-row"><div class="time-axis">${String(h).padStart(2, '0')}:00</div>${cell}</div>`;
      }

      el.innerHTML = `
        <div class="grid-title">${title}</div>
        ${weatherHtml}
        <div class="time-grid" id="todayGrid">${rows}</div>`;

      this.bindGridClicks($('#todayGrid'), '.grid-cell', d);
      if (Store.plugins.weather) this.loadWeather();
    },

    async loadWeather() {
      if (!this.state.weather) {
        const w = await API.fetchWeather();
        this.state.weather = w.data;
      }
      const bar = $('#weatherBar');
      if (!bar) return;
      const w = this.state.weather;
      bar.innerHTML = `<span>${w.city}</span><span class="wb-temp">${w.temp}°</span><span>${w.cond}</span><span>${w.low}° ~ ${w.high}°</span>`;
    },

    cellEventHtml(ev) {
      const prog = Store.plugins.progress ? `<span class="cell-progress"><i style="width:${(ev.pluginData && ev.pluginData.progress) || 40}%"></i></span>` : '';
      return `<span class="cell-title" data-id="${ev.id}">${this.esc(ev.title)}</span>${prog}`;
    },

    /* ---------- 周视图 ---------- */
    renderWeek() {
      const el = $('#view-week');
      const d = this.state.currentDate;
      const monday = DateUtil.addDays(d, -((d.getDay() + 6) % 7));
      const sunday = DateUtil.addDays(monday, 6);
      const title = `周日程·${monday.getMonth() + 1}月${monday.getDate()}日 - ${sunday.getMonth() + 1}月${sunday.getDate()}日`;
      const todayKey = DateUtil.toKey(new Date());

      let head = `<div class="week-corner"></div>`;
      for (let i = 0; i < 7; i++) {
        const day = DateUtil.addDays(monday, i);
        const key = DateUtil.toKey(day);
        head += `<div class="week-day${key === todayKey ? ' today' : ''}"><span class="wd-num">${day.getDate()}</span>周${DateUtil.WEEK_CN[day.getDay()]}</div>`;
      }

      let body = '';
      for (let h = 6; h <= 23; h++) {
        body += `<div class="week-time">${String(h).padStart(2, '0')}:00</div>`;
        for (let i = 0; i < 7; i++) {
          const day = DateUtil.addDays(monday, i);
          const evs = Store.eventsAt(day, h);
          body += evs.length
            ? `<div class="week-cell has-event" data-day="${i}" data-h="${h}">${evs.map(ev => this.cellEventHtml(ev)).join('')}</div>`
            : `<div class="week-cell" data-day="${i}" data-h="${h}"></div>`;
        }
      }

      el.innerHTML = `
        <div class="grid-title">${title}</div>
        <div class="week-scroll">
          <div class="week-grid" id="weekGrid">${head}${body}</div>
        </div>`;

      const grid = $('#weekGrid');
      grid.querySelectorAll('.week-cell').forEach(cell => {
        cell.addEventListener('click', e => {
          e.stopPropagation();
          if (e.target.closest('.cell-title')) {
            const ev = Store.events.find(x => x.id === e.target.closest('.cell-title').dataset.id);
            if (ev) this.openEditPop(cell, ev);
          } else {
            const day = DateUtil.addDays(monday, Number(cell.dataset.day));
            this.openTagPop(cell, day, Number(cell.dataset.h));
          }
        });
      });
    },

    /* ---------- 月视图 ---------- */
    renderMonth() {
      const el = $('#view-month');
      const d = this.state.currentDate;
      const y = d.getFullYear(), m = d.getMonth();
      const title = `月日程·${y}年${m + 1}月`;
      const first = new Date(y, m, 1);
      const startOffset = (first.getDay() + 6) % 7; // 周一为起点
      const start = DateUtil.addDays(first, -startOffset);
      const todayKey = DateUtil.toKey(new Date());

      let wd = '';
      for (let i = 0; i < 7; i++) wd += `<div class="month-wd">${['一', '二', '三', '四', '五', '六', '日'][i]}</div>`;

      let cells = '';
      for (let i = 0; i < 42; i++) {
        const day = DateUtil.addDays(start, i);
        const key = DateUtil.toKey(day);
        const inMonth = day.getMonth() === m;
        const evs = Store.eventsOn(day);
        const cls = ['month-cell'];
        if (!inMonth) cls.push('other');
        if (key === todayKey) cls.push('today');
        let evHtml = '';
        evs.slice(0, 3).forEach(ev => { evHtml += `<span class="day-event">${this.esc(ev.title)}</span>`; });
        if (evs.length > 3) evHtml += `<span class="day-more">+${evs.length - 3} 项</span>`;
        cells += `<div class="${cls.join(' ')}" data-key="${key}"><span class="day-num">${day.getDate()}</span><div class="day-events">${evHtml}</div></div>`;
      }

      el.innerHTML = `
        <div class="grid-title">${title}</div>
        <div class="month-grid">${wd}${cells}</div>`;

      el.querySelectorAll('.month-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          this.state.currentDate = DateUtil.parseKey(cell.dataset.key);
          this.switchView('today');
        });
      });
    },

    /* ---------- 插件视图 ---------- */
    async renderPlugins() {
      const el = $('#view-plugins');
      const p = Store.plugins;
      const installed = [
        { key: 'card', name: '卡片式样式包', desc: '让每个日程变成带圆角背景的小卡片。', tag: '样式 · 官方' },
        { key: 'weather', name: '带天气栏', desc: '在日程表格顶部增加当天的天气简标。', tag: '样式 · 官方' },
        { key: 'progress', name: '带进度条', desc: '在日程下方显示完成进度。', tag: '样式 · 官方' },
        { key: 'fitness', name: '健身插件', desc: '点击时间格时扩展出「健身」标签，可继续选择训练部位。', tag: '功能 · 社区' },
        { key: 'wechat', name: '微信通知插件', desc: '日程时间到达时，通过本地服务向微信发送提醒。', tag: '功能 · 社区' }
      ];

      const installedHtml = installed.map(it => `
        <div class="plugin-item">
          <div class="pi-info">
            <div class="pi-name">${it.name}</div>
            <div class="pi-desc">${it.desc}</div>
            <div class="pi-tag">${it.tag}</div>
          </div>
          <button class="switch${p[it.key] ? ' on' : ''}" data-key="${it.key}" role="switch" aria-checked="${!!p[it.key]}"></button>
        </div>`).join('');

      el.innerHTML = `
        <div class="page-head">
          <div class="page-title">插件视图</div>
          <div class="page-desc">插件是极简日程表的核心扩展机制：给点击标签增加选项、新增导航入口、改变表格样式、接入外部服务。插件不是可执行程序，由内置安全引擎加载。</div>
        </div>
        <div class="plugin-section">
          <h3>用 AI 制作你的插件</h3>
          <div class="design-card">
            <div class="dc-text">
              <div class="dc-title">插件设计文件</div>
              <div class="dc-desc">下载设计文件，发送给任意 AI（豆包 / DeepSeek / 千问等），说明你想要的插件功能，AI 会按标准格式生成插件文件，导入即可使用。</div>
            </div>
            <div class="dc-actions">
              <button class="text-btn primary" id="dlDesign2">下载设计文件</button>
              <button class="text-btn" id="goSettings2">去设置</button>
            </div>
          </div>
        </div>
        <div class="plugin-section">
          <h3>已安装插件</h3>
          <div class="plugin-list">${installedHtml}</div>
        </div>
        <div class="plugin-section">
          <h3>插件市场 · 精选推荐</h3>
          <div class="market-list" id="marketList"><div class="pi-desc">加载中…</div></div>
        </div>`;

      $('#dlDesign2').addEventListener('click', () => this.downloadDesignFile());
      $('#goSettings2').addEventListener('click', () => this.openSettings('plugins'));

      el.querySelectorAll('.switch').forEach(sw => {
        sw.addEventListener('click', () => {
          const key = sw.dataset.key;
          Store.savePlugins({ [key]: !Store.plugins[key] });
          this.applyPlugins();
          this.renderPlugins();
          this.toast(Store.plugins[key] ? `已启用「${this.pluginName(key)}」` : `已停用「${this.pluginName(key)}」`);
        });
      });

      const market = await API.fetchMarket();
      $('#marketList').innerHTML = market.data.map(m => `
        <div class="market-item">
          <div class="mi-name">${m.name}</div>
          <div class="mi-desc">${m.desc}</div>
          <div class="mi-meta">${m.meta}</div>
          <button class="text-btn primary mi-btn" data-id="${m.id}">安装</button>
        </div>`).join('');
      $('#marketList').querySelectorAll('.mi-btn').forEach(btn => {
        btn.addEventListener('click', () => this.toast('已安装（演示）：' + btn.parentElement.querySelector('.mi-name').textContent));
      });
    },

    pluginName(key) {
      const map = { card: '卡片式样式包', weather: '带天气栏', progress: '带进度条', fitness: '健身插件', wechat: '微信通知插件' };
      return map[key] || key;
    },

    /* ---------- 网格点击：标签选择 / 编辑 ---------- */
    bindGridClicks(grid, cellSel, date) {
      grid.querySelectorAll(cellSel).forEach(cell => {
        cell.addEventListener('click', e => {
          e.stopPropagation();
          if (e.target.closest('.cell-title')) {
            const ev = Store.events.find(x => x.id === e.target.closest('.cell-title').dataset.id);
            if (ev) this.openEditPop(cell, ev);
          } else {
            this.openTagPop(cell, date, Number(cell.dataset.h));
          }
        });
      });
    },

    openTagPop(anchor, date, hour) {
      this.closePop();
      const tags = ['日程', '工作', '运动', '学习'];
      const tagSubs = {};
      if (Store.plugins.fitness) { tags.push('健身'); tagSubs['健身'] = ['胸', '背', '腿', '肩', '手臂']; }
      Store.customPlugins.forEach(p => {
        if (p.enabled === false) return;
        (p.tags || []).forEach(t => {
          if (t.label && !tags.includes(t.label)) tags.push(t.label);
          if (t.label && t.sub && t.sub.length) tagSubs[t.label] = t.sub;
        });
      });
      const tagHtml = tags.map(t => `<button class="pop-tag" data-tag="${this.esc(t)}">${this.esc(t)}</button>`).join('');
      const pop = document.createElement('div');
      pop.className = 'cell-pop';
      pop.innerHTML = `
        <div class="pop-tags">${tagHtml}<button class="pop-tag" data-tag="__custom">自定义</button></div>
        <div class="pop-custom" style="display:none">
          <input type="text" placeholder="输入日程标题" maxlength="30" />
          <button class="text-btn primary">确定</button>
        </div>
        <div class="pop-meta">${DateUtil.fmtDateCN(date)} ${String(hour).padStart(2, '0')}:00</div>`;
      document.body.appendChild(pop);
      this.positionPop(pop, anchor);

      pop.querySelectorAll('.pop-tag').forEach(tag => {
        tag.addEventListener('click', () => {
          if (tag.dataset.tag === '__custom') {
            const box = pop.querySelector('.pop-custom');
            box.style.display = 'flex';
            box.querySelector('input').focus();
            return;
          }
          if (tagSubs[tag.dataset.tag]) {
            const subRow = document.createElement('div');
            subRow.className = 'pop-tags';
            subRow.style.marginTop = '8px';
            subRow.innerHTML = tagSubs[tag.dataset.tag].map(s => `<button class="pop-tag sub" data-s="${this.esc(s)}">${this.esc(s)}</button>`).join('');
            tag.parentElement.appendChild(subRow);
            subRow.querySelectorAll('.pop-tag').forEach(sb => {
              sb.addEventListener('click', () => this.createFromTag(date, hour, tag.dataset.tag + ' · ' + sb.dataset.s, tag.dataset.tag));
            });
            return;
          }
          this.createFromTag(date, hour, tag.dataset.tag, tag.dataset.tag);
        });
      });

      const input = pop.querySelector('.pop-custom input');
      const confirmBtn = pop.querySelector('.pop-custom .text-btn');
      const doCustom = () => {
        const v = input.value.trim();
        if (v) this.createFromTag(date, hour, v, '自定义');
      };
      confirmBtn.addEventListener('click', doCustom);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') doCustom(); });
    },

    openEditPop(anchor, ev) {
      this.closePop();
      const pop = document.createElement('div');
      pop.className = 'cell-pop';
      const start = new Date(ev.start);
      pop.innerHTML = `
        <div class="pop-edit">
          <input type="text" value="${this.esc(ev.title)}" maxlength="30" />
          <div class="pop-meta">${DateUtil.fmtDateCN(start)} ${DateUtil.fmtTimeHM(start)} · ${ev.tag}</div>
          <div class="pop-actions">
            <button class="text-btn danger" data-act="del">删除</button>
            <button class="text-btn primary" data-act="save">保存</button>
          </div>
        </div>`;
      document.body.appendChild(pop);
      this.positionPop(pop, anchor);
      pop.querySelector('input').focus();
      pop.querySelector('input').select();

      pop.querySelector('[data-act="save"]').addEventListener('click', () => {
        const v = pop.querySelector('input').value.trim();
        if (v) { API.updateEvent(ev.id, { title: v }); this.refreshView(); }
      });
      pop.querySelector('[data-act="del"]').addEventListener('click', () => {
        API.deleteEvent(ev.id);
        this.refreshView();
      });
      pop.querySelector('input').addEventListener('keydown', e => {
        if (e.key === 'Enter') pop.querySelector('[data-act="save"]').click();
      });
    },

    createFromTag(date, hour, title, tag) {
      const start = new Date(date);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setHours(hour + 1, 0, 0, 0);
      API.createEvent({
        title, tag,
        start: DateUtil.isoLocal(start),
        end: DateUtil.isoLocal(end),
        allDay: false,
        repeat: 'none',
        repeatInterval: 1,
        repeatEnd: null,
        pluginData: { progress: 0 }
      }).then(() => {
        this.closePop();
        this.refreshView();
      });
    },

    refreshView() {
      const v = this.state.view;
      this.renderRail();
      if (v === 'today') this.renderToday();
      else if (v === 'week') this.renderWeek();
      else if (v === 'month') this.renderMonth();
      else if (v === 'plugins') this.renderPlugins();
    },

    positionPop(pop, anchor) {
      const r = anchor.getBoundingClientRect();
      const pw = pop.offsetWidth || 240;
      const ph = pop.offsetHeight || 120;
      let left = r.left;
      let top = r.bottom + 6;
      if (left + pw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - pw - 8);
      if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
      pop.style.position = 'fixed';
    },

    closePop() {
      const pop = document.querySelector('.cell-pop');
      if (pop) pop.remove();
    },

    /* ---------- 设置面板 ---------- */
    openSettings(cat) {
      this.renderSettingsCats(cat);
      this.renderSettingsContent(cat);
      $('#settingsMask').hidden = false;
    },

    closeSettings() {
      $('#settingsMask').hidden = true;
    },

    renderSettingsCats(active) {
      const cats = [
        { key: 'appearance', label: '外观设置' },
        { key: 'parse', label: '语义解析' },
        { key: 'plugins', label: '插件管理' },
        { key: 'data', label: '数据管理' },
        { key: 'info', label: '程序信息' }
      ];
      $('#settingsCats').innerHTML = cats.map(c =>
        `<button class="settings-cat${c.key === active ? ' active' : ''}" data-cat="${c.key}">${c.label}</button>`).join('');
      $('#settingsCats').querySelectorAll('.settings-cat').forEach(btn => {
        btn.addEventListener('click', () => this.openSettings(btn.dataset.cat));
      });
    },

    renderSettingsContent(cat) {
      const box = $('#settingsContent');
      if (cat === 'appearance') this.renderSettingsAppearance(box);
      else if (cat === 'parse') this.renderSettingsParse(box);
      else if (cat === 'plugins') this.renderSettingsPlugins(box);
      else if (cat === 'data') this.renderSettingsData(box);
      else if (cat === 'info') this.renderSettingsInfo(box);
    },

    renderSettingsPlugins(box) {
      const p = Store.plugins;
      const installed = [
        { key: 'card', name: '卡片式样式包', desc: '日程变成带圆角背景的小卡片。' },
        { key: 'weather', name: '带天气栏', desc: '表格顶部增加当天天气简标。' },
        { key: 'progress', name: '带进度条', desc: '日程下方显示完成进度。' },
        { key: 'fitness', name: '健身插件', desc: '点击标签时扩展「健身」及训练部位。' },
        { key: 'wechat', name: '微信通知插件', desc: '日程到达时向微信发送提醒。' }
      ];
      const customHtml = Store.customPlugins.map(cp => `
        <div class="plugin-item">
          <div class="pi-info">
            <div class="pi-name">${this.esc(cp.name)}</div>
            <div class="pi-desc">${this.esc(cp.description || '')}</div>
            <div class="pi-tag">自定义 · ${this.esc(cp.type)} · v${this.esc(cp.version)}${cp.enabled === false ? ' · 已停用' : ''}</div>
          </div>
          <div class="pi-actions">
            <button class="text-btn danger" data-cp-del="${this.esc(cp.id)}">删除</button>
            <button class="switch${cp.enabled !== false ? ' on' : ''}" data-cp-toggle="${this.esc(cp.id)}" role="switch" aria-checked="${cp.enabled !== false}"></button>
          </div>
        </div>`).join('');

      const removedHtml = Store.removedPlugins.map(key => {
        const meta = installed.find(x => x.key === key);
        if (!meta) return '';
        return `
          <div class="plugin-item">
            <div class="pi-info"><div class="pi-name">${meta.name}</div><div class="pi-desc">${meta.desc}</div></div>
            <button class="text-btn primary" data-pk-restore="${key}">恢复</button>
          </div>`;
      }).join('');

      box.innerHTML = `
        <h4>插件管理</h4>
        <p class="sc-desc">插件是程序最核心的扩展机制。安装方式：插件市场一键安装、导入插件文件、或输入 GitHub 仓库地址拉取。</p>
        <div class="plugin-section">
          <h5>插件设计文件</h5>
          <p class="sc-desc">把设计文件发给任意 AI（豆包 / DeepSeek / 千问等），说明你想要的插件功能，AI 会按标准格式生成插件文件，导入即可使用。</p>
          <div class="setting-row">
            <div><div class="sr-label">下载插件设计文件</div><div class="sr-desc">.md 文本，可直接发送给 AI</div></div>
            <div class="sr-control">
              <button class="text-btn primary" id="dlDesign">下载</button>
              <button class="text-btn" id="copyDesign">复制</button>
            </div>
          </div>
        </div>
        <div class="plugin-section">
          <h5>已安装插件</h5>
          <div class="plugin-list">
            ${installed.map(it => `
              <div class="plugin-item">
                <div class="pi-info"><div class="pi-name">${it.name}</div><div class="pi-desc">${it.desc}</div></div>
                <div class="pi-actions">
                  <button class="text-btn danger" data-pk-del="${it.key}">删除</button>
                  <button class="switch${p[it.key] ? ' on' : ''}" data-key="${it.key}" role="switch" aria-checked="${!!p[it.key]}"></button>
                </div>
              </div>`).join('')}
          </div>
        </div>
        ${removedHtml ? `
        <div class="plugin-section">
          <h5>已删除插件</h5>
          <p class="sc-desc">删除的预设插件不再出现在列表中，可随时恢复。</p>
          <div class="plugin-list">${removedHtml}</div>
        </div>` : ''}
        <div class="plugin-section">
          <h5>自定义插件</h5>
          ${customHtml ? `<div class="plugin-list">${customHtml}</div>` : '<p class="sc-desc">还没有自定义插件。下载上面的设计文件发给 AI，或直接导入 AI 生成的插件文件。</p>'}
        </div>
        <div class="setting-row">
          <div><div class="sr-label">导入插件文件</div><div class="sr-desc">选择 AI 生成的 .json 插件文件</div></div>
          <div class="sr-control"><input type="file" id="importPlugin" accept=".json,application/json" style="display:none"><button class="text-btn primary" id="importBtn">选择文件</button></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">从 GitHub 仓库导入</div><div class="sr-desc">输入仓库地址，程序自动拉取安装</div></div>
          <div class="sr-control"><input class="ctl-input" id="ghInput" placeholder="https://github.com/user/repo"><button class="text-btn primary" id="ghBtn">导入</button></div>
        </div>`;

      box.querySelectorAll('.switch[data-key]').forEach(sw => {
        sw.addEventListener('click', () => {
          const key = sw.dataset.key;
          Store.savePlugins({ [key]: !Store.plugins[key] });
          this.applyPlugins();
          this.renderSettingsPlugins(box);
          this.toast(Store.plugins[key] ? '已启用' : '已停用');
        });
      });
      box.querySelectorAll('.switch[data-cp-toggle]').forEach(sw => {
        sw.addEventListener('click', () => this.toggleCustomPlugin(sw.dataset.cpToggle));
      });
      box.querySelectorAll('[data-cp-del]').forEach(btn => {
        btn.addEventListener('click', () => this.deleteCustomPlugin(btn.dataset.cpDel));
      });
      box.querySelectorAll('[data-pk-del]').forEach(btn => {
        btn.addEventListener('click', () => this.deletePresetPlugin(btn.dataset.pkDel));
      });
      box.querySelectorAll('[data-pk-restore]').forEach(btn => {
        btn.addEventListener('click', () => this.restorePresetPlugin(btn.dataset.pkRestore));
      });
      $('#dlDesign').addEventListener('click', () => this.downloadDesignFile());
      $('#copyDesign').addEventListener('click', () => this.copyDesignFile());
      $('#importBtn').addEventListener('click', () => $('#importPlugin').click());
      $('#importPlugin').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) this.importPluginFile(file);
        e.target.value = '';
      });
      $('#ghBtn').addEventListener('click', () => {
        const url = $('#ghInput').value.trim();
        this.toast(url ? `已从 ${url} 拉取插件（演示）` : '请输入 GitHub 仓库地址');
      });
    },

    /* ---------- 插件设计文件：下载 / 复制 ---------- */
    downloadDesignFile() {
      this.download('YDSchedule插件设计文件.md', PLUGIN_DESIGN_FILE, 'text/markdown;charset=utf-8');
      this.toast('已下载插件设计文件');
    },

    copyDesignFile() {
      const done = () => this.toast('已复制，可直接粘贴发给 AI');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(PLUGIN_DESIGN_FILE).then(done).catch(() => this.fallbackCopy(done));
      } else {
        this.fallbackCopy(done);
      }
    },

    fallbackCopy(done) {
      const ta = document.createElement('textarea');
      ta.value = PLUGIN_DESIGN_FILE;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); }
      catch (e) { this.toast('复制失败，请使用下载按钮'); }
      ta.remove();
    },

    /* ---------- 自定义插件：导入 / 启停 / 删除 ---------- */
    importPluginFile(file) {
      const reader = new FileReader();
      reader.onload = () => {
        let data;
        try {
          data = JSON.parse(reader.result);
        } catch (e) {
          this.toast('导入失败：不是有效的 JSON 文件');
          return;
        }
        const err = this.validatePlugin(data);
        if (err) { this.toast('导入失败：' + err); return; }
        const exists = Store.customPlugins.some(x => x.id === data.id);
        if (exists) {
          Store.updateCustomPlugin(data.id, data);
          this.toast(`已更新插件「${data.name}」`);
        } else {
          Store.addCustomPlugin(data);
          this.toast(`已导入插件「${data.name}」`);
        }
        this.applyPlugins();
        this.renderNav();
        this.openSettings('plugins');
      };
      reader.readAsText(file);
    },

    validatePlugin(d) {
      if (!d || typeof d !== 'object') return '文件内容不是对象';
      if (!d.id || typeof d.id !== 'string') return '缺少 id 字段';
      if (!d.name || typeof d.name !== 'string') return '缺少 name 字段';
      if (!d.version || typeof d.version !== 'string') return '缺少 version 字段';
      if (!d.description || typeof d.description !== 'string') return '缺少 description 字段';
      if (!d.type || typeof d.type !== 'string') return '缺少 type 字段';
      return null;
    },

    toggleCustomPlugin(id) {
      const p = Store.toggleCustomPlugin(id);
      if (!p) return;
      this.applyPlugins();
      this.renderNav();
      this.openSettings('plugins');
      this.toast(p.enabled ? `已启用「${p.name}」` : `已停用「${p.name}」`);
    },

    deleteCustomPlugin(id) {
      const p = Store.customPlugins.find(x => x.id === id);
      if (!p) return;
      if (confirm(`确定删除插件「${p.name}」？`)) {
        Store.removeCustomPlugin(id);
        this.applyPlugins();
        this.renderNav();
        this.openSettings('plugins');
        this.toast('已删除插件');
      }
    },

    deletePresetPlugin(key) {
      const name = this.pluginName(key);
      if (confirm(`确定删除预设插件「${name}」？删除后可在插件管理中恢复。`)) {
        Store.removePresetPlugin(key);
        this.applyPlugins();
        this.openSettings('plugins');
        this.toast(`已删除「${name}」`);
      }
    },

    restorePresetPlugin(key) {
      Store.restorePresetPlugin(key);
      this.applyPlugins();
      this.openSettings('plugins');
      this.toast(`已恢复「${this.pluginName(key)}」`);
    },

    renderSettingsInfo(box) {
      const s = Store.settings;
      box.innerHTML = `
        <h4>程序信息</h4>
        <p class="sc-desc">极简日程表（YDSchedule）v0.14 · Web 原型。四端可用的个人时间管理工具：极度专注、高自由度定制，数据全部保存在本地，无需联网注册账号。</p>
        <div class="setting-row">
          <div><div class="sr-label">检查更新</div><div class="sr-desc">${s.updateUrl ? '从配置的更新源拉取版本清单并比较' : '未配置更新源，检查更新不可用'}</div></div>
          <div class="sr-control"><button class="text-btn primary" id="checkUpdate">检查更新</button></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">更新源地址</div><div class="sr-desc">指向 latest.json 版本清单的 URL，例如 https://example.com/updates/latest.json</div></div>
          <div class="sr-control"><input class="ctl-input" id="updateUrl" type="url" placeholder="https://…/latest.json" value="${this.esc(s.updateUrl || '')}" style="width:240px"><button class="text-btn primary" id="saveUpdateUrl">保存</button></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">版本</div><div class="sr-desc">当前版本</div></div>
          <div class="sr-control"><span style="color:var(--text-sub)">v0.14</span></div>
        </div>
        <div class="update-result" id="updateResult" style="display:none"></div>`;
      $('#checkUpdate').addEventListener('click', async () => {
        this.toast('正在检查更新…');
        const res = await API.checkUpdate();
        const d = res.data;
        const box2 = $('#updateResult');
        box2.style.display = 'block';
        if (d.source === 'none') {
          box2.innerHTML = `<p class="sc-desc" style="color:var(--accent)">未配置更新源，无法检查更新。请在「更新源地址」中填写版本清单 URL，或直接下载最新安装包。</p>`;
        } else if (d.error) {
          box2.innerHTML = `<p class="sc-desc" style="color:var(--accent)">${this.esc(d.error)}</p>`;
        } else if (d.hasUpdate) {
          box2.innerHTML = `
            <p class="sc-desc" style="color:var(--accent)">发现新版本 ${this.esc(d.latest)}${d.notes ? '：' + this.esc(d.notes) : ''}</p>
            ${d.url ? `<button class="text-btn primary" id="goDownload">下载新版本</button>` : ''}`;
          const go = $('#goDownload');
          if (go) go.addEventListener('click', () => {
            if (window.open) { window.open(d.url, '_blank'); }
            else { location.href = d.url; }
          });
        } else {
          box2.innerHTML = `<p class="sc-desc">已是最新版本 v0.14。</p>`;
        }
      });
      $('#saveUpdateUrl').addEventListener('click', () => {
        const v = $('#updateUrl').value.trim();
        Store.saveSettings({ updateUrl: v });
        this.renderSettingsInfo(box);
        this.toast(v ? '更新源已保存' : '已清除更新源');
      });
    },

    renderSettingsAppearance(box) {
      const s = Store.settings;
      const themes = [
        { key: 'paper', label: '舒适阅读' },
        { key: 'white', label: '极简白' },
        { key: 'ink', label: '墨绿' },
        { key: 'night', label: '深夜' }
      ];
      const sizes = [
        { key: 'sm', label: '小' },
        { key: 'md', label: '中' },
        { key: 'lg', label: '大' }
      ];
      const quickSetOpts = [
        { key: 'both', label: '长按+按钮' },
        { key: 'longpress', label: '仅长按' },
        { key: 'button', label: '仅按钮' },
        { key: 'off', label: '关闭' }
      ];
      const bgTypes = [
        { key: 'none', label: '默认' },
        { key: 'color', label: '纯色' },
        { key: 'image', label: '图片' }
      ];
      const swatches = ['#F3F0E9', '#F7F7F5', '#EEF0E8', '#26241F', '#C25E4E', '#8A7A3F', '#5B8A72', '#4A6FA5'];
      box.innerHTML = `
        <h4>外观设置</h4>
        <p class="sc-desc">程序默认使用「舒适阅读」主题，也可切换到其他预设主题、纯色背景或自定义图片背景。</p>
        <div class="setting-row">
          <div><div class="sr-label">主题</div></div>
          <div class="sr-control theme-options">
            ${themes.map(t => `<button class="theme-opt${s.theme === t.key ? ' active' : ''}" data-theme="${t.key}">${t.label}</button>`).join('')}
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">字号</div><div class="sr-desc">标题 / 正文 / 辅助文字三档</div></div>
          <div class="sr-control theme-options">
            ${sizes.map(t => `<button class="theme-opt${s.fontSize === t.key ? ' active' : ''}" data-size="${t.key}">${t.label}</button>`).join('')}
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">背景</div><div class="sr-desc">默认 / 纯色 / 自定义图片</div></div>
          <div class="sr-control theme-options">
            ${bgTypes.map(t => `<button class="theme-opt${s.bgType === t.key ? ' active' : ''}" data-bgtype="${t.key}">${t.label}</button>`).join('')}
          </div>
        </div>
        <div class="setting-row" id="bgColorRow" style="display:${s.bgType === 'color' ? 'flex' : 'none'}">
          <div><div class="sr-label">纯色</div></div>
          <div class="sr-control">
            <div class="bg-swatches">
              ${swatches.map(c => `<button class="bg-swatch${s.bgColor === c ? ' on' : ''}" data-color="${c}" style="background:${c}" aria-label="背景色 ${c}"></button>`).join('')}
            </div>
            <input type="color" class="bg-color-input" id="bgColorInput" value="${this.esc(s.bgColor || '#F3F0E9')}">
          </div>
        </div>
        <div class="setting-row" id="bgImageRow" style="display:${s.bgType === 'image' ? 'flex' : 'none'}">
          <div><div class="sr-label">背景图片</div><div class="sr-desc">上传一张图片作为日程表格背景</div></div>
          <div class="sr-control">
            <input type="file" id="bgFile" accept="image/*" style="display:none">
            <button class="text-btn primary" id="bgBtn">选择图片</button>
            ${s.bgImage ? '<button class="text-btn" id="bgClear">清除</button>' : ''}
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">主页快捷设置</div><div class="sr-desc">长按输入框或点击按钮，弹出选项设置日程；关闭后回车直接添加</div></div>
          <div class="sr-control theme-options">
            ${quickSetOpts.map(o => `<button class="theme-opt${s.quickSet === o.key ? ' active' : ''}" data-quickset="${o.key}">${o.label}</button>`).join('')}
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">时间轴标点</div><div class="sr-desc">今日有日程的小时，在首页收起导航栏时间轴对应位置显示标点</div></div>
          <div class="sr-control theme-options">
            <button class="theme-opt${s.railMarkColor === 'green' ? ' active' : ''}" data-mark="green">绿色</button>
            <button class="theme-opt${s.railMarkColor === 'yellow' ? ' active' : ''}" data-mark="yellow">黄色</button>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">当前时间指示</div><div class="sr-desc">时间轴上标示当前时刻的样式</div></div>
          <div class="sr-control theme-options">
            <button class="theme-opt${s.railNowStyle === 'bar' ? ' active' : ''}" data-now="bar">红色横杠</button>
            <button class="theme-opt${s.railNowStyle === 'dot' ? ' active' : ''}" data-now="dot">红色圆点</button>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">导航栏毛玻璃</div><div class="sr-desc">展开侧边导航时使用毛玻璃效果，可透出背景图片</div></div>
          <div class="sr-control"><button class="switch${s.navGlass !== false ? ' on' : ''}" id="navGlass" role="switch" aria-checked="${s.navGlass !== false}"></button></div>
        </div>`;

      box.querySelectorAll('.theme-opt[data-theme]').forEach(btn => {
        btn.addEventListener('click', () => {
          Store.saveSettings({ theme: btn.dataset.theme });
          this.applySettings();
          this.renderSettingsAppearance(box);
        });
      });
      box.querySelectorAll('.theme-opt[data-size]').forEach(btn => {
        btn.addEventListener('click', () => {
          Store.saveSettings({ fontSize: btn.dataset.size });
          this.applySettings();
          this.renderSettingsAppearance(box);
        });
      });
      box.querySelectorAll('.theme-opt[data-bgtype]').forEach(btn => {
        btn.addEventListener('click', () => {
          Store.saveSettings({ bgType: btn.dataset.bgtype });
          this.applySettings();
          this.renderSettingsAppearance(box);
        });
      });
      box.querySelectorAll('.bg-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
          Store.saveSettings({ bgType: 'color', bgColor: sw.dataset.color });
          this.applySettings();
          this.renderSettingsAppearance(box);
        });
      });
      $('#bgColorInput').addEventListener('input', e => {
        Store.saveSettings({ bgType: 'color', bgColor: e.target.value });
        this.applySettings();
      });
      $('#bgBtn').addEventListener('click', () => $('#bgFile').click());
      $('#bgFile').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          Store.saveSettings({ bgType: 'image', bgImage: reader.result });
          this.applySettings();
          this.renderSettingsAppearance(box);
          this.toast('背景已应用');
        };
        reader.readAsDataURL(file);
      });
      const bgClear = $('#bgClear');
      if (bgClear) bgClear.addEventListener('click', () => {
        Store.saveSettings({ bgType: 'none', bgImage: '' });
        this.applySettings();
        this.renderSettingsAppearance(box);
        this.toast('已恢复默认背景');
      });
      box.querySelectorAll('.theme-opt[data-quickset]').forEach(btn => {
        btn.addEventListener('click', () => {
          Store.saveSettings({ quickSet: btn.dataset.quickset });
          if (this.state.view === 'home') this.renderHome();
          this.renderSettingsAppearance(box);
        });
      });
      box.querySelectorAll('.theme-opt[data-mark]').forEach(btn => {
        btn.addEventListener('click', () => {
          Store.saveSettings({ railMarkColor: btn.dataset.mark });
          this.applySettings();
          this.renderRail();
          this.renderSettingsAppearance(box);
        });
      });
      box.querySelectorAll('.theme-opt[data-now]').forEach(btn => {
        btn.addEventListener('click', () => {
          Store.saveSettings({ railNowStyle: btn.dataset.now });
          this.applySettings();
          this.renderRail();
          this.renderSettingsAppearance(box);
        });
      });
      $('#navGlass').addEventListener('click', () => {
        Store.saveSettings({ navGlass: !(Store.settings.navGlass !== false) });
        this.applySettings();
        this.renderSettingsAppearance(box);
        this.toast(Store.settings.navGlass !== false ? '已开启导航栏毛玻璃' : '已关闭导航栏毛玻璃');
      });
    },

    /* ---------- 语义解析设置 ---------- */
    renderSettingsParse(box) {
      const s = Store.settings;
      const hasKey = !!s.cloudKey;
      const engine = (s.cloudMode && hasKey) ? '云端语义解析' : '本地语义解析';
      const warn = (s.cloudMode && !hasKey) ? '<p class="sc-desc" style="color:var(--accent)">已开启云端模式但尚未配置密钥，当前仍使用本地解析。</p>' : '';
      box.innerHTML = `
        <h4>语义解析</h4>
        <p class="sc-desc">首页输入计划时，程序用语义解析引擎理解时间与内容。默认使用本地引擎：无需联网、数据不出本机；配置云端密钥并开启云端模式后，可切换为云端语义解析。</p>
        ${warn}
        <div class="setting-row">
          <div><div class="sr-label">当前解析引擎</div><div class="sr-desc">未开启云端模式时始终使用本地解析</div></div>
          <div class="sr-control"><span class="engine-badge${engine === '云端语义解析' ? ' cloud' : ''}">${engine}</span></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">启用云端模式</div><div class="sr-desc">开启后才调用云端 API；关闭时默认使用本地语义解析</div></div>
          <div class="sr-control"><button class="switch${s.cloudMode ? ' on' : ''}" id="cloudMode" role="switch" aria-checked="${!!s.cloudMode}"></button></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">云端 API 密钥</div><div class="sr-desc">${hasKey ? '已配置，密钥仅保存在本机，界面不显示明文' : '填写后自动隐藏，仅保存在本机'}</div></div>
          <div class="sr-control" id="keyCtrl">
            ${hasKey
              ? `<span class="key-masked">••••••••</span><button class="text-btn" id="keyEdit">修改</button><button class="text-btn danger" id="keyClear">清除</button>`
              : `<input class="ctl-input" id="cloudKey" type="password" placeholder="输入 API 密钥" autocomplete="off"><button class="text-btn primary" id="keySave">保存</button>`}
          </div>
        </div>`;

      $('#cloudMode').addEventListener('click', () => {
        Store.saveSettings({ cloudMode: !Store.settings.cloudMode });
        this.renderSettingsParse(box);
        this.toast(Store.settings.cloudMode ? '已开启云端模式' : '已关闭云端模式，使用本地解析');
      });

      if (hasKey) {
        $('#keyEdit').addEventListener('click', () => {
          $('#keyCtrl').innerHTML = `<input class="ctl-input" id="cloudKey" type="password" placeholder="输入新密钥" autocomplete="off"><button class="text-btn primary" id="keySave">保存</button>`;
          this.bindKeySave(box);
          $('#cloudKey').focus();
        });
        $('#keyClear').addEventListener('click', () => {
          Store.saveSettings({ cloudKey: '', cloudMode: false });
          this.renderSettingsParse(box);
          this.toast('已清除云端密钥');
        });
      } else {
        this.bindKeySave(box);
      }
    },

    bindKeySave(box) {
      const save = () => {
        const v = $('#cloudKey').value.trim();
        if (!v) { this.toast('请输入密钥'); return; }
        Store.saveSettings({ cloudKey: v });
        this.renderSettingsParse(box);
        this.toast('密钥已保存，仅存储在本机');
      };
      $('#keySave').addEventListener('click', save);
      $('#cloudKey').addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    },

    renderSettingsData(box) {
      const formats = [
        { key: 'csv', label: 'CSV 表格' },
        { key: 'excel', label: 'Excel 工作簿' },
        { key: 'word', label: 'Word 文档' },
        { key: 'json', label: 'JSON 备份' },
        { key: 'ical', label: 'iCal 日历' },
        { key: 'pdf', label: 'PDF 文档' }
      ];
      box.innerHTML = `
        <h4>数据管理</h4>
        <p class="sc-desc">所有日程数据保存在本地隐藏数据文件夹中。支持多种导出格式，用于存档、汇报或迁移到其他日历应用。</p>
        <div class="setting-row">
          <div><div class="sr-label">导出日程数据</div><div class="sr-desc">选择格式后点击导出，生成文件下载到本机</div></div>
          <div class="sr-control">
            <select class="ctl-select" id="exportFmt">
              ${formats.map(f => `<option value="${f.key}">${f.label}</option>`).join('')}
            </select>
            <button class="text-btn primary" id="exportBtn">导出</button>
          </div>
        </div>
        <div class="setting-row" style="margin-top:20px">
          <div><div class="sr-label">清除全部数据</div><div class="sr-desc">删除本地保存的全部日程</div></div>
          <div class="sr-control"><button class="text-btn danger" id="clearData">清除</button></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">恢复示例数据</div><div class="sr-desc">重新载入演示日程</div></div>
          <div class="sr-control"><button class="text-btn primary" id="seedData">恢复</button></div>
        </div>`;

      $('#exportBtn').addEventListener('click', () => this.exportData($('#exportFmt').value));
      $('#clearData').addEventListener('click', () => {
        if (confirm('确定清除全部日程数据？此操作不可撤销。')) {
          Store.clearAll();
          this.refreshView();
          this.toast('已清除全部数据');
        }
      });
      $('#seedData').addEventListener('click', () => {
        Store.reseed();
        this.refreshView();
        this.toast('已恢复示例数据');
      });
    },

    /* ---------- 导出 ---------- */
    exportData(fmt) {
      const evs = Store.events;
      if (fmt === 'csv') {
        const rows = [['编号', '标题', '开始时间', '结束时间', '全天', '重复', '标签']];
        evs.forEach(ev => rows.push([ev.id, ev.title, ev.start, ev.end, ev.allDay ? '是' : '否', ev.repeat, ev.tag]));
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
        this.download('ydschedule.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8');
        this.toast('已导出 CSV');
      } else if (fmt === 'json') {
        this.download('ydschedule.json', JSON.stringify(evs, null, 2), 'application/json');
        this.toast('已导出 JSON 备份');
      } else if (fmt === 'ical') {
        let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//YDSchedule//CN\r\n';
        evs.forEach(ev => {
          const s = new Date(ev.start), e = new Date(ev.end);
          const dt = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '00';
          ics += 'BEGIN:VEVENT\r\nUID:' + ev.id + '\r\nDTSTART:' + dt(s) + '\r\nDTEND:' + dt(e) + '\r\nSUMMARY:' + ev.title.replace(/\n/g, ' ') + '\r\nEND:VEVENT\r\n';
        });
        ics += 'END:VCALENDAR\r\n';
        this.download('ydschedule.ics', ics, 'text/calendar');
        this.toast('已导出 iCal，可导入 Google / 苹果日历');
      } else {
        this.toast(`原型演示：${fmt.toUpperCase()} 导出将在正式版提供`);
      }
    },

    download(name, content, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    /* ---------- 微信通知插件（演示） ---------- */
    maybeWechatNotify(title, time) {
      if (!Store.plugins.wechat) return;
      setTimeout(() => {
        this.toast(`微信通知（演示）：「${title}」${DateUtil.fmtTimeHM(time)} 已到`);
      }, 1500);
    },

    /* ---------- 提示 ---------- */
    toast(msg) {
      const t = $('#toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
    },

    esc(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  };

  document.addEventListener('DOMContentLoaded', () => App.init());
})();
