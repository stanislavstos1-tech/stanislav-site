/* «Сегодня» — экран, с которого администратор начинает день. Только то, что требует действия, и действие — в один клик. */
import { useMemo } from 'react';
import { Inbox, ListTodo, CalendarClock, ClipboardCheck, BatteryLow, CircleDollarSign, Send, Phone, Check, X, Wallet, ChevronRight, Sparkles, Video } from 'lucide-react';
import { useDB, undo } from '../data/store';
import * as A from '../data/actions';
import { balanceMap, isOverdue, isUnanswered, lessonTitle, teacherById, unmarkedLessons, studentGroups, contactPhone, lessonEnd, lessonsInRange, lessonStudents } from '../data/selectors';
import { addDays, dayDiff, elapsed, hm, plural, startOfDay, dateShort, when } from '../lib/format';
import { digits } from '../lib/phone';
import { Badge, Button, Card, CardTitle, Empty, LinkButton, cx } from '../ui/kit';
import type { Tone } from '../ui/kit';
import { ChannelTag } from '../ui/domain';
import { toast } from '../ui/overlay';
import { useApp } from '../app/ctx';
import type { LucideIcon } from 'lucide-react';

const undoAction = { label: 'Отменить', run: () => { if (undo()) toast('Изменение отменено', { tone: 'info' }); } };
const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'; };
const longDate = () => { const t = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }); return t[0].toUpperCase() + t.slice(1); };

export function Today() {
  const { role } = useApp();
  return role === 'teacher' ? <TeacherToday /> : <AdminToday />;
}

