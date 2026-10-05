/* «Сегодня» — экран, с которого администратор начинает день. Только то, что требует действия, и действие — в один клик. */
import { useMemo, useState } from 'react';
import { Inbox, Bell, CalendarClock, ClipboardCheck, Send, Phone, Check, X, Wallet, ChevronRight, Sparkles, Video, Plus } from 'lucide-react';
import { useDB, undo } from '../data/store';
import * as A from '../data/actions';
import { balanceMap, isOverdue, isUnanswered, lessonTitle, teacherById, unmarkedLessons, contactPhone, lessonEnd, lessonsInRange, lessonStudents } from '../data/selectors';
import { addDays, elapsed, hm, plural, startOfDay, when } from '../lib/format';
import { digits } from '../lib/phone';
import { Badge, Button, Card, CardTitle, Empty, LinkButton, cx } from '../ui/kit';
import { ChannelTag } from '../ui/domain';
import { toast } from '../ui/overlay';
import { useApp } from '../app/ctx';
import { Row as ReminderRow } from './Reminders';

const undoAction = { label: 'Отменить', run: () => { if (undo()) toast('Изменение отменено', { tone: 'info' }); } };
const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'; };
const longDate = () => { const t = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }); return t[0].toUpperCase() + t.slice(1); };

export function Today() {
  const { role } = useApp();
  return role === 'teacher' ? <TeacherToday /> : <AdminToday />;
}

