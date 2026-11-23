"""T2.7 내레이션 생성 (사용자 결정 U-3).

- 영어: Kokoro v1.0 오프라인 TTS(kokoro-onnx), 음성 af_heart, 속도 0.95
  모델 파일: video/.tts/model/kokoro-v1.0.onnx, voices-v1.0.bin (git 제외)
- 한국어: edge-tts 온라인 음성 ko-KR-SunHiNeural (이용 조건은 [사용자] 확인 항목)
- 입력: src/narration.json / 출력: public/vo/en/<id>.wav, public/vo/ko/<id>.mp3 (git 제외)
- 기존 홍보영상(daejeon-detour-film/)의 build.sh 방식(영어 Kokoro·한국어 edge-tts)을 참고만 했고,
  그 파일·음성은 쓰지 않습니다.

사용: .tts/venv/Scripts/python scripts/vo.py [--only en|ko]
"""
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCENES = json.loads((ROOT / "src" / "narration.json").read_text(encoding="utf-8"))["scenes"]
OUT = ROOT / "public" / "vo"
only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None


def ascii_espeak():
    """espeak-ng는 한글이 든 경로(…/29_로컬/…)에서 데이터를 못 읽으므로 ASCII 임시 폴더로 복사해 씁니다."""
    import shutil
    import tempfile

    import espeakng_loader
    from kokoro_onnx.config import EspeakConfig

    src_data, src_lib = Path(espeakng_loader.get_data_path()), Path(espeakng_loader.get_library_path())
    if str(src_data).isascii():
        return None
    dst = Path(tempfile.gettempdir()) / "detour-espeak"
    if not (dst / "espeak-ng-data" / "phontab").exists():
        shutil.copytree(src_data, dst / "espeak-ng-data", dirs_exist_ok=True)
    shutil.copy2(src_lib, dst / src_lib.name)
    return EspeakConfig(lib_path=str(dst / src_lib.name), data_path=str(dst / "espeak-ng-data"))


def make_en() -> None:
    import soundfile as sf
    from kokoro_onnx import Kokoro

    model = ROOT / ".tts" / "model"
    kokoro = Kokoro(str(model / "kokoro-v1.0.onnx"), str(model / "voices-v1.0.bin"), espeak_config=ascii_espeak())
    (OUT / "en").mkdir(parents=True, exist_ok=True)
    for s in SCENES:
        samples, rate = kokoro.create(s.get("enTts", s["en"]), voice="af_heart", speed=0.95, lang="en-us")
        sf.write(OUT / "en" / f"{s['id']}.wav", samples, rate)
        print(f"en {s['id']}: {len(samples) / rate:.2f}s")


async def make_ko() -> None:
    import edge_tts

    (OUT / "ko").mkdir(parents=True, exist_ok=True)
    for s in SCENES:
        path = OUT / "ko" / f"{s['id']}.mp3"
        await edge_tts.Communicate(s["ko"], "ko-KR-SunHiNeural", rate="+0%").save(str(path))
        print(f"ko {s['id']}: {path.stat().st_size} bytes")


if only in (None, "en"):
    make_en()
if only in (None, "ko"):
    asyncio.run(make_ko())
