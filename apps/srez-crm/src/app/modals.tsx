/* Модальные окна действий. Минимум полей: всё, что можно, подставлено заранее. */
import { useMemo, useState } from 'react';
import { Send, Copy, CalendarCheck2, Smartphone, CreditCard, FileText, ArrowRightLeft, AlertTriangle, Check, CalendarClock } from 'lucide-react';
import type { Channel, ID, LostReason, PayMethod, TemplateKey, Tariff, Track, PayPlan, Experience } from '../domain/types';
import { CHANNEL_LABEL, LOST_LABEL, METHOD_LABEL, TARIFF_LABEL, TRACK_LABEL } from '../domain/labels';
import { useDB, undo } from '../data/store';
import * as A from '../data/actions';
import { moneyOf, plan, isLate, currentCohort, nextCohort } from '../data/selectors';
import { addDays, dateShort, startOfDay, firstName, MIN } from '../lib/format';
import { isFullPhone } from '../lib/phone';
import { chatLink, copyText } from '../lib/messaging';
import { Modal, toast } from '../ui/overlay';
import { Button, Field, Input, PhoneInput, Segmented, Select, Textarea, Chip, cx, Badge } from '../ui/kit';
import { CHANNEL_ICON } from '../ui/domain';
import { useApp } from './ctx';
import { DayStrip, TimeGrid, whenLong } from './pickers';
import { defaultTemplate, messageText, recipientOf } from './message';

const undoAction = { label: 'Отменить', run: () => { if (undo()) toast('Изменение отменено', { tone: 'info' }); } };
const METHOD_ICON: Record<PayMethod, typeof Send> = { card: CreditCard, sbp: Smartphone, invoice: FileText, bank: ArrowRightLeft };

function MethodPicker({ value, onChange }: { value: PayMethod; onChange: (m: PayMethod) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {(Object.keys(METHOD_LABEL) as PayMethod[]).map(m => {
        const I = METHOD_ICON[m];
        return <button key={m} type="button" onClick={() => onChange(m)} aria-pressed={value === m}
          className={cx('flex h-11 items-center justify-center gap-1.5 rounded-full border text-[13px] font-medium transition-[background,border-color] duration-150', value === m ? 'border-accent bg-accent text-[#0b0b0c]' : 'border-line-2 hover:border-ink-3')}>
          <I className="size-4" aria-hidden />{METHOD_LABEL[m]}</button>;
      })}
    </div>
  );
}

