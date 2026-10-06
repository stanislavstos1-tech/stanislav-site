/* Вычисляемые данные: деньги по рассрочке, просрочки, очередь проверки домашек, прогресс по блокам.
   Ничего из этого не хранится отдельно — всё считается из платежей, домашек и заявок, поэтому не «разъезжается». */
import type { DB, Lead, Student, ID, Group, Installment, Homework, Lesson } from '../domain/types';
import { DAY, HOUR, MIN, addDays, startOfDay } from '../lib/format';

/* ---------- заявки ---------- */
export const isUnanswered = (l: Lead) => l.status === 'new' && !l.firstReplyAt;
export const isOverdue = (l: Lead, slaHours: number, now = Date.now()) => isUnanswered(l) && now - l.createdAt > slaHours * HOUR;
/** на доске: все открытые заявки + закрытые за последние 30 дней */
export const boardLeads = (db: DB, now = Date.now()) => db.leads.filter(l => (l.status !== 'paid' && l.status !== 'lost') || now - l.statusAt < 30 * DAY);
/** созвоны-консультации на день */
export const callsOn = (db: DB, day: number) => db.leads.filter(l => l.callAt && l.callAt >= day && l.callAt < addDays(day, 1) && (l.status === 'call_booked' || l.status === 'call_done')).sort((a, b) => a.callAt! - b.callAt!);

/* ---------- поток ---------- */
export const currentCohort = (db: DB, now = Date.now()) => db.cohorts.find(c => c.start <= now && c.end >= now) || db.cohorts[0];
export const nextCohort = (db: DB, now = Date.now()) => db.cohorts.filter(c => c.start > now).sort((a, b) => a.start - b.start)[0];
export const groupOf = (db: DB, sid: ID): Group | undefined => db.groups.find(g => g.studentIds.includes(sid));
export const curatorOf = (db: DB, sid: ID) => { const g = groupOf(db, sid); return g ? db.curators.find(c => c.id === g.curatorId) : undefined; };
export const cohortStudents = (db: DB, cohortId: ID) => db.students.filter(s => s.cohortId === cohortId);
export const lessonEnd = (l: Lesson) => l.start + l.duration * MIN;
export const lessonsOf = (db: DB, cohortId: ID) => db.lessons.filter(l => l.cohortId === cohortId).sort((a, b) => a.start - b.start);
export const nextLesson = (db: DB, cohortId: ID, now = Date.now()) => lessonsOf(db, cohortId).find(l => lessonEnd(l) > now);
/** номер текущего блока программы — по последнему прошедшему занятию */
export const currentBlock = (db: DB, cohortId: ID, now = Date.now()) => (lessonsOf(db, cohortId).filter(l => l.start < now).pop()?.block) || 1;

/* ---------- домашки ---------- */
export const homeworkOf = (db: DB, sid: ID) => db.homework.filter(h => h.studentId === sid).sort((a, b) => a.block - b.block);
/** очередь куратора: работы на проверке, старые — сверху */
export function reviewQueue(db: DB, curatorId?: ID): Homework[] {
  const mine = curatorId ? new Set(db.groups.filter(g => g.curatorId === curatorId).flatMap(g => g.studentIds)) : null;
  return db.homework.filter(h => h.status === 'submitted' && (!mine || mine.has(h.studentId))).sort((a, b) => a.submittedAt - b.submittedAt);
}
export const isReviewLate = (h: Homework, days: number, now = Date.now()) => h.status === 'submitted' && now - h.submittedAt > days * DAY;
/** принятых блоков из шести */
export const progress = (db: DB, sid: ID) => db.homework.filter(h => h.studentId === sid && h.status === 'accepted').length;
/** кто из живого потока не сдал работу по текущему блоку */
export function notSubmitted(db: DB, cohortId: ID, block: number): Student[] {
  return db.students.filter(s => s.cohortId === cohortId && s.tariff === 'live' && s.status === 'active' && !db.homework.some(h => h.studentId === s.id && h.block === block));
}

/* ---------- деньги ---------- */
export const plan = (db: DB, sid: ID): Installment[] => db.installments.filter(i => i.studentId === sid).sort((a, b) => a.n - b.n);
export const isLate = (i: Installment, now = Date.now()) => !i.paidAt && i.due < startOfDay(now);
export interface Money { total: number; paid: number; left: number; late: Installment[]; next?: Installment; installments: boolean }
export function moneyOf(db: DB, sid: ID, now = Date.now()): Money {
  const p = plan(db, sid);
  const paid = p.filter(i => i.paidAt).reduce((s, i) => s + i.amount, 0);
  const total = p.reduce((s, i) => s + i.amount, 0);
  return { total, paid, left: total - paid, late: p.filter(i => isLate(i, now)), next: p.find(i => !i.paidAt), installments: p.length > 1 };
}
/** все неоплаченные платежи с датой до to — для экрана «Оплаты» */
export const dueUntil = (db: DB, to: number) => db.installments.filter(i => !i.paidAt && i.amount > 0 && i.due < to).sort((a, b) => a.due - b.due);
export const paidBetween = (db: DB, from: number, to: number) => db.installments.filter(i => i.paidAt && i.amount > 0 && i.paidAt >= from && i.paidAt < to);

export const leadById = (db: DB, id?: ID) => db.leads.find(l => l.id === id);
export const studentById = (db: DB, id?: ID) => db.students.find(s => s.id === id);
export const curatorById = (db: DB, id?: ID) => db.curators.find(c => c.id === id);
