/**
 * 영속 저장 가능 여부 (T3.1 R1 M-01). localStorage에 작은 탐지용 key를 썼다 지워 봅니다.
 * 접근 차단·쓰기 불가면 false → 업데이트 새로고침을 하지 않습니다(store가 메모리에만 저장 중).
 * 한계(T3.1 R2 판정, 수용): 작은 probe 쓰기 성공이 앱 스냅숏(detour-app) 저장 성공을 보장하지는
 * 않습니다(남은 용량이 probe보다 크고 스냅숏보다 작은 경우). 이벤트는 500건으로 제한되지만 제보 목록에는
 * 개수 상한이 없어 전체 저장량의 고정 상한은 보장하지 않습니다. 관리되는 시연 범위에서는 이 경우를
 * 알려진 제한으로 수용합니다(T3.1 R2·R3 판정). store는 건드리지 않고 sw/ 안에서만 판단합니다.
 */
const PROBE_KEY = '__detour_pwa_probe__';

export function canPersist(): boolean {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return false;
    ls.setItem(PROBE_KEY, '1');
    ls.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}
