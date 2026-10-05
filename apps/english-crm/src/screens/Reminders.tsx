/* Напоминания: календарь на месяц и список дел выбранного дня.
   Напоминание — это «что сделать и когда», при желании привязанное к заявке или ученику. */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Plus, Trash2, CalendarArrowUp, Bell, AlertTriangle } from 'lucide-react';
import type { ID, Task } from '../domain/types';
import { useDB, undo } from '../data/store';
import * as A from '../data/actions';
import { MONTHS, addDays, at, dayDiff, dateShort, hm, plural, startOfDay, startOfWeek } from '../lib/format';
import { WEEKDAYS } from '../domain/labels';
import { Button, Card, Input, Select, Chip, Empty, cx } from '../ui/kit';
import { toast } from '../ui/overlay';
import { useApp } from '../app/ctx';

const undoAction = { label: 'Отменить', run: () => { if (undo()) toast('Изменение отменено', { tone: 'info' }); } };
const TIMES = ['09:00', '12:00', '15:00', '18:00'];

const dayTitle = (d: number) => {
  const diff = dayDiff(d);
  const base = new Date(d).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const pre = diff === 0 ? 'Сегодня' : diff === 1 ? 'Завтра' : diff === -1 ? 'Вчера' : '';
  return pre ? pre + ', ' + base.split(', ')[1] : base[0].toUpperCase() + base.slice(1);
};

export function Reminders() {
  const db = useDB();
  const now = Date.now(), today0 = startOfDay(now);
  const [day, setDay] = useState(today0);
  const [month, setMonth] = useState(() => { const d = new Date(); return +new Date(d.getFullYear(), d.getMonth(), 1); });

  // напоминания по дням: ключ — начало дня
  const byDay = useMemo(() => {
    const m = new Map<number, Task[]>();
    db.tasks.forEach(t => { const k = startOfDay(t.due); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); });
    m.forEach(l => l.sort((a, b) => Number(a.done) - Number(b.done) || a.due - b.due));
    return m;
  }, [db.tasks]);
  const overdue = db.tasks.filter(t => !t.done && t.due < today0).sort((a, b) => a.due - b.due);

  const m = new Date(month);
  const gridStart = startOfWeek(month);
  const weeks = Math.ceil((dayDiff(+new Date(m.getFullYear(), m.getMonth() + 1, 0), gridStart) + 1) / 7);
  const cells = [...Array(weeks * 7)].map((_, i) => addDays(gridStart, i));
  const shift = (n: number) => setMonth(+new Date(m.getFullYear(), m.getMonth() + n, 1));
  const pick = (d: number) => { setDay(d); const x = new Date(d); if (x.getMonth() !== m.getMonth()) setMonth(+new Date(x.getFullYear(), x.getMonth(), 1)); };

  const list = byDay.get(day) || [];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* ---------- календарь ---------- */}
      <Card className="self-start">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{MONTHS[m.getMonth()]} {m.getFullYear()}</h2>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => pick(today0)}>Сегодня</Button>
            <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => shift(-1)} aria-label="Предыдущий месяц" />
            <Button variant="ghost" size="sm" icon={ChevronRight} onClick={() => shift(1)} aria-label="Следующий месяц" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-3">{WEEKDAYS.map(w => <div key={w} className="pb-1">{w}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map(d => {
            const items = byDay.get(d) || [];
            const open = items.filter(t => !t.done);
            const late = d < today0 && open.length > 0;
            const inMonth = new Date(d).getMonth() === m.getMonth();
            const sel = d === day, isToday = d === today0;
            return (
              <button key={d} type="button" onClick={() => pick(d)} aria-pressed={sel}
                aria-label={dateShort(d) + (open.length ? ', ' + plural(open.length, 'напоминание', 'напоминания', 'напоминаний') : '')}
                className={cx('flex aspect-square min-h-11 flex-col items-center justify-start gap-1 rounded-xl pt-1.5 text-sm transition-[background,color] duration-150 sm:aspect-[1.15] sm:pt-2',
                  sel ? 'bg-accent text-white dark:text-[#101018]' : isToday ? 'bg-accent-soft text-accent-ink' : 'hover:bg-surface-2',
                  !inMonth && !sel && 'text-ink-3/60')}>
                <span className={cx('tnum leading-none', isToday && 'font-semibold')}>{new Date(d).getDate()}</span>
                {open.length > 0 && (
                  <span className={cx('tnum grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-semibold leading-none',
                    sel ? 'bg-white/25 text-current' : late ? 'bg-bad text-white' : 'bg-ink/10 text-ink dark:bg-white/15')}>{open.length}</span>
                )}
                {!open.length && items.length > 0 && <Check className={cx('size-3', sel ? 'opacity-80' : 'text-ok')} aria-hidden />}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ink/20 dark:bg-white/25" />есть дела</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-bad" />просрочено</span>
          <span className="inline-flex items-center gap-1.5"><Check className="size-3 text-ok" />всё сделано</span>
        </div>
      </Card>

      {/* ---------- выбранный день ---------- */}
      <div className="grid content-start gap-5">
        {overdue.length > 0 && day === today0 && (
          <Card pad={false} className="overflow-hidden border-bad/30">
            <div className="flex items-center gap-2 px-4 pt-4 sm:px-5">
              <AlertTriangle className="size-4 text-bad" aria-hidden />
              <h3 className="text-[15px] font-semibold">Просрочено · {overdue.length}</h3>
              <Button variant="soft" size="sm" className="ml-auto" onClick={() => { overdue.forEach(t => A.moveTask(t.id, at(today0, hm(t.due)))); toast('Перенесли на сегодня'); }}>Всё на сегодня</Button>
            </div>
            <ul className="mt-2 divide-y divide-line">{overdue.map(t => <Row key={t.id} t={t} showDate />)}</ul>
          </Card>
        )}

        <Card pad={false} className="overflow-hidden">
          <div className="px-4 pt-4 sm:px-5">
            <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{dayTitle(day)}</h3>
            <p className="text-[13px] text-ink-3">{list.length ? plural(list.filter(t => !t.done).length, 'дело', 'дела', 'дел') + ' · выполнено ' + list.filter(t => t.done).length : 'Дел нет'}</p>
          </div>
          <AddForm day={day} />
          {list.length
            ? <ul className="divide-y divide-line border-t border-line">{list.map(t => <Row key={t.id} t={t} />)}</ul>
            : <Empty compact icon={Bell} title="На этот день ничего нет">Напишите, что нужно сделать, выберите время — и напоминание появится в календаре и на экране «Сегодня».</Empty>}
        </Card>
      </div>
    </div>
  );
}

