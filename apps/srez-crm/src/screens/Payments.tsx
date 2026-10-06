/* Оплаты: график рассрочки по всем участникам — что пришло, что ждём, что просрочено. */
import { useMemo, useState } from 'react';
import { Wallet, Receipt, Send, CalendarClock } from 'lucide-react';
import type { Installment } from '../domain/types';
import { METHOD_LABEL, TARIFF_SHORT } from '../domain/labels';
import { useDB, undo } from '../data/store';
import * as A from '../data/actions';
import { dueUntil, isLate, paidBetween } from '../data/selectors';
import { addDays, dateShort, plural, startOfDay } from '../lib/format';
import { Badge, Button, Card, Empty, Segmented, Stat, cx } from '../ui/kit';
import { toast } from '../ui/overlay';
import { useApp, can } from '../app/ctx';

const MONTHS_GEN = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const undoAction = { label: 'Отменить', run: () => { if (undo()) toast('Изменение отменено', { tone: 'info' }); } };

export function Payments() {
  const db = useDB();
  const { fmt, role, openModal, openDrawer } = useApp();
  const accept = can.acceptPayment(role);
  const [tab, setTab] = useState<'soon' | 'late' | 'log'>('soon');
  const now = new Date(), today0 = startOfDay(+now);
  const m0 = +new Date(now.getFullYear(), now.getMonth(), 1), m1 = +new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const alive = (i: Installment) => db.students.find(s => s.id === i.studentId)?.status !== 'left';
  const data = useMemo(() => {
    const unpaid = dueUntil(db, addDays(today0, 31)).filter(alive);
    const late = unpaid.filter(i => isLate(i));
    const paidMonth = paidBetween(db, m0, m1);
    const expectMonth = dueUntil(db, m1).filter(i => i.due >= m0 || isLate(i)).filter(alive);
    const log = db.installments.filter(i => i.paidAt && i.amount > 0 && i.paidAt >= addDays(m0, -31)).sort((a, b) => b.paidAt! - a.paidAt!);
    return { unpaid, late, paidMonth, expectMonth, log };
  }, [db, today0, m0, m1]); // eslint-disable-line react-hooks/exhaustive-deps
  const sum = (l: Installment[]) => l.reduce((s, i) => s + i.amount, 0);
  const list = tab === 'late' ? data.late : tab === 'soon' ? data.unpaid : data.log;

  return (
    <div className="grid grid-cols-1 gap-5">
      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          <Stat label={'Получено в ' + MONTHS_GEN[now.getMonth()]} value={fmt(sum(data.paidMonth))} sub={plural(data.paidMonth.length, 'платёж', 'платежа', 'платежей')} />
          <Stat label="Ждём до конца месяца" value={fmt(sum(data.expectMonth))} sub={plural(data.expectMonth.length, 'платёж', 'платежа', 'платежей')} />
          <Stat label="Просрочено" value={fmt(sum(data.late))} tone={data.late.length ? 'bad' : undefined} sub={data.late.length ? plural(new Set(data.late.map(i => i.studentId)).size, 'участник', 'участника', 'участников') : 'просрочек нет'} />
          <div className="flex items-end justify-start md:justify-end">{accept && <Button variant="primary" size="lg" icon={Wallet} onClick={() => openModal({ type: 'pay' })} className="max-md:w-full">Принять платёж</Button>}</div>
        </div>
      </Card>

      <Segmented value={tab} onChange={setTab} ariaLabel="Список" className="max-sm:w-full sm:justify-self-start" options={[
        { value: 'soon', label: 'Ближайшие 30 дней' }, { value: 'late', label: `Просрочки ${data.late.length || ''}` }, { value: 'log', label: 'Журнал' },
      ]} />

      <div className="overflow-hidden rounded-[22px] border border-line bg-surface">
        {list.length ? (
          <ul className="divide-y divide-line">
            {list.map(i => {
              const st = db.students.find(s => s.id === i.studentId)!; const late = isLate(i);
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
                  <div className={cx('tnum w-16 shrink-0 text-[13px] max-sm:hidden', late ? 'font-medium text-bad' : 'text-ink-3')}>{dateShort(i.paidAt || i.due)}</div>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDrawer({ type: 'student', id: st.id })}>
                    <div className="truncate text-sm font-medium">{st.name}</div>
                    <div className="truncate text-xs text-ink-3"><span className={cx('sm:hidden', late && 'text-bad')}>{dateShort(i.paidAt || i.due)} · </span>{TARIFF_SHORT[st.tariff]} · {i.of > 1 ? `платёж ${i.n} из ${i.of}` : 'полная оплата'}{i.paidAt && i.method ? ' · ' + METHOD_LABEL[i.method] : ''}</div>
                  </button>
                  {late && <Badge tone="bad" className="max-sm:hidden">просрочен</Badge>}
                  <div className="tnum text-right text-sm font-semibold sm:w-24">{fmt(i.amount)}</div>
                  {!i.paidAt && accept && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" icon={Send} onClick={() => openModal({ type: 'message', to: { kind: 'student', id: st.id }, template: 'installment_due' })} aria-label="Напомнить" title="Напомнить" />
                      <Button variant="ghost" size="sm" icon={CalendarClock} onClick={() => { A.moveInstallment(i.id, 7); toast('Перенесли на неделю', { tone: 'info', action: undoAction }); }} aria-label="Перенести на неделю" title="Перенести на неделю" className="max-sm:hidden" />
                      <Button variant="soft" size="sm" icon={Wallet} onClick={() => openModal({ type: 'pay', studentId: st.id })}><span className="max-sm:hidden">Принять</span></Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <Empty icon={Receipt} title={tab === 'late' ? 'Просрочек нет' : tab === 'soon' ? 'В ближайший месяц платежей нет' : 'Платежей пока нет'} />}
      </div>
      <p className="text-xs text-ink-3">Рассрочка — 10 платежей без процентов, график строится при первой оплате. Платёж можно перенести на неделю — участник увидит новую дату в напоминании.</p>
    </div>
  );
}
