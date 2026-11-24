import sharp from 'sharp';
import { BANNER_HEIGHT, BANNER_WIDTH, CampaignError, MAX_IMAGE_BYTES } from './rules';

const decodeOptions = { failOn: 'error' as const, limitInputPixels: 8_000_000, animated: false as const };

export async function validateCreativeImage(bytes: Buffer): Promise<'image/jpeg' | 'image/png'> {
  if (bytes.length === 0) throw imageError('Нужно изображение JPEG или PNG 300×250.');
  if (bytes.length > MAX_IMAGE_BYTES) throw new CampaignError(413, 'Изображение больше 1 МиБ.', 'image');
  try {
    const meta = await sharp(bytes, decodeOptions).metadata();
    await sharp(bytes, decodeOptions).raw().toBuffer();
    if ((meta.format !== 'jpeg' && meta.format !== 'png') || meta.width !== BANNER_WIDTH || meta.height !== BANNER_HEIGHT) {
      throw imageError('Нужно изображение JPEG или PNG 300×250.');
    }
    return meta.format === 'jpeg' ? 'image/jpeg' : 'image/png';
  } catch (error) {
    if (error instanceof CampaignError) throw error;
    throw imageError('Файл изображения повреждён или имеет неверный формат.');
  }
}

function imageError(message: string) {
  return new CampaignError(400, message, 'image');
}
