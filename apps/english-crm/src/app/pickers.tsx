/* Выбор дня и времени без системного календаря: лента дней + сетка времени. */
import { useMemo } from 'react';
import { addDays, at, dateShort, dayDiff, hm, startOfDay, weekdayShort } from '../lib/format';
import { cx } from '../ui/kit';

export function DayStrip({ value, onChange, days = 14, from = Date.now() }: { value: number; onChange: (day: number) => void; days?: number; from?: number }) {
  const list = useMemo(() => [...Array(days)].map((_, i) => addDays(startOfDay(from), i)), [days, from]);
  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="День">
      {list.map(d => {
        const on = startOfDay(value) === d, k = dayDiff(d), we = new Date(d).getDay() % 6 === 0;
        return (
          <button key={d} type="button" role="radio" aria-checked={on} onClick={() => onChange(d)}
            className={cx('flex h-[60px] w-[58px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border text-center transition-[background,border-color] duration-150',
              on ? 'border-accent bg-accent text-white dark:text-[#101018]' : 'border-line-2 bg-surface hover:border-ink-3')}>
            <span className={cx('text-[11px] leading-none', on ? 'opacity-80' : we ? 'text-bad' : 'text-ink-3')}>{k === 0 ? 'Сегодня' : k === 1 ? 'Завтра' : weekdayShort(d)}</span>
            <span className="tnum text-[17px] font-semibold leading-none">{new Date(d).getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}

/** сетка времени: либо все часы, либо только переданные свободные окна */
export function TimeGrid({ day, value, onChange, slots, from = 8, to = 21, step = 30, isBusy }: { day: number; value: number | null; onChange: (t: number) => void; slots?: number[]; from?: number; to?: number; step?: number; isBusy?: (t: number) => boolean }) {
  const list = useMemo(() => {
    if (slots) return slots;
    const out: number[] = [];
    for (let m = from * 60; m <= to * 60; m += step) out.push(at(day, String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')));
    return out;
  }, [slots, day, from, to, step]);
  if (!list.length) return <p className="rounded-xl bg-surface-2 px-3 py-4 text-center text-[13px] text-ink-2">В этот день свободных окон нет — выберите другой день.</p>;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-1.5" role="radiogroup" aria-label="Время">
      {list.map(t => {
        const on = value === t, past = t < Date.now(), busy = isBusy?.(t);
        return (
          <button key={t} type="button" role="radio" aria-checked={on} disabled={past} onClick={() => onChange(t)} title={busy ? 'У преподавателя уже есть занятие' : undefined}
            className={cx('tnum h-10 rounded-[10px] border text-sm transition-[background,border-color] duration-150 disabled:pointer-events-none disabled:opacity-30 disabled:line-through',
              on ? 'border-accent bg-accent font-semibold text-white dark:text-[#101018]' : busy ? 'border-dashed border-line-2 text-ink-3' : 'border-line-2 bg-surface hover:border-ink-3')}>
            {hm(t)}
          </button>
        );
      })}
    </div>
  );
}

export const whenLong = (t: number) => {
  const k = dayDiff(t);
  return (k === 0 ? 'сегодня' : k === 1 ? 'завтра' : weekdayShort(t).toLowerCase() + ', ' + dateShort(t)) + ' в ' + hm(t);
};
