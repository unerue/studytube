"""
샘플 오디오 파일 생성 스크립트
사용법: python create_sample_audio.py
"""

import os
from gtts import gTTS
from pathlib import Path

def create_sample_audio():
    # static 폴더 생성
    static_dir = Path("static")
    static_dir.mkdir(exist_ok=True)
    
    # 여러 언어로 샘플 오디오 생성
    samples = {
        "en": "This is a sample audio file for StudyTube. It will be used when actual audio extraction is not possible.",
        "ko": "이것은 StudyTube의 샘플 오디오 파일입니다. 실제 오디오 추출이 불가능할 때 사용됩니다.",
        "ja": "これはStudyTubeのサンプルオーディオファイルです。実際のオーディオ抽出が不可能な場合に使用されます。",
        "fr": "Ceci est un échantillon de fichier audio pour StudyTube. Il sera utilisé lorsque l'extraction audio réelle n'est pas possible.",
        "de": "Dies ist eine Audio-Beispieldatei für StudyTube. Sie wird verwendet, wenn eine tatsächliche Audioextraktion nicht möglich ist.",
        "es": "Este es un archivo de audio de muestra para StudyTube. Se utilizará cuando la extracción de audio real no sea posible.",
        "ru": "Это образец аудиофайла для StudyTube. Он будет использоваться, когда фактическое извлечение аудио невозможно."
    }
    
    for lang_code, text in samples.items():
        output_path = static_dir / f"sample_{lang_code}.mp3"
        
        try:
            print(f"생성 중: {output_path}")
            tts = gTTS(text=text, lang=lang_code, slow=False)
            tts.save(str(output_path))
            print(f"생성 완료: {output_path}")
        except Exception as e:
            print(f"오류 발생 ({lang_code}): {str(e)}")
    
    # 기본 샘플 파일 복사 (영어 버전을 기본으로)
    en_sample = static_dir / "sample_en.mp3"
    default_sample = static_dir / "sample.mp3"
    
    if en_sample.exists() and not default_sample.exists():
        import shutil
        shutil.copy(str(en_sample), str(default_sample))
        print(f"기본 샘플 생성 완료: {default_sample}")

if __name__ == "__main__":
    print("샘플 오디오 생성 시작...")
    create_sample_audio()
    print("샘플 오디오 생성 완료!") 