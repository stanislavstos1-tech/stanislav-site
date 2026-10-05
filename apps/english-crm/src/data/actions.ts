/* Действия пользователя. Каждое — одна понятная операция, которая меняет данные и пишет историю.
   При переходе на сервер эти функции станут вызовами API — экраны менять не придётся. */
import type { Channel, DB, ID, LeadStatus, LessonKind, LostReason, PayMethod, Settings, MessageTemplate, Teacher, AttendanceMark, StudentStatus, Level } from '../domain/types';
import { STATUS_LABEL, LOST_LABEL, METHOD_LABEL } from '../domain/labels';
import { update, uid } from './store';
import { DAY, dateFull } from '../lib/format';
import { prettyPhone } from '../lib/phone';

let me: ID = 'u-admin';
export const setActor = (id: ID) => (me = id);

const lead = (d: DB, id: ID) => { const l = d.leads.find(x => x.id === id); if (!l) throw new Error('lead'); return l; };
const log = (d: DB, leadId: ID, text: string) => { const l = lead(d, leadId); l.history.unshift({ at: Date.now(), text, by: me }); };

/* ---------- заявки ---------- */
export function addLead(p: { name: string; phone: string; channel: Channel; comment?: string; source?: string }) {
  const id = uid('ld');
  update(d => {
    const now = Date.now();
    d.leads.unshift({
      id, name: p.name.trim(), phone: prettyPhone(p.phone), channel: p.channel, source: p.source || 'Добавлено вручную', comment: p.comment?.trim() || '',
      createdAt: now, status: 'new', statusAt: now, managerId: me, history: [{ at: now, text: 'Заявка добавлена вручную', by: me }],
    });
  });
  return id;
}

export function setLeadStatus(id: ID, status: LeadStatus) {
  update(d => {
    const l = lead(d, id); if (l.status === status) return;
    if (!l.firstReplyAt && status !== 'new') l.firstReplyAt = Date.now();
    l.status = status; l.statusAt = Date.now();
    if (status !== 'lost') { l.lostReason = undefined; l.lostComment = undefined; }
    log(d, id, 'Статус → ' + STATUS_LABEL[status]);
  }, { undoable: true });
}

/** «написали / позвонили» — снимает подсветку «без ответа» */
export function markReplied(id: ID, how = 'Написали клиенту') {
  update(d => {
    const l = lead(d, id);
    if (!l.firstReplyAt) l.firstReplyAt = Date.now();
    if (l.status === 'new') { l.status = 'contacted'; l.statusAt = Date.now(); }
    log(d, id, how);
  }, { undoable: true });
}

export function loseLead(id: ID, reason: LostReason, comment = '') {
  update(d => {
    const l = lead(d, id);
    l.status = 'lost'; l.statusAt = Date.now(); l.lostReason = reason; l.lostComment = comment.trim();
    if (!l.firstReplyAt) l.firstReplyAt = Date.now();
    // отменяем будущий пробный, если был
    const tr = d.lessons.find(x => x.id === l.trialLessonId && x.status === 'planned' && x.start > Date.now());
    if (tr) { tr.status = 'canceled'; tr.cancelReason = 'Отказ клиента'; }
    log(d, id, 'Отказ: ' + LOST_LABEL[reason] + (comment ? ' — ' + comment : ''));
  }, { undoable: true });
}

export function addLeadNote(id: ID, text: string) {
  update(d => log(d, id, text.trim()));
}

export function bookTrial(leadId: ID, teacherId: ID, start: number, duration = 45) {
  update(d => {
    const l = lead(d, leadId);
    const old = d.lessons.find(x => x.id === l.trialLessonId && x.status === 'planned');
    if (old) { old.status = 'canceled'; old.cancelReason = 'Перенесли пробный'; }
    const lessonId = uid('l');
    d.lessons.push({ id: lessonId, kind: 'trial', teacherId, start, duration, status: 'planned', leadId, attendance: {} });
    l.trialLessonId = lessonId;
    if (!l.firstReplyAt) l.firstReplyAt = Date.now();
    l.status = 'trial_booked'; l.statusAt = Date.now();
    const t = d.teachers.find(t => t.id === teacherId);
    log(d, leadId, `Назначен пробный: ${dateFull(start)}, ${t?.name ?? ''}`);
  }, { undoable: true });
}

/** итог пробного: пришёл → «Пробный прошёл», не пришёл → обратно в «Связались» (перезаписать) */
export function trialResult(leadId: ID, came: boolean) {
  update(d => {
    const l = lead(d, leadId);
    const tr = d.lessons.find(x => x.id === l.trialLessonId);
    if (tr) { tr.status = came ? 'done' : 'canceled'; if (!came) tr.cancelReason = 'Не пришёл'; }
    l.status = came ? 'trial_done' : 'contacted'; l.statusAt = Date.now();
    log(d, leadId, came ? 'Пробный прошёл' : 'Не пришёл на пробный — нужно перезаписать');
  }, { undoable: true });
}

