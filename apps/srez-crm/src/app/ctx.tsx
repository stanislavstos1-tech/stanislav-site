/* Контекст приложения: кто работает, какие разделы ему доступны, открытые окна, форматирование денег. */
import { createContext, useContext } from 'react';
import type { ID, Role, User } from '../domain/types';

export type Page = 'today' | 'leads' | 'cohort' | 'homework' | 'schedule' | 'reminders' | 'payments' | 'reports' | 'settings';

export const PAGE_TITLE: Record<Page, string> = {
  today: 'Сегодня', leads: 'Заявки', cohort: 'Поток', homework: 'Домашки', schedule: 'Расписание', reminders: 'Напоминания', payments: 'Оплаты', reports: 'Отчёты', settings: 'Настройки',
};

/** права: менеджер продаёт и следит за оплатами, куратор проверяет работы своей группы, владелец смотрит цифры */
export const ACCESS: Record<Role, Page[]> = {
  admin: ['today', 'leads', 'cohort', 'homework', 'schedule', 'reminders', 'payments', 'reports', 'settings'],
  manager: ['today', 'leads', 'reminders', 'cohort', 'payments'],
  curator: ['today', 'homework', 'cohort', 'schedule'],
  owner: ['reports', 'payments', 'cohort'],
};
export const HOME: Record<Role, Page> = { admin: 'today', manager: 'today', curator: 'today', owner: 'reports' };

export const can = {
  sell: (r: Role) => r === 'admin' || r === 'manager',
  review: (r: Role) => r === 'admin' || r === 'curator',
  acceptPayment: (r: Role) => r === 'admin' || r === 'manager',
  manageStudents: (r: Role) => r === 'admin' || r === 'manager',
  settings: (r: Role) => r === 'admin',
};

export type DrawerState = { type: 'lead' | 'student' | 'lesson'; id: ID } | null;
export type ModalState =
  | { type: 'newLead' }
  | { type: 'message'; to: { kind: 'lead' | 'student'; id: ID }; template?: string }
  | { type: 'bookCall'; leadId: ID }
  | { type: 'lose'; leadId: ID }
  | { type: 'convert'; leadId: ID }
  | { type: 'pay'; studentId?: ID }
  | { type: 'returnHw'; homeworkId: ID }
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
  fmt: (rub: number) => string;
  fmtShort: (rub: number) => string;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);
