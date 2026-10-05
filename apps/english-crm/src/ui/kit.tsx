/* Единая система компонентов: кнопки, бейджи, карточки, поля, сегменты, пустые состояния. */
import { forwardRef, useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { initials } from '../lib/format';
import { maskTyping } from '../lib/phone';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

/* ---------- кнопки ---------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'ok';
type BtnSize = 'sm' | 'md' | 'lg';
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  block?: boolean;
}
const V: Record<BtnVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover shadow-[0_1px_2px_rgba(60,60,180,.25)] dark:text-[#101018]',
  secondary: 'bg-surface text-ink border border-line-2 hover:border-ink-3 shadow-card',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  soft: 'bg-accent-soft text-accent-ink hover:brightness-[.97] dark:hover:brightness-125',
  danger: 'bg-bad-soft text-bad hover:brightness-[.97] dark:hover:brightness-125',
  ok: 'bg-ok-soft text-ok hover:brightness-[.97] dark:hover:brightness-125',
};
const S: Record<BtnSize, string> = { sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-[10px]', md: 'h-10 px-4 text-sm gap-2 rounded-xl', lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl' };
const IS: Record<BtnSize, string> = { sm: 'size-3.5 shrink-0', md: 'size-4 shrink-0', lg: 'size-[18px] shrink-0' };
/** квадратные кнопки-иконки: свои размеры без горизонтальных отступов */
const IO: Record<BtnSize, string> = { sm: 'size-8 rounded-[10px]', md: 'size-10 rounded-xl', lg: 'size-12 rounded-xl' };

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'secondary', size = 'md', icon: I, iconRight: IR, block, className, children, type = 'button', ...rest }, ref) {
  const iconOnly = !children;
  return (
    <button ref={ref} type={type} className={cx('inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-[background,border-color,filter,color] duration-150 active:scale-[.98] disabled:pointer-events-none disabled:opacity-45', V[variant], iconOnly ? IO[size] : S[size], block && 'w-full', className)} {...rest}>
      {I && <I className={IS[size]} strokeWidth={2} aria-hidden />}
      {children}
      {IR && <IR className={cx(IS[size], 'opacity-60')} strokeWidth={2} aria-hidden />}
    </button>
  );
});

/** ссылка в виде кнопки (позвонить, написать) */
export function LinkButton({ href, variant = 'secondary', size = 'md', icon: I, children, className, onClick, title }: { href: string; variant?: BtnVariant; size?: BtnSize; icon?: LucideIcon; children?: ReactNode; className?: string; onClick?: () => void; title?: string }) {
  const ext = href.startsWith('http');
  return (
    <a href={href} target={ext ? '_blank' : undefined} rel={ext ? 'noopener noreferrer' : undefined} onClick={onClick} title={title} aria-label={title}
      className={cx('inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-[background,border-color,filter] duration-150 active:scale-[.98]', V[variant], children ? S[size] : IO[size], className)}>
      {I && <I className={IS[size]} strokeWidth={2} aria-hidden />}
      {children}
    </a>
  );
}

/* ---------- бейджи: цвет + иконка/текст, не только цвет ---------- */
export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'info';
const T: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  accent: 'bg-accent-soft text-accent-ink',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-info-soft text-info',
};
export function Badge({ tone = 'neutral', icon: I, children, className, title }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx('inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-[7px] px-2 text-xs font-medium tnum', T[tone], className)}>
      {I && <I className="size-3.5" strokeWidth={2.2} aria-hidden />}
      {children}
    </span>
  );
}

/* ---------- карточки ---------- */
export function Card({ children, className, pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <section className={cx('rounded-[16px] border border-line bg-surface shadow-card', pad && 'p-4 sm:p-5', className)}>{children}</section>;
}
export function CardTitle({ icon: I, children, count, tone = 'neutral', action }: { icon?: LucideIcon; children: ReactNode; count?: number; tone?: Tone; action?: ReactNode }) {
  return (
    <div className="mb-3 flex min-h-8 items-center gap-2.5">
      {I && <span className={cx('grid size-8 place-items-center rounded-[10px]', T[tone])}><I className="size-4" strokeWidth={2} aria-hidden /></span>}
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{children}</h2>
      {count !== undefined && <span className="tnum text-sm text-ink-3">{count}</span>}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

/* ---------- поля ---------- */
export function Field({ label, hint, error, children, className }: { label?: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('grid gap-1.5', className)}>
      {label && <span className="text-[13px] font-medium text-ink-2">{label}</span>}
      {children}
      {error ? <span className="text-xs text-bad">{error}</span> : hint ? <span className="text-xs text-ink-3">{hint}</span> : null}
    </label>
  );
}
const inputCls = 'h-11 w-full rounded-xl border border-line-2 bg-surface px-3.5 text-[15px] text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-3 focus:border-accent focus:shadow-[0_0_0_3px_var(--c-accent-soft)] sm:h-10 sm:text-sm';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...p }, ref) {
  return <input ref={ref} className={cx(inputCls, invalid && 'border-bad', className)} {...p} />;
});
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputCls, 'h-auto min-h-[88px] resize-y py-2.5 leading-relaxed', className)} {...p} />;
}
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputCls, 'appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238b8b96' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>
      {children}
    </select>
  );
}

