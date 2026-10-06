/* Настройки: шаблоны сообщений, правила подсветки, демо-данные. Только то, что команда курса реально меняет. */
import { useState } from 'react';
import { MessageSquareText, SlidersHorizontal, RotateCcw } from 'lucide-react';
import type { TemplateKey } from '../domain/types';
import { useDB, resetDemo } from '../data/store';
import { saveSettings, saveTemplate } from '../data/actions';
import { fillTemplate } from '../lib/messaging';
import { Button, Card, CardTitle, Chip, Segmented, Textarea } from '../ui/kit';
import { toast } from '../ui/overlay';

const VARS = ['имя', 'дата', 'время', 'сумма', 'курс'];

export function SettingsScreen() {
  const db = useDB();
  const s = db.settings;
  const [key, setKey] = useState<TemplateKey>('greeting');
  const tpl = db.templates.find(t => t.key === key)!;
  const [text, setText] = useState(tpl.text);
  const pickTpl = (k: TemplateKey) => { setKey(k); setText(db.templates.find(t => t.key === k)!.text); };
  const sample = fillTemplate(text, { имя: 'Анна', дата: '14 окт', время: '17:00', сумма: '16 490 ₽', курс: s.courseName });
  const insert = (v: string) => setText(t => t + (t.endsWith(' ') || !t ? '' : ' ') + '{' + v + '}');

  return (
    <div className="grid max-w-[980px] grid-cols-1 gap-5">
      <Card>
        <CardTitle icon={MessageSquareText} tone="accent">Шаблоны сообщений</CardTitle>
        <p className="-mt-1 mb-4 text-[13px] text-ink-2">Подставляются в кнопку «Написать». Переменные в фигурных скобках заменятся данными человека.</p>
        <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">{db.templates.map(t => <Chip key={t.key} on={key === t.key} onClick={() => pickTpl(t.key)}>{t.title}</Chip>)}</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Textarea value={text} onChange={e => setText(e.target.value)} rows={6} className="min-h-[160px]" aria-label="Текст шаблона" />
            <div className="mt-2 flex flex-wrap gap-1.5">{VARS.map(v => <button key={v} type="button" onClick={() => insert(v)} className="rounded-md bg-surface-2 px-2 py-1 font-mono text-xs text-ink-2 hover:text-ink">{'{' + v + '}'}</button>)}</div>
          </div>
          <div>
            <div className="mb-1.5 text-xs text-ink-3">Так увидит человек:</div>
            <div className="rounded-[18px] rounded-tl-md bg-accent-soft px-4 py-3 text-sm leading-relaxed text-ink">{sample}</div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {text !== tpl.text && <Button variant="ghost" onClick={() => setText(tpl.text)}>Отменить правки</Button>}
          <Button variant="primary" disabled={text === tpl.text || !text.trim()} onClick={() => { saveTemplate({ ...tpl, text }); toast('Шаблон «' + tpl.title + '» сохранён'); }}>Сохранить шаблон</Button>
        </div>
      </Card>

      <Card>
        <CardTitle icon={SlidersHorizontal} tone="warn">Правила подсветки</CardTitle>
        <div className="grid gap-5 md:grid-cols-3">
          <Rule label="Заявка «горит», если без ответа дольше" value={s.slaHours} options={[1, 2, 4, 24]} fmt={v => v + ' ч'} onChange={v => saveSettings({ slaHours: v })} />
          <Rule label="Работа «просрочена», если не проверена за" value={s.reviewDays} options={[1, 2, 3, 5]} fmt={v => v + ' дн'} onChange={v => saveSettings({ reviewDays: v })} />
          <Rule label="Длительность созвона-консультации" value={s.callDuration} options={[20, 30, 45]} fmt={v => v + ' мин'} onChange={v => saveSettings({ callDuration: v })} />
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1"><div className="font-semibold">Демо-данные</div><p className="text-[13px] text-ink-2">Все участники, заявки и компании вымышлены и хранятся только в этом браузере. Каждый день данные собираются заново под текущую дату. Роль (администратор, менеджер продаж, куратор, владелец) переключается внизу меню — так видно, что увидит каждый сотрудник.</p></div>
          <Button variant="danger" icon={RotateCcw} onClick={() => { if (confirm('Вернуть исходные демо-данные? Ваши изменения пропадут.')) { resetDemo(); toast('Демо-данные восстановлены', { tone: 'info' }); } }}>Сбросить демо</Button>
        </div>
      </Card>
    </div>
  );
}

function Rule({ label, value, options, fmt, onChange }: { label: string; value: number; options: number[]; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-2 text-[13px] text-ink-2">{label}</div>
      <Segmented value={String(value)} onChange={v => onChange(+v)} options={options.map(o => ({ value: String(o), label: fmt(o) }))} className="w-full" />
    </div>
  );
}
