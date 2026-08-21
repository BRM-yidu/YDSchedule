/* ============================================================
   parser.js · 本地时间解析引擎（离线，体积小，响应快）
   识别：明早6点 / 下周一三点 / 每隔三天一次 / 一小时后 / 明天八点（歧义）
   返回：{ date, hour, minute, title, repeat, repeatInterval, ambiguous, options }
   ============================================================ */
(function (global) {
  'use strict';

  const CN_NUM = {
    '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6,
    '七': 7, '八': 8, '九': 9, '十': 10,
    '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15, '十六': 16,
    '十七': 17, '十八': 18, '十九': 19, '二十': 20, '二十一': 21, '二十二': 22,
    '二十三': 23, '二十四': 24
  };

  const CN_WEEK = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };

  function cnNum(str) {
    if (CN_NUM[str] != null) return CN_NUM[str];
    const n = parseInt(str, 10);
    return isNaN(n) ? 1 : n;
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

  /* 下一个目标星期几；nextWeek=1 表示严格下周（本周的 target 日 +7） */
  function nextWeekday(target, nextWeek) {
    const today = startOfDay(new Date());
    if (nextWeek === 1) {
      const thisTarget = addDays(today, -((today.getDay() - target + 7) % 7));
      return addDays(thisTarget, 7);
    }
    const diff = (target - today.getDay() + 7) % 7;
    return addDays(today, diff === 0 ? 7 : diff);
  }

  function thisWeekday(target) {
    const today = startOfDay(new Date());
    return addDays(today, target - today.getDay());
  }

  /**
   * 解析自然语言日程
   * @param {string} text 例如 "明早6点跑步"
   * @returns {object|null} { date, hour, minute, title, repeat, repeatInterval, ambiguous, options }
   */
  function parse(text) {
    if (!text || !text.trim()) return null;
    let s = text.trim();

    let date = null;
    let hour = null;
    let minute = 0;
    let repeat = 'none';
    let repeatInterval = 1;
    let ambiguous = false;
    let options = [];
    let resolved = false; // 相对时间已确定具体时刻，不再歧义

    /* 1. 重复：每隔 N 天/小时/周 */
    let m = s.match(/每隔\s*([一二两三四五六七八九十百\d]+)\s*(天|日|小时|周)/);
    if (m) {
      repeat = m[2] === '周' ? 'weekly' : 'interval';
      repeatInterval = cnNum(m[1]);
      s = s.replace(m[0], '');
      s = s.replace(/一次/, '');
      if (!date) date = startOfDay(new Date());
    }

    /* 2. 重复：每天 / 工作日 */
    if (/每天|每日|天天/.test(s)) {
      repeat = 'daily';
      s = s.replace(/每天|每日|天天/, '');
      if (!date) date = startOfDay(new Date());
    }
    if (/工作日/.test(s)) {
      repeat = 'weekday';
      s = s.replace(/工作日/, '');
      if (!date) date = startOfDay(new Date());
    }

    /* 3. 重复：每周X / 每星期X */
    m = s.match(/每(?:周|星期)([一二三四五六日天])/);
    if (m) {
      repeat = 'weekly';
      s = s.replace(m[0], '');
      date = nextWeekday(CN_WEEK[m[1]], 0);
    }

    /* 4. 相对时间：一小时后 / 半小时后 / 十分钟后 / 两天后 / 一周后 */
    m = s.match(/([一二两三四五六七八九十半\d]+)\s*个?\s*(小时|分钟|天|日|周)\s*(后|之后|以后)?/);
    if (m) {
      const n = m[1] === '半' ? 0.5 : cnNum(m[1]);
      const unit = m[2];
      const now = new Date();
      if (unit === '小时') {
        const t = new Date(now.getTime() + n * 3600000);
        date = startOfDay(t);
        hour = t.getHours();
        minute = t.getMinutes();
        resolved = true;
      } else if (unit === '分钟') {
        const t = new Date(now.getTime() + n * 60000);
        date = startOfDay(t);
        hour = t.getHours();
        minute = t.getMinutes();
        resolved = true;
      } else if (unit === '周') {
        date = addDays(startOfDay(now), Math.round(n) * 7);
      } else {
        date = addDays(startOfDay(now), Math.round(n));
      }
      s = s.replace(m[0], '');
    }

    /* 5. 时段限定词 */
    let qualifier = '';
    m = s.match(/(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里|半夜)/);
    if (m) {
      qualifier = m[1];
      s = s.replace(m[0], '');
    }

    /* 6. 日期词 */
    m = s.match(/(大后天|后天|明天|明日|明早|明晨|明晚|今晚|今天|今日|下周一|下周二|下周三|下周四|下周五|下周六|下周日|下星期天|这周一|这周二|这周三|这周四|这周五|这周六|这周日|本周一|本周二|本周三|本周四|本周五|本周六|本周日|周一|周二|周三|周四|周五|周六|周日|星期天|星期一|星期二|星期三|星期四|星期五|星期六|星期日)/);
    if (m) {
      const w = m[0];
      if (w === '大后天') date = addDays(new Date(), 3);
      else if (w === '后天') date = addDays(new Date(), 2);
      else if (w === '明天' || w === '明日' || w === '明早' || w === '明晨' || w === '明晚') date = addDays(new Date(), 1);
      else if (w === '今晚') date = new Date();
      else if (w === '今天' || w === '今日') date = new Date();
      else if (/^下周/.test(w)) date = nextWeekday(CN_WEEK[w.slice(2)], 1);
      else if (/^(这周|本周)/.test(w)) date = thisWeekday(CN_WEEK[w.slice(2)]);
      else if (/^星期/.test(w)) date = nextWeekday(CN_WEEK[w.slice(2)], 0);
      else if (/^周/.test(w)) date = nextWeekday(CN_WEEK[w.slice(1)], 0);
      if (w === '明早' || w === '明晨') qualifier = qualifier || '早上';
      if (w === '明晚' || w === '今晚') qualifier = qualifier || '晚上';
      s = s.replace(m[0], '');
    }

    /* 7. 时间数字：X点 / X点半 / X点Y分 */
    m = s.match(/([一二两三四五六七八九十\d]{1,3})\s*点\s*(半|([一二两三四五六七八九十\d]{1,2})\s*分?)?/);
    if (m) {
      let h = cnNum(m[1]);
      if (m[2] === '半') minute = 30;
      else if (m[3]) minute = cnNum(m[3]);

      if (qualifier === '中午') h = 12;
      else if ((qualifier === '下午' || qualifier === '傍晚' || qualifier === '晚上' || qualifier === '夜里' || qualifier === '半夜') && h <= 12) h += 12;
      else if (qualifier === '凌晨' || qualifier === '早上' || qualifier === '早晨' || qualifier === '上午') { /* 保持原样 */ }
      else if (!qualifier && !resolved) {
        /* 无时段限定：1-12 点早上/晚上不确定 → 交给用户选择 */
        if (h >= 1 && h <= 12) {
          ambiguous = true;
          options = [
            { label: '早上 ' + h + ' 点', hour: h },
            { label: '晚上 ' + h + ' 点', hour: h + 12 }
          ];
        }
      }
      hour = h;
      s = s.replace(m[0], '');
    }

    if (!date) date = new Date();
    if (hour === null) hour = 9;

    const title = s.replace(/[，,。.！!？?、\s]+/g, ' ').trim() || '日程';

    return {
      date: startOfDay(date),
      hour: Math.min(23, Math.max(0, hour)),
      minute,
      title,
      repeat,
      repeatInterval,
      ambiguous,
      options
    };
  }

  global.Parser = { parse };
})(window);
