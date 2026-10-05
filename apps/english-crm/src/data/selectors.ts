/* Вычисляемые данные: остаток уроков, долги, «горящие» заявки, загрузка преподавателей.
   Остаток не хранится — он всегда считается из абонементов и отметок посещаемости,
   поэтому не может «разъехаться». Списывается занятие, где ученик был или пропустил без уважительной причины. */
import type { DB, Lead, Lesson, Student, ID, Group } from '../domain/types';
import { DAY, HOUR, MIN, addDays, startOfDay } from '../lib/format';

export interface Balance {
  bought: number;
  charged: number;
  left: number; // может быть отрицательным — долг
  pricePerLesson: number;
  debt: number; // ₽
  lastPaymentAt?: number;
}

export function balanceMap(db: DB): Map<ID, Balance> {
  const m = new Map<ID, Balance>();
  for (const s of db.students) m.set(s.id, { bought: 0, charged: 0, left: 0, pricePerLesson: 900, debt: 0 });
  const lastSub = new Map<ID, number>();
  for (const sub of db.subscriptions) {
    const b = m.get(sub.studentId); if (!b) continue;
    b.bought += sub.lessons;
    if (!lastSub.has(sub.studentId) || sub.purchasedAt > lastSub.get(sub.studentId)!) {
      lastSub.set(sub.studentId, sub.purchasedAt); b.pricePerLesson = Math.round(sub.price / sub.lessons); b.lastPaymentAt = sub.purchasedAt;
    }
  }
  for (const l of db.lessons) {
    if (l.status !== 'done') continue;
    for (const sid in l.attendance) {
      const mark = l.attendance[sid];
      if (mark === 'present' || mark === 'absent') { const b = m.get(sid); if (b) b.charged++; }
    }
  }
  for (const b of m.values()) { b.left = b.bought - b.charged; b.debt = b.left < 0 ? -b.left * b.pricePerLesson : 0; }
  return m;
}

export const studentGroups = (db: DB, sid: ID): Group[] => db.groups.filter(g => g.studentIds.includes(sid));
export const isIndividualStudent = (db: DB, sid: ID) => db.lessons.some(l => l.kind === 'individual' && l.studentId === sid && l.status !== 'canceled');
export const payerOf = (db: DB, s: Student) => db.payers.find(p => p.id === s.payerId);
/** номер для связи: у детей — номер родителя */
export const contactPhone = (db: DB, s: Student) => payerOf(db, s)?.phone || s.phone;

/* ---------- заявки ---------- */
export const isUnanswered = (l: Lead) => l.status === 'new' && !l.firstReplyAt;
export const isOverdue = (l: Lead, slaHours: number, now = Date.now()) => isUnanswered(l) && now - l.createdAt > slaHours * HOUR;

/** на доске: все открытые заявки + закрытые за последние 30 дней */
export const boardLeads = (db: DB, now = Date.now()) => db.leads.filter(l => (l.status !== 'paid' && l.status !== 'lost') || now - l.statusAt < 30 * DAY);

/* ---------- занятия ---------- */
export const lessonEnd = (l: Lesson) => l.start + l.duration * MIN;
export const isMarked = (l: Lesson) => l.status === 'done' || l.status === 'canceled';

/** прошедшие занятия без отметки посещаемости */
export const unmarkedLessons = (db: DB, now = Date.now(), teacherId?: ID) =>
  db.lessons.filter(l => l.status === 'planned' && lessonEnd(l) < now && now - l.start < 14 * DAY && (!teacherId || l.teacherId === teacherId)).sort((a, b) => a.start - b.start);

export const lessonsInRange = (db: DB, from: number, to: number, teacherId?: ID) =>
  db.lessons.filter(l => l.start >= from && l.start < to && (!teacherId || l.teacherId === teacherId)).sort((a, b) => a.start - b.start);

/** ученики занятия: у группы — текущий состав (активные), у индивидуального — один ученик */
export function lessonStudents(db: DB, l: Lesson): Student[] {
  if (l.kind === 'individual' && l.studentId) return db.students.filter(s => s.id === l.studentId);
  if (l.kind === 'group' && l.groupId) {
    const g = db.groups.find(g => g.id === l.groupId);
    const ids = new Set([...(g?.studentIds || []), ...Object.keys(l.attendance)]);
    return db.students.filter(s => ids.has(s.id) && (s.status !== 'left' || l.attendance[s.id]));
  }
  return [];
}

export function lessonTitle(db: DB, l: Lesson): string {
  if (l.kind === 'group') return db.groups.find(g => g.id === l.groupId)?.name || 'Группа';
  if (l.kind === 'individual') return db.students.find(s => s.id === l.studentId)?.name || 'Индивидуально';
  return 'Пробный · ' + (db.leads.find(x => x.id === l.leadId)?.name || '');
}

/** часы работы преподавателя за неделю (без отменённых) */
export const teacherHours = (db: DB, teacherId: ID, from: number, to: number) =>
  lessonsInRange(db, from, to, teacherId).filter(l => l.status !== 'canceled').reduce((s, l) => s + l.duration, 0) / 60;

/** свободные окна преподавателя в день — по часу, в рабочее время, не раньше чем через час от «сейчас» */
export function freeSlots(db: DB, teacherId: ID, day: number, minutes = 45, now = Date.now()): number[] {
  const t = db.teachers.find(t => t.id === teacherId); if (!t) return [];
  const busy = lessonsInRange(db, day, addDays(day, 1), teacherId).filter(l => l.status !== 'canceled');
  const out: number[] = [];
  for (let h = t.workFrom; h + minutes / 60 <= t.workTo; h++) {
    const s = startOfDay(day) + h * HOUR, e = s + minutes * MIN;
    if (s < now + HOUR) continue;
    if (busy.some(l => l.start < e && lessonEnd(l) > s)) continue;
    out.push(s);
  }
  return out;
}

/** пересекается ли новое занятие с уже назначенными у преподавателя */
export const hasConflict = (db: DB, teacherId: ID, start: number, minutes: number, ignoreId?: ID) =>
  db.lessons.some(l => l.id !== ignoreId && l.teacherId === teacherId && l.status !== 'canceled' && l.start < start + minutes * MIN && lessonEnd(l) > start);

export const teacherById = (db: DB, id?: ID) => db.teachers.find(t => t.id === id);
export const leadById = (db: DB, id?: ID) => db.leads.find(l => l.id === id);
export const studentById = (db: DB, id?: ID) => db.students.find(s => s.id === id);
export const groupById = (db: DB, id?: ID) => db.groups.find(g => g.id === id);