/** оплата по заявке: создаём ученика (и плательщика), абонемент, платёж, добавляем в группу или ставим индивидуальные */
export function convertLead(p: {
  leadId: ID; studentName: string; forChild: boolean; payerName: string; level: Level;
  packageTypeId: ID; amount: number; method: PayMethod; groupId?: ID;
  individual?: { teacherId: ID; weekday: number; time: string; firstStart: number };
}) {
  const studentId = uid('s');
  update(d => {
    const l = lead(d, p.leadId);
    const now = Date.now();
    const payerId = uid('py');
    d.payers.push({ id: payerId, name: p.forChild ? p.payerName.trim() || 'Родитель' : p.studentName.trim(), phone: l.phone, relation: p.forChild ? 'mother' : 'self' });
    d.students.push({
      id: studentId, name: p.studentName.trim(), phone: p.forChild ? '' : l.phone, level: p.level, payerId, status: 'active', createdAt: now, note: l.comment ? 'Из заявки: ' + l.comment : '', leadId: l.id,
      preferredChannel: l.channel === 'whatsapp' || l.channel === 'telegram' ? l.channel : 'telegram',
    });
    const pt = d.packageTypes.find(x => x.id === p.packageTypeId)!;
    const paymentId = uid('pay'), subId = uid('sub');
    d.payments.push({ id: paymentId, studentId, payerId, amount: p.amount, method: p.method, at: now, subscriptionId: subId, comment: 'Первая оплата', by: me });
    d.subscriptions.push({ id: subId, studentId, packageTypeId: pt.id, title: pt.title, lessons: pt.lessons, price: p.amount, purchasedAt: now, paymentId });
    if (p.groupId) { const g = d.groups.find(g => g.id === p.groupId); if (g && !g.studentIds.includes(studentId)) g.studentIds.push(studentId); }
    if (p.individual) {
      const seriesId = uid('sr');
      for (let w = 0; w < 12; w++) d.lessons.push({ id: uid('l'), kind: 'individual', teacherId: p.individual.teacherId, start: p.individual.firstStart + w * 7 * DAY, duration: 60, status: 'planned', studentId, seriesId, attendance: {} });
    }
    l.status = 'paid'; l.statusAt = now; l.studentId = studentId;
    const g = p.groupId ? d.groups.find(g => g.id === p.groupId)?.name : p.individual ? 'индивидуально' : '';
    log(d, l.id, `Оплатил ${pt.title} (${METHOD_LABEL[p.method]})${g ? ' · ' + g : ''}`);
  }, { undoable: true });
  return studentId;
}

/* ---------- оплаты ---------- */
export function acceptPayment(p: { studentId: ID; packageTypeId: ID; amount: number; method: PayMethod; comment?: string }) {
  update(d => {
    const s = d.students.find(s => s.id === p.studentId)!;
    const pt = d.packageTypes.find(x => x.id === p.packageTypeId)!;
    const now = Date.now(), paymentId = uid('pay'), subId = uid('sub');
    d.payments.push({ id: paymentId, studentId: s.id, payerId: s.payerId, amount: p.amount, method: p.method, at: now, subscriptionId: subId, comment: p.comment || '', by: me });
    d.subscriptions.push({ id: subId, studentId: s.id, packageTypeId: pt.id, title: pt.title, lessons: pt.lessons, price: p.amount, purchasedAt: now, paymentId });
    if (s.status === 'paused') s.status = 'active';
  }, { undoable: true });
}

/* ---------- занятия ---------- */
export function markAttendance(lessonId: ID, marks: Record<ID, AttendanceMark>) {
  update(d => {
    const l = d.lessons.find(x => x.id === lessonId)!;
    l.attendance = { ...marks }; l.status = 'done';
  }, { undoable: true });
}

export function createLessons(p: { kind: LessonKind; teacherId: ID; start: number; duration: number; groupId?: ID; studentId?: ID; leadId?: ID; repeatWeeks: number }) {
  update(d => {
    const seriesId = p.repeatWeeks > 1 ? uid('sr') : undefined;
    for (let w = 0; w < Math.max(1, p.repeatWeeks); w++) {
      d.lessons.push({ id: uid('l'), kind: p.kind, teacherId: p.teacherId, start: p.start + w * 7 * DAY, duration: p.duration, status: 'planned', groupId: p.groupId, studentId: p.studentId, leadId: p.leadId, seriesId, attendance: {} });
    }
    if (p.kind === 'trial' && p.leadId) {
      const l = lead(d, p.leadId); const tr = d.lessons[d.lessons.length - 1];
      l.trialLessonId = tr.id; l.status = 'trial_booked'; l.statusAt = Date.now(); if (!l.firstReplyAt) l.firstReplyAt = Date.now();
      log(d, l.id, 'Назначен пробный: ' + dateFull(p.start));
    }
  }, { undoable: true });
}

