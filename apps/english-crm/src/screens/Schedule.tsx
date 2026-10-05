/* Расписание: неделя / день по преподавателям. Нажмите на пустое место — создать занятие. */
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Sparkles, Repeat, Users, User as UserIcon, CalendarClock } from 'lucide-react';
import type { ID, Lesson, Teacher } from '../domain/types';
import { useDB } from '../data/store';
import { freeSlots, lessonEnd, lessonTitle, lessonsInRange, teacherById, teacherHours } from '../data/selectors';
import { HOUR, MIN, addDays, dateShort, hm, initials, startOfDay, startOfWeek, dayDiff, weekdayShort, plural } from '../lib/format';
import { Button, Chip, Segmented, cx, Empty } from '../ui/kit';
import { useApp, can } from '../app/ctx';
import { DayStrip } from '../app/pickers';

const H0 = 8, H1 = 22, PX = 56; // часы сетки и высота часа

export function Schedule() {
  const db = useDB();
  const { role, user, openDrawer, openModal } = useApp();
  const isTeacher = role === 'teacher';
  const edit = can.editSchedule(role);
  const [wide, setWide] = useState(() => matchMedia('(min-width: 900px)').matches);
  useEffect(() => { const m = matchMedia('(min-width: 900px)'); const f = () => setWide(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  const [mode, setMode] = useState<'week' | 'day'>('week');
  const [anchor, setAnchor] = useState(() => startOfDay(Date.now()));
  const [only, setOnly] = useState<ID | ''>(isTeacher ? user.teacherId! : '');
  const [free, setFree] = useState(false);
  const view = wide ? mode : 'agenda';

  const teachers = isTeacher ? db.teachers.filter(t => t.id === user.teacherId) : db.teachers;
  const w0 = startOfWeek(anchor);
  const days = view === 'week' ? [...Array(7)].map((_, i) => addDays(w0, i)) : [anchor];
  const from = view === 'week' ? w0 : anchor, to = view === 'week' ? addDays(w0, 7) : addDays(anchor, 1);
  const lessons = useMemo(() => lessonsInRange(db, from, to).filter(l => !only || l.teacherId === only), [db, from, to, only]);
  const step = (k: number) => setAnchor(a => addDays(a, k * (view === 'week' ? 7 : 1)));
  const title = view === 'week' ? `${dateShort(w0)} – ${dateShort(addDays(w0, 6))}` : `${weekdayShort(anchor)}, ${dateShort(anchor)}`;
  const createAt = (start: number, teacherId?: ID, trial?: boolean) => edit && openModal({ type: 'newLesson', start, teacherId: teacherId || (only || undefined), leadId: trial ? db.leads.find(l => l.status === 'new' || l.status === 'contacted')?.id : undefined });

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* панель управления */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={() => step(-1)} aria-label="Назад" />
          <Button variant="secondary" size="sm" icon={ChevronRight} onClick={() => step(1)} aria-label="Вперёд" />
          <Button variant="ghost" size="sm" onClick={() => setAnchor(startOfDay(Date.now()))}>Сегодня</Button>
        </div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{wide ? title : ''}</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {edit && <Button variant={free ? 'soft' : 'ghost'} size="sm" icon={Sparkles} onClick={() => setFree(f => !f)} aria-pressed={free}>Свободные окна</Button>}
          {wide && <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'week', label: 'Неделя' }, { value: 'day', label: 'День' }]} ariaLabel="Вид" />}
          {edit && <Button variant="primary" size="sm" icon={Plus} onClick={() => openModal({ type: 'newLesson', start: undefined, teacherId: only || undefined })}>Занятие</Button>}
        </div>
      </div>

      {/* преподаватели: фильтр + загрузка недели */}
      {!isTeacher && <TeacherLoad teachers={teachers} w0={w0} only={only} setOnly={setOnly} />}

      {view === 'agenda' && <Agenda anchor={anchor} setAnchor={setAnchor} only={only} free={free} onCreate={createAt} />}
      {view !== 'agenda' && (
        <div className="overflow-hidden rounded-[16px] border border-line bg-surface shadow-card">
          <div className="scroll-thin max-h-[calc(100dvh-260px)] min-h-[480px] overflow-auto" ref={el => { if (el && !el.dataset.scrolled) { el.dataset.scrolled = '1'; el.scrollTop = Math.max(0, (Math.min(new Date().getHours(), 17) - H0 - 1) * PX); } }}>
            {view === 'week'
              ? <Grid columns={days.map(d => ({ key: String(d), day: d, label: <DayHead d={d} /> }))} lessons={lessons} onLesson={id => openDrawer({ type: 'lesson', id })} onEmpty={(t) => createAt(t)} free={free ? (d) => (only ? [only] : teachers.map(t => t.id)).flatMap(tid => freeSlots(db, tid, d, db.settings.trialDuration).map(s => ({ t: s, teacherId: tid }))) : undefined} onFree={(t, tid) => createAt(t, tid, true)} editable={edit} />
              : <Grid columns={(only ? teachers.filter(t => t.id === only) : teachers).map(t => ({ key: t.id, day: anchor, teacherId: t.id, label: <TeacherHead t={t} day={anchor} /> }))} lessons={lessons} onLesson={id => openDrawer({ type: 'lesson', id })} onEmpty={(t, tid) => createAt(t, tid)} free={free ? (d, tid) => freeSlots(db, tid!, d, db.settings.trialDuration).map(s => ({ t: s, teacherId: tid! })) : undefined} onFree={(t, tid) => createAt(t, tid, true)} editable={edit} />}
          </div>
        </div>
      )}
      {view !== 'agenda' && edit && <p className="text-xs text-ink-3">Нажмите на пустое место в сетке — создать занятие на это время. {free ? 'Пунктиром — свободные окна для пробного: нажмите, чтобы записать.' : ''}</p>}
    </div>
  );
}