/* ---------- новая заявка ---------- */
export function NewLeadModal() {
  const db = useDB();
  const { openModal, openDrawer } = useApp();
  const ch = Object.keys(CHANNEL_LABEL) as Channel[];
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [channel, setChannel] = useState<Channel>('telegram');
  const [tariff, setTariff] = useState<Tariff>('live'), [experience, setExperience] = useState<Experience>('junior');
  const [comment, setComment] = useState(''), [tried, setTried] = useState(false);
  const dup = useMemo(() => { const d = phone.replace(/\D/g, ''); return d.length === 11 ? db.leads.find(l => l.phone.replace(/\D/g, '') === d && l.status !== 'lost') || null : null; }, [phone, db.leads]);
  const okName = name.trim().length > 1, okPhone = isFullPhone(phone);
  const submit = () => {
    setTried(true); if (!okName || !okPhone) return;
    const id = A.addLead({ name, phone, channel, comment, tariff, experience });
    openModal(null);
    toast('Заявка добавлена в «Новые»', { action: { label: 'Открыть', run: () => openDrawer({ type: 'lead', id }) } });
  };
  return (
    <Modal title="Новая заявка" subtitle="Достаточно имени и телефона — остальное можно дописать потом" onClose={() => openModal(null)}
      footer={<><Button variant="ghost" onClick={() => openModal(null)}>Отмена</Button><Button variant="primary" onClick={submit}>Добавить заявку</Button></>}>
      <form className="grid gap-4" onSubmit={e => { e.preventDefault(); submit(); }}>
        <Field label="Имя" error={tried && !okName ? 'Как зовут человека?' : undefined}><Input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Например, Ольга Петрова" invalid={tried && !okName} /></Field>
        <Field label="Телефон" error={tried && !okPhone ? 'Нужен номер полностью: +7 и 10 цифр' : undefined}><PhoneInput value={phone} onChange={setPhone} invalid={tried && !okPhone} /></Field>
        {dup && <div className="flex items-center gap-2 rounded-2xl bg-warn-soft px-3 py-2.5 text-[13px] text-warn"><AlertTriangle className="size-4 shrink-0" aria-hidden />Такой номер уже есть: {dup.name}. <button type="button" className="font-semibold underline" onClick={() => { openModal(null); openDrawer({ type: 'lead', id: dup.id }); }}>Открыть</button></div>}
        <Field label="Откуда пришла">
          <div className="flex flex-wrap gap-1.5">{ch.map(c => <Chip key={c} on={channel === c} onClick={() => setChannel(c)} icon={CHANNEL_ICON[c]}>{CHANNEL_LABEL[c]}</Chip>)}</div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Интересует"><Segmented value={tariff} onChange={setTariff} options={[{ value: 'live', label: 'Живой поток' }, { value: 'self', label: 'Записи' }]} className="w-full" /></Field>
          <Field label="Опыт в маркетинге"><Segmented value={experience} onChange={setExperience} options={[{ value: 'junior', label: 'до 3 лет' }, { value: 'senior', label: '3+ года' }]} className="w-full" /></Field>
        </div>
        <Field label="Комментарий" hint="Необязательно"><Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Чем занимается, какая задача" /></Field>
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
  const pick = (k: TemplateKey) => { setKey(k); setText(messageText(db, r, k)); };
  const send = async () => {
    const ok = await copyText(text);
    toast(ok ? 'Текст скопирован — вставьте его в чат Telegram' : 'Откройте чат и вставьте текст', { tone: 'info' });
    window.open(chatLink(r.phone), '_blank', 'noopener');
    if (r.lead) A.markReplied(r.lead.id, 'Написали: «' + (db.templates.find(t => t.key === key)?.title || 'сообщение') + '»');
    openModal(null);
  };
  return (
    <Modal title={'Написать: ' + r.name} subtitle={r.phone} onClose={() => openModal(null)}
      footer={<>
        <Button variant="ghost" icon={Copy} onClick={async () => { toast((await copyText(text)) ? 'Текст скопирован' : 'Не получилось скопировать', { tone: 'info' }); }}>Скопировать</Button>
        <Button variant="primary" icon={Send} onClick={send}>Открыть Telegram</Button>
      </>}>
      <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
        {db.templates.map(t => <Chip key={t.key} on={key === t.key} onClick={() => pick(t.key)}>{t.title}</Chip>)}
      </div>
      <Textarea value={text} onChange={e => setText(e.target.value)} rows={6} aria-label="Текст сообщения" className="min-h-[150px]" />
      <p className="mt-2 text-xs text-ink-3">Telegram не умеет подставлять текст по номеру — мы скопируем его, останется вставить в чат.</p>
    </Modal>
  );
}

/* ---------- созвон-консультация: день → время ---------- */
export function BookCallModal({ leadId }: { leadId: ID }) {
  const db = useDB();
  const { openModal } = useApp();
  const lead = db.leads.find(l => l.id === leadId)!;
  const [day, setDay] = useState(() => (new Date().getHours() >= 19 ? addDays(startOfDay(Date.now()), 1) : startOfDay(Date.now())));
  const [t, setT] = useState<number | null>(null);
  const dur = db.settings.callDuration;
  // занято, если у кого-то уже созвон в пределах получаса
  const busy = (x: number) => db.leads.some(l => l.id !== leadId && l.status === 'call_booked' && l.callAt && Math.abs(l.callAt - x) < dur * MIN);
  const book = () => {
    if (!t) return;
    A.bookCall(leadId, t);
    openModal(null);
    toast(`${firstName(lead.name)}: созвон ${whenLong(t)}`, { action: { label: 'Напомнить', run: () => openModal({ type: 'message', to: { kind: 'lead', id: leadId }, template: 'call_reminder' }) } });
  };
  return (
    <Modal title="Назначить созвон" subtitle={`${lead.name} · ${dur} минут: задача, формат, ответы на вопросы`} onClose={() => openModal(null)} width={600}
      footer={<><span className="mr-auto text-[13px] text-ink-2">{t ? whenLong(t) : 'Выберите день и время'}</span><Button variant="primary" icon={CalendarCheck2} disabled={!t} onClick={book}>Назначить</Button></>}>
      <DayStrip value={day} onChange={d => { setDay(d); setT(null); }} />
      <div className="mt-4"><TimeGrid day={day} value={t} onChange={setT} from={10} to={20} step={30} isBusy={busy} /></div>
      <p className="mt-3 text-xs text-ink-3">Пунктиром — время, где у команды уже есть созвон.</p>
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
            className={cx('flex min-h-12 items-center gap-2 rounded-2xl border px-3 text-left text-sm font-medium transition-[background,border-color] duration-150', reason === k ? 'border-accent bg-accent text-[#0b0b0c]' : 'border-line-2 hover:border-ink-3')}>
            {reason === k && <Check className="size-4 shrink-0" aria-hidden />}{LOST_LABEL[k]}
          </button>
        ))}
      </div>
      <Field label="Комментарий" hint="Необязательно" className="mt-4"><Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Например: вернётся к весеннему потоку" /></Field>
    </Modal>
  );
}