/** быстрое добавление: текст, время, по желанию — к кому относится */
function AddForm({ day }: { day: number }) {
  const db = useDB();
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('12:00');
  const [rel, setRel] = useState('');
  const leads = db.leads.filter(l => l.status !== 'paid' && l.status !== 'lost').sort((a, b) => a.name.localeCompare(b.name));
  const students = db.students.filter(s => s.status !== 'left').sort((a, b) => a.name.localeCompare(b.name));
  const save = () => {
    if (!title.trim()) return;
    const [kind, id] = rel.split(':') as ['lead' | 'student' | '', ID];
    const due = at(day, time);
    A.addTask({ title, due, leadId: kind === 'lead' ? id : undefined, studentId: kind === 'student' ? id : undefined });
    setTitle(''); setRel('');
    toast('Напоминание на ' + dateShort(due) + ', ' + time);
  };
  return (
    <form className="grid gap-2.5 px-4 pb-4 pt-3 sm:px-5" onSubmit={e => { e.preventDefault(); save(); }}>
      <div className="flex gap-2">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Что сделать? Например: перезвонить" aria-label="Текст напоминания" />
        <Button type="submit" variant="primary" icon={Plus} disabled={!title.trim()} className="shrink-0 max-sm:w-10 max-sm:px-0" aria-label="Добавить"><span className="max-sm:hidden">Добавить</span></Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {TIMES.map(t => <Chip key={t} on={time === t} onClick={() => setTime(t)}>{t}</Chip>)}
        <label className="inline-flex items-center gap-1.5 text-xs text-ink-3">или
          <input type="time" value={time} onChange={e => e.target.value && setTime(e.target.value)} className="tnum h-8 rounded-[10px] border border-line-2 bg-surface px-2 text-[13px] text-ink" aria-label="Своё время" />
        </label>
      </div>
      <Select value={rel} onChange={e => setRel(e.target.value)} aria-label="К кому относится" className="h-10 text-[13px]">
        <option value="">Без привязки к человеку</option>
        <optgroup label="Заявки">{leads.map(l => <option key={l.id} value={'lead:' + l.id}>{l.name}</option>)}</optgroup>
        <optgroup label="Ученики">{students.map(s => <option key={s.id} value={'student:' + s.id}>{s.name}</option>)}</optgroup>
      </Select>
    </form>
  );
}

export function Row({ t, showDate }: { t: Task; showDate?: boolean }) {
  const db = useDB();
  const { openDrawer } = useApp();
  const rel = t.leadId ? db.leads.find(l => l.id === t.leadId) : t.studentId ? db.students.find(x => x.id === t.studentId) : undefined;
  const late = !t.done && t.due < Date.now();
  // «на следующий день»: для просроченных — на завтра, для будущих — на день позже
  const tomorrow = at(addDays(Math.max(startOfDay(t.due), startOfDay(Date.now())), 1), hm(t.due));
  return (
    <li className={cx('flex items-center gap-3 px-4 py-2.5 sm:px-5', t.done && 'opacity-60')}>
      <button type="button" onClick={() => { A.toggleTask(t.id); if (!t.done) toast('Готово', { action: undoAction }); }} aria-label={t.done ? 'Вернуть в работу' : 'Отметить выполненным'} aria-pressed={t.done}
        className={cx('grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-150', t.done ? 'border-ok bg-ok text-white' : 'border-line-2 text-transparent hover:border-ok hover:text-ok')}>
        <Check className="size-3.5" strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <div className={cx('text-sm', t.done && 'line-through')}>{t.title}</div>
        {rel && <button type="button" onClick={() => openDrawer({ type: t.leadId ? 'lead' : 'student', id: rel.id })} className="max-w-full truncate text-xs text-accent-ink hover:underline">{rel.name}</button>}
      </div>
      <span className={cx('tnum shrink-0 text-[13px]', late ? 'font-medium text-bad' : 'text-ink-3')}>{showDate ? dateShort(t.due) + ', ' : ''}{hm(t.due)}</span>
      {!t.done && <Button variant="ghost" size="sm" icon={CalendarArrowUp} onClick={() => { A.moveTask(t.id, tomorrow); toast('Перенесли на ' + dateShort(tomorrow), { action: undoAction }); }} aria-label="Перенести на следующий день" title="Перенести на следующий день" />}
      <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { A.deleteTask(t.id); toast('Напоминание удалено', { action: undoAction }); }} aria-label="Удалить" title="Удалить" />
    </li>
  );
}
