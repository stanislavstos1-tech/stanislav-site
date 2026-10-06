import { useCallback, useEffect, useMemo, useState } from 'react';
import { House, Inbox, Users, FileCheck2, CalendarDays, Bell, Wallet, BarChart3, Settings as SettingsIcon, Plus, Moon, Sun, MoreHorizontal, ChevronsUpDown, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Ctx, ACCESS, HOME, PAGE_TITLE, can, useApp } from './ctx';
import type { Page, DrawerState, ModalState, AppCtx } from './ctx';
import { useDB } from '../data/store';
import { setActor } from '../data/actions';
import { isOverdue, reviewQueue, dueUntil } from '../data/selectors';
import { addDays, startOfDay, money, moneyShort } from '../lib/format';
import { ROLE_LABEL } from '../domain/labels';
import { Button, cx, Avatar } from '../ui/kit';
import { Toaster } from '../ui/overlay';
import { GlobalSearch } from './GlobalSearch';
import { Overlays } from './Overlays';
import { Today } from '../screens/Today';
import { Leads } from '../screens/Leads';
import { Cohort } from '../screens/Cohort';
import { HomeworkScreen } from '../screens/Homework';
import { Schedule } from '../screens/Schedule';
import { Reminders } from '../screens/Reminders';
import { Payments } from '../screens/Payments';
import { Reports } from '../screens/Reports';
import { SettingsScreen } from '../screens/Settings';

/* меню: ежедневная работа сверху, отчёты и настройки — отдельно внизу */
const NAV: { page: Page; icon: LucideIcon; label: string; extra?: boolean }[] = [
  { page: 'today', icon: House, label: 'Сегодня' },
  { page: 'leads', icon: Inbox, label: 'Заявки' },
  { page: 'homework', icon: FileCheck2, label: 'Домашки' },
  { page: 'cohort', icon: Users, label: 'Поток' },
  { page: 'schedule', icon: CalendarDays, label: 'Расписание' },
  { page: 'reminders', icon: Bell, label: 'Напоминания' },
  { page: 'payments', icon: Wallet, label: 'Оплаты' },
  { page: 'reports', icon: BarChart3, label: 'Отчёты', extra: true },
  { page: 'settings', icon: SettingsIcon, label: 'Настройки', extra: true },
];
/** на телефоне внизу — главные разделы роли, остальное в «Ещё» */
const MOBILE_MAIN: Page[] = ['today', 'leads', 'homework', 'payments', 'cohort', 'schedule', 'reminders', 'reports'];

