/* Действия пользователя. Каждое — одна понятная операция, которая меняет данные и пишет историю.
   При переходе на сервер эти функции станут вызовами API — экраны менять не придётся. */
import type { Channel, DB, ID, LeadStatus, LostReason, PayMethod, Settings, MessageTemplate, StudentStatus, Tariff, Track, PayPlan, Experience } from '../domain/types';
import { STATUS_LABEL, LOST_LABEL, METHOD_LABEL, TARIFF_LABEL } from '../domain/labels';
import { update, uid } from './store';
import { DAY, addDays, dateFull, money } from '../lib/format';
import { prettyPhone } from '../lib/phone';

let me: ID = 'u-admin';
export const setActor = (id: ID) => (me = id);

const lead = (d: DB, id: ID) => { const l = d.leads.find(x => x.id === id); if (!l) throw new Error('lead'); return l; };
const log = (d: DB, leadId: ID, text: string) => { lead(d, leadId).history.unshift({ at: Date.now(), text, by: me }); };

/* ---------- заявки ---------- */
export function addLead(p: { name: string; phone: string; channel: Channel; comment?: string; tariff: Tariff; experience: Experience }) {
  const id = uid('ld'), now = Date.now();
  update(d => {
    d.leads.unshift({ id, name: p.name.trim(), phone: prettyPhone(p.phone), channel: p.channel, source: 'Добавлена вручную', comment: (p.comment || '').trim(), tariff: p.tariff, experience: p.experience,
      createdAt: now, status: 'new', statusAt: now, managerId: me, history: [{ at: now, text: 'Заявка добавлена вручную', by: me }] });
  });
  return id;
}

export function setLeadStatus(id: ID, status: LeadStatus) {
  update(d => {
    const l = lead(d, id), now = Date.now();
    if (status === 'contacted' && !l.firstReplyAt) l.firstReplyAt = now;
    l.status = status; l.statusAt = now;
    log(d, id, 'Этап: ' + STATUS_LABEL[status]);
  }, { undoable: true });
}

export function markReplied(id: ID, how = 'Написали клиенту') {
  update(d => {
    const l = lead(d, id), now = Date.now();
    if (!l.firstReplyAt) l.firstReplyAt = now;
    if (l.status === 'new') { l.status = 'contacted'; l.statusAt = now; }
    log(d, id, how);
  });
}

export function loseLead(id: ID, reason: LostReason, comment = '') {
  update(d => {
    const l = lead(d, id);
    l.status = 'lost'; l.statusAt = Date.now(); l.lostReason = reason; l.lostComment = comment.trim() || undefined;
    log(d, id, 'Отказ: ' + LOST_LABEL[reason] + (comment.trim() ? ' — ' + comment.trim() : ''));
  }, { undoable: true });
}

export function addLeadNote(id: ID, text: string) { update(d => log(d, id, text.trim())); }

export function bookCall(id: ID, at: number) {
  update(d => {
    const l = lead(d, id), now = Date.now();
    if (!l.firstReplyAt) l.firstReplyAt = now;
    l.callAt = at; l.status = 'call_booked'; l.statusAt = now;
    log(d, id, 'Назначен созвон: ' + dateFull(at));
  }, { undoable: true });
}

export function callResult(id: ID, came: boolean) {
  update(d => {
    const l = lead(d, id);
    if (came) { l.status = 'call_done'; l.statusAt = Date.now(); log(d, id, 'Созвон прошёл'); }
    else { l.status = 'contacted'; l.statusAt = Date.now(); log(d, id, 'Не вышел на созвон — договориться о новом времени'); }
  }, { undoable: true });
}