/** телефон по маске +7 (XXX) XXX-XX-XX: подставляет «+7 (» и расставляет скобки и дефисы сам */
export function PhoneInput({ value, onChange, invalid, autoFocus, id }: { value: string; onChange: (v: string) => void; invalid?: boolean; autoFocus?: boolean; id?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const toEnd = () => requestAnimationFrame(() => { const el = ref.current; if (el) el.setSelectionRange(el.value.length, el.value.length); });
  return (
    <Input ref={ref} id={id} type="tel" inputMode="tel" autoComplete="off" placeholder="+7 (___) ___-__-__" value={value} invalid={invalid} autoFocus={autoFocus}
      onFocus={() => { if (!value) { onChange('+7 ('); toEnd(); } }}
      onBlur={() => { if (value.replace(/\D/g, '').length <= 1) onChange(''); }}
      onChange={e => { const atEnd = e.target.selectionStart === e.target.value.length; const v = maskTyping(value, e.target.value); onChange(v); if (atEnd || value.replace(/\D/g, '').length <= 1) toEnd(); }}
      className="tnum" />
  );
}

/* ---------- сегментированный переключатель ---------- */
export function Segmented<T extends string>({ value, onChange, options, size = 'md', className, ariaLabel }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: LucideIcon }[]; size?: 'sm' | 'md'; className?: string; ariaLabel?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx('no-scrollbar inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-surface-2 p-[3px]', className)}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={cx('inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] font-medium transition-[background,color,box-shadow] duration-150', size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-9 px-3 text-sm',
              on ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(16,16,24,.08),0_0_0_1px_var(--c-line)]' : 'text-ink-2 hover:text-ink')}>
            {o.icon && <o.icon className="size-4" strokeWidth={2} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- чипы-фильтры ---------- */
export function Chip({ on, onClick, children, count, icon: I }: { on?: boolean; onClick?: () => void; children: ReactNode; count?: number; icon?: LucideIcon }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!on}
      className={cx('inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-[background,border-color,color] duration-150',
        on ? 'border-ink bg-ink text-canvas' : 'border-line-2 bg-surface text-ink-2 hover:border-ink-3 hover:text-ink')}>
      {I && <I className="size-3.5" strokeWidth={2} aria-hidden />}
      {children}
      {count !== undefined && <span className={cx('tnum', on ? 'opacity-70' : 'text-ink-3')}>{count}</span>}
    </button>
  );
}

/* ---------- аватар с инициалами ---------- */
export function Avatar({ name, color, size = 32, className }: { name: string; color?: string; size?: number; className?: string }) {
  return (
    <span className={cx('inline-grid shrink-0 place-items-center rounded-full font-semibold text-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.36, background: color || 'var(--c-surface-3)', color: color ? '#fff' : 'var(--c-ink-2)' }} aria-hidden>
      {initials(name)}
    </span>
  );
}

/* ---------- пустое состояние ---------- */
export function Empty({ icon: I, title, children, action, compact }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cx('flex flex-col items-center text-center', compact ? 'px-4 py-6' : 'px-6 py-12')}>
      {I && <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-surface-2 text-ink-3"><I className="size-5" strokeWidth={1.8} aria-hidden /></span>}
      <p className="font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-sm text-[13px] text-ink-2">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- раскрывающееся меню ---------- */
export function Menu({ trigger, items, align = 'right' }: { trigger: (p: { onClick: () => void; 'aria-expanded': boolean }) => ReactNode; items: ({ label: string; icon?: LucideIcon; onClick: () => void; danger?: boolean } | null)[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <div ref={box} className="relative">
      {trigger({ onClick: () => setOpen(o => !o), 'aria-expanded': open })}
      {open && (
        <div role="menu" className={cx('anim-pop absolute top-full z-50 mt-1.5 min-w-[220px] rounded-xl border border-line bg-surface p-1 shadow-pop', align === 'right' ? 'right-0' : 'left-0')}>
          {items.filter(Boolean).map((it, i) => it && (
            <button key={i} role="menuitem" type="button" onClick={() => { setOpen(false); it.onClick(); }}
              className={cx('flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm hover:bg-surface-2', it.danger ? 'text-bad' : 'text-ink')}>
              {it.icon && <it.icon className="size-4 opacity-70" strokeWidth={2} aria-hidden />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** число крупно с подписью — для отчётов и сводок */
export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-ink-2">{label}</div>
      <div className={cx('mt-1 text-[28px] font-semibold leading-none tracking-[-0.03em] tnum sm:text-[32px]', tone === 'bad' && 'text-bad', tone === 'ok' && 'text-ok')}>{value}</div>
      {sub && <div className="mt-1.5 text-[13px] text-ink-3">{sub}</div>}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">{children}</div>;
}
