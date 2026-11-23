import { canPersist } from './canPersist';

afterEach(() => vi.restoreAllMocks());

describe('canPersist — 영속 저장 가능 여부', () => {
  it('localStorage에 쓰고 지울 수 있으면 true, 탐지 key는 남기지 않음', () => {
    expect(canPersist()).toBe(true);
    expect(localStorage.length).toBe(0);
  });
  it('setItem이 예외를 던지면 false', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(canPersist()).toBe(false);
  });
  it('localStorage 접근 자체가 막히면 false', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(canPersist()).toBe(false);
  });
});
