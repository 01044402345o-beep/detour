# 대전 디투어 시연 영상 (T2.7 · Remotion)

세로 1080×1920 · 30fps · 약 89초. 한국어판(`DetourDemoKo`, 기본)과 영어판(`DetourDemoEn`) 두 가지입니다.
git에는 소스 코드와 자막만 올립니다(사용자 결정 U-2). 녹화 클립·내레이션 음성·렌더 결과·TTS 모델은 git에서 제외합니다.

## 만드는 순서

```sh
# 0) 의존성
npm ci

# 1) 녹화할 앱 커밋을 따로 꺼내 build → preview (작업 중인 app/은 건드리지 않음)
git archive <커밋> app | tar -x -C <임시폴더>
cd <임시폴더>/app && npm ci && npm run build && npx vite preview --port 4174 --strictPort

# 2) 장면 녹화(설치된 Edge, 390×844·DPR 2, 영어 UI) → 장면별 클립
npm run record -- --url http://localhost:4174/detour/ --commit <커밋>
npm run cut                   # public/clips/*.mp4, public/clips/clips.json

# 3) 내레이션 (영어 Kokoro 오프라인 · 한국어 edge-tts 온라인)
py -3.14 -m venv .tts/venv && .tts/venv/Scripts/python -m pip install kokoro-onnx soundfile edge-tts
#    .tts/model/ 에 kokoro-v1.0.onnx, voices-v1.0.bin (kokoro-onnx 릴리스 model-files-v1.0)
npm run vo                    # public/vo/en/*.wav, public/vo/ko/*.mp3

# 4) 장면 길이 계산 + SRT 자막
npm run timeline              # src/timeline.json, captions/*.srt

# 5) 렌더
npm run render:ko             # out/detour-demo-ko.mp4
npm run render:en             # out/detour-demo-en.mp4
```

내레이션 파일이 없으면 `timeline.json`의 `hasVo`가 false가 되고 자막만으로 렌더됩니다.

## 파일

| 경로 | 내용 |
|---|---|
| `src/narration.json` | 장면별 자막·내레이션 원문(한국어·영어), 장면 제목, 표기 배지 |
| `src/timeline.json` | 장면 시작·길이(생성 파일), 녹화 커밋 |
| `src/scenes/` | 문제 제기(일러스트) · 앱 클립 장면 · 마무리(QR·안내) |
| `scripts/record.mjs` · `speechMock.mjs` · `cut.mjs` | Playwright 녹화(음성 API 목, 탭 표시) · 장면별 클립 자르기 |
| `scripts/vo.py` | 내레이션 생성 |
| `captions/` | 한국어·영어 SRT |

## 표기 원칙 (PRD)

- 비제휴 안내: 성심당 장면(앱 안내문)과 마무리 화면
- 점수 이름은 '인식 일치도'(Recognition match), 발음 점수가 아님을 자막으로 안내
- 메뉴·가격은 '현장 확인 전 예시값', 운영자 리포트는 '예시 데이터' 배지
- 음성 인식 장면은 '재현 장면' 배지(녹화 시 Web Speech API 목 사용)
- 가게 로고·간판·실사 사진 미사용. 문제 제기 장면은 코드로 그린 일러스트

## 라이선스 메모

Remotion 라이선스 조건은 `reviews/T2.7_license.md`. edge-tts(Microsoft 온라인 음성) 이용 조건은 [사용자] 확인 항목입니다.
