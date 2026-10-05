import { useCallback, useEffect, useMemo, useState } from 'react';
import { House, Inbox, CalendarDays, GraduationCap, Wallet, UserRoundCheck, BarChart3, Settings as SettingsIcon, Plus, Moon, Sun, MoreHorizontal, ChevronsUpDown, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Ctx, ACCESS, HOME, PAGE_TITLE, can, useApp } from './ctx';
import type { Page, DrawerState, ModalState, AppCtx } from './ctx';
import { useDB } from '../data/store';
import { setActor, saveSettings } from '../data/actions';
import { isOverdue, unmarkedLessons } from '../data/selectors';
import { money, moneyShort } from '../lib/format';
import { ROLE_LABEL } from '../domain/labels';
import { Button, Segmented, cx, Avatar } from '../ui/kit';
import { Toaster } from '../ui/overlay';
import { GlobalSearch } from './GlobalSearch';
import { Overlays } from './Overlays';
import { Today } from '../screens/Today';
import { Leads } from '../screens/Leads';
import { Schedule } from '../screens/Schedule';
import { Students } from '../screens/Students';
import { Payments } from '../screens/Payments';
import { Teachers } from '../screens/Teachers';
import { Reports } from '../screens/Reports';
import { SettingsScreen } from '../screens/Settings';

const NAV: { page: Page; icon: LucideIcon; label: string }[] = [
  { page: 'today', icon: House, label: 'Сегодня' },
  { page: 'leads', icon: Inbox, label: 'Заявки' },
  { page: 'schedule', icon: CalendarDays, label: 'Расписание' },
  { page: 'students', icon: GraduationCap, label: 'Ученики' },
  { page: 'payments', icon: Wallet, label: 'Оплаты' },
  { page: 'teachers', icon: UserRoundCheck, label: 'Преподаватели' },
  { page: 'reports', icon: BarChart3, label: 'Отчёты' },
  { page: 'settings', icon: SettingsIcon, label: 'Настройки' },
];

