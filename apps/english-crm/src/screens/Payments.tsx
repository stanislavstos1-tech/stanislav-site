/* Оплаты: журнал и должники. Остаток уроков считается сам из оплат и посещаемости. */
import { useMemo, useState } from 'react';
import { Wallet, CircleDollarSign, Receipt, Send } from 'lucide-react';
import { METHOD_LABEL } from '../domain/labels';
import { useDB } from '../data/store';
import { balanceMap, contactPhone, studentGroups } from '../data/selectors';
import { MONTHS, dateShort, plural } from '../lib/format';
import { Badge, Button, Card, Empty, Segmented, Stat } from '../ui/kit';
import { useApp, can } from '../app/ctx';

type Period = 'month' | 'prev' | 'q';

export function Payments() {
  const db = useDB();
  const { fmt, role, openModal, openDrawer } = useApp();
  const [tab, setTab] = useState<'log' | 'debt'>('log');
  const [period, setPeriod] = useState<Period>('month');
  const bal = useMemo(() => balanceMap(db), [db]);
  const now = new Date();
  const m0 = +new Date(now.getFullYear(), now.getMonth(), 1), pm0 = +new Date(now.getFullYear(), now.getMonth() - 1, 1), q0 = +new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const [from, to] = period === 'month' ? [m0, Infinity] : period === 'prev' ? [pm0, m0] : [q0, Infinity];
  const inPeriod = db.payments.filter(p => p.at >= from && p.at < to);
  const list = inPeriod.slice().sort((a, b) => b.at - a.at);
  const total = inPeriod.reduce((s, p) => s + p.amount, 0);
  const prevTotal = db.payments.filter(p => p.at >= pm0 && p.at < m0).reduce((s, p) => s + p.amount, 0);
  const debtors = db.students.filter(s => s.status !== 'left' && bal.get(s.id)!.left < 0).sort((a, b) => bal.get(b.id)!.debt - bal.get(a.id)!.debt);
  const debtSum = debtors.reduce((s, x) => s + bal.get(x.id)!.debt, 0);
  const accept = can.acceptPayment(role);
  const label = period === 'month' ? MONTHS[now.getMonth()].toLowerCase() : period === 'prev' ? MONTHS[(now.getMonth() + 11) % 12].toLowerCase() : '3 месяца';

  return (
    <div className="grid grid-cols-1 gap-5">
      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          <Stat label={'Получено за ' + label} value={fmt(total)} sub={period === 'month' && prevTotal ? `в прошлом месяце ${fmt(prevTotal)}` : plural(inPeriod.length, 'оплата', 'оплаты', 'оплат')} />
          <Stat label="Оплат" value={inPeriod.length} sub={inPeriod.length ? 'средний чек ' + fmt(Math.round(total / inPeriod.length)) : '—'} />
          <Stat label="Долги" value={fmt(debtSum)} tone={debtSum ? 'bad' : undefined} sub={plural(debtors.length, 'ученик', 'ученика', 'учеников')} />
          <div className="flex items-end justify-start md:justify-end">{accept && <Button variant="primary" size="lg" icon={Wallet} onClick={() => openModal({ type: 'payment' })} className="max-md:w-full">Принять оплату</Button>}</div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'log', label: 'Журнал' }, { value: 'debt', label: `Должники ${debtors.length || ''}` }]} className="max-sm:w-full" />
        {tab === 'log' && <Segmented size="sm" value={period} onChange={setPeriod} options={[{ value: 'month', label: 'Этот месяц' }, { value: 'prev', label: 'Прошлый' }, { value: 'q', label: '3 месяца' }]} className="ml-auto max-sm:ml-0 max-sm:w-full" />}
      </div>

      {tab === 'log' && (
        <>
          <div className="overflow-hidden rounded-[16px] border border-line bg-surface shadow-card">
            {list.length ? (
              <ul className="divide-y divide-line">
                {list.map(p => {
                  const s = db.students.find(x => x.id === p.studentId); const sub = db.subscriptions.find(x => x.id === p.subscriptionId);
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <div className="tnum w-14 shrink-0 text-[13px] text-ink-3">{dateShort(p.at)}</div>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => s && openDrawer({ type: 'student', id: s.id })}>
                        <div className="truncate text-sm font-medium">{s?.name}</div>
                        <div className="truncate text-xs text-ink-3">{sub?.title}{p.comment ? ' · ' + p.comment : ''}</div>
                      </button>
                      <Badge className="max-sm:hidden">{METHOD_LABEL[p.method]}</Badge>
                      <div className="tnum w-28 text-right text-sm font-semibold">{fmt(p.amount)}</div>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty icon={Receipt} title="Оплат за этот период нет" />}
          </div>
        </>
      )}

      {tab === 'debt' && (
        <div className="overflow-hidden rounded-[16px] border border-line bg-surface shadow-card">
          {debtors.length ? (
            <ul className="divide-y divide-line">
              {debtors.map(s => { const b = bal.get(s.id)!; return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDrawer({ type: 'student', id: s.id })}>
                    <div className="truncate text-sm font-medium">{s.name}</div>
                    <div className="truncate text-xs text-ink-3">{studentGroups(db, s.id)[0]?.name || 'Индивидуально'} · {plural(-b.left, 'урок', 'урока', 'уроков')} без оплаты{b.lastPaymentAt ? ' · последняя оплата ' + dateShort(b.lastPaymentAt) : ''}</div>
                  </button>
                  <div className="tnum text-right text-sm font-semibold text-bad">{fmt(b.debt)}</div>
                  {accept && <Button variant="ghost" size="sm" icon={Send} onClick={() => openModal({ type: 'message', to: { kind: 'student', id: s.id }, template: 'payment_reminder' })} aria-label="Напомнить" title="Напомнить об оплате" disabled={!contactPhone(db, s)} />}
                  {accept && <Button variant="soft" size="sm" icon={Wallet} onClick={() => openModal({ type: 'payment', studentId: s.id })}><span className="max-sm:hidden">Принять</span></Button>}
                </li>
              ); })}
            </ul>
          ) : <Empty icon={CircleDollarSign} title="Должников нет">Ученик становится должником, если посетил больше занятий, чем оплатил.</Empty>}
        </div>
      )}

    </div>
  );
}