function AdminToday() {
  const db = useDB();
  const { user, openDrawer, openModal, fmt } = useApp();
  const now = Date.now();
  const s = db.settings;
  const today0 = startOfDay(now), tomorrow0 = addDays(today0, 1);

  const data = useMemo(() => {
    const bal = balanceMap(db);
    const reply = db.leads.filter(isUnanswered).sort((a, b) => a.createdAt - b.createdAt);
    const tasks = db.tasks.filter(t => !t.done && t.due < tomorrow0).sort((a, b) => a.due - b.due);
    const trials = db.lessons.filter(l => l.kind === 'trial' && l.start >= today0 && l.start < tomorrow0 && l.status !== 'canceled').sort((a, b) => a.start - b.start);
    const unmarked = unmarkedLessons(db, now).filter(l => l.kind !== 'trial');
    const active = db.students.filter(x => x.status !== 'left');
    const low = active.filter(x => { const b = bal.get(x.id)!; return b.left >= 0 && b.left <= s.lowBalance && x.status === 'active'; }).sort((a, b) => bal.get(a.id)!.left - bal.get(b.id)!.left);
    const debtors = active.filter(x => bal.get(x.id)!.left < 0).sort((a, b) => bal.get(b.id)!.debt - bal.get(a.id)!.debt);
    return { bal, reply, tasks, trials, unmarked, low, debtors };
  }, [db, now, today0, tomorrow0, s.lowBalance]);

  const overdueN = data.reply.filter(l => isOverdue(l, s.slaHours, now)).length;
  const debtSum = data.debtors.reduce((x, st) => x + data.bal.get(st.id)!.debt, 0);
  const todo = data.reply.length + data.tasks.length + data.unmarked.length;

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.025em] md:text-[26px]">{greet()}, {user.name.split(' ')[0]}</h2>
          <p className="mt-0.5 text-sm text-ink-2">{longDate()} · {todo ? plural(todo, 'дело ждёт', 'дела ждут', 'дел ждут') + ' вас' : 'срочных дел нет'}</p>
        </div>
      </div>

      {/* сводка — нажатие прокручивает к блоку */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Tile icon={Inbox} label="Ответить на заявки" value={data.reply.length} sub={overdueN ? `${overdueN} ждут дольше ${s.slaHours} ч` : 'все вовремя'} tone={overdueN ? 'bad' : 'accent'} to="t-reply" />
        <Tile icon={CalendarClock} label="Пробные сегодня" value={data.trials.length} sub={data.trials[0] ? 'ближайший в ' + hm(data.trials.find(t => t.start > now)?.start || data.trials[0].start) : 'нет'} tone="warn" to="t-trials" />
        <Tile icon={ClipboardCheck} label="Без отметки" value={data.unmarked.length} sub="занятий за 2 недели" tone={data.unmarked.length ? 'warn' : 'neutral'} to="t-unmarked" />
        <Tile icon={CircleDollarSign} label="Должники" value={data.debtors.length} sub={debtSum ? fmt(debtSum) : 'долгов нет'} tone={data.debtors.length ? 'bad' : 'neutral'} to="t-debt" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          {/* заявки без ответа */}
          <Card pad={false} className="overflow-hidden">
            <div id="t-reply" className="scroll-mt-24 px-4 pt-4 sm:px-5"><CardTitle icon={Inbox} tone={overdueN ? 'bad' : 'accent'} count={data.reply.length}>Ответить на заявки</CardTitle></div>
            {data.reply.length ? (
              <ul className="divide-y divide-line">
                {data.reply.map(l => {
                  const over = isOverdue(l, s.slaHours, now);
                  return (
                    <li key={l.id} className={cx('flex items-center gap-3 px-4 py-3 sm:px-5', over && 'bg-bad-soft/60')}>
                      <button type="button" onClick={() => openDrawer({ type: 'lead', id: l.id })} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2"><span className="truncate font-medium">{l.name}</span><Badge tone={over ? 'bad' : 'neutral'} title="Сколько ждёт ответа">{over ? 'ждёт ' : ''}{elapsed(l.createdAt)}</Badge></div>
                        <div className="mt-0.5 flex min-w-0 items-center gap-2"><ChannelTag channel={l.channel} /><span className="truncate text-xs text-ink-3">{l.comment}</span></div>
                      </button>
                      <LinkButton href={'tel:+' + digits(l.phone)} icon={Phone} size="sm" title="Позвонить" onClick={() => A.markReplied(l.id, 'Позвонили')} className="max-sm:hidden" />
                      <Button variant={over ? 'primary' : 'soft'} size="sm" icon={Send} onClick={() => openModal({ type: 'message', to: { kind: 'lead', id: l.id }, template: 'greeting' })}>Написать</Button>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty compact icon={Check} title="Все заявки получили ответ">Новые появятся здесь. Если человек ждёт дольше {s.slaHours} ч, строка подсветится красным.</Empty>}
          </Card>

          {/* задачи */}
          <Card pad={false} className="overflow-hidden">
            <div className="px-4 pt-4 sm:px-5"><CardTitle icon={ListTodo} count={data.tasks.length}>Задачи на сегодня</CardTitle></div>
            {data.tasks.length ? (
              <ul className="divide-y divide-line">
                {data.tasks.map(t => {
                  const late = t.due < now;
                  const rel = t.leadId ? db.leads.find(l => l.id === t.leadId) : t.studentId ? db.students.find(x => x.id === t.studentId) : undefined;
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                      <button type="button" onClick={() => { A.toggleTask(t.id); toast('Задача выполнена', { action: undoAction }); }} aria-label="Выполнено"
                        className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-line-2 text-transparent transition-colors duration-150 hover:border-ok hover:text-ok"><Check className="size-3.5" strokeWidth={3} /></button>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => rel && openDrawer({ type: t.leadId ? 'lead' : 'student', id: rel.id })}>
                        <div className="text-sm">{t.title}</div>
                        {rel && <div className="truncate text-xs text-ink-3">{rel.name}</div>}
                      </button>
                      <Badge tone={late ? 'bad' : 'neutral'}>{late && dayDiff(t.due) < 0 ? dateShort(t.due) : hm(t.due)}</Badge>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty compact icon={Sparkles} title="Задач на сегодня нет">Напоминания ставятся из карточки заявки: «Напомнить завтра в 10:00».</Empty>}
          </Card>

          {/* пробные */}
          <Card pad={false} className="overflow-hidden">
            <div id="t-trials" className="scroll-mt-24 px-4 pt-4 sm:px-5"><CardTitle icon={CalendarClock} tone="warn" count={data.trials.length}>Пробные сегодня</CardTitle></div>
            {data.trials.length ? (
              <ul className="divide-y divide-line">
                {data.trials.map(tr => {
                  const lead = db.leads.find(l => l.id === tr.leadId); const t = teacherById(db, tr.teacherId);
                  const started = tr.start < now + 15 * 60000;
                  return (
                    <li key={tr.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <div className="tnum w-12 shrink-0 text-[15px] font-semibold">{hm(tr.start)}</div>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDrawer({ type: 'lesson', id: tr.id })}>
                        <div className="truncate font-medium">{lead?.name}</div>
                        <div className="flex items-center gap-1.5 text-xs text-ink-3"><span className="size-2 rounded-full" style={{ background: t?.color }} aria-hidden />{t?.name}{lead?.goal ? ' · ' + lead.goal : ''}</div>
                      </button>
                      {tr.status === 'done' ? <Badge tone="ok" icon={Check}>Прошёл</Badge> : started && lead ? (
                        <div className="flex gap-1.5">
                          <Button variant="ok" size="sm" icon={Check} onClick={() => { A.trialResult(lead.id, true); toast('Пробный прошёл', { action: undoAction }); }}>Пришёл</Button>
                          <Button variant="ghost" size="sm" icon={X} onClick={() => { A.trialResult(lead.id, false); toast('Не пришёл — перезапишите на другое время', { tone: 'info', action: undoAction }); }} aria-label="Не пришёл" title="Не пришёл" />
                        </div>
                      ) : lead && <Button variant="soft" size="sm" icon={Send} onClick={() => openModal({ type: 'message', to: { kind: 'lead', id: lead.id }, template: 'trial_reminder' })}>Напомнить</Button>}
                    </li>
                  );
                })}
              </ul>
            ) : <Empty compact icon={CalendarClock} title="Сегодня пробных нет">Запишите кого-нибудь из заявок — свободные окна видны в расписании.</Empty>}
          </Card>
        </div>

        <div className="grid content-start gap-5">
          {/* без отметки */}
          <Card pad={false} className="overflow-hidden">
            <div id="t-unmarked" className="scroll-mt-24 px-4 pt-4 sm:px-5"><CardTitle icon={ClipboardCheck} tone={data.unmarked.length ? 'warn' : 'neutral'} count={data.unmarked.length}>Занятия без отметки</CardTitle></div>
            {data.unmarked.length ? (
              <ul className="divide-y divide-line">
                {data.unmarked.map(l => { const t = teacherById(db, l.teacherId); return (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: t?.color }} aria-hidden />
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{lessonTitle(db, l)}</div><div className="text-xs text-ink-3">{when(l.start)} · {t?.name}</div></div>
                    <Button variant="soft" size="sm" onClick={() => openDrawer({ type: 'lesson', id: l.id })}>Отметить</Button>
                  </li>
                ); })}
              </ul>
            ) : <Empty compact icon={Check} title="Посещаемость отмечена">Без отметки остаток уроков считается неточно — поэтому такие занятия собраны здесь.</Empty>}
          </Card>

          {/* заканчиваются абонементы */}
          <Card pad={false} className="overflow-hidden">
            <div className="px-4 pt-4 sm:px-5"><CardTitle icon={BatteryLow} tone="warn" count={data.low.length}>Заканчиваются абонементы</CardTitle></div>
            {data.low.length ? (
              <ul className="divide-y divide-line">
                {data.low.map(st => { const b = data.bal.get(st.id)!; return (
                  <li key={st.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDrawer({ type: 'student', id: st.id })}>
                      <div className="truncate text-sm font-medium">{st.name}</div>
                      <div className="truncate text-xs text-ink-3">{studentGroups(db, st.id)[0]?.name || 'Индивидуально'}</div>
                    </button>
                    <Badge tone="warn">{b.left === 0 ? '0 уроков' : plural(b.left, 'урок', 'урока', 'уроков')}</Badge>
                    <Button variant="ghost" size="sm" icon={Send} onClick={() => openModal({ type: 'message', to: { kind: 'student', id: st.id }, template: 'low_balance' })} aria-label="Напомнить о продлении" title="Напомнить о продлении" disabled={!contactPhone(db, st)} />
                    <Button variant="soft" size="sm" icon={Wallet} onClick={() => openModal({ type: 'payment', studentId: st.id })}><span className="max-sm:hidden">Оплата</span></Button>
                  </li>
                ); })}
              </ul>
            ) : <Empty compact icon={Check} title="У всех есть запас занятий">Здесь появятся ученики, у которых осталось {plural(s.lowBalance, 'занятие', 'занятия', 'занятий')} или меньше.</Empty>}
          </Card>

          {/* должники */}
          <Card pad={false} className="overflow-hidden">
            <div id="t-debt" className="scroll-mt-24 px-4 pt-4 sm:px-5"><CardTitle icon={CircleDollarSign} tone={data.debtors.length ? 'bad' : 'neutral'} count={data.debtors.length}>Должники</CardTitle></div>
            {data.debtors.length ? (
              <ul className="divide-y divide-line">
                {data.debtors.map(st => { const b = data.bal.get(st.id)!; return (
                  <li key={st.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDrawer({ type: 'student', id: st.id })}>
                      <div className="truncate text-sm font-medium">{st.name}</div>
                      <div className="text-xs text-ink-3">{plural(-b.left, 'урок', 'урока', 'уроков')} без оплаты</div>
                    </button>
                    <span className="tnum text-sm font-semibold text-bad">{fmt(b.debt)}</span>
                    <Button variant="ghost" size="sm" icon={Send} onClick={() => openModal({ type: 'message', to: { kind: 'student', id: st.id }, template: 'payment_reminder' })} aria-label="Напомнить об оплате" title="Напомнить об оплате" disabled={!contactPhone(db, st)} />
                    <Button variant="soft" size="sm" icon={Wallet} onClick={() => openModal({ type: 'payment', studentId: st.id })}><span className="max-sm:hidden">Принять</span></Button>
                  </li>
                ); })}
              </ul>
            ) : <Empty compact icon={Check} title="Долгов нет">Ученик попадает сюда, если занятий проведено больше, чем оплачено.</Empty>}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon: I, label, value, sub, tone, to }: { icon: LucideIcon; label: string; value: number; sub: string; tone: Tone; to: string }) {
  const T: Record<Tone, string> = { neutral: 'bg-surface-2 text-ink-2', accent: 'bg-accent-soft text-accent-ink', ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', info: 'bg-info-soft text-info' };
  return (
    <button type="button" onClick={() => document.getElementById(to)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      className="group rounded-[16px] border border-line bg-surface p-3.5 text-left shadow-card transition-[border-color] duration-150 hover:border-line-2 sm:p-4">
      <div className="flex items-center justify-between"><span className={cx('grid size-8 place-items-center rounded-[10px]', T[tone])}><I className="size-4" aria-hidden /></span><ChevronRight className="size-4 text-ink-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100" aria-hidden /></div>
      <div className={cx('tnum mt-3 text-[28px] font-semibold leading-none tracking-[-0.03em]', tone === 'bad' && value ? 'text-bad' : '')}>{value}</div>
      <div className="mt-1.5 text-[13px] font-medium leading-tight">{label}</div>
      <div className="mt-0.5 truncate text-xs text-ink-3">{sub}</div>
    </button>
  );
}

/* ---------- преподаватель: свой день ---------- */
function TeacherToday() {
  const db = useDB();
  const { user, openDrawer } = useApp();
  const now = Date.now(), d0 = startOfDay(now);
  const t = teacherById(db, user.teacherId)!;
  const lessons = lessonsInRange(db, d0, addDays(d0, 1), t.id).filter(l => l.status !== 'canceled');
  const unmarked = unmarkedLessons(db, now, t.id).filter(l => !lessons.includes(l));
  const tomorrow = lessonsInRange(db, addDays(d0, 1), addDays(d0, 2), t.id).filter(l => l.status !== 'canceled');
  const Row = ({ l }: { l: (typeof lessons)[number] }) => {
    const ended = lessonEnd(l) < now, live = l.start <= now && !ended;
    return (
      <li className={cx('flex items-center gap-3 px-4 py-3 sm:px-5', live && 'bg-accent-soft/60')}>
        <div className="w-14 shrink-0"><div className="tnum text-[15px] font-semibold">{hm(l.start)}</div><div className="tnum text-xs text-ink-3">{hm(lessonEnd(l))}</div></div>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDrawer({ type: 'lesson', id: l.id })}>
          <div className="truncate font-medium">{lessonTitle(db, l)}</div>
          <div className="text-xs text-ink-3">{l.kind === 'trial' ? 'Пробный урок' : plural(lessonStudents(db, l).length, 'ученик', 'ученика', 'учеников')}{live ? ' · идёт сейчас' : ''}</div>
        </button>
        {l.status === 'done' ? <Badge tone="ok" icon={Check}>Отмечено</Badge> : ended || live ? <Button variant="primary" size="sm" onClick={() => openDrawer({ type: 'lesson', id: l.id })}>Отметить</Button> : <Button variant="ghost" size="sm" icon={Video} onClick={() => openDrawer({ type: 'lesson', id: l.id })}>Созвон</Button>}
      </li>
    );
  };
  return (
    <div className="grid grid-cols-1 gap-5">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.025em] md:text-[26px]">{greet()}, {user.name.split(' ')[0]}</h2>
        <p className="mt-0.5 text-sm text-ink-2">{longDate()} · {lessons.length ? plural(lessons.length, 'занятие', 'занятия', 'занятий') + ' сегодня' : 'сегодня занятий нет'}</p>
      </div>
      {unmarked.length > 0 && (
        <Card pad={false} className="overflow-hidden border-warn/30">
          <div className="px-4 pt-4 sm:px-5"><CardTitle icon={ClipboardCheck} tone="warn" count={unmarked.length}>Отметьте прошедшие занятия</CardTitle></div>
          <ul className="divide-y divide-line">{unmarked.map(l => <Row key={l.id} l={l} />)}</ul>
        </Card>
      )}
      <Card pad={false} className="overflow-hidden">
        <div className="px-4 pt-4 sm:px-5"><CardTitle icon={CalendarClock} count={lessons.length}>Мои занятия сегодня</CardTitle></div>
        {lessons.length ? <ul className="divide-y divide-line">{lessons.map(l => <Row key={l.id} l={l} />)}</ul> : <Empty compact icon={Sparkles} title="Сегодня свободный день" />}
      </Card>
      <Card pad={false} className="overflow-hidden">
        <div className="px-4 pt-4 sm:px-5"><CardTitle icon={CalendarClock} count={tomorrow.length}>Завтра</CardTitle></div>
        {tomorrow.length ? <ul className="divide-y divide-line">{tomorrow.map(l => <Row key={l.id} l={l} />)}</ul> : <Empty compact title="Завтра занятий нет" />}
      </Card>
    </div>
  );
}
