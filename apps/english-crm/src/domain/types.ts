/* Модель данных CRM онлайн-школы.
   Все суммы хранятся в тенге (целые числа), даты — в миллисекундах (Date.now()).
   Хранилище не знает об экранах: экраны читают состояние и вызывают действия из data/actions. */

export type ID = string;

export type Role = 'admin' | 'manager' | 'teacher' | 'owner';

export interface User {
  id: ID;
  name: string;
  role: Role;
  teacherId?: ID; // для роли «преподаватель»
}

/* ---------- Заявки ---------- */
export type Channel = 'whatsapp' | 'telegram' | 'site' | 'call' | 'referral';

export type LeadStatus =
  | 'new' // Новая заявка
  | 'contacted' // Связались
  | 'trial_booked' // Назначен пробный
  | 'trial_done' // Пробный прошёл
  | 'awaiting_payment' // Ждём оплату
  | 'paid' // Оплатил
  | 'lost'; // Отказ (с причиной)

export type LostReason = 'expensive' | 'no_time' | 'no_answer' | 'chose_other' | 'not_target' | 'other';

export interface HistoryEntry {
  at: number;
  text: string;
  by?: ID; // кто сделал
}

export interface Lead {
  id: ID;
  name: string;
  phone: string;
  channel: Channel;
  source: string; // откуда узнали: «Реклама VK», «Сайт / IELTS», «Рекомендация»
  comment: string; // что написал человек
  goal?: string; // цель: IELTS, разговорный, для ребёнка
  forChild?: boolean;
  createdAt: number;
  status: LeadStatus;
  statusAt: number; // когда перешла в текущий статус
  firstReplyAt?: number; // первая реакция школы — для «без ответа дольше N часов»
  lostReason?: LostReason;
  lostComment?: string;
  trialLessonId?: ID;
  studentId?: ID; // после оплаты заявка превращается в ученика
  managerId: ID;
  history: HistoryEntry[];
}

/* ---------- Люди ---------- */
export interface Payer {
  id: ID;
  name: string;
  phone: string;
  relation: 'self' | 'mother' | 'father' | 'other';
}

export type StudentStatus = 'active' | 'paused' | 'left';

export interface Student {
  id: ID;
  name: string;
  phone: string;
  age?: number;
  level: Level;
  payerId: ID; // кто платит (сам ученик или родитель)
  status: StudentStatus;
  leftReason?: string;
  leftAt?: number;
  createdAt: number;
  note: string;
  leadId?: ID;
  preferredChannel: Channel;
}

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface Teacher {
  id: ID;
  name: string;
  phone: string;
  color: string; // цвет в расписании (+ инициалы, чтобы не только цвет)
  rateGroup: number; // ставка за групповое занятие, ₸
  rateIndividual: number; // ставка за индивидуальное / пробное, ₸
  workFrom: number; // рабочие часы, например 10
  workTo: number; // 21
}

/* ---------- Учёба ---------- */
export interface Group {
  id: ID;
  name: string;
  level: Level;
  teacherId: ID;
  studentIds: ID[];
  capacity: number;
  weekdays: number[]; // 1 = пн … 7 = вс
  time: string; // 'HH:MM'
  duration: number; // минуты
  meetUrl: string;
}

export type LessonKind = 'group' | 'individual' | 'trial';
export type LessonStatus = 'planned' | 'done' | 'canceled';
export type AttendanceMark = 'present' | 'absent' | 'excused'; // excused — уважительная, урок не списывается

export interface Lesson {
  id: ID;
  kind: LessonKind;
  teacherId: ID;
  start: number;
  duration: number;
  status: LessonStatus;
  groupId?: ID;
  studentId?: ID; // индивидуальное
  leadId?: ID; // пробное
  seriesId?: ID; // повторяющиеся занятия
  attendance: Record<ID, AttendanceMark>; // studentId → отметка; пусто — не отмечено
  cancelReason?: string;
  movedFrom?: number; // если переносили
}

/* ---------- Деньги ---------- */
export interface PackageType {
  id: ID;
  title: string; // «8 занятий в группе»
  kind: 'group' | 'individual';
  lessons: number;
  price: number; // ₸
}

export interface Subscription {
  // абонемент конкретного ученика
  id: ID;
  studentId: ID;
  packageTypeId: ID;
  title: string;
  lessons: number;
  price: number;
  purchasedAt: number;
  paymentId: ID;
}

export type PayMethod = 'cash' | 'kaspi' | 'transfer' | 'card';

export interface Payment {
  id: ID;
  studentId: ID;
  payerId: ID;
  amount: number; // ₸
  method: PayMethod;
  at: number;
  subscriptionId?: ID;
  comment: string;
  by: ID;
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

export type TemplateKey = 'greeting' | 'trial_reminder' | 'after_trial' | 'payment_reminder' | 'low_balance' | 'lesson_moved';

export interface MessageTemplate {
  key: TemplateKey;
  title: string;
  text: string; // переменные: {имя} {дата} {время} {сумма} {школа} {уроков}
}

export interface Settings {
  schoolName: string;
  currency: 'KZT' | 'RUB';
  rubRate: number; // сколько тенге в 1 рубле
  channels: Record<Channel, boolean>;
  slaHours: number; // заявка без ответа дольше N часов подсвечивается
  lowBalance: number; // «заканчивается абонемент», уроков
  trialDuration: number;
}

export interface DB {
  version: number;
  users: User[];
  leads: Lead[];
  payers: Payer[];
  students: Student[];
  teachers: Teacher[];
  groups: Group[];
  lessons: Lesson[];
  packageTypes: PackageType[];
  subscriptions: Subscription[];
  payments: Payment[];
  tasks: Task[];
  templates: MessageTemplate[];
  settings: Settings;
}
