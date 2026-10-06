/* Подготовка сообщения по шаблону: имя, дата созвона, сумма платежа, срок пересдачи. */
import type { DB, ID, TemplateKey, Lead, Student } from '../domain/types';
import { fillTemplate, findTemplate } from '../lib/messaging';
import { moneyOf } from '../data/selectors';
import { addDays, dateShort, firstName, hm, money } from '../lib/format';

export interface Recipient { name: string; phone: string; lead?: Lead; student?: Student }

export function recipientOf(db: DB, to: { kind: 'lead' | 'student'; id: ID }): Recipient | null {
  if (to.kind === 'lead') { const l = db.leads.find(x => x.id === to.id); return l ? { name: l.name, phone: l.phone, lead: l } : null; }
  const s = db.students.find(x => x.id === to.id); return s ? { name: s.name, phone: s.phone, student: s } : null;
}

/** шаблон по умолчанию — по ситуации */
export function defaultTemplate(db: DB, r: Recipient): TemplateKey {
  if (r.lead) {
    const st = r.lead.status;
    if (st === 'call_booked') return 'call_reminder';
    if (st === 'call_done') return 'after_call';
    if (st === 'awaiting_payment') return 'payment_reminder';
    return 'greeting';
  }
  if (r.student && db.homework.some(h => h.studentId === r.student!.id && h.status === 'returned')) return 'homework_returned';
  return 'installment_due';
}

export function messageText(db: DB, r: Recipient, key: TemplateKey): string {
  const t = findTemplate(db.templates, key); if (!t) return '';
  const vars: Record<string, string> = { имя: firstName(r.name), курс: db.settings.courseName, сумма: money(r.lead?.tariff === 'self' ? db.settings.priceSelf : db.settings.priceLive) };
  if (r.lead?.callAt) { vars['дата'] = dateShort(r.lead.callAt); vars['время'] = hm(r.lead.callAt); }
  if (r.student) {
    const m = moneyOf(db, r.student.id);
    const due = m.late[0] || m.next;
    if (due) { vars['сумма'] = money(m.late.length ? m.late.reduce((s, i) => s + i.amount, 0) : due.amount); vars['дата'] = dateShort(due.due); }
    if (key === 'homework_returned') vars['дата'] = dateShort(addDays(Date.now(), 3));
  }
  return fillTemplate(t.text, vars);
}