function AdminToday() {
  const db = useDB();
  const { user, openDrawer, openModal, fmt, go } = useApp();
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
    const debtors = active.filter(x => bal.get(x.id)!.left < 0).sort((a, b) => bal.get(b.id)!.debt - bal.get(a.id)!.debt);
    const low = active.filter(x => { const b = bal.get(x.id)!; return b.left >= 0 && b.left <= s.lowBalance && x.status === 'active'; }).sort((a, b) => bal.get(a.id)!.left - bal.get(b.id)!.left);
    return { bal, reply, tasks, trials, unmarked, money: [...debtors, ...low] };
  }, [db, now, today0, tomorrow0, s.lowBalance]);

  const overdueN = data.reply.filter(l => isOverdue(l, s.slaHours, now)).length;
  const todo = data.reply.length + data.tasks.length + data.unmarked.length;
  const [intro, setIntro] = useState(() => { try { return !localStorage.getItem('lcrm-intro-done'); } catch { return true; } });
  const closeIntro = () => { setIntro(false); try { localStorage.setItem('lcrm-intro-done', '1'); } catch { /* */ } };

  return (
    <div className="grid grid-cols-1 gap-5">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.025em] md:text-[26px]">{greet()}, {user.name.split(' ')[0]}</h2>
        <p className="mt-0.5 text-sm text-ink-2">{longDate()} · {todo ? plural(todo, 'дело ждёт', 'дела ждут', 'дел ждут') + ' вас' : 'срочных дел нет'}</p>
      </div>

      {/* как пользоваться — три шага, закрывается навсегда */}
      {intro && (
        <Card className="relative border-accent/25 bg-accent-soft/40">
          <button type="button" onClick={closeIntro} className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface hover:text-ink" aria-label="Скрыть подсказку"><X className="size-4" /></button>
          <div className="pr-8 text-[15px] font-semibold">Как работать с CRM — три шага</div>
          <ol className="mt-3 grid gap-2.5 md:grid-cols-3">
            {[
              { n: 1, title: 'Ответьте на заявку', text: 'Новые заявки — ниже и в разделе «Заявки». Нажмите «Написать»: текст уже готов.', to: 'leads' as const },
              { n: 2, title: 'Запишите на пробный', text: 'В карточке заявки — «Записать на пробный»: выберите день и время.', to: 'schedule' as const },
              { n: 3, title: 'Примите оплату', text: 'После пробного — «Принять оплату». Заявка станет учеником, уроки спишутся сами.', to: 'payments' as const },
            ].map(x => (
              <li key={x.n}>
                <button type="button" onClick={() => go(x.to)} className="flex h-full w-full gap-3 rounded-xl bg-surface p-3 text-left shadow-card hover:shadow-pop">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-white dark:text-[#101018]">{x.n}</span>
                  <span><span className="block text-sm font-medium">{x.title}</span><span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{x.text}</span></span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex justify-end"><Button variant="ghost" size="sm" onClick={closeIntro}>Понятно, скрыть</Button></div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          {/* 1. заявки без ответа */}
          <Card pad={false} className="overflow-hidden">
            <div className="px-4 pt-4 sm:px-5"><CardTitle icon={Inbox} tone={overdueN ? 'bad' : 'accent'} count={data.reply.length}>Ответить на заявки</CardTitle></div>
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

          {/* 2. напоминания */}
          <Card pad={false} className="overflow-hidden">
            <div className="px-4 pt-4 sm:px-5"><CardTitle icon={Bell} count={data.tasks.length} action={<Button variant="ghost" size="sm" iconRight={ChevronRight} onClick={() => go('reminders')}>Календарь</Button>}>Напоминания на сегодня</CardTitle></div>
            {data.tasks.length
              ? <ul className="divide-y divide-line">{data.tasks.map(t => <ReminderRow key={t.id} t={t} showDate={t.due < today0} />)}</ul>
              : <Empty compact icon={Sparkles} title="На сегодня напоминаний нет" action={<Button variant="soft" size="sm" icon={Plus} onClick={() => go('reminders')}>Добавить напоминание</Button>}>Их можно ставить в календаре или из карточки заявки: «Напомнить завтра в 10:00».</Empty>}
          </Card>
        </div>

        <div className="grid content-start gap-5">
          {/* 3. сегодня в расписании: пробные и неотмеченные занятия */}
          <Card pad={false} className="overflow-hidden">
            <div className="px-4 pt-4 sm:px-5"><CardTitle icon={CalendarClock} tone="warn" count={data.trials.length + data.unmarked.length}>Занятия: что сделать</CardTitle></div>
            {data.trials.length + data.unmarked.length ? (
              <ul className="divide-y divide-line">
                {data.trials.map(tr => {
                  const lead = db.leads.find(l => l.id === tr.leadId); const t = teacherById(db, tr.teacherId);
                  const started = tr.start < now + 15 * 60000;
                  return (
                    <li key={tr.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <div className="tnum w-12 shrink-0 text-[15px] font-semibold">{hm(tr.start)}</div>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDrawer({ type: 'lesson', id: tr.id })}>
                        <div className="truncate font-medium">Пробный · {lead?.name}</div>
                        <div className="flex items-center gap-1.5 text-xs text-ink-3"><span className="size-2 rounded-full" style={{ background: t?.color }} aria-hidden />{t?.name}</div>
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
                {data.unmarked.map(l => { const t = teacherById(db, l.teacherId); return (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: t?.color }} aria-hidden />
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{lessonTitle(db, l)}</div><div className="text-xs text-ink-3">{when(l.start)} · не отмечено, кто был</div></div>
                    <Button variant="soft" size="sm" onClick={() => openDrawer({ type: 'lesson', id: l.id })}>Отметить</Button>
                  </li>
                ); })}
              </ul>
            ) : <Empty compact icon={Check} title="По занятиям всё сделано">Здесь появятся пробные уроки на сегодня и занятия, где не отмечено, кто был.</Empty>}
          </Card>

          {/* 4. деньги: долги и заканчивающиеся абонементы */}
          <Card pad={false} className="overflow-hidden">
            <div className="px-4 pt-4 sm:px-5"><CardTitle icon={Wallet} tone={data.money.length ? 'bad' : 'neutral'} count={data.money.length}>Оплаты: кому напомнить</CardTitle></div>
            {data.money.length ? (
              <ul className="divide-y divide-line">
                {data.money.slice(0, 6).map(st => { const b = data.bal.get(st.id)!; const debt = b.left < 0; return (
                  <li key={st.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDrawer({ type: 'student', id: st.id })}>
                      <div className="truncate text-sm font-medium">{st.name}</div>
                      <div className={cx('text-xs', debt ? 'text-bad' : 'text-ink-3')}>{debt ? 'долг ' + fmt(b.debt) : b.left === 0 ? 'уроки закончились' : 'осталось ' + plural(b.left, 'урок', 'урока', 'уроков')}</div>
                    </button>
                    <Button variant="ghost" size="sm" icon={Send} onClick={() => openModal({ type: 'message', to: { kind: 'student', id: st.id }, template: debt ? 'payment_reminder' : 'low_balance' })} aria-label="Написать" title="Написать" disabled={!contactPhone(db, st)} />
                    <Button variant="soft" size="sm" icon={Wallet} onClick={() => openModal({ type: 'payment', studentId: st.id })}><span className="max-sm:hidden">Принять оплату</span></Button>
                  </li>
                ); })}
                {data.money.length > 6 && <li><button type="button" onClick={() => go('payments')} className="flex h-11 w-full items-center justify-center gap-1 text-[13px] font-medium text-accent-ink hover:bg-surface-2">Ещё {data.money.length - 6} — открыть «Оплаты»<ChevronRight className="size-4" aria-hidden /></button></li>}
              </ul>
            ) : <Empty compact icon={Check} title="Долгов нет, у всех есть уроки">Здесь появятся должники и те, у кого заканчивается абонемент.</Empty>}
          </Card>
        </div>
      </div>
    </div>
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
