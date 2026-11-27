import { crc32 } from 'node:zlib';
import sharp from 'sharp';
import { expect, test } from 'vitest';
import { validateCreativeImage } from './creative-image';
import { CampaignError, MAX_IMAGE_BYTES } from './rules';

async function banner(format: 'png' | 'jpeg' | 'gif', width = 300, height = 250) {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 20, g: 80, b: 160 } } });
  if (format === 'jpeg') return image.jpeg().toBuffer();
  if (format === 'gif') return image.gif().toBuffer();
  return image.png().toBuffer();
}

function padPng(png: Buffer, target: number) {
  const typeAt = png.lastIndexOf(Buffer.from('IEND'));
  const chunkStart = typeAt - 4;
  const data = Buffer.concat([Buffer.from('Comment\0'), Buffer.alloc(target - png.length - 12 - 'Comment\0'.length, 0x61)]);
  const type = Buffer.from('tEXt');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([png.subarray(0, chunkStart), length, type, data, checksum, png.subarray(chunkStart)]);
}

test('accepts a 300 by 250 jpeg or png, including a file of exactly 1 MiB', async () => {
  expect(await validateCreativeImage(await banner('png'))).toBe('image/png');
  expect(await validateCreativeImage(await banner('jpeg'))).toBe('image/jpeg');
  const exact = padPng(await banner('png'), MAX_IMAGE_BYTES);
  expect(exact).toHaveLength(MAX_IMAGE_BYTES);
  expect(await validateCreativeImage(exact)).toBe('image/png');
});

test('rejects a damaged file, another format, the wrong dimensions and a file above 1 MiB', async () => {
  const png = await banner('png');
  await expect(validateCreativeImage(png.subarray(0, Math.floor(png.length / 2)))).rejects.toBeInstanceOf(CampaignError);
  await expect(validateCreativeImage(await banner('gif'))).rejects.toMatchObject({ status: 400, field: 'image' });
  await expect(validateCreativeImage(await banner('png', 299, 250))).rejects.toMatchObject({ status: 400, field: 'image' });
  await expect(validateCreativeImage(Buffer.alloc(0))).rejects.toMatchObject({ status: 400, field: 'image' });
  await expect(validateCreativeImage(padPng(png, MAX_IMAGE_BYTES + 1))).rejects.toMatchObject({ status: 413, field: 'image' });
});
