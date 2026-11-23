/** 홈 거점 카드 일러스트 (목업 artHub 그대로, 글자 없음·장식용) */
export type HubKind = 'down' | 'station' | 'yuseong';

export function HubArt({ kind }: { kind: HubKind }) {
  const common = {
    className: 'home-hub__art',
    viewBox: '0 0 236 120',
    preserveAspectRatio: 'xMidYMid slice',
    'aria-hidden': true,
    focusable: false,
  } as const;

  if (kind === 'down') {
    return (
      <svg {...common}>
        <rect width="236" height="120" fill="#f6dba9" />
        <rect y="88" width="236" height="32" fill="#e8c587" />
        <path d="M30 26h176l14 26H16z" fill="#ee6a3c" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M${44 + i * 34} 26h12l5 26h-18z`} fill="#fff3ea" />
        ))}
        <rect x="36" y="52" width="164" height="50" fill="#fff8ee" />
        <rect
          x="48"
          y="60"
          width="86"
          height="34"
          rx="6"
          fill="#fde9c8"
          stroke="#e1a95b"
          strokeWidth="3"
        />
        <ellipse cx="72" cy="77" rx="13" ry="8" fill="#c97b34" />
        <ellipse cx="104" cy="77" rx="13" ry="8" fill="#c97b34" />
        <rect x="152" y="60" width="34" height="42" fill="#8b5a33" />
      </svg>
    );
  }
  if (kind === 'station') {
    return (
      <svg {...common}>
        <rect width="236" height="120" fill="#dfece6" />
        <path d="M10 40q110-34 230 0" stroke="#3b4256" strokeWidth="8" fill="none" />
        <rect x="40" y="52" width="150" height="50" fill="#f2e9d8" />
        <rect x="58" y="62" width="40" height="26" fill="#8b5a33" />
        <rect x="120" y="62" width="30" height="40" fill="#6d4426" />
        <circle cx="28" cy="88" r="14" fill="#7da35a" />
        <rect y="100" width="236" height="20" fill="#cbbfa6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect width="236" height="120" fill="#d8efed" />
      <ellipse
        cx="118"
        cy="86"
        rx="80"
        ry="20"
        fill="#8fd1cb"
        stroke="#5a8f8a"
        strokeWidth="5"
      />
      {[90, 118, 146].map((x) => (
        <path
          key={x}
          d={`M${x} 58q-8-10 0-20t0-20`}
          stroke="#5a8f8a"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
