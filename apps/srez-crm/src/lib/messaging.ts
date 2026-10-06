import type { MessageTemplate, TemplateKey } from '../domain/types';
import { digits } from './phone';

export interface TemplateVars {
  имя?: string;
  дата?: string;
  время?: string;
  сумма?: string;
  курс?: string;
}

export function fillTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{(имя|дата|время|сумма|курс)\}/g, (_, k: keyof TemplateVars) => String(vars[k] ?? '…'));
}

export const findTemplate = (list: MessageTemplate[], key: TemplateKey) => list.find(t => t.key === key);

/**
 * Ссылка на чат в Telegram по номеру. Текст Telegram подставить не позволяет —
 * поэтому сообщение заранее копируется в буфер обмена.
 */
export const chatLink = (phone: string) => `https://t.me/+${digits(phone)}`;

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
