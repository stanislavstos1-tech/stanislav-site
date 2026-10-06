/* Доменные бейджи: этап заявки, канал, тариф, оплата, домашка. Цвет всегда дублируется иконкой и текстом. */
import { Inbox, PhoneCall, CalendarClock, CheckCheck, Wallet, BadgeCheck, XCircle, Send, Globe, Phone, Users, AlertTriangle, CircleDollarSign, Check, RotateCcw, Hourglass, Radio, PlayCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Channel, LeadStatus, Tariff, HomeworkStatus } from '../domain/types';
import { CHANNEL_LABEL, STATUS_LABEL, TARIFF_LABEL, HW_LABEL } from '../domain/labels';
import { Badge } from './kit';
import type { Tone } from './kit';
import type { Money } from '../data/selectors';
import { dateShort, money as fmtMoney } from '../lib/format';

export const STATUS_ICON: Record<LeadStatus, LucideIcon> = {
  new: Inbox, contacted: PhoneCall, call_booked: CalendarClock, call_done: CheckCheck, awaiting_payment: Wallet, paid: BadgeCheck, lost: XCircle,
};
export const STATUS_TONE: Record<LeadStatus, Tone> = {
  new: 'accent', contacted: 'info', call_booked: 'warn', call_done: 'info', awaiting_payment: 'warn', paid: 'ok', lost: 'neutral',
};
export const STATUS_BAR: Record<LeadStatus, string> = {
  new: 'var(--c-accent)', contacted: 'var(--c-info)', call_booked: 'var(--c-warn)', call_done: 'var(--c-info)', awaiting_payment: 'var(--c-warn)', paid: 'var(--c-ok)', lost: 'var(--c-ink-3)',
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONE[status]} icon={STATUS_ICON[status]}>{STATUS_LABEL[status]}</Badge>;
}

const VK: LucideIcon = Users;
export const CHANNEL_ICON: Record<Channel, LucideIcon> = { telegram: Send, site: Globe, vk: VK, referral: Users, call: Phone };

export function ChannelTag({ channel, className = '' }: { channel: Channel; className?: string }) {
  const I = CHANNEL_ICON[channel];
  return (
    <span className={'inline-flex items-center gap-1 text-xs text-ink-2 ' + className}>
      <I className="size-3.5" strokeWidth={2} aria-hidden />
      {CHANNEL_LABEL[channel]}
    </span>
  );
}

export function TariffBadge({ tariff }: { tariff: Tariff }) {
  return <Badge tone={tariff === 'live' ? 'accent' : 'neutral'} icon={tariff === 'live' ? Radio : PlayCircle}>{TARIFF_LABEL[tariff]}</Badge>;
}

/** состояние оплаты участника: просрочка, рассрочка идёт, оплачено полностью */
export function PayBadge({ m }: { m: Money }) {
  if (m.late.length) return <Badge tone="bad" icon={CircleDollarSign} title="Просрочен платёж">Просрочка {fmtMoney(m.late.reduce((s, i) => s + i.amount, 0))}</Badge>;
  if (m.left <= 0) return <Badge tone="ok" icon={Check}>Оплачено</Badge>;
  if (m.next) return <Badge tone="neutral" icon={Hourglass} title="Следующий платёж по рассрочке">{m.next.n}/{m.next.of} · {dateShort(m.next.due)}</Badge>;
  return <Badge tone="warn" icon={AlertTriangle}>Остаток {fmtMoney(m.left)}</Badge>;
}

export const HW_TONE: Record<HomeworkStatus, Tone> = { submitted: 'warn', returned: 'bad', accepted: 'ok' };
const HW_ICON: Record<HomeworkStatus, LucideIcon> = { submitted: Hourglass, returned: RotateCcw, accepted: Check };
export function HwBadge({ status }: { status: HomeworkStatus }) {
  return <Badge tone={HW_TONE[status]} icon={HW_ICON[status]}>{HW_LABEL[status]}</Badge>;
}

/** шесть блоков программы точками: принят / на проверке / доработка / не сдан */
export function BlocksBar({ marks }: { marks: (HomeworkStatus | undefined)[] }) {
  const C: Record<HomeworkStatus, string> = { accepted: 'bg-ok', submitted: 'bg-warn', returned: 'bg-bad' };
  return (
    <span className="inline-flex items-center gap-1" title={`Принято блоков: ${marks.filter(m => m === 'accepted').length} из 6`}>
      {marks.map((m, i) => <span key={i} className={'h-1.5 w-4 rounded-full ' + (m ? C[m] : 'bg-surface-3')} aria-hidden />)}
      <span className="sr-only">Принято блоков: {marks.filter(m => m === 'accepted').length} из 6</span>
    </span>
  );
}
