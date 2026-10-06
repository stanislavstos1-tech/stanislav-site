/* Карточки: заявка, участник, занятие. Главное действие — всегда первой кнопкой. */
import { useState } from 'react';
import { Phone, Send, CalendarPlus, Wallet, XCircle, RotateCcw, CalendarClock, Check, X, Clock3, MessageSquareText, BellPlus, ArrowRight, Pause, LogOut, Play, AlertTriangle, Users, Video, Briefcase } from 'lucide-react';
import type { ID, LeadStatus } from '../domain/types';
import { STATUS_LABEL, LOST_LABEL, STUDENT_STATUS_LABEL, TARIFF_LABEL, TRACK_LABEL, EXP_LABEL, BLOCKS, KIND_LABEL, METHOD_LABEL } from '../domain/labels';
import { useDB, undo } from '../data/store';
import * as A from '../data/actions';
import { isOverdue, groupOf, curatorById, homeworkOf, moneyOf, plan, isLate, lessonEnd } from '../data/selectors';
import { HOUR, addDays, ago, at, dateFull, dateShort, elapsed, when, firstName } from '../lib/format';
import { digits } from '../lib/phone';
import { Drawer, toast } from '../ui/overlay';
import { Badge, Button, LinkButton, SectionLabel, Textarea, Input, Select, cx, Avatar, Menu } from '../ui/kit';
import { ChannelTag, StatusBadge, TariffBadge, PayBadge, HwBadge } from '../ui/domain';
import { useApp, can } from './ctx';

const undoAction = { label: 'Отменить', run: () => { if (undo()) toast('Изменение отменено', { tone: 'info' }); } };

/** перевод заявки в статус: некоторые требуют действия (созвон, оплата, причина отказа) */
export function useMoveLead() {
  const { openModal } = useApp();
  const db = useDB();
  return (id: ID, status: LeadStatus) => {
    const l = db.leads.find(x => x.id === id); if (!l || l.status === status) return;
    if (status === 'call_booked') return openModal({ type: 'bookCall', leadId: id });
    if (status === 'paid') return openModal({ type: 'convert', leadId: id });
    if (status === 'lost') return openModal({ type: 'lose', leadId: id });
    A.setLeadStatus(id, status);
    toast(`${firstName(l.name)} → ${STATUS_LABEL[status]}`, { action: undoAction });
  };
}