/* ---------- оплата по заявке: тариф, рассрочка, поток ---------- */
export function ConvertModal({ leadId }: { leadId: ID }) {
  const db = useDB();
  const { openModal, openDrawer, fmt } = useApp();
  const lead = db.leads.find(l => l.id === leadId)!;
  const cur = currentCohort(db), next = nextCohort(db);
  const [cohortId, setCohortId] = useState<ID>((next || cur).id);
  const [tariff, setTariff] = useState<Tariff>(lead.tariff);
  const [track, setTrack] = useState<Track>(lead.experience === 'senior' ? 'own' : 'brief');
  const [payPlan, setPayPlan] = useState<PayPlan>('installments');
  const [method, setMethod] = useState<PayMethod>('card');
  const [company, setCompany] = useState(''), [position, setPosition] = useState(lead.position || '');
  const groups = db.groups.filter(g => g.studentIds.every(sid => db.students.find(s => s.id === sid)?.cohortId === cohortId) && g.studentIds.length > 0);
  const [groupId, setGroupId] = useState<ID>('');
  const total = tariff === 'live' ? db.settings.priceLive : db.settings.priceSelf;
  const part = Math.round(total / db.settings.installments);
  const first = payPlan === 'full' ? total : part;
  const save = () => {
    const sid = A.convertLead({ leadId, cohortId, tariff, track, plan: payPlan, method, groupId: groupId || undefined, company, position, firstAmount: first });
    openModal(null);
    toast(`Оплата ${fmt(first)} принята · ${firstName(lead.name)} в потоке`, { action: { label: 'Открыть', run: () => openDrawer({ type: 'student', id: sid }) } });
  };
  return (
    <Modal title="Оплата и место в потоке" subtitle={lead.name} onClose={() => openModal(null)} width={600}
      footer={<><Button variant="ghost" onClick={() => openModal(null)}>Отмена</Button><Button variant="primary" onClick={save}>Принять {fmt(first)}</Button></>}>
      <div className="grid gap-4">
        <Field label="Тариф"><Segmented value={tariff} onChange={setTariff} options={[{ value: 'live', label: `Живой поток · ${fmt(db.settings.priceLive)}` }, { value: 'self', label: `Записи · ${fmt(db.settings.priceSelf)}` }]} className="w-full" /></Field>
        <Field label="Как платит">
          <div className="grid gap-2 sm:grid-cols-2">
            {([['installments', `Рассрочка · ${db.settings.installments} платежей`, `${fmt(part)} в месяц, без процентов`], ['full', 'Сразу', `${fmt(total)} одним платежом`]] as [PayPlan, string, string][]).map(([v, t, s]) => (
              <button key={v} type="button" onClick={() => setPayPlan(v)} aria-pressed={payPlan === v}
                className={cx('rounded-2xl border p-3.5 text-left transition-[background,border-color] duration-150', payPlan === v ? 'border-accent bg-accent-soft' : 'border-line-2 hover:border-ink-3')}>
                <div className="text-sm font-semibold">{t}</div><div className="mt-0.5 text-[13px] text-ink-2">{s}</div>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Способ первого платежа"><MethodPicker value={method} onChange={setMethod} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Поток"><Select value={cohortId} onChange={e => { setCohortId(e.target.value); setGroupId(''); }}>{db.cohorts.filter(c => c.end > Date.now()).map(c => <option key={c.id} value={c.id}>{c.name} · с {dateShort(c.start)}</option>)}</Select></Field>
          <Field label="Практика"><Segmented value={track} onChange={setTrack} options={[{ value: 'brief', label: TRACK_LABEL.brief }, { value: 'own', label: TRACK_LABEL.own }]} className="w-full" /></Field>
        </div>
        {tariff === 'live' && (groups.length
          ? <Field label="Группа" hint="Можно назначить позже"><Select value={groupId} onChange={e => setGroupId(e.target.value)}><option value="">Назначить позже</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name} · {db.curators.find(c => c.id === g.curatorId)?.name} · {g.studentIds.length} чел.</option>)}</Select></Field>
          : <p className="rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink-2">Группы по 4–5 человек собираются за неделю до старта — участник попадёт в список «Без группы».</p>)}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Компания" hint="Необязательно"><Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Где работает" /></Field>
          <Field label="Должность" hint="Необязательно"><Input value={position} onChange={e => setPosition(e.target.value)} placeholder="Например, маркетолог" /></Field>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- платёж по рассрочке ---------- */
export function PayModal({ studentId: initial }: { studentId?: ID }) {
  const db = useDB();
  const { openModal, fmt } = useApp();
  const withDebt = db.students.filter(s => s.status !== 'left' && moneyOf(db, s.id).left > 0).sort((a, b) => a.name.localeCompare(b.name));
  const [sid, setSid] = useState<ID>(initial || withDebt[0]?.id || '');
  const unpaid = plan(db, sid).filter(i => !i.paidAt && i.amount > 0);
  const [iid, setIid] = useState<ID>('');
  const inst = unpaid.find(i => i.id === iid) || unpaid[0];
  const [method, setMethod] = useState<PayMethod>('card');
  const st = db.students.find(s => s.id === sid);
  const save = () => { if (!inst || !st) return; A.payInstallment(inst.id, method); openModal(null); toast(`Платёж ${inst.n}/${inst.of} · ${fmt(inst.amount)} · ${firstName(st.name)}`, { action: undoAction }); };
  const postpone = () => { if (!inst) return; A.moveInstallment(inst.id, 7); openModal(null); toast('Платёж перенесён на неделю', { tone: 'info', action: undoAction }); };
  return (
    <Modal title="Принять платёж" subtitle={st ? `${st.name} · ${TARIFF_LABEL[st.tariff]}` : 'Выберите участника'} onClose={() => openModal(null)} width={560}
      footer={<><Button variant="ghost" icon={CalendarClock} disabled={!inst} onClick={postpone} className="mr-auto">Перенести на неделю</Button><Button variant="primary" disabled={!inst} onClick={save}>Принять {inst ? fmt(inst.amount) : ''}</Button></>}>
      <div className="grid gap-4">
        {!initial && <Field label="Участник"><Select value={sid} onChange={e => { setSid(e.target.value); setIid(''); }}>{withDebt.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
        {unpaid.length ? (
          <Field label="Какой платёж">
            <div className="grid max-h-[240px] gap-1.5 overflow-y-auto">
              {unpaid.map(i => {
                const on = inst?.id === i.id, late = isLate(i);
                return (
                  <button key={i.id} type="button" onClick={() => setIid(i.id)} aria-pressed={on}
                    className={cx('flex h-12 items-center gap-3 rounded-2xl border px-3.5 text-left text-sm transition-[background,border-color] duration-150', on ? 'border-accent bg-accent-soft' : 'border-line-2 hover:border-ink-3')}>
                    <span className="label w-12 text-ink-3">{i.n}/{i.of}</span>
                    <span className="tnum flex-1">до {dateShort(i.due)}</span>
                    {late && <Badge tone="bad">просрочен</Badge>}
                    <span className="tnum font-semibold">{fmt(i.amount)}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        ) : <p className="rounded-2xl bg-ok-soft px-3.5 py-3 text-[13px] text-ok">Всё оплачено — неоплаченных платежей нет.</p>}
        {unpaid.length > 0 && <Field label="Способ"><MethodPicker value={method} onChange={setMethod} /></Field>}
      </div>
    </Modal>
  );
}

/* ---------- вернуть работу на доработку ---------- */
const QUICK_COMMENTS = ['Нет цифр — на чём основан вывод?', 'Сегмент слишком широкий', 'Оффер не отвечает «почему у вас»', 'Слайд не читается за 10 секунд'];
export function ReturnHwModal({ homeworkId }: { homeworkId: ID }) {
  const db = useDB();
  const { openModal } = useApp();
  const h = db.homework.find(x => x.id === homeworkId)!;
  const st = db.students.find(s => s.id === h.studentId)!;
  const [text, setText] = useState('');
  const save = () => { if (!text.trim()) return; A.returnHomework(homeworkId, text); openModal(null); toast('Работа вернулась на доработку', { tone: 'info', action: { label: 'Написать', run: () => openModal({ type: 'message', to: { kind: 'student', id: st.id }, template: 'homework_returned' }) } }); };
  return (
    <Modal title="На доработку" subtitle={`${st.name} · ${h.title}`} onClose={() => openModal(null)}
      footer={<><Button variant="ghost" onClick={() => openModal(null)}>Отмена</Button><Button variant="primary" disabled={!text.trim()} onClick={save}>Вернуть с комментарием</Button></>}>
      <div className="mb-3 flex flex-wrap gap-1.5">{QUICK_COMMENTS.map(c => <Chip key={c} onClick={() => setText(t => (t ? t + ' ' : '') + c)}>{c}</Chip>)}</div>
      <Textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="Что поправить: конкретно, со ссылкой на слайд" aria-label="Комментарий куратора" />
      <p className="mt-2 text-xs text-ink-3">Комментарий увидит участник. Пишите как наниматель, а не как друг: где слайд врёт и что сделать.</p>
    </Modal>
  );
}

/* ---------- участник уходит ---------- */
const LEFT_REASONS = ['Нет времени', 'Сменил работу', 'Не подошёл формат', 'Финансы', 'Переходит на записи'];
export function StudentLeftModal({ studentId }: { studentId: ID }) {
  const db = useDB();
  const { openModal } = useApp();
  const st = db.students.find(s => s.id === studentId)!;
  const [reason, setReason] = useState('');
  const save = () => { if (!reason) return; A.setStudentStatus(studentId, 'left', reason); openModal(null); toast(firstName(st.name) + ' — ушёл из потока', { tone: 'info', action: undoAction }); };
  return (
    <Modal title="Участник уходит" subtitle={st.name + ' · причина нужна для отчёта по оттоку'} onClose={() => openModal(null)}
      footer={<><Button variant="ghost" onClick={() => openModal(null)}>Отмена</Button><Button variant="danger" disabled={!reason} onClick={save}>Отметить уход</Button></>}>
      <div className="flex flex-wrap gap-1.5">{LEFT_REASONS.map(r => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}</div>
      <p className="mt-3 text-xs text-ink-3">Будущие платежи по рассрочке останутся в графике — их можно перенести или отменить вручную.</p>
    </Modal>
  );
}

