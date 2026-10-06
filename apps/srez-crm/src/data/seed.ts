/* Демо-данные. Всё вымышлено: имена, компании, телефоны вида +7 (9xx) 000-…
   Генерация детерминированная, даты строятся от текущего дня:
   текущий поток идёт уже шестую неделю, менеджеры набирают следующий (как на лендинге — «24 ноября»). */
import type { DB, Lead, LeadStatus, Lesson, Student, Curator, Group, Installment, Homework, Task, Channel, LostReason, User, Tariff, LessonKind, Cohort } from '../domain/types';
import { BLOCKS } from '../domain/labels';
import { DAY, HOUR, MIN, addDays, at, startOfDay, startOfWeek } from '../lib/format';

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SEED_VERSION = 2;

const PRICE: Record<Tariff, number> = { live: 164900, self: 84900 };

export function createSeed(now = Date.now()): DB {
  const r = rng(20261124);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  let n = 0;
  const id = (p: string) => p + (++n).toString(36);
  let ph = 10;
  const phone = () => { ph += int(3, 17); const t = String(ph).padStart(4, '0'); return `+7 (${pick(['903', '905', '909', '915', '916', '925', '926', '977', '985'])}) 000-${t.slice(0, 2)}-${t.slice(2)}`; };
  const today = startOfDay(now);

  /* ---------- потоки: текущий идёт 6-ю неделю, следующий — через 7 недель ---------- */
  const curStart = addDays(startOfWeek(now), -35);
  const nextStart = addDays(startOfWeek(now), 49);
  const pastStart = addDays(curStart, -7 * 20);
  const cohorts: Cohort[] = [
    { id: 'c-past', name: monthName(pastStart) + ' поток', start: pastStart, end: addDays(pastStart, 7 * 17 - 3), lessons: 36, seats: 16 },
    { id: 'c-cur', name: monthName(curStart) + ' поток', start: curStart, end: addDays(curStart, 7 * 17 - 3), lessons: 36, seats: 16 },
    { id: 'c-next', name: monthName(nextStart) + ' поток', start: nextStart, end: addDays(nextStart, 7 * 17 - 3), lessons: 36, seats: 16 },
  ];

  /* ---------- кураторы и сотрудники (имена — как на лендинге srez) ---------- */
  const curators: Curator[] = [
    { id: 'k1', name: 'Дарья Морозова', phone: phone(), color: '#D8F83A', role: 'Куратор · стратегия' },
    { id: 'k2', name: 'Ирина Савельева', phone: phone(), color: '#1DBF98', role: 'Куратор · медиа' },
    { id: 'k3', name: 'Софья Ремизова', phone: phone(), color: '#7FA9F5', role: 'Куратор · брендинг' },
    { id: 'k4', name: 'Павел Орлов', phone: phone(), color: '#F2A65A', role: 'Куратор · исследования' },
  ];
  const users: User[] = [
    { id: 'u-admin', name: 'Вера Климова', role: 'admin' },
    { id: 'u-manager', name: 'Артём Сафронов', role: 'manager' },
    { id: 'u-owner', name: 'Кира Левина', role: 'owner' },
    ...curators.map(c => ({ id: 'u-' + c.id, name: c.name, role: 'curator' as const, curatorId: c.id })),
  ];

  /* ---------- занятия: 36 за 17 недель, вт и чт в 19:30, раз в три недели — созвон группы в субботу ---------- */
  const SPEAKERS = ['Кира Левина', 'Анна Березина', 'Михаил Титов', 'Ольга Серова', 'Кира Левина', 'Денис Рябов'];
  const LESSON_TITLES = [
    ['Кому мы продаём: сегменты и задачи', 'Интервью с клиентами без анкет', 'Карта спроса и сезонность', 'Разбор: портрет без «женщины 25–45»', 'Конкуренты: что они обещают', 'Созвон группы: бриф и роли'],
    ['Позиционирование в одной фразе', 'Оффер и цена: почему купят у вас', 'Тест сообщений до запуска', 'Разбор позиционирования группы', 'Бренд и тон: где граница', 'Созвон группы: защита позиционирования'],
    ['Юнит-экономика без Excel-страха', 'CAC, LTV и окупаемость канала', 'Воронка в деньгах, а не в лидах', 'Разбор: где теряются деньги', 'Сценарии: что будет при −30% бюджета', 'Созвон группы: модель в цифрах'],
    ['Каналы: что даёт выручку, а что охваты', 'Медиаплан на квартал', 'Работа с подрядчиком и агентством', 'Разбор медиапланов', 'Контент как канал продаж', 'Созвон группы: медиаплан'],
    ['Бюджет: как его защитить у собственника', 'Метрики и дашборд руководителя', 'Тесты и гипотезы с бюджетом', 'Разбор бюджетов', 'Отчёт, который читают', 'Созвон группы: генеральный прогон'],
    ['Стратегия на одной странице', 'Презентация: 5 минут на кейс', 'Возражения собственника', 'Разбор стратегий', 'Репетиция защиты', 'Защита перед жюри'],
  ];
  const lessons: Lesson[] = [];
  const mkLessons = (c: Cohort) => {
    let k = 0;
    for (let w = 0; k < 36 && w < 20; w++) {
      const wk = addDays(c.start, w * 7);
      const slots: [number, LessonKind | null][] = [[1, null], [3, null]];
      if (w % 3 === 2) slots.push([5, 'call']);
      for (const [dOff, forced] of slots) {
        if (k >= 36) break;
        const block = Math.floor(k / 6) + 1, idx = k % 6;
        const kind: LessonKind = k === 35 ? 'defense' : idx === 5 ? 'call' : idx === 3 ? 'practice' : forced || (idx % 2 ? 'practice' : 'lecture');
        const day = addDays(wk, kind === 'call' || kind === 'defense' ? 5 : dOff);
        lessons.push({ id: id('l'), n: k + 1, block, title: LESSON_TITLES[block - 1][idx], kind, start: at(day, kind === 'call' || kind === 'defense' ? '12:00' : '19:30'), duration: kind === 'defense' ? 180 : kind === 'call' ? 60 : 90, speaker: kind === 'call' ? 'Кураторы групп' : kind === 'defense' ? 'Жюри: Кира Левина и гости' : SPEAKERS[(k + block) % SPEAKERS.length], cohortId: c.id });
        k++;
      }
    }
    lessons.filter(l => l.cohortId === c.id).sort((a, b) => a.start - b.start).forEach((l, i) => { l.n = i + 1; });
  };
  cohorts.forEach(mkLessons);

  /* ---------- участники текущего потока: 16 в живом, 8 на записях ---------- */
  const NAMES = [
    'Елена Крылова', 'Марина Белова', 'Артём Волков', 'Ксения Лаврова', 'Никита Орлов', 'Полина Ершова', 'Глеб Морозов', 'Алиса Жукова',
    'Роман Григорьев', 'Дарина Абрамова', 'Илья Кузнецов', 'Вера Антонова', 'Тимофей Ильин', 'София Громова', 'Егор Павлов', 'Ульяна Рябова',
    'Анастасия Козлова', 'Мирон Белов', 'Карина Ефимова', 'Лев Соколов', 'Злата Миронова', 'Александр Михайлов', 'Варвара Носова', 'Николай Андреев',
  ];
  const JOBS: [string, string][] = [
    ['Маркетинг-лид направления', 'Nord Pharm'], ['Head of Brand', 'Field Grain'], ['SMM-менеджер', 'агентство «Плюс»'], ['Маркетолог in-house', 'Велопрокат «Круг»'],
    ['Руководитель маркетинга', 'Сеть кофеен «Зерно»'], ['Таргетолог', 'фриланс'], ['Бренд-менеджер', 'Helix Consumer'], ['Маркетолог', 'Онлайн-школа «Код»'],
    ['CMO', 'Студия мебели «Дуб»'], ['Product marketing', 'FinTrack'], ['Контент-маркетолог', 'Северная пивоварня'], ['Основатель', 'Магазин керамики'],
  ];
  const students: Student[] = [];
  NAMES.forEach((name, i) => {
    const [position, company] = JOBS[i % JOBS.length];
    const tariff: Tariff = i < 16 ? 'live' : 'self';
    students.push({ id: id('s'), name, phone: phone(), position, company, tariff, track: i % 3 === 0 ? 'own' : 'brief', cohortId: 'c-cur', status: 'active', createdAt: curStart - int(5, 30) * DAY, note: '' });
  });
  students[5].status = 'paused'; students[5].note = 'Пауза на две недели — командировка, догонит по записям';
  students[21].status = 'left'; students[21].leftReason = 'Сменил работу, нет времени'; students[21].leftAt = now - 9 * DAY;
  students[0].note = 'Свой продукт — сеть аптек, вводные прислала вовремя';
  students[3].note = 'Просила разбор медиаплана до защиты';

  // 4 группы по 4 человека в живом потоке
  const groups: Group[] = curators.map((c, gi) => ({ id: 'g' + (gi + 1), name: 'Группа ' + (gi + 1), curatorId: c.id, studentIds: students.slice(gi * 4, gi * 4 + 4).map(s => s.id) }));

  /* ---------- оплаты: сразу или в рассрочку на 10 платежей ---------- */
  const installments: Installment[] = [];
  const plan = (s: Student, full: boolean, firstAt: number, overdueFrom?: number) => {
    const total = PRICE[s.tariff];
    if (full) { installments.push({ id: id('i'), studentId: s.id, n: 1, of: 1, due: firstAt, amount: total, paidAt: firstAt, method: pick(['card', 'sbp', 'invoice']) }); return; }
    const part = Math.round(total / 10);
    for (let k = 0; k < 10; k++) {
      const due = addDays(firstAt, k * 30);
      const paid = due < now && !(overdueFrom !== undefined && k >= overdueFrom);
      installments.push({ id: id('i'), studentId: s.id, n: k + 1, of: 10, due, amount: k === 9 ? total - part * 9 : part, paidAt: paid ? due + int(0, 2) * DAY : undefined, method: paid ? pick(['card', 'card', 'sbp']) : undefined });
    }
  };
  students.forEach((s, i) => {
    const full = i % 4 === 1;
    // трое просрочили очередной платёж
    const overdue = i === 2 || i === 9 || i === 18 ? 2 : undefined;
    // у части учеников следующий платёж — сегодня–через неделю
    const first = s.createdAt + (i % 5 === 0 ? (today - s.createdAt) % (30 * DAY) : 0);
    plan(s, full, i % 5 === 0 ? addDays(first, 0) : s.createdAt, overdue);
  });
  // ушедшему — платежи после ухода не ждём
  installments.filter(x => x.studentId === students[21].id && !x.paidAt).forEach(x => { x.amount = 0; x.paidAt = students[21].leftAt; });

  /* ---------- домашки: блок 1 сдан, блок 2 — в работе (только живой поток) ---------- */
  const homework: Homework[] = [];
  const HW = BLOCKS.map((b, i) => `Блок ${i + 1}. ${b}`);
  students.filter(s => s.tariff === 'live' && s.status !== 'left').forEach((s, i) => {
    homework.push({ id: id('h'), studentId: s.id, block: 1, title: HW[0], submittedAt: curStart + 16 * DAY + int(0, 3) * DAY, status: 'accepted', reviewedAt: curStart + 20 * DAY });
    if (s.status === 'paused') return;
    const roll = i % 5;
    if (roll === 4) return; // ещё не сдал
    const sub = now - int(2, 70) * HOUR;
    if (roll === 3) homework.push({ id: id('h'), studentId: s.id, block: 2, title: HW[1], submittedAt: sub - 3 * DAY, status: 'returned', reviewedAt: sub - 2 * DAY, comment: pick(['Оффер не отвечает, почему купят у вас, а не у конкурента', 'Сегмент слишком широкий — сузьте до одной задачи клиента', 'Нет цифр: на чём основан вывод про спрос?']) });
    else if (roll === 2) homework.push({ id: id('h'), studentId: s.id, block: 2, title: HW[1], submittedAt: sub - 4 * DAY, status: 'accepted', reviewedAt: sub - 2 * DAY });
    else homework.push({ id: id('h'), studentId: s.id, block: 2, title: HW[1], submittedAt: sub, status: 'submitted' });
  });

  /* ---------- заявки в следующий поток ---------- */
  const LEAD_NAMES = ['Ольга Петрова', 'Максим Ветров', 'Юлия Титова', 'Денис Карпов', 'Алла Сорокина', 'Олег Миллер', 'Светлана Жилина', 'Кирилл Демин', 'Наталья Алексеева',
    'Виктория Юн', 'Борис Ермаков', 'Анастасия Цой', 'Руслан Баженов', 'Дарья Семенова', 'Мария Кузьмина', 'Павел Ли', 'Галина Ефремова', 'Тимур Сергеев',
    'Ангелина Новикова', 'Евгения Прохорова', 'Станислав Афонин', 'Лаура Ким', 'Антон Беляков', 'Анна Бекетова', 'Игорь Власов'];
  const COMMENTS: [string, string][] = [
    ['Веду таргет и контент, но не могу объяснить собственнику, зачем бюджет', 'Маркетолог in-house'], ['Нужен кейс в портфолио, иду на собеседования', 'SMM-специалист'],
    ['Стала руководителем отдела, нужна рамка для стратегии', 'Руководитель маркетинга'], ['Есть свой продукт — хочу стратегию под него', 'Основатель'],
    ['Сколько стоит живой поток и есть ли рассрочка?', 'Маркетолог'], ['Платим агентству, хочу понимать, где работа, а где расход', 'Коммерческий директор'],
    ['Можно оплатить от компании по счёту?', 'Бренд-менеджер'], ['Подойдут ли записи, если график плавающий?', 'Таргетолог'],
  ];
  const SOURCES: Record<Channel, string[]> = {
    telegram: ['Реклама в Telegram', 'Канал srez'], site: ['Лендинг · тарифы', 'Лендинг · программа', 'Лендинг · первый экран'], vk: ['Реклама ВКонтакте'],
    referral: ['Рекомендация выпускника', 'Рекомендация куратора'], call: ['Звонок с лендинга'],
  };
  const channels: Channel[] = ['telegram', 'telegram', 'site', 'site', 'site', 'vk', 'referral', 'call'];
  const CH_TXT: Record<Channel, string> = { telegram: 'Telegram', site: 'лендинг', vk: 'ВКонтакте', referral: 'рекомендация', call: 'звонок' };
  const leads: Lead[] = [];
  const mkLead = (name: string, status: LeadStatus, createdAt: number, extra: Partial<Lead> = {}): Lead => {
    const [comment, position] = pick(COMMENTS);
    const channel = extra.channel || pick(channels);
    return {
      id: id('ld'), name, phone: phone(), channel, source: pick(SOURCES[channel]), comment, position, experience: r() < 0.55 ? 'junior' : 'senior', tariff: r() < 0.7 ? 'live' : 'self',
      createdAt, status, statusAt: createdAt, managerId: r() < 0.6 ? 'u-manager' : 'u-admin', history: [{ at: createdAt, text: 'Заявка · ' + CH_TXT[channel] }], ...extra,
    };
  };
  const call = (l: Lead, t: number, done: boolean) => {
    l.callAt = t;
    l.history.unshift({ at: Math.min(t - DAY, now - HOUR), text: 'Назначен созвон: ' + new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + String(new Date(t).getHours()).padStart(2, '0') + ':00' });
    if (done) l.history.unshift({ at: t + 35 * MIN, text: 'Созвон прошёл' });
  };
  let li = 0;
  [[0.4], [1.2], [3.2], [6], [27]].forEach(([h]) => leads.push(mkLead(LEAD_NAMES[li++], 'new', now - h * HOUR)));
  [[4], [19], [30], [50]].forEach(([h]) => { const c = now - (h + 10) * HOUR; leads.push(mkLead(LEAD_NAMES[li++], 'contacted', c, { statusAt: now - h * HOUR, firstReplyAt: c + 20 * MIN })); });
  [[0, 15], [0, 18], [1, 12], [1, 19], [3, 11]].forEach(([d, hh]) => {
    const c = now - int(24, 70) * HOUR; const l = mkLead(LEAD_NAMES[li++], 'call_booked', c, { firstReplyAt: c + 30 * MIN, statusAt: c + 3 * HOUR });
    call(l, at(addDays(today, d), String(hh).padStart(2, '0') + ':00'), false); leads.push(l);
  });
  [0, 1, 2].forEach(k => { const c = now - int(80, 120) * HOUR; const l = mkLead(LEAD_NAMES[li++], 'call_done', c, { firstReplyAt: c + 15 * MIN }); call(l, c + (1 + k) * DAY, true); l.statusAt = l.callAt! + 40 * MIN; leads.push(l); });
  [0, 1, 2].forEach(() => { const c = now - int(150, 220) * HOUR; const l = mkLead(LEAD_NAMES[li++], 'awaiting_payment', c, { firstReplyAt: c + 40 * MIN }); call(l, c + 2 * DAY, true); l.statusAt = l.callAt! + DAY; l.history.unshift({ at: l.statusAt, text: 'Отправили ссылку на оплату' }); leads.push(l); });
  // уже оплатили места в следующем потоке
  const nextStudents: Student[] = [];
  [0, 1, 2].forEach(k => {
    const c = now - int(9, 25) * DAY; const l = mkLead(LEAD_NAMES[li++], 'paid', c, { firstReplyAt: c + HOUR, statusAt: c + 4 * DAY }); call(l, c + 2 * DAY, true);
    const s: Student = { id: id('s'), name: l.name, phone: l.phone, position: l.position || 'Маркетолог', company: pick(['Студия «Север»', 'Пекарня «Утро»', 'FinTrack', 'Агентство «Плюс»']), tariff: l.tariff, track: k === 1 ? 'own' : 'brief', cohortId: 'c-next', status: 'active', createdAt: l.statusAt, note: '', leadId: l.id };
    l.studentId = s.id; l.history.unshift({ at: l.statusAt, text: 'Оплата · ' + TARIFF_RU[s.tariff] + ' · место в потоке' });
    nextStudents.push(s); leads.push(l); plan(s, k === 2, l.statusAt);
  });
  students.push(...nextStudents);
  // выпускники прошлого потока — платежи по рассрочке идут до сих пор
  ['Юрий Лебедев', 'Татьяна Орлова', 'Кирилл Смирнов', 'Ева Королёва', 'Арсений Лапин', 'Диана Харитонова', 'Богдан Орехов', 'Маргарита Исаева', 'Олеся Гордеева', 'Фёдор Кравцов', 'Инна Захарова', 'Пётр Васильев', 'Жанна Беляева', 'Артур Савельев'].forEach((name, i) => {
    const [position, company] = JOBS[(i + 5) % JOBS.length];
    const s: Student = { id: id('s'), name, phone: phone(), position, company, tariff: i < 10 ? 'live' : 'self', track: i % 3 ? 'brief' : 'own', cohortId: 'c-past', status: 'done', createdAt: pastStart - int(3, 25) * DAY, note: 'Защитил стратегию на финале потока' };
    students.push(s); plan(s, i % 4 === 1, s.createdAt);
  });
  const lost3: [LostReason, string][] = [['expensive', 'Посмотрит записи, если будет скидка'], ['later', 'Вернётся к весеннему потоку'], ['no_answer', '']];
  lost3.forEach(([reason, cmt], k) => { const c = now - (3 + k * 5) * DAY; leads.push(mkLead(LEAD_NAMES[li++ % LEAD_NAMES.length], 'lost', c, { lostReason: reason, lostComment: cmt, statusAt: c + 2 * DAY, firstReplyAt: c + HOUR })); });
  // история за полгода — для отчётов
  const HIST = ['Ян', 'Света', 'Егор', 'Катя', 'Никита', 'Оля', 'Антон', 'Лиза', 'Саша', 'Маша', 'Гриша', 'Ира', 'Денис', 'Женя', 'Артём'];
  for (let k = 0; k < 110; k++) {
    const c = now - int(12, 180) * DAY; const ch = pick(channels);
    const conv = { telegram: 0.22, site: 0.3, vk: 0.12, referral: 0.5, call: 0.28 }[ch];
    const paid = r() < conv;
    const l = mkLead(pick(HIST) + ' ' + pick(['К.', 'М.', 'С.', 'Б.', 'Т.', 'А.']), paid ? 'paid' : 'lost', c, { channel: ch, firstReplyAt: c + int(10, 300) * MIN, statusAt: c + int(3, 12) * DAY });
    if (paid || r() < 0.5) l.callAt = c + 2 * DAY;
    if (!paid) l.lostReason = pick(['expensive', 'expensive', 'no_time', 'later', 'no_answer', 'chose_other', 'not_target'] as LostReason[]);
    leads.push(l);
  }

  /* ---------- напоминания ---------- */
  const tasks: Task[] = [];
  const lead = (st: LeadStatus, k = 0) => leads.filter(l => l.status === st)[k];
  const tk = (title: string, due: number, rel: Partial<Task> = {}, assigneeId = 'u-manager') => tasks.push({ id: id('tk'), title, due, done: false, assigneeId, ...rel });
  tk('Перезвонить после работы, рассказать про рассрочку', at(today, '18:30'), { leadId: lead('contacted', 0).id });
  tk('Прислать программу и пример защиты перед созвоном', at(today, '13:00'), { leadId: lead('call_booked', 0).id });
  tk('Узнать решение после созвона', at(today, '11:00'), { leadId: lead('call_done', 0).id });
  tk('Напомнить про счёт для компании', at(addDays(today, -1), '16:00'), { leadId: lead('awaiting_payment', 1).id });
  tk('Спросить про платёж по рассрочке', at(today, '17:00'), { studentId: students[2].id }, 'u-admin');
  tk('Собрать вводные по своему продукту', at(addDays(today, 2), '15:00'), { studentId: nextStudents[1].id });
  tk('Разослать ссылку на генеральный прогон', at(addDays(today, 4), '10:00'), {}, 'u-admin');
  tk('Проверить, кто не сдал блок 2', at(addDays(today, 1), '12:00'), {}, 'u-admin');
  tk('Созвониться с куратором группы 3 по отстающим', at(addDays(today, 6), '11:00'), {}, 'u-admin');
  tk('Подготовить онбординг следующего потока', at(addDays(today, 10), '12:00'), {}, 'u-admin');
  [[-2, 'Отправить договор-оферту'], [-3, 'Выслать счёт юрлицу'], [-6, 'Добавить новых участников в чат потока']].forEach(([d, t]) => {
    tk(t as string, at(addDays(today, d as number), '12:00')); const x = tasks[tasks.length - 1]; x.done = true; x.doneAt = x.due;
  });

  return {
    version: SEED_VERSION, users, leads, cohorts, curators, groups, students, lessons, homework, installments, tasks,
    templates: [
      { key: 'greeting', title: 'Приветствие', text: 'Здравствуйте, {имя}! Это команда курса {курс}. Спасибо за заявку. Расскажите в двух словах, чем сейчас занимаетесь в маркетинге — подскажем, какой формат подойдёт, и назначим короткий созвон.' },
      { key: 'call_reminder', title: 'Напоминание о созвоне', text: '{имя}, напоминаем про созвон {дата} в {время}: 30 минут, обсудим вашу задачу и формат. Ссылку пришлём за 10 минут.' },
      { key: 'after_call', title: 'После созвона', text: '{имя}, спасибо за разговор! Как и договорились, присылаю ссылку на оплату. Живой поток — {сумма}, можно в рассрочку на 10 платежей без процентов.' },
      { key: 'payment_reminder', title: 'Ждём оплату', text: 'Здравствуйте, {имя}! Места в живом потоке заканчиваются. Ссылка на оплату действует ещё три дня — если остались вопросы, напишите, разберёмся.' },
      { key: 'installment_due', title: 'Платёж по рассрочке', text: '{имя}, напоминаем про очередной платёж по рассрочке: {сумма} до {дата}. Если уже оплатили — пришлите чек, спасибо!' },
      { key: 'homework_returned', title: 'Работа на доработке', text: '{имя}, куратор вернул работу на доработку — комментарии в чате группы. Пересдать можно до {дата}.' },
    ],
    settings: { courseName: 'srez', priceLive: PRICE.live, priceSelf: PRICE.self, installments: 10, slaHours: 2, reviewDays: 3, callDuration: 30 },
  };
}

const TARIFF_RU: Record<Tariff, string> = { live: 'живой поток', self: 'записи' };
function monthName(t: number) {
  const m = ['Январский', 'Февральский', 'Мартовский', 'Апрельский', 'Майский', 'Июньский', 'Июльский', 'Августовский', 'Сентябрьский', 'Октябрьский', 'Ноябрьский', 'Декабрьский'];
  return m[new Date(t).getMonth()];
}
