// @vitest-environment node
/** 사진 기록 검사 (DESIGN.md 5장, T6.0) */
import fs from 'node:fs';
import path from 'node:path';
import { getPlace } from './index';
import { creditsText } from './photoCredits';
import {
  LICENSE_URLS,
  PHOTOS,
  photoCreditParams,
  photoForArea,
  photoForPlace,
  photoUrl,
} from './photos';

const PUBLIC = path.join(process.cwd(), 'public');
const MAX_BYTES = 200 * 1024;

/** WebP 크기 읽기 (VP8 / VP8L / VP8X) */
function webpSize(buf: Buffer): [number, number] {
  expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
  expect(buf.toString('ascii', 8, 12)).toBe('WEBP');
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  const v = buf.readUInt32LE(21);
  return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1];
}

describe('photos.ts', () => {
  it('모든 항목에 필수 필드가 있고 id가 겹치지 않음', () => {
    expect(new Set(PHOTOS.map((p) => p.id)).size).toBe(PHOTOS.length);
    for (const p of PHOTOS) {
      for (const k of [
        'id',
        'file',
        'title',
        'author',
        'sourceUrl',
        'licenseId',
        'licenseUrl',
        'changes',
        'review',
      ] as const) {
        expect(String(p[k]).trim(), `${p.id}.${k}`).not.toBe('');
      }
      expect(p.placeId ?? p.areaId, `${p.id}: placeId 또는 areaId`).toBeTruthy();
      for (const lang of ['en', 'ja', 'zh'] as const) expect(p.alt[lang].trim()).not.toBe('');
      expect(p.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      if (p.year !== undefined) expect(p.year).toBeGreaterThan(1990);
    }
  });

  it('라이선스 URL이 licenseId와 맞음', () => {
    for (const p of PHOTOS) {
      expect(p.licenseUrl).toBe(LICENSE_URLS[p.licenseId]);
      const ver = /CC BY-SA (\d\.\d)/.exec(p.licenseId)![1];
      expect(p.licenseUrl).toBe(`https://creativecommons.org/licenses/by-sa/${ver}/`);
    }
  });

  it('파일이 public/photos에 있고 WebP·긴 변 ≤1200px·≤200KB', () => {
    for (const p of PHOTOS) {
      expect(p.file).toMatch(/^photos\/[a-z0-9-]+\.webp$/);
      const f = path.join(PUBLIC, p.file);
      expect(fs.existsSync(f), f).toBe(true);
      const buf = fs.readFileSync(f);
      expect(buf.length, p.file).toBeLessThanOrEqual(MAX_BYTES);
      expect(Math.max(...webpSize(buf)), p.file).toBeLessThanOrEqual(1200);
    }
  });

  it('public/photos의 사진은 모두 기록돼 있고, 기록된 사진은 모두 파일이 있음', () => {
    const shipped = fs.readdirSync(path.join(PUBLIC, 'photos')).filter((f) => f.endsWith('.webp'));
    expect(shipped.sort()).toEqual(PHOTOS.map((p) => p.file.replace('photos/', '')).sort());
  });

  it('얼굴 흐림 사진: changes에 흐림·리사이즈·WebP·간판 그대로, review에 사용자 결정', () => {
    for (const id of ['sungsimdang', 'euneungjeongi', 'yuseong-footbath']) {
      const p = PHOTOS.find((x) => x.id === id)!;
      expect(p.changes).toMatch(/faces of identifiable people blurred/);
      expect(p.changes).toMatch(/1200px/);
      expect(p.changes).toMatch(/WebP/);
      expect(p.changes).toMatch(/signage unchanged/);
      expect(p.review).toMatch(/User decision 2026-11-26/);
    }
    for (const id of ['chungnam-office', 'daejeon-station', 'jungang-market']) {
      expect(PHOTOS.find((x) => x.id === id)!.changes).not.toMatch(/blur/);
    }
  });

  it('CREDITS.txt = photos.ts에서 만든 내용 (review·alt 3개 언어·같은 라이선스 공유 포함)', () => {
    const file = path.join(PUBLIC, 'photos/CREDITS.txt');
    const want = creditsText();
    if (process.env.UPDATE_PHOTO_CREDITS === '1')
      fs.writeFileSync(file, want.replace(/\n/g, '\r\n'));
    const txt = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    expect(
      txt,
      'UPDATE_PHOTO_CREDITS=1 npx vitest run src/data/photos.test.ts 로 다시 만드세요',
    ).toBe(want);
    expect(txt).toMatch(/apply ONLY to the photo files/);
    expect(txt).toMatch(/shared under the same license/);
    for (const p of PHOTOS) {
      for (const v of [
        p.title,
        p.author,
        p.sourceUrl,
        p.licenseId,
        p.licenseUrl,
        p.changes,
        p.review,
        p.alt.en,
        p.alt.ja,
        p.alt.zh,
      ]) {
        expect(txt, `${p.id}: ${v}`).toContain(v);
      }
      if (p.notice) expect(txt).toContain(p.notice);
    }
  });

  it('장소·권역 조회, 장소 id는 실제 데이터에 있음', () => {
    expect(photoForPlace('mus')?.id).toBe('chungnam-office');
    expect(photoForPlace('djs')?.id).toBe('daejeon-station');
    expect(photoForArea('station')?.id).toBe('jungang-market');
    expect(photoForPlace('ssd')?.id).toBe('sungsimdang');
    expect(photoForPlace('eun')?.id).toBe('euneungjeongi');
    expect(photoForArea('downtown')?.id).toBe('euneungjeongi');
    expect(photoForArea('yuseong')?.id).toBe('yuseong-footbath');
    // 사진 없는 장소 → 글자 타일
    expect(photoForPlace('gwc')).toBeUndefined();
    expect(photoForPlace('nope')).toBeUndefined();
    for (const p of PHOTOS)
      if (p.placeId && p.placeId !== 'djs') expect(getPlace(p.placeId)).toBeDefined();
  });

  it('URL은 BASE_URL을 붙이고, 짧은 출처 값은 저작자·라이선스', () => {
    const p = PHOTOS[0];
    expect(photoUrl(p)).toBe(`${import.meta.env.BASE_URL}${p.file}`);
    expect(photoCreditParams(p)).toEqual({ author: p.author, license: p.licenseId });
  });
});
