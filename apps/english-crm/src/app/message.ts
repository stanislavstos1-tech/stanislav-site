/* Подготовка сообщения клиенту по шаблону: подставляем имя, дату пробного, сумму, остаток уроков. */
import type { DB, ID, TemplateKey, Lead, Student } from '../domain/types';
import { fillTemplate, findTemplate, chatChannel } from '../lib/messaging';
import { balanceMap, contactPhone, payerOf } from '../data/selectors';
import { dateShort, firstName, hm, money } from '../lib/format';

export interface Recipient { name: string; phone: string; channel: 'whatsapp' | 'telegram'; lead?: Lead; student?: Student }

export function recipientOf(db: DB, to: { kind: 'lead' | 'student'; id: ID }): Recipient | null {
  if (to.kind === 'lead') {
    const l = db.leads.find(x => x.id === to.id); if (!l) return null;
    return { name: l.name, phone: l.phone, channel: chatChannel(l.channel, db.settings), lead: l };
  }
  const s = db.students.find(x => x.id === to.id); if (!s) return null;
  const p = payerOf(db, s);
  return { name: p && p.relation !== 'self' ? p.name : s.name, phone: contactPhone(db, s), channel: chatChannel(s.preferredChannel, db.settings), student: s };
}

/** шаблон по умолчанию — по ситуации клиента */
export function defaultTemplate(db: DB, r: Recipient): TemplateKey {
  if (r.lead) {
    const st = r.lead.status;
    if (st === 'trial_booked') return 'trial_reminder';
    if (st === 'trial_done') return 'after_trial';
    if (st === 'awaiting_payment') return 'payment_reminder';
    return 'greeting';
  }
  const b = r.student && balanceMap(db).get(r.student.id);
  if (b && b.left < 0) return 'payment_reminder';
  return 'low_balance';
}

export function messageText(db: DB, r: Recipient, key: TemplateKey): string {
  const t = findTemplate(db.templates, key); if (!t) return '';
  const vars: Record<string, string | number> = { имя: firstName(r.name), школа: db.settings.schoolName };
  if (r.lead?.trialLessonId) {
    const tr = db.lessons.find(l => l.id === r.lead!.trialLessonId);
    if (tr) { vars['дата'] = dateShort(tr.start); vars['время'] = hm(tr.start); }
  }
  if (r.student) {
    const b = balanceMap(db).get(r.student.id);
    if (b) { vars['уроков'] = Math.max(0, b.left); vars['сумма'] = money(b.debt || b.pricePerLesson * 8, db.settings); }
  } else {
    vars['сумма'] = money(db.packageTypes[0].price, db.settings);
  }
  return fillTemplate(t.text, vars);
}