/** перенос: одно занятие или это и все следующие в серии (сдвиг на ту же разницу) */
export function moveLesson(id: ID, newStart: number, scope: 'one' | 'future' = 'one', teacherId?: ID) {
  update(d => {
    const l = d.lessons.find(x => x.id === id)!;
    const delta = newStart - l.start;
    const list = scope === 'future' && l.seriesId ? d.lessons.filter(x => x.seriesId === l.seriesId && x.start >= l.start && x.status === 'planned') : [l];
    // перенос уже прошедшего занятия (ученик не пришёл): отметку снимаем, урок снова запланирован и не списывается
    list.forEach(x => { if (!x.movedFrom) x.movedFrom = x.start; x.start += delta; if (teacherId) x.teacherId = teacherId; if (x.status === 'done') { x.status = 'planned'; x.attendance = {}; } });
    if (l.kind === 'trial' && l.leadId) log(d, l.leadId, 'Пробный перенесён на ' + dateFull(newStart));
  }, { undoable: true });
}

export function cancelLesson(id: ID, reason: string, scope: 'one' | 'future' = 'one') {
  update(d => {
    const l = d.lessons.find(x => x.id === id)!;
    const list = scope === 'future' && l.seriesId ? d.lessons.filter(x => x.seriesId === l.seriesId && x.start >= l.start && x.status === 'planned') : [l];
    list.forEach(x => { x.status = 'canceled'; x.cancelReason = reason; });
    if (l.kind === 'trial' && l.leadId) log(d, l.leadId, 'Пробный отменён: ' + reason);
  }, { undoable: true });
}

export function restoreLesson(id: ID) {
  update(d => { const l = d.lessons.find(x => x.id === id)!; l.status = 'planned'; l.cancelReason = undefined; }, { undoable: true });
}

/* ---------- ученики и группы ---------- */
export function setStudentGroup(studentId: ID, groupId: ID | null, fromGroupId?: ID) {
  update(d => {
    if (fromGroupId) { const g = d.groups.find(g => g.id === fromGroupId); if (g) g.studentIds = g.studentIds.filter(x => x !== studentId); }
    if (groupId) { const g = d.groups.find(g => g.id === groupId); if (g && !g.studentIds.includes(studentId)) g.studentIds.push(studentId); }
  }, { undoable: true });
}

export function setStudentStatus(studentId: ID, status: StudentStatus, reason = '') {
  update(d => {
    const s = d.students.find(s => s.id === studentId)!;
    s.status = status;
    if (status === 'left') { s.leftAt = Date.now(); s.leftReason = reason || 'Не указана'; d.groups.forEach(g => (g.studentIds = g.studentIds.filter(x => x !== studentId))); }
    else { s.leftAt = undefined; s.leftReason = undefined; }
  }, { undoable: true });
}

export function updateStudent(studentId: ID, patch: { note?: string; level?: Level; name?: string }) {
  update(d => { Object.assign(d.students.find(s => s.id === studentId)!, patch); });
}

/* ---------- напоминания (задачи) ---------- */
export function addTask(p: { title: string; due: number; leadId?: ID; studentId?: ID }) {
  update(d => { d.tasks.push({ id: uid('tk'), title: p.title.trim(), due: p.due, done: false, leadId: p.leadId, studentId: p.studentId, assigneeId: me }); });
}
export function moveTask(id: ID, due: number) {
  update(d => { const t = d.tasks.find(t => t.id === id)!; t.due = due; }, { undoable: true });
}
export function deleteTask(id: ID) {
  update(d => { d.tasks = d.tasks.filter(t => t.id !== id); }, { undoable: true });
}
export function toggleTask(id: ID) {
  update(d => { const t = d.tasks.find(t => t.id === id)!; t.done = !t.done; t.doneAt = t.done ? Date.now() : undefined; }, { undoable: true });
}

/* ---------- настройки ---------- */
export function saveSettings(patch: Partial<Settings>) { update(d => { d.settings = { ...d.settings, ...patch }; }); }
export function saveTemplate(t: MessageTemplate) { update(d => { const x = d.templates.find(x => x.key === t.key); if (x) Object.assign(x, t); }); }
export function saveTeacher(id: ID, patch: Partial<Teacher>) { update(d => { Object.assign(d.teachers.find(t => t.id === id)!, patch); }); }
