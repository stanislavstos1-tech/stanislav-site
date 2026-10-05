/* Карточки: заявка, ученик, занятие, группа, преподаватель. Главное действие — всегда первой кнопкой. */
import { useEffect, useMemo, useState } from 'react';
import { Phone, Send, CalendarPlus, Wallet, XCircle, RotateCcw, CalendarClock, Check, X, Clock3, MessageSquareText, BellPlus, GraduationCap, ArrowRight, Video, Copy, Pause, LogOut, Play, Repeat, AlertTriangle, UserRound, Users } from 'lucide-react';
import type { AttendanceMark, ID, LeadStatus, Level } from '../domain/types';
import { FUNNEL, STATUS_LABEL, LOST_LABEL, METHOD_LABEL, MARK_LABEL, KIND_LABEL, WEEKDAYS, RELATION_LABEL, STUDENT_STATUS_LABEL } from '../domain/labels';
import { useDB, undo } from '../data/store';
import * as A from '../data/actions';
import { balanceMap, contactPhone, groupById, isIndividualStudent, lessonEnd, lessonStudents, lessonTitle, payerOf, studentGroups, teacherById, isOverdue } from '../data/selectors';
import { DAY, HOUR, addDays, ago, at, dateFull, dateShort, elapsed, hm, plural, when, firstName } from '../lib/format';
import { digits } from '../lib/phone';
import { copyText } from '../lib/messaging';
import { Drawer, toast } from '../ui/overlay';
import { Badge, Button, LinkButton, SectionLabel, Textarea, Input, Select, Segmented, cx, Avatar, Menu } from '../ui/kit';
import { ChannelTag, StatusBadge, STATUS_ICON, BalanceBadge } from '../ui/domain';
import { useApp, can } from './ctx';

const undoAction = { label: 'Отменить', run: () => { if (undo()) toast('Изменение отменено', { tone: 'info' }); } };

