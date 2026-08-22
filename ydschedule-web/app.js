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
      this.applyLang();
      this.applyPlugins();
      this.renderRail();
      this.bindShell();
      this.renderNav();
      this.switchView('home');
      setInterval(() => this.updateRailNow(), 60000);
      if (!Store.settings.onboarded) this.showOnboarding();
    },

    /* ---------- 多语言 ---------- */
    t(key, vars) {
      const dict = (L10N && L10N[Store.settings.lang]) || L10N['zh-CN'] || {};
      let s = dict[key];
      if (s === undefined) s = (L10N['zh-CN'] && L10N['zh-CN'][key]) || key;
      if (vars) {
        Object.keys(vars).forEach(k => {
          s = String(s).replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
        });
      }
      return s;
    },

    applyLang() {
      const lang = Store.settings.lang || 'zh-CN';
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.body.classList.toggle('rtl', lang === 'ar');
      document.title = this.t('info.appName') + ' · ' + this.t('info.appEn');
      /* 静态 HTML 文本（导航、设置、快捷面板） */
      $$('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); });
      const sBtn = $('#settingsBtn');
      if (sBtn) sBtn.setAttribute('aria-label', this.t('settings.title'));
      const sClose = $('#settingsClose');
      if (sClose) sClose.setAttribute('aria-label', this.t('settings.close'));
      const qClose = $('#quickClose');
      if (qClose) qClose.setAttribute('aria-label', this.t('settings.close'));
      const qTitle = $('#quickTitle');
      if (qTitle) qTitle.placeholder = this.t('quick.titlePh');
      const rail = $('#navRail');
      if (rail) rail.setAttribute('aria-label', this.t('nav.railAria'));
      const panel = $('#navPanel');
      if (panel) panel.setAttribute('aria-label', this.t('nav.panelAria'));
      const qMask = $('#quickMask');
      if (qMask) qMask.setAttribute('aria-label', this.t('quick.title'));
      const sPanel = $('#settingsPanel');
      if (sPanel) sPanel.setAttribute('aria-label', this.t('settings.title'));
      const qPanel = $('#quickPanel');
      if (qPanel) qPanel.setAttribute('aria-label', this.t('quick.title'));
    },

    /* 本地化日期：{y}/{m}/{d} 按当前语言格式输出 */
    fmtDate(d) {
      const y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate();
      return this.t('date.full', { y, m, d: dd });
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
      /* 首页输入框大小：sm | md | lg */
      const inp = { sm: { pad: '10px 16px', fs: '14px' }, md: { pad: '14px 20px', fs: '16px' }, lg: { pad: '18px 24px', fs: '19px' } };
      const i = inp[s.inputSize] || inp.md;
      root.setProperty('--home-input-pad', i.pad);
      root.setProperty('--home-input-fs', i.fs);
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

    /* ---------- 首次使用指引（可跳过） ---------- */
    showOnboarding() {
      const steps = [
        { icon: '⌨', title: this.t('ob.step1Title'), desc: this.t('ob.step1Desc') },
        { icon: '☰', title: this.t('ob.step2Title'), desc: this.t('ob.step2Desc') },
        { icon: '⚙', title: this.t('ob.step3Title'), desc: this.t('ob.step3Desc') }
      ];
      const total = steps.length;
      let cur = 0;
      const overlay = document.createElement('div');
      overlay.className = 'ob-overlay';
      overlay.innerHTML = `
        <div class="ob-card">
          <div class="ob-head">
            <div class="ob-title">${this.esc(this.t('ob.title'))}</div>
            <div class="ob-sub">${this.esc(this.t('ob.subtitle'))}</div>
          </div>
          <div class="ob-body">
            <div class="ob-icon">${steps[0].icon}</div>
            <div class="ob-step-title">${this.esc(steps[0].title)}</div>
            <div class="ob-step-desc">${this.esc(steps[0].desc)}</div>
          </div>
          <div class="ob-dots"></div>
          <div class="ob-foot">
            <button class="text-btn ob-skip">${this.esc(this.t('ob.skip'))}</button>
            <button class="text-btn primary ob-next">${this.esc(this.t('ob.next'))}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const dotsBox = overlay.querySelector('.ob-dots');
      const nextBtn = overlay.querySelector('.ob-next');
      const skipBtn = overlay.querySelector('.ob-skip');

      const render = () => {
        dotsBox.innerHTML = steps.map((_, i) =>
          `<span class="ob-dot${i === cur ? ' on' : ''}"></span>`).join('');
        overlay.querySelector('.ob-icon').textContent = steps[cur].icon;
        overlay.querySelector('.ob-step-title').textContent = steps[cur].title;
        overlay.querySelector('.ob-step-desc').textContent = steps[cur].desc;
        nextBtn.textContent = cur === total - 1 ? this.t('ob.done') : this.t('ob.next');
      };
      const finish = () => {
        overlay.remove();
        Store.saveSettings({ onboarded: true });
      };
      nextBtn.addEventListener('click', () => {
        if (cur < total - 1) { cur++; render(); }
        else finish();
      });
      skipBtn.addEventListener('click', finish);
      overlay.addEventListener('click', e => { if (e.target === overlay) finish(); });
      render();
    },

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
        el.innerHTML = `<div class="page-head"><div class="page-title">${this.esc(this.t('view.plugins'))}</div><div class="page-desc">${this.esc(this.t('view.noPlugin'))}</div></div>`;
        return;
      }
      const navLabel = (p.nav && p.nav.length) ? p.nav[0].label : p.name;
      let dataHtml = '';
      if (p.pluginData && Object.keys(p.pluginData).length) {
        const rows = Object.entries(p.pluginData).map(([k, v]) =>
          `<div class="setting-row"><div class="sr-label">${this.esc(k)}</div><div class="sr-control" style="color:var(--text-sub)">${this.esc(v)}</div></div>`).join('');
        dataHtml = `<div class="plugin-section"><h3>${this.esc(this.t('view.pluginData'))}</h3><div class="plugin-list" style="max-width:640px">${rows}</div></div>`;
      }
      el.innerHTML = `
        <div class="page-head">
          <div class="page-title">${this.esc(navLabel)}</div>
          <div class="page-desc">${this.esc(p.description)}</div>
        </div>
        <div class="plugin-section">
          <h3>${this.esc(this.t('view.pluginInfo'))}</h3>
          <div class="plugin-list" style="max-width:640px">
            <div class="plugin-item">
              <div class="pi-info">
                <div class="pi-name">${this.esc(p.name)}</div>
                <div class="pi-desc">${this.esc(this.t('view.type', { v: p.type }))} · ${this.esc(this.t('view.version', { v: p.version }))} · ${this.esc(this.t('view.author', { v: p.author || this.t('view.unknown') }))}</div>
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
            <input class="home-input" id="homeInput" type="text" placeholder="${this.esc(this.t('home.placeholder'))}" autocomplete="off" />
            ${showBtn ? '<button class="home-quick-btn" id="homeQuickBtn">' + this.esc(this.t('home.quickBtn')) + '</button>' : ''}
            <div class="home-hint" id="homeHint">${this.esc(this.t('home.hint'))}</div>
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
      if (!res.data) { this.toast(this.t('home.notRecognized')); return; }
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
        tag: this.t('tag.schedule'),
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
      this.updateRailMarks(); /* 新增日程后立即刷新收起导航时间轴标点 */
      this.maybeWechatNotify(r.title, start);
    },

    /* 语义不完整（如"明天八点"）→ 弹出选项让用户选择 */
    openAmbiguityPop(r, input) {
      this.closePop();
      const pop = document.createElement('div');
      pop.className = 'cell-pop ambiguity-pop';
      pop.innerHTML = `
        <div class="pop-title">${this.esc(this.t('view.ambiguous', { title: r.title }))}</div>
        <div class="pop-meta" style="margin:4px 0 10px">${this.fmtDate(r.date)} · ${this.esc(this.t('view.chooseTime'))}</div>
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
            tag: this.t('tag.schedule'),
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
            this.toast(this.t('toast.added', { title: r.title, date: this.fmtDate(start), time: DateUtil.fmtTimeHM(start) }));
            this.maybeWechatNotify(r.title, start);
            this.refreshView();
          });
        });
      });
    },

    /* ---------- 快捷设置日程面板 ---------- */
    openQuickSet() {
      this._qs = { date: 0, period: 'morning', hour: 8, minute: 0, tag: this.t('tag.schedule') };
      const q = this._qs;
      const opt = (attr, val, label, on) =>
        `<button class="quick-opt${on ? ' on' : ''}" data-attr="${attr}" data-val="${this.esc(String(val))}">${this.esc(label)}</button>`;

      $('#quickDate').innerHTML = [[0, this.t('quick.today')], [1, this.t('quick.tomorrow')], [2, this.t('quick.dayAfter')]]
        .map(([v, l]) => opt('date', v, l, q.date === v)).join('');
      $('#quickPeriod').innerHTML = [
        ['morning', this.t('quick.morning')], ['forenoon', this.t('quick.forenoon')],
        ['noon', this.t('quick.noon')], ['afternoon', this.t('quick.afternoon')], ['evening', this.t('quick.evening')]
      ].map(([k, l]) => opt('period', k, l, q.period === k)).join('');
      const hours = [];
      for (let h = 1; h <= 12; h++) hours.push(h);
      $('#quickHour').innerHTML = hours.map(h => opt('hour', h, h, q.hour === h)).join('');
      $('#quickMin').innerHTML = [0, 15, 30, 45]
        .map(m => opt('minute', m, String(m).padStart(2, '0'), q.minute === m)).join('');

      const tags = [this.t('tag.schedule'), this.t('tag.work'), this.t('tag.sport'), this.t('tag.study')];
      Store.customPlugins.forEach(p => {
        if (p.enabled === false) return;
        (p.tags || []).forEach(t => { if (t.label && !tags.includes(t.label)) tags.push(t.label); });
      });
      if (Store.plugins.fitness && !tags.includes(this.t('tag.fitness'))) tags.push(this.t('tag.fitness'));
      $('#quickTag').innerHTML = tags.map(t => opt('tag', t, t, q.tag === t)).join('');

      $('#quickTitle').value = '';
      $('#quickTitle').placeholder = this.t('quick.titlePh');
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
      if (!title) { this.toast(this.t('quick.emptyTitle')); return; }
      const start = new Date();
      start.setDate(start.getDate() + q.date);
      start.setHours(0, 0, 0, 0);
      let h = q.hour;
      if (q.period === 'noon') h = 12;
      else if ((q.period === 'afternoon' || q.period === 'evening') && h < 12) h += 12;
      start.setHours(h, q.minute, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 1, start.getMinutes(), 0, 0);
      API.createEvent({
        title, tag: q.tag,
        start: DateUtil.isoLocal(start), end: DateUtil.isoLocal(end),
        allDay: false, repeat: 'none', repeatInterval: 1, repeatEnd: null, pluginData: {}
      }).then(() => {
        this.closeQuickSet();
        this.toast(this.t('toast.added', { title, date: this.fmtDate(start), time: DateUtil.fmtTimeHM(start) }));
        this.refreshView();
      });
    },

    /* ---------- 今日视图 ---------- */
    renderToday() {
      const el = $('#view-today');
      const d = this.state.currentDate;
      const title = `${this.t('view.today')}·${this.fmtDate(d)}`;
      const weatherHtml = Store.plugins.weather ? `<div class="weather-bar" id="weatherBar"><span>${this.esc(this.t('view.loadingWeather'))}</span></div>` : '';

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
      const title = `${this.t('view.week')}·${this.t('date.weekRange', { m1: monday.getMonth() + 1, d1: monday.getDate(), m2: sunday.getMonth() + 1, d2: sunday.getDate() })}`;
      const todayKey = DateUtil.toKey(new Date());
      const wdKeys = ['wd.sun', 'wd.mon', 'wd.tue', 'wd.wed', 'wd.thu', 'wd.fri', 'wd.sat'];

      let head = `<div class="week-corner"></div>`;
      for (let i = 0; i < 7; i++) {
        const day = DateUtil.addDays(monday, i);
        const key = DateUtil.toKey(day);
        head += `<div class="week-day${key === todayKey ? ' today' : ''}"><span class="wd-num">${day.getDate()}</span>${this.esc(this.t('view.weekday', { day: this.t(wdKeys[day.getDay()]) }))}</div>`;
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
      const title = `${this.t('view.month')}·${this.t('date.yearMonth', { y, m: m + 1 })}`;
      const first = new Date(y, m, 1);
      const startOffset = (first.getDay() + 6) % 7; // 周一为起点
      const start = DateUtil.addDays(first, -startOffset);
      const todayKey = DateUtil.toKey(new Date());
      const wdKeys = ['wd.sun', 'wd.mon', 'wd.tue', 'wd.wed', 'wd.thu', 'wd.fri', 'wd.sat'];

      let wd = '';
      for (let i = 0; i < 7; i++) wd += `<div class="month-wd">${this.esc(this.t(wdKeys[(i + 1) % 7]))}</div>`;

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
        if (evs.length > 3) evHtml += `<span class="day-more">${this.esc(this.t('view.more', { n: evs.length - 3 }))}</span>`;
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
        { key: 'card', name: this.t('plugin.card'), desc: this.t('plugin.cardDesc'), tag: this.t('plugin.styleOfficial') },
        { key: 'weather', name: this.t('plugin.weather'), desc: this.t('plugin.weatherDesc'), tag: this.t('plugin.styleOfficial') },
        { key: 'progress', name: this.t('plugin.progress'), desc: this.t('plugin.progressDesc'), tag: this.t('plugin.styleOfficial') },
        { key: 'fitness', name: this.t('plugin.fitness'), desc: this.t('plugin.fitnessDesc'), tag: this.t('plugin.funcCommunity') },
        { key: 'wechat', name: this.t('plugin.wechat'), desc: this.t('plugin.wechatDesc'), tag: this.t('plugin.funcCommunity') }
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
          <div class="page-title">${this.esc(this.t('view.plugins'))}</div>
          <div class="page-desc">${this.esc(this.t('plugins.desc'))}</div>
        </div>
        <div class="plugin-section">
          <h3>${this.esc(this.t('plugins.designFile'))}</h3>
          <div class="design-card">
            <div class="dc-text">
              <div class="dc-title">${this.esc(this.t('plugins.downloadDesign'))}</div>
              <div class="dc-desc">${this.esc(this.t('plugins.designDesc'))}</div>
            </div>
            <div class="dc-actions">
              <button class="text-btn primary" id="dlDesign2">${this.esc(this.t('plugins.download'))}</button>
              <button class="text-btn" id="goSettings2">${this.esc(this.t('settings.plugins'))}</button>
            </div>
          </div>
        </div>
        <div class="plugin-section">
          <h3>${this.esc(this.t('plugins.installed'))}</h3>
          <div class="plugin-list">${installedHtml}</div>
        </div>
        <div class="plugin-section">
          <h3>${this.esc(this.t('plugins.market'))}</h3>
          <div class="market-list" id="marketList"><div class="pi-desc">${this.esc(this.t('misc.loading'))}</div></div>
        </div>`;

      $('#dlDesign2').addEventListener('click', () => this.downloadDesignFile());
      $('#goSettings2').addEventListener('click', () => this.openSettings('plugins'));

      el.querySelectorAll('.switch').forEach(sw => {
        sw.addEventListener('click', () => {
          const key = sw.dataset.key;
          Store.savePlugins({ [key]: !Store.plugins[key] });
          this.applyPlugins();
          this.renderPlugins();
          this.toast(Store.plugins[key] ? this.t('plugins.enabled2', { name: this.pluginName(key) }) : this.t('plugins.disabled2', { name: this.pluginName(key) }));
        });
      });

      const market = await API.fetchMarket();
      $('#marketList').innerHTML = market.data.map(m => `
        <div class="market-item">
          <div class="mi-name">${m.name}</div>
          <div class="mi-desc">${m.desc}</div>
          <div class="mi-meta">${m.meta}</div>
          <button class="text-btn primary mi-btn" data-id="${m.id}">${this.esc(this.t('misc.install'))}</button>
        </div>`).join('');
      $('#marketList').querySelectorAll('.mi-btn').forEach(btn => {
        btn.addEventListener('click', () => this.toast(this.t('plugins.installedDemo') + btn.parentElement.querySelector('.mi-name').textContent));
      });
    },

    pluginName(key) {
      const map = { card: this.t('plugin.card'), weather: this.t('plugin.weather'), progress: this.t('plugin.progress'), fitness: this.t('plugin.fitness'), wechat: this.t('plugin.wechat') };
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
      const tags = [this.t('tag.schedule'), this.t('tag.work'), this.t('tag.sport'), this.t('tag.study')];
      const tagSubs = {};
      if (Store.plugins.fitness) { tags.push(this.t('tag.fitness')); tagSubs[this.t('tag.fitness')] = [this.t('tag.chest'), this.t('tag.back'), this.t('tag.leg'), this.t('tag.shoulder'), this.t('tag.arm')]; }
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
        <div class="pop-tags">${tagHtml}<button class="pop-tag" data-tag="__custom">${this.esc(this.t('tag.custom'))}</button></div>
        <div class="pop-custom" style="display:none">
          <input type="text" placeholder="${this.esc(this.t('edit.customTitle'))}" maxlength="30" />
          <button class="text-btn primary">${this.esc(this.t('edit.confirm'))}</button>
        </div>
        <div class="pop-meta">${this.fmtDate(date)} ${String(hour).padStart(2, '0')}:00</div>`;
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
        if (v) this.createFromTag(date, hour, v, this.t('tag.custom'));
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
          <div class="pop-meta">${this.fmtDate(start)} ${DateUtil.fmtTimeHM(start)} · ${this.esc(ev.tag)}</div>
          <div class="pop-actions">
            <button class="text-btn danger" data-act="del">${this.esc(this.t('edit.delete'))}</button>
            <button class="text-btn primary" data-act="save">${this.esc(this.t('edit.save'))}</button>
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
        { key: 'appearance', label: this.t('settings.appearance') },
        { key: 'parse', label: this.t('settings.parse') },
        { key: 'plugins', label: this.t('settings.plugins') },
        { key: 'data', label: this.t('settings.data') },
        { key: 'info', label: this.t('settings.info') }
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
        { key: 'card', name: this.t('plugin.card'), desc: this.t('plugin.cardDesc2') },
        { key: 'weather', name: this.t('plugin.weather'), desc: this.t('plugin.weatherDesc2') },
        { key: 'progress', name: this.t('plugin.progress'), desc: this.t('plugin.progressDesc2') },
        { key: 'fitness', name: this.t('plugin.fitness'), desc: this.t('plugin.fitnessDesc2') },
        { key: 'wechat', name: this.t('plugin.wechat'), desc: this.t('plugin.wechatDesc2') }
      ];
      const customHtml = Store.customPlugins.map(cp => `
        <div class="plugin-item">
          <div class="pi-info">
            <div class="pi-name">${this.esc(cp.name)}</div>
            <div class="pi-desc">${this.esc(cp.description || '')}</div>
            <div class="pi-tag">${this.esc(this.t('tag.custom'))} · ${this.esc(cp.type)} · v${this.esc(cp.version)}${cp.enabled === false ? ' · ' + this.esc(this.t('plugins.disabled')) : ''}</div>
          </div>
          <div class="pi-actions">
            <button class="text-btn danger" data-cp-del="${this.esc(cp.id)}">${this.esc(this.t('plugins.delete'))}</button>
            <button class="switch${cp.enabled !== false ? ' on' : ''}" data-cp-toggle="${this.esc(cp.id)}" role="switch" aria-checked="${cp.enabled !== false}"></button>
          </div>
        </div>`).join('');

      const removedHtml = Store.removedPlugins.map(key => {
        const meta = installed.find(x => x.key === key);
        if (!meta) return '';
        return `
          <div class="plugin-item">
            <div class="pi-info"><div class="pi-name">${meta.name}</div><div class="pi-desc">${meta.desc}</div></div>
            <button class="text-btn primary" data-pk-restore="${key}">${this.esc(this.t('plugins.restore'))}</button>
          </div>`;
      }).join('');

      box.innerHTML = `
        <h4>${this.esc(this.t('plugins.title'))}</h4>
        <p class="sc-desc keep-desc">${this.esc(this.t('plugins.desc'))}</p>
        <div class="plugin-section">
          <h5>${this.esc(this.t('plugins.designFile'))}</h5>
          <p class="sc-desc keep-desc">${this.esc(this.t('plugins.designDesc'))}</p>
          <div class="setting-row">
            <div><div class="sr-label">${this.esc(this.t('plugins.downloadDesign'))}</div><div class="sr-desc">${this.esc(this.t('plugins.downloadDesignDesc'))}</div></div>
            <div class="sr-control">
              <button class="text-btn primary" id="dlDesign">${this.esc(this.t('plugins.download'))}</button>
              <button class="text-btn" id="copyDesign">${this.esc(this.t('plugins.copy'))}</button>
            </div>
          </div>
        </div>
        <div class="plugin-section">
          <h5>${this.esc(this.t('plugins.installed'))}</h5>
          <div class="plugin-list">
            ${installed.map(it => `
              <div class="plugin-item">
                <div class="pi-info"><div class="pi-name">${it.name}</div><div class="pi-desc">${it.desc}</div></div>
                <div class="pi-actions">
                  <button class="text-btn danger" data-pk-del="${it.key}">${this.esc(this.t('plugins.delete'))}</button>
                  <button class="switch${p[it.key] ? ' on' : ''}" data-key="${it.key}" role="switch" aria-checked="${!!p[it.key]}"></button>
                </div>
              </div>`).join('')}
          </div>
        </div>
        ${removedHtml ? `
        <div class="plugin-section">
          <h5>${this.esc(this.t('plugins.removed'))}</h5>
          <p class="sc-desc">${this.esc(this.t('plugins.removedDesc'))}</p>
          <div class="plugin-list">${removedHtml}</div>
        </div>` : ''}
        <div class="plugin-section">
          <h5>${this.esc(this.t('plugins.custom'))}</h5>
          ${customHtml ? `<div class="plugin-list">${customHtml}</div>` : `<p class="sc-desc">${this.esc(this.t('plugins.noCustom'))}</p>`}
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('plugins.importFile'))}</div><div class="sr-desc">${this.esc(this.t('plugins.importFileDesc'))}</div></div>
          <div class="sr-control"><input type="file" id="importPlugin" accept=".json,application/json" style="display:none"><button class="text-btn primary" id="importBtn">${this.esc(this.t('plugins.selectFile'))}</button></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('plugins.importGh'))}</div><div class="sr-desc">${this.esc(this.t('plugins.importGhDesc'))}</div></div>
          <div class="sr-control"><input class="ctl-input" id="ghInput" placeholder="https://github.com/user/repo"><button class="text-btn primary" id="ghBtn">${this.esc(this.t('plugins.import'))}</button></div>
        </div>`;

      box.querySelectorAll('.switch[data-key]').forEach(sw => {
        sw.addEventListener('click', () => {
          const key = sw.dataset.key;
          Store.savePlugins({ [key]: !Store.plugins[key] });
          this.applyPlugins();
          this.renderSettingsPlugins(box);
          this.toast(Store.plugins[key] ? this.t('plugins.enabled') : this.t('plugins.disabled'));
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
        this.toast(url ? this.t('plugins.ghPull', { url }) : this.t('plugins.ghEmpty'));
      });
    },

    /* ---------- 插件设计文件：下载 / 复制 ---------- */
    downloadDesignFile() {
      this.download('YDSchedule-plugin-design.md', PLUGIN_DESIGN_FILE, 'text/markdown;charset=utf-8');
      this.toast(this.t('plugins.downloaded'));
    },

    copyDesignFile() {
      const done = () => this.toast(this.t('plugins.copied'));
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
      catch (e) { this.toast(this.t('plugins.copyFail')); }
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
          this.toast(this.t('plugins.importFail'));
          return;
        }
        const err = this.validatePlugin(data);
        if (err) { this.toast(this.t('plugins.importFail2', { msg: err })); return; }
        const exists = Store.customPlugins.some(x => x.id === data.id);
        if (exists) {
          Store.updateCustomPlugin(data.id, data);
          this.toast(this.t('plugins.updated', { name: data.name }));
        } else {
          Store.addCustomPlugin(data);
          this.toast(this.t('plugins.imported', { name: data.name }));
        }
        this.applyPlugins();
        this.renderNav();
        this.openSettings('plugins');
      };
      reader.readAsText(file);
    },

    validatePlugin(d) {
      if (!d || typeof d !== 'object') return this.t('plugin.err.notObj');
      if (!d.id || typeof d.id !== 'string') return this.t('plugin.err.noId');
      if (!d.name || typeof d.name !== 'string') return this.t('plugin.err.noName');
      if (!d.version || typeof d.version !== 'string') return this.t('plugin.err.noVersion');
      if (!d.description || typeof d.description !== 'string') return this.t('plugin.err.noDesc');
      if (!d.type || typeof d.type !== 'string') return this.t('plugin.err.noType');
      return null;
    },

    toggleCustomPlugin(id) {
      const p = Store.toggleCustomPlugin(id);
      if (!p) return;
      this.applyPlugins();
      this.renderNav();
      this.openSettings('plugins');
      this.toast(p.enabled ? this.t('plugins.enabled2', { name: p.name }) : this.t('plugins.disabled2', { name: p.name }));
    },

    deleteCustomPlugin(id) {
      const p = Store.customPlugins.find(x => x.id === id);
      if (!p) return;
      if (confirm(this.t('plugins.confirmDelCustom', { name: p.name }))) {
        Store.removeCustomPlugin(id);
        this.applyPlugins();
        this.renderNav();
        this.openSettings('plugins');
        this.toast(this.t('plugins.deleted'));
      }
    },

    deletePresetPlugin(key) {
      const name = this.pluginName(key);
      if (confirm(this.t('plugins.confirmDelPreset', { name }))) {
        Store.removePresetPlugin(key);
        this.applyPlugins();
        this.openSettings('plugins');
        this.toast(this.t('plugins.deleted') + '「' + name + '」');
      }
    },

    restorePresetPlugin(key) {
      Store.restorePresetPlugin(key);
      this.applyPlugins();
      this.openSettings('plugins');
      this.toast(this.t('plugins.restored') + '「' + this.pluginName(key) + '」');
    },

    renderSettingsInfo(box) {
      const s = Store.settings;
      box.innerHTML = `
        <h4>${this.esc(this.t('info.title'))}</h4>
        <p class="sc-desc">${this.esc(this.t('info.desc'))}</p>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('info.author'))}</div><div class="sr-desc">${this.esc(this.t('info.authorDesc'))}</div></div>
          <div class="sr-control"><span style="color:var(--text-sub)">${this.esc(this.t('info.authorName'))} · ${this.esc(this.t('info.appName'))} (${this.esc(this.t('info.appEn'))})</span></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('info.checkUpdate'))}</div><div class="sr-desc">${s.updateUrl ? this.esc(this.t('info.checkUpdateDesc')) : this.esc(this.t('info.checkUpdateDesc2'))}</div></div>
          <div class="sr-control"><button class="text-btn primary" id="checkUpdate">${this.esc(this.t('info.checkUpdate'))}</button></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('info.updateUrl'))}</div><div class="sr-desc">${this.esc(this.t('info.updateUrlDesc'))}</div></div>
          <div class="sr-control"><input class="ctl-input" id="updateUrl" type="url" placeholder="https://…/latest.json" value="${this.esc(s.updateUrl || '')}" style="width:240px"><button class="text-btn primary" id="saveUpdateUrl">${this.esc(this.t('misc.save'))}</button></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('info.version'))}</div><div class="sr-desc">${this.esc(this.t('info.versionDesc'))}</div></div>
          <div class="sr-control"><span style="color:var(--text-sub)">v0.15</span></div>
        </div>
        <div class="update-result" id="updateResult" style="display:none"></div>`;
      $('#checkUpdate').addEventListener('click', async () => {
        this.toast(this.t('info.checking'));
        const res = await API.checkUpdate();
        const d = res.data;
        const box2 = $('#updateResult');
        box2.style.display = 'block';
        if (d.source === 'none') {
          box2.innerHTML = `<p class="sc-desc" style="color:var(--accent)">${this.esc(this.t('info.noSource'))}</p>`;
        } else if (d.error) {
          box2.innerHTML = `<p class="sc-desc" style="color:var(--accent)">${this.esc(d.error)}</p>`;
        } else if (d.hasUpdate) {
          box2.innerHTML = `
            <p class="sc-desc" style="color:var(--accent)">${this.esc(this.t('info.newVersion', { v: d.latest }))}${d.notes ? '：' + this.esc(d.notes) : ''}</p>
            ${d.url ? `<button class="text-btn primary" id="goDownload">${this.esc(this.t('info.download'))}</button>` : ''}`;
          const go = $('#goDownload');
          if (go) go.addEventListener('click', () => {
            if (window.open) { window.open(d.url, '_blank'); }
            else { location.href = d.url; }
          });
        } else {
          box2.innerHTML = `<p class="sc-desc">${this.esc(this.t('info.latest'))}</p>`;
        }
      });
      $('#saveUpdateUrl').addEventListener('click', () => {
        const v = $('#updateUrl').value.trim();
        Store.saveSettings({ updateUrl: v });
        this.renderSettingsInfo(box);
        this.toast(v ? this.t('info.urlSaved') : this.t('info.urlCleared'));
      });
    },

    renderSettingsAppearance(box) {
      const s = Store.settings;
      const themes = [
        { key: 'paper', label: this.t('theme.paper') },
        { key: 'white', label: this.t('theme.white') },
        { key: 'ink', label: this.t('theme.ink') },
        { key: 'night', label: this.t('theme.night') }
      ];
      const sizes = [
        { key: 'sm', label: this.t('size.sm') },
        { key: 'md', label: this.t('size.md') },
        { key: 'lg', label: this.t('size.lg') }
      ];
      const quickSetOpts = [
        { key: 'both', label: this.t('qs.both') },
        { key: 'longpress', label: this.t('qs.longpress') },
        { key: 'button', label: this.t('qs.button') },
        { key: 'off', label: this.t('qs.off') }
      ];
      const bgTypes = [
        { key: 'none', label: this.t('bg.none') },
        { key: 'color', label: this.t('bg.color') },
        { key: 'image', label: this.t('bg.image') }
      ];
      const langNames = {
        'zh-CN': (L10N['zh-CN'] && L10N['zh-CN']['lang.name']) || '简体中文',
        'zh-TW': (L10N['zh-TW'] && L10N['zh-TW']['lang.name']) || '繁體中文',
        'en': (L10N['en'] && L10N['en']['lang.name']) || 'English',
        'fr': (L10N['fr'] && L10N['fr']['lang.name']) || 'Français',
        'ru': (L10N['ru'] && L10N['ru']['lang.name']) || 'Русский',
        'es': (L10N['es'] && L10N['es']['lang.name']) || 'Español',
        'ar': (L10N['ar'] && L10N['ar']['lang.name']) || 'العربية'
      };
      const langs = Object.keys(langNames).map(key => ({ key, label: langNames[key] }));
      const swatches = ['#F3F0E9', '#F7F7F5', '#EEF0E8', '#26241F', '#C25E4E', '#8A7A3F', '#5B8A72', '#4A6FA5'];
      box.innerHTML = `
        <h4>${this.esc(this.t('appearance.title'))}</h4>
        <p class="sc-desc">${this.esc(this.t('appearance.desc'))}</p>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('appearance.theme'))}</div></div>
          <div class="sr-control theme-options">
            ${themes.map(t => `<button class="theme-opt${s.theme === t.key ? ' active' : ''}" data-theme="${t.key}">${this.esc(t.label)}</button>`).join('')}
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('appearance.fontSize'))}</div><div class="sr-desc">${this.esc(this.t('appearance.fontSizeDesc'))}</div></div>
          <div class="sr-control theme-options">
            ${sizes.map(t => `<button class="theme-opt${s.fontSize === t.key ? ' active' : ''}" data-size="${t.key}">${this.esc(t.label)}</button>`).join('')}
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('appearance.inputSize'))}</div><div class="sr-desc">${this.esc(this.t('appearance.inputSizeDesc'))}</div></div>
          <div class="sr-control theme-options">
            ${sizes.map(t => `<button class="theme-opt${s.inputSize === t.key ? ' active' : ''}" data-inputsize="${t.key}">${this.esc(t.label)}</button>`).join('')}
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('appearance.lang'))}</div><div class="sr-desc">${this.esc(this.t('appearance.langDesc'))}</div></div>
          <div class="sr-control theme-options">
            ${langs.map(t => `<button class="theme-opt${s.lang === t.key ? ' active' : ''}" data-lang="${t.key}">${this.esc(t.label)}</button>`).join('')}
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('appearance.bg'))}</div><div class="sr-desc">${this.esc(this.t('appearance.bgDesc'))}</div></div>
          <div class="sr-control theme-options">
            ${bgTypes.map(t => `<button class="theme-opt${s.bgType === t.key ? ' active' : ''}" data-bgtype="${t.key}">${this.esc(t.label)}</button>`).join('')}
          </div>
        </div>
        <div class="setting-row" id="bgColorRow" style="display:${s.bgType === 'color' ? 'flex' : 'none'}">
          <div><div class="sr-label">${this.esc(this.t('appearance.bgColor'))}</div></div>
          <div class="sr-control">
            <div class="bg-swatches">
              ${swatches.map(c => `<button class="bg-swatch${s.bgColor === c ? ' on' : ''}" data-color="${c}" style="background:${c}" aria-label="${this.esc(this.t('appearance.bgAria', { c }))}"></button>`).join('')}
            </div>
            <input type="color" class="bg-color-input" id="bgColorInput" value="${this.esc(s.bgColor || '#F3F0E9')}">
          </div>
        </div>
        <div class="setting-row" id="bgImageRow" style="display:${s.bgType === 'image' ? 'flex' : 'none'}">
          <div><div class="sr-label">${this.esc(this.t('appearance.bgImage'))}</div><div class="sr-desc">${this.esc(this.t('appearance.bgImageDesc'))}</div></div>
          <div class="sr-control">
            <input type="file" id="bgFile" accept="image/*" style="display:none">
            <button class="text-btn primary" id="bgBtn">${this.esc(this.t('appearance.bgSelect'))}</button>
            ${s.bgImage ? '<button class="text-btn" id="bgClear">' + this.esc(this.t('appearance.bgClear')) + '</button>' : ''}
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('appearance.quickSet'))}</div><div class="sr-desc">${this.esc(this.t('appearance.quickSetDesc'))}</div></div>
          <div class="sr-control theme-options">
            ${quickSetOpts.map(o => `<button class="theme-opt${s.quickSet === o.key ? ' active' : ''}" data-quickset="${o.key}">${this.esc(o.label)}</button>`).join('')}
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('appearance.railMark'))}</div><div class="sr-desc">${this.esc(this.t('appearance.railMarkDesc'))}</div></div>
          <div class="sr-control theme-options">
            <button class="theme-opt${s.railMarkColor === 'green' ? ' active' : ''}" data-mark="green">${this.esc(this.t('mark.green'))}</button>
            <button class="theme-opt${s.railMarkColor === 'yellow' ? ' active' : ''}" data-mark="yellow">${this.esc(this.t('mark.yellow'))}</button>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('appearance.railNow'))}</div><div class="sr-desc">${this.esc(this.t('appearance.railNowDesc'))}</div></div>
          <div class="sr-control theme-options">
            <button class="theme-opt${s.railNowStyle === 'bar' ? ' active' : ''}" data-now="bar">${this.esc(this.t('now.bar'))}</button>
            <button class="theme-opt${s.railNowStyle === 'dot' ? ' active' : ''}" data-now="dot">${this.esc(this.t('now.dot'))}</button>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('appearance.navGlass'))}</div><div class="sr-desc">${this.esc(this.t('appearance.navGlassDesc'))}</div></div>
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
      box.querySelectorAll('.theme-opt[data-inputsize]').forEach(btn => {
        btn.addEventListener('click', () => {
          Store.saveSettings({ inputSize: btn.dataset.inputsize });
          this.applySettings();
          if (this.state.view === 'home') this.renderHome();
          this.renderSettingsAppearance(box);
        });
      });
      box.querySelectorAll('.theme-opt[data-lang]').forEach(btn => {
        btn.addEventListener('click', () => {
          Store.saveSettings({ lang: btn.dataset.lang });
          this.applyLang();
          this.renderSettingsCats('appearance');
          this.renderSettingsAppearance(box);
          this.renderNav();
          if (this.state.view === 'home') this.renderHome();
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
      $('#bgBtn').addEventListener('click', () => {
        /* 移动端：选择图片前说明权限用途 */
        if (confirm(this.t('perm.bgTitle') + '\n\n' + this.t('perm.bgDesc'))) {
          $('#bgFile').click();
        }
      });
      $('#bgFile').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          Store.saveSettings({ bgType: 'image', bgImage: reader.result });
          this.applySettings();
          this.renderSettingsAppearance(box);
          this.toast(this.t('toast.bgApplied'));
        };
        reader.readAsDataURL(file);
      });
      const bgClear = $('#bgClear');
      if (bgClear) bgClear.addEventListener('click', () => {
        Store.saveSettings({ bgType: 'none', bgImage: '' });
        this.applySettings();
        this.renderSettingsAppearance(box);
        this.toast(this.t('toast.bgCleared'));
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
        this.toast(Store.settings.navGlass !== false ? this.t('toast.navGlassOn') : this.t('toast.navGlassOff'));
      });
    },

    /* ---------- 语义解析设置 ---------- */
    renderSettingsParse(box) {
      const s = Store.settings;
      const hasKey = !!s.cloudKey;
      const engine = (s.cloudMode && hasKey) ? this.t('parse.cloud') : this.t('parse.local');
      const warn = (s.cloudMode && !hasKey) ? `<p class="sc-desc" style="color:var(--accent)">${this.esc(this.t('parse.warnNoKey'))}</p>` : '';
      box.innerHTML = `
        <h4>${this.esc(this.t('parse.title'))}</h4>
        <p class="sc-desc keep-desc">${this.esc(this.t('parse.desc'))}</p>
        ${warn}
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('parse.engine'))}</div><div class="sr-desc">${this.esc(this.t('parse.engineDesc'))}</div></div>
          <div class="sr-control"><span class="engine-badge${engine === this.t('parse.cloud') ? ' cloud' : ''}">${this.esc(engine)}</span></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('parse.cloudMode'))}</div><div class="sr-desc">${this.esc(this.t('parse.cloudModeDesc'))}</div></div>
          <div class="sr-control"><button class="switch${s.cloudMode ? ' on' : ''}" id="cloudMode" role="switch" aria-checked="${!!s.cloudMode}"></button></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('parse.cloudKey'))}</div><div class="sr-desc">${hasKey ? this.esc(this.t('parse.cloudKeyDesc')) : this.esc(this.t('parse.cloudKeyDesc2'))}</div></div>
          <div class="sr-control" id="keyCtrl">
            ${hasKey
              ? `<span class="key-masked">••••••••</span><button class="text-btn" id="keyEdit">${this.esc(this.t('parse.keyEdit'))}</button><button class="text-btn danger" id="keyClear">${this.esc(this.t('parse.keyClear'))}</button>`
              : `<input class="ctl-input" id="cloudKey" type="password" placeholder="${this.esc(this.t('parse.keyPh'))}" autocomplete="off"><button class="text-btn primary" id="keySave">${this.esc(this.t('parse.keySave'))}</button>`}
          </div>
        </div>`;

      $('#cloudMode').addEventListener('click', () => {
        Store.saveSettings({ cloudMode: !Store.settings.cloudMode });
        this.renderSettingsParse(box);
        this.toast(Store.settings.cloudMode ? this.t('parse.cloudOn') : this.t('parse.cloudOff'));
      });

      if (hasKey) {
        $('#keyEdit').addEventListener('click', () => {
          $('#keyCtrl').innerHTML = `<input class="ctl-input" id="cloudKey" type="password" placeholder="${this.esc(this.t('parse.keyPh2'))}" autocomplete="off"><button class="text-btn primary" id="keySave">${this.esc(this.t('parse.keySave'))}</button>`;
          this.bindKeySave(box);
          $('#cloudKey').focus();
        });
        $('#keyClear').addEventListener('click', () => {
          Store.saveSettings({ cloudKey: '', cloudMode: false });
          this.renderSettingsParse(box);
          this.toast(this.t('parse.keyCleared'));
        });
      } else {
        this.bindKeySave(box);
      }
    },

    bindKeySave(box) {
      const save = () => {
        const v = $('#cloudKey').value.trim();
        if (!v) { this.toast(this.t('parse.keyEmpty')); return; }
        Store.saveSettings({ cloudKey: v });
        this.renderSettingsParse(box);
        this.toast(this.t('parse.keySaved'));
      };
      $('#keySave').addEventListener('click', save);
      $('#cloudKey').addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    },

    renderSettingsData(box) {
      const formats = [
        { key: 'csv', label: this.t('fmt.csv') },
        { key: 'excel', label: this.t('fmt.excel') },
        { key: 'word', label: this.t('fmt.word') },
        { key: 'json', label: this.t('fmt.json') },
        { key: 'ical', label: this.t('fmt.ical') },
        { key: 'pdf', label: this.t('fmt.pdf') }
      ];
      box.innerHTML = `
        <h4>${this.esc(this.t('data.title'))}</h4>
        <p class="sc-desc">${this.esc(this.t('data.desc'))}</p>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('data.export'))}</div><div class="sr-desc">${this.esc(this.t('data.exportDesc'))}</div></div>
          <div class="sr-control">
            <select class="ctl-select" id="exportFmt">
              ${formats.map(f => `<option value="${f.key}">${this.esc(f.label)}</option>`).join('')}
            </select>
            <button class="text-btn primary" id="exportBtn">${this.esc(this.t('data.exportBtn'))}</button>
          </div>
        </div>
        <div class="setting-row" style="margin-top:20px">
          <div><div class="sr-label">${this.esc(this.t('data.clear'))}</div><div class="sr-desc">${this.esc(this.t('data.clearDesc'))}</div></div>
          <div class="sr-control"><button class="text-btn danger" id="clearData">${this.esc(this.t('data.clearBtn'))}</button></div>
        </div>
        <div class="setting-row">
          <div><div class="sr-label">${this.esc(this.t('data.seed'))}</div><div class="sr-desc">${this.esc(this.t('data.seedDesc'))}</div></div>
          <div class="sr-control"><button class="text-btn primary" id="seedData">${this.esc(this.t('data.restore'))}</button></div>
        </div>`;

      $('#exportBtn').addEventListener('click', () => this.exportData($('#exportFmt').value));
      $('#clearData').addEventListener('click', () => {
        if (confirm(this.t('data.confirmClear'))) {
          Store.clearAll();
          this.refreshView();
          this.toast(this.t('data.cleared'));
        }
      });
      $('#seedData').addEventListener('click', () => {
        Store.reseed();
        this.refreshView();
        this.toast(this.t('data.reseeded'));
      });
    },

    /* ---------- 导出 ---------- */
    exportData(fmt) {
      const evs = Store.events;
      if (fmt === 'csv') {
        const rows = [[this.t('csv.id'), this.t('csv.title'), this.t('csv.start'), this.t('csv.end'), this.t('csv.allDay'), this.t('csv.repeat'), this.t('csv.tag')]];
        evs.forEach(ev => rows.push([ev.id, ev.title, ev.start, ev.end, ev.allDay ? this.t('csv.yes') : this.t('csv.no'), ev.repeat, ev.tag]));
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
        this.download('ydschedule.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8');
        this.toast(this.t('data.exported', { fmt: 'CSV' }));
      } else if (fmt === 'json') {
        this.download('ydschedule.json', JSON.stringify(evs, null, 2), 'application/json');
        this.toast(this.t('data.exported', { fmt: 'JSON' }));
      } else if (fmt === 'ical') {
        let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//YDSchedule//CN\r\n';
        evs.forEach(ev => {
          const s = new Date(ev.start), e = new Date(ev.end);
          const dt = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '00';
          ics += 'BEGIN:VEVENT\r\nUID:' + ev.id + '\r\nDTSTART:' + dt(s) + '\r\nDTEND:' + dt(e) + '\r\nSUMMARY:' + ev.title.replace(/\n/g, ' ') + '\r\nEND:VEVENT\r\n';
        });
        ics += 'END:VCALENDAR\r\n';
        this.download('ydschedule.ics', ics, 'text/calendar');
        this.toast(this.t('data.exportIcal'));
      } else {
        this.toast(this.t('data.exportDemo', { fmt: fmt.toUpperCase() }));
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
        this.toast(this.t('toast.wechat', { title, time: DateUtil.fmtTimeHM(time) }));
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
  globalThis.App = App;
})();