/** оплата: заявка становится участником потока, создаётся график платежей */
export function convertLead(p: { leadId: ID; cohortId: ID; tariff: Tariff; track: Track; plan: PayPlan; method: PayMethod; groupId?: ID; company: string; position: string; firstAmount: number }) {
  const sid = uid('s'), now = Date.now();
  update(d => {
    const l = lead(d, p.leadId);
    const total = p.tariff === 'live' ? d.settings.priceLive : d.settings.priceSelf;
    d.students.push({ id: sid, name: l.name, phone: l.phone, position: p.position.trim() || l.position || '—', company: p.company.trim() || '—', tariff: p.tariff, track: p.track, cohortId: p.cohortId, status: 'active', createdAt: now, note: l.comment ? 'Из заявки: ' + l.comment : '', leadId: l.id });
    if (p.plan === 'full') d.installments.push({ id: uid('i'), studentId: sid, n: 1, of: 1, due: now, amount: total, paidAt: now, method: p.method });
    else {
      const k = d.settings.installments, part = Math.round(total / k);
      for (let i = 0; i < k; i++) d.installments.push({ id: uid('i'), studentId: sid, n: i + 1, of: k, due: addDays(now, i * 30), amount: i === k - 1 ? total - part * (k - 1) : part, paidAt: i === 0 ? now : undefined, method: i === 0 ? p.method : undefined });
    }
    if (p.groupId && p.tariff === 'live') d.groups.find(g => g.id === p.groupId)?.studentIds.push(sid);
    l.status = 'paid'; l.statusAt = now; l.studentId = sid;
    log(d, l.id, `Оплата ${money(p.firstAmount)} · ${TARIFF_LABEL[p.tariff]} · ${p.plan === 'full' ? 'сразу' : 'рассрочка'} · ${METHOD_LABEL[p.method]}`);
  }, { undoable: true });
  return sid;
}

/* ---------- деньги ---------- */
export function payInstallment(id: ID, method: PayMethod) {
  update(d => { const i = d.installments.find(x => x.id === id)!; i.paidAt = Date.now(); i.method = method; }, { undoable: true });
}
export function moveInstallment(id: ID, days: number) {
  update(d => { const i = d.installments.find(x => x.id === id)!; i.due = Math.max(i.due, Date.now()) + days * DAY; }, { undoable: true });
}

/* ---------- домашки ---------- */
export function acceptHomework(id: ID) {
  update(d => { const h = d.homework.find(x => x.id === id)!; h.status = 'accepted'; h.reviewedAt = Date.now(); h.comment = undefined; }, { undoable: true });
}
export function returnHomework(id: ID, comment: string) {
  update(d => { const h = d.homework.find(x => x.id === id)!; h.status = 'returned'; h.reviewedAt = Date.now(); h.comment = comment.trim(); }, { undoable: true });
}

/* ---------- участники ---------- */
export function setStudentStatus(id: ID, status: StudentStatus, reason = '') {
  update(d => {
    const s = d.students.find(x => x.id === id)!;
    s.status = status;
    if (status === 'left') { s.leftAt = Date.now(); s.leftReason = reason || 'Не указана'; d.groups.forEach(g => { g.studentIds = g.studentIds.filter(x => x !== id); }); }
    else { s.leftAt = undefined; s.leftReason = undefined; }
  }, { undoable: true });
}
export function setStudentGroup(id: ID, groupId: ID | null) {
  update(d => { d.groups.forEach(g => { g.studentIds = g.studentIds.filter(x => x !== id); }); if (groupId) d.groups.find(g => g.id === groupId)!.studentIds.push(id); }, { undoable: true });
}
export function updateStudent(id: ID, patch: { note?: string }) { update(d => { Object.assign(d.students.find(x => x.id === id)!, patch); }); }

/* ---------- напоминания ---------- */
export function addTask(p: { title: string; due: number; leadId?: ID; studentId?: ID }) {
  update(d => { d.tasks.push({ id: uid('tk'), title: p.title.trim(), due: p.due, done: false, leadId: p.leadId, studentId: p.studentId, assigneeId: me }); });
}
export function moveTask(id: ID, due: number) { update(d => { d.tasks.find(t => t.id === id)!.due = due; }, { undoable: true }); }
export function deleteTask(id: ID) { update(d => { d.tasks = d.tasks.filter(t => t.id !== id); }, { undoable: true }); }
export function toggleTask(id: ID) {
  update(d => { const t = d.tasks.find(t => t.id === id)!; t.done = !t.done; t.doneAt = t.done ? Date.now() : undefined; }, { undoable: true });
}

/* ---------- настройки ---------- */
export function saveSettings(patch: Partial<Settings>) { update(d => { d.settings = { ...d.settings, ...patch }; }); }
export function saveTemplate(t: MessageTemplate) { update(d => { const x = d.templates.find(x => x.key === t.key); if (x) Object.assign(x, t); }); }
