/* Воронка заявок: канбан по статусам. Перетаскивание мышью или долгим нажатием на телефоне. */
import { useMemo, useRef, useState, useEffect } from 'react';
import { Send, Phone, CalendarClock, AlertTriangle, XCircle, Eye, EyeOff, Plus } from 'lucide-react';
import type { Channel, ID, Lead, LeadStatus } from '../domain/types';
import { FUNNEL, STATUS_LABEL, CHANNEL_LABEL, LOST_LABEL } from '../domain/labels';
import { useDB } from '../data/store';
import { boardLeads, isOverdue, teacherById } from '../data/selectors';
import { ago, elapsed, hm, dayDiff, dateShort, plural } from '../lib/format';
import { digits } from '../lib/phone';
import { Badge, Button, Chip, cx } from '../ui/kit';
import { ChannelTag, STATUS_ICON, STATUS_BAR, CHANNEL_ICON } from '../ui/domain';
import { useApp } from '../app/ctx';
import { useMoveLead } from '../app/drawers';

export function Leads() {
  const db = useDB();
  const { openDrawer, openModal } = useApp();
  const move = useMoveLead();
  const [ch, setCh] = useState<Channel | ''>('');
  const [showLost, setShowLost] = useState(false);
  const now = Date.now();
  const all = useMemo(() => boardLeads(db, now), [db, now]);
  const leads = useMemo(() => all.filter(l => !ch || l.channel === ch), [all, ch]);
  const cols: LeadStatus[] = showLost ? [...FUNNEL, 'lost'] : FUNNEL;
  const channels = (Object.keys(CHANNEL_LABEL) as Channel[]).filter(c => db.settings.channels[c] || all.some(l => l.channel === c));
  const byCol = useMemo(() => {
    const m = new Map<LeadStatus, Lead[]>(); cols.forEach(c => m.set(c, []));
    // в колонке сначала горящие, затем самые свежие изменения
    leads.forEach(l => m.get(l.status)?.push(l));
    m.forEach(list => list.sort((a, b) => Number(isOverdue(b, db.settings.slaHours, now)) - Number(isOverdue(a, db.settings.slaHours, now)) || b.statusAt - a.statusAt));
    return m;
  }, [leads, cols.join(), db.settings.slaHours, now]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- перетаскивание ---------- */
  const board = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState<string | null>(null);
  const [dragId, setDragId] = useState<ID | null>(null);
  const drag = useRef<{ id: ID; ghost: HTMLElement; dx: number; dy: number; cols: { st: string; l: number; r: number }[]; sl: number; over: string | null; x: number; y: number; raf: number } | null>(null);
  const justDragged = useRef(false);

  const hit = (x: number, y: number) => {
    const d = drag.current!; if (y > innerHeight - 88) return 'lost-zone';
    const dx = (board.current?.scrollLeft || 0) - d.sl;
    return d.cols.find(c => x >= c.l - dx && x <= c.r - dx)?.st || null;
  };
  const startDrag = (el: HTMLElement, id: ID, x: number, y: number) => {
    const r = el.getBoundingClientRect();
    const ghost = el.cloneNode(true) as HTMLElement;
    Object.assign(ghost.style, { position: 'fixed', left: '0', top: '0', width: r.width + 'px', zIndex: '80', pointerEvents: 'none', willChange: 'transform', boxShadow: 'var(--shadow-pop)', transform: `translate3d(${r.left}px,${r.top}px,0) rotate(1.5deg)` });
    document.body.appendChild(ghost);
    const cols = [...(board.current?.querySelectorAll<HTMLElement>('[data-col]') || [])].map(c => { const b = c.getBoundingClientRect(); return { st: c.dataset.col!, l: b.left, r: b.right }; });
    drag.current = { id, ghost, dx: x - r.left, dy: y - r.top, cols, sl: board.current?.scrollLeft || 0, over: null, x, y, raf: 0 };
    setDragId(id); document.body.classList.add('select-none');
    navigator.vibrate?.(10);
    const loop = () => { // автопрокрутка доски у краёв
      const d = drag.current; if (!d) return;
      if (board.current) { if (d.x < 60) board.current.scrollLeft -= 12; else if (d.x > innerWidth - 60) board.current.scrollLeft += 12; }
      d.raf = requestAnimationFrame(loop);
    };
    drag.current.raf = requestAnimationFrame(loop);
  };
  const moveDrag = (x: number, y: number) => {
    const d = drag.current; if (!d) return;
    d.x = x; d.y = y;
    d.ghost.style.transform = `translate3d(${x - d.dx}px,${y - d.dy}px,0) rotate(1.5deg)`;
    const o = hit(x, y); if (o !== d.over) { d.over = o; setOver(o); }
  };
  const endDrag = (drop: boolean) => {
    const d = drag.current; if (!d) return;
    cancelAnimationFrame(d.raf); d.ghost.remove(); drag.current = null; setDragId(null); setOver(null); document.body.classList.remove('select-none');
    justDragged.current = true; setTimeout(() => (justDragged.current = false), 80);
    if (drop && d.over) move(d.id, (d.over === 'lost-zone' ? 'lost' : d.over) as LeadStatus);
  };
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && endDrag(false); addEventListener('keydown', k); return () => removeEventListener('keydown', k); });

  const onPointerDown = (e: React.PointerEvent, id: ID) => {
    if ((e.target as HTMLElement).closest('a,button[data-act]')) return;
    const el = e.currentTarget as HTMLElement, sx = e.clientX, sy = e.clientY;
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      const mv = (ev: PointerEvent) => { if (!drag.current && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) startDrag(el, id, ev.clientX, ev.clientY); if (drag.current) { ev.preventDefault(); moveDrag(ev.clientX, ev.clientY); } };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); endDrag(true); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    } else {
      // палец: долгое нажатие, чтобы не мешать прокрутке
      let timer = window.setTimeout(() => { startDrag(el, id, sx, sy); timer = 0; }, 350);
      const tm = (ev: TouchEvent) => { const t = ev.touches[0]; if (drag.current) { ev.preventDefault(); moveDrag(t.clientX, t.clientY); } else if (timer && Math.hypot(t.clientX - sx, t.clientY - sy) > 10) { clearTimeout(timer); timer = 0; } };
      const te = () => { clearTimeout(timer); removeEventListener('touchmove', tm); removeEventListener('touchend', te); removeEventListener('touchcancel', te); endDrag(true); };
      addEventListener('touchmove', tm, { passive: false }); addEventListener('touchend', te); addEventListener('touchcancel', te);
    }
  };

  const overdueN = all.filter(l => isOverdue(l, db.settings.slaHours, now)).length;
  const open = all.filter(l => l.status !== 'paid' && l.status !== 'lost').length;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Chip on={!ch} onClick={() => setCh('')} count={all.length}>Все каналы</Chip>
          {channels.map(c => <Chip key={c} on={ch === c} onClick={() => setCh(ch === c ? '' : c)} icon={CHANNEL_ICON[c]} count={all.filter(l => l.channel === c).length}>{CHANNEL_LABEL[c]}</Chip>)}
        </div>
        <div className="ml-auto flex items-center gap-2 max-md:w-full">
          <span className="text-[13px] text-ink-2 max-md:mr-auto">{plural(open, 'заявка', 'заявки', 'заявок')} в работе{overdueN ? <> · <span className="font-medium text-bad">{overdueN} без ответа</span></> : null}</span>
          <Button variant="ghost" size="sm" icon={showLost ? EyeOff : Eye} onClick={() => setShowLost(v => !v)}>{showLost ? 'Скрыть отказы' : 'Отказы'}</Button>
        </div>
      </div>

      <div ref={board} className="scroll-thin -mx-4 grid snap-x snap-mandatory auto-cols-[86%] grid-flow-col gap-3 overflow-x-auto px-4 pb-3 sm:auto-cols-[280px] md:mx-0 md:snap-none md:px-0 xl:auto-cols-[minmax(232px,1fr)]" style={dragId ? { scrollSnapType: 'none' } : undefined}>
        {cols.map(st => {
          const list = byCol.get(st) || [];
          const I = STATUS_ICON[st];
          return (
            <div key={st} data-col={st} className={cx('flex min-h-[60vh] snap-start flex-col rounded-2xl bg-surface-2/70 p-2 transition-[background,box-shadow] duration-150', over === st && 'bg-accent-soft shadow-[inset_0_0_0_2px_var(--c-accent)]')}>
              <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
                <span className="h-4 w-1 rounded-full" style={{ background: STATUS_BAR[st] }} aria-hidden />
                <I className="size-4 text-ink-2" aria-hidden />
                <h3 className="truncate text-[13px] font-semibold">{STATUS_LABEL[st]}</h3>
                <span className="tnum ml-auto text-[13px] text-ink-3">{list.length}</span>
                {st === 'new' && <button type="button" onClick={() => openModal({ type: 'newLead' })} className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-surface hover:text-ink" aria-label="Новая заявка"><Plus className="size-4" /></button>}
              </div>
              <div className="flex flex-col gap-2">
                {list.map(l => (
                  <LeadCard key={l.id} l={l} dragging={dragId === l.id} onPointerDown={e => onPointerDown(e, l.id)}
                    onOpen={() => { if (!justDragged.current) openDrawer({ type: 'lead', id: l.id }); }}
                    onWrite={() => openModal({ type: 'message', to: { kind: 'lead', id: l.id } })} />
                ))}
                {!list.length && <div className="rounded-xl border border-dashed border-line-2 px-3 py-6 text-center text-xs text-ink-3">{st === 'paid' ? 'Оплаты за 30 дней появятся здесь' : 'Перетащите сюда'}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-ink-3 max-md:hidden">Перетащите карточку, чтобы сменить этап. «Оплатил» и «Отказ» показывают последние 30 дней — вся история есть в отчётах.</p>

      {/* зона «Отказ» появляется во время переноса */}
      <div className={cx('pointer-events-none fixed inset-x-0 bottom-0 z-[75] flex justify-center px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-6 transition-[opacity,transform] duration-150', dragId ? 'opacity-100' : 'translate-y-4 opacity-0')}>
        <div className={cx('flex h-14 w-full max-w-md items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-surface text-sm font-semibold shadow-pop', over === 'lost-zone' ? 'border-bad bg-bad-soft text-bad' : 'border-line-2 text-ink-2')}>
          <XCircle className="size-4" aria-hidden />Отпустите здесь, чтобы закрыть с отказом
        </div>
      </div>
    </div>
  );
}

function LeadCard({ l, dragging, onPointerDown, onOpen, onWrite }: { l: Lead; dragging: boolean; onPointerDown: (e: React.PointerEvent) => void; onOpen: () => void; onWrite: () => void }) {
  const db = useDB();
  const s = db.settings;
  const over = isOverdue(l, s.slaHours);
  const trial = l.trialLessonId ? db.lessons.find(x => x.id === l.trialLessonId) : undefined;
  const t = trial ? teacherById(db, trial.teacherId) : undefined;
  const trialToday = trial && trial.status === 'planned' && dayDiff(trial.start) === 0;
  return (
    <div role="button" tabIndex={0} onPointerDown={onPointerDown} onClick={onOpen} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())} onContextMenu={e => e.preventDefault()}
      aria-label={`${l.name}, ${STATUS_LABEL[l.status]}`}
      className={cx('group cursor-grab touch-pan-x touch-pan-y select-none rounded-xl border bg-surface p-3 shadow-card transition-[border-color,opacity] duration-150 [-webkit-touch-callout:none] hover:border-line-2 active:cursor-grabbing',
        over ? 'border-bad/40' : 'border-line', dragging && 'opacity-40')}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">{l.name}</div>
        {over ? <Badge tone="bad" icon={AlertTriangle} title="Ждёт ответа">{elapsed(l.createdAt)}</Badge> : <span className="shrink-0 text-xs text-ink-3">{ago(l.statusAt)}</span>}
      </div>
      <div className="mt-1 flex items-center gap-2"><ChannelTag channel={l.channel} /><span className="truncate text-xs text-ink-3">{l.source}</span></div>
      {l.status === 'lost' && l.lostReason ? <p className="mt-2 text-[13px] text-ink-2">{LOST_LABEL[l.lostReason]}</p> : l.comment && <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-ink-2">{l.comment}</p>}
      {trial && l.status !== 'paid' && l.status !== 'lost' && (
        <div className={cx('mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium', trialToday ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-ink-2')}>
          <CalendarClock className="size-3.5" aria-hidden />Пробный {trialToday ? 'сегодня, ' + hm(trial.start) : dateShort(trial.start) + ', ' + hm(trial.start)}
          {t && <span className="size-2 rounded-full" style={{ background: t.color }} title={t.name} />}
        </div>
      )}
      {l.status !== 'paid' && l.status !== 'lost' && (
        <div className="mt-2.5 flex items-center gap-1 border-t border-line pt-2">
          <button type="button" data-act onClick={e => { e.stopPropagation(); onWrite(); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-accent-ink hover:bg-accent-soft"><Send className="size-3.5" aria-hidden />Написать</button>
          <a href={'tel:+' + digits(l.phone)} onClick={e => e.stopPropagation()} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-ink-2 hover:bg-surface-2" aria-label={'Позвонить ' + l.phone}><Phone className="size-3.5" aria-hidden />Позвонить</a>
        </div>
      )}
    </div>
  );
}
