/* Отчёты для владельца: крупные цифры и несколько простых графиков. Без перегруза. */
import { useMemo, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import type { Channel, Lead, LostReason } from '../domain/types';
import { CHANNEL_LABEL, LOST_LABEL } from '../domain/labels';
import { useDB } from '../data/store';
import { DAY, MONTHS, plural } from '../lib/format';
import { Badge, Card, Segmented, Stat, cx } from '../ui/kit';
import { CHANNEL_ICON } from '../ui/domain';
import { useApp } from '../app/ctx';

type Period = 30 | 90 | 180;

/** до какого этапа дошла заявка (по фактам, а не по текущему статусу) */
function reached(l: Lead) {
  const paid = l.status === 'paid';
  const call = paid || !!l.callAt || l.status === 'call_booked' || l.status === 'call_done' || l.status === 'awaiting_payment';
  const callDone = paid || l.status === 'call_done' || l.status === 'awaiting_payment' || l.history.some(h => h.text.startsWith('Созвон прошёл'));
  const contacted = call || !!l.firstReplyAt || l.status !== 'new';
  return { contacted, call, callDone, paid };
}

export function Reports() { return <SchoolReport />; }

function SchoolReport() {
  const db = useDB();
  const { fmt, fmtShort } = useApp();
  const [period, setPeriod] = useState<Period>(90);
  const now = Date.now(), from = now - period * DAY, prevFrom = from - period * DAY;

  const r = useMemo(() => {
    const leads = db.leads.filter(l => l.createdAt >= from);
    const prevLeads = db.leads.filter(l => l.createdAt >= prevFrom && l.createdAt < from);
    const reach = leads.map(l => ({ l, ...reached(l) }));
    const funnel = [
      { label: 'Заявки', n: leads.length },
      { label: 'Связались', n: reach.filter(x => x.contacted).length },
      { label: 'Назначили созвон', n: reach.filter(x => x.call).length },
      { label: 'Созвон прошёл', n: reach.filter(x => x.callDone).length },
      { label: 'Оплатили', n: reach.filter(x => x.paid).length },
    ];
    const chans = (Object.keys(CHANNEL_LABEL) as Channel[]).map(c => {
      const xs = reach.filter(x => x.l.channel === c);
      return { c, n: xs.length, trial: xs.filter(x => x.callDone).length, paid: xs.filter(x => x.paid).length };
    }).filter(x => x.n > 0).sort((a, b) => b.paid / Math.max(1, b.n) - a.paid / Math.max(1, a.n));
    const best = chans.filter(c => c.n >= 5)[0];
    // выручка по месяцам — последние 6
    const d = new Date();
    const months = [...Array(6)].map((_, i) => { const m0 = new Date(d.getFullYear(), d.getMonth() - 5 + i, 1); const m1 = new Date(d.getFullYear(), d.getMonth() - 4 + i, 1); return { label: MONTHS[m0.getMonth()], m0: +m0, m1: +m1, current: i === 5 }; });
    const revenue = months.map(m => ({ ...m, v: db.installments.filter(p => p.paidAt && p.paidAt >= m.m0 && p.paidAt < m.m1).reduce((s, p) => s + p.amount, 0) }));
    const churn = months.map(m => {
      const left = db.students.filter(s => s.leftAt && s.leftAt >= m.m0 && s.leftAt < m.m1).length;
      const base = db.students.filter(s => s.createdAt < m.m0 && (!s.leftAt || s.leftAt >= m.m0)).length;
      return { ...m, left, base, rate: base ? left / base : 0 };
    });
    const leftReasons = Object.entries(db.students.filter(s => s.status === 'left').reduce<Record<string, number>>((a, s) => { a[s.leftReason || 'Не указана'] = (a[s.leftReason || 'Не указана'] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
    const lost = leads.filter(l => l.status === 'lost' && l.lostReason);
    const lostBy = (Object.keys(LOST_LABEL) as LostReason[]).map(k => ({ k, n: lost.filter(l => l.lostReason === k).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
    const income = db.installments.filter(p => p.paidAt && p.paidAt >= from).reduce((s, p) => s + p.amount, 0);
    const prevIncome = db.installments.filter(p => p.paidAt && p.paidAt >= prevFrom && p.paidAt < from).reduce((s, p) => s + p.amount, 0);
    const prevPaid = prevLeads.filter(l => l.status === 'paid').length;
    return { leads, prevLeads, funnel, chans, best, revenue, churn, leftReasons, lost, lostBy, income, prevIncome, prevPaid };
  }, [db, from, prevFrom]);

  const paid = r.funnel[4].n, conv = r.leads.length ? paid / r.leads.length : 0;
  const pct = (x: number) => Math.round(x * 100) + '%';
  const delta = (cur: number, prev: number) => !prev ? null : (cur - prev) / prev;
  const dLeads = delta(r.leads.length, r.prevLeads.length), dIncome = delta(r.income, r.prevIncome);

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={String(period) as '30' | '90' | '180'} onChange={v => setPeriod(+v as Period)} options={[{ value: '30', label: '30 дней' }, { value: '90', label: '3 месяца' }, { value: '180', label: 'Полгода' }]} ariaLabel="Период" />
        <span className="text-[13px] text-ink-3">Сравнение — с таким же предыдущим периодом</span>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
          <Stat label="Заявок" value={r.leads.length} sub={<Delta d={dLeads} />} />
          <Stat label="Были на созвоне" value={r.funnel[3].n} sub={r.leads.length ? pct(r.funnel[3].n / r.leads.length) + ' от заявок' : '—'} />
          <Stat label="Оплатили" value={paid} sub={'конверсия ' + pct(conv)} tone="ok" />
          <Stat label="Выручка" value={fmtShort(r.income)} sub={<Delta d={dIncome} />} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* воронка */}
        <Card>
          <h3 className="display text-[13px] font-semibold uppercase">Воронка: заявки → созвоны → оплаты</h3>
          <p className="mb-4 text-[13px] text-ink-2">Сколько людей дошло до каждого этапа и сколько потерялось между этапами</p>
          <div className="grid gap-3">
            {r.funnel.map((f, i) => {
              const w = r.funnel[0].n ? f.n / r.funnel[0].n : 0, prev = i ? r.funnel[i - 1].n : 0;
              return (
                <div key={f.label} className="group relative">
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]"><span className="font-medium">{f.label}</span><span className="tnum text-ink-2"><b className="text-ink">{f.n}</b> · {pct(w)}</span></div>
                  <div className="h-7 rounded-md bg-surface-2"><div className="h-full rounded-[4px] bg-accent" style={{ width: Math.max(w * 100, f.n ? 1.5 : 0) + '%', opacity: 1 - i * 0.12 }} /></div>
                  {i > 0 && prev > 0 && <div className="mt-1 text-xs text-ink-3">из предыдущего этапа: {pct(f.n / prev)}</div>}
                </div>
              );
            })}
          </div>
        </Card>

        {/* каналы */}
        <Card>
          <h3 className="display text-[13px] font-semibold uppercase">Откуда лучшие заявки</h3>
          <p className="mb-4 text-[13px] text-ink-2">Конверсия канала: сколько из его заявок в итоге оплатили</p>
          <div className="grid gap-3">
            {r.chans.map(c => {
              const I = CHANNEL_ICON[c.c], cv = c.n ? c.paid / c.n : 0, max = Math.max(...r.chans.map(x => (x.n ? x.paid / x.n : 0)), 0.01);
              return (
                <div key={c.c}>
                  <div className="mb-1 flex items-center gap-2 text-[13px]">
                    <I className="size-4 text-ink-2" aria-hidden /><span className="font-medium">{CHANNEL_LABEL[c.c]}</span>
                    {r.best?.c === c.c && <Badge tone="ok" icon={Trophy}>лучший</Badge>}
                    <span className="tnum ml-auto text-ink-2">{c.n} заявок · {c.trial} созв. · <b className="text-ink">{c.paid} опл.</b></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 flex-1 rounded-full bg-surface-2"><div className="h-full rounded-full bg-ok" style={{ width: (cv / max) * 100 + '%' }} /></div>
                    <span className="tnum w-11 text-right text-[13px] font-semibold">{pct(cv)}</span>
                  </div>
                </div>
              );
            })}
            {!r.chans.length && <p className="text-[13px] text-ink-2">За период заявок нет.</p>}
          </div>
          {r.best && <p className="mt-4 rounded-2xl bg-ok-soft px-3.5 py-2.5 text-[13px] text-ok">{CHANNEL_LABEL[r.best.c]} приносит самых «тёплых» людей: оплачивает {pct(r.best.paid / r.best.n)} заявок. Стоит вкладываться в него в первую очередь.</p>}
        </Card>

        {/* выручка по месяцам */}
        <Card>
          <h3 className="display text-[13px] font-semibold uppercase">Выручка по месяцам</h3>
          <p className="mb-5 text-[13px] text-ink-2">Все поступления, включая платежи по рассрочке; текущий месяц — по сегодняшний день</p>
          <Bars data={r.revenue.map(m => ({ label: m.label.slice(0, 3), value: m.v, tip: `${m.label}: ${fmt(m.v)}`, faded: m.current }))} format={fmtShort} />
        </Card>

        {/* отвал */}
        <Card>
          <h3 className="display text-[13px] font-semibold uppercase">Уходы с курса</h3>
          <p className="mb-5 text-[13px] text-ink-2">Сколько участников ушло за месяц и почему</p>
          <Bars data={r.churn.map(m => ({ label: m.label.slice(0, 3), value: m.left, tip: `${m.label}: ушло ${m.left} из ${m.base} (${pct(m.rate)})`, faded: m.current }))} format={v => String(v)} tone="bad" height={120} />
          <div className="mt-5 grid gap-2">
            {r.leftReasons.map(([reason, n]) => (
              <div key={reason} className="flex items-center gap-3 text-[13px]"><span className="w-40 shrink-0 truncate">{reason}</span><div className="h-2 flex-1 rounded-full bg-surface-2"><div className="h-full rounded-full bg-ink-3" style={{ width: (n / r.leftReasons[0][1]) * 100 + '%' }} /></div><span className="tnum w-6 text-right font-medium">{n}</span></div>
            ))}
          </div>
        </Card>

        {/* причины отказов */}
        <Card className="lg:col-span-2">
          <h3 className="display text-[13px] font-semibold uppercase">Почему не покупают</h3>
          <p className="mb-4 text-[13px] text-ink-2">{plural(r.lost.length, 'отказ', 'отказа', 'отказов')} за период — что можно исправить</p>
          <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
            {r.lostBy.map(x => (
              <div key={x.k}>
                <div className="mb-1 flex justify-between text-[13px]"><span className="font-medium">{LOST_LABEL[x.k]}</span><span className="tnum text-ink-2"><b className="text-ink">{x.n}</b> · {pct(x.n / r.lost.length)}</span></div>
                <div className="h-2.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-warn" style={{ width: (x.n / r.lostBy[0].n) * 100 + '%' }} /></div>
              </div>
            ))}
            {!r.lostBy.length && <p className="text-[13px] text-ink-2">Отказов за период нет.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Delta({ d }: { d: number | null }) {
  if (d === null) return <span>нет данных для сравнения</span>;
  const up = d >= 0;
  return <span className={cx('inline-flex items-center gap-1', up ? 'text-ok' : 'text-bad')}>{up ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}{up ? '+' : ''}{Math.round(d * 100)}% к прошлому периоду</span>;
}

/** вертикальные столбцы одного цвета, подпись значения при наведении и у максимального */
function Bars({ data, format, tone = 'accent', height = 160 }: { data: { label: string; value: number; tip: string; faded?: boolean }[]; format: (v: number) => string; tone?: 'accent' | 'bad'; height?: number }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const maxI = data.findIndex(d => d.value === max);
  return (
    <div>
      <div className="flex items-end gap-2 border-b border-line" style={{ height }} role="img" aria-label={data.map(d => d.tip).join('; ')}>
        {data.map((d, i) => (
          <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end">
            <div className={cx('pointer-events-none absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-lg bg-[#0b0b0c] px-2 py-1 text-xs text-[#f2f2ee] opacity-0 shadow-pop transition-opacity duration-150 group-hover:opacity-100 dark:bg-[#2a2a33]', i < data.length / 2 ? 'left-0' : 'right-0')}>{d.tip}</div>
            {i === maxI && d.value > 0 && <span className="tnum mb-1 text-xs font-medium text-ink-2 group-hover:opacity-0">{format(d.value)}</span>}
            <div className={cx('w-full max-w-12 rounded-t-[4px] transition-[filter] duration-150 group-hover:brightness-110', tone === 'bad' ? 'bg-bad' : 'bg-accent', d.faded && 'opacity-50')} style={{ height: Math.max((d.value / max) * (height - 22), d.value ? 3 : 0) }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">{data.map((d, i) => <span key={i} className="flex-1 text-center text-xs text-ink-3">{d.label}</span>)}</div>
    </div>
  );
}