const readHash = (): Page | null => { const p = location.hash.replace(/^#\/?/, '') as Page; return PAGE_TITLE[p] ? p : null; };

export function App() {
  const db = useDB();
  const [userId, setUserId] = useState(() => { try { return localStorage.getItem('lcrm-user') || 'u-admin'; } catch { return 'u-admin'; } });
  const user = db.users.find(u => u.id === userId) || db.users[0];
  const role = user.role;
  const allowed = ACCESS[role];
  const [page, setPage] = useState<Page>(() => { const h = readHash(); return h && allowed.includes(h) ? h : HOME[role]; });
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
  const [more, setMore] = useState(false);

  useEffect(() => { setActor(user.id); }, [user.id]);
  useEffect(() => { if (!allowed.includes(page)) setPage(HOME[role]); }, [role]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = () => { const h = readHash(); if (h && allowed.includes(h)) { setPage(h); setDrawer(null); setModal(null); setMore(false); } };
    addEventListener('hashchange', on); return () => removeEventListener('hashchange', on);
  }, [allowed]);
  useEffect(() => { document.title = PAGE_TITLE[page] + ' · Lingua CRM'; }, [page]);

  const go = useCallback((p: Page) => { setPage(p); setMore(false); setDrawer(null); setModal(null); history.replaceState(null, '', '#/' + p); window.scrollTo(0, 0); }, []);
  const setUser = useCallback((id: string) => { setUserId(id); setDrawer(null); setModal(null); try { localStorage.setItem('lcrm-user', id); } catch { /* */ } }, []);
  const toggleTheme = useCallback(() => {
    setTheme(t => { const n = t === 'dark' ? 'light' : 'dark'; document.documentElement.classList.toggle('dark', n === 'dark'); try { localStorage.setItem('lcrm-theme', n); } catch { /* */ } return n; });
  }, []);

  const s = db.settings;
  const ctx: AppCtx = useMemo(() => ({
    user, role, setUser, page, go, drawer, openDrawer: setDrawer, modal, openModal: setModal,
    fmt: (n: number) => money(n, s), fmtShort: (n: number) => moneyShort(n, s), theme, toggleTheme,
  }), [user, role, setUser, page, go, drawer, modal, s, theme, toggleTheme]);

  // счётчики в меню: горящие заявки и занятия без отметки
  const badges = useMemo(() => {
    const now = Date.now();
    const urgent = db.leads.filter(l => isOverdue(l, s.slaHours, now)).length;
    return {
      leads: db.leads.filter(l => l.status === 'new').length,
      today: urgent + unmarkedLessons(db, now, role === 'teacher' ? user.teacherId : undefined).length,
    } as Partial<Record<Page, number>>;
  }, [db, s.slaHours, role, user.teacherId]);

  const nav = NAV.filter(n => allowed.includes(n.page));
  const mobileMain = nav.slice(0, nav.length > 5 ? 4 : 5);
  const mobileMore = nav.length > 5 ? nav.slice(4) : [];

  const Screen = { today: Today, leads: Leads, schedule: Schedule, students: Students, payments: Payments, teachers: Teachers, reports: Reports, settings: SettingsScreen }[page];

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
        {/* ---------- меню слева ---------- */}
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-3 pb-3 pt-4 md:flex">
          <div className="mb-5 flex items-center gap-2.5 px-2.5">
            <span className="grid size-8 place-items-center rounded-[10px] bg-accent text-white dark:text-[#101018]"><span className="text-[15px] font-bold leading-none">L</span></span>
            <div className="leading-tight"><div className="text-[15px] font-semibold tracking-[-0.01em]">{s.schoolName}</div><div className="text-xs text-ink-3">школа английского</div></div>
          </div>
          <nav className="flex flex-col gap-0.5" aria-label="Разделы">
            {nav.map(n => <NavItem key={n.page} {...n} on={page === n.page} badge={badges[n.page]} onClick={() => go(n.page)} />)}
          </nav>
          <div className="mt-auto grid gap-2">
            <Prefs />
            <UserSwitch />
          </div>
        </aside>

        {/* ---------- рабочая область ---------- */}
        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-0 md:bg-canvas">
            <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4 md:h-16 md:gap-3 md:px-8">
              <button type="button" onClick={() => setMore(true)} className="-ml-1 md:hidden" aria-label="Меню: роль, тема, валюта"><Avatar name={user.name} color={db.teachers.find(t => t.id === user.teacherId)?.color || '#5b5bd6'} size={30} /></button>
              <h1 className="min-w-0 truncate text-[17px] font-semibold tracking-[-0.02em] md:text-xl">{PAGE_TITLE[page]}</h1>
              <div className="ml-auto flex items-center gap-2">
                {role !== 'owner' && <GlobalSearch />}
                {can.sell(role) && <Button variant="primary" icon={Plus} onClick={() => setModal({ type: 'newLead' })} className="max-sm:w-10 max-sm:px-0" aria-label="Новая заявка"><span className="max-sm:hidden">Новая заявка</span></Button>}
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-[1400px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-12 md:pt-6">
            <Screen />
          </main>
        </div>
      </div>

      {/* ---------- нижняя навигация (телефон) ---------- */}
      <nav className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden" aria-label="Разделы">
        <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${mobileMain.length + (mobileMore.length ? 1 : 0)}, 1fr)` }}>
          {mobileMain.map(n => <TabItem key={n.page} {...n} on={page === n.page} badge={badges[n.page]} onClick={() => go(n.page)} />)}
          {mobileMore.length > 0 && <TabItem page="settings" icon={MoreHorizontal} label="Ещё" on={mobileMore.some(m => m.page === page) || more} onClick={() => setMore(true)} />}
        </div>
      </nav>
      {more && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="anim-fade absolute inset-0 bg-black/30" onClick={() => setMore(false)} />
          <div className="anim-sheet safe-b absolute inset-x-0 bottom-0 rounded-t-[22px] border border-line bg-surface p-3 shadow-pop">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-2" />
            <div className="grid gap-0.5">{mobileMore.map(n => <NavItem key={n.page} {...n} on={page === n.page} onClick={() => go(n.page)} big />)}</div>
            <div className="mt-3 grid gap-2 border-t border-line pt-3"><Prefs /><UserSwitch /></div>
          </div>
        </div>
      )}

      <Overlays />
      <Toaster />
    </Ctx.Provider>
  );
}

function NavItem({ icon: I, label, on, badge, onClick, big }: { icon: LucideIcon; label: string; on: boolean; badge?: number; onClick: () => void; big?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-current={on ? 'page' : undefined}
      className={cx('flex items-center gap-3 rounded-[10px] px-2.5 text-left font-medium transition-[background,color] duration-150', big ? 'h-12 text-[15px]' : 'h-10 text-sm', on ? 'bg-accent-soft text-accent-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
      <I className="size-[18px]" strokeWidth={on ? 2.2 : 1.9} aria-hidden />
      <span className="flex-1">{label}</span>
      {!!badge && <span className="tnum grid h-5 min-w-5 place-items-center rounded-full bg-bad px-1.5 text-[11px] font-semibold text-white">{badge}</span>}
    </button>
  );
}

function TabItem({ icon: I, label, on, badge, onClick }: { page: Page; icon: LucideIcon; label: string; on: boolean; badge?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={on ? 'page' : undefined} className={cx('relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium', on ? 'text-accent' : 'text-ink-3')}>
      <span className="relative">
        <I className="size-[22px]" strokeWidth={on ? 2.2 : 1.8} aria-hidden />
        {!!badge && <span className="tnum absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-surface bg-bad px-1 text-[10px] font-semibold text-white">{badge}</span>}
      </span>
      {label}
    </button>
  );
}

/** тема и валюта */
function Prefs() {
  const { theme, toggleTheme } = useApp();
  const db = useDB();
  return (
    <div className="flex items-center gap-2 px-1">
      <Segmented size="sm" ariaLabel="Валюта" value={db.settings.currency} onChange={v => saveSettings({ currency: v })} options={[{ value: 'KZT', label: '₸ тенге' }, { value: 'RUB', label: '₽ рубли' }]} className="flex-1" />
      <Button variant="ghost" size="sm" icon={theme === 'dark' ? Sun : Moon} onClick={toggleTheme} aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} />
    </div>
  );
}

/** демо: переключение роли, чтобы увидеть, что видит преподаватель или владелец */
function UserSwitch() {
  const { user, setUser } = useApp();
  const db = useDB();
  const [open, setOpen] = useState(false);
  const list = [db.users.find(u => u.role === 'admin')!, db.users.find(u => u.role === 'manager')!, db.users.find(u => u.role === 'teacher')!, db.users.find(u => u.role === 'owner')!];
  const teacher = user.teacherId ? db.teachers.find(t => t.id === user.teacherId) : undefined;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex w-full items-center gap-2.5 rounded-xl border border-line p-2 text-left hover:bg-surface-2">
        <Avatar name={user.name} color={teacher?.color || '#5b5bd6'} size={32} />
        <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[13px] font-medium">{user.name}</span><span className="block text-xs text-ink-3">{ROLE_LABEL[user.role]} · демо</span></span>
        <ChevronsUpDown className="size-4 text-ink-3" aria-hidden />
      </button>
      {open && (
        <div className="anim-pop absolute bottom-full left-0 right-0 z-50 mb-1.5 rounded-xl border border-line bg-surface p-1 shadow-pop">
          <div className="px-2.5 pb-1 pt-1.5 text-xs text-ink-3">Посмотреть CRM глазами:</div>
          {list.map(u => (
            <button key={u.id} type="button" onClick={() => { setUser(u.id); setOpen(false); }} className="flex h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left hover:bg-surface-2">
              <span className="min-w-0 flex-1 leading-tight"><span className="block text-[13px] font-medium">{ROLE_LABEL[u.role]}</span><span className="block truncate text-xs text-ink-3">{u.name}</span></span>
              {u.id === user.id && <Check className="size-4 text-accent" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


