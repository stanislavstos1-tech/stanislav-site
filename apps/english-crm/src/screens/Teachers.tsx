/* Преподаватели: загрузка, ставки и отчёт о проведённых занятиях за период — основа для зарплаты. */
import { useMemo, useState } from 'react';
import { ChevronDown, Pencil, Check, CalendarDays } from 'lucide-react';
import type { Lesson, Teacher } from '../domain/types';
import { KIND_LABEL } from '../domain/labels';
import { useDB } from '../data/store';
import { saveTeacher } from '../data/actions';
import { lessonTitle, teacherHours } from '../data/selectors';
import { MONTHS, addDays, dateShort, hm, startOfWeek, plural, fromKzt, toKzt } from '../lib/format';
import { Badge, Button, Card, Input, Segmented, Avatar, cx } from '../ui/kit';
import { toast } from '../ui/overlay';
import { useApp } from '../app/ctx';

const pay = (t: Teacher, l: Lesson) => (l.kind === 'group' ? t.rateGroup : t.rateIndividual);

export function Teachers() {
  const db = useDB();
  const { fmt, role } = useApp();
  const [period, setPeriod] = useState<'month' | 'prev'>('month');
  const [open, setOpen] = useState<string | null>(null);
  const now = new Date();
  const from = +new Date(now.getFullYear(), now.getMonth() - (period === 'prev' ? 1 : 0), 1);
  const to = +new Date(now.getFullYear(), now.getMonth() + (period === 'prev' ? 0 : 1), 1);
  const w0 = startOfWeek(Date.now());
  const rows = useMemo(() => db.teachers.map(t => {
    const done = db.lessons.filter(l => l.teacherId === t.id && l.status === 'done' && l.start >= from && l.start < to).sort((a, b) => a.start - b.start);
    const canceled = db.lessons.filter(l => l.teacherId === t.id && l.status === 'canceled' && l.start >= from && l.start < to).length;
    const by = { group: 0, individual: 0, trial: 0 }; done.forEach(l => by[l.kind]++);
    return { t, done, canceled, by, hours: done.reduce((s, l) => s + l.duration, 0) / 60, sum: done.reduce((s, l) => s + pay(t, l), 0), week: teacherHours(db, t.id, w0, addDays(w0, 7)) };
  }), [db, from, to, w0]);
  const total = rows.reduce((s, r) => s + r.sum, 0);
  const label = MONTHS[(now.getMonth() + (period === 'prev' ? 11 : 0)) % 12];

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={period} onChange={setPeriod} options={[{ value: 'month', label: 'Этот месяц' }, { value: 'prev', label: 'Прошлый месяц' }]} />
        <div className="ml-auto text-sm text-ink-2">К выплате за {label.toLowerCase()}: <b className="tnum text-ink">{fmt(total)}</b></div>
      </div>
      <div className="grid gap-3">
        {rows.map(r => (
          <Card key={r.t.id} pad={false}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4 sm:p-5">
              <div className="flex min-w-[200px] flex-1 items-center gap-3">
                <Avatar name={r.t.name} color={r.t.color} size={40} />
                <div className="min-w-0 leading-tight"><div className="truncate font-semibold">{r.t.name}</div><div className="flex items-center gap-1.5 text-xs text-ink-3"><CalendarDays className="size-3" aria-hidden />на этой неделе {r.week.toFixed(r.week % 1 ? 1 : 0).replace('.', ',')} ч</div></div>
              </div>
              <div className="grid grid-cols-3 gap-5 text-center sm:text-left">
                <div><div className="tnum text-lg font-semibold">{r.by.group}</div><div className="text-xs text-ink-3">групповых</div></div>
                <div><div className="tnum text-lg font-semibold">{r.by.individual}</div><div className="text-xs text-ink-3">индивид.</div></div>
                <div><div className="tnum text-lg font-semibold">{r.by.trial}</div><div className="text-xs text-ink-3">пробных</div></div>
              </div>
              <div className="min-w-[120px] text-right"><div className="tnum text-lg font-semibold">{fmt(r.sum)}</div><div className="text-xs text-ink-3">{r.hours.toFixed(r.hours % 1 ? 1 : 0).replace('.', ',')} ч · отмен {r.canceled}</div></div>
              <Button variant="ghost" size="sm" icon={ChevronDown} onClick={() => setOpen(open === r.t.id ? null : r.t.id)} aria-expanded={open === r.t.id} className={cx('transition-transform duration-150', open === r.t.id && 'rotate-180')} aria-label="Подробнее" />
            </div>
            {open === r.t.id && (
              <div className="border-t border-line p-4 sm:p-5">
                <Rates t={r.t} editable={role === 'admin'} />
                <div className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Проведённые занятия · {plural(r.done.length, 'занятие', 'занятия', 'занятий')}</div>
                <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                  {r.done.slice().reverse().map(l => (
                    <li key={l.id} className="flex items-center gap-3 px-3.5 py-2 text-sm">
                      <span className="tnum w-24 shrink-0 text-[13px] text-ink-3">{dateShort(l.start)}, {hm(l.start)}</span>
                      <span className="min-w-0 flex-1 truncate">{lessonTitle(db, l)}</span>
                      <Badge tone={l.kind === 'trial' ? 'warn' : l.kind === 'individual' ? 'info' : 'neutral'} className="max-sm:hidden">{KIND_LABEL[l.kind]}</Badge>
                      <span className="tnum w-20 text-right font-medium">{fmt(pay(r.t, l))}</span>
                    </li>
                  ))}
                  {!r.done.length && <li className="px-3.5 py-4 text-[13px] text-ink-2">Занятий за период нет.</li>}
                </ul>
              </div>
            )}
          </Card>
        ))}
      </div>
      <p className="text-xs text-ink-3">В отчёт входят занятия с отметкой посещаемости. Групповое оплачивается по групповой ставке, индивидуальное и пробное — по индивидуальной.</p>
    </div>
  );
}

function Rates({ t, editable }: { t: Teacher; editable: boolean }) {
  const db = useDB();
  const { fmt } = useApp();
  const [edit, setEdit] = useState(false);
  const [g, setG] = useState(String(fromKzt(t.rateGroup, db.settings))), [i, setI] = useState(String(fromKzt(t.rateIndividual, db.settings)));
  const cur = db.settings.currency === 'RUB' ? '₽' : '₸';
  if (!edit) return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <span>Групповое: <b className="tnum">{fmt(t.rateGroup)}</b></span>
      <span>Индивидуальное и пробное: <b className="tnum">{fmt(t.rateIndividual)}</b></span>
      {editable && <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEdit(true)}>Изменить ставки</Button>}
    </div>
  );
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); saveTeacher(t.id, { rateGroup: toKzt(+g || 0, db.settings), rateIndividual: toKzt(+i || 0, db.settings) }); setEdit(false); toast('Ставки сохранены'); }}>
      <label className="grid gap-1 text-[13px] text-ink-2">Групповое, {cur}<Input inputMode="numeric" value={g} onChange={e => setG(e.target.value.replace(/\D/g, ''))} className="tnum w-32" /></label>
      <label className="grid gap-1 text-[13px] text-ink-2">Индивидуальное, {cur}<Input inputMode="numeric" value={i} onChange={e => setI(e.target.value.replace(/\D/g, ''))} className="tnum w-32" /></label>
      <Button type="submit" variant="primary" icon={Check}>Сохранить</Button>
      <Button variant="ghost" onClick={() => setEdit(false)}>Отмена</Button>
    </form>
  );
}
