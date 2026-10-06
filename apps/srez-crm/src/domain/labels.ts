import type { Channel, LeadStatus, LostReason, PayMethod, Role, LessonKind, StudentStatus, Tariff, Track, Experience, HomeworkStatus } from './types';

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'Новая заявка',
  contacted: 'Связались',
  call_booked: 'Назначен созвон',
  call_done: 'Созвон прошёл',
  awaiting_payment: 'Ждём оплату',
  paid: 'Оплатил',
  lost: 'Отказ',
};

export const CHANNEL_LABEL: Record<Channel, string> = { telegram: 'Telegram', site: 'Сайт', vk: 'ВКонтакте', referral: 'Рекомендация', call: 'Звонок' };

export const LOST_LABEL: Record<LostReason, string> = {
  expensive: 'Дорого',
  no_time: 'Нет времени',
  no_answer: 'Не выходит на связь',
  later: 'Хочет в следующий поток',
  chose_other: 'Выбрал другой курс',
  not_target: 'Не наша аудитория',
  other: 'Другое',
};

export const TARIFF_LABEL: Record<Tariff, string> = { live: 'Живой поток', self: 'Записи' };
export const TARIFF_SHORT: Record<Tariff, string> = { live: 'Живой', self: 'Записи' };
export const TRACK_LABEL: Record<Track, string> = { brief: 'Учебный бриф', own: 'Свой продукт' };
export const EXP_LABEL: Record<Experience, string> = { junior: 'Опыт до 3 лет', senior: 'Опыт 3+ года' };

export const METHOD_LABEL: Record<PayMethod, string> = { card: 'Карта', sbp: 'СБП', invoice: 'Счёт юрлицу', bank: 'Перевод' };

export const ROLE_LABEL: Record<Role, string> = { admin: 'Администратор', manager: 'Менеджер продаж', curator: 'Куратор', owner: 'Владелец' };

export const KIND_LABEL: Record<LessonKind, string> = { lecture: 'Лекция', practice: 'Практика', call: 'Созвон группы', defense: 'Защита' };

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = { active: 'Учится', paused: 'Пауза', left: 'Ушёл', done: 'Выпускник' };

export const HW_LABEL: Record<HomeworkStatus, string> = { submitted: 'На проверке', returned: 'На доработке', accepted: 'Принято' };

/** шесть блоков программы — каждый закрывается работой */
export const BLOCKS = ['Аудитория и спрос', 'Позиционирование', 'Юнит-экономика', 'Каналы и медиаплан', 'Бюджет и метрики', 'Стратегия и защита'];

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WEEKDAYS_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
