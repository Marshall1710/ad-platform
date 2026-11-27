'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { COUNTRIES, PAYMENT_MODELS, TRAFFIC_CATEGORIES, CampaignError, parseBidUsd, type CampaignJson, type CampaignStatus } from '../lib/campaigns/rules';

export function CampaignEditor({ campaign, returnTo }: { campaign: CampaignJson; returnTo: string }) {
  const router = useRouter();
  const revision = JSON.stringify(campaign);
  const [category, setCategory] = useState(campaign.traffic_category ?? '');
  const [model, setModel] = useState(campaign.payment_model ?? '');
  const [bid, setBid] = useState(campaign.bid_usd ?? '');
  const [countries, setCountries] = useState(campaign.countries);
  const [devices, setDevices] = useState(campaign.devices);
  const [creativeName, setCreativeName] = useState(campaign.creative?.name ?? '');
  const [clickUrl, setClickUrl] = useState(campaign.creative?.click_url ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const active = campaign.status === 'active';

  useEffect(() => {
    const next = JSON.parse(revision) as CampaignJson;
    setCategory(next.traffic_category ?? '');
    setModel(next.payment_model ?? '');
    setBid(next.bid_usd ?? '');
    setCountries(next.countries);
    setDevices(next.devices);
    setCreativeName(next.creative?.name ?? '');
    setClickUrl(next.creative?.click_url ?? '');
    setFile(null);
  }, [revision]);

  function toggle(list: string[], value: string, update: (next: string[]) => void) {
    update(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    let bidValue: string | null;
    try {
      bidValue = bidForSubmit(campaign.status, bid);
    } catch (caught) {
      setError(caught instanceof CampaignError ? caught.message : 'Ставка указана неверно.');
      return;
    }
    await submit(`/api/campaigns/${campaign.campaign_id}`, 'PATCH', {
      traffic_category: category || null,
      payment_model: model || null,
      bid_usd: bidValue,
      countries,
      devices,
    }, 'Настройки сохранены.');
  }

  async function saveCreative(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const form = new FormData();
    form.set('name', creativeName);
    form.set('click_url', clickUrl);
    if (file) form.set('image', file);
    const creating = !campaign.creative;
    if (creating && !file) {
      setError('Нужно изображение JPEG или PNG 300×250.');
      return;
    }
    await send(`/api/campaigns/${campaign.campaign_id}/creative`, creating ? 'POST' : 'PATCH', form, 'Креатив сохранён.');
  }

  async function activate() {
    await submit(`/api/campaigns/${campaign.campaign_id}/activate`, 'POST', undefined, 'Кампания включена.');
  }

  async function pause() {
    await submit(`/api/campaigns/${campaign.campaign_id}/pause`, 'POST', undefined, 'Кампания поставлена на паузу.');
  }

  async function remove() {
    await send(`/api/campaigns/${campaign.campaign_id}`, 'DELETE', undefined, '', returnTo);
  }

  async function removeCreative() {
    await send(`/api/campaigns/${campaign.campaign_id}/creative`, 'DELETE', undefined, 'Креатив удалён.');
  }

  async function submit(url: string, method: string, body: object | undefined, success: string) {
    await send(url, method, body === undefined ? undefined : JSON.stringify(body), success, undefined, body !== undefined);
  }

  async function send(url: string, method: string, body: BodyInit | undefined, success: string, nextUrl?: string, jsonBody = false) {
    setPending(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: jsonBody ? { 'content-type': 'application/json' } : undefined,
        body,
      });
      if (response.status === 204) {
        if (nextUrl) {
          router.push(nextUrl);
          router.refresh();
        } else {
          setNotice(success);
          router.refresh();
        }
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof payload.message === 'string' ? payload.message : 'Действие не выполнено.');
        return;
      }
      setNotice(success);
      router.refresh();
    } catch {
      setError('Действие не выполнено.');
    } finally {
      setPending(false);
    }
  }

  return <>
    <form className="auth-form" onSubmit={saveSettings}>
      <label htmlFor="traffic-category">Категория трафика</label>
      <select id="traffic-category" value={category} disabled={active || pending} onChange={(event) => setCategory(event.target.value)}>
        <option value="">Не задано</option>
        {TRAFFIC_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <label htmlFor="payment-model">Модель оплаты</label>
      <select id="payment-model" value={model} disabled={active || pending} onChange={(event) => setModel(event.target.value)}>
        <option value="">Не задано</option>
        {PAYMENT_MODELS.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <label htmlFor="bid">Ставка, USD</label>
      <input id="bid" inputMode="decimal" value={bid} disabled={pending} onChange={(event) => setBid(event.target.value)} />
      <fieldset>
        <legend>Страны</legend>
        <div className="choice-grid">
          {COUNTRIES.map((code) => <label key={code}>
            <input type="checkbox" name="country" value={code} checked={countries.includes(code)} disabled={pending}
              onChange={() => toggle(countries, code, setCountries)} /> {code}
          </label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend>Устройства</legend>
        <div className="choice-grid">
          <label><input type="checkbox" name="device" value="desktop" checked={devices.includes('desktop')} disabled={pending} onChange={() => toggle(devices, 'desktop', setDevices)} /> Компьютер</label>
          <label><input type="checkbox" name="device" value="mobile" checked={devices.includes('mobile')} disabled={pending} onChange={() => toggle(devices, 'mobile', setDevices)} /> Телефон</label>
        </div>
      </fieldset>
      <p>Пустые списки не ограничивают страну или устройство.</p>
      <button type="submit" disabled={pending}>Сохранить настройки</button>
    </form>
    <form className="auth-form" onSubmit={saveCreative}>
      <h2>Креатив</h2>
      {campaign.creative && <img className="banner-preview" alt="Текущий креатив" src={`/api/campaigns/${campaign.campaign_id}/creative/image`} />}
      <label htmlFor="creative-name">Название креатива</label>
      <input id="creative-name" value={creativeName} disabled={active || pending} onChange={(event) => setCreativeName(event.target.value)} />
      <label htmlFor="click-url">Ссылка перехода</label>
      <input id="click-url" type="url" value={clickUrl} disabled={active || pending} onChange={(event) => setClickUrl(event.target.value)} />
      <label htmlFor="creative-image">Изображение</label>
      <input id="creative-image" key={revision} type="file" accept="image/jpeg,image/png" disabled={active || pending}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <div className="editor-actions">
        <button type="submit" disabled={active || pending}>{campaign.creative ? 'Заменить креатив' : 'Добавить креатив'}</button>
        {campaign.creative && <button type="button" className="secondary" disabled={active || pending} onClick={removeCreative}>Удалить креатив</button>}
      </div>
    </form>
    <div className="editor-actions">
      {campaign.status !== 'active' && <button type="button" disabled={pending} onClick={activate}>Включить</button>}
      {campaign.status === 'active' && <button type="button" className="secondary" disabled={pending} onClick={pause}>Поставить на паузу</button>}
      {campaign.status !== 'active' && <button type="button" className="danger" disabled={pending} onClick={remove}>Удалить кампанию</button>}
    </div>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </>;
}

function bidForSubmit(status: CampaignStatus, value: string) {
  if (value.trim() === '') {
    if (status === 'active') throw new CampaignError(400, 'У активной кампании нужна допустимая ставка.', 'bid_usd');
    return null;
  }
  parseBidUsd(value.trim());
  return value.trim();
}
