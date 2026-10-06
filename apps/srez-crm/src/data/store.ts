/* Хранилище состояния.
   Экраны не знают, где лежат данные: они читают снимок через useDB() и меняют его через update().
   Сейчас снимок хранится в браузере (LocalRepository). Для работы с сервером достаточно
   написать ApiRepository с тем же интерфейсом и передать его в initStore(). */
import { useSyncExternalStore } from 'react';
import type { DB } from '../domain/types';
import { createSeed, SEED_VERSION } from './seed';
import { startOfDay } from '../lib/format';

export interface Repository {
  load(): DB | null;
  save(db: DB): void;
  clear(): void;
}

const KEY = 'srez-crm-v' + SEED_VERSION;
const DAY_KEY = 'srez-crm-day';

export class LocalRepository implements Repository {
  load() {
    try {
      // демо-данные привязаны к датам: на следующий день собираем их заново, чтобы «Сегодня» было живым
      if (localStorage.getItem(DAY_KEY) !== String(startOfDay(Date.now()))) return null;
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as DB) : null;
    } catch {
      return null;
    }
  }
  save(db: DB) {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      localStorage.setItem(DAY_KEY, String(startOfDay(Date.now())));
    } catch {
      /* приватный режим или нет места — работаем в памяти */
    }
  }
  clear() {
    try { localStorage.removeItem(KEY); localStorage.removeItem(DAY_KEY); } catch { /* */ }
  }
}

let repo: Repository = new LocalRepository();
let db: DB;
let undoSnapshot: DB | null = null;
const listeners = new Set<() => void>();
let saveTimer = 0;

export function initStore(r: Repository = new LocalRepository()) {
  repo = r;
  db = repo.load() ?? createSeed();
  repo.save(db);
}

const emit = () => listeners.forEach(l => l());
const persist = () => { clearTimeout(saveTimer); saveTimer = window.setTimeout(() => repo.save(db), 250); };

export const getDB = () => db;

/** Изменение данных. fn получает копию и меняет её напрямую. undoable — можно откатить из уведомления. */
export function update(fn: (draft: DB) => void, opts: { undoable?: boolean } = {}) {
  const draft = structuredClone(db);
  fn(draft);
  if (opts.undoable) undoSnapshot = db;
  db = draft;
  persist();
  emit();
}

export function undo() {
  if (!undoSnapshot) return false;
  db = undoSnapshot;
  undoSnapshot = null;
  persist();
  emit();
  return true;
}

export function resetDemo() {
  repo.clear();
  db = createSeed();
  repo.save(db);
  undoSnapshot = null;
  emit();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export const useDB = () => useSyncExternalStore(subscribe, getDB);

/** короткие id для новых записей */
export const uid = (p: string) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
