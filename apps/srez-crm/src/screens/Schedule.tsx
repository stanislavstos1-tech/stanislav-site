/* Расписание: 36 занятий потока по шести блокам. Ближайшее — подсвечено, прошедшие приглушены. */
import { useState } from 'react';
import { currentCohort, nextCohort, lessonsOf, lessonEnd, nextLesson } from '../data/selectors';
import { useDB } from '../data/store';
import { dateShort, hm, weekdayShort, dayDiff } from '../lib/format';
import { BLOCKS, KIND_LABEL } from '../domain/labels';
import { Badge, Card, Segmented, cx } from '../ui/kit';
import type { Tone } from '../ui/kit';
import { useApp } from '../app/ctx';
import type { LessonKind } from '../domain/types';

const KIND_TONE: Record<LessonKind, Tone> = { lecture: 'neutral', practice: 'info', call: 'warn', defense: 'accent' };

export function Schedule() {
  const db = useDB();
  const { openDrawer } = useApp();
  const cur = currentCohort(db), next = nextCohort(db);
  const [cid, setCid] = useState(cur.id);
  const now = Date.now();
  const list = lessonsOf(db, cid);
  const upcoming = nextLesson(db, cid, now);
  const done = list.filter(l => lessonEnd(l) < now).length;

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-center gap-3">
        {next && <Segmented value={cid} onChange={setCid} ariaLabel="Поток" options={[{ value: cur.id, label: cur.name }, { value: next.id, label: next.name }]} className="max-sm:w-full" />}
        <span className="label text-ink-3">прошло {done} из 36 · вт и чт 19:30, созвоны групп по субботам</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden><div className="h-full rounded-full bg-accent" style={{ width: (done / 36) * 100 + '%' }} /></div>

      <div className="grid gap-4 xl:grid-cols-2">
        {BLOCKS.map((b, bi) => {
          const ls = list.filter(l => l.block === bi + 1);
          const blockDone = ls.every(l => lessonEnd(l) < now), blockNow = ls.some(l => l.id === upcoming?.id) && !blockDone;
          return (
            <Card key={b} pad={false} className={cx('overflow-hidden', blockNow && 'border-accent/40')}>
              <div className="flex items-baseline gap-3 px-4 pt-4 sm:px-5">
                <span className={cx('display text-[26px] font-black leading-none', blockNow ? 'text-accent-ink' : 'text-ink-3')}>{String(bi + 1).padStart(2, '0')}</span>
                <h3 className="display flex-1 text-[13px] font-semibold uppercase">{b}</h3>
                {blockDone && <Badge tone="ok">пройден</Badge>}{blockNow && <Badge tone="accent">идёт</Badge>}
              </div>
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {ls.map(l => {
                  const past = lessonEnd(l) < now, isNext = l.id === upcoming?.id;
                  return (
                    <li key={l.id}>
                      <button type="button" onClick={() => openDrawer({ type: 'lesson', id: l.id })} className={cx('flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 sm:px-5', past && 'opacity-55', isNext && 'bg-accent-soft')}>
                        <span className="label w-8 text-ink-3">{String(l.n).padStart(2, '0')}</span>
                        <span className="w-[86px] shrink-0 leading-tight"><span className="tnum block text-sm font-medium">{dayDiff(l.start) === 0 ? 'Сегодня' : weekdayShort(l.start) + ', ' + dateShort(l.start)}</span><span className="tnum block text-xs text-ink-3">{hm(l.start)}</span></span>
                        <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-sm">{l.title}</span><span className="block truncate text-xs text-ink-3">{l.speaker}</span></span>
                        <Badge tone={KIND_TONE[l.kind]} className="max-sm:hidden">{KIND_LABEL[l.kind]}</Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
