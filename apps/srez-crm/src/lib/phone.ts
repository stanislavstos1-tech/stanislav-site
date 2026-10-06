/* Телефоны России: +7 (XXX) XXX-XX-XX */

export const digits = (s: string) => s.replace(/\D/g, '');

/** приводит ввод к 11 цифрам с ведущей 7; «8…» по привычке и «9…/7xx» без кода тоже понимает */
export function normPhone(v: string): string {
  let d = digits(v);
  if (!d) return '';
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  else if (d.length === 10) d = '7' + d;
  else if (d[0] !== '7') d = '7' + d;
  return d.slice(0, 11);
}

export function formatPhone(d: string): string {
  if (!d) return '';
  let s = '+7';
  if (d.length > 1) s += ' (' + d.slice(1, 4);
  if (d.length >= 5) s += ') ' + d.slice(4, 7);
  if (d.length >= 8) s += '-' + d.slice(7, 9);
  if (d.length >= 10) s += '-' + d.slice(9, 11);
  return s;
}

export const isFullPhone = (v: string) => normPhone(v).length === 11;
export const prettyPhone = (v: string) => (isFullPhone(v) ? formatPhone(normPhone(v)) : v);

/** обработка набора в поле с маской: значение после «+7 (» считаем национальными цифрами */
export function maskTyping(prev: string, next: string): string {
  const prevD = digits(prev);
  if (prevD.length <= 1) {
    // поле было пустым: вставили номер целиком или набрали первую цифру
    const rest = next.replace(/^\+7\s?\(?/, '');
    const restD = digits(rest);
    if (!restD) return next.trim() === '' ? '' : '+7 (';
    if (restD.length === 1) return restD === '8' ? '+7 (' : formatPhone('7' + restD); // «8» — привычный префикс
    return formatPhone(normPhone(rest));
  }
  let d = digits(next);
  if (d[0] !== '7') d = '7' + d;
  return d.length <= 1 ? '+7 (' : formatPhone(d.slice(0, 11));
}