/* ======================= заявка ======================= */
export function LeadDrawer({ id }: { id: ID }) {
  const db = useDB();
  const { openDrawer, openModal, role } = useApp();
  const move = useMoveLead();
  const l = db.leads.find(x => x.id === id);
  const [note, setNote] = useState('');
  if (!l) return null;
  const overdue = isOverdue(l, db.settings.slaHours);
  const write = (template?: string) => openModal({ type: 'message', to: { kind: 'lead', id }, template });
  const sell = can.sell(role);
  const tel = 'tel:+' + digits(l.phone);
  const callNow = l.status === 'call_booked' && l.callAt && l.callAt < Date.now() + 15 * 60000;

  const next = (() => {
    switch (l.status) {
      case 'new': return <><Button variant="primary" icon={Send} onClick={() => write('greeting')} block>Написать</Button><Button icon={CalendarPlus} onClick={() => openModal({ type: 'bookCall', leadId: id })} block>Назначить созвон</Button></>;
      case 'contacted': return <><Button variant="primary" icon={CalendarPlus} onClick={() => openModal({ type: 'bookCall', leadId: id })} block>Назначить созвон</Button><Button icon={Send} onClick={() => write()} block>Написать</Button></>;
      case 'call_booked': return callNow
        ? <><Button variant="ok" icon={Check} onClick={() => { A.callResult(id, true); toast('Созвон прошёл', { action: undoAction }); }} block>Созвон прошёл</Button><Button variant="danger" icon={X} onClick={() => { A.callResult(id, false); toast('Не вышел на связь — договоритесь о новом времени', { tone: 'info', action: undoAction }); }} block>Не вышел</Button></>
        : <><Button variant="primary" icon={Send} onClick={() => write('call_reminder')} block>Напомнить о созвоне</Button><Button icon={CalendarClock} onClick={() => openModal({ type: 'bookCall', leadId: id })} block>Перенести</Button></>;
      case 'call_done': return <><Button variant="primary" icon={Wallet} onClick={() => openModal({ type: 'convert', leadId: id })} block>Принять оплату</Button><Button icon={Clock3} onClick={() => { move(id, 'awaiting_payment'); write('after_call'); }} block>Отправить ссылку</Button></>;
      case 'awaiting_payment': return <><Button variant="primary" icon={Wallet} onClick={() => openModal({ type: 'convert', leadId: id })} block>Принять оплату</Button><Button icon={Send} onClick={() => write('payment_reminder')} block>Напомнить</Button></>;
      case 'paid': return l.studentId ? <Button variant="soft" icon={Users} iconRight={ArrowRight} onClick={() => openDrawer({ type: 'student', id: l.studentId! })} block>Открыть участника</Button> : null;
      case 'lost': return <Button icon={RotateCcw} onClick={() => { A.setLeadStatus(id, 'contacted'); toast('Заявка снова в работе', { action: undoAction }); }} block>Вернуть в работу</Button>;
    }
  })();

  const remind = (t: number) => { A.addTask({ title: 'Связаться: ' + l.name, due: t, leadId: id }); toast('Напоминание на ' + when(t).toLowerCase()); };
  const openTasks = db.tasks.filter(t => t.leadId === id && !t.done);

  return (
    <Drawer title={`Заявка · ${ago(l.createdAt)}`} onClose={() => openDrawer(null)}
      head={sell && l.status !== 'lost' && l.status !== 'paid' ? <Button variant="ghost" size="sm" icon={XCircle} onClick={() => openModal({ type: 'lose', leadId: id })}>Отказ</Button> : undefined}>
      <h2 className="display text-[22px] font-bold leading-tight">{l.name}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <StatusBadge status={l.status} />
        <TariffBadge tariff={l.tariff} />
        <ChannelTag channel={l.channel} />
      </div>
      <div className="mt-2 text-[13px] text-ink-2">{[l.position, EXP_LABEL[l.experience], l.source].filter(Boolean).join(' · ')}</div>

      {overdue && <div className="mt-4 flex items-center gap-2 rounded-2xl bg-bad-soft px-3.5 py-2.5 text-[13px] font-medium text-bad"><AlertTriangle className="size-4 shrink-0" aria-hidden />Ждёт ответа {elapsed(l.createdAt)} — напишите сейчас, пока интерес не остыл</div>}
      {l.status === 'lost' && l.lostReason && <div className="mt-4 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[13px]"><b>Отказ:</b> {LOST_LABEL[l.lostReason]}{l.lostComment ? ' — ' + l.lostComment : ''}</div>}

      {sell && next && <div className="mt-4 grid grid-cols-2 gap-2 [&>*:only-child]:col-span-2">{next}</div>}

      {l.callAt && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-line px-3.5 py-3">
          <span className="grid size-9 place-items-center rounded-full bg-warn-soft text-warn"><Video className="size-4" aria-hidden /></span>
          <div className="min-w-0 flex-1 leading-tight">
            <span className="block text-sm font-medium">Созвон · {when(l.callAt)}</span>
            <span className="block text-xs text-ink-3">{db.settings.callDuration} минут · {l.status === 'call_booked' ? 'назначен' : 'прошёл'}</span>
          </div>
        </div>
      )}

      <div className="mt-5">
        <SectionLabel>Контакт</SectionLabel>
        <div className="flex items-center gap-2">
          <div className="tnum min-w-0 flex-1 text-[17px] font-semibold">{l.phone}</div>
          <LinkButton href={tel} icon={Phone} title="Позвонить" onClick={() => sell && A.markReplied(id, 'Позвонили')} />
          <Button icon={Send} onClick={() => write()} aria-label="Написать" title="Написать" />
        </div>
        {l.comment && <p className="mt-3 rounded-2xl bg-surface-2 px-3.5 py-3 text-sm leading-relaxed">«{l.comment}»</p>}
      </div>

      {sell && (
        <div className="mt-5">
          <SectionLabel>Напомнить мне</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {([['через 2 часа', Math.ceil((Date.now() + 2 * HOUR) / 9e5) * 9e5], ['завтра в 10:00', at(addDays(Date.now(), 1), '10:00')], ['через 3 дня', at(addDays(Date.now(), 3), '10:00')]] as [string, number][]).map(([label, t]) => (
              <button key={label} type="button" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[13px] hover:border-ink-3" onClick={() => remind(t)}><BellPlus className="size-3.5 text-ink-3" aria-hidden />{label}</button>
            ))}
          </div>
          {openTasks.length > 0 && <ul className="mt-2 grid gap-1">{openTasks.map(t => <li key={t.id} className="flex items-center gap-2 text-[13px] text-ink-2"><Clock3 className="size-3.5 text-ink-3" aria-hidden />{when(t.due)} — {t.title}</li>)}</ul>}
        </div>
      )}

      {sell && (
        <div className="mt-5">
          <SectionLabel>Заметка</SectionLabel>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (!note.trim()) return; A.addLeadNote(id, note); setNote(''); toast('Заметка добавлена в историю'); }}>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Что обсудили, о чём договорились" aria-label="Заметка" />
            <Button type="submit" variant="secondary" icon={MessageSquareText} disabled={!note.trim()} aria-label="Добавить заметку" />
          </form>
        </div>
      )}

      <div className="mt-6">
        <SectionLabel>История</SectionLabel>
        <ol className="relative ml-1.5 border-l-2 border-line">
          {l.history.map((h, i) => (
            <li key={i} className="relative pb-3.5 pl-5 last:pb-0">
              <span className={cx('absolute -left-[7px] top-1.5 size-3 rounded-full border-2', i === 0 ? 'border-accent bg-accent' : 'border-line-2 bg-surface')} aria-hidden />
              <div className="text-sm">{h.text}</div>
              <div className="text-xs text-ink-3">{dateFull(h.at)}{h.by ? ' · ' + (db.users.find(u => u.id === h.by)?.name.split(' ')[0] || '') : ''}</div>
            </li>
          ))}
        </ol>
      </div>
    </Drawer>
  );
}

