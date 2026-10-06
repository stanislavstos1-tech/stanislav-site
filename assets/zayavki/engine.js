/* Панель заявок — демо-движок.
   Данные выдуманные и живут только в браузере (localStorage).
   Форма демо-сайта кладёт заявку в "входящий ящик" (cfg.inbox), панель забирает её оттуда. */
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
  };

  const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const STATUS = [
    ['new', 'Новые'], ['work', 'В работе'], ['done', 'Обработаны'], ['spam', 'Спам'],
  ];
  const ST = Object.fromEntries(STATUS);

  /* ---------- даты ---------- */
  const pad = n => String(n).padStart(2, '0');
  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; };
  const hm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const dm = t => { const d = new Date(t); return d.getDate() + ' ' + MONTHS[d.getMonth()]; };
  const full = t => { const d = new Date(t); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + hm(t); };
  function ago(t) {
    const s = Date.now() - t;
    if (s < MIN) return 'только что';
    if (s < HOUR) return Math.floor(s / MIN) + ' мин назад';
    if (t >= dayStart(Date.now())) return 'сегодня, ' + hm(t);
    if (t >= dayStart(Date.now()) - DAY) return 'вчера, ' + hm(t);
    return dm(t) + ', ' + hm(t);
  }
  const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; };
  const dur = ms => { const m = Math.max(1, Math.round(ms / MIN)); return m < 60 ? m + ' мин' : Math.floor(m / 60) + ' ч ' + pad(m % 60) + ' мин'; };

  /* ---------- демо-данные ---------- */
  function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function phoneFrom(r) { const n = () => Math.floor(r() * 10); return `+7 (9${n()}${n()}) ${n()}${n()}${n()}-${n()}${n()}-${n()}${n()}`; }
  function pickW(r, list) { const sum = list.reduce((a, x) => a + x.w, 0); let v = r() * sum; for (const x of list) { if ((v -= x.w) < 0) return x; } return list[0]; }

  function seed() {
    const r = rng(C.seed || 7);
    const now = Date.now();
    const leads = [];
    const offsets = [4 * MIN, 38 * MIN, 2.6 * HOUR, 5.1 * HOUR, 21 * HOUR, 26 * HOUR, 30 * HOUR];
    for (let d = 2; d <= 13; d++) { const k = 1 + Math.floor(r() * 3); for (let j = 0; j < k; j++) offsets.push(d * DAY + (2 + r() * 12) * HOUR); }
    offsets.sort((a, b) => b - a);
    let id = C.firstId || 1001;
    offsets.forEach((off, i) => {
      const p = C.people[i % C.people.length];
      const at = now - off;
      const src = pickW(r, C.sources);
      const lead = {
        id: id++, at, name: p[0], phone: phoneFrom(r), email: p[1] || '',
        choice: p[2] || C.choices[Math.floor(r() * C.choices.length)],
        extra: C.extras ? C.extras(r, p) : [],
        source: src.label, utm: src.utm ? { source: src.utm[0], medium: src.utm[1], campaign: src.utm[2] || '' } : null,
        page: C.page, device: r() < .72 ? 'Телефон' : 'Компьютер',
        status: 'done', note: p[3] || '', read: true, log: [],
      };
      lead.log.push({ at, t: 'Заявка с сайта' });
      if (off < 40 * MIN) { lead.status = 'new'; lead.read = off > 10 * MIN; }
      else if (off < 6 * HOUR) { lead.status = i % 2 ? 'new' : 'work'; }
      else if (off < 3 * DAY) lead.status = r() < .55 ? 'work' : 'done';
      if (lead.status !== 'new') {
        const resp = (6 + r() * 70) * MIN;
        lead.log.push({ at: at + resp, t: 'Статус → В работе' });
        if (lead.status === 'done') lead.log.push({ at: at + resp + (2 + r() * 20) * HOUR, t: 'Статус → Обработана' });
        if (lead.note) lead.log.push({ at: at + resp + 3 * MIN, t: 'Комментарий' });
      }
      leads.push(lead);
    });
    // две спам-заявки — показать, что фильтр работает
    [[9.2 * DAY, 'test test', '+7 (000) 000-00-00'], [4.4 * DAY, 'qwerty', '+7 (111) 111-11-11']].forEach(([off, name, phone]) => {
      leads.push({ id: id++, at: now - off, name, phone, email: 'asd@asd.asd', choice: C.choices[0], extra: [], source: 'Прямой заход', utm: null, page: C.page, device: 'Компьютер', status: 'spam', note: '', read: true, log: [{ at: now - off, t: 'Заявка с сайта' }, { at: now - off + 9 * MIN, t: 'Статус → Спам' }] });
    });
    return { v: 1, nextId: id, leads };
  }

  /* ---------- состояние ---------- */
  let S = store.get(C.key);
  if (!S || S.v !== 1 || !Array.isArray(S.leads)) { S = seed(); store.set(C.key, S); }
  const save = () => store.set(C.key, S);
  const ui = { tab: 'new', q: '', src: '', sel: null, sheet: false, settings: false };

  function ingest() {
    const inbox = store.get(C.inbox);
    if (!Array.isArray(inbox) || !inbox.length) return [];
    store.del(C.inbox);
    const got = [];
    inbox.forEach(x => {
      const at = Number(x.at) || Date.now();
      const lead = {
        id: S.nextId++, at, name: String(x.name || 'Без имени').slice(0, 80), phone: String(x.phone || '').slice(0, 30), email: String(x.email || '').slice(0, 120),
        choice: String(x.choice || C.choices[0]).slice(0, 80), extra: Array.isArray(x.extra) ? x.extra.slice(0, 6).map(e => [String(e[0]).slice(0, 40), String(e[1]).slice(0, 120)]) : [],
        source: 'Демо-сайт — ваша заявка', utm: null, page: C.page, device: matchMedia('(pointer:coarse)').matches ? 'Телефон' : 'Компьютер',
        status: 'new', note: '', read: false, mine: true, log: [{ at, t: 'Заявка с сайта' }],
      };
      S.leads.unshift(lead); got.push(lead);
    });
    save();
    return got;
  }

  function fake() {
    const r = Math.random;
    const p = C.people[Math.floor(r() * C.people.length)];
    const src = pickW(r, C.sources);
    const at = Date.now();
    const lead = { id: S.nextId++, at, name: p[0], phone: phoneFrom(r), email: p[1] || '', choice: C.choices[Math.floor(r() * C.choices.length)], extra: C.extras ? C.extras(r, p) : [], source: src.label, utm: src.utm ? { source: src.utm[0], medium: src.utm[1], campaign: src.utm[2] || '' } : null, page: C.page, device: r() < .7 ? 'Телефон' : 'Компьютер', status: 'new', note: '', read: false, log: [{ at, t: 'Заявка с сайта' }] };
    S.leads.unshift(lead); save();
    return lead;
  }

  const byId = id => S.leads.find(l => l.id === id);
  const counts = () => { const c = { new: 0, work: 0, done: 0, spam: 0, all: 0 }; S.leads.forEach(l => { c[l.status]++; if (l.status !== 'spam') c.all++; }); return c; };
  function visible() {
    const q = ui.q.trim().toLowerCase(), qd = q.replace(/\D/g, '');
    return S.leads
      .filter(l => ui.tab === 'all' ? l.status !== 'spam' : l.status === ui.tab)
      .filter(l => !ui.src || l.source === ui.src)
      .filter(l => !q || l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || String(l.id).includes(q) || (qd.length > 2 && l.phone.replace(/\D/g, '').includes(qd)))
      .sort((a, b) => b.at - a.at);
  }

  function stats() {
    const now = Date.now(), t0 = dayStart(now);
    const real = S.leads.filter(l => l.status !== 'spam');
    const today = real.filter(l => l.at >= t0).length;
    const week = real.filter(l => l.at >= t0 - 6 * DAY).length;
    const resp = real.map(l => { const e = l.log.find(x => x.t.startsWith('Статус')); return e ? e.at - l.at : null; }).filter(x => x != null && x > 0);
    const avg = resp.length ? resp.reduce((a, b) => a + b, 0) / resp.length : 0;
    const days = [];
    for (let i = 13; i >= 0; i--) { const s = t0 - i * DAY; days.push({ s, n: real.filter(l => l.at >= s && l.at < s + DAY).length }); }
    const src = {};
    real.forEach(l => { src[l.source] = (src[l.source] || 0) + 1; });
    const srcList = Object.entries(src).sort((a, b) => b[1] - a[1]);
    return { today, week, avg, days, srcList, total: real.length };
  }

  /* ---------- разметка ---------- */
  const root = $('#app');
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
  };

  function login() {
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
          <p class="login__note">Демо-версия: данные выдуманные и хранятся только в вашем браузере. В настоящей панели — сервер в России, вход по паролю, журнал действий.</p>
        </form>
      </main>`;
    $('#login').addEventListener('submit', e => { e.preventDefault(); ss.set('zv-auth-' + C.key, '1'); document.body.classList.remove('is-login'); app(true); });
  }

  function app(first) {
    ingest();
    root.innerHTML = `
      <div class="shell">
        <header class="top">
          <div class="brand">${C.logo}<span class="brand__sub">${esc(C.product)}</span></div>
          <div class="top__live"><i class="pulse" aria-hidden="true"></i><span>Онлайн · сервер в России</span></div>
          <div class="top__act">
            <a class="btn btn--ghost" href="${esc(C.site)}" target="_blank" rel="noopener">Оставить заявку на сайте <i>${I.out}</i></a>
            <button class="btn btn--ghost" data-act="fake" title="Создать тестовую заявку"><i>${I.plus}</i><span>Тестовая</span></button>
            <button class="btn btn--icon" data-act="csv" title="Скачать CSV" aria-label="Скачать CSV">${I.down}</button>
            <button class="btn btn--icon" data-act="settings" title="Настройки" aria-label="Настройки">${I.gear}</button>
          </div>
        </header>
        <section class="kpi" id="kpi"></section>
        <section class="work">
          <div class="list">
            <div class="list__head">
              <div class="tabs" role="tablist" id="tabs"></div>
              <div class="tools">
                <label class="search">${I.search}<input id="q" type="search" placeholder="Имя, телефон, почта или №" autocomplete="off"></label>
                <select id="src" aria-label="Источник"></select>
              </div>
            </div>
            <ul class="rows" id="rows"></ul>
          </div>
          <aside class="detail" id="detail" aria-live="polite"></aside>
        </section>
        <footer class="foot">Демо-проект Станислава Максимова · данные выдуманные · <a href="${esc(C.home)}">← вернуться в портфолио</a></footer>
      </div>
      <div class="toast" id="toast" role="status"></div>
      <div class="drawer" id="drawer" hidden></div>`;
    bind();
    if (!ui.sel) { const v = visible(); if (v[0] && matchMedia('(min-width:960px)').matches) ui.sel = v[0].id; }
    renderAll(first);
  }

  function renderAll(anim) { renderKpi(anim); renderTabs(); renderSrc(); renderRows(anim); renderDetail(); }

  function renderKpi(anim) {
    const s = stats(), c = counts();
    const max = Math.max(1, ...s.days.map(d => d.n));
    const bars = s.days.map((d, i) => `<i style="--h:${(d.n / max) * 100}%;--d:${i * 30}ms" title="${dm(d.s)}: ${d.n}" class="${i === 13 ? 'is-today' : ''}"></i>`).join('');
    const top = s.srcList.slice(0, 4).map(([k, n]) => `<li><span>${esc(k)}</span><b>${Math.round(n / s.total * 100)}%</b><i style="--w:${n / s.srcList[0][1] * 100}%"></i></li>`).join('');
    $('#kpi').innerHTML = `
      <div class="k k--hot"><span class="k__l">Ждут ответа</span><b class="k__n" data-n="${c.new}">${c.new}</b><span class="k__s">${c.new ? 'ответьте в первые 15 минут' : 'всё разобрано'}</span></div>
      <div class="k"><span class="k__l">Сегодня</span><b class="k__n" data-n="${s.today}">${s.today}</b><span class="k__s">${s.week} за 7 дней</span></div>
      <div class="k"><span class="k__l">Среднее время ответа</span><b class="k__n k__n--t">${s.avg ? dur(s.avg) : '—'}</b><span class="k__s">от заявки до первого статуса</span></div>
      <div class="k k--chart"><span class="k__l">14 дней</span><div class="bars${anim ? ' is-anim' : ''}">${bars}</div></div>
      <div class="k k--src"><span class="k__l">Откуда приходят</span><ul class="srcs">${top}</ul></div>`;
    if (anim) countUp();
  }
  function countUp() {
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    document.querySelectorAll('.k__n[data-n]').forEach(el => {
      const n = +el.dataset.n; if (!n) return; const t0 = performance.now();
      const step = t => { const p = Math.min(1, (t - t0) / 900); el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }

  function renderTabs() {
    const c = counts();
    $('#tabs').innerHTML = [...STATUS, ['all', 'Все']].map(([k, l]) =>
      `<button role="tab" aria-selected="${ui.tab === k}" data-tab="${k}">${l}<sup>${c[k]}</sup></button>`).join('');
  }
  function renderSrc() {
    const list = [...new Set(S.leads.map(l => l.source))].sort();
    if (ui.src && !list.includes(ui.src)) ui.src = '';
    $('#src').innerHTML = `<option value="">Все источники</option>` + list.map(s => `<option${s === ui.src ? ' selected' : ''}>${esc(s)}</option>`).join('');
  }

  function row(l, i, anim) {
    return `<li><button class="row${l.id === ui.sel ? ' is-sel' : ''}${l.read ? '' : ' is-unread'}${l.mine ? ' is-mine' : ''}${anim ? ' is-anim' : ''}" data-id="${l.id}" style="--d:${Math.min(i, 12) * 35}ms">
      <span class="row__dot st-${l.status}" aria-label="${ST[l.status]}"></span>
      <span class="row__main"><b>${esc(l.name)}</b><span class="row__meta">${esc(l.choice)} · ${esc(l.source)}</span></span>
      <span class="row__side"><time>${ago(l.at)}</time><span class="row__id">№ ${l.id}</span></span>
    </button></li>`;
  }
  function renderRows(anim) {
    const v = visible();
    const el = $('#rows');
    if (!v.length) {
      el.innerHTML = `<li class="empty"><b>${ui.q || ui.src ? 'Ничего не нашлось' : ui.tab === 'new' ? 'Новых заявок нет' : 'Пусто'}</b><span>${ui.q || ui.src ? 'Попробуйте другой запрос или источник' : ui.tab === 'new' ? 'Как только кто-то оставит заявку на сайте — она появится здесь' : 'Здесь появятся заявки с этим статусом'}</span></li>`;
      return;
    }
    // группы по дням
    let last = '', html = '';
    v.forEach((l, i) => {
      const t0 = dayStart(Date.now());
      const g = l.at >= t0 ? 'Сегодня' : l.at >= t0 - DAY ? 'Вчера' : dm(l.at);
      if (g !== last) { html += `<li class="grp">${g}</li>`; last = g; }
      html += row(l, i, anim);
    });
    el.innerHTML = html;
  }

  function renderDetail() {
    const box = $('#detail');
    const l = ui.sel && byId(ui.sel);
    document.body.classList.toggle('has-sheet', !!(l && ui.sheet));
    if (!l) {
      box.innerHTML = `<div class="detail__empty"><div class="detail__glyph" aria-hidden="true">${C.glyph || '✶'}</div><b>Выберите заявку</b><span>Слева — все заявки с сайта. Новые подсвечены, ответить лучше в первые 15 минут.</span></div>`;
      return;
    }
    const resp = l.log.find(x => x.t.startsWith('Статус'));
    const info = [[C.choiceLabel, l.choice], ...l.extra, ['Устройство', l.device], ['Страница', l.page]];
    const utm = l.utm ? [['utm_source', l.utm.source], ['utm_medium', l.utm.medium], ['utm_campaign', l.utm.campaign]].filter(x => x[1]) : [];
    const tel = l.phone.replace(/[^\d+]/g, '');
    box.innerHTML = `
      <div class="d">
        <div class="d__bar"><button class="btn btn--icon d__back" data-act="back" aria-label="Назад к списку">${I.back}</button><span class="d__id">Заявка № ${l.id}</span><time>${full(l.at)}</time></div>
        <h2 class="d__name">${esc(l.name)}</h2>
        ${l.mine ? '<p class="d__mine">Это ваша заявка с демо-сайта — так её увидит менеджер школы.</p>' : ''}
        <div class="d__contacts">
          <a class="chip chip--big" href="tel:${esc(tel)}">${I.phone}<span>${esc(l.phone)}</span></a>
          <button class="chip" data-copy="${esc(l.phone)}" aria-label="Скопировать телефон">${I.copy}</button>
          ${l.email ? `<a class="chip" href="mailto:${esc(l.email)}">${I.mail}<span>${esc(l.email)}</span></a>` : ''}
        </div>
        <div class="seg" role="radiogroup" aria-label="Статус">
          ${STATUS.map(([k, t]) => `<button role="radio" aria-checked="${l.status === k}" data-status="${k}" class="st-${k}">${t.replace(/ы$/, 'а').replace('Новые', 'Новая')}</button>`).join('')}
        </div>
        <label class="note"><span>Комментарий менеджера</span><textarea id="note" rows="3" placeholder="Например: перезвонить после 18:00, хочет рассрочку">${esc(l.note)}</textarea><em id="noteSaved" aria-live="polite"></em></label>
        <dl class="grid">${info.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <div class="card">
          <div class="card__h">Источник</div>
          <div class="card__src">${esc(l.source)}</div>
          ${utm.length ? `<dl class="utm">${utm.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '<p class="muted">Без UTM-меток — пришёл напрямую или по ссылке без разметки</p>'}
        </div>
        <div class="card card--ok">
          <div class="card__h">${I.shield} Согласие на обработку данных</div>
          <p>Получено ${full(l.at)} · политика v${C.policy || '2'} · отдельный чекбокс, не отмечен заранее</p>
          <p class="muted">Хранится вместе с заявкой — пригодится, если спросит Роскомнадзор.</p>
        </div>
        <div class="log">
          <div class="card__h">История${resp ? ` · ответили через ${dur(resp.at - l.at)}` : ''}</div>
          <ol>${[...l.log].reverse().map(x => `<li><time>${ago(x.at)}</time><span>${esc(x.t)}</span></li>`).join('')}</ol>
        </div>
      </div>`;
  }

  /* ---------- действия ---------- */
  function select(id) {
    ui.sel = id; const l = byId(id);
    if (l && !l.read) { l.read = true; save(); }
    ui.sheet = !matchMedia('(min-width:960px)').matches;
    renderRows(); renderDetail();
    $('#detail').scrollTop = 0; $('#detail').style.setProperty('--p', 0);
  }
  function setStatus(st) {
    const l = byId(ui.sel); if (!l || l.status === st) return;
    l.status = st; l.read = true; l.log.push({ at: Date.now(), t: 'Статус → ' + { new: 'Новая', work: 'В работе', done: 'Обработана', spam: 'Спам' }[st] });
    save(); renderKpi(); renderTabs(); renderRows(); renderDetail();
    toast(`№ ${l.id} → ${ST[st].toLowerCase()}`);
  }
  let noteT;
  function note(v) {
    const l = byId(ui.sel); if (!l) return;
    clearTimeout(noteT);
    noteT = setTimeout(() => {
      const had = !!l.note.trim(); l.note = v;
      if (!had && v.trim()) l.log.push({ at: Date.now(), t: 'Комментарий' });
      save(); const s = $('#noteSaved'); if (s) { s.textContent = 'Сохранено'; setTimeout(() => { if (s.isConnected) s.textContent = ''; }, 1400); }
    }, 450);
  }
  function csv() {
    const head = ['№', 'Дата', 'Статус', 'Имя', 'Телефон', 'Почта', C.choiceLabel, 'Источник', 'utm_source', 'utm_medium', 'utm_campaign', 'Комментарий'];
    const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [head.map(q).join(';')].concat(visible().map(l => [l.id, full(l.at), ST[l.status], l.name, l.phone, l.email, l.choice, l.source, l.utm?.source, l.utm?.medium, l.utm?.campaign, l.note].map(q).join(';')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `zayavki-${C.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('CSV скачан — открывается в Excel и Google Таблицах');
  }
  let toastT;
  function toast(msg, act) {
    const t = $('#toast'); if (!t) return;
    t.innerHTML = `<span>${esc(msg)}</span>` + (act ? `<button data-open="${act}">Открыть</button>` : '');
    t.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-on'), act ? 6000 : 2400);
  }
  function arrived(list) {
    if (!list.length) return;
    ui.tab = 'new'; ui.q = ''; ui.src = ''; const q = $('#q'); if (q) q.value = '';
    renderAll(); flash(list[0].id);
    toast(list.length > 1 ? `${list.length} новых ${plural(list.length, 'заявка', 'заявки', 'заявок')}` : `Новая заявка: ${list[0].name}`, list[0].id);
  }
  function flash(id) { const b = document.querySelector(`.row[data-id="${id}"]`); if (b) { b.classList.add('is-new'); setTimeout(() => b.classList.remove('is-new'), 2400); } }

  function settings(open) {
    const d = $('#drawer');
    ui.settings = open; d.hidden = !open;
    if (!open) return;
    d.innerHTML = `
      <div class="drawer__bg" data-act="close"></div>
      <div class="drawer__card" role="dialog" aria-modal="true" aria-label="Настройки">
        <div class="drawer__h"><b>Настройки</b><button class="btn btn--icon" data-act="close" aria-label="Закрыть">✕</button></div>
        <dl class="set">
          <div><dt>Хранение</dt><dd>Сервер в России, база MySQL. Заявки не уходят в зарубежные сервисы.</dd></div>
          <div><dt>Уведомления</dt><dd>Письмо о каждой новой заявке на ${esc(C.mail)}. По желанию — дубль в мессенджер.</dd></div>
          <div><dt>Защита от спама</dt><dd>Скрытая ловушка для ботов и не больше 5 заявок за 10 минут с одного адреса.</dd></div>
          <div><dt>Доступ</dt><dd>Вход по паролю, только для сотрудников школы.</dd></div>
          <div><dt>Выгрузка</dt><dd>CSV для Excel и Google Таблиц, подключение к amoCRM или Битрикс24.</dd></div>
        </dl>
        <button class="btn btn--ghost btn--wide" data-act="reset">Сбросить демо-данные</button>
        <button class="btn btn--ghost btn--wide" data-act="logout">Выйти</button>
      </div>`;
    d.querySelector('.drawer__card .btn').focus();
  }

  function bind() {
    root.addEventListener('click', e => {
      const t = e.target.closest('button,a'); if (!t) return;
      if (t.dataset.tab) { ui.tab = t.dataset.tab; renderTabs(); renderRows(true); return; }
      if (t.dataset.id) { select(+t.dataset.id); return; }
      if (t.dataset.status) { setStatus(t.dataset.status); return; }
      if (t.dataset.open) { const id = +t.dataset.open; const l = byId(id); if (l) { ui.tab = l.status; renderTabs(); renderRows(); select(id); } $('#toast').classList.remove('is-on'); return; }
      if (t.dataset.copy != null) { navigator.clipboard?.writeText(t.dataset.copy).then(() => toast('Телефон скопирован'), () => toast(t.dataset.copy)); return; }
      const a = t.dataset.act;
      if (a === 'fake') { const l = fake(); arrived([l]); }
      else if (a === 'csv') csv();
      else if (a === 'settings') settings(true);
      else if (a === 'close') settings(false);
      else if (a === 'back') { ui.sheet = false; renderDetail(); }
      else if (a === 'reset') { store.del(C.key); S = seed(); store.set(C.key, S); ui.sel = null; ui.tab = 'new'; settings(false); app(true); toast('Демо-данные сброшены'); }
      else if (a === 'logout') { try { sessionStorage.removeItem('zv-auth-' + C.key); } catch { } settings(false); login(); }
    });
    $('#q').addEventListener('input', e => { ui.q = e.target.value; renderRows(); });
    $('#src').addEventListener('change', e => { ui.src = e.target.value; renderRows(true); });
    root.addEventListener('input', e => { if (e.target.id === 'note') note(e.target.value); });
    // полоска прогресса прокрутки карточки
    const det = $('#detail');
    det.addEventListener('scroll', () => { const m = det.scrollHeight - det.clientHeight; det.style.setProperty('--p', m > 0 ? (det.scrollTop / m).toFixed(3) : 0); }, { passive: true });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (ui.settings) settings(false); else if (ui.sheet) { ui.sheet = false; renderDetail(); } }
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && $('#q')) { e.preventDefault(); $('#q').focus(); }
  });
  // заявка с демо-сайта в соседней вкладке
  addEventListener('storage', e => { if (e.key === C.inbox && e.newValue && $('#rows')) arrived(ingest()); });
  addEventListener('focus', () => { if ($('#rows')) arrived(ingest()); });
  setInterval(() => { if ($('#rows') && !document.hidden) { renderRows(); } }, 60e3);

  if (ss.get('zv-auth-' + C.key) === '1') app(true); else login();
})();
