import { CampaignError, MAX_CREATIVE_BODY_BYTES } from './rules';

export type FormPart = { name: string; filename?: string; data: Buffer };

export async function readBody(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new CampaignError(413, 'Превышен размер запроса.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export async function readJson(request: Request) {
  const body = await readBody(request, 65_536);
  if (body.length === 0) return {};
  try {
    const value = JSON.parse(body.toString('utf8')) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof CampaignError) throw error;
    throw new CampaignError(400, 'Некорректные данные.');
  }
}

export function parseMultipart(body: Buffer, contentType: string | null) {
  const match = /^multipart\/form-data\s*;\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType?.trim() ?? '');
  if (!match) throw new CampaignError(400, 'Ожидается форма с изображением.', 'image');
  const boundary = (match[1] ?? match[2]).trim();
  const marker = Buffer.from(`--${boundary}`);
  const parts: FormPart[] = [];
  let position = body.indexOf(marker);
  if (position < 0) throw new CampaignError(400, 'Форма повреждена.', 'image');
  while (position >= 0 && position < body.length) {
    let cursor = position + marker.length;
    if (body[cursor] === 45 && body[cursor + 1] === 45) break;
    if (body[cursor] === 13 && body[cursor + 1] === 10) cursor += 2;
    const next = body.indexOf(Buffer.from(`\r\n--${boundary}`), cursor);
    if (next < 0) throw new CampaignError(400, 'Форма повреждена.', 'image');
    const rawPart = body.subarray(cursor, next);
    const splitAt = rawPart.indexOf('\r\n\r\n');
    if (splitAt < 0) throw new CampaignError(400, 'Форма повреждена.', 'image');
    const headers = rawPart.subarray(0, splitAt).toString('utf8');
    const name = /name="([^"]*)"/.exec(headers)?.[1];
    if (!name) throw new CampaignError(400, 'Форма повреждена.', 'image');
    const filename = /filename="([^"]*)"/.exec(headers)?.[1];
    parts.push({ name, filename, data: rawPart.subarray(splitAt + 4) });
    position = next + 2;
  }
  return parts;
}

export async function readCreativeForm(request: Request) {
  const body = await readBody(request, MAX_CREATIVE_BODY_BYTES);
  const parts = parseMultipart(body, request.headers.get('content-type'));
  const seen = new Set<string>();
  let image: Buffer | undefined;
  let imageProvided = false;
  let clickUrl: string | undefined;
  let clickProvided = false;
  let name: string | undefined;
  let nameProvided = false;
  for (const part of parts) {
    if (!['image', 'click_url', 'name'].includes(part.name)) continue;
    if (seen.has(part.name)) throw new CampaignError(400, 'Поле формы повторяется.', part.name);
    seen.add(part.name);
    if (part.name === 'image') {
      imageProvided = true;
      image = part.data;
    } else if (part.name === 'click_url') {
      clickProvided = true;
      clickUrl = part.data.toString('utf8');
    } else {
      nameProvided = true;
      name = part.data.toString('utf8');
    }
  }
  return { image, imageProvided, clickUrl, clickProvided, name, nameProvided };
}
