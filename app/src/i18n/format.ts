/** 사전 값·한국어 고정 문구 공용: `{name}` 자리표시자 채우기와 개발 모드 경고 */

export type Params = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

export function devWarn(message: string): void {
  if (import.meta.env.DEV) console.warn(`[i18n] ${message}`);
}

/** 값 안의 `{name}` 자리표시자 이름 목록 */
export function placeholders(value: string): string[] {
  return [...value.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

/**
 * 자리표시자를 params로 채웁니다. params를 아예 생략해도 검사합니다(R1 L-1).
 * 빠진 이름은 자리표시자를 그대로 두고 개발 모드에서 이름마다 경고합니다.
 */
export function fillTemplate(template: string, params: Params | undefined, label: string): string {
  const p = params ?? {};
  return template.replace(PLACEHOLDER, (whole, name: string) => {
    if (Object.hasOwn(p, name)) return String(p[name]);
    devWarn(`missing param "${name}" for ${label}`);
    return whole;
  });
}
