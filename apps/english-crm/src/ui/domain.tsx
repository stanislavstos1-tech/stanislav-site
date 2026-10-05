/* Доменные бейджи: статус заявки, канал, остаток уроков. Цвет всегда дублируется иконкой и текстом. */
import { Inbox, PhoneCall, CalendarClock, CheckCheck, Wallet, BadgeCheck, XCircle, Send, Globe, Phone, Users, MessageCircle, AlertTriangle, CircleDollarSign } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Channel, LeadStatus } from '../domain/types';
import { CHANNEL_LABEL, STATUS_LABEL } from '../domain/labels';
import { Badge } from './kit';
import type { Tone } from './kit';
import { plural } from '../lib/format';

export const STATUS_ICON: Record<LeadStatus, LucideIcon> = {
  new: Inbox, contacted: PhoneCall, trial_booked: CalendarClock, trial_done: CheckCheck, awaiting_payment: Wallet, paid: BadgeCheck, lost: XCircle,
};
export const STATUS_TONE: Record<LeadStatus, Tone> = {
  new: 'accent', contacted: 'info', trial_booked: 'warn', trial_done: 'info', awaiting_payment: 'warn', paid: 'ok', lost: 'neutral',
};
/** цвет полосы колонки на доске */
export const STATUS_BAR: Record<LeadStatus, string> = {
  new: 'var(--c-accent)', contacted: 'var(--c-info)', trial_booked: 'var(--c-warn)', trial_done: 'var(--c-info)', awaiting_payment: 'var(--c-warn)', paid: 'var(--c-ok)', lost: 'var(--c-ink-3)',
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONE[status]} icon={STATUS_ICON[status]}>{STATUS_LABEL[status]}</Badge>;
}

export const CHANNEL_ICON: Record<Channel, LucideIcon> = { whatsapp: MessageCircle, telegram: Send, site: Globe, call: Phone, referral: Users };

export function ChannelTag({ channel, className = '' }: { channel: Channel; className?: string }) {
  const I = CHANNEL_ICON[channel];
  return (
    <span className={'inline-flex items-center gap-1 text-xs text-ink-2 ' + className}>
      <I className="size-3.5" strokeWidth={2} aria-hidden />
      {CHANNEL_LABEL[channel]}
    </span>
  );
}

/** остаток занятий: долг, «заканчивается», норма */
export function BalanceBadge({ left, low, debt, money }: { left: number; low: number; debt?: number; money?: (n: number) => string }) {
  if (left < 0) return <Badge tone="bad" icon={CircleDollarSign} title="Долг">{money && debt ? 'Долг ' + money(debt) : 'Долг ' + plural(-left, 'урок', 'урока', 'уроков')}</Badge>;
  if (left <= low) return <Badge tone="warn" icon={AlertTriangle}>{left === 0 ? 'Уроков не осталось' : 'Осталось ' + plural(left, 'урок', 'урока', 'уроков')}</Badge>;
  return <Badge tone="neutral">{plural(left, 'урок', 'урока', 'уроков')}</Badge>;
}
