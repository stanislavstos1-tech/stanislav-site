/* Демо-данные. Всё вымышлено: имена, телефоны вида +7 (7xx/9xx) 000-…, ссылки на созвоны.
   Генерация детерминированная (один и тот же «случай»), даты строятся от текущего дня,
   чтобы на экране «Сегодня» всегда было что показать. */
import type {
  DB, Lead, LeadStatus, Lesson, Student, Teacher, Group, Payer, Payment, Subscription, PackageType, Task, Channel, Level, LostReason, User, AttendanceMark,
} from '../domain/types';
import { DAY, HOUR, MIN, addDays, at, isoWeekday, startOfDay, startOfWeek } from '../lib/format';

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SEED_VERSION = 3;

export function createSeed(now = Date.now()): DB {
  const r = rng(20261005);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  let n = 0;
  const id = (p: string) => p + (++n).toString(36);
  let ph = 10;
  const phone = (kz = r() < 0.6) => { ph += int(3, 17); const t = String(ph).padStart(4, '0'); return `+7 (${kz ? pick(['701', '702', '705', '707', '747', '777']) : pick(['900', '901', '903', '905', '916'])}) 000-${t.slice(0, 2)}-${t.slice(2)}`; };

  const today = startOfDay(now);
  const week0 = startOfWeek(now);

  /* ---------- пользователи и преподаватели ---------- */
  // цвета — первые пять оттенков проверенной категориальной палитры; в расписании рядом всегда инициалы
  const teachers: Teacher[] = [
    { id: 't1', name: 'Анна Ковалёва', phone: phone(), color: '#2a78d6', rateGroup: 4500, rateIndividual: 3500, workFrom: 10, workTo: 21 },
    { id: 't2', name: 'Тимур Сейтказы', phone: phone(), color: '#eb6834', rateGroup: 4500, rateIndividual: 3500, workFrom: 12, workTo: 21 },
    { id: 't3', name: 'Мария Лебедь', phone: phone(), color: '#1baf7a', rateGroup: 4000, rateIndividual: 3200, workFrom: 9, workTo: 18 },
    { id: 't4', name: 'Даниал Оспанов', phone: phone(), color: '#c98500', rateGroup: 5000, rateIndividual: 4000, workFrom: 14, workTo: 21 },
    { id: 't5', name: 'Елена Ри', phone: phone(), color: '#d55181', rateGroup: 4000, rateIndividual: 3200, workFrom: 10, workTo: 19 },
  ];
  const users: User[] = [
    { id: 'u-admin', name: 'Айгерим Нуртаева', role: 'admin' },
    { id: 'u-manager', name: 'Дамир Касымов', role: 'manager' },
    { id: 'u-owner', name: 'Ольга Смирнова', role: 'owner' },
    ...teachers.map(t => ({ id: 'u-' + t.id, name: t.name, role: 'teacher' as const, teacherId: t.id })),
  ];

  /* ---------- пакеты ---------- */
  const packageTypes: PackageType[] = [
    { id: 'p-g8', title: '8 занятий в группе', kind: 'group', lessons: 8, price: 36000 },
    { id: 'p-g12', title: '12 занятий в группе', kind: 'group', lessons: 12, price: 51000 },
    { id: 'p-i4', title: '4 индивидуальных', kind: 'individual', lessons: 4, price: 30000 },
    { id: 'p-i8', title: '8 индивидуальных', kind: 'individual', lessons: 8, price: 56000 },
  ];

  /* ---------- ученики ---------- */
  const NAMES = [
    'Алия Жумабаева', 'Артём Волков', 'Дана Ахметова', 'Никита Орлов', 'Айсулу Кенжебек', 'Мирон Белов', 'Камила Есенова', 'Глеб Морозов',
    'Асель Тлеубаева', 'Илья Кузнецов', 'Аружан Сапарова', 'Матвей Зайцев', 'Сабина Мусина', 'Егор Павлов', 'Томирис Абенова', 'Лев Соколов',
    'Жания Бекова', 'Марк Федоров', 'Инкар Нурланова', 'Вера Антонова', 'Амир Жаксылыков', 'София Громова', 'Ерлан Тулегенов', 'Полина Ершова',
    'Айдана Каирбекова', 'Роман Григорьев', 'Мадина Исаева', 'Арсений Лапин', 'Диляра Хасенова', 'Ксения Белая', 'Алихан Мухтаров', 'Ева Королёва',
    'Нурсултан Абдрахманов', 'Алина Степанова', 'Темирлан Ибраев', 'Злата Миронова', 'Бекзат Оразов', 'Варвара Носова', 'Айбек Сейткали', 'Ульяна Рябова',
  ];
  const PARENT = ['Гульнара', 'Сауле', 'Ирина', 'Асем', 'Наталья', 'Жанар', 'Светлана', 'Айнур', 'Ольга', 'Динара'];
  const payers: Payer[] = [];
  const students: Student[] = [];
  const childIdx = new Set([0, 2, 4, 6, 8, 10, 12, 14, 18, 20, 24, 30, 32, 34]); // дети/подростки — платит родитель
  for (let i = 0; i < 36; i++) {
    const name = NAMES[i];
    const child = childIdx.has(i);
    const last = name.split(' ')[1];
    const payer: Payer = child
      ? { id: id('py'), name: pick(PARENT) + ' ' + (last.endsWith('а') || last.endsWith('я') ? last : last + (last.endsWith('ов') || last.endsWith('ев') || last.endsWith('ин') ? 'а' : '')), phone: phone(), relation: r() < 0.8 ? 'mother' : 'father' }
      : { id: id('py'), name, phone: '', relation: 'self' };
    const st: Student = {
      id: id('s'), name, phone: child ? '' : phone(), age: child ? int(8, 16) : int(18, 42),
      level: pick<Level>(['A1', 'A2', 'A2', 'B1', 'B1', 'B2', 'C1']), payerId: payer.id, status: 'active',
      createdAt: today - int(10, 230) * DAY - int(9, 18) * HOUR, note: '', preferredChannel: r() < 0.75 ? 'telegram' : 'call',
    };
    if (!child) payer.phone = st.phone;
    payers.push(payer); students.push(st);
  }
  // ушедшие (для отчёта по отвалу)
  const leftSpec: [number, string][] = [[7, 'Переезд'], [13, 'Дорого'], [19, 'Нет времени'], [25, 'Достиг цели'], [29, 'Не подошёл формат'], [35, 'Нет времени']];
  leftSpec.forEach(([i, reason], k) => { const s = students[i]; s.status = 'left'; s.leftReason = reason; s.leftAt = today - (12 + k * 24) * DAY; if (s.createdAt > s.leftAt - 50 * DAY) s.createdAt = s.leftAt - 70 * DAY; });
  students[23].status = 'paused'; students[23].note = 'Пауза до конца месяца — сессия в университете';
  students[3].note = 'Цель — IELTS 6.5 к весне, слабое место — Writing';
  students[10].note = 'Мама просит присылать домашку в Telegram';

  /* ---------- группы ---------- */
  const groupDefs: [string, Level, string, number[], string][] = [
    ['Kids A1 · будни', 'A1', 't3', [1, 3], '16:00'],
    ['Kids A2 · будни', 'A2', 't5', [2, 4], '16:30'],
    ['Teens B1', 'B1', 't1', [1, 3], '18:00'],
    ['Разговорный B1', 'B1', 't2', [2, 4], '19:00'],
    ['IELTS B2 · вечер', 'B2', 't4', [1, 4], '19:30'],
    ['General A2 · утро', 'A2', 't3', [2, 5], '10:00'],
    ['Business B2', 'B2', 't1', [3, 5], '20:00'],
    ['Teens A2 · суббота', 'A2', 't2', [6], '12:00'],
  ];
  const groups: Group[] = groupDefs.map(([name, level, teacherId, weekdays, time], i) => ({
    id: 'g' + (i + 1), name, level, teacherId, weekdays, time, studentIds: [], capacity: 6, duration: weekdays.length === 1 ? 90 : 60,
    meetUrl: `https://meet.example.com/lingua-g${i + 1}`,
  }));
  // раскладываем учеников: дети — в детские/подростковые группы, взрослые — во взрослые; пятеро — индивидуально
  const individualIdx = new Set([1, 5, 9, 15, 27]);
  const kidsGroups = [0, 1, 2, 7], adultGroups = [3, 4, 5, 6];
  const membership: Record<string, string[]> = {}; // studentId → groupIds (включая прошлое, для истории)
  students.forEach((s, i) => {
    if (individualIdx.has(i)) return;
    const pool = (childIdx.has(i) ? kidsGroups : adultGroups).map(k => groups[k]);
    const g = pool.filter(g => g.studentIds.length < 5).sort((a, b) => a.studentIds.length - b.studentIds.length)[0] || pool[0];
    g.studentIds.push(s.id); membership[s.id] = [g.id];
  });
  const indivTeacher: Record<string, string> = {};
  const indivSlot: Record<string, [number, string]> = {};
  [...individualIdx].forEach((i, k) => { const s = students[i]; indivTeacher[s.id] = ['t1', 't2', 't4', 't5', 't3'][k]; indivSlot[s.id] = [[2, 5, 1, 3, 4][k], ['11:00', '17:00', '15:00', '13:00', '18:00'][k]]; });

  /* ---------- занятия: 30 недель истории + 4 вперёд ---------- */
  const lessons: Lesson[] = [];
  const W0 = week0 - 30 * 7 * DAY, W1 = week0 + 4 * 7 * DAY;
  const markFor = (): AttendanceMark => { const x = r(); return x < 0.86 ? 'present' : x < 0.93 ? 'absent' : 'excused'; };
  const activeAt = (s: Student, t: number) => t >= s.createdAt && (!s.leftAt || t < s.leftAt) && !(s.status === 'paused' && t > today - 10 * DAY);
  const unmarkedQuota = { n: 3 }; // несколько недавних занятий оставим без отметки
  for (const g of groups) {
    const seriesId = 'sr-' + g.id;
    const members = students.filter(s => membership[s.id]?.includes(g.id));
    const start = Math.min(...members.map(s => s.createdAt));
    for (let d = W0; d < W1; d += DAY) {
      if (!g.weekdays.includes(isoWeekday(d))) continue;
      const t = at(d, g.time);
      if (t < start - 7 * DAY) continue;
      const past = t + g.duration * MIN < now;
      const l: Lesson = { id: id('l'), kind: 'group', teacherId: g.teacherId, start: t, duration: g.duration, status: past ? 'done' : 'planned', groupId: g.id, seriesId, attendance: {} };
      if (past) {
        const recent = now - t < 2 * DAY;
        if (recent && unmarkedQuota.n > 0 && r() < 0.7) { l.status = 'planned'; unmarkedQuota.n--; }
        else members.filter(s => activeAt(s, t)).forEach(s => (l.attendance[s.id] = markFor()));
      }
      lessons.push(l);
    }
  }
  for (const s of students.filter(s => indivTeacher[s.id])) {
    const [wd, time] = indivSlot[s.id];
    for (let d = W0; d < W1; d += DAY) {
      if (isoWeekday(d) !== wd) continue;
      const t = at(d, time);
      if (t < s.createdAt) continue;
      const past = t + 60 * MIN < now;
      const l: Lesson = { id: id('l'), kind: 'individual', teacherId: indivTeacher[s.id], start: t, duration: 60, status: past ? 'done' : 'planned', studentId: s.id, seriesId: 'sr-' + s.id, attendance: {} };
      if (past && activeAt(s, t)) l.attendance[s.id] = r() < 0.92 ? 'present' : 'excused';
      if (past && !activeAt(s, t)) l.status = 'canceled', l.cancelReason = 'Ученик не занимается';
      lessons.push(l);
    }
  }
  // одно занятие на этой неделе перенесено, одно отменено — чтобы было видно в расписании
  const thisWeek = lessons.filter(l => l.kind === 'group' && l.start > now && l.start < week0 + 7 * DAY);
  if (thisWeek[1]) { thisWeek[1].movedFrom = thisWeek[1].start; thisWeek[1].start += 1 * DAY; }

  /* ---------- абонементы и оплаты, подогнанные под реальные списания ---------- */
  const subscriptions: Subscription[] = [];
  const payments: Payment[] = [];
  const charged = (sid: string) => lessons.filter(l => l.status === 'done' && (l.attendance[sid] === 'present' || l.attendance[sid] === 'absent')).sort((a, b) => a.start - b.start);
  const desired: Record<number, number> = { 0: 0, 2: -2, 4: 0, 6: 0, 11: -1, 16: -1, 17: 0, 21: -3, 28: 0, 31: -2, 33: 0 }; // кому оставить мало / уйти в минус
  students.forEach((s, i) => {
    const ch = charged(s.id);
    const indiv = !!indivTeacher[s.id];
    let want = s.status === 'left' ? 0 : desired[i] ?? int(3, 9);
    // пакеты бывают по 4/8/12 занятий: итог кратен 4; долг округляем вниз, запас — вверх
    let total = ch.length + want;
    if (total % 4) total = want < 0 ? total - (total % 4) : total + 4 - (total % 4);
    if (s.status === 'left') total = Math.ceil(ch.length / 4) * 4;
    total = Math.max(total, 8);
    const plan: PackageType[] = [];
    let left = total;
    while (left > 0) {
      if (indiv) { if (left >= 8) { plan.push(packageTypes[3]); left -= 8; } else { plan.push(packageTypes[2]); left -= 4; } continue; }
      if (left % 8 === 4 && left >= 12) { plan.push(packageTypes[1]); left -= 12; }
      else { plan.push(packageTypes[0]); left -= 8; }
    }
    // если последний групповой пакет «перелетел», ученик просто имеет запас
    let used = 0;
    plan.forEach((p, k) => {
      const lesson = ch[Math.min(used, ch.length - 1)];
      const t = k === 0 ? s.createdAt + int(1, 20) * HOUR : lesson ? lesson.start - int(1, 3) * DAY : s.createdAt + k * 28 * DAY;
      const pid = id('pay'), sid = id('sub');
      const method = pick(['kaspi', 'kaspi', 'kaspi', 'transfer', 'cash', 'card'] as const);
      payments.push({ id: pid, studentId: s.id, payerId: s.payerId, amount: p.price, method, at: Math.min(t, now - HOUR), subscriptionId: sid, comment: '', by: r() < 0.7 ? 'u-admin' : 'u-manager' });
      subscriptions.push({ id: sid, studentId: s.id, packageTypeId: p.id, title: p.title, lessons: p.lessons, price: p.price, purchasedAt: Math.min(t, now - HOUR), paymentId: pid });
      used += p.lessons;
    });
  });

  /* ---------- заявки ---------- */
  const LEAD_NAMES = ['Марина Ким', 'Аскар Бейсенов', 'Юлия Титова', 'Жансая Омарова', 'Денис Карпов', 'Айгуль Сарсенова', 'Олег Миллер', 'Самал Жунусова', 'Кирилл Демин',
    'Назира Алиева', 'Виктория Юн', 'Бауыржан Ердаулетов', 'Анастасия Цой', 'Рустам Байжанов', 'Дарья Семенова', 'Меруерт Касенова', 'Павел Ли', 'Гаухар Есимова',
    'Тимофей Широков', 'Акмарал Нургали', 'Евгения Прохорова', 'Султан Аманов', 'Лаура Ким', 'Максим Ветров', 'Анель Бекмуратова'];
  const COMMENTS: [string, string, boolean][] = [
    ['Нужен IELTS 6.5 к марту, сейчас примерно B1', 'IELTS', false], ['Сыну 10 лет, ищем группу после школы', 'Для ребёнка', true], ['Хочу разговорный, стесняюсь говорить', 'Разговорный', false],
    ['Английский для работы, созвоны с зарубежной командой', 'Для работы', false], ['Дочке 13 лет, подтянуть грамматику', 'Для ребёнка', true], ['С нуля, переезжаем через год', 'С нуля', false],
    ['Сколько стоит индивидуально?', 'Индивидуально', false], ['Можно пробный в субботу?', 'Разговорный', false], ['Подготовка к ЕНТ по английскому', 'Экзамен', true],
  ];
  const SOURCES: Record<Channel, string[]> = {
    whatsapp: ['Объявление в WhatsApp-чате', 'Сарафан'], telegram: ['Канал школы в Telegram', 'Реклама в Telegram'], site: ['Сайт · IELTS', 'Сайт · главная', 'Сайт · дети'],
    call: ['2ГИС', 'Сайт · телефон'], referral: ['Рекомендация ученика', 'Рекомендация родителя'],
  };
  const channels: Channel[] = ['telegram', 'telegram', 'site', 'site', 'site', 'call', 'referral'];
  const leads: Lead[] = [];
  const mkLead = (name: string, status: LeadStatus, createdAt: number, extra: Partial<Lead> = {}): Lead => {
    const [comment, goal, forChild] = pick(COMMENTS);
    const channel = extra.channel || pick(channels);
    const l: Lead = {
      id: id('ld'), name, phone: phone(), channel, source: pick(SOURCES[channel]), comment, goal, forChild, createdAt, status, statusAt: createdAt,
      managerId: r() < 0.6 ? 'u-admin' : 'u-manager', history: [{ at: createdAt, text: 'Заявка · ' + ({ telegram: 'Telegram', site: 'сайт', call: 'звонок', referral: 'рекомендация', whatsapp: 'WhatsApp' } as Record<Channel, string>)[channel] }],
      ...extra,
    };
    return l;
  };
  const freeTrialSlot = (dayOffset: number, hour: number) => at(addDays(today, dayOffset), String(hour).padStart(2, '0') + ':00');
  const trial = (lead: Lead, start: number, teacherId: string, done: boolean) => {
    const l: Lesson = { id: id('l'), kind: 'trial', teacherId, start, duration: 45, status: done ? 'done' : 'planned', leadId: lead.id, attendance: {} };
    lessons.push(l); lead.trialLessonId = l.id;
    lead.history.unshift({ at: Math.min(start - 2 * DAY, now - HOUR), text: 'Назначен пробный: ' + new Date(start).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + String(new Date(start).getHours()).padStart(2, '0') + ':00' });
    if (done) lead.history.unshift({ at: start + 50 * MIN, text: 'Пробный прошёл' });
    return l;
  };
  let li = 0;
  // новые: две без ответа дольше порога
  [[0.3], [1.4], [3.5], [7], [26]].forEach(([h]) => leads.push(mkLead(LEAD_NAMES[li++], 'new', now - h * HOUR)));
  // связались
  [[5], [20], [30], [54]].forEach(([h]) => { const c = now - (h + 10) * HOUR; leads.push(mkLead(LEAD_NAMES[li++], 'contacted', c, { statusAt: now - h * HOUR, firstReplyAt: c + 20 * MIN })); });
  // назначен пробный: два — сегодня
  [[0, 15, 't1'], [0, 17, 't2'], [1, 12, 't3'], [2, 18, 't4']].forEach(([d, h, t]) => {
    const c = now - int(24, 70) * HOUR; const ld = mkLead(LEAD_NAMES[li++], 'trial_booked', c, { firstReplyAt: c + 30 * MIN, statusAt: c + 3 * HOUR });
    trial(ld, freeTrialSlot(d as number, h as number), t as string, false); leads.push(ld);
  });
  // пробный прошёл
  [[-1, 16, 't5'], [-1, 19, 't2'], [-2, 13, 't1']].forEach(([d, h, t]) => {
    const c = now - int(80, 120) * HOUR; const ld = mkLead(LEAD_NAMES[li++], 'trial_done', c, { firstReplyAt: c + 15 * MIN });
    trial(ld, freeTrialSlot(d as number, h as number), t as string, true); ld.statusAt = freeTrialSlot(d as number, h as number) + HOUR; leads.push(ld);
  });
  // ждём оплату
  [[-3, 17, 't4'], [-4, 11, 't3'], [-6, 18, 't1']].forEach(([d, h, t]) => {
    const c = now - int(150, 220) * HOUR; const ld = mkLead(LEAD_NAMES[li++], 'awaiting_payment', c, { firstReplyAt: c + 40 * MIN });
    const tr = trial(ld, freeTrialSlot(d as number, h as number), t as string, true); ld.statusAt = tr.start + 2 * HOUR; ld.history.unshift({ at: ld.statusAt, text: 'Отправили реквизиты, ждём оплату' }); leads.push(ld);
  });
  // оплатили — это ученики, которые пришли недавно
  [...students].filter(s => s.status === 'active').sort((a, b) => b.createdAt - a.createdAt).slice(0, 3).forEach((s, k) => {
    const c = s.createdAt - (4 + k) * DAY; const ld = mkLead(s.name, 'paid', c, { firstReplyAt: c + HOUR, studentId: s.id, statusAt: s.createdAt }); ld.phone = payers.find(p => p.id === s.payerId)!.phone || ld.phone;
    trial(ld, at(addDays(c, 2), '17:00'), pick(['t1', 't2', 't3']), true); ld.history.unshift({ at: s.createdAt, text: 'Оплатил, добавлен в учёбу' }); s.leadId = ld.id; leads.push(ld);
  });
  // отказы
  const lost3: [LostReason, string][] = [['expensive', 'Посмотрит после зарплаты'], ['no_answer', 'Три звонка без ответа'], ['no_time', 'Вернётся летом']];
  lost3.forEach(([reason, cmt], k) => { const c = now - (3 + k * 5) * DAY; leads.push(mkLead(LEAD_NAMES[li++], 'lost', c, { lostReason: reason, lostComment: cmt, statusAt: c + 2 * DAY, firstReplyAt: c + HOUR })); });

  // история закрытых заявок за полгода — только для отчётов (на доске показываются последние 30 дней)
  const HIST_NAMES = ['Аян', 'Света', 'Ержан', 'Катя', 'Нурлан', 'Оля', 'Аслан', 'Лиза', 'Санжар', 'Маша', 'Галым', 'Ира', 'Диас', 'Женя', 'Арман'];
  const reasons: LostReason[] = ['expensive', 'expensive', 'no_time', 'no_answer', 'no_answer', 'chose_other', 'not_target', 'other'];
  for (let k = 0; k < 64; k++) {
    const c = now - int(32, 185) * DAY;
    const ch = pick<Channel>(['telegram', 'telegram', 'telegram', 'site', 'site', 'site', 'site', 'call', 'referral', 'referral']);
    // у рекомендаций и Telegram конверсия выше — чтобы отчёт показывал разницу
    const p = { telegram: 0.36, site: 0.22, call: 0.3, referral: 0.6, whatsapp: 0.3 }[ch];
    const trialP = Math.min(0.9, p + 0.3);
    const gotTrial = r() < trialP, paid = gotTrial && r() < p / trialP;
    const ld = mkLead(pick(HIST_NAMES) + ' ' + pick(['К.', 'М.', 'С.', 'Б.', 'Т.', 'А.']), paid ? 'paid' : 'lost', c, { channel: ch, firstReplyAt: c + int(10, 300) * MIN, statusAt: c + int(3, 12) * DAY });
    if (gotTrial) trial(ld, at(addDays(c, int(1, 4)), '17:00'), pick(['t1', 't2', 't3', 't4', 't5']), true);
    if (!paid) { ld.lostReason = gotTrial ? pick(['expensive', 'no_time', 'chose_other', 'other'] as LostReason[]) : pick(reasons); }
    leads.push(ld);
  }

  /* ---------- задачи ---------- */
  const tasks: Task[] = [];
  const lead = (st: LeadStatus, k = 0) => leads.filter(l => l.status === st)[k];
  const tk = (title: string, due: number, rel: Partial<Task> = {}, assigneeId = 'u-admin') => tasks.push({ id: id('tk'), title, due, done: false, assigneeId, ...rel });
  tk('Перезвонить после работы, обсудить расписание', at(today, '18:30'), { leadId: lead('contacted', 0).id });
  tk('Отправить ссылку на пробный и напомнить за час', at(today, '13:00'), { leadId: lead('trial_booked', 0).id });
  tk('Узнать впечатления после пробного', at(today, '11:00'), { leadId: lead('trial_done', 0).id });
  tk('Напомнить об оплате', at(addDays(today, -1), '16:00'), { leadId: lead('awaiting_payment', 2).id });
  tk('Подобрать группу по уровню B1 вечером', at(addDays(today, 1), '12:00'), { leadId: lead('trial_done', 1).id }, 'u-manager');
  tk('Обсудить с мамой продление абонемента', at(today, '17:00'), { studentId: students[0].id });
  tk('Выслать сертификат об окончании уровня', at(addDays(today, 2), '15:00'), { studentId: students[3].id });

  const db: DB = {
    version: SEED_VERSION, users, leads, payers, students, teachers, groups, lessons, packageTypes, subscriptions, payments, tasks,
    templates: [
      { key: 'greeting', title: 'Приветствие', text: 'Здравствуйте, {имя}! Это школа английского {школа}. Спасибо за заявку! Подскажите, для кого занятия и какая цель? Можем записать на бесплатный пробный урок.' },
      { key: 'trial_reminder', title: 'Напоминание о пробном', text: '{имя}, напоминаем: пробный урок {дата} в {время}. Ссылку на созвон пришлём за 15 минут. До встречи!' },
      { key: 'after_trial', title: 'После пробного', text: '{имя}, спасибо, что пришли на пробный! Как впечатления? Можем подобрать группу или индивидуальный формат — подскажу по расписанию и стоимости.' },
      { key: 'payment_reminder', title: 'Напоминание об оплате', text: 'Здравствуйте, {имя}! Напоминаем об оплате обучения: {сумма}. Оплатить можно через Kaspi или переводом. Если уже оплатили — просто пришлите чек, спасибо!' },
      { key: 'low_balance', title: 'Заканчивается абонемент', text: 'Здравствуйте, {имя}! В абонементе осталось занятий: {уроков}. Чтобы не прерывать учёбу, продлите, пожалуйста, на следующий месяц.' },
      { key: 'lesson_moved', title: 'Перенос занятия', text: '{имя}, занятие перенесено на {дата} в {время}. Ссылка на созвон прежняя.' },
    ],
    settings: {
      schoolName: 'Lingua', currency: 'KZT', rubRate: 5.4,
      // WhatsApp выключен в демо: в РФ он заблокирован. Для школ в Казахстане включается одной галочкой в настройках.
      channels: { whatsapp: false, telegram: true, site: true, call: true, referral: true },
      slaHours: 2, lowBalance: 2, trialDuration: 45,
    },
  };
  return db;
}
