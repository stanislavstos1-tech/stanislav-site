/* «Сегодня» — экран, с которого начинается день. Только то, что требует действия, и действие — в один клик. */
import { useMemo, useState } from 'react';
import { Inbox, Bell, Video, Wallet, Send, Phone, Check, X, ChevronRight, Sparkles, Plus, FileCheck2, RotateCcw, CalendarDays, UserX } from 'lucide-react';
import { useDB, undo } from '../data/store';
import * as A from '../data/actions';
import { isOverdue, isUnanswered, callsOn, dueUntil, isLate, reviewQueue, isReviewLate, currentCohort, nextLesson, currentBlock, notSubmitted, groupOf } from '../data/selectors';
import { addDays, elapsed, hm, plural, startOfDay, dateShort, when, ago } from '../lib/format';
import { digits } from '../lib/phone';
import { BLOCKS, KIND_LABEL } from '../domain/labels';
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
  return role === 'curator' ? <CuratorToday /> : <SalesToday />;
}

function Hello({ name, sub }: { name: string; sub: string }) {
  return (
    <div>
      <h2 className="display text-[24px] font-bold leading-tight md:text-[30px]">{greet()}, {name.split(' ')[0]}</h2>
      <p className="mt-1.5 text-sm text-ink-2">{longDate()} · {sub}</p>
    </div>
  );
}