/* ======================= участник ======================= */
export function StudentDrawer({ id }: { id: ID }) {
  const db = useDB();
  const { openDrawer, openModal, fmt, role } = useApp();
  const s = db.students.find(x => x.id === id);
  const [note, setNote] = useState(s?.note || '');
  if (!s) return null;
  const manage = can.manageStudents(role);
  const m = moneyOf(db, id);
  const p = plan(db, id);
  const g = groupOf(db, id);
  const cur = g ? curatorById(db, g.curatorId) : undefined;
  const hw = homeworkOf(db, id);
  const cohort = db.cohorts.find(c => c.id === s.cohortId);
  const groupsHere = db.groups.filter(x => x.studentIds.some(sid => db.students.find(st => st.id === sid)?.cohortId === s.cohortId));

  return (
    <Drawer title={(cohort?.name || 'Поток') + ' · с ' + dateShort(s.createdAt)} onClose={() => openDrawer(null)}
      head={manage ? (
        <Menu trigger={pr => <Button variant="ghost" size="sm" {...pr}>Ещё</Button>} items={[
          s.status === 'active' ? { label: 'Поставить на паузу', icon: Pause, onClick: () => { A.setStudentStatus(id, 'paused'); toast('Участник на паузе', { action: undoAction }); } } : null,
          s.status !== 'active' ? { label: 'Вернуть в поток', icon: Play, onClick: () => { A.setStudentStatus(id, 'active'); toast('Участник снова учится', { action: undoAction }); } } : null,
          s.status !== 'left' ? { label: 'Ушёл с курса', icon: LogOut, danger: true, onClick: () => openModal({ type: 'studentLeft', studentId: id }) } : null,
        ]} />
      ) : undefined}>
      <div className="flex items-start gap-3">
        <Avatar name={s.name} size={48} />
        <div className="min-w-0 flex-1">
          <h2 className="display text-[20px] font-bold leading-tight">{s.name}</h2>
          <div className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-2"><Briefcase className="size-3.5" aria-hidden />{s.position} · {s.company}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={s.status === 'active' || s.status === 'done' ? 'ok' : s.status === 'paused' ? 'warn' : 'neutral'}>{STUDENT_STATUS_LABEL[s.status]}</Badge>
            <TariffBadge tariff={s.tariff} />
            <Badge>{TRACK_LABEL[s.track]}</Badge>
          </div>
        </div>
      </div>

      {/* оплата — главное число */}
      <div className={cx('mt-5 rounded-[22px] border p-4', m.late.length ? 'border-bad/30 bg-bad-soft' : m.left <= 0 ? 'border-ok/30 bg-ok-soft' : 'border-line bg-surface-2')}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="label text-ink-3">{m.late.length ? 'Просрочено' : m.left <= 0 ? 'Оплачено полностью' : 'Осталось оплатить'}</div>
            <div className={cx('display tnum mt-2 text-[28px] font-bold leading-none', m.late.length > 0 && 'text-bad')}>{fmt(m.late.length ? m.late.reduce((a, i) => a + i.amount, 0) : m.left > 0 ? m.left : m.total)}</div>
            <div className="mt-1.5 text-xs text-ink-2">{m.installments ? `рассрочка · оплачено ${p.filter(i => i.paidAt).length} из ${p.length} · ${fmt(m.paid)}` : `${TARIFF_LABEL[s.tariff]} · одним платежом`}</div>
          </div>
          {manage && m.left > 0 && <Button variant="primary" icon={Wallet} onClick={() => openModal({ type: 'pay', studentId: id })}>Платёж</Button>}
        </div>
        {m.installments && (
          <div className="mt-3 flex gap-1" aria-hidden>
            {p.map(i => <span key={i.id} title={`${i.n}/${i.of} · ${dateShort(i.due)}`} className={cx('h-1.5 flex-1 rounded-full', i.paidAt ? 'bg-ok' : isLate(i) ? 'bg-bad' : 'bg-line-2')} />)}
          </div>
        )}
      </div>

      <div className="mt-5">
        <SectionLabel>Связь</SectionLabel>
        <div className="flex items-center gap-2">
          <div className="tnum min-w-0 flex-1 text-[16px] font-semibold">{s.phone}</div>
          <LinkButton href={'tel:+' + digits(s.phone)} icon={Phone} title="Позвонить" />
          <Button icon={Send} onClick={() => openModal({ type: 'message', to: { kind: 'student', id } })} aria-label="Написать" title="Написать" />
        </div>
      </div>

      {s.tariff === 'live' && (
        <div className="mt-5">
          <SectionLabel>Группа</SectionLabel>
          {g && cur ? (
            <div className="flex items-center gap-3 rounded-2xl border border-line px-3.5 py-2.5">
              <Avatar name={cur.name} color={cur.color} size={30} />
              <div className="min-w-0 flex-1 leading-tight"><div className="text-sm font-medium">{g.name}</div><div className="text-xs text-ink-3">куратор {cur.name} · {g.studentIds.length} чел.</div></div>
            </div>
          ) : <p className="text-[13px] text-ink-2">Пока без группы — назначьте до старта потока.</p>}
          {manage && s.status !== 'left' && groupsHere.length > 0 && (
            <Select className="mt-2" value="" aria-label="Назначить группу" onChange={e => { const to = e.target.value; if (!to) return; A.setStudentGroup(id, to); toast('Группа назначена', { action: undoAction }); }}>
              <option value="">{g ? 'Перевести в другую группу…' : 'Назначить группу…'}</option>
              {groupsHere.filter(x => x.id !== g?.id).map(x => <option key={x.id} value={x.id} disabled={x.studentIds.length >= 5}>{x.name} · {curatorById(db, x.curatorId)?.name} ({x.studentIds.length}/5)</option>)}
            </Select>
          )}
        </div>
      )}

      {s.tariff === 'live' ? (
        <div className="mt-5">
          <SectionLabel>Работы по блокам</SectionLabel>
          <div className="divide-y divide-line rounded-2xl border border-line">
            {BLOCKS.map((b, i) => {
              const h = hw.find(x => x.block === i + 1);
              return (
                <div key={b} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="label w-6 text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1 leading-tight"><div className="text-sm">{b}</div>{h?.comment && h.status === 'returned' && <div className="mt-0.5 text-xs text-bad">{h.comment}</div>}</div>
                  {h ? <HwBadge status={h.status} /> : <span className="text-xs text-ink-3">—</span>}
                </div>
              );
            })}
          </div>
        </div>
      ) : <p className="mt-5 rounded-2xl bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">Тариф «Записи»: куратор не проверяет работы, защиты вслух нет — у участника записи, шаблоны и эталоны разборов.</p>}

      {m.installments && (
        <div className="mt-5">
          <SectionLabel>График платежей</SectionLabel>
          <div className="divide-y divide-line rounded-2xl border border-line">
            {p.map(i => (
              <div key={i.id} className="flex items-center gap-3 px-3.5 py-2">
                <span className="label w-10 text-ink-3">{i.n}/{i.of}</span>
                <span className="tnum flex-1 text-sm">{dateShort(i.due)}</span>
                {i.paidAt ? <span className="text-xs text-ok">оплачен{i.method ? ' · ' + METHOD_LABEL[i.method] : ''}</span> : isLate(i) ? <Badge tone="bad">просрочен</Badge> : <span className="text-xs text-ink-3">ожидается</span>}
                <span className="tnum w-24 text-right text-sm font-medium">{fmt(i.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!m.installments && <div className="mt-3"><PayBadge m={m} /></div>}

      <div className="mt-5">
        <SectionLabel>Заметки</SectionLabel>
        <Textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => { if (note !== s.note) { A.updateStudent(id, { note }); toast('Заметка сохранена'); } }} placeholder="Задача участника, договорённости, что важно куратору" />
      </div>
      {s.leadId && can.sell(role) && <button type="button" className="mt-5 text-[13px] text-ink-2 underline underline-offset-2" onClick={() => openDrawer({ type: 'lead', id: s.leadId! })}>Открыть исходную заявку</button>}
    </Drawer>
  );
}

/* ======================= занятие ======================= */
export function LessonDrawer({ id }: { id: ID }) {
  const db = useDB();
  const { openDrawer } = useApp();
  const l = db.lessons.find(x => x.id === id);
  if (!l) return null;
  const cohort = db.cohorts.find(c => c.id === l.cohortId);
  const past = lessonEnd(l) < Date.now(), live = l.start <= Date.now() && !past;
  return (
    <Drawer title={`Занятие ${l.n} из 36 · ${cohort?.name || ''}`} onClose={() => openDrawer(null)}>
      <div className="label text-accent-ink">Блок {l.block} · {BLOCKS[l.block - 1]}</div>
      <h2 className="display mt-2 text-[20px] font-bold leading-tight">{l.title}</h2>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone={l.kind === 'defense' ? 'accent' : l.kind === 'call' ? 'info' : 'neutral'}>{KIND_LABEL[l.kind]}</Badge>
        {live && <Badge tone="ok">Идёт сейчас</Badge>}
        {past && <Badge>Прошло</Badge>}
      </div>
      <div className="mt-5 grid gap-2 rounded-2xl border border-line p-4 text-sm">
        <div className="flex justify-between gap-3"><span className="text-ink-3">Когда</span><span className="tnum font-medium">{when(l.start)}</span></div>
        <div className="flex justify-between gap-3"><span className="text-ink-3">Длительность</span><span className="font-medium">{l.duration} мин</span></div>
        <div className="flex justify-between gap-3"><span className="text-ink-3">Ведёт</span><span className="text-right font-medium">{l.speaker}</span></div>
      </div>
      <p className="mt-4 text-[13px] text-ink-2">{l.kind === 'call' ? 'Созвон в группах по 4–5 человек: куратор разбирает работы и решения до защиты.' : l.kind === 'defense' ? 'Защита вслух перед жюри: 5 минут на кейс и вопросы как от собственника.' : 'Запись появится в личном кабинете в течение часа после эфира — для тарифа «Записи» тоже.'}</p>
    </Drawer>
  );
}
