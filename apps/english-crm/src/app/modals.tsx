/* Модальные окна действий. Минимум полей: всё, что можно, подставлено заранее. */
import { useMemo, useState } from 'react';
import { Send, MessageCircle, Copy, CalendarCheck2, Banknote, Smartphone, ArrowRightLeft, CreditCard, Users, User as UserIcon, AlertTriangle, Check } from 'lucide-react';
import type { Channel, ID, LessonKind, LostReason, PayMethod, TemplateKey, Level } from '../domain/types';
import { CHANNEL_LABEL, LOST_LABEL, METHOD_LABEL, KIND_LABEL, WEEKDAYS } from '../domain/labels';
import { useDB, undo } from '../data/store';
import * as A from '../data/actions';
import { balanceMap, freeSlots, groupById, hasConflict, isIndividualStudent, lessonTitle, studentGroups, teacherById } from '../data/selectors';
import { addDays, dateShort, hm, plural, startOfDay, at, firstName, isoWeekday } from '../lib/format';
import { isFullPhone } from '../lib/phone';
import { chatLink, copyText } from '../lib/messaging';
import { Modal, toast } from '../ui/overlay';
import { Button, Field, Input, PhoneInput, Segmented, Select, Textarea, Chip, cx, Badge } from '../ui/kit';
import { CHANNEL_ICON } from '../ui/domain';
import { useApp } from './ctx';
import { DayStrip, TimeGrid, whenLong } from './pickers';
import { defaultTemplate, messageText, recipientOf } from './message';

const undoAction = { label: 'Отменить', run: () => { if (undo()) toast('Изменение отменено', { tone: 'info' }); } };
const METHOD_ICON = { cash: Banknote, sbp: Smartphone, transfer: ArrowRightLeft, card: CreditCard };

