/* Ученики и группы. Фильтры — чипами, поиск — по имени и телефону. Преподаватель видит только своих. */
import { useMemo, useState } from 'react';
import { Search, Users, GraduationCap, Wallet, CalendarClock } from 'lucide-react';
import type { StudentStatus } from '../domain/types';
import { STUDENT_STATUS_LABEL, WEEKDAYS } from '../domain/labels';
import { useDB } from '../data/store';
import { balanceMap, contactPhone, isIndividualStudent, payerOf, studentGroups, teacherById } from '../data/selectors';
import { dateShort, plural, initials, when } from '../lib/format';
import { digits } from '../lib/phone';
import { Badge, Button, Chip, Empty, Input, Segmented, cx, Select } from '../ui/kit';
import { BalanceBadge } from '../ui/domain';
import { useApp, can } from '../app/ctx';

type Filter = 'all' | 'low' | 'debt' | StudentStatus;

export function Students() {
  const { role } = useApp();
  const [tab, setTab] = useState<'students' | 'groups'>('students');
  return (
    <div className="grid grid-cols-1 gap-4">
      <Segmented value={tab} onChange={setTab} options={[{ value: 'students', label: role === 'teacher' ? 'Мои ученики' : 'Ученики', icon: GraduationCap }, { value: 'groups', label: role === 'teacher' ? 'Мои группы' : 'Группы', icon: Users }]} className="self-start max-sm:w-full" />
      {tab === 'students' ? <StudentList /> : <GroupList />}
    </div>
  );
}

function useMine() {
  const db = useDB();
  const { role, user } = useApp();
  return useMemo(() => {
    if (role !== 'teacher') return null;
    const ids = new Set<string>();
    db.groups.filter(g => g.teacherId === user.teacherId).forEach(g => g.studentIds.forEach(i => ids.add(i)));
    db.lessons.filter(l => l.kind === 'individual' && l.teacherId === user.teacherId && l.studentId).forEach(l => ids.add(l.studentId!));
    return ids;
  }, [db, role, user.teacherId]);
}

