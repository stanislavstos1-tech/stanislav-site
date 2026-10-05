/* Контекст приложения: кто работает, какие разделы ему доступны, открытые окна, форматирование денег. */
import { createContext, useContext } from 'react';
import type { ID, Role, User } from '../domain/types';

export type Page = 'today' | 'leads' | 'schedule' | 'students' | 'payments' | 'teachers' | 'reports' | 'settings';

export const PAGE_TITLE: Record<Page, string> = {
  today: 'Сегодня', leads: 'Заявки', schedule: 'Расписание', students: 'Ученики и группы', payments: 'Оплаты', teachers: 'Преподаватели', reports: 'Отчёты', settings: 'Настройки',
};

/** права по ролям: администратор — всё, менеджер — продажи и учёт, преподаватель — своё расписание и группы, владелец — цифры */
export const ACCESS: Record<Role, Page[]> = {
  admin: ['today', 'leads', 'schedule', 'students', 'payments', 'teachers', 'reports', 'settings'],
  manager: ['today', 'leads', 'schedule', 'students', 'payments'],
  teacher: ['today', 'schedule', 'students'],
  owner: ['reports', 'payments', 'teachers'],
};
export const HOME: Record<Role, Page> = { admin: 'today', manager: 'today', teacher: 'today', owner: 'reports' };

export const can = {
  sell: (r: Role) => r === 'admin' || r === 'manager', // заявки, оплаты, ученики
  editSchedule: (r: Role) => r === 'admin' || r === 'manager',
  acceptPayment: (r: Role) => r === 'admin' || r === 'manager',
  settings: (r: Role) => r === 'admin',
};

export type DrawerState = { type: 'lead' | 'student' | 'lesson' | 'group' | 'teacher'; id: ID } | null;
export type ModalState =
  | { type: 'newLead' }
  | { type: 'payment'; studentId?: ID }
  | { type: 'bookTrial'; leadId: ID }
  | { type: 'lose'; leadId: ID }
  | { type: 'convert'; leadId: ID }
  | { type: 'message'; to: { kind: 'lead' | 'student'; id: ID }; template?: string }
  | { type: 'newLesson'; start?: number; teacherId?: ID; leadId?: ID }
  | { type: 'moveLesson'; lessonId: ID }
  | { type: 'cancelLesson'; lessonId: ID }
  | { type: 'studentLeft'; studentId: ID }
  | null;

export interface AppCtx {
  user: User;
  role: Role;
  setUser: (id: ID) => void;
  page: Page;
  go: (p: Page) => void;
  drawer: DrawerState;
  openDrawer: (d: DrawerState) => void;
  modal: ModalState;
  openModal: (m: ModalState) => void;
  fmt: (kzt: number) => string;
  fmtShort: (kzt: number) => string;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);