/* ---------- новая заявка: имя, телефон, канал ---------- */
export function NewLeadModal() {
  const db = useDB();
  const { openModal, openDrawer } = useApp();
  const ch = (Object.keys(CHANNEL_LABEL) as Channel[]).filter(c => db.settings.channels[c]);
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [channel, setChannel] = useState<Channel>(ch.includes('telegram') ? 'telegram' : ch[0]);
  const [comment, setComment] = useState(''), [tried, setTried] = useState(false);
  const dup = useMemo(() => { const d = phone.replace(/\D/g, ''); return d.length === 11 ? db.leads.find(l => l.phone.replace(/\D/g, '') === d && l.status !== 'lost') || null : null; }, [phone, db.leads]);
  const okName = name.trim().length > 1, okPhone = isFullPhone(phone);
  const submit = () => {
    setTried(true); if (!okName || !okPhone) return;
    const id = A.addLead({ name, phone, channel, comment });
    openModal(null);
    toast('Заявка добавлена в «Новые»', { action: { label: 'Открыть', run: () => openDrawer({ type: 'lead', id }) } });
  };
  return (
    <Modal title="Новая заявка" subtitle="Достаточно имени и телефона — остальное можно дописать потом" onClose={() => openModal(null)}
      footer={<><Button variant="ghost" onClick={() => openModal(null)}>Отмена</Button><Button variant="primary" onClick={submit}>Добавить заявку</Button></>}>
      <form className="grid gap-4" onSubmit={e => { e.preventDefault(); submit(); }}>
        <Field label="Имя" error={tried && !okName ? 'Как зовут человека?' : undefined}><Input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Например, Анна" invalid={tried && !okName} /></Field>
        <Field label="Телефон" error={tried && !okPhone ? 'Нужен номер полностью: +7 и 10 цифр' : undefined}><PhoneInput value={phone} onChange={setPhone} invalid={tried && !okPhone} /></Field>
        {dup && <div className="flex items-center gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[13px] text-warn"><AlertTriangle className="size-4 shrink-0" aria-hidden />Такой номер уже есть: {dup.name}. <button type="button" className="font-semibold underline" onClick={() => { openModal(null); openDrawer({ type: 'lead', id: dup.id }); }}>Открыть</button></div>}
        <Field label="Откуда пришла">
          <div className="flex flex-wrap gap-1.5">{ch.map(c => <Chip key={c} on={channel === c} onClick={() => setChannel(c)} icon={CHANNEL_ICON[c]}>{CHANNEL_LABEL[c]}</Chip>)}</div>
        </Field>
        <Field label="Комментарий" hint="Необязательно"><Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Что хочет: IELTS, для ребёнка, разговорный…" /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/* ---------- сообщение по шаблону ---------- */
export function MessageModal({ to, template }: { to: { kind: 'lead' | 'student'; id: ID }; template?: string }) {
  const db = useDB();
  const { openModal } = useApp();
  const r = recipientOf(db, to);
  const [key, setKey] = useState<TemplateKey>(() => (template as TemplateKey) || (r ? defaultTemplate(db, r) : 'greeting'));
  const [text, setText] = useState(() => (r ? messageText(db, r, key) : ''));
  if (!r) return null;
  const wa = db.settings.channels.whatsapp;
  const pick = (k: TemplateKey) => { setKey(k); setText(messageText(db, r, k)); };
  const send = async (ch: 'whatsapp' | 'telegram') => {
    if (ch === 'telegram') { const ok = await copyText(text); toast(ok ? 'Текст скопирован — вставьте его в чат Telegram' : 'Откройте чат и вставьте текст', { tone: 'info' }); }
    window.open(chatLink(ch, r.phone, text), '_blank', 'noopener');
    if (r.lead) A.markReplied(r.lead.id, 'Написали: «' + (db.templates.find(t => t.key === key)?.title || 'сообщение') + '»');
    openModal(null);
  };
  return (
    <Modal title={'Написать: ' + r.name} subtitle={r.phone} onClose={() => openModal(null)}
      footer={<>
        <Button variant="ghost" icon={Copy} onClick={async () => { toast((await copyText(text)) ? 'Текст скопирован' : 'Не получилось скопировать', { tone: 'info' }); }}>Скопировать</Button>
        {wa && <Button variant={r.channel === 'whatsapp' ? 'primary' : 'secondary'} icon={MessageCircle} onClick={() => send('whatsapp')}>WhatsApp</Button>}
        <Button variant={r.channel === 'telegram' || !wa ? 'primary' : 'secondary'} icon={Send} onClick={() => send('telegram')}>Telegram</Button>
      </>}>
      <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
        {db.templates.map(t => <Chip key={t.key} on={key === t.key} onClick={() => pick(t.key)}>{t.title}</Chip>)}
      </div>
      <Textarea value={text} onChange={e => setText(e.target.value)} rows={6} aria-label="Текст сообщения" className="min-h-[150px]" />
      <p className="mt-2 text-xs text-ink-3">{wa ? 'WhatsApp откроется с готовым текстом. ' : ''}Telegram не умеет подставлять текст по номеру — мы скопируем его, останется вставить.</p>
    </Modal>
  );
}

/* ---------- запись на пробный: день → свободное окно ---------- */
export function BookTrialModal({ leadId }: { leadId: ID }) {
  const db = useDB();
  const { openModal } = useApp();
  const lead = db.leads.find(l => l.id === leadId)!;
  const [day, setDay] = useState(() => { const now = Date.now(); return new Date().getHours() >= 19 ? addDays(startOfDay(now), 1) : startOfDay(now); });
  const [slot, setSlot] = useState<{ t: number; teacher: ID } | null>(null);
  const dur = db.settings.trialDuration;
  const byTeacher = useMemo(() => db.teachers.map(t => ({ t, slots: freeSlots(db, t.id, day, dur) })).filter(x => x.slots.length), [db, day, dur]);
  const book = () => {
    if (!slot) return;
    A.bookTrial(leadId, slot.teacher, slot.t, dur);
    openModal(null);
    toast(`${firstName(lead.name)}: пробный ${whenLong(slot.t)}`, { action: { label: 'Напомнить', run: () => openModal({ type: 'message', to: { kind: 'lead', id: leadId }, template: 'trial_reminder' }) } });
  };
  return (
    <Modal title="Записать на пробный" subtitle={lead.name + (lead.goal ? ' · ' + lead.goal : '')} onClose={() => openModal(null)} width={600}
      footer={<><span className="mr-auto text-[13px] text-ink-2">{slot ? `${teacherById(db, slot.teacher)?.name}, ${whenLong(slot.t)}` : 'Выберите свободное окно'}</span><Button variant="primary" icon={CalendarCheck2} disabled={!slot} onClick={book}>Записать</Button></>}>
      <DayStrip value={day} onChange={d => { setDay(d); setSlot(null); }} />
      <div className="mt-4 grid gap-4">
        {byTeacher.length === 0 && <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-[13px] text-ink-2">В этот день у всех преподавателей занято. Выберите другой день.</p>}
        {byTeacher.map(({ t, slots }) => (
          <div key={t.id}>
            <div className="mb-2 flex items-center gap-2 text-[13px] font-medium"><span className="size-2.5 rounded-full" style={{ background: t.color }} aria-hidden />{t.name}<span className="text-ink-3">· {plural(slots.length, 'окно', 'окна', 'окон')}</span></div>
            <div className="flex flex-wrap gap-1.5">
              {slots.map(s => {
                const on = slot?.t === s && slot.teacher === t.id;
                return <button key={s} type="button" onClick={() => setSlot({ t: s, teacher: t.id })} aria-pressed={on}
                  className={cx('tnum h-9 rounded-[10px] border px-3 text-sm transition-[background,border-color] duration-150', on ? 'border-accent bg-accent font-semibold text-white dark:text-[#101018]' : 'border-line-2 bg-surface hover:border-ink-3')}>{hm(s)}</button>;
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ---------- отказ: причина обязательна ---------- */
export function LoseModal({ leadId }: { leadId: ID }) {
  const db = useDB();
  const { openModal } = useApp();
  const lead = db.leads.find(l => l.id === leadId)!;
  const [reason, setReason] = useState<LostReason | null>(null), [comment, setComment] = useState('');
  const save = () => { if (!reason) return; A.loseLead(leadId, reason, comment); openModal(null); toast('Заявка закрыта: ' + LOST_LABEL[reason].toLowerCase(), { tone: 'info', action: undoAction }); };
  return (
    <Modal title="Почему отказ?" subtitle={lead.name + ' · без причины закрыть нельзя — по ним видно, что улучшать'} onClose={() => openModal(null)}
      footer={<><Button variant="ghost" onClick={() => openModal(null)}>Отмена</Button><Button variant="danger" disabled={!reason} onClick={save}>Закрыть заявку</Button></>}>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(LOST_LABEL) as LostReason[]).map(k => (
          <button key={k} type="button" onClick={() => setReason(k)} aria-pressed={reason === k}
            className={cx('flex h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium transition-[background,border-color] duration-150', reason === k ? 'border-ink bg-ink text-canvas' : 'border-line-2 bg-surface hover:border-ink-3')}>
            {reason === k && <Check className="size-4" aria-hidden />}{LOST_LABEL[k]}
          </button>
        ))}
      </div>
      <Field label="Комментарий" hint="Необязательно" className="mt-4"><Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Например: вернётся в сентябре" /></Field>
    </Modal>
  );
}

/* ---------- оплата по заявке: ученик + абонемент + группа ---------- */
export function ConvertModal({ leadId }: { leadId: ID }) {
  const db = useDB();
  const { openModal, openDrawer, fmt } = useApp();
  const lead = db.leads.find(l => l.id === leadId)!;
  const [forChild, setForChild] = useState(!!lead.forChild);
  const [studentName, setStudentName] = useState(lead.forChild ? '' : lead.name);
  const [level, setLevel] = useState<Level>('A2');
  const [format, setFormat] = useState<'group' | 'individual'>(/индивид/i.test(lead.comment + (lead.goal || '')) ? 'individual' : 'group');
  const groups = db.groups.filter(g => g.studentIds.length < g.capacity);
  const [groupId, setGroupId] = useState(() => (groups.find(g => g.level === level) || groups[0])?.id || '');
  const trialTeacher = db.lessons.find(l => l.id === lead.trialLessonId)?.teacherId || db.teachers[0].id;
  const [teacherId, setTeacherId] = useState(trialTeacher);
  const [day, setDay] = useState(addDays(startOfDay(Date.now()), 1));
  const [first, setFirst] = useState<number | null>(null);
  const pkgs = db.packageTypes.filter(p => p.kind === format);
  const [pkgId, setPkgId] = useState(pkgs[0].id);
  const pkg = db.packageTypes.find(p => p.id === pkgId && p.kind === format) || pkgs[0];
  const [amount, setAmount] = useState(String(pkg.price));
  const [method, setMethod] = useState<PayMethod>('sbp');
  const [tried, setTried] = useState(false);
  const setPkg = (id: ID) => { setPkgId(id); const p = db.packageTypes.find(x => x.id === id)!; setAmount(String(p.price)); };
  const setFmt = (f: 'group' | 'individual') => { setFormat(f); const p = db.packageTypes.find(x => x.kind === f)!; setPkg(p.id); };
  const slots = useMemo(() => freeSlots(db, teacherId, day, 60), [db, teacherId, day]);
  const okName = studentName.trim().length > 1, okPlace = format === 'group' ? !!groupId : !!first, okAmount = +amount > 0;
  const save = () => {
    setTried(true); if (!okName || !okPlace || !okAmount) return;
    const sid = A.convertLead({
      leadId, studentName, forChild, payerName: lead.name, level, packageTypeId: pkg.id, amount: +amount, method,
      groupId: format === 'group' ? groupId : undefined,
      individual: format === 'individual' && first ? { teacherId, weekday: isoWeekday(first), time: hm(first), firstStart: first } : undefined,
    });
    openModal(null);
    toast(`Оплата принята, ${firstName(studentName)} — в учениках`, { action: { label: 'Открыть', run: () => openDrawer({ type: 'student', id: sid }) } });
  };
  return (
    <Modal title="Принять оплату и записать на обучение" subtitle={lead.name} onClose={() => openModal(null)} width={620}
      footer={<><Button variant="ghost" onClick={() => openModal(null)}>Отмена</Button><Button variant="primary" onClick={save}>Принять {okAmount ? fmt(+amount) : ''}</Button></>}>
      <div className="grid gap-5">
        <div className="grid gap-3">
          <Segmented value={forChild ? 'child' : 'self'} onChange={v => { setForChild(v === 'child'); setStudentName(v === 'child' ? '' : lead.name); }} options={[{ value: 'self', label: 'Учится сам' }, { value: 'child', label: 'Учится ребёнок' }]} />
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <Field label={forChild ? 'Имя ребёнка' : 'Имя ученика'} error={tried && !okName ? 'Укажите имя' : undefined} hint={forChild ? `Платить будет ${lead.name}` : undefined}>
              <Input value={studentName} onChange={e => setStudentName(e.target.value)} invalid={tried && !okName} autoFocus={forChild} placeholder={forChild ? 'Например, Алихан' : ''} />
            </Field>
            <Field label="Уровень"><Select value={level} onChange={e => { setLevel(e.target.value as Level); const g = groups.find(g => g.level === e.target.value); if (g) setGroupId(g.id); }}>{(['A1', 'A2', 'B1', 'B2', 'C1'] as Level[]).map(l => <option key={l}>{l}</option>)}</Select></Field>
          </div>
        </div>

        <div className="grid gap-3">
          <Segmented value={format} onChange={setFmt} options={[{ value: 'group', label: 'В группу', icon: Users }, { value: 'individual', label: 'Индивидуально', icon: UserIcon }]} />
          {format === 'group' ? (
            <div className="grid gap-1.5">
              {groups.map(g => (
                <button key={g.id} type="button" onClick={() => setGroupId(g.id)} aria-pressed={groupId === g.id}
                  className={cx('flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-[background,border-color] duration-150', groupId === g.id ? 'border-accent bg-accent-soft' : 'border-line-2 hover:border-ink-3')}>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: teacherById(db, g.teacherId)?.color }} aria-hidden />
                  <span className="min-w-0 flex-1 leading-tight"><span className="block text-sm font-medium">{g.name}</span><span className="block text-xs text-ink-3">{g.weekdays.map(w => WEEKDAYS[w - 1]).join(', ')} · {g.time} · {teacherById(db, g.teacherId)?.name}</span></span>
                  {g.level === level && <Badge tone="ok">ваш уровень</Badge>}
                  <span className="tnum text-xs text-ink-3">{g.studentIds.length}/{g.capacity}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid gap-3">
              <Field label="Преподаватель"><Select value={teacherId} onChange={e => { setTeacherId(e.target.value); setFirst(null); }}>{db.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
              <div><div className="mb-2 text-[13px] font-medium text-ink-2">Первое занятие — дальше каждую неделю в это же время</div>
                <DayStrip value={day} onChange={d => { setDay(d); setFirst(null); }} from={addDays(Date.now(), 1)} />
                <div className="mt-2"><TimeGrid day={day} value={first} onChange={setFirst} slots={slots} /></div>
                {tried && !first && <p className="mt-1.5 text-xs text-bad">Выберите время первого занятия</p>}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            {pkgs.map(p => (
              <button key={p.id} type="button" onClick={() => setPkg(p.id)} aria-pressed={pkg.id === p.id}
                className={cx('rounded-xl border px-3 py-2.5 text-left transition-[background,border-color] duration-150', pkg.id === p.id ? 'border-accent bg-accent-soft' : 'border-line-2 hover:border-ink-3')}>
                <span className="block text-sm font-medium">{p.title}</span><span className="tnum block text-[13px] text-ink-2">{fmt(p.price)}</span>
              </button>
            ))}
          </div>
          <PayFields amount={amount} setAmount={setAmount} method={method} setMethod={setMethod} invalid={tried && !okAmount} />
        </div>
      </div>
    </Modal>
  );
}

function PayFields({ amount, setAmount, method, setMethod, invalid }: { amount: string; setAmount: (v: string) => void; method: PayMethod; setMethod: (m: PayMethod) => void; invalid?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
      <Field label="Сумма, ₽" error={invalid ? 'Укажите сумму' : undefined}>
        <Input inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, '').slice(0, 9))} className="tnum" invalid={invalid} />
      </Field>
      <Field label="Способ">
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(METHOD_LABEL) as PayMethod[]).map(m => {
            const I = METHOD_ICON[m];
            return <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m}
              className={cx('flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl border text-[11.5px] font-medium transition-[background,border-color] duration-150 sm:h-10 sm:flex-row sm:gap-1.5 sm:text-[13px]', method === m ? 'border-ink bg-ink text-canvas' : 'border-line-2 bg-surface hover:border-ink-3')}>
              <I className="size-4" aria-hidden />{METHOD_LABEL[m]}</button>;
          })}
        </div>
      </Field>
    </div>
  );
}

/* ---------- принять оплату у ученика ---------- */
export function PaymentModal({ studentId: initial }: { studentId?: ID }) {
  const db = useDB();
  const { openModal, fmt } = useApp();
  const s = db.settings;
  const [studentId, setStudentId] = useState<ID | undefined>(initial);
  const [q, setQ] = useState('');
  const bal = useMemo(() => balanceMap(db), [db]);
  const st = db.students.find(x => x.id === studentId);
  const kind = st && isIndividualStudent(db, st.id) ? 'individual' : 'group';
  const pkgs = db.packageTypes.filter(p => p.kind === kind);
  const [pkgId, setPkgId] = useState<ID>('');
  const pkg = pkgs.find(p => p.id === pkgId) || pkgs[0];
  const [amount, setAmount] = useState(''), [method, setMethod] = useState<PayMethod>('sbp'), [comment, setComment] = useState('');
  const amt = amount === '' ? pkg.price : +amount;
  const b = st ? bal.get(st.id) : undefined;
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return db.students.filter(x => x.status !== 'left' && (!t || x.name.toLowerCase().includes(t)))
      .sort((a, c) => (bal.get(a.id)!.left - bal.get(c.id)!.left)).slice(0, 8);
  }, [db.students, q, bal]);
  const save = () => {
    if (!st || amt <= 0) return;
    A.acceptPayment({ studentId: st.id, packageTypeId: pkg.id, amount: amt, method, comment });
    openModal(null);
    toast(`Оплата ${fmt(amt)} принята · ${firstName(st.name)} +${pkg.lessons} занятий`, { action: undoAction });
  };
  return (
    <Modal title="Принять оплату" subtitle={st ? st.name : 'Выберите ученика'} onClose={() => openModal(null)} width={560}
      footer={<><Button variant="ghost" onClick={() => openModal(null)}>Отмена</Button><Button variant="primary" disabled={!st || amt <= 0} onClick={save}>Принять {st && amt > 0 ? fmt(amt) : ''}</Button></>}>
      {!st ? (
        <div className="grid gap-2">
          <Input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Имя ученика" aria-label="Поиск ученика" />
          <div className="grid gap-1">
            {list.map(x => { const bb = bal.get(x.id)!; return (
              <button key={x.id} type="button" onClick={() => setStudentId(x.id)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left hover:bg-surface-2">
                <span className="min-w-0 flex-1 text-sm font-medium">{x.name}</span>
                {bb.left < 0 ? <Badge tone="bad">долг {fmt(bb.debt)}</Badge> : bb.left <= s.lowBalance ? <Badge tone="warn">осталось {bb.left}</Badge> : <span className="tnum text-xs text-ink-3">{plural(bb.left, 'урок', 'урока', 'уроков')}</span>}
              </button>
            ); })}
            {!list.length && <p className="py-6 text-center text-[13px] text-ink-2">Никого не нашли</p>}
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {b && <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-3 text-[13px]">
            <span className="text-ink-2">Сейчас: {b.left < 0 ? <b className="text-bad">долг {plural(-b.left, 'урок', 'урока', 'уроков')}</b> : <b className="text-ink">{plural(b.left, 'урок', 'урока', 'уроков')}</b>}</span>
            <span className="text-ink-2">После оплаты: <b className="tnum text-ink">{b.left + pkg.lessons}</b></span>
          </div>}
          <div className="grid grid-cols-2 gap-2">
            {pkgs.map(p => (
              <button key={p.id} type="button" onClick={() => { setPkgId(p.id); setAmount(''); }} aria-pressed={pkg.id === p.id}
                className={cx('rounded-xl border px-3 py-2.5 text-left transition-[background,border-color] duration-150', pkg.id === p.id ? 'border-accent bg-accent-soft' : 'border-line-2 hover:border-ink-3')}>
                <span className="block text-sm font-medium">{p.title}</span><span className="tnum block text-[13px] text-ink-2">{fmt(p.price)}</span>
              </button>
            ))}
          </div>
          <PayFields amount={String(amt)} setAmount={setAmount} method={method} setMethod={setMethod} />
          <Field label="Комментарий" hint="Необязательно"><Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Например: скидка 10% за друга" /></Field>
          {!initial && <button type="button" className="justify-self-start text-[13px] text-ink-2 underline underline-offset-2" onClick={() => setStudentId(undefined)}>Выбрать другого ученика</button>}
        </div>
      )}
    </Modal>
  );
}

/* ---------- новое занятие ---------- */
export function NewLessonModal({ start, teacherId: t0, leadId }: { start?: number; teacherId?: ID; leadId?: ID }) {
  const db = useDB();
  const { openModal } = useApp();
  const [kind, setKind] = useState<LessonKind>(leadId ? 'trial' : 'group');
  const [groupId, setGroupId] = useState(() => db.groups.find(g => !t0 || g.teacherId === t0)?.id || db.groups[0].id);
  const [studentId, setStudentId] = useState(() => db.students.find(s => s.status === 'active')!.id);
  const openLeads = db.leads.filter(l => l.status === 'new' || l.status === 'contacted' || l.id === leadId);
  const [lead, setLead] = useState(leadId || openLeads[0]?.id || '');
  const [teacherId, setTeacherId] = useState(t0 || db.teachers[0].id);
  const [day, setDay] = useState(startOfDay(start || Date.now()));
  const [time, setTime] = useState<number | null>(start || null);
  const [repeat, setRepeat] = useState(true);
  const effTeacher = kind === 'group' ? groupById(db, groupId)!.teacherId : teacherId;
  const duration = kind === 'trial' ? db.settings.trialDuration : kind === 'group' ? groupById(db, groupId)!.duration : 60;
  const conflict = time ? hasConflict(db, effTeacher, time, duration) : false;
  const ok = time && (kind !== 'trial' || lead) && time > Date.now() - 6e4;
  const save = () => {
    if (!ok || !time) return;
    A.createLessons({ kind, teacherId: effTeacher, start: time, duration, groupId: kind === 'group' ? groupId : undefined, studentId: kind === 'individual' ? studentId : undefined, leadId: kind === 'trial' ? lead : undefined, repeatWeeks: kind !== 'trial' && repeat ? 12 : 1 });
    openModal(null);
    toast(`${KIND_LABEL[kind]}: ${whenLong(time)}${kind !== 'trial' && repeat ? ', каждую неделю' : ''}`, { action: undoAction });
  };
  return (
    <Modal title="Новое занятие" onClose={() => openModal(null)} width={600}
      footer={<>{conflict && <span className="mr-auto flex items-center gap-1.5 text-[13px] text-warn"><AlertTriangle className="size-4" aria-hidden />У преподавателя уже занято</span>}<Button variant="ghost" onClick={() => openModal(null)}>Отмена</Button><Button variant="primary" disabled={!ok} onClick={save}>Создать</Button></>}>
      <div className="grid gap-4">
        <Segmented value={kind} onChange={setKind} options={[{ value: 'group', label: 'Группа' }, { value: 'individual', label: 'Индивидуально' }, { value: 'trial', label: 'Пробный' }]} />
        {kind === 'group' && <Field label="Группа"><Select value={groupId} onChange={e => setGroupId(e.target.value)}>{db.groups.map(g => <option key={g.id} value={g.id}>{g.name} · {teacherById(db, g.teacherId)?.name}</option>)}</Select></Field>}
        {kind === 'individual' && <Field label="Ученик"><Select value={studentId} onChange={e => setStudentId(e.target.value)}>{db.students.filter(s => s.status !== 'left').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
        {kind === 'trial' && <Field label="Кого записываем">{openLeads.length ? <Select value={lead} onChange={e => setLead(e.target.value)}>{openLeads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</Select> : <p className="text-[13px] text-ink-2">Нет заявок без пробного</p>}</Field>}
        {kind !== 'group' && <Field label="Преподаватель"><Select value={teacherId} onChange={e => setTeacherId(e.target.value)}>{db.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>}
        <div><DayStrip value={day} onChange={d => { setDay(d); if (time) setTime(at(d, hm(time))); }} /><div className="mt-2"><TimeGrid day={day} value={time} onChange={setTime} isBusy={t => hasConflict(db, effTeacher, t, duration)} /></div></div>
        {kind !== 'trial' && <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} className="size-5 accent-[var(--c-accent)]" />Повторять каждую неделю (на 3 месяца вперёд)</label>}
      </div>
    </Modal>
  );
}

/* ---------- перенос занятия ---------- */
export function MoveLessonModal({ lessonId }: { lessonId: ID }) {
  const db = useDB();
  const { openModal } = useApp();
  const l = db.lessons.find(x => x.id === lessonId)!;
  const [teacherId, setTeacherId] = useState(l.teacherId);
  const [day, setDay] = useState(startOfDay(l.start));
  const [time, setTime] = useState<number | null>(null);
  const [scope, setScope] = useState<'one' | 'future'>('one');
  const conflict = time ? hasConflict(db, teacherId, time, l.duration, l.id) : false;
  const save = () => {
    if (!time) return;
    A.moveLesson(lessonId, time, scope, teacherId !== l.teacherId ? teacherId : undefined);
    openModal(null);
    toast(`Перенесено на ${whenLong(time)}${scope === 'future' ? ' и дальше по неделям' : ''}`, { action: undoAction });
  };
  return (
    <Modal title="Перенести занятие" subtitle={`${lessonTitle(db, l)} · сейчас ${dateShort(l.start)}, ${hm(l.start)}`} onClose={() => openModal(null)} width={600}
      footer={<>{conflict && <span className="mr-auto flex items-center gap-1.5 text-[13px] text-warn"><AlertTriangle className="size-4" aria-hidden />В это время у преподавателя другое занятие</span>}<Button variant="ghost" onClick={() => openModal(null)}>Отмена</Button><Button variant="primary" disabled={!time} onClick={save}>Перенести</Button></>}>
      <div className="grid gap-4">
        {l.seriesId && <Segmented value={scope} onChange={setScope} options={[{ value: 'one', label: 'Только это занятие' }, { value: 'future', label: 'Это и следующие' }]} />}
        <Field label="Преподаватель"><Select value={teacherId} onChange={e => setTeacherId(e.target.value)}>{db.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        <div><DayStrip value={day} onChange={d => { setDay(d); setTime(null); }} /><div className="mt-2"><TimeGrid day={day} value={time} onChange={setTime} isBusy={t => hasConflict(db, teacherId, t, l.duration, l.id)} /></div></div>
        <p className="text-xs text-ink-3">Пунктиром отмечено время, когда у преподавателя уже есть занятие.</p>
      </div>
    </Modal>
  );
}

/* ---------- отмена занятия ---------- */
const CANCEL_REASONS = ['Болеет ученик', 'Болеет преподаватель', 'Праздник', 'Ученик не пришёл', 'Другое'];
export function CancelLessonModal({ lessonId }: { lessonId: ID }) {
  const db = useDB();
  const { openModal } = useApp();
  const l = db.lessons.find(x => x.id === lessonId)!;
  const [reason, setReason] = useState(''), [scope, setScope] = useState<'one' | 'future'>('one');
  const save = () => { if (!reason) return; A.cancelLesson(lessonId, reason, scope); openModal(null); toast('Занятие отменено', { tone: 'info', action: undoAction }); };
  return (
    <Modal title="Отменить занятие" subtitle={`${lessonTitle(db, l)} · ${dateShort(l.start)}, ${hm(l.start)}`} onClose={() => openModal(null)}
      footer={<><Button variant="ghost" onClick={() => openModal(null)}>Не отменять</Button><Button variant="danger" disabled={!reason} onClick={save}>Отменить занятие</Button></>}>
      <div className="grid gap-4">
        {l.seriesId && <Segmented value={scope} onChange={setScope} options={[{ value: 'one', label: 'Только это' }, { value: 'future', label: 'Это и все следующие' }]} />}
        <div className="flex flex-wrap gap-1.5">{CANCEL_REASONS.map(r => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}</div>
        <p className="text-xs text-ink-3">Отменённое занятие не списывается с абонемента. Если нужно — перенесите его вместо отмены.</p>
      </div>
    </Modal>
  );
}

export const studentGroupsLabel = (db: ReturnType<typeof useDB>, sid: ID) => studentGroups(db, sid).map(g => g.name).join(', ');

/* ---------- ученик ушёл: причина для отчёта по отвалу ---------- */
const LEFT_REASONS = ['Нет времени', 'Дорого', 'Переезд', 'Достиг цели', 'Не подошёл формат', 'Ушёл в другую школу', 'Другое'];
export function StudentLeftModal({ studentId }: { studentId: ID }) {
  const db = useDB();
  const { openModal } = useApp();
  const st = db.students.find(x => x.id === studentId)!;
  const [reason, setReason] = useState('');
  const save = () => { if (!reason) return; A.setStudentStatus(studentId, 'left', reason); openModal(null); toast(`${firstName(st.name)}: ушёл · ${reason.toLowerCase()}`, { tone: 'info', action: undoAction }); };
  return (
    <Modal title="Ученик уходит" subtitle={st.name + ' · причина попадёт в отчёт по отвалу'} onClose={() => openModal(null)}
      footer={<><Button variant="ghost" onClick={() => openModal(null)}>Отмена</Button><Button variant="danger" disabled={!reason} onClick={save}>Отметить уход</Button></>}>
      <div className="flex flex-wrap gap-1.5">{LEFT_REASONS.map(r => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}</div>
      <p className="mt-3 text-xs text-ink-3">Ученик уйдёт из групп, история оплат и посещений сохранится. Вернуть можно в любой момент.</p>
    </Modal>
  );
}
