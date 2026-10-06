/* Поток: группы по 4–5 человек с куратором, участники на записях и те, кому ещё не назначили группу. */
import { useState } from 'react';
import { Users, PlayCircle, UserPlus } from 'lucide-react';
import type { Student } from '../domain/types';
import { useDB } from '../data/store';
import { currentCohort, nextCohort, moneyOf, homeworkOf, groupOf, curatorById, currentBlock } from '../data/selectors';
import { dateShort, plural } from '../lib/format';
import { TRACK_LABEL, BLOCKS } from '../domain/labels';
import { Avatar, Card, CardTitle, Empty, Segmented, Stat, cx } from '../ui/kit';
import { PayBadge, BlocksBar } from '../ui/domain';
import { useApp } from '../app/ctx';

export function Cohort() {
  const db = useDB();
  const { role, user, openDrawer } = useApp();
  const cur = currentCohort(db), next = nextCohort(db);
  const [cid, setCid] = useState(cur.id);
  const c = db.cohorts.find(x => x.id === cid)!;
  const running = c.id === cur.id;
  const people = db.students.filter(s => s.cohortId === cid);
  const active = people.filter(s => s.status !== 'left');
  const live = active.filter(s => s.tariff === 'live');
  const groups = db.groups.filter(g => g.studentIds.some(id => people.some(p => p.id === id)) && (role !== 'curator' || g.curatorId === user.curatorId));
  const noGroup = live.filter(s => !groupOf(db, s.id));
  const self = active.filter(s => s.tariff === 'self');
  const left = people.filter(s => s.status === 'left');
  const block = currentBlock(db, cid);

  const Row = ({ s }: { s: Student }) => {
    const hw = homeworkOf(db, s.id);
    return (
      <li>
        <button type="button" onClick={() => openDrawer({ type: 'student', id: s.id })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 sm:px-5">
          <Avatar name={s.name} size={32} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-medium">{s.name}{s.status === 'paused' && <span className="ml-1.5 text-xs font-normal text-warn">пауза</span>}</span>
            <span className="block truncate text-xs text-ink-3">{s.position} · {s.company}</span>
          </span>
          {s.tariff === 'live' && running && <span className="max-sm:hidden"><BlocksBar marks={BLOCKS.map((_, i) => hw.find(h => h.block === i + 1)?.status)} /></span>}
          {role !== 'curator' && <PayBadge m={moneyOf(db, s.id)} />}
        </button>
      </li>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-center gap-3">
        {next && <Segmented value={cid} onChange={setCid} ariaLabel="Поток" options={[{ value: cur.id, label: cur.name + ' · идёт' }, { value: next.id, label: next.name + ' · набор' }]} className="max-sm:w-full" />}
        <span className="label text-ink-3">{dateShort(c.start)} — {dateShort(c.end)} · 36 занятий</span>
      </div>

      {role !== 'curator' && (
        <Card>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
            <Stat label="Участников" value={active.length} sub={`живой ${live.length} · записи ${self.length}`} />
            <Stat label="Мест в живом" value={`${live.length}/${c.seats}`} sub={live.length >= c.seats ? 'набор закрыт' : plural(c.seats - live.length, 'место осталось', 'места осталось', 'мест осталось')} tone={live.length >= c.seats ? 'ok' : undefined} />
            <Stat label="Групп" value={groups.length} sub={noGroup.length ? `${noGroup.length} без группы` : 'все распределены'} />
            <Stat label={running ? 'Сейчас блок' : 'Старт'} value={running ? `${block}/6` : dateShort(c.start)} sub={running ? BLOCKS[block - 1] : 'группы соберём за неделю до старта'} />
          </div>
        </Card>
      )}

      {groups.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-2">
          {groups.map(g => {
            const k = curatorById(db, g.curatorId)!;
            const list = g.studentIds.map(id => db.students.find(s => s.id === id)!).filter(Boolean);
            return (
              <Card key={g.id} pad={false} className="overflow-hidden">
                <div className="flex items-center gap-3 px-4 pt-4 sm:px-5">
                  <Avatar name={k.name} color={k.color} size={36} />
                  <div className="min-w-0 flex-1 leading-tight"><div className="display text-[13px] font-semibold uppercase">{g.name}</div><div className="text-xs text-ink-3">{k.name} · {k.role}</div></div>
                  <span className="label text-ink-3">{list.length}/5</span>
                </div>
                <ul className="mt-3 divide-y divide-line border-t border-line">{list.map(s => <Row key={s.id} s={s} />)}</ul>
              </Card>
            );
          })}
        </div>
      )}

      {role !== 'curator' && noGroup.length > 0 && (
        <Card pad={false} className="overflow-hidden">
          <div className="px-4 pt-4 sm:px-5"><CardTitle icon={UserPlus} tone="warn" count={noGroup.length}>Живой поток · без группы</CardTitle></div>
          <ul className="divide-y divide-line border-t border-line">{noGroup.map(s => <Row key={s.id} s={s} />)}</ul>
        </Card>
      )}

      {role !== 'curator' && self.length > 0 && (
        <Card pad={false} className="overflow-hidden">
          <div className="px-4 pt-4 sm:px-5"><CardTitle icon={PlayCircle} count={self.length}>Записи · самостоятельно</CardTitle></div>
          <ul className="divide-y divide-line border-t border-line">{self.map(s => <Row key={s.id} s={s} />)}</ul>
        </Card>
      )}

      {!groups.length && !noGroup.length && !self.length && <Empty icon={Users} title="В потоке пока никого">Участники появятся после первой оплаты.</Empty>}

      {role !== 'curator' && left.length > 0 && (
        <p className="text-[13px] text-ink-3">Ушли с курса: {left.map((s, i) => <button key={s.id} type="button" className={cx('underline underline-offset-2 hover:text-ink')} onClick={() => openDrawer({ type: 'student', id: s.id })}>{s.name}{i < left.length - 1 ? ', ' : ''}</button>)} · {left.map(s => s.leftReason).filter(Boolean).join(', ')}</p>
      )}
      {running && role !== 'curator' && <p className="text-xs text-ink-3">Полоски — шесть блоков программы: зелёный принят, жёлтый на проверке, красный на доработке. Практика: {TRACK_LABEL.brief.toLowerCase()} или {TRACK_LABEL.own.toLowerCase()}.</p>}
    </div>
  );
}