const readHash = (): Page | null => { const p = location.hash.replace(/^#\/?/, '') as Page; return PAGE_TITLE[p] ? p : null; };

export function App() {
  const db = useDB();
  const [userId, setUserId] = useState(() => { try { return localStorage.getItem('srez-crm-user') || 'u-admin'; } catch { return 'u-admin'; } });
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
  useEffect(() => { document.title = PAGE_TITLE[page] + ' · srez CRM'; }, [page]);

  const go = useCallback((p: Page) => { setPage(p); setMore(false); setDrawer(null); setModal(null); history.replaceState(null, '', '#/' + p); window.scrollTo(0, 0); }, []);
  const setUser = useCallback((id: string) => { setUserId(id); setDrawer(null); setModal(null); try { localStorage.setItem('srez-crm-user', id); } catch { /* */ } }, []);
  const toggleTheme = useCallback(() => {
    setTheme(t => { const n = t === 'dark' ? 'light' : 'dark'; document.documentElement.classList.toggle('dark', n === 'dark'); try { localStorage.setItem('srez-crm-theme', n); } catch { /* */ } return n; });
  }, []);

  const s = db.settings;
  const ctx: AppCtx = useMemo(() => ({
    user, role, setUser, page, go, drawer, openDrawer: setDrawer, modal, openModal: setModal, fmt: money, fmtShort: moneyShort, theme, toggleTheme,
  }), [user, role, setUser, page, go, drawer, modal, theme, toggleTheme]);

  // счётчики в меню
  const badges = useMemo(() => {
    const now = Date.now(), tomorrow0 = addDays(startOfDay(now), 1);
    return {
      leads: db.leads.filter(l => l.status === 'new').length,
      today: db.leads.filter(l => isOverdue(l, s.slaHours, now)).length,
      homework: reviewQueue(db, role === 'curator' ? user.curatorId : undefined).length,
      payments: dueUntil(db, startOfDay(now)).length,
      reminders: db.tasks.filter(t => !t.done && t.due < tomorrow0).length,
    } as Partial<Record<Page, number>>;
  }, [db, s.slaHours, role, user.curatorId]);

  const nav = NAV.filter(n => allowed.includes(n.page));
  const byMobile = MOBILE_MAIN.filter(p => allowed.includes(p)).map(p => nav.find(n => n.page === p)!);
  const mobileMain = byMobile.slice(0, nav.length > 5 ? 4 : 5);
  const mobileMore = nav.length > 5 ? nav.filter(n => !mobileMain.includes(n)) : [];

  const Screen = { today: Today, leads: Leads, cohort: Cohort, homework: HomeworkScreen, schedule: Schedule, reminders: Reminders, payments: Payments, reports: Reports, settings: SettingsScreen }[page];

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
        {/* ---------- меню слева ---------- */}
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-canvas px-3 pb-3 pt-5 md:flex">
          <Logo className="mb-7 px-2.5" />
          <nav className="flex flex-col gap-0.5" aria-label="Разделы">
            {nav.filter(n => !n.extra).map(n => <NavItem key={n.page} {...n} on={page === n.page} badge={badges[n.page]} onClick={() => go(n.page)} />)}
            {nav.some(n => n.extra) && <div className="mx-2.5 my-2 border-t border-line" />}
            {nav.filter(n => n.extra).map(n => <NavItem key={n.page} {...n} on={page === n.page} onClick={() => go(n.page)} />)}
          </nav>
          <div className="mt-auto grid gap-2">
            <Prefs />
            <UserSwitch />
          </div>
        </aside>

        {/* ---------- рабочая область ---------- */}
        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4 md:h-16 md:gap-3 md:px-8">
              <button type="button" onClick={() => setMore(true)} className="-ml-1 md:hidden" aria-label="Меню: роль и тема"><Avatar name={user.name} color={db.curators.find(c => c.id === user.curatorId)?.color || '#D8F83A'} size={30} /></button>
              <h1 className="display min-w-0 truncate text-[16px] font-bold uppercase md:text-[19px]">{PAGE_TITLE[page]}</h1>
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
      <nav className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas md:hidden" aria-label="Разделы">
        <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${mobileMain.length + (mobileMore.length ? 1 : 0)}, 1fr)` }}>
          {mobileMain.map(n => <TabItem key={n.page} {...n} on={page === n.page} badge={badges[n.page]} onClick={() => go(n.page)} />)}
          {mobileMore.length > 0 && <TabItem page="settings" icon={MoreHorizontal} label="Ещё" on={mobileMore.some(m => m.page === page) || more} onClick={() => setMore(true)} />}
        </div>
      </nav>
      {more && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="anim-fade absolute inset-0 bg-black/50" onClick={() => setMore(false)} />
          <div className="anim-sheet safe-b absolute inset-x-0 bottom-0 rounded-t-[26px] border border-line bg-surface p-3 shadow-pop">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-2" />
            <div className="grid gap-0.5">{mobileMore.map(n => <NavItem key={n.page} {...n} on={page === n.page} badge={badges[n.page]} onClick={() => go(n.page)} big />)}</div>
            <div className="mt-3 grid gap-2 border-t border-line pt-3"><Prefs /><UserSwitch /></div>
          </div>
        </div>
      )}

      <Overlays />
      <Toaster />
    </Ctx.Provider>
  );
}

/** логотип как на лендинге: srez + подпись моноширинным */
function Logo({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-baseline gap-2', className)}>
      <span className="display text-[26px] font-black leading-none tracking-[-0.06em]">srez</span>
      <span className="label text-ink-3">CRM курса</span>
    </div>
  );
}

function NavItem({ icon: I, label, on, badge, onClick, big }: { icon: LucideIcon; label: string; on: boolean; badge?: number; onClick: () => void; big?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-current={on ? 'page' : undefined}
      className={cx('flex items-center gap-3 rounded-full px-3 text-left font-medium transition-[background,color] duration-150', big ? 'h-12 text-[15px]' : 'h-10 text-sm', on ? 'bg-accent text-[#0b0b0c]' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
      <I className="size-[18px]" strokeWidth={on ? 2.2 : 1.9} aria-hidden />
      <span className="flex-1">{label}</span>
      {!!badge && <span className={cx('tnum grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold', on ? 'bg-[#0b0b0c] text-accent' : 'bg-bad text-white')}>{badge}</span>}
    </button>
  );
}

function TabItem({ icon: I, label, on, badge, onClick }: { page: Page; icon: LucideIcon; label: string; on: boolean; badge?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={on ? 'page' : undefined} className={cx('relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium', on ? 'text-accent-ink' : 'text-ink-3')}>
      <span className="relative">
        <I className="size-[22px]" strokeWidth={on ? 2.2 : 1.8} aria-hidden />
        {!!badge && <span className="tnum absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-canvas bg-bad px-1 text-[10px] font-semibold text-white">{badge}</span>}
      </span>
      {label}
    </button>
  );
}

/** тема оформления: по умолчанию тёмная, как лендинг srez */
function Prefs() {
  const { theme, toggleTheme } = useApp();
  return (
    <button type="button" onClick={toggleTheme} className="flex h-9 items-center gap-2.5 rounded-full px-3 text-left text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
      {theme === 'dark' ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
    </button>
  );
}

/** демо: переключение роли, чтобы увидеть CRM глазами менеджера, куратора или владельца */
function UserSwitch() {
  const { user, setUser } = useApp();
  const db = useDB();
  const [open, setOpen] = useState(false);
  const list = [db.users.find(u => u.role === 'admin')!, db.users.find(u => u.role === 'manager')!, db.users.find(u => u.role === 'curator')!, db.users.find(u => u.role === 'owner')!];
  const cur = user.curatorId ? db.curators.find(c => c.id === user.curatorId) : undefined;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex w-full items-center gap-2.5 rounded-[18px] border border-line p-2 text-left hover:bg-surface-2">
        <Avatar name={user.name} color={cur?.color || '#D8F83A'} size={32} />
        <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[13px] font-medium">{user.name}</span><span className="block text-xs text-ink-3">{ROLE_LABEL[user.role]} · демо</span></span>
        <ChevronsUpDown className="size-4 text-ink-3" aria-hidden />
      </button>
      {open && (
        <div className="anim-pop absolute bottom-full left-0 right-0 z-50 mb-1.5 rounded-[18px] border border-line bg-surface p-1 shadow-pop">
          <div className="label px-2.5 pb-1 pt-1.5 text-ink-3">Посмотреть глазами:</div>
          {list.map(u => (
            <button key={u.id} type="button" onClick={() => { setUser(u.id); setOpen(false); }} className="flex h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left hover:bg-surface-2">
              <span className="min-w-0 flex-1 leading-tight"><span className="block text-[13px] font-medium">{ROLE_LABEL[u.role]}</span><span className="block truncate text-xs text-ink-3">{u.name}</span></span>
              {u.id === user.id && <Check className="size-4 text-accent-ink" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