/* ---------- администратор и менеджер ---------- */
function SalesToday() {
  const db = useDB();
  const { user, role, openDrawer, openModal, fmt, go } = useApp();
  const now = Date.now(), s = db.settings;
  const today0 = startOfDay(now), tomorrow0 = addDays(today0, 1);

  const data = useMemo(() => ({
    reply: db.leads.filter(isUnanswered).sort((a, b) => a.createdAt - b.createdAt),
    calls: callsOn(db, today0),
    tasks: db.tasks.filter(t => !t.done && t.due < tomorrow0).sort((a, b) => a.due - b.due),
    pays: dueUntil(db, addDays(today0, 8)).filter(i => db.students.find(st => st.id === i.studentId)?.status !== 'left'),
    review: reviewQueue(db).length,
  }), [db, today0, tomorrow0]);

  const overdueN = data.reply.filter(l => isOverdue(l, s.slaHours, now)).length;
  const todo = data.reply.length + data.tasks.length + data.calls.filter(c => c.status === 'call_booked').length;
  const [intro, setIntro] = useState(() => { try { return !localStorage.getItem('srez-crm-intro'); } catch { return true; } });
  const closeIntro = () => { setIntro(false); try { localStorage.setItem('srez-crm-intro', '1'); } catch { /* */ } };

  return (
    <div className="grid grid-cols-1 gap-5">
      <Hello name={user.name} sub={todo ? plural(todo, 'дело ждёт', 'дела ждут', 'дел ждут') + ' вас' : 'срочных дел нет'} />

      {intro && (
        <Card className="relative border-accent/30">
          <button type="button" onClick={closeIntro} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Скрыть подсказку"><X className="size-4" /></button>
          <div className="label text-accent-ink">Как работать с CRM</div>
          <ol className="mt-3 grid gap-2.5 md:grid-cols-3">
            {[
              { n: '01', title: 'Ответьте на заявку', text: 'Новые заявки — ниже и в «Заявках». «Написать» откроет Telegram с готовым текстом.', to: 'leads' as const },
              { n: '02', title: 'Назначьте созвон', text: '30 минут: задача человека, формат, рассрочка. После — «Созвон прошёл».', to: 'leads' as const },
              { n: '03', title: 'Примите оплату', text: 'Заявка станет участником потока, график рассрочки построится сам.', to: 'payments' as const },
            ].map(x => (
              <li key={x.n}>
                <button type="button" onClick={() => go(x.to)} className="flex h-full w-full gap-3 rounded-[18px] bg-surface-2 p-3.5 text-left transition-colors hover:bg-surface-3">
                  <span className="display text-[20px] font-black leading-none text-accent-ink">{x.n}</span>
                  <span><span className="block text-sm font-semibold">{x.title}</span><span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{x.text}</span></span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex justify-end"><Button variant="ghost" size="sm" onClick={closeIntro}>Понятно, скрыть</Button></div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          {/* заявки без ответа */}
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
            ) : <Empty compact icon={Check} title="Все заявки получили ответ">Если человек ждёт дольше {s.slaHours} ч, строка подсветится красным.</Empty>}
          </Card>

          {/* напоминания */}
          <Card pad={false} className="overflow-hidden">
            <div className="px-4 pt-4 sm:px-5"><CardTitle icon={Bell} count={data.tasks.length} action={<Button variant="ghost" size="sm" iconRight={ChevronRight} onClick={() => go('reminders')}>Календарь</Button>}>Напоминания</CardTitle></div>
            {data.tasks.length
              ? <ul className="divide-y divide-line">{data.tasks.map(t => <ReminderRow key={t.id} t={t} showDate={t.due < today0} />)}</ul>
              : <Empty compact icon={Sparkles} title="На сегодня напоминаний нет" action={<Button variant="soft" size="sm" icon={Plus} onClick={() => go('reminders')}>Добавить</Button>}>Ставьте их в календаре или из карточки заявки.</Empty>}
          </Card>
        </div>

        <div className="grid content-start gap-5">
          {/* созвоны сегодня */}
          <Card pad={false} className="overflow-hidden">
            <div className="px-4 pt-4 sm:px-5"><CardTitle icon={Video} tone="warn" count={data.calls.length}>Созвоны сегодня</CardTitle></div>
            {data.calls.length ? (
              <ul className="divide-y divide-line">
                {data.calls.map(l => {
                  const started = l.callAt! < now + 15 * 60000;
                  return (
                    <li key={l.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <div className="display tnum w-14 shrink-0 text-[15px] font-bold">{hm(l.callAt!)}</div>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDrawer({ type: 'lead', id: l.id })}>
                        <div className="truncate font-medium">{l.name}</div>
                        <div className="truncate text-xs text-ink-3">{l.position || 'Маркетинг'} · интересует {l.tariff === 'live' ? 'живой поток' : 'записи'}</div>
                      </button>
                      {l.status === 'call_done' ? <Badge tone="ok" icon={Check}>Прошёл</Badge> : started ? (
                        <div className="flex gap-1.5">
                          <Button variant="ok" size="sm" icon={Check} onClick={() => { A.callResult(l.id, true); toast('Созвон прошёл — отправьте ссылку на оплату', { action: undoAction }); }}>Прошёл</Button>
                          <Button variant="ghost" size="sm" icon={X} onClick={() => { A.callResult(l.id, false); toast('Не вышел — договоритесь о новом времени', { tone: 'info', action: undoAction }); }} aria-label="Не вышел" title="Не вышел" />
                        </div>
                      ) : <Button variant="soft" size="sm" icon={Send} onClick={() => openModal({ type: 'message', to: { kind: 'lead', id: l.id }, template: 'call_reminder' })}>Напомнить</Button>}
                    </li>
                  );
                })}
              </ul>
            ) : <Empty compact icon={Video} title="Сегодня созвонов нет">Назначьте созвон из карточки заявки — он появится здесь.</Empty>}
          </Card>

          {/* платежи */}
          <Card pad={false} className="overflow-hidden">
            <div className="px-4 pt-4 sm:px-5"><CardTitle icon={Wallet} tone={data.pays.some(i => isLate(i)) ? 'bad' : 'neutral'} count={data.pays.length} action={<Button variant="ghost" size="sm" iconRight={ChevronRight} onClick={() => go('payments')}>Все оплаты</Button>}>Платежи: просрочки и неделя</CardTitle></div>
            {data.pays.length ? (
              <ul className="divide-y divide-line">
                {data.pays.slice(0, 6).map(i => {
                  const st = db.students.find(x => x.id === i.studentId)!; const late = isLate(i);
                  return (
                    <li key={i.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDrawer({ type: 'student', id: st.id })}>
                        <div className="truncate text-sm font-medium">{st.name}</div>
                        <div className={cx('text-xs', late ? 'text-bad' : 'text-ink-3')}>{late ? 'просрочен с ' + dateShort(i.due) : 'до ' + dateShort(i.due)} · платёж {i.n}/{i.of}</div>
                      </button>
                      <span className="tnum text-sm font-semibold">{fmt(i.amount)}</span>
                      <Button variant="ghost" size="sm" icon={Send} onClick={() => openModal({ type: 'message', to: { kind: 'student', id: st.id }, template: 'installment_due' })} aria-label="Напомнить" title="Напомнить" />
                      <Button variant="soft" size="sm" icon={Wallet} onClick={() => openModal({ type: 'pay', studentId: st.id })}><span className="max-sm:hidden">Принять</span></Button>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty compact icon={Check} title="Платежей на неделе нет">Здесь появятся платежи по рассрочке на ближайшие 7 дней и просрочки.</Empty>}
          </Card>

          {role === 'admin' && data.review > 0 && (
            <button type="button" onClick={() => go('homework')} className="flex items-center gap-3 rounded-[22px] border border-line bg-surface px-4 py-3.5 text-left hover:border-line-2 sm:px-5">
              <span className="grid size-8 place-items-center rounded-full bg-warn-soft text-warn"><FileCheck2 className="size-4" aria-hidden /></span>
              <span className="flex-1 text-sm"><b>{plural(data.review, 'работа ждёт', 'работы ждут', 'работ ждут')}</b> проверки кураторами</span>
              <ChevronRight className="size-4 text-ink-3" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- куратор: проверка работ своей группы ---------- */
function CuratorToday() {
  const db = useDB();
  const { user, openDrawer, openModal, go } = useApp();
  const now = Date.now();
  const cohort = currentCohort(db, now);
  const queue = reviewQueue(db, user.curatorId);
  const next = nextLesson(db, cohort.id, now);
  const block = currentBlock(db, cohort.id, now);
  const mine = new Set(db.groups.filter(g => g.curatorId === user.curatorId).flatMap(g => g.studentIds));
  const missing = notSubmitted(db, cohort.id, block).filter(s => mine.has(s.id));
  return (
    <div className="grid grid-cols-1 gap-5">
      <Hello name={user.name} sub={queue.length ? plural(queue.length, 'работа ждёт', 'работы ждут', 'работ ждут') + ' проверки' : 'все работы проверены'} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card pad={false} className="overflow-hidden">
          <div className="px-4 pt-4 sm:px-5"><CardTitle icon={FileCheck2} tone={queue.length ? 'warn' : 'ok'} count={queue.length} action={<Button variant="ghost" size="sm" iconRight={ChevronRight} onClick={() => go('homework')}>Все работы</Button>}>На проверке</CardTitle></div>
          {queue.length ? (
            <ul className="divide-y divide-line">
              {queue.map(h => {
                const st = db.students.find(s => s.id === h.studentId)!; const late = isReviewLate(h, db.settings.reviewDays, now);
                return (
                  <li key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDrawer({ type: 'student', id: st.id })}>
                      <div className="truncate font-medium">{st.name}</div>
                      <div className={cx('truncate text-xs', late ? 'text-bad' : 'text-ink-3')}>{h.title} · сдано {ago(h.submittedAt)}</div>
                    </button>
                    <div className="flex gap-1.5">
                      <Button variant="ok" size="sm" icon={Check} onClick={() => { A.acceptHomework(h.id); toast('Работа принята', { action: undoAction }); }}>Принять</Button>
                      <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => openModal({ type: 'returnHw', homeworkId: h.id })}>На доработку</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <Empty compact icon={Check} title="Очередь пуста">Новые работы группы появятся здесь. Проверять — в течение {plural(db.settings.reviewDays, 'дня', 'дней', 'дней')}.</Empty>}
        </Card>
        <div className="grid content-start gap-5">
          {next && (
            <Card>
              <CardTitle icon={CalendarDays}>Ближайшее занятие</CardTitle>
              <button type="button" onClick={() => openDrawer({ type: 'lesson', id: next.id })} className="w-full text-left">
                <div className="label text-accent-ink">{next.n}/36 · {KIND_LABEL[next.kind]}</div>
                <div className="mt-1.5 text-[17px] font-semibold leading-snug">{next.title}</div>
                <div className="mt-1 text-[13px] text-ink-2">{when(next.start)} · {next.speaker}</div>
              </button>
            </Card>
          )}
          <Card pad={false} className="overflow-hidden">
            <div className="px-4 pt-4 sm:px-5"><CardTitle icon={UserX} tone={missing.length ? 'bad' : 'neutral'} count={missing.length}>Не сдали блок {block}</CardTitle></div>
            {missing.length ? (
              <ul className="divide-y divide-line">
                {missing.map(st => (
                  <li key={st.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDrawer({ type: 'student', id: st.id })}>
                      <div className="truncate text-sm font-medium">{st.name}</div>
                      <div className="truncate text-xs text-ink-3">{groupOf(db, st.id)?.name} · {BLOCKS[block - 1]}</div>
                    </button>
                    <Button variant="ghost" size="sm" icon={Send} onClick={() => openModal({ type: 'message', to: { kind: 'student', id: st.id } })} aria-label="Написать" title="Написать" />
                  </li>
                ))}
              </ul>
            ) : <Empty compact icon={Check} title="Сдали все">Каждый блок закрывается работой — здесь видно, кто отстаёт.</Empty>}
          </Card>
        </div>
      </div>
    </div>
  );
}
