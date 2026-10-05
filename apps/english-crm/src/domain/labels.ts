import type { Channel, LeadStatus, LostReason, PayMethod, Role, LessonKind, AttendanceMark, StudentStatus, Payer } from './types';

export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'trial_booked', 'trial_done', 'awaiting_payment', 'paid', 'lost'];
export const FUNNEL: LeadStatus[] = ['new', 'contacted', 'trial_booked', 'trial_done', 'awaiting_payment', 'paid'];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'Новая заявка',
  contacted: 'Связались',
  trial_booked: 'Назначен пробный',
  trial_done: 'Пробный прошёл',
  awaiting_payment: 'Ждём оплату',
  paid: 'Оплатил',
  lost: 'Отказ',
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  site: 'Сайт',
  call: 'Звонок',
  referral: 'Рекомендация',
};

export const LOST_LABEL: Record<LostReason, string> = {
  expensive: 'Дорого',
  no_time: 'Нет времени',
  no_answer: 'Не выходит на связь',
  chose_other: 'Выбрал другую школу',
  not_target: 'Не наш запрос',
  other: 'Другое',
};

export const METHOD_LABEL: Record<PayMethod, string> = { cash: 'Наличные', sbp: 'СБП', transfer: 'Перевод', card: 'Карта' };

export const ROLE_LABEL: Record<Role, string> = { admin: 'Администратор', manager: 'Менеджер', teacher: 'Преподаватель', owner: 'Владелец' };

export const KIND_LABEL: Record<LessonKind, string> = { group: 'Группа', individual: 'Индивидуально', trial: 'Пробный' };

export const MARK_LABEL: Record<AttendanceMark, string> = { present: 'Был', absent: 'Не был', excused: 'Уважительная' };

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = { active: 'Учится', paused: 'Пауза', left: 'Ушёл' };

export const RELATION_LABEL: Record<Payer['relation'], string> = { self: 'Сам', mother: 'Мама', father: 'Папа', other: 'Плательщик' };

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WEEKDAYS_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
