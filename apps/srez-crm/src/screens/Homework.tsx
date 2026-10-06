/* Домашки: очередь проверки для кураторов. Каждый блок программы закрывается работой, не конспектом. */
import { useMemo, useState } from 'react';
import { Check, RotateCcw, FileCheck2, Send } from 'lucide-react';
import type { HomeworkStatus } from '../domain/types';
import { useDB, undo } from '../data/store';
import * as A from '../data/actions';
import { groupOf, isReviewLate, currentCohort, currentBlock } from '../data/selectors';
import { ago, plural, dateShort } from '../lib/format';
import { BLOCKS } from '../domain/labels';
import { Badge, Button, Chip, Empty, Segmented, cx } from '../ui/kit';
import { HwBadge } from '../ui/domain';
import { toast } from '../ui/overlay';
import { useApp, can } from '../app/ctx';

const undoAction = { label: 'Отменить', run: () => { if (undo()) toast('Изменение отменено', { tone: 'info' }); } };

export function HomeworkScreen() {
  const db = useDB();
  const { role, user, openDrawer, openModal } = useApp();
  const review = can.review(role);
  const groups = role === 'curator' ? db.groups.filter(g => g.curatorId === user.curatorId) : db.groups;
  const [tab, setTab] = useState<HomeworkStatus>('submitted');
  const [gid, setGid] = useState('');
  const ids = useMemo(() => new Set((gid ? groups.filter(g => g.id === gid) : groups).flatMap(g => g.studentIds)), [groups, gid]);
  const all = db.homework.filter(h => ids.has(h.studentId));
  const list = all.filter(h => h.status === tab).sort((a, b) => (tab === 'submitted' ? a.submittedAt - b.submittedAt : (b.reviewedAt || 0) - (a.reviewedAt || 0)));
  const n = (s: HomeworkStatus) => all.filter(h => h.status === s).length;
  const cohort = currentCohort(db);
  const block = currentBlock(db, cohort.id);

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={tab} onChange={setTab} ariaLabel="Статус" className="max-sm:w-full" options={[
          { value: 'submitted', label: `На проверке ${n('submitted') || ''}` }, { value: 'returned', label: `На доработке ${n('returned') || ''}` }, { value: 'accepted', label: 'Принятые' },
        ]} />
        <span className="label ml-auto text-ink-3 max-md:hidden">Сейчас идёт блок {block} · {BLOCKS[block - 1]}</span>
      </div>
      {groups.length > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Chip on={!gid} onClick={() => setGid('')}>Все группы</Chip>
          {groups.map(g => <Chip key={g.id} on={gid === g.id} onClick={() => setGid(gid === g.id ? '' : g.id)}>{g.name} · {db.curators.find(c => c.id === g.curatorId)?.name.split(' ')[0]}</Chip>)}
        </div>
      )}

      <div className="overflow-hidden rounded-[22px] border border-line bg-surface">
        {list.length ? (
          <ul className="divide-y divide-line">
            {list.map(h => {
              const st = db.students.find(s => s.id === h.studentId)!; const g = groupOf(db, st.id);
              const late = isReviewLate(h, db.settings.reviewDays);
              return (
                <li key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
                  <span className="display w-9 shrink-0 text-[18px] font-black text-ink-3">{String(h.block).padStart(2, '0')}</span>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDrawer({ type: 'student', id: st.id })}>
                    <div className="truncate font-medium">{st.name}</div>
                    <div className="truncate text-xs text-ink-3">{BLOCKS[h.block - 1]} · {g?.name}</div>
                    {h.comment && h.status === 'returned' && <div className="mt-1 text-xs text-bad">«{h.comment}»</div>}
                  </button>
                  <div className={cx('text-xs', late ? 'font-medium text-bad' : 'text-ink-3')}>{h.status === 'submitted' ? 'сдано ' + ago(h.submittedAt) : 'проверено ' + (h.reviewedAt ? dateShort(h.reviewedAt) : '')}</div>
                  {late && <Badge tone="bad">дольше {plural(db.settings.reviewDays, 'дня', 'дней', 'дней')}</Badge>}
                  {h.status === 'submitted' && review ? (
                    <div className="flex gap-1.5">
                      <Button variant="ok" size="sm" icon={Check} onClick={() => { A.acceptHomework(h.id); toast('Работа принята', { action: undoAction }); }}>Принять</Button>
                      <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => openModal({ type: 'returnHw', homeworkId: h.id })}>На доработку</Button>
                    </div>
                  ) : h.status === 'returned' ? <Button variant="ghost" size="sm" icon={Send} onClick={() => openModal({ type: 'message', to: { kind: 'student', id: st.id }, template: 'homework_returned' })}>Напомнить</Button> : <HwBadge status={h.status} />}
                </li>
              );
            })}
          </ul>
        ) : <Empty icon={FileCheck2} title={tab === 'submitted' ? 'Очередь пуста' : tab === 'returned' ? 'На доработке никого' : 'Пока нет принятых работ'}>{tab === 'submitted' ? `Новые работы появятся здесь. Проверка — в течение ${plural(db.settings.reviewDays, 'дня', 'дней', 'дней')}: старые сверху.` : undefined}</Empty>}
      </div>
      <p className="text-xs text-ink-3">Работы сдают только участники живого потока. Возвращая на доработку, пишите, где слайд врёт и что сделать, — комментарий увидит участник.</p>
    </div>
  );
}
