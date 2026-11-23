/**
 * 장소·메뉴 일러스트 (목업 artPlace·artMenu를 옮김). 실제 로고·간판·사진은 쓰지 않습니다(PRD 10장).
 * 장식용이라 aria-hidden.
 */
import type { JSX } from 'react';

const H = 236;

function Bakery() {
  const breads: [number, number][] = [
    [100, 150],
    [148, 145],
    [196, 152],
    [118, 182],
    [170, 184],
  ];
  return (
    <>
      <rect width="390" height={H} fill="#f6dba9" />
      <rect y={H - 70} width="390" height="70" fill="#e8c587" />
      <path d="M40 52h310l22 44H18z" fill="#ee6a3c" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path key={i} d={`M${56 + i * 44} 52h18l8 44h-26z`} fill="#fff3ea" opacity=".9" />
      ))}
      <rect x="50" y="96" width="290" height={H - 120} fill="#fff8ee" />
      <rect
        x="72"
        y="118"
        width="150"
        height={H - 160}
        rx="10"
        fill="#fde9c8"
        stroke="#e1a95b"
        strokeWidth="4"
      />
      {breads.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <ellipse cx={x} cy={y} rx="24" ry="15" fill="#c97b34" />
          <path
            d={`M${x - 10} ${y - 3}l8 5M${x + 2} ${y - 5}l8 5`}
            stroke="#f6d39f"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      ))}
      <rect x="252" y="118" width="64" height={H - 122} fill="#8b5a33" />
      <rect x="248" y="112" width="72" height="8" fill="#6d4426" />
      <circle cx="302" cy={H / 2 + 30} r="4" fill="#f2b33d" />
    </>
  );
}

function SkyRoad() {
  const colors = ['#f2b33d', '#ee6a3c', '#7ee0d7', '#fff'];
  return (
    <>
      <defs>
        <linearGradient id="place-art-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a2160" />
          <stop offset="1" stopColor="#6b4fc6" />
        </linearGradient>
      </defs>
      <rect width="390" height={H} fill="url(#place-art-sky)" />
      <path d="M-10 90 Q195 20 400 90 L400 120 Q195 52 -10 120z" fill="#1a1540" />
      {Array.from({ length: 22 }, (_, i) => (
        <circle
          key={i}
          cx={10 + i * 18}
          cy={92 - Math.sin((i / 21) * Math.PI) * 52}
          r="4"
          fill={colors[i % 4]}
        />
      ))}
      <rect x="20" y="130" width="70" height={H - 130} fill="#3b2f7a" />
      <rect x="300" y="120" width="80" height={H - 120} fill="#3b2f7a" />
      <rect x="0" y={H - 40} width="390" height="40" fill="#241c52" />
      {[40, 60, 320, 345].map((x) => (
        <rect key={x} x={x} y="150" width="12" height="16" rx="2" fill="#f2b33d" opacity=".8" />
      ))}
    </>
  );
}

function Hall() {
  return (
    <>
      <rect width="390" height={H} fill="#dde8ee" />
      <rect y={H - 50} width="390" height="50" fill="#c9c2b0" />
      <rect x="60" y="80" width="270" height={H - 130} fill="#e9dcc3" />
      <rect x="150" y="56" width="90" height={H - 106} fill="#e2d0ae" />
      <path d="M150 56l45-26 45 26z" fill="#7a5a3a" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} fill="#7b8da3">
          <rect x={74 + i * 42} y="100" width="22" height="34" rx="2" />
          <rect x={74 + i * 42} y="150" width="22" height="34" rx="2" />
        </g>
      ))}
      <rect x="178" y={H - 100} width="34" height="50" rx="4" fill="#6d4426" />
      <circle cx="34" cy={H - 62} r="22" fill="#7da35a" />
      <circle cx="356" cy={H - 62} r="22" fill="#7da35a" />
    </>
  );
}

function Pan() {
  const pieces: [number, number][] = [
    [165, 120],
    [215, 110],
    [190, 150],
    [235, 150],
    [160, 165],
    [210, 180],
  ];
  return (
    <>
      <rect width="390" height={H} fill="#fbe0cf" />
      <circle cx="195" cy={H / 2 + 20} r="96" fill="#2b2b2b" />
      <circle cx="195" cy={H / 2 + 20} r="84" fill="#d9472b" />
      {pieces.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x - 14}
          y={y - 10}
          width="28"
          height="20"
          rx="4"
          fill="#fff4e6"
          transform={`rotate(${(x % 30) - 15} ${x} ${y})`}
        />
      ))}
      <path
        d={`M140 ${H / 2 + 40}q30-20 55 0t55 0`}
        stroke="#f6efd9"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M150 ${H / 2 + 55}q25-16 45 0t45 0`}
        stroke="#f6efd9"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="120" cy={H / 2 - 30} r="5" fill="#7da35a" />
      <circle cx="260" cy={H / 2 - 10} r="5" fill="#7da35a" />
    </>
  );
}

const PLACE_ART: Record<string, () => JSX.Element> = {
  ssd: Bakery,
  eun: SkyRoad,
  mus: Hall,
  gwc: Pan,
};

export function PlaceArt({ placeId, category }: { placeId: string; category: 'food' | 'sight' }) {
  const Art = PLACE_ART[placeId] ?? (category === 'food' ? Pan : Hall);
  return (
    <svg
      className="place-art"
      viewBox={`0 0 390 ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <Art />
    </svg>
  );
}

/** 메뉴별 일러스트 색 [바탕, 그림] (목업 menu.c) */
const MENU_COLORS: Record<string, [string, string]> = {
  tw: ['#f6d9a8', '#c97b34'],
  bu: ['#e3efd2', '#6f9a3c'],
  mr: ['#fbe1d6', '#d8714f'],
  bm: ['#f3e7cf', '#a8803f'],
  dt: ['#fbd9c9', '#d9472b'],
  od: ['#fde2d2', '#c2502f'],
  sr: ['#f6efd9', '#b99a52'],
  gb: ['#f4f1ea', '#9aa0b0'],
};

export function MenuArt({ menuId, size = 62 }: { menuId: string; size?: number }) {
  const [bg, fg] = MENU_COLORS[menuId] ?? ['#f3e7cf', '#a8803f'];
  const icon = Math.round(size * 0.7);
  return (
    <span
      className="menu-art"
      style={{ background: bg, width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={icon} height={icon} viewBox="0 0 44 44" focusable="false">
        <ellipse cx="22" cy="24" rx="17" ry="12" fill={fg} />
        <path
          d="M13 21l6 4M21 18l6 4M28 22l4 3"
          stroke={bg}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
