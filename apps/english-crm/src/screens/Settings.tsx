/* Настройки: шаблоны сообщений, каналы, валюта, правила подсветки, роли и права. */
import { useState } from 'react';
import { MessageSquareText, Radio, Coins, SlidersHorizontal, ShieldCheck, Check, Minus, RotateCcw, Info } from 'lucide-react';
import type { Channel, TemplateKey } from '../domain/types';
import { CHANNEL_LABEL, ROLE_LABEL } from '../domain/labels';
import { useDB, resetDemo } from '../data/store';
import { saveSettings, saveTemplate } from '../data/actions';
import { fillTemplate } from '../lib/messaging';
import { Button, Card, CardTitle, Chip, Input, Segmented, Textarea, cx } from '../ui/kit';
import { CHANNEL_ICON } from '../ui/domain';
import { toast } from '../ui/overlay';
import { ACCESS, PAGE_TITLE } from '../app/ctx';
import type { Page } from '../app/ctx';

const VARS = ['имя', 'дата', 'время', 'сумма', 'уроков', 'школа'];

export function SettingsScreen() {
  const db = useDB();
  const s = db.settings;
  const [key, setKey] = useState<TemplateKey>('greeting');
  const tpl = db.templates.find(t => t.key === key)!;
  const [text, setText] = useState(tpl.text);
  const [rate, setRate] = useState(String(s.rubRate).replace('.', ','));
  const pickTpl = (k: TemplateKey) => { setKey(k); setText(db.templates.find(t => t.key === k)!.text); };
  const sample = fillTemplate(text, { имя: 'Айгерим', дата: '14 окт', время: '17:00', сумма: s.currency === 'RUB' ? '6 670 ₽' : '36 000 ₸', уроков: 2, школа: s.schoolName });
  const insert = (v: string) => setText(t => t + (t.endsWith(' ') || !t ? '' : ' ') + '{' + v + '}');

  return (
    <div className="grid max-w-[980px] grid-cols-1 gap-5">
      <Card>
        <CardTitle icon={MessageSquareText} tone="accent">Шаблоны сообщений</CardTitle>
        <p className="-mt-1 mb-4 text-[13px] text-ink-2">Подставляются в кнопку «Написать». Переменные в фигурных скобках заменятся данными клиента.</p>
        <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">{db.templates.map(t => <Chip key={t.key} on={key === t.key} onClick={() => pickTpl(t.key)}>{t.title}</Chip>)}</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Textarea value={text} onChange={e => setText(e.target.value)} rows={6} className="min-h-[160px]" aria-label="Текст шаблона" />
            <div className="mt-2 flex flex-wrap gap-1.5">{VARS.map(v => <button key={v} type="button" onClick={() => insert(v)} className="rounded-md bg-surface-2 px-2 py-1 font-mono text-xs text-ink-2 hover:text-ink">{'{' + v + '}'}</button>)}</div>
          </div>
          <div>
            <div className="mb-1.5 text-xs text-ink-3">Так увидит клиент:</div>
            <div className="rounded-2xl rounded-tl-md bg-accent-soft px-4 py-3 text-sm leading-relaxed text-ink">{sample}</div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {text !== tpl.text && <Button variant="ghost" onClick={() => setText(tpl.text)}>Отменить правки</Button>}
          <Button variant="primary" disabled={text === tpl.text || !text.trim()} onClick={() => { saveTemplate({ ...tpl, text }); toast('Шаблон «' + tpl.title + '» сохранён'); }}>Сохранить шаблон</Button>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardTitle icon={Radio} tone="info">Каналы заявок</CardTitle>
          <div className="grid gap-1">
            {(Object.keys(CHANNEL_LABEL) as Channel[]).map(c => { const I = CHANNEL_ICON[c], on = s.channels[c]; return (
              <label key={c} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
                <I className="size-4 text-ink-2" aria-hidden />
                <span className="flex-1 text-sm font-medium">{CHANNEL_LABEL[c]}</span>
                <Toggle on={on} onChange={v => saveSettings({ channels: { ...s.channels, [c]: v } })} label={CHANNEL_LABEL[c]} />
              </label>
            ); })}
          </div>
          <p className="mt-3 flex gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-ink-2"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />WhatsApp в России заблокирован, поэтому в демо он выключен. Для школы в Казахстане включите его — кнопка «Написать» начнёт открывать WhatsApp с готовым текстом.</p>
        </Card>

        <Card>
          <CardTitle icon={Coins} tone="ok">Валюта</CardTitle>
          <Segmented value={s.currency} onChange={v => saveSettings({ currency: v })} options={[{ value: 'KZT', label: 'Тенге ₸' }, { value: 'RUB', label: 'Рубли ₽' }]} className="w-full" />
          <form className="mt-4 flex items-end gap-2" onSubmit={e => { e.preventDefault(); const v = parseFloat(rate.replace(',', '.')); if (v > 0) { saveSettings({ rubRate: v }); toast('Курс сохранён'); } }}>
            <label className="grid flex-1 gap-1.5"><span className="text-[13px] font-medium text-ink-2">Курс: 1 ₽ = … ₸</span><Input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value.replace(/[^\d.,]/g, ''))} className="tnum" /></label>
            <Button type="submit" disabled={parseFloat(rate.replace(',', '.')) === s.rubRate}>Сохранить</Button>
          </form>
          <p className="mt-3 text-xs text-ink-3">Все суммы хранятся в тенге; в рублях показываются по этому курсу.</p>
        </Card>
      </div>

      <Card>
        <CardTitle icon={SlidersHorizontal} tone="warn">Правила подсветки</CardTitle>
        <div className="grid gap-5 md:grid-cols-3">
          <Rule label="Заявка «горит», если без ответа дольше" value={s.slaHours} options={[1, 2, 4, 24]} fmt={v => v + ' ч'} onChange={v => saveSettings({ slaHours: v })} />
          <Rule label="Абонемент «заканчивается», если осталось" value={s.lowBalance} options={[1, 2, 3]} fmt={v => '≤ ' + v} onChange={v => saveSettings({ lowBalance: v })} />
          <Rule label="Длительность пробного урока" value={s.trialDuration} options={[30, 45, 60]} fmt={v => v + ' мин'} onChange={v => saveSettings({ trialDuration: v })} />
        </div>
      </Card>

      <Card>
        <CardTitle icon={ShieldCheck}>Роли и права</CardTitle>
        <div className="scroll-thin relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs text-ink-3"><th className="py-2 pr-3 font-medium">Раздел</th>{(['admin', 'manager', 'teacher', 'owner'] as const).map(r => <th key={r} className="px-2 py-2 text-center font-medium">{ROLE_LABEL[r]}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {(Object.keys(PAGE_TITLE) as Page[]).map(p => (
                <tr key={p}><td className="py-2.5 pr-3">{PAGE_TITLE[p]}</td>
                  {(['admin', 'manager', 'teacher', 'owner'] as const).map(r => { const on = ACCESS[r].includes(p); return (
                    <td key={r} className="px-2 py-2.5 text-center">{on ? <span className="inline-flex items-center gap-1 text-ok"><Check className="size-4" aria-hidden /><span className="sr-only">есть доступ</span>{r === 'teacher' && (p === 'schedule' || p === 'students') ? <span className="text-xs text-ink-3">свои</span> : null}</span> : <Minus className="mx-auto size-4 text-ink-3" aria-label="нет доступа" />}</td>
                  ); })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-3">Преподаватель видит только свои занятия и группы и может отмечать посещаемость. Владелец видит отчёты, оплаты и зарплаты, но не меняет данные. В демо роль переключается внизу меню.</p>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1"><div className="font-semibold">Демо-данные</div><p className="text-[13px] text-ink-2">Все ученики и заявки вымышлены и хранятся только в этом браузере. Каждый день данные собираются заново под текущую дату.</p></div>
          <Button variant="danger" icon={RotateCcw} onClick={() => { if (confirm('Вернуть исходные демо-данные? Ваши изменения пропадут.')) { resetDemo(); toast('Демо-данные восстановлены', { tone: 'info' }); } }}>Сбросить демо</Button>
        </div>
      </Card>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={e => { e.preventDefault(); onChange(!on); }}
      className={cx('relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150', on ? 'bg-accent' : 'bg-surface-3')}>
      <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-150', on ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
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