function StudentList() {
  const db = useDB();
  const { openDrawer, openModal, fmt, role } = useApp();
  const mine = useMine();
  const [q, setQ] = useState(''), [f, setF] = useState<Filter>('active'), [groupId, setGroupId] = useState('');
  const bal = useMemo(() => balanceMap(db), [db]);
  const low = db.settings.lowBalance;
  const base = db.students.filter(s => !mine || mine.has(s.id));
  const is = (s: (typeof base)[number], k: Filter) => k === 'all' ? true : k === 'low' ? s.status === 'active' && bal.get(s.id)!.left >= 0 && bal.get(s.id)!.left <= low : k === 'debt' ? s.status !== 'left' && bal.get(s.id)!.left < 0 : s.status === k;
  const counts = Object.fromEntries((['active', 'low', 'debt', 'paused', 'left', 'all'] as Filter[]).map(k => [k, base.filter(s => is(s, k)).length]));
  const list = useMemo(() => {
    const t = q.trim().toLowerCase(), d = digits(t);
    return base.filter(s => is(s, f))
      .filter(s => !groupId || (groupId === 'ind' ? isIndividualStudent(db, s.id) : studentGroups(db, s.id).some(g => g.id === groupId)))
      .filter(s => !t || s.name.toLowerCase().includes(t) || payerOf(db, s)?.name.toLowerCase().includes(t) || (d.length >= 3 && digits(contactPhone(db, s)).includes(d)))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [base, f, q, groupId, db, bal]); // eslint-disable-line react-hooks/exhaustive-deps
  const sell = can.sell(role);
  const lastVisit = (sid: string) => db.lessons.filter(l => l.status === 'done' && l.attendance[sid] === 'present').reduce((m, l) => Math.max(m, l.start), 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Имя, родитель или телефон" className="pl-9" aria-label="Поиск учеников" />
        </div>
        <Select value={groupId} onChange={e => setGroupId(e.target.value)} className="w-full sm:w-56" aria-label="Группа">
          <option value="">Все группы</option>
          {db.groups.filter(g => !mine || g.studentIds.some(i => mine.has(i))).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          <option value="ind">Индивидуально</option>
        </Select>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
        <Chip on={f === 'active'} onClick={() => setF('active')} count={counts.active}>Учатся</Chip>
        {role !== 'teacher' && <Chip on={f === 'low'} onClick={() => setF('low')} count={counts.low}>Заканчивается</Chip>}
        {role !== 'teacher' && <Chip on={f === 'debt'} onClick={() => setF('debt')} count={counts.debt}>Должники</Chip>}
        <Chip on={f === 'paused'} onClick={() => setF('paused')} count={counts.paused}>{STUDENT_STATUS_LABEL.paused}</Chip>
        <Chip on={f === 'left'} onClick={() => setF('left')} count={counts.left}>Ушли</Chip>
        <Chip on={f === 'all'} onClick={() => setF('all')} count={counts.all}>Все</Chip>
      </div>

      <div className="overflow-hidden rounded-[16px] border border-line bg-surface shadow-card">
        <div className="hidden grid-cols-[minmax(200px,1.4fr)_minmax(160px,1.2fr)_150px_110px_auto] items-center gap-4 border-b border-line bg-surface-2/60 px-5 py-2.5 text-xs font-medium text-ink-3 lg:grid">
          <span>Ученик</span><span>Группа</span><span>{role === 'teacher' ? 'Уровень' : 'Остаток'}</span><span>Был</span><span className="w-[104px]" />
        </div>
        {list.length ? (
          <ul className="divide-y divide-line">
            {list.map(s => {
              const b = bal.get(s.id)!, gs = studentGroups(db, s.id), p = payerOf(db, s), lv = lastVisit(s.id);
              return (
                <li key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-surface-2/50 sm:px-5 lg:grid-cols-[minmax(200px,1.4fr)_minmax(160px,1.2fr)_150px_110px_auto] lg:gap-4">
                  <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => openDrawer({ type: 'student', id: s.id })}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-semibold text-ink-2" aria-hidden>{initials(s.name)}</span>
                    <span className="min-w-0 leading-tight"><span className="block truncate font-medium">{s.name}</span><span className="block truncate text-xs text-ink-3">{p && p.relation !== 'self' ? 'родитель: ' + p.name : contactPhone(db, s)}</span></span>
                  </button>
                  <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-center gap-1.5 pl-12 lg:col-span-1 lg:row-start-auto lg:pl-0">
                    {gs.map(g => <span key={g.id} className="inline-flex items-center gap-1.5 truncate text-[13px] text-ink-2"><span className="size-2 shrink-0 rounded-full" style={{ background: teacherById(db, g.teacherId)?.color }} aria-hidden />{g.name}</span>)}
                    {!gs.length && isIndividualStudent(db, s.id) && <span className="text-[13px] text-ink-2">Индивидуально</span>}
                    {s.status !== 'active' && <Badge tone={s.status === 'paused' ? 'warn' : 'neutral'}>{STUDENT_STATUS_LABEL[s.status]}</Badge>}
                  </div>
                  <div className="col-start-2 row-start-1 justify-self-end lg:col-start-auto lg:row-start-auto lg:justify-self-start">
                    {role === 'teacher' ? <Badge>{s.level}</Badge> : s.status === 'left' ? <span className="text-xs text-ink-3">{s.leftReason}</span> : <BalanceBadge left={b.left} low={low} debt={b.debt} money={fmt} />}
                  </div>
                  <span className="hidden text-[13px] text-ink-3 lg:block">{lv ? dateShort(lv) : '—'}</span>
                  <div className="hidden justify-end lg:flex">{sell && s.status !== 'left' ? <Button variant={b.left < 0 ? 'soft' : 'ghost'} size="sm" icon={Wallet} onClick={() => openModal({ type: 'payment', studentId: s.id })}>Оплата</Button> : <span className="w-[104px]" />}</div>
                </li>
              );
            })}
          </ul>
        ) : <Empty icon={GraduationCap} title={q ? 'Никого не нашли' : 'Здесь пока пусто'}>{q ? 'Проверьте имя или наберите последние цифры телефона.' : 'Ученики появляются, когда заявка оплачивает обучение.'}</Empty>}
      </div>
      <p className="text-xs text-ink-3">{plural(list.length, 'ученик', 'ученика', 'учеников')} в списке</p>
    </>
  );
}

function GroupList() {
  const db = useDB();
  const { openDrawer, role, user } = useApp();
  const groups = db.groups.filter(g => role !== 'teacher' || g.teacherId === user.teacherId);
  if (!groups.length) return <Empty icon={Users} title="Групп нет">У вас только индивидуальные занятия — они видны в расписании.</Empty>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map(g => {
        const t = teacherById(db, g.teacherId)!;
        const next = db.lessons.filter(l => l.groupId === g.id && l.status === 'planned' && l.start > Date.now()).sort((a, b) => a.start - b.start)[0];
        const fill = g.studentIds.length / g.capacity;
        return (
          <button key={g.id} type="button" onClick={() => openDrawer({ type: 'group', id: g.id })} className="rounded-[16px] border border-line bg-surface p-4 text-left shadow-card transition-[border-color] duration-150 hover:border-line-2">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl text-xs font-semibold text-white" style={{ background: t.color }} aria-hidden>{initials(t.name)}</span>
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{g.name}</div><div className="text-[13px] text-ink-2">{t.name}</div></div>
              <Badge>{g.level}</Badge>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[13px] text-ink-2"><CalendarClock className="size-4 text-ink-3" aria-hidden />{g.weekdays.map(w => WEEKDAYS[w - 1]).join(', ')} · {g.time} · {g.duration} мин</div>
            {next && <div className="mt-1 text-xs text-ink-3">Следующее: {when(next.start)}</div>}
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs"><span className="text-ink-2">Учеников</span><span className="tnum font-medium">{g.studentIds.length} из {g.capacity}{g.studentIds.length < g.capacity ? ' · есть места' : ''}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3"><div className={cx('h-full rounded-full', fill >= 1 ? 'bg-ok' : 'bg-accent')} style={{ width: fill * 100 + '%' }} /></div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
