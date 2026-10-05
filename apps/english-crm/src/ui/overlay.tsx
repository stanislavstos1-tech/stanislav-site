/* Окна поверх экрана: модальное окно (на телефоне — шторка снизу), боковая панель, уведомления. */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, cx } from './kit';

function useEsc(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
}
function useLockScroll() {
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o; }; }, []);
}
/** фокус внутрь окна при открытии и обратно — на элемент, который его открыл */
function useFocusReturn(box: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = box.current;
    if (el && !el.contains(document.activeElement)) {
      const f = el.querySelector<HTMLElement>('[autofocus], input, select, textarea, button:not([data-close])');
      (f || el).focus({ preventScroll: true });
    }
    return () => prev?.focus?.({ preventScroll: true });
  }, [box]);
}

export function Modal({ title, subtitle, onClose, children, footer, width = 520 }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  const box = useRef<HTMLDivElement>(null);
  useEsc(onClose); useLockScroll(); useFocusReturn(box);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <div className="anim-fade absolute inset-0 bg-[rgba(12,12,20,.38)] dark:bg-black/60" onClick={onClose} />
      <div ref={box} role="dialog" aria-modal="true" tabIndex={-1} style={{ maxWidth: width }}
        className="anim-sheet sm:anim-pop relative flex max-h-[92dvh] w-full flex-col rounded-t-[22px] border border-line bg-surface shadow-pop outline-none sm:rounded-[20px]">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-2 sm:hidden" />
        <header className="flex items-start gap-3 px-5 pb-3 pt-4 sm:px-6 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold tracking-[-0.015em]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label="Закрыть" data-close className="-mr-2 -mt-1" />
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6">{children}</div>
        {footer && <footer className="safe-b flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/** боковая панель на компьютере, шторка на телефоне — для карточек заявки, ученика, занятия */
export function Drawer({ title, onClose, children, head, width = 480 }: { title?: ReactNode; onClose: () => void; children: ReactNode; head?: ReactNode; width?: number }) {
  const box = useRef<HTMLDivElement>(null);
  useEsc(onClose); useLockScroll(); useFocusReturn(box);
  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="anim-fade absolute inset-0 bg-[rgba(12,12,20,.28)] dark:bg-black/50" onClick={onClose} />
      <div ref={box} role="dialog" aria-modal="true" tabIndex={-1} style={{ ['--w' as string]: width + 'px' }}
        className="anim-sheet md:anim-side absolute inset-x-0 bottom-0 flex h-[94dvh] flex-col rounded-t-[22px] border border-line bg-surface shadow-pop outline-none md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-[var(--w)] md:max-w-full md:rounded-none md:border-y-0 md:border-r-0">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-2 md:hidden" />
        <header className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5 md:px-5 md:py-3">
          <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-3">{title}</div>
          {head}
          <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label="Закрыть" data-close />
        </header>
        <div className="scroll-thin safe-b min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-4 md:px-6 md:pt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- уведомления ---------- */
interface ToastItem { id: number; text: string; tone: 'ok' | 'info' | 'bad'; action?: { label: string; run: () => void } }
let toasts: ToastItem[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());
let tid = 0;
export function toast(text: string, opts: { tone?: ToastItem['tone']; action?: ToastItem['action']; ms?: number } = {}) {
  const t: ToastItem = { id: ++tid, text, tone: opts.tone || 'ok', action: opts.action };
  toasts = [...toasts.slice(-2), t]; emit();
  setTimeout(() => { toasts = toasts.filter(x => x.id !== t.id); emit(); }, opts.ms ?? (opts.action ? 5500 : 2800));
}
const dismiss = (id: number) => { toasts = toasts.filter(x => x.id !== id); emit(); };

export function Toaster() {
  const list = useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => toasts);
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      {list.map(t => (
        <div key={t.id} className="anim-pop pointer-events-auto flex min-h-11 max-w-[min(520px,100%)] items-center gap-3 rounded-xl bg-[#17171f] py-2 pl-3.5 pr-2 text-sm text-white shadow-pop dark:bg-[#2a2a33]">
          {t.tone === 'bad' ? <AlertCircle className="size-4 shrink-0 text-[#f2837a]" aria-hidden /> : <CheckCircle2 className={cx('size-4 shrink-0', t.tone === 'ok' ? 'text-[#5ccf94]' : 'text-[#b4b4fa]')} aria-hidden />}
          <span className="min-w-0 flex-1">{t.text}</span>
          {t.action && <button type="button" onClick={() => { t.action!.run(); dismiss(t.id); }} className="rounded-lg px-2.5 py-1.5 font-semibold text-[#b4b4fa] hover:bg-white/10">{t.action.label}</button>}
        </div>
      ))}
    </div>,
    document.body,
  );
}
