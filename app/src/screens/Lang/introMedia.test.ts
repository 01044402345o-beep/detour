import { loadIntroVideo, releaseIntroVideo, sceneAt } from './introMedia';

// 인트로 영상 불러오기 (T6.16 R1 L-02): fetch → blob URL, 실패는 모두 null
describe('introMedia', () => {
  const create = vi.fn((b: Blob) => `blob:${b.type}`);
  const revoke = vi.fn();
  // URL 정적 함수를 바꿨다가 원래 속성 그대로 되돌림 (R2 L-01: 다른 테스트에 모의 함수가 남지 않게)
  const keys = ['createObjectURL', 'revokeObjectURL'] as const;
  const orig = keys.map((k) => Object.getOwnPropertyDescriptor(URL, k));
  beforeEach(() => {
    create.mockClear();
    revoke.mockClear();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revoke });
  });
  afterEach(() => {
    keys.forEach((k, i) => {
      const d = orig[i];
      if (d) Object.defineProperty(URL, k, d);
      else delete (URL as unknown as Record<string, unknown>)[k];
    });
    vi.unstubAllGlobals();
  });

  it('테스트 뒤 URL 함수가 원래대로 (모의 함수가 남지 않음)', () => {
    // beforeEach가 바꾼 상태를 직접 되돌려 보고, afterEach와 같은 규칙인지 확인
    keys.forEach((k, i) => {
      const d = orig[i];
      if (d) Object.defineProperty(URL, k, d);
      else delete (URL as unknown as Record<string, unknown>)[k];
    });
    expect(URL.createObjectURL).not.toBe(create);
    expect((URL as unknown as Record<string, unknown>).revokeObjectURL).not.toBe(revoke);
  });

  const stubFetch = (impl: () => Promise<Partial<Response>>) => vi.stubGlobal('fetch', vi.fn(impl));

  it('정상: 영상 주소(BASE_URL 기준)를 받아 blob URL, 종류가 비면 video/mp4로 보정', async () => {
    const f = vi.fn(async () => ({ ok: true, blob: async () => new Blob([new Uint8Array([1, 2, 3])]) }));
    vi.stubGlobal('fetch', f);
    await expect(loadIntroVideo()).resolves.toBe('blob:video/mp4');
    expect(f).toHaveBeenCalledWith('/intro/intro.mp4');
  });

  it('정상: 종류가 있으면 그대로', async () => {
    stubFetch(async () => ({ ok: true, blob: async () => new Blob([new Uint8Array([1])], { type: 'video/mp4' }) }));
    await expect(loadIntroVideo()).resolves.toBe('blob:video/mp4');
  });

  it.each([
    ['응답 실패(404)', async () => ({ ok: false })],
    ['빈 파일', async () => ({ ok: true, blob: async () => new Blob([]) })],
    ['네트워크 오류(오프라인·캐시 없음)', async () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('%s → null', async (_n, impl) => {
    stubFetch(impl as () => Promise<Partial<Response>>);
    await expect(loadIntroVideo()).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('releaseIntroVideo: blob URL 해제, null은 아무것도 안 함', () => {
    releaseIntroVideo('blob:x');
    releaseIntroVideo(null);
    expect(revoke.mock.calls).toEqual([['blob:x']]);
  });

  it('sceneAt: 4.4초마다 장면, 13.2초 반복', () => {
    expect([0, 4.39, 4.4, 8.8, 13.19, 13.2, 17.7].map(sceneAt)).toEqual([0, 0, 1, 2, 2, 0, 1]);
  });
});
