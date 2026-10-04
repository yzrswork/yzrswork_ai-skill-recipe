import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { VISUAL_ASSETS, assetUrl, assetName } from '../js/assets.js';

function webpInfo(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP');
  assert.equal(buffer.readUInt32LE(4) + 8, buffer.length);
  let alpha = false, width = 0, height = 0;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const type = buffer.toString('ascii', offset, offset + 4), size = buffer.readUInt32LE(offset + 4), data = offset + 8;
    if (type === 'VP8X') {
      alpha = Boolean(buffer[data] & 0x10);
      width = 1 + buffer.readUIntLE(data + 4, 3); height = 1 + buffer.readUIntLE(data + 7, 3);
    } else if (type === 'VP8 ' && !width) {
      width = buffer.readUInt16LE(data + 6) & 0x3fff; height = buffer.readUInt16LE(data + 8) & 0x3fff;
    } else if (type === 'VP8L' && !width) {
      const bits = buffer.readUInt32LE(data + 1);
      width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1; alpha = Boolean((bits >>> 28) & 1);
    }
    offset = data + size + (size & 1);
  }
  return { alpha, width, height };
}
test('visual metadata has unique IDs, individual names, and real WebP files', async () => {
  assert.equal(VISUAL_ASSETS.length, 62, 'complete visual pass');
  assert.equal(new Set(VISUAL_ASSETS.map(asset => asset.id)).size, VISUAL_ASSETS.length);
  assert.equal(new Set(VISUAL_ASSETS.map(asset => asset.name)).size, VISUAL_ASSETS.length);
  const hashes = new Set();
  for (const asset of VISUAL_ASSETS) {
    assert.ok(asset.name && asset.kind);
    const data = await readFile(new URL(`../${assetUrl(asset.id)}`, import.meta.url));
    const info = webpInfo(data);
    assert.ok(info.width >= 400 && info.height >= 400, `${asset.id}: sufficient display resolution`);
    assert.ok(data.length < 1024 * 1024, `${asset.id}: mobile asset budget`);
    assert.equal(info.alpha, asset.kind !== 'background', `${asset.id}: alpha appropriate to asset kind`);
    const hash = createHash('sha256').update(data).digest('hex');
    assert.ok(!hashes.has(hash), `${asset.id}: no duplicated illustration`); hashes.add(hash);
    await stat(new URL(`../assets/${asset.id}.svg`, import.meta.url));
  }
});
test('the five priority bosses are raster sprites and preserve their game identifiers', () => {
  for (const id of ['boss-4','boss-3','boss-5','boss-9','boss-zero']) {
    assert.equal(VISUAL_ASSETS.find(asset => asset.id === id)?.kind, 'boss');
    assert.ok(assetUrl(id).endsWith('.webp'));
  }
});
test('presentation metadata keeps legacy SVG fallback and descriptive name fallback', () => {
  assert.equal(assetUrl('unlisted-asset'), 'assets/unlisted-asset.svg');
  assert.equal(assetName('unlisted-asset', '元の名前'), '元の名前');
  assert.equal(assetName('boss-4', '元の名前'), 'しさんゴーレム');
});