/** перевод заявки в статус: некоторые требуют действия (пробный, оплата, причина отказа) */
export function useMoveLead() {
  const { openModal } = useApp();
  const db = useDB();
  return (id: ID, status: LeadStatus) => {
    const l = db.leads.find(x => x.id === id); if (!l || l.status === status) return;
    if (status === 'trial_booked') return openModal({ type: 'bookTrial', leadId: id });
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
  const trial = db.lessons.find(x => x.id === l.trialLessonId);
  const overdue = isOverdue(l, db.settings.slaHours);
  const write = (template?: string) => openModal({ type: 'message', to: { kind: 'lead', id }, template });
  const sell = can.sell(role);
  const tel = 'tel:+' + digits(l.phone);
  const trialPassed = trial && trial.status === 'planned' && trial.start < Date.now() + 15 * 60000;

  // следующий шаг по статусу
  const next = (() => {
    switch (l.status) {
      case 'new': return <><Button variant="primary" icon={Send} onClick={() => write('greeting')} block>Написать</Button><Button icon={CalendarPlus} onClick={() => openModal({ type: 'bookTrial', leadId: id })} block>На пробный</Button></>;
      case 'contacted': return <><Button variant="primary" icon={CalendarPlus} onClick={() => openModal({ type: 'bookTrial', leadId: id })} block>Записать на пробный</Button><Button icon={Send} onClick={() => write()} block>Написать</Button></>;
      case 'trial_booked': return trialPassed
        ? <><Button variant="ok" icon={Check} onClick={() => { A.trialResult(id, true); toast('Пробный прошёл', { action: undoAction }); }} block>Пришёл</Button><Button variant="danger" icon={X} onClick={() => { A.trialResult(id, false); toast('Отметили: не пришёл. Перезапишите на другое время', { tone: 'info', action: undoAction }); }} block>Не пришёл</Button></>
        : <><Button variant="primary" icon={Send} onClick={() => write('trial_reminder')} block>Напомнить о пробном</Button><Button icon={CalendarClock} onClick={() => openModal({ type: 'bookTrial', leadId: id })} block>Перенести</Button></>;
      case 'trial_done': return <><Button variant="primary" icon={Wallet} onClick={() => openModal({ type: 'convert', leadId: id })} block>Принять оплату</Button><Button icon={Clock3} onClick={() => move(id, 'awaiting_payment')} block>Ждём оплату</Button></>;
      case 'awaiting_payment': return <><Button variant="primary" icon={Wallet} onClick={() => openModal({ type: 'convert', leadId: id })} block>Принять оплату</Button><Button icon={Send} onClick={() => write('payment_reminder')} block>Напомнить</Button></>;
      case 'paid': return l.studentId ? <Button variant="soft" icon={GraduationCap} iconRight={ArrowRight} onClick={() => openDrawer({ type: 'student', id: l.studentId! })} block>Открыть ученика</Button> : null;
      case 'lost': return <Button icon={RotateCcw} onClick={() => { A.setLeadStatus(id, 'contacted'); toast('Заявка снова в работе', { action: undoAction }); }} block>Вернуть в работу</Button>;
    }
  })();

  const remind = (t: number, title: string) => { A.addTask({ title, due: t, leadId: id }); toast('Напоминание на ' + when(t).toLowerCase()); };
  const tomorrow10 = at(addDays(Date.now(), 1), '10:00');

  return (
    <Drawer title={`Заявка · ${ago(l.createdAt)}`} onClose={() => openDrawer(null)}
      head={sell && l.status !== 'lost' && l.status !== 'paid' ? <Button variant="ghost" size="sm" icon={XCircle} onClick={() => openModal({ type: 'lose', leadId: id })}>Отказ</Button> : undefined}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">{l.name}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusBadge status={l.status} />
            <ChannelTag channel={l.channel} />
            <span className="text-xs text-ink-3">{l.source}</span>
          </div>
        </div>
      </div>
      {overdue && <div className="mt-4 flex items-center gap-2 rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13px] font-medium text-bad"><AlertTriangle className="size-4 shrink-0" aria-hidden />Ждёт ответа {elapsed(l.createdAt)} — напишите сейчас, пока клиент «тёплый»</div>}
      {l.status === 'lost' && l.lostReason && <div className="mt-4 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]"><b>Отказ:</b> {LOST_LABEL[l.lostReason]}{l.lostComment ? ' — ' + l.lostComment : ''}</div>}

      {sell && next && <div className="mt-4 grid grid-cols-2 gap-2 [&>*:only-child]:col-span-2">{next}</div>}

      {/* этапы воронки — можно перевести одним нажатием */}
      {sell && (
        <div className="mt-5">
          <SectionLabel>Этап</SectionLabel>
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
            {FUNNEL.map((st, i) => {
              const cur = FUNNEL.indexOf(l.status), done = l.status !== 'lost' && i <= cur, I = STATUS_ICON[st];
              return (
                <button key={st} type="button" onClick={() => move(id, st)} aria-pressed={l.status === st} title={STATUS_LABEL[st]}
                  className={cx('flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-[background,color] duration-150', l.status === st ? 'bg-accent text-white dark:text-[#101018]' : done ? 'bg-accent-soft text-accent-ink' : 'bg-surface-2 text-ink-2 hover:text-ink')}>
                  <I className="size-3.5" aria-hidden />{STATUS_LABEL[st]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {trial && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
          <span className="grid size-9 place-items-center rounded-[10px] bg-warn-soft text-warn"><CalendarClock className="size-4" aria-hidden /></span>
          <button type="button" className="min-w-0 flex-1 text-left leading-tight" onClick={() => openDrawer({ type: 'lesson', id: trial.id })}>
            <span className="block text-sm font-medium">Пробный · {when(trial.start)}</span>
            <span className="block text-xs text-ink-3">{teacherById(db, trial.teacherId)?.name} · {trial.status === 'done' ? 'прошёл' : trial.status === 'canceled' ? 'отменён' : trial.duration + ' мин'}</span>
          </button>
        </div>
      )}

      <div className="mt-5">
        <SectionLabel>Контакт</SectionLabel>
        <div className="flex items-center gap-2">
          <div className="tnum min-w-0 flex-1 text-[17px] font-semibold">{l.phone}</div>
          <LinkButton href={tel} icon={Phone} title="Позвонить" onClick={() => sell && A.markReplied(id, 'Позвонили')} />
          <Button icon={Send} onClick={() => write()} aria-label="Написать" title="Написать" />
        </div>
        {l.comment && <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-3 text-sm leading-relaxed">«{l.comment}»</p>}
      </div>

      {sell && (
        <div className="mt-5">
          <SectionLabel>Заметка</SectionLabel>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (!note.trim()) return; A.addLeadNote(id, note); setNote(''); toast('Заметка добавлена в историю'); }}>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Что обсудили, о чём договорились" aria-label="Заметка" />
            <Button type="submit" variant="secondary" icon={MessageSquareText} disabled={!note.trim()} aria-label="Добавить заметку" />
          </form>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 text-xs text-ink-3"><BellPlus className="size-3.5" aria-hidden />Напомнить:</span>
            <button type="button" className="rounded-full border border-line-2 px-2.5 py-1 text-xs hover:border-ink-3" onClick={() => remind(Math.ceil((Date.now() + 2 * HOUR) / 9e5) * 9e5, 'Связаться: ' + l.name)}>через 2 часа</button>
            <button type="button" className="rounded-full border border-line-2 px-2.5 py-1 text-xs hover:border-ink-3" onClick={() => remind(tomorrow10, 'Связаться: ' + l.name)}>завтра в 10:00</button>
            <button type="button" className="rounded-full border border-line-2 px-2.5 py-1 text-xs hover:border-ink-3" onClick={() => remind(at(addDays(Date.now(), 3), '10:00'), 'Связаться: ' + l.name)}>через 3 дня</button>
          </div>
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

/* ======================= ученик ======================= */
export function StudentDrawer({ id }: { id: ID }) {
  const db = useDB();
  const { openDrawer, openModal, fmt, role } = useApp();
  const s = db.students.find(x => x.id === id);
  const bal = useMemo(() => balanceMap(db).get(id), [db, id]);
  const [note, setNote] = useState(s?.note || '');
  useEffect(() => setNote(s?.note || ''), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s || !bal) return null;
  const sell = can.sell(role);
  const payer = payerOf(db, s);
  const groups = studentGroups(db, id);
  const indiv = isIndividualStudent(db, id);
  const indivNext = db.lessons.filter(l => l.kind === 'individual' && l.studentId === id && l.status === 'planned' && l.start > Date.now()).sort((a, b) => a.start - b.start)[0];
  const history = db.lessons.filter(l => (l.status === 'done' && l.attendance[id]) || (l.kind === 'individual' && l.studentId === id && l.status === 'canceled' && l.start < Date.now())).sort((a, b) => b.start - a.start).slice(0, 16);
  const pays = db.payments.filter(p => p.studentId === id).sort((a, b) => b.at - a.at);
  const phone = contactPhone(db, s);
  const pct = bal.bought ? Math.max(0, Math.min(100, (bal.left / Math.max(8, bal.left + 1)) * 100)) : 0;
  const otherGroups = db.groups.filter(g => !groups.some(x => x.id === g.id));

  return (
    <Drawer title={'Ученик · с ' + dateShort(s.createdAt)} onClose={() => openDrawer(null)}
      head={sell ? (
        <Menu trigger={p => <Button variant="ghost" size="sm" {...p}>Ещё</Button>} items={[
          s.status === 'active' ? { label: 'Поставить на паузу', icon: Pause, onClick: () => { A.setStudentStatus(id, 'paused'); toast('Ученик на паузе', { action: undoAction }); } } : null,
          s.status !== 'active' ? { label: 'Вернуть в учёбу', icon: Play, onClick: () => { A.setStudentStatus(id, 'active'); toast('Ученик снова учится', { action: undoAction }); } } : null,
          s.status !== 'left' ? { label: 'Ушёл из школы', icon: LogOut, danger: true, onClick: () => openModal({ type: 'studentLeft', studentId: id }) } : null,
        ]} />
      ) : undefined}>
      <div className="flex items-start gap-3">
        <Avatar name={s.name} size={48} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">{s.name}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={s.status === 'active' ? 'ok' : s.status === 'paused' ? 'warn' : 'neutral'} icon={s.status === 'active' ? Check : s.status === 'paused' ? Pause : LogOut}>{STUDENT_STATUS_LABEL[s.status]}</Badge>
            <Badge>{s.level}</Badge>
            {s.age && <span className="text-xs text-ink-3">{plural(s.age, 'год', 'года', 'лет')}</span>}
          </div>
        </div>
      </div>

      {/* остаток занятий — главное число */}
      <div className={cx('mt-5 rounded-2xl border p-4', bal.left < 0 ? 'border-bad/30 bg-bad-soft' : bal.left <= db.settings.lowBalance ? 'border-warn/30 bg-warn-soft' : 'border-line bg-surface-2')}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[13px] text-ink-2">{bal.left < 0 ? 'Долг' : 'Осталось занятий'}</div>
            <div className={cx('tnum mt-1 text-[34px] font-semibold leading-none tracking-[-0.03em]', bal.left < 0 && 'text-bad')}>{bal.left < 0 ? fmt(bal.debt) : bal.left}</div>
            <div className="mt-1.5 text-xs text-ink-2">{bal.left < 0 ? plural(-bal.left, 'урок', 'урока', 'уроков') + ' проведено без оплаты' : `куплено ${bal.bought}, прошло ${bal.charged}`}</div>
          </div>
          {sell && <Button variant="primary" icon={Wallet} onClick={() => openModal({ type: 'payment', studentId: id })}>Принять оплату</Button>}
        </div>
        {bal.left >= 0 && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: pct + '%' }} /></div>}
      </div>

      <div className="mt-5">
        <SectionLabel>Связь</SectionLabel>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 leading-tight">
            <div className="tnum text-[16px] font-semibold">{phone || 'Телефон не указан'}</div>
            <div className="text-xs text-ink-3">{payer && payer.relation !== 'self' ? `${RELATION_LABEL[payer.relation]} · ${payer.name} — оплачивает` : 'Сам ученик'}</div>
          </div>
          {phone && <LinkButton href={'tel:+' + digits(phone)} icon={Phone} title="Позвонить" />}
          {phone && <Button icon={Send} onClick={() => openModal({ type: 'message', to: { kind: 'student', id } })} aria-label={payer?.relation !== 'self' ? 'Написать родителю' : 'Написать'} title="Написать" />}
        </div>
      </div>

      <div className="mt-5">
        <SectionLabel>Учится</SectionLabel>
        <div className="grid gap-2">
          {groups.map(g => (
            <div key={g.id} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5">
              <span className="size-2.5 rounded-full" style={{ background: teacherById(db, g.teacherId)?.color }} aria-hidden />
              <button type="button" className="min-w-0 flex-1 text-left leading-tight" onClick={() => openDrawer({ type: 'group', id: g.id })}>
                <span className="block text-sm font-medium">{g.name}</span>
                <span className="block text-xs text-ink-3">{g.weekdays.map(w => WEEKDAYS[w - 1]).join(', ')} · {g.time} · {teacherById(db, g.teacherId)?.name}</span>
              </button>
            </div>
          ))}
          {indiv && <div className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5"><UserRound className="size-4 text-ink-3" aria-hidden /><div className="min-w-0 flex-1 leading-tight"><div className="text-sm font-medium">Индивидуально</div><div className="text-xs text-ink-3">{indivNext ? `следующее: ${when(indivNext.start)} · ${teacherById(db, indivNext.teacherId)?.name}` : 'нет запланированных занятий'}</div></div></div>}
          {!groups.length && !indiv && <p className="text-[13px] text-ink-2">Пока не в группе.</p>}
          {sell && s.status !== 'left' && otherGroups.length > 0 && (
            <Select value="" aria-label={groups.length ? 'Перевести в группу' : 'Добавить в группу'} onChange={e => {
              const to = e.target.value; if (!to) return;
              A.setStudentGroup(id, to, groups[0]?.id);
              toast((groups.length ? 'Переведён в ' : 'Добавлен в ') + groupById(db, to)!.name, { action: undoAction });
            }}>
              <option value="">{groups.length ? 'Перевести в другую группу…' : 'Добавить в группу…'}</option>
              {otherGroups.map(g => <option key={g.id} value={g.id} disabled={g.studentIds.length >= g.capacity}>{g.name} ({g.studentIds.length}/{g.capacity})</option>)}
            </Select>
          )}
        </div>
      </div>

      <div className="mt-5">
        <SectionLabel>Посещаемость</SectionLabel>
        {history.length ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {history.slice().reverse().map(l => { const m = l.attendance[id]; return (
                <span key={l.id} title={`${dateShort(l.start)} · ${m ? MARK_LABEL[m] : 'отменено'}`}
                  className={cx('grid size-7 place-items-center rounded-md text-[10px] font-semibold', m === 'present' ? 'bg-ok-soft text-ok' : m === 'absent' ? 'bg-bad-soft text-bad' : 'bg-surface-2 text-ink-3')}>
                  {m === 'present' ? <Check className="size-3.5" aria-hidden /> : m === 'absent' ? <X className="size-3.5" aria-hidden /> : 'У'}
                </span>
              ); })}
            </div>
            <p className="mt-2 text-xs text-ink-3">Последние занятия слева направо · <span className="text-ok">✓</span> был, <span className="text-bad">✕</span> пропуск (списан), «У» — уважительная</p>
          </>
        ) : <p className="text-[13px] text-ink-2">Занятий ещё не было.</p>}
      </div>

      <div className="mt-5">
        <SectionLabel>Оплаты</SectionLabel>
        {pays.length ? (
          <div className="divide-y divide-line rounded-xl border border-line">
            {pays.slice(0, 6).map(p => { const sub = db.subscriptions.find(x => x.id === p.subscriptionId); return (
              <div key={p.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <div className="min-w-0 flex-1 leading-tight"><div className="text-sm font-medium">{sub?.title || 'Оплата'}</div><div className="text-xs text-ink-3">{dateShort(p.at)} · {METHOD_LABEL[p.method]}{p.comment ? ' · ' + p.comment : ''}</div></div>
                <div className="tnum text-sm font-semibold">{fmt(p.amount)}</div>
              </div>
            ); })}
          </div>
        ) : <p className="text-[13px] text-ink-2">Оплат пока нет.</p>}
      </div>

      <div className="mt-5">
        <SectionLabel>Заметки</SectionLabel>
        <Textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => { if (note !== s.note) { A.updateStudent(id, { note }); toast('Заметка сохранена'); } }} placeholder="Цели, особенности, договорённости с родителями" readOnly={!sell && role !== 'teacher'} />
        {sell && <div className="mt-2 flex items-center gap-2"><span className="text-xs text-ink-3">Уровень:</span><Segmented size="sm" value={s.level} onChange={v => A.updateStudent(id, { level: v as Level })} options={(['A1', 'A2', 'B1', 'B2', 'C1'] as Level[]).map(x => ({ value: x, label: x }))} /></div>}
      </div>
      {s.leadId && sell && <button type="button" className="mt-5 text-[13px] text-ink-2 underline underline-offset-2" onClick={() => openDrawer({ type: 'lead', id: s.leadId! })}>Открыть исходную заявку</button>}
    </Drawer>
  );
}

/* ======================= занятие ======================= */
export function LessonDrawer({ id }: { id: ID }) {
  const db = useDB();
  const { openDrawer, openModal, role, user } = useApp();
  const l = db.lessons.find(x => x.id === id);
  const students = useMemo(() => (l ? lessonStudents(db, l) : []), [db, l]);
  const [marks, setMarks] = useState<Record<ID, AttendanceMark>>({});
  useEffect(() => { if (l) setMarks(Object.keys(l.attendance).length ? { ...l.attendance } : Object.fromEntries(students.filter(s => s.status === 'active').map(s => [s.id, 'present' as AttendanceMark]))); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!l) return null;
  const t = teacherById(db, l.teacherId)!;
  const lead = l.leadId ? db.leads.find(x => x.id === l.leadId) : undefined;
  const g = l.groupId ? groupById(db, l.groupId) : undefined;
  const edit = can.editSchedule(role);
  const mayMark = edit || (role === 'teacher' && user.teacherId === l.teacherId);
  const started = l.start < Date.now() + 15 * 60000;
  const ended = lessonEnd(l) < Date.now();
  const saveMarks = () => {
    A.markAttendance(id, marks);
    const n = Object.values(marks).filter(m => m === 'present').length;
    toast(`Посещаемость сохранена: ${n} из ${Object.keys(marks).length}`, { action: undoAction });
  };
  const url = g?.meetUrl || 'https://meet.example.com/lingua-' + l.id.slice(-4);

  return (
    <Drawer title={KIND_LABEL[l.kind] + (l.seriesId ? ' · повторяется' : '')} onClose={() => openDrawer(null)}>
      <div className="flex items-start gap-3">
        <span className="mt-1 h-10 w-1.5 shrink-0 rounded-full" style={{ background: t.color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.02em]">{lessonTitle(db, l)}</h2>
          <div className="mt-1 text-sm text-ink-2">{when(l.start)}–{hm(lessonEnd(l))} · {t.name}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {l.status === 'done' && <Badge tone="ok" icon={Check}>Проведено</Badge>}
            {l.status === 'canceled' && <Badge tone="neutral" icon={X}>Отменено{l.cancelReason ? ': ' + l.cancelReason.toLowerCase() : ''}</Badge>}
            {l.status === 'planned' && ended && <Badge tone="warn" icon={AlertTriangle}>Нет отметки</Badge>}
            {l.movedFrom && <Badge tone="info" icon={Repeat}>Перенесено с {dateShort(l.movedFrom)}, {hm(l.movedFrom)}</Badge>}
          </div>
        </div>
      </div>

      {l.status !== 'canceled' && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-line px-3 py-2">
          <Video className="size-4 shrink-0 text-ink-3" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{url.replace('https://', '')}</span>
          <Button variant="ghost" size="sm" icon={Copy} onClick={async () => toast((await copyText(url)) ? 'Ссылка на созвон скопирована' : 'Не получилось скопировать', { tone: 'info' })}>Ссылка</Button>
        </div>
      )}

      {/* пробный: итог одним нажатием */}
      {l.kind === 'trial' && lead && (
        <div className="mt-5">
          <SectionLabel>Кто придёт</SectionLabel>
          <button type="button" className="flex w-full items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left hover:bg-surface-2" onClick={() => edit && openDrawer({ type: 'lead', id: lead.id })}>
            <div className="min-w-0 flex-1 leading-tight"><div className="text-sm font-medium">{lead.name}</div><div className="text-xs text-ink-3">{lead.goal || 'Пробный урок'} · {lead.phone}</div></div>
            <StatusBadge status={lead.status} />
          </button>
          {l.status === 'planned' && started && mayMark && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="ok" icon={Check} onClick={() => { A.trialResult(lead.id, true); toast('Пробный прошёл — заявка ждёт решения об оплате', { action: undoAction }); }}>Пришёл</Button>
              <Button variant="danger" icon={X} onClick={() => { A.trialResult(lead.id, false); toast('Не пришёл — заявка вернулась в «Связались»', { tone: 'info', action: undoAction }); }}>Не пришёл</Button>
            </div>
          )}
        </div>
      )}

      {/* отметка посещаемости */}
      {l.kind !== 'trial' && l.status !== 'canceled' && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between"><SectionLabel>Посещаемость</SectionLabel>{!started && <span className="text-xs text-ink-3">отметить можно после начала</span>}</div>
          {students.length === 0 ? <p className="text-[13px] text-ink-2">В группе пока нет учеников.</p> : (
            <div className="grid gap-1.5">
              {students.map(s => (
                <div key={s.id} className="flex items-center gap-2 rounded-xl border border-line py-1.5 pl-3 pr-1.5">
                  <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium" onClick={() => openDrawer({ type: 'student', id: s.id })}>{s.name}</button>
                  <Segmented size="sm" value={marks[s.id] || ('' as AttendanceMark)} onChange={v => mayMark && started && setMarks(m => ({ ...m, [s.id]: v }))}
                    options={[{ value: 'present', label: 'Был' }, { value: 'absent', label: 'Нет' }, { value: 'excused', label: 'Уваж.' }]} ariaLabel={'Отметка: ' + s.name} />
                </div>
              ))}
            </div>
          )}
          {mayMark && started && students.length > 0 && (
            <Button variant="primary" icon={Check} block className="mt-3" onClick={saveMarks}>{l.status === 'done' ? 'Сохранить изменения' : 'Сохранить отметку'}</Button>
          )}
          <p className="mt-2 text-xs text-ink-3">«Нет» — урок списывается с абонемента, «Уваж.» — не списывается.</p>
        </div>
      )}

      {/* индивидуальное: ученик не пришёл — перенести, урок не спишется */}
      {edit && l.kind === 'individual' && started && l.status !== 'canceled' && (
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-warn-soft px-3.5 py-3">
          <span className="min-w-0 flex-1 text-[13px] text-warn">Ученик не пришёл? Перенесите занятие — оно не спишется с абонемента.</span>
          <Button size="sm" variant="secondary" icon={CalendarClock} onClick={() => openModal({ type: 'moveLesson', lessonId: id })}>Перенести</Button>
        </div>
      )}
      {edit && l.status === 'planned' && (
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button icon={CalendarClock} onClick={() => openModal({ type: 'moveLesson', lessonId: id })}>Перенести</Button>
          <Button variant="danger" icon={X} onClick={() => openModal({ type: 'cancelLesson', lessonId: id })}>Отменить</Button>
        </div>
      )}
      {edit && l.status === 'canceled' && l.start > Date.now() && <Button className="mt-6" block icon={RotateCcw} onClick={() => { A.restoreLesson(id); toast('Занятие снова в расписании', { action: undoAction }); }}>Вернуть занятие</Button>}
    </Drawer>
  );
}

/* ======================= группа ======================= */
export function GroupDrawer({ id }: { id: ID }) {
  const db = useDB();
  const { openDrawer, fmt, role } = useApp();
  const g = groupById(db, id);
  const bal = useMemo(() => balanceMap(db), [db]);
  if (!g) return null;
  const t = teacherById(db, g.teacherId)!;
  const members = db.students.filter(s => g.studentIds.includes(s.id));
  const nextL = db.lessons.filter(l => l.groupId === id && l.status === 'planned' && l.start > Date.now()).sort((a, b) => a.start - b.start)[0];
  const past = db.lessons.filter(l => l.groupId === id && l.status === 'done' && l.start > Date.now() - 30 * DAY);
  const rate = past.length ? Math.round(100 * past.reduce((s, l) => s + Object.values(l.attendance).filter(m => m === 'present').length, 0) / Math.max(1, past.reduce((s, l) => s + Object.keys(l.attendance).length, 0))) : 0;
  return (
    <Drawer title="Группа" onClose={() => openDrawer(null)}>
      <div className="flex items-start gap-3">
        <span className="mt-1 h-10 w-1.5 shrink-0 rounded-full" style={{ background: t.color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">{g.name}</h2>
          <div className="mt-1 text-sm text-ink-2">{g.weekdays.map(w => WEEKDAYS[w - 1]).join(', ')} · {g.time} · {g.duration} мин · {t.name}</div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 py-3"><div className="tnum text-xl font-semibold">{members.length}/{g.capacity}</div><div className="text-xs text-ink-3">учеников</div></div>
        <div className="rounded-xl bg-surface-2 py-3"><div className="tnum text-xl font-semibold">{rate}%</div><div className="text-xs text-ink-3">посещаемость</div></div>
        <div className="rounded-xl bg-surface-2 py-3"><div className="text-xl font-semibold">{g.level}</div><div className="text-xs text-ink-3">уровень</div></div>
      </div>
      {nextL && <button type="button" onClick={() => openDrawer({ type: 'lesson', id: nextL.id })} className="mt-4 flex w-full items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left hover:bg-surface-2"><CalendarClock className="size-4 text-ink-3" aria-hidden /><span className="flex-1 text-sm">Следующее занятие: <b>{when(nextL.start)}</b></span><ArrowRight className="size-4 text-ink-3" aria-hidden /></button>}
      <div className="mt-5">
        <SectionLabel>Ученики</SectionLabel>
        <div className="divide-y divide-line rounded-xl border border-line">
          {members.map(s => { const b = bal.get(s.id)!; return (
            <button key={s.id} type="button" onClick={() => openDrawer({ type: 'student', id: s.id })} className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-surface-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
              {role !== 'teacher' ? <BalanceBadge left={b.left} low={db.settings.lowBalance} debt={b.debt} money={fmt} /> : <span className="text-xs text-ink-3">{s.level}</span>}
            </button>
          ); })}
          {!members.length && <p className="px-3.5 py-4 text-[13px] text-ink-2">В группе пока никого.</p>}
        </div>
      </div>
    </Drawer>
  );
}

/* ======================= преподаватель ======================= */
export function TeacherDrawer({ id }: { id: ID }) {
  const db = useDB();
  const { openDrawer } = useApp();
  const t = teacherById(db, id);
  if (!t) return null;
  const upcoming = db.lessons.filter(l => l.teacherId === id && l.status === 'planned' && l.start > Date.now() && l.start < Date.now() + 7 * DAY).sort((a, b) => a.start - b.start);
  const groups = db.groups.filter(g => g.teacherId === id);
  return (
    <Drawer title="Преподаватель" onClose={() => openDrawer(null)}>
      <div className="flex items-center gap-3"><Avatar name={t.name} color={t.color} size={48} /><div><h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">{t.name}</h2><div className="tnum text-sm text-ink-2">{t.phone} · работает {t.workFrom}:00–{t.workTo}:00</div></div></div>
      <div className="mt-5"><SectionLabel>Группы</SectionLabel><div className="flex flex-wrap gap-1.5">{groups.map(g => <button key={g.id} type="button" onClick={() => openDrawer({ type: 'group', id: g.id })} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[13px] hover:border-ink-3"><Users className="size-3.5" aria-hidden />{g.name}</button>)}{!groups.length && <span className="text-[13px] text-ink-2">Только индивидуальные занятия</span>}</div></div>
      <div className="mt-5"><SectionLabel>Ближайшие 7 дней · {upcoming.length}</SectionLabel>
        <div className="divide-y divide-line rounded-xl border border-line">
          {upcoming.slice(0, 14).map(l => (
            <button key={l.id} type="button" onClick={() => openDrawer({ type: 'lesson', id: l.id })} className="flex min-h-11 w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-surface-2">
              <span className="tnum w-24 shrink-0 text-[13px] text-ink-2">{when(l.start).replace('Сегодня, ', 'Сегодня ').replace('Завтра, ', 'Завтра ')}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{lessonTitle(db, l)}</span>
              <Badge tone={l.kind === 'trial' ? 'warn' : l.kind === 'individual' ? 'info' : 'neutral'}>{KIND_LABEL[l.kind]}</Badge>
            </button>
          ))}
          {!upcoming.length && <p className="px-3.5 py-4 text-[13px] text-ink-2">Занятий нет.</p>}
        </div>
      </div>
    </Drawer>
  );
}

