/* Панель заявок — демо-движок.
   Заявки — это входящий ящик: не потерять человека и быстро ответить. Два состояния: «ждёт ответа» и «отвечено»,
   спам уходит в корзину на 30 дней. Всё, что дальше (воронка, оплаты, ученики), — это CRM, здесь его нет.
   Данные выдуманные и живут только в браузере (localStorage).
   Форма демо-сайта кладёт заявку во «входящий ящик» (cfg.inbox), панель забирает её оттуда. */
(() => {
  'use strict';
  const C = window.ZAYAVKI;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим — работаем без сохранения */ } },
    del(k) { try { localStorage.removeItem(k); } catch { } },
  };
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { } },
    del(k) { try { sessionStorage.removeItem(k); } catch { } },
  };
  const AUTH = 'zv-auth-' + C.key;
  const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR, TRASH_DAYS = 30;
  const desk = () => matchMedia('(min-width:960px)').matches;

  /* ---------- время ---------- */
  const pad = n => String(n).padStart(2, '0');
  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; };
  const hm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const dm = t => { const d = new Date(t); return d.getDate() + ' ' + MONTHS[d.getMonth()]; };
  const full = t => { const d = new Date(t); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + hm(t); };
  const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; };
  function when(t) {
    const t0 = dayStart(Date.now());
    if (t >= t0) return 'сегодня, ' + hm(t);
    if (t >= t0 - DAY) return 'вчера, ' + hm(t);
    return dm(t) + ', ' + hm(t);
  }
  function waited(ms) {
    const m = Math.max(0, Math.floor(ms / MIN));
    if (m < 1) return 'только что';
    if (m < 60) return m + ' мин';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' ч' + (m % 60 ? ' ' + (m % 60) + ' мин' : '');
    const d = Math.floor(h / 24);
    return d + ' ' + plural(d, 'день', 'дня', 'дней');
  }
  function daysAgo(t) {
    const d = Math.round((dayStart(Date.now()) - dayStart(t)) / DAY);
    return d <= 0 ? 'сегодня в ' + hm(t) : d === 1 ? 'вчера' : d + ' ' + plural(d, 'день', 'дня', 'дней') + ' назад';
  }
  // срочность: до 15 минут спокойно, дольше — мягкое предупреждение, дольше часа — заметнее
  const urg = l => { if (l.state !== 'wait') return ''; const a = Date.now() - l.at; return a > HOUR ? 'u2' : a > 15 * MIN ? 'u1' : 'u0'; };

  /* ---------- демо-данные ---------- */
  function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function phoneFrom(r) { const n = () => Math.floor(r() * 10); return `+7 (9${n()}${n()}) ${n()}${n()}${n()}-${n()}${n()}-${n()}${n()}`; }
  function pickW(r, list) { const sum = list.reduce((a, x) => a + x.w, 0); let v = r() * sum; for (const x of list) { if ((v -= x.w) < 0) return x; } return list[0]; }
  const digits = p => String(p || '').replace(/\D/g, '').slice(-10);
  function make(r, p, at, extra = {}) {
    const src = pickW(r, C.sources);
    return Object.assign({
      id: 0, at, name: p[0], phone: phoneFrom(r), email: p[1] || '',
      choice: p[2] || C.choices[Math.floor(r() * C.choices.length)],
      extra: C.extras ? C.extras(r, p) : [], message: '',
      source: src.label, utm: src.utm ? { source: src.utm[0], medium: src.utm[1], campaign: src.utm[2] || '' } : null,
      page: C.page, device: r() < .72 ? 'Телефон' : 'Компьютер',
      state: 'done', doneAt: 0, spamAt: 0, note: p[3] || '', read: true,
    }, extra);
  }

  function seed() {
    const r = rng(C.seed || 7);
    const now = Date.now();
    const offs = [4 * MIN, 38 * MIN, 2.6 * HOUR, 5.1 * HOUR, 21 * HOUR, 26 * HOUR, 30 * HOUR];
    for (let d = 2; d <= 13; d++) { const k = 1 + Math.floor(r() * 2); for (let j = 0; j < k; j++) offs.push(d * DAY + (2 + r() * 12) * HOUR); }
    offs.sort((a, b) => a - b);
    const list = offs.slice(0, C.people.length);
    let id = C.firstId || 1001;
    const leads = list.map((off, i) => {
      const l = make(r, C.people[i], now - off);
      if (off < 3 * HOUR) { l.state = 'wait'; l.read = off > 10 * MIN; }
      else l.doneAt = l.at + (6 + r() * 70) * MIN;
      return l;
    });
    // одна повторная заявка: человек писал три дня назад и написал снова
    const old = leads.find(l => now - l.at > 2.5 * DAY && now - l.at < 4.5 * DAY);
    if (old && leads[1]) Object.assign(leads[1], { name: old.name, phone: old.phone, email: old.email, choice: old.choice, note: '' });
    // спам — в корзине
    [[1.2 * DAY, 'test test', '+7 (000) 000-00-00'], [4.4 * DAY, 'qwerty', '+7 (111) 111-11-11']].forEach(([off, name, phone]) => {
      leads.push(make(r, [name, 'asd@asd.asd'], now - off, { phone, source: 'Прямой заход', utm: null, device: 'Компьютер', state: 'spam', spamAt: now - off + 9 * MIN, note: '' }));
    });
    leads.sort((a, b) => a.at - b.at).forEach(l => { l.id = id++; });
    return { v: 2, nextId: id, leads };
  }

  /* ---------- состояние ---------- */
  // демо: при каждом открытии страницы — чистый лист, как в первый раз. Тестовые заявки и отметки живут до обновления.
  // Заявки, оставленные на демо-сайте, лежат во «входящем ящике» и подхватываются поверх свежих данных.
  store.del(C.key);
  let S = seed();
  const save = () => {};
  const ui = { view: 'wait', q: '', sel: null, sheet: false, settings: false, undo: null };
  const baseTitle = document.title;

  function ingest() {
    const inbox = store.get(C.inbox);
    if (!Array.isArray(inbox) || !inbox.length) return [];
    store.del(C.inbox);
    const got = inbox.map(x => {
      const at = Number(x.at) || Date.now();
      const l = {
        id: S.nextId++, at, name: String(x.name || 'Без имени').slice(0, 80), phone: String(x.phone || '').slice(0, 30), email: String(x.email || '').slice(0, 120),
        choice: String(x.choice || C.choices[0]).slice(0, 80),
        extra: Array.isArray(x.extra) ? x.extra.slice(0, 6).map(e => [String(e[0]).slice(0, 40), String(e[1]).slice(0, 120)]) : [],
        message: String(x.message || '').slice(0, 1000),
        source: x.source ? String(x.source).slice(0, 60) : 'Демо-сайт — ваша заявка', utm: null, page: C.page, device: matchMedia('(pointer:coarse)').matches ? 'Телефон' : 'Компьютер',
        state: 'wait', doneAt: 0, spamAt: 0, note: '', read: false, mine: true,
      };
      S.leads.push(l);
      return l;
    });
    save();
    return got;
  }
  function fake() {
    const r = Math.random;
    const l = make(r, C.people[Math.floor(r() * C.people.length)], Date.now(), { state: 'wait', read: false, note: '' });
    l.id = S.nextId++;
    S.leads.push(l); save();
    return l;
  }

  const byId = id => S.leads.find(l => l.id === id);
  const waiting = () => S.leads.filter(l => l.state === 'wait');
  const firstOf = l => { const d = digits(l.phone); if (d.length < 10) return null; return S.leads.filter(x => x !== l && x.state !== 'spam' && x.at < l.at && digits(x.phone) === d).sort((a, b) => a.at - b.at)[0] || null; };
  function counts() { const c = { wait: 0, all: 0, trash: 0 }; S.leads.forEach(l => { if (l.state === 'spam') c.trash++; else { c.all++; if (l.state === 'wait') c.wait++; } }); return c; }
  function visible() {
    const q = ui.q.trim().toLowerCase(), qd = q.replace(/\D/g, '');
    const hit = l => !q || l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || String(l.id).includes(q.replace(/^№\s*/, '')) || (qd.length > 2 && digits(l.phone).includes(qd));
    const byNew = (a, b) => b.at - a.at;
    if (ui.view === 'trash') return S.leads.filter(l => l.state === 'spam' && hit(l)).sort((a, b) => b.spamAt - a.spamAt);
    const w = S.leads.filter(l => l.state === 'wait' && hit(l)).sort(byNew);
    if (ui.view === 'wait') return w;
    return w.concat(S.leads.filter(l => l.state === 'done' && hit(l)).sort(byNew));
  }
  function summary() {
    const now = Date.now(), t0 = dayStart(now);
    const real = S.leads.filter(l => l.state !== 'spam');
    const week = real.filter(l => l.at >= t0 - 6 * DAY);
    const src = {}; week.forEach(l => { if (!l.mine) src[l.source] = (src[l.source] || 0) + 1; });
    const top = Object.entries(src).sort((a, b) => b[1] - a[1])[0];
    const w = waiting().sort((a, b) => a.at - b.at);
    return { today: real.filter(l => l.at >= t0).length, week: week.length, top: top ? top[0] : '', wait: w.length, oldest: w[0] || null };
  }

  /* ---------- иконки ---------- */
  const I = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12m-5-5 5 5 5-5M5 20h14"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
  };
  const root = $('#app');

  /* ---------- вход ---------- */
  function login() {
    document.title = baseTitle;
    document.body.classList.add('is-login');
    root.innerHTML = `
      <main class="login">
        <div class="login__art" aria-hidden="true">
          <div class="login__big">${esc(C.loginWord || 'Заявки')}</div>
          <div class="login__run"><span>${esc(C.marquee)}</span><span>${esc(C.marquee)}</span></div>
        </div>
        <form class="login__card" id="login">
          <div class="brand">${C.logo}<span class="brand__sub">${esc(C.product)}</span></div>
          <h1 class="login__h">Вход для&nbsp;менеджера</h1>
          <label class="fld"><span>Логин</span><input name="u" value="demo" autocomplete="username"></label>
          <label class="fld"><span>Пароль</span><input name="p" type="password" value="demo-demo" autocomplete="current-password"></label>
          <button class="btn btn--acc btn--wide" type="submit">Войти в демо <i>${I.out}</i></button>
          <p class="login__note">Демо-версия: данные выдуманные, после обновления страницы всё начинается заново. В настоящей панели — вход по паролю, письмо о каждой новой заявке, данные хранятся по закону.</p>
        </form>
      </main>`;
    $('#login').addEventListener('submit', e => { e.preventDefault(); ss.set(AUTH, '1'); document.body.classList.remove('is-login'); app(true); });
  }

  /* ---------- каркас ---------- */
  function app(first) {
    ingest();
    root.innerHTML = `
      <div class="shell">
        <header class="top">
          <div class="brand">${C.logo}<span class="brand__sub">${esc(C.product)}</span></div>
          <div class="top__live"><i class="pulse" aria-hidden="true"></i><span>Онлайн · данные хранятся по закону</span></div>
          <div class="top__act">
            <a class="btn btn--ghost" href="${esc(C.site)}" target="_blank" rel="noopener">Оставить заявку на сайте <i>${I.out}</i></a>
            <button class="btn btn--ghost" data-act="fake" title="Создать тестовую заявку"><i>${I.plus}</i><span>Тестовая</span></button>
            <button class="btn btn--icon" data-act="csv" title="Скачать CSV" aria-label="Скачать CSV">${I.down}</button>
            <button class="btn btn--icon" data-act="settings" title="Настройки" aria-label="Настройки">${I.gear}</button>
          </div>
        </header>
        <section class="sum" id="sum" aria-live="polite"></section>
        <section class="work">
          <div class="list">
            <div class="list__head">
              <div class="views">
                <div class="seg2" role="tablist" id="views"></div>
                <button class="trash-btn" data-view="trash" id="trashBtn" title="Корзина: спам хранится 30 дней"></button>
              </div>
              <label class="search">${I.search}<input id="q" type="search" placeholder="Имя, телефон или №" autocomplete="off"><kbd>/</kbd></label>
            </div>
            <ul class="rows" id="rows"></ul>
          </div>
          <aside class="detail" id="detailBox"><div class="detail__in" id="detail" aria-live="polite"></div></aside>
        </section>
        <footer class="foot"><span>Демо-проект Станислава Максимова · данные выдуманные · <a href="${esc(C.home)}">← вернуться в портфолио</a></span><span class="foot__keys">↑ ↓ — по списку · O — отвечено · / — поиск</span></footer>
      </div>
      <div class="toast" id="toast" role="status"></div>
      <div class="drawer" id="drawer" hidden></div>`;
    bind();
    if (!ui.sel && desk()) { const v = visible(); if (v[0]) ui.sel = v[0].id; }
    renderAll(first);
  }

  function renderAll(anim) { renderSum(anim); renderViews(); renderRows(anim); renderDetail(); title(); }
  function title() { const n = counts().wait; document.title = (n ? `(${n}) ` : '') + baseTitle; }

  function renderSum(anim) {
    const s = summary();
    const o = s.oldest, u = o ? urg(o) : '';
    $('#sum').innerHTML = `
      <div class="sum__main ${s.wait ? 'is-wait' : 'is-calm'}">
        <b class="sum__n${anim ? ' is-anim' : ''}">${s.wait}</b>
        <div class="sum__txt">
          <span class="sum__l">${s.wait ? plural(s.wait, 'заявка ждёт', 'заявки ждут', 'заявок ждут') + ' ответа' : 'Все ответили'}</span>
          <span class="sum__old ${u}">${o ? 'самая старая ждёт ' + waited(Date.now() - o.at) : 'новых заявок нет — можно выдохнуть'}</span>
        </div>
      </div>
      <p class="sum__line"><span>Сегодня <b>${s.today}</b></span><span>За неделю <b>${s.week}</b></span>${s.top ? `<span>Чаще всего — <b>${esc(s.top)}</b></span>` : ''}</p>`;
  }

  function renderViews() {
    const c = counts();
    $('#views').innerHTML = [['wait', 'Ждут ответа', c.wait], ['all', 'Все', c.all]].map(([k, l, n]) =>
      `<button role="tab" aria-selected="${ui.view === k}" data-view="${k}">${l}<sup>${n}</sup></button>`).join('');
    const t = $('#trashBtn');
    t.innerHTML = `${I.trash}<span>${c.trash}</span>`;
    t.classList.toggle('is-on', ui.view === 'trash');
    t.setAttribute('aria-pressed', ui.view === 'trash');
  }

  function row(l, i, anim) {
    const u = urg(l), rep = l.state !== 'spam' && firstOf(l);
    const side = l.state === 'wait' ? `<span class="age ${u}">${waited(Date.now() - l.at)}</span>`
      : l.state === 'spam' ? `<time>${when(l.spamAt)}</time>` : `<time>${when(l.at)}</time>`;
    return `<li class="ri${l.state === 'wait' ? ' can-swipe' : ''}" data-id="${l.id}">
      <span class="ri__bg" aria-hidden="true">${I.check}Отвечено</span>
      <button class="row is-${l.state}${l.id === ui.sel ? ' is-sel' : ''}${l.read ? '' : ' is-unread'}${l.mine ? ' is-mine' : ''}${anim ? ' is-anim' : ''}" data-id="${l.id}" style="--d:${Math.min(i, 12) * 35}ms">
        <span class="row__dot ${u}" aria-label="${l.state === 'wait' ? 'Ждёт ответа' : l.state === 'done' ? 'Отвечено' : 'Спам'}">${l.state === 'done' ? I.check : ''}</span>
        <span class="row__main"><b>${esc(l.name)}${rep ? `<em class="tag-rep">повторно</em>` : ''}</b><span class="row__meta">${esc(l.choice)} · ${esc(l.source)}</span></span>
        <span class="row__side">${side}<span class="row__id">№ ${l.id}</span></span>
      </button></li>`;
  }
  function renderRows(anim) {
    const v = visible();
    const el = $('#rows');
    if (!v.length) {
      const q = ui.q.trim();
      const [h, t] = q ? ['Ничего не нашлось', 'Проверьте имя или номер телефона']
        : ui.view === 'wait' ? ['Все ответили', 'Новых заявок нет. Как только кто-то оставит заявку на сайте — она появится здесь']
          : ui.view === 'trash' ? ['Корзина пуста', 'Сюда попадает спам. Через 30 дней он удаляется сам'] : ['Заявок пока нет', 'Они появятся, когда люди начнут оставлять заявки на сайте'];
      el.innerHTML = `<li class="empty"><span class="empty__glyph" aria-hidden="true">${ui.view === 'wait' && !q ? I.check : C.glyph}</span><b>${h}</b><span>${t}</span></li>`;
      return;
    }
    const t0 = dayStart(Date.now());
    let last = '', html = '';
    v.forEach((l, i) => {
      const g = ui.view === 'trash' ? 'Корзина · удаляется через 30 дней'
        : l.state === 'wait' ? 'Ждут ответа'
          : 'Отвечено · ' + (l.at >= t0 ? 'сегодня' : l.at >= t0 - DAY ? 'вчера' : dm(l.at));
      if (g !== last) { html += `<li class="grp">${g}</li>`; last = g; }
      html += row(l, i, anim);
    });
    el.innerHTML = html;
  }

  function renderDetail() {
    const box = $('#detail');
    const l = ui.sel && byId(ui.sel);
    document.body.classList.toggle('has-sheet', !!(l && ui.sheet));
    if (!l || (ui.view !== 'trash' && l.state === 'spam')) {
      box.innerHTML = `<div class="detail__empty"><div class="detail__glyph" aria-hidden="true">${C.glyph}</div><b>Выберите заявку</b><span>Слева — заявки с сайта. Те, что ждут ответа, всегда сверху. Ответить лучше в первые 15 минут.</span></div>`;
      return;
    }
    const u = urg(l), rep = l.state !== 'spam' && firstOf(l);
    const tel = l.phone.replace(/[^\d+]/g, '');
    const info = [[C.choiceLabel, l.choice], ...l.extra];
    const more = [...(l.utm ? [['utm_source', l.utm.source], ['utm_medium', l.utm.medium], ['utm_campaign', l.utm.campaign]] : []), ['Страница', l.page], ['Устройство', l.device]].filter(x => x[1]);
    const left = l.state === 'spam' ? Math.max(1, TRASH_DAYS - Math.floor((Date.now() - l.spamAt) / DAY)) : 0;
    const status = l.state === 'wait' ? `<p class="d__st ${u}"><i></i>Ждёт ответа <b>${waited(Date.now() - l.at)}</b></p>`
      : l.state === 'done' ? `<p class="d__st is-done">${I.check}Отвечено${l.doneAt ? ' · ' + when(l.doneAt) : ''}</p>`
        : `<p class="d__st is-spam">${I.trash}В корзине · удалится через ${left} ${plural(left, 'день', 'дня', 'дней')}</p>`;
    const act = l.state === 'wait' ? `<button class="btn btn--acc btn--main" data-act="done">${I.check}<span>Отметить как отвечено</span><kbd>O</kbd></button><button class="btn btn--ghost" data-act="spam">Это спам</button>`
      : l.state === 'done' ? `<button class="btn btn--ghost btn--main" data-act="wait">${I.undo}<span>Вернуть в «ждут ответа»</span></button><button class="btn btn--ghost" data-act="spam">Это спам</button>`
        : `<button class="btn btn--acc btn--main" data-act="restore">${I.undo}<span>Вернуть из корзины</span></button>`;
    box.innerHTML = `
      <div class="d">
        <div class="d__bar"><button class="btn btn--icon d__back" data-act="back" aria-label="Назад к списку">${I.back}</button><span class="d__id">Заявка № ${l.id}</span><time>${full(l.at)}</time></div>
        <div class="d__head">
          ${status}
          <h2 class="d__name">${esc(l.name)}</h2>
          ${rep ? `<p class="d__rep">${I.repeat}Повторно — первая была ${daysAgo(rep.at)} (№ ${rep.id})</p>` : ''}
          ${l.mine ? '<p class="d__mine">Это ваша заявка с демо-сайта — так её увидит менеджер школы.</p>' : ''}
        </div>
        <div class="d__contacts">
          <a class="chip chip--big" href="tel:${esc(tel)}">${I.phone}<span>${esc(l.phone)}</span></a>
          <button class="chip chip--sq" data-copy="${esc(l.phone)}" aria-label="Скопировать телефон" title="Скопировать">${I.copy}</button>
          ${l.email ? `<a class="chip" href="mailto:${esc(l.email)}">${I.mail}<span>${esc(l.email)}</span></a>` : ''}
        </div>
        <div class="d__act">${act}</div>
        <dl class="grid">${info.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${l.message ? `<blockquote class="d__msg">${esc(l.message)}</blockquote>` : ''}
        <div class="src">
          <span class="src__l">Откуда</span><b>${esc(l.source)}</b>
          <details class="src__more"><summary>Подробнее</summary><dl>${more.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></details>
        </div>
        <label class="note"><span>Заметка</span><textarea id="note" rows="2" placeholder="${esc(C.notePh || 'Например: перезвонить после 18:00')}">${esc(l.note)}</textarea><em id="noteSaved" aria-live="polite"></em></label>
        <p class="consent">${I.shield}Согласие на обработку данных получено ${full(l.at)} · политика v${C.policy || '2'}</p>
      </div>`;
  }

  /* ---------- действия ---------- */
  function select(id, open = !desk()) {
    ui.sel = id; const l = byId(id);
    if (l && !l.read) { l.read = true; save(); }
    ui.sheet = open;
    renderRows(); renderDetail();
    const d = $('#detail'); d.scrollTop = 0; d.style.setProperty('--p', 0);
    const b = document.querySelector(`.row[data-id="${id}"]`); if (b && desk()) b.scrollIntoView({ block: 'nearest' });
  }
  function setState(id, st, how) {
    const l = byId(id); if (!l || l.state === st) return;
    const prev = { id, state: l.state, doneAt: l.doneAt, spamAt: l.spamAt, view: ui.view };
    const v = visible(), idx = v.findIndex(x => x.id === id);
    l.state = st; l.read = true;
    if (st === 'done') l.doneAt = Date.now();
    if (st === 'spam') l.spamAt = Date.now();
    if (st === 'wait') l.doneAt = 0;
    save();
    // после ответа — сразу следующая ждущая заявка, чтобы разобрать ящик без лишних кликов
    if ((st === 'done' && ui.view === 'wait') || st === 'spam' || (prev.state === 'spam' && ui.view === 'trash')) {
      const rest = visible();
      const next = rest[Math.min(idx, rest.length - 1)];
      ui.sel = desk() && next ? next.id : (desk() ? null : ui.sel);
      if (!desk()) ui.sheet = false;
    }
    renderSum(); renderViews(); renderRows(); renderDetail(); title();
    const msg = { done: `№ ${id} — отвечено`, spam: `№ ${id} — в корзине`, wait: `№ ${id} снова ждёт ответа` }[st] || '';
    if (prev.state === 'spam' && st === 'wait') { toast(`№ ${id} возвращена из корзины`); return; }
    ui.undo = prev;
    toast(msg, { undo: true, how });
  }
  function undo() {
    const p = ui.undo; if (!p) return;
    const l = byId(p.id); if (!l) return;
    Object.assign(l, { state: p.state, doneAt: p.doneAt, spamAt: p.spamAt }); save();
    ui.undo = null; ui.sel = p.id; ui.view = p.view;
    renderSum(); renderViews(); renderRows(); renderDetail(); title(); flash(p.id);
    toast('Отменено');
  }
  let noteT;
  function note(v) {
    const l = byId(ui.sel); if (!l) return;
    clearTimeout(noteT);
    noteT = setTimeout(() => {
      l.note = v; save();
      const s = $('#noteSaved'); if (s) { s.textContent = 'Сохранено'; setTimeout(() => { if (s.isConnected) s.textContent = ''; }, 1400); }
    }, 450);
  }
  function csv() {
    const head = ['№', 'Дата', 'Состояние', 'Имя', 'Телефон', 'Почта', C.choiceLabel, 'Источник', 'utm_source', 'utm_medium', 'utm_campaign', 'Заметка'];
    const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const st = { wait: 'Ждёт ответа', done: 'Отвечено', spam: 'Спам' };
    const lines = [head.map(q).join(';')].concat(visible().map(l => [l.id, full(l.at), st[l.state], l.name, l.phone, l.email, l.choice, l.source, l.utm?.source, l.utm?.medium, l.utm?.campaign, l.note].map(q).join(';')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `zayavki-${C.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('CSV скачан — открывается в Excel и Google Таблицах');
  }
  let toastT;
  function toast(msg, o = {}) {
    const t = $('#toast'); if (!t) return;
    const btn = o.undo ? `<button data-act="undo">${I.undo}Отменить</button>` : o.open ? `<button data-open="${o.open}">Открыть</button>` : '';
    t.innerHTML = `<span>${esc(msg)}</span>${btn}${o.undo ? '<i class="toast__bar" aria-hidden="true"></i>' : ''}`;
    t.classList.remove('is-on'); void t.offsetWidth; t.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => { t.classList.remove('is-on'); if (o.undo) ui.undo = null; }, o.undo || o.open ? 5000 : 2400);
  }
  function arrived(list) {
    if (!list.length) return;
    ui.view = 'wait'; ui.q = ''; const q = $('#q'); if (q) q.value = '';
    if (desk() && !ui.sel) ui.sel = list[0].id;
    renderAll(); list.forEach(l => flash(l.id));
    toast(list.length > 1 ? `${list.length} ${plural(list.length, 'новая заявка', 'новые заявки', 'новых заявок')}` : `Новая заявка: ${list[0].name}`, { open: list[list.length - 1].id });
  }
  function flash(id) { const b = document.querySelector(`.row[data-id="${id}"]`); if (b) { b.classList.remove('is-anim'); b.classList.add('is-new'); setTimeout(() => b.classList.remove('is-new'), 2400); } }

  function settings(open) {
    const d = $('#drawer');
    ui.settings = open; d.hidden = !open;
    if (!open) return;
    d.innerHTML = `
      <div class="drawer__bg" data-act="close"></div>
      <div class="drawer__card" role="dialog" aria-modal="true" aria-label="Настройки">
        <div class="drawer__h"><b>Настройки</b><button class="btn btn--icon" data-act="close" aria-label="Закрыть">✕</button></div>
        <dl class="set">
          <div><dt>Хранение</dt><dd>Заявки хранятся в России, как требует закон о персональных данных. В зарубежные сервисы ничего не уходит.</dd></div>
          <div><dt>Письма</dt><dd>О каждой новой заявке — на ${esc(C.mail)}.</dd></div>
          <div><dt>Защита от спама</dt><dd>Скрытая ловушка для ботов и не больше 5 заявок за 10 минут с одного адреса. Остальное — кнопкой «Это спам», корзина чистится через 30 дней.</dd></div>
          <div><dt>Доступ</dt><dd>Вход по паролю, только для сотрудников школы.</dd></div>
          <div><dt>Выгрузка</dt><dd>CSV для Excel и Google Таблиц.</dd></div>
          <div><dt>Что дальше</dt><dd>Заявки — чтобы не терять людей с сайта. Вести учеников дальше — оплаты, расписание, абонементы — это уже CRM.</dd></div>
        </dl>
        <button class="btn btn--ghost btn--wide" data-act="reset">Сбросить демо-данные</button>
        <button class="btn btn--ghost btn--wide" data-act="logout">Выйти</button>
      </div>`;
    d.querySelector('.drawer__card .btn').focus();
  }

  /* Свой ползунок прокрутки: одинаковый во всех браузерах, в стиле бренда. */
  function scrollbar(sc, host) {
    const bar = document.createElement('div');
    bar.className = 'sb'; bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<i class="sb__thumb"><b class="sb__pct"></b></i>';
    host.appendChild(bar);
    const th = bar.firstChild, pct = th.firstChild;
    let idle, thumbH = 0, drag = null;
    function update() {
      const h = sc.clientHeight, H = sc.scrollHeight, max = H - h;
      bar.style.top = sc.offsetTop + 'px'; bar.style.height = h + 'px';
      bar.classList.toggle('is-off', max <= 1 || getComputedStyle(sc).overflowY === 'visible');
      if (max <= 1) return;
      const track = h - 16;
      thumbH = Math.max(44, track * h / H);
      const p = sc.scrollTop / max;
      th.style.height = thumbH + 'px';
      th.style.transform = `translate3d(0,${8 + p * (track - thumbH)}px,0)`;
      pct.textContent = Math.round(p * 100) + '%';
    }
    function wake() { bar.classList.add('is-active'); clearTimeout(idle); idle = setTimeout(() => { if (!drag) bar.classList.remove('is-active'); }, 1100); }
    sc.addEventListener('scroll', () => { update(); wake(); }, { passive: true });
    new ResizeObserver(update).observe(sc);
    new MutationObserver(() => requestAnimationFrame(update)).observe(sc, { childList: true, subtree: true });
    th.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); drag = { y: e.clientY, top: sc.scrollTop }; th.setPointerCapture(e.pointerId); bar.classList.add('is-drag', 'is-active'); });
    th.addEventListener('pointermove', e => { if (!drag) return; const k = (sc.scrollHeight - sc.clientHeight) / Math.max(1, sc.clientHeight - 16 - thumbH); sc.scrollTop = drag.top + (e.clientY - drag.y) * k; });
    const end = () => { if (!drag) return; drag = null; bar.classList.remove('is-drag'); wake(); };
    th.addEventListener('pointerup', end); th.addEventListener('pointercancel', end);
    bar.addEventListener('pointerdown', e => { if (e.target !== bar) return; const r = th.getBoundingClientRect(); sc.scrollBy({ top: (e.clientY < r.top ? -1 : 1) * sc.clientHeight * .85, behavior: 'smooth' }); });
    update();
  }

  /* Свайп влево по заявке на телефоне = «Отвечено» */
  function swipe(list) {
    let s = null, swiped = false;
    list.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      const li = e.target.closest('.ri.can-swipe'); if (!li) return;
      s = { li, row: li.querySelector('.row'), x: e.clientX, y: e.clientY, dx: 0, on: false, id: +li.dataset.id };
    });
    list.addEventListener('pointermove', e => {
      if (!s) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (!s.on) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { s = null; return; } if (dx < -12) { s.on = true; s.li.classList.add('is-swiping'); } else return; }
      s.dx = Math.min(0, dx);
      s.row.style.transform = `translate3d(${s.dx}px,0,0)`;
      s.li.classList.toggle('is-ready', s.dx < -90);
    });
    const end = () => {
      if (!s) return;
      const { li, row, dx, on, id } = s; s = null;
      if (!on) return;
      swiped = true; setTimeout(() => { swiped = false; }, 50);
      if (dx < -90) { row.style.transition = 'transform .25s'; row.style.transform = 'translate3d(-100%,0,0)'; setTimeout(() => setState(id, 'done', 'swipe'), 200); }
      else { row.style.transition = 'transform .3s'; row.style.transform = ''; li.classList.remove('is-swiping', 'is-ready'); setTimeout(() => { row.style.transition = ''; }, 300); }
    };
    list.addEventListener('pointerup', end); list.addEventListener('pointercancel', end);
    list.addEventListener('click', e => { if (swiped) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

  function bind() {
    root.addEventListener('click', e => {
      const t = e.target.closest('button,a'); if (!t) return;
      if (t.dataset.view) { ui.view = t.dataset.view; renderViews(); renderRows(true); if (desk()) { const v = visible(); ui.sel = v[0] ? v[0].id : null; renderRows(); } renderDetail(); return; }
      if (t.dataset.id) { select(+t.dataset.id); return; }
      if (t.dataset.open) { const id = +t.dataset.open; const l = byId(id); if (l) { ui.view = l.state === 'spam' ? 'trash' : l.state === 'wait' ? 'wait' : 'all'; renderViews(); select(id, !desk()); } $('#toast').classList.remove('is-on'); return; }
      if (t.dataset.copy != null) { navigator.clipboard?.writeText(t.dataset.copy).then(() => toast('Телефон скопирован'), () => toast(t.dataset.copy)); return; }
      const a = t.dataset.act;
      if (a === 'done' || a === 'spam' || a === 'wait') setState(ui.sel, a);
      else if (a === 'restore') setState(ui.sel, 'wait');
      else if (a === 'undo') undo();
      else if (a === 'fake') arrived([fake()]);
      else if (a === 'csv') csv();
      else if (a === 'settings') settings(true);
      else if (a === 'close') settings(false);
      else if (a === 'back') { ui.sheet = false; renderDetail(); }
      else if (a === 'reset') { S = seed(); ui.sel = null; ui.view = 'wait'; settings(false); app(true); toast('Демо-данные сброшены'); }
      else if (a === 'logout') { ss.del(AUTH); settings(false); login(); }
    });
    $('#q').addEventListener('input', e => { ui.q = e.target.value; renderRows(); });
    root.addEventListener('input', e => { if (e.target.id === 'note') note(e.target.value); });
    const det = $('#detail');
    det.addEventListener('scroll', () => { const m = det.scrollHeight - det.clientHeight; det.style.setProperty('--p', m > 0 ? (det.scrollTop / m).toFixed(3) : 0); }, { passive: true });
    scrollbar($('#rows'), $('.list'));
    scrollbar(det, $('#detailBox'));
    swipe($('#rows'));
  }

  /* горячие клавиши */
  document.addEventListener('keydown', e => {
    if (!$('#rows')) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (e.key === 'Escape') {
      if (ui.settings) settings(false);
      else if (typing) document.activeElement.blur();
      else if (ui.sheet) { ui.sheet = false; renderDetail(); }
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || ui.settings) return;
    if (e.key === '/') { e.preventDefault(); $('#q').focus(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const v = visible(); if (!v.length) return;
      e.preventDefault();
      const i = v.findIndex(l => l.id === ui.sel);
      const n = i < 0 ? 0 : Math.max(0, Math.min(v.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      select(v[n].id, false); return;
    }
    if (e.key === 'Enter' && ui.sel && !/^(BUTTON|A)$/.test(document.activeElement?.tagName || '')) { e.preventDefault(); select(ui.sel, !desk()); const b = $('.btn--main'); if (b && desk()) b.focus(); return; }
    if (e.code === 'KeyO' && ui.sel) { const l = byId(ui.sel); if (l && l.state === 'wait') { e.preventDefault(); setState(l.id, 'done', 'key'); } }
  });
  // заявка с демо-сайта в соседней вкладке
  addEventListener('storage', e => { if (e.key === C.inbox && e.newValue && $('#rows')) arrived(ingest()); });
  addEventListener('focus', () => { if ($('#rows')) arrived(ingest()); });
  // время ожидания и срочность обновляются сами
  setInterval(() => { if ($('#rows') && !document.hidden) { renderSum(); renderRows(); const st = $('.d__st b'); const l = byId(ui.sel); if (st && l && l.state === 'wait') st.textContent = waited(Date.now() - l.at); } }, 30e3);

  if (ss.get(AUTH) === '1') app(true); else login();
})();