function DayHead({ d }: { d: number }) {
  const today = dayDiff(d) === 0;
  return (
    <div className="flex items-baseline justify-center gap-1.5 py-2.5">
      <span className={cx('text-xs font-medium uppercase tracking-wide', today ? 'text-accent' : 'text-ink-3')}>{weekdayShort(d)}</span>
      <span className={cx('tnum text-[15px] font-semibold', today && 'grid size-7 place-items-center rounded-lg bg-accent text-white dark:text-[#101018]')}>{new Date(d).getDate()}</span>
    </div>
  );
}

function TeacherHead({ t, day }: { t: Teacher; day: number }) {
  const db = useDB();
  const h = teacherHours(db, t.id, day, addDays(day, 1));
  return (
    <div className="flex items-center justify-center gap-2 px-2 py-2.5">
      <span className="grid size-6 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ background: t.color }} aria-hidden>{initials(t.name)}</span>
      <span className="truncate text-[13px] font-medium">{t.name.split(' ')[0]}</span>
      <span className="tnum text-xs text-ink-3">{h ? h.toFixed(h % 1 ? 1 : 0).replace('.', ',') + ' ч' : 'свободен'}</span>
    </div>
  );
}

/** загрузка преподавателей за неделю: часы и полоска до 30 ч */
function TeacherLoad({ teachers, w0, only, setOnly }: { teachers: Teacher[]; w0: number; only: ID | ''; setOnly: (v: ID | '') => void }) {
  const db = useDB();
  const hours = teachers.map(t => ({ t, h: teacherHours(db, t.id, w0, addDays(w0, 7)) }));
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
      <Chip on={!only} onClick={() => setOnly('')}>Все</Chip>
      {hours.map(({ t, h }) => (
        <button key={t.id} type="button" onClick={() => setOnly(only === t.id ? '' : t.id)} aria-pressed={only === t.id}
          className={cx('flex h-11 shrink-0 items-center gap-2.5 rounded-xl border px-3 text-left transition-[background,border-color] duration-150', only === t.id ? 'border-ink bg-surface shadow-card' : 'border-line-2 bg-surface hover:border-ink-3')}>
          <span className="grid size-6 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ background: t.color }} aria-hidden>{initials(t.name)}</span>
          <span className="leading-tight"><span className="block text-[13px] font-medium">{t.name.split(' ')[0]}</span>
            <span className="flex items-center gap-1.5"><span className="block h-1 w-14 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full" style={{ width: Math.min(100, (h / 30) * 100) + '%', background: t.color }} /></span><span className="tnum text-[11px] text-ink-3">{h.toFixed(h % 1 ? 1 : 0).replace('.', ',')} ч</span></span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---------- сетка: колонки — дни или преподаватели ---------- */
interface Col { key: string; day: number; teacherId?: ID; label: React.ReactNode }
function Grid({ columns, lessons, onLesson, onEmpty, free, onFree, editable }: {
  columns: Col[]; lessons: Lesson[]; onLesson: (id: ID) => void; onEmpty: (t: number, teacherId?: ID) => void;
  free?: (day: number, teacherId?: ID) => { t: number; teacherId: ID }[]; onFree: (t: number, teacherId: ID) => void; editable: boolean;
}) {
  const db = useDB();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(i); }, []);
  const hours = [...Array(H1 - H0)].map((_, i) => H0 + i);
  const top = (t: number) => ((t - startOfDay(t)) / HOUR - H0) * PX;
  return (
    <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(0,1fr))` }}>
      <div className="sticky top-0 z-20 border-b border-line bg-surface" />
      {columns.map(c => <div key={c.key} className="sticky top-0 z-20 border-b border-l border-line bg-surface">{c.label}</div>)}
      <div className="relative" style={{ height: hours.length * PX }}>
        {hours.map(h => <div key={h} className="tnum absolute right-2 -translate-y-1/2 text-[11px] text-ink-3" style={{ top: (h - H0) * PX }}>{h > H0 ? h + ':00' : ''}</div>)}
      </div>
      {columns.map(c => {
        const list = lessons.filter(l => startOfDay(l.start) === c.day && (!c.teacherId || l.teacherId === c.teacherId));
        const lanes = layout(list);
        const t = c.teacherId ? teacherById(db, c.teacherId) : undefined;
        const fr = free?.(c.day, c.teacherId) || [];
        return (
          <div key={c.key} className="relative border-l border-line" style={{ height: hours.length * PX }}
            onClick={e => {
              if (!editable || e.target !== e.currentTarget) return;
              const y = e.nativeEvent.offsetY, min = Math.floor((y / PX) * 2) * 30 + H0 * 60;
              onEmpty(startOfDay(c.day) + min * MIN, c.teacherId);
            }}>
            {hours.map(h => <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line" style={{ top: (h - H0) * PX }} />)}
            {/* нерабочее время преподавателя */}
            {t && <><div className="pointer-events-none absolute inset-x-0 top-0 bg-surface-2/70" style={{ height: Math.max(0, (t.workFrom - H0) * PX) }} /><div className="pointer-events-none absolute inset-x-0 bottom-0 bg-surface-2/70" style={{ top: (t.workTo - H0) * PX }} /></>}
            {dayDiff(c.day) === 0 && top(now) > 0 && top(now) < hours.length * PX && <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-bad" style={{ top: top(now) }}><span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-bad" /></div>}
            {fr.map(f => { const tt = teacherById(db, f.teacherId); return (
              <button key={f.t + f.teacherId} type="button" onClick={() => onFree(f.t, f.teacherId)} title={`Свободно: ${tt?.name}, ${hm(f.t)}`}
                className="absolute z-[1] flex items-center gap-1 overflow-hidden rounded-md border border-dashed border-ok/60 bg-ok-soft/70 px-1.5 text-[10.5px] font-medium text-ok hover:bg-ok-soft"
                style={{ top: top(f.t) + 1, height: (db.settings.trialDuration / 60) * PX - 3, left: c.teacherId ? 3 : `calc(${(columns.length > 1 ? (db.teachers.findIndex(x => x.id === f.teacherId) / db.teachers.length) * 100 : 0)}% + 2px)`, width: c.teacherId ? 'calc(100% - 6px)' : `calc(${100 / db.teachers.length}% - 3px)` }}>
                {c.teacherId ? <><Plus className="size-3" aria-hidden />{hm(f.t)}</> : initials(tt?.name || '')}
              </button>
            ); })}
            {list.map(l => {
              const lane = lanes.get(l.id)!; const tt = teacherById(db, l.teacherId)!;
              const h = Math.max(22, (l.duration / 60) * PX - 2);
              const cancel = l.status === 'canceled', trial = l.kind === 'trial';
              return (
                <button key={l.id} type="button" onClick={() => onLesson(l.id)} title={`${lessonTitle(db, l)} · ${hm(l.start)}–${hm(lessonEnd(l))} · ${tt.name}`}
                  className={cx('absolute z-[2] flex flex-col overflow-hidden rounded-lg px-1.5 py-1 text-left transition-[filter] duration-150 hover:brightness-[.97] dark:hover:brightness-125', cancel && 'opacity-55')}
                  style={{ top: top(l.start) + 1, height: h, left: `calc(${(lane.i / lane.n) * 100}% + 2px)`, width: `calc(${100 / lane.n}% - 4px)`, border: trial ? `1px dashed ${tt.color}` : '0', borderLeft: `3px solid ${tt.color}`, background: `color-mix(in srgb, ${tt.color} ${cancel ? 6 : 13}%, var(--c-surface))` }}>
                  <span className={cx('flex items-center gap-1 text-[11px] font-semibold leading-tight', cancel && 'line-through')}>
                    <span className="tnum">{hm(l.start)}</span>
                    {!c.teacherId && <span className="rounded px-1 text-[9.5px] font-semibold text-white" style={{ background: tt.color }}>{initials(tt.name)}</span>}
                    {l.seriesId && <Repeat className="size-2.5 opacity-50" aria-label="повторяется" />}
                  </span>
                  {h > 30 && <span className={cx('truncate text-[11.5px] leading-tight text-ink', cancel && 'line-through')}>{trial ? 'Пробный' : lessonTitle(db, l)}</span>}
                  {h > 46 && <span className="truncate text-[10.5px] text-ink-2">{trial ? db.leads.find(x => x.id === l.leadId)?.name : l.kind === 'individual' ? 'индивидуально' : ''}{cancel ? 'отменено' : l.status === 'planned' && lessonEnd(l) < Date.now() ? 'нет отметки' : ''}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** раскладка пересекающихся занятий по дорожкам */
function layout(list: Lesson[]) {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const res = new Map<ID, { i: number; n: number }>();
  let cluster: Lesson[] = [], end = 0;
  const flush = () => {
    const lanes: number[] = [];
    cluster.forEach(l => { let i = lanes.findIndex(e => e <= l.start); if (i < 0) { i = lanes.length; lanes.push(0); } lanes[i] = lessonEnd(l); res.set(l.id, { i, n: 0 }); });
    cluster.forEach(l => (res.get(l.id)!.n = lanes.length));
    cluster = [];
  };
  sorted.forEach(l => { if (cluster.length && l.start >= end) flush(); cluster.push(l); end = Math.max(end, lessonEnd(l)); });
  if (cluster.length) flush();
  return res;
}

/* ---------- телефон: список занятий по дням ---------- */
function Agenda({ anchor, setAnchor, only, free, onCreate }: { anchor: number; setAnchor: (d: number) => void; only: ID | ''; free: boolean; onCreate: (t: number, tid?: ID, trial?: boolean) => void }) {
  const db = useDB();
  const { openDrawer, role } = useApp();
  const list = lessonsInRange(db, anchor, addDays(anchor, 1)).filter(l => !only || l.teacherId === only);
  const teachers = only ? db.teachers.filter(t => t.id === only) : db.teachers;
  return (
    <div className="grid gap-3">
      <DayStrip value={anchor} onChange={setAnchor} from={startOfWeek(Date.now())} days={21} />
      <div className="text-[13px] font-medium text-ink-2 first-letter:uppercase">{new Date(anchor).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })} · {plural(list.filter(l => l.status !== 'canceled').length, 'занятие', 'занятия', 'занятий')}</div>
      {list.length ? (
        <div className="grid gap-2">
          {list.map(l => { const t = teacherById(db, l.teacherId)!; const cancel = l.status === 'canceled'; return (
            <button key={l.id} type="button" onClick={() => openDrawer({ type: 'lesson', id: l.id })}
              className={cx('flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left shadow-card', cancel && 'opacity-55')}>
              <div className="w-12 shrink-0"><div className={cx('tnum text-[15px] font-semibold', cancel && 'line-through')}>{hm(l.start)}</div><div className="tnum text-xs text-ink-3">{hm(lessonEnd(l))}</div></div>
              <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: t.color }} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className={cx('truncate text-[15px] font-medium', cancel && 'line-through')}>{l.kind === 'trial' ? 'Пробный · ' + (db.leads.find(x => x.id === l.leadId)?.name || '') : lessonTitle(db, l)}</div>
                <div className="flex items-center gap-1.5 text-xs text-ink-3">
                  {l.kind === 'group' ? <Users className="size-3" aria-hidden /> : l.kind === 'individual' ? <UserIcon className="size-3" aria-hidden /> : <CalendarClock className="size-3" aria-hidden />}
                  {t.name}{cancel ? ' · отменено' : l.status === 'planned' && lessonEnd(l) < Date.now() ? ' · нет отметки' : ''}
                </div>
              </div>
            </button>
          ); })}
        </div>
      ) : <Empty icon={CalendarClock} title="В этот день занятий нет" compact />}
      {free && role !== 'teacher' && (
        <div className="mt-2 grid gap-3 rounded-2xl border border-dashed border-ok/50 bg-ok-soft/40 p-3">
          <div className="text-[13px] font-semibold text-ok">Свободные окна для пробного</div>
          {teachers.map(t => { const fs = freeSlots(db, t.id, anchor, db.settings.trialDuration); return fs.length ? (
            <div key={t.id}><div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><span className="size-2 rounded-full" style={{ background: t.color }} />{t.name}</div>
              <div className="flex flex-wrap gap-1.5">{fs.map(s => <button key={s} type="button" onClick={() => onCreate(s, t.id, true)} className="tnum h-9 rounded-lg border border-ok/40 bg-surface px-3 text-sm">{hm(s)}</button>)}</div></div>
          ) : null; })}
        </div>
      )}
    </div>
  );
}

