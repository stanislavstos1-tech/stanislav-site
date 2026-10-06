/* Модель данных CRM курса маркетинга srez.
   Курс идёт потоками: 36 занятий за 4 месяца, группы по 4–5 человек с куратором, в конце — защита.
   Два тарифа: «Живой поток» (с куратором) и «Записи» (самостоятельно). Оплата сразу или в рассрочку на 10 платежей.
   Суммы — в рублях (целые), даты — в миллисекундах (Date.now()). */

export type ID = string;

export type Role = 'admin' | 'manager' | 'curator' | 'owner';

export interface User {
  id: ID;
  name: string;
  role: Role;
  curatorId?: ID; // для роли «куратор»
}

/* ---------- Заявки ---------- */
export type Channel = 'telegram' | 'site' | 'vk' | 'referral' | 'call';

export type LeadStatus =
  | 'new' // Новая заявка
  | 'contacted' // Связались
  | 'call_booked' // Назначен созвон-консультация
  | 'call_done' // Созвон прошёл
  | 'awaiting_payment' // Ждём оплату
  | 'paid' // Оплатил — стал участником потока
  | 'lost'; // Отказ (с причиной)

export type LostReason = 'expensive' | 'no_time' | 'no_answer' | 'later' | 'chose_other' | 'not_target' | 'other';

export type Tariff = 'live' | 'self';
export type Experience = 'junior' | 'senior'; // до 3 лет / 3+ года

export interface HistoryEntry {
  at: number;
  text: string;
  by?: ID;
}

export interface Lead {
  id: ID;
  name: string;
  phone: string;
  channel: Channel;
  source: string; // «Реклама в Telegram», «Лендинг / тарифы»
  comment: string; // что написал человек
  position?: string; // «SMM в агентстве», «Маркетолог in-house»
  experience: Experience;
  tariff: Tariff; // какой тариф интересует
  createdAt: number;
  status: LeadStatus;
  statusAt: number;
  firstReplyAt?: number;
  callAt?: number; // время созвона-консультации
  lostReason?: LostReason;
  lostComment?: string;
  studentId?: ID;
  managerId: ID;
  history: HistoryEntry[];
}

/* ---------- Поток ---------- */
export interface Cohort {
  id: ID;
  name: string; // «Ноябрьский поток»
  start: number;
  end: number;
  lessons: number; // 36
  seats: number; // мест в живом потоке
}

export interface Curator {
  id: ID;
  name: string;
  phone: string;
  color: string;
  role: string; // «Куратор · стратегия»
}

export interface Group {
  id: ID;
  name: string; // «Группа 1»
  curatorId: ID;
  studentIds: ID[];
}

export type Track = 'brief' | 'own'; // учебный бриф / свой продукт
export type StudentStatus = 'active' | 'paused' | 'left' | 'done'; // done — выпустился

export interface Student {
  id: ID;
  name: string;
  phone: string;
  position: string;
  company: string;
  tariff: Tariff;
  track: Track;
  cohortId: ID;
  status: StudentStatus;
  leftReason?: string;
  leftAt?: number;
  createdAt: number;
  note: string;
  leadId?: ID;
}

/* ---------- Учёба ---------- */
export type LessonKind = 'lecture' | 'practice' | 'call' | 'defense';

export interface Lesson {
  id: ID;
  n: number; // номер занятия 1…36
  block: number; // блок программы 1…6
  title: string;
  kind: LessonKind;
  start: number;
  duration: number; // минуты
  speaker: string;
  cohortId: ID;
}

export type HomeworkStatus = 'submitted' | 'returned' | 'accepted';

export interface Homework {
  id: ID;
  studentId: ID;
  block: number; // 1…6 — каждый блок закрывается работой
  title: string;
  submittedAt: number;
  status: HomeworkStatus;
  reviewedAt?: number;
  comment?: string; // что поправить
}

/* ---------- Деньги ---------- */
export type PayMethod = 'card' | 'sbp' | 'invoice' | 'bank';
export type PayPlan = 'full' | 'installments';

/** один платёж графика: при полной оплате он один, в рассрочку — десять */
export interface Installment {
  id: ID;
  studentId: ID;
  n: number;
  of: number;
  due: number;
  amount: number;
  paidAt?: number;
  method?: PayMethod;
}

/* ---------- Работа ---------- */
export interface Task {
  id: ID;
  title: string;
  due: number;
  done: boolean;
  doneAt?: number;
  leadId?: ID;
  studentId?: ID;
  assigneeId: ID;
}

export type TemplateKey = 'greeting' | 'call_reminder' | 'after_call' | 'payment_reminder' | 'installment_due' | 'homework_returned';

export interface MessageTemplate {
  key: TemplateKey;
  title: string;
  text: string; // переменные: {имя} {дата} {время} {сумма} {курс}
}

export interface Settings {
  courseName: string;
  priceLive: number; // полная стоимость
  priceSelf: number;
  installments: number; // 10
  slaHours: number;
  reviewDays: number; // ДЗ должно быть проверено за N дней
  callDuration: number;
}

export interface DB {
  version: number;
  users: User[];
  leads: Lead[];
  cohorts: Cohort[];
  curators: Curator[];
  groups: Group[];
  students: Student[];
  lessons: Lesson[];
  homework: Homework[];
  installments: Installment[];
  tasks: Task[];
  templates: MessageTemplate[];
  settings: Settings;
}
