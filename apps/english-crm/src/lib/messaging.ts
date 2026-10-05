import type { Channel, MessageTemplate, Settings, TemplateKey } from '../domain/types';
import { digits } from './phone';

export interface TemplateVars {
  имя?: string;
  дата?: string;
  время?: string;
  сумма?: string;
  уроков?: string | number;
  школа?: string;
}

export function fillTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{(имя|дата|время|сумма|уроков|школа)\}/g, (_, k: keyof TemplateVars) => String(vars[k] ?? '…'));
}

export const findTemplate = (list: MessageTemplate[], key: TemplateKey) => list.find(t => t.key === key);

/** каналы, через которые можно написать по номеру телефона */
export function chatChannel(preferred: Channel, s: Settings): 'whatsapp' | 'telegram' {
  if (preferred === 'whatsapp' && s.channels.whatsapp) return 'whatsapp';
  if (preferred === 'telegram') return 'telegram';
  return s.channels.whatsapp ? 'whatsapp' : 'telegram';
}

/**
 * Ссылка на чат.
 * WhatsApp (wa.me) умеет подставить текст сообщения.
 * Telegram (t.me/+номер) открывает чат по номеру, но текст подставить не позволяет —
 * поэтому сообщение мы заранее копируем в буфер обмена.
 */
export function chatLink(ch: 'whatsapp' | 'telegram', phone: string, text: string): string {
  const d = digits(phone);
  return ch === 'whatsapp' ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : `https://t.me/+${d}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
