import { WEEKDAYS } from '../domain/labels';

/* ---------- даты ---------- */
export const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const pad = (n: number) => String(n).padStart(2, '0');

export const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; };
export const addDays = (t: number, n: number) => { const d = new Date(t); d.setDate(d.getDate() + n); return +d; };
/** понедельник недели, в которую попадает t */
export const startOfWeek = (t: number) => { const d = new Date(startOfDay(t)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return +d; };
export const isoWeekday = (t: number) => ((new Date(t).getDay() + 6) % 7) + 1; // 1..7
export const dayDiff = (t: number, now = Date.now()) => Math.round((startOfDay(t) - startOfDay(now)) / DAY);
export const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);
export const at = (day: number, hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(day); d.setHours(h, m, 0, 0); return +d; };

export const hm = (t: number) => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
export const dateShort = (t: number) => { const d = new Date(t); return d.getDate() + ' ' + MON[d.getMonth()]; };
export const dateFull = (t: number) => dateShort(t) + ', ' + hm(t);
export const weekdayShort = (t: number) => WEEKDAYS[isoWeekday(t) - 1];

/** «Сегодня, 18:00», «Завтра, 10:00», «Пт, 14 окт, 12:00» */
export const when = (t: number) => {
  const k = dayDiff(t);
  const day = k === 0 ? 'Сегодня' : k === 1 ? 'Завтра' : k === -1 ? 'Вчера' : weekdayShort(t) + ', ' + dateShort(t);
  return day + ', ' + hm(t);
};

/** «5 мин», «3 ч», «2 дн» — сколько прошло */
export const elapsed = (t: number, now = Date.now()) => {
  const m = Math.max(0, Math.round((now - t) / MIN));
  if (m < 60) return m + ' мин';
  if (m < 1440) return Math.floor(m / 60) + ' ч';
  return Math.floor(m / 1440) + ' дн';
};

/** «только что», «20 мин назад», «вчера», «12 окт» */
export const ago = (t: number, now = Date.now()) => {
  const m = Math.round((now - t) / MIN);
  if (m < 1) return 'только что';
  if (m < 60) return m + ' мин назад';
  if (m < 1440 && dayDiff(t, now) === 0) return Math.floor(m / 60) + ' ч назад';
  if (dayDiff(t, now) === -1) return 'вчера, ' + hm(t);
  return dateShort(t);
};

/* ---------- деньги ---------- */
const NB = '\u00a0'; // неразрывный пробел: сумма не переносится посередине
const group3 = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NB);

/** все суммы — в рублях */
export const money = (rub: number) => group3(rub) + NB + '₽';
export const moneyShort = (rub: number) => {
  const v = rub;
  const sign = NB + '₽';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace('.', ',') + NB + 'млн' + sign;
  if (Math.abs(v) >= 1e4) return Math.round(v / 1e3) + NB + 'тыс' + sign;
  return group3(v) + sign;
};

export const plural = (n: number, one: string, few: string, many: string) => {
  const m = Math.abs(n) % 100, d = m % 10;
  return n + ' ' + (m > 10 && m < 20 ? many : d === 1 ? one : d > 1 && d < 5 ? few : many);
};

export const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
export const firstName = (name: string) => name.split(/\s+/)[0];
