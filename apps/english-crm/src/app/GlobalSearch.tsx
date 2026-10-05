/* Глобальный поиск по ученикам и заявкам: имя или часть телефона. «/» или Ctrl+K — в поиск. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, GraduationCap, Inbox, CornerDownLeft } from 'lucide-react';
import { useDB } from '../data/store';
import { useApp } from './ctx';
import { digits } from '../lib/phone';
import { contactPhone } from '../data/selectors';
import { STATUS_LABEL } from '../domain/labels';
import { cx } from '../ui/kit';
import { createPortal } from 'react-dom';

interface Hit { kind: 'student' | 'lead'; id: string; title: string; sub: string }

export function GlobalSearch() {
  const db = useDB();
  const { role, user, openDrawer } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false); // список результатов
  const [mob, setMob] = useState(false); // поиск на весь экран (телефон)
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const mobInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement)?.tagName);
      if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        if (matchMedia('(min-width: 768px)').matches) input.current?.focus(); else setMob(true);
      }
    };
    addEventListener('keydown', h); return () => removeEventListener('keydown', h);
  }, []);
  useEffect(() => { if (mob) setTimeout(() => mobInput.current?.focus(), 50); }, [mob]);

  // преподаватель ищет только своих учеников
  const mine = useMemo(() => {
    if (role !== 'teacher') return null;
    const ids = new Set<string>();
    db.groups.filter(g => g.teacherId === user.teacherId).forEach(g => g.studentIds.forEach(i => ids.add(i)));
    db.lessons.filter(l => l.kind === 'individual' && l.teacherId === user.teacherId && l.studentId).forEach(l => ids.add(l.studentId!));
    return ids;
  }, [db, role, user.teacherId]);

  const hits = useMemo<Hit[]>(() => {
    const s = q.trim().toLowerCase(); if (s.length < 2) return [];
    const d = digits(s);
    const m = (name: string, phone: string) => name.toLowerCase().includes(s) || (d.length >= 3 && digits(phone).includes(d));
    const out: Hit[] = [];
    for (const st of db.students) {
      if (mine && !mine.has(st.id)) continue;
      const ph = contactPhone(db, st);
      if (m(st.name, ph) || (d.length >= 3 && digits(st.phone).includes(d))) out.push({ kind: 'student', id: st.id, title: st.name, sub: (st.status === 'left' ? 'Ушёл · ' : 'Ученик · ') + ph });
    }
    if (role !== 'teacher') for (const l of db.leads) {
      if (l.studentId) continue; // оплатившие уже есть среди учеников
      if (m(l.name, l.phone)) out.push({ kind: 'lead', id: l.id, title: l.name, sub: STATUS_LABEL[l.status] + ' · ' + l.phone });
    }
    return out.slice(0, 8);
  }, [q, db, mine, role]);

  useEffect(() => setSel(0), [q]);
  const pickHit = (h: Hit) => { openDrawer({ type: h.kind, id: h.id }); setQ(''); setOpen(false); setMob(false); input.current?.blur(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(i => Math.min(i + 1, hits.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && hits[sel]) pickHit(hits[sel]);
    if (e.key === 'Escape') { setQ(''); (e.target as HTMLInputElement).blur(); setMob(false); }
  };

  const results = (
    q.trim().length >= 2 && (
      <div className="p-1">
        {hits.length === 0 ? (
          <div className="px-3 py-6 text-center text-[13px] text-ink-2">Никого не нашли. Проверьте имя или наберите последние цифры телефона.</div>
        ) : hits.map((h, i) => (
          <button key={h.kind + h.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => pickHit(h)} onMouseEnter={() => setSel(i)}
            className={cx('flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 text-left', i === sel ? 'bg-surface-2' : '')}>
            <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg', h.kind === 'student' ? 'bg-ok-soft text-ok' : 'bg-accent-soft text-accent-ink')}>
              {h.kind === 'student' ? <GraduationCap className="size-4" aria-hidden /> : <Inbox className="size-4" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-sm font-medium">{h.title}</span><span className="tnum block truncate text-xs text-ink-3">{h.sub}</span></span>
            {i === sel && <CornerDownLeft className="size-3.5 text-ink-3 max-md:hidden" aria-hidden />}
          </button>
        ))}
      </div>
    )
  );

  return (
    <>
      {/* компьютер */}
      <div className="relative max-md:hidden">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <input ref={input} value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={onKey}
          placeholder="Поиск: имя или телефон" aria-label="Поиск по ученикам и заявкам" autoComplete="off"
          className="h-10 w-[300px] rounded-xl border border-line-2 bg-surface pl-9 pr-10 text-sm outline-none transition-[border-color,box-shadow,width] duration-150 placeholder:text-ink-3 focus:w-[360px] focus:border-accent focus:shadow-[0_0_0_3px_var(--c-accent-soft)] lg:w-[340px] lg:focus:w-[400px]" />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-line-2 px-1.5 text-[11px] text-ink-3">/</kbd>
        {open && results && <div className="anim-pop absolute right-0 top-full z-50 mt-1.5 w-[400px] rounded-xl border border-line bg-surface shadow-pop">{results}</div>}
      </div>
      {/* телефон */}
      <button type="button" onClick={() => setMob(true)} className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-2 md:hidden" aria-label="Поиск"><Search className="size-5" aria-hidden /></button>
      {mob && createPortal(
        <div className="anim-fade fixed inset-0 z-[80] flex flex-col bg-canvas md:hidden">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input ref={mobInput} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder="Имя или телефон" aria-label="Поиск" autoComplete="off" enterKeyHint="search"
                className="h-11 w-full rounded-xl border border-line-2 bg-surface pl-9 pr-3 text-base outline-none focus:border-accent" />
            </div>
            <button type="button" onClick={() => { setMob(false); setQ(''); }} className="grid size-11 place-items-center rounded-xl text-ink-2" aria-label="Закрыть поиск"><X className="size-5" aria-hidden /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{results || <p className="px-6 py-10 text-center text-[13px] text-ink-3">Найдём ученика или заявку по имени или последним цифрам телефона</p>}</div>
        </div>,
        document.body,
      )}
    </>
  );
}
