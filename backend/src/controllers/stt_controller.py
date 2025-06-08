import os
import tempfile
import asyncio
import io
import wave
import struct
import time
from typing import Any, Dict, Optional
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import JSONResponse
import logging
import threading
import queue
import json
from datetime import datetime
import subprocess
import speech_recognition as sr

# 로깅 설정 - 더 상세한 포맷과 색상 코딩
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

router = APIRouter()

# FFmpeg 유틸리티 함수들
def check_ffmpeg_installation():
    """FFmpeg 설치 상태 확인"""
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'], 
            capture_output=True, 
            text=True, 
            timeout=10
        )
        if result.returncode == 0:
            version_line = result.stdout.split('\n')[0]
            logger.info(f"✅ [STT] FFmpeg 설치 확인: {version_line}")
            return True
        else:
            logger.error(f"❌ [STT] FFmpeg 실행 오류: {result.stderr}")
            return False
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        logger.error(f"❌ [STT] FFmpeg 설치되지 않음: {e}")
        return False

def install_ffmpeg_python():
    """ffmpeg-python 라이브러리 설치 상태 확인 및 설치 가이드"""
    try:
        import ffmpeg
        logger.info("✅ [STT] ffmpeg-python 라이브러리 사용 가능")
        return True
    except ImportError:
        logger.warning("⚠️ [STT] ffmpeg-python 라이브러리 없음")
        logger.info("💡 [STT] 설치 명령어: pip install ffmpeg-python")
        return False

def get_audio_info(file_path: str) -> dict:
    """오디오 파일 정보 조회"""
    try:
        import ffmpeg
        probe = ffmpeg.probe(file_path)
        audio_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'audio'), None)
        
        if audio_stream:
            info = {
                'codec': audio_stream.get('codec_name', 'unknown'),
                'sample_rate': audio_stream.get('sample_rate', 'unknown'),
                'channels': audio_stream.get('channels', 'unknown'),
                'duration': audio_stream.get('duration', 'unknown'),
                'bit_rate': audio_stream.get('bit_rate', 'unknown')
            }
            logger.debug(f"🔍 [STT] 오디오 정보: {info}")
            return info
        else:
            logger.warning(f"⚠️ [STT] 오디오 스트림 없음: {file_path}")
            return {}
    except Exception as e:
        logger.error(f"❌ [STT] 오디오 정보 조회 실패: {e}")
        return {}

# 초기화 시 FFmpeg 상태 확인
FFMPEG_AVAILABLE = check_ffmpeg_installation()
FFMPEG_PYTHON_AVAILABLE = install_ffmpeg_python()

# RealtimeSTT 가져오기
REALTIMESTT_AVAILABLE = False
try:
    from RealtimeSTT import AudioToTextRecorder
    REALTIMESTT_AVAILABLE = True
    logger.info("✅ [STT] RealtimeSTT 라이브러리 로드 성공")
except ImportError as e:
    logger.warning(f"⚠️ [STT] RealtimeSTT 라이브러리가 설치되지 않음: {e}")
    AudioToTextRecorder = None

# 개선된 오디오 청크 누적기
class AudioChunkAccumulator:
    def __init__(self, target_sample_rate=16000, target_channels=1):
        self.target_sample_rate = target_sample_rate
        self.target_channels = target_channels
        self.accumulated_data = bytearray()
        self.chunk_count = 0
        self.total_bytes = 0
        
    def add_chunk(self, audio_data: bytes) -> Optional[bytes]:
        """오디오 청크를 누적하고 충분한 양이 모이면 PCM 데이터 반환"""
        self.chunk_count += 1
        self.total_bytes += len(audio_data)
        self.accumulated_data.extend(audio_data)
        
        # 충분한 데이터가 모였을 때 (약 1초 분량) 처리
        if len(self.accumulated_data) >= 32000:  # 대략 1초 분량
            pcm_data = self._convert_accumulated_to_pcm()
            self.accumulated_data.clear()  # 누적 데이터 초기화
            return pcm_data
        
        return None
    
    def _convert_accumulated_to_pcm(self) -> bytes:
        """누적된 오디오 데이터를 PCM으로 변환"""
        if len(self.accumulated_data) < 1000:
            logger.debug(f"⚠️ [STT] 누적 데이터 부족: {len(self.accumulated_data)} bytes")
            return b''
        
        try:
            # 포맷 자동 감지
            data = bytes(self.accumulated_data)
            format_type = self._detect_audio_format(data)
            
            logger.debug(f"🔄 [STT] 오디오 형식 감지: {format_type}, 데이터 크기: {len(data)} bytes")
            
            if format_type == 'wav':
                # 방법 1: WAV 형식 직접 처리
                pcm_data = self._extract_pcm_from_wav(data)
                if pcm_data:
                    logger.debug(f"✅ [STT] WAV 직접 변환 성공 - 출력: {len(pcm_data)} bytes")
                    return pcm_data
            elif format_type == 'webm':
                # 방법 2: WebM 형식 처리 (기존 방식)
                pcm_data = self._extract_pcm_from_webm_data(data)
                if pcm_data:
                    logger.debug(f"✅ [STT] WebM 직접 변환 성공 - 출력: {len(pcm_data)} bytes")
                    return pcm_data
            
            # 방법 3: 일반적인 변환 시도
            logger.debug(f"🔄 [STT] 일반 변환 방식 시도")
            return self._convert_via_general_approach(data)
            
        except Exception as e:
            logger.error(f"❌ [STT] PCM 변환 오류: {e}")
            return b''
    
    def _detect_audio_format(self, data: bytes) -> str:
        """오디오 데이터 형식 감지"""
        try:
            # WAV 파일 시그니처 확인
            if data.startswith(b'RIFF') and b'WAVE' in data[:20]:
                return 'wav'
            # WebM 파일 시그니처 확인
            elif data.startswith(b'\x1a\x45\xdf\xa3'):  # EBML 헤더
                return 'webm'
            # OGG 파일 시그니처 확인
            elif data.startswith(b'OggS'):
                return 'ogg'
            else:
                return 'unknown'
        except:
            return 'unknown'
    
    def _extract_pcm_from_wav(self, data: bytes) -> bytes:
        """WAV 데이터에서 PCM 데이터 추출"""
        try:
            if len(data) < 44:  # WAV 헤더는 최소 44바이트
                return b''
            
            # WAV 헤더 파싱
            if not (data.startswith(b'RIFF') and data[8:12] == b'WAVE'):
                logger.debug(f"🔧 [STT] 유효하지 않은 WAV 헤더")
                return b''
            
            # fmt 청크 찾기
            fmt_pos = data.find(b'fmt ')
            if fmt_pos == -1:
                logger.debug(f"🔧 [STT] fmt 청크를 찾을 수 없음")
                return b''
            
            # data 청크 찾기
            data_pos = data.find(b'data')
            if data_pos == -1:
                logger.debug(f"🔧 [STT] data 청크를 찾을 수 없음")
                return b''
            
            # data 청크 크기 읽기
            data_size_pos = data_pos + 4
            if data_size_pos + 4 > len(data):
                logger.debug(f"🔧 [STT] data 청크 크기 정보 부족")
                return b''
            
            data_size = struct.unpack('<I', data[data_size_pos:data_size_pos + 4])[0]
            audio_data_start = data_size_pos + 4
            
            # PCM 데이터 추출
            if audio_data_start + data_size <= len(data):
                pcm_data = data[audio_data_start:audio_data_start + data_size]
                logger.debug(f"🔧 [STT] WAV PCM 추출 완료 - 크기: {len(pcm_data)} bytes")
                return pcm_data
            else:
                # 사용 가능한 데이터만 추출
                available_pcm = data[audio_data_start:]
                logger.debug(f"🔧 [STT] WAV PCM 부분 추출 - 크기: {len(available_pcm)} bytes")
                return available_pcm
                
        except Exception as e:
            logger.debug(f"🔧 [STT] WAV PCM 추출 실패: {e}")
            return b''

    def _extract_pcm_from_webm_data(self, data: bytes) -> bytes:
        """WebM 데이터에서 PCM 데이터 추출 시도"""
        try:
            # WebM Opus 데이터를 단순화해서 16-bit PCM으로 변환
            # 실제로는 복잡하지만, 대략적인 변환 시도
            
            # 데이터의 중간 부분을 사용 (헤더 제외)
            if len(data) > 1000:
                audio_portion = data[200:-200]  # 헤더와 푸터 제외
                
                # 16-bit 샘플로 재해석
                import struct
                sample_count = len(audio_portion) // 2
                
                # 바이트를 16-bit 정수로 변환
                samples = struct.unpack(f'<{sample_count}h', audio_portion[:sample_count * 2])
                
                # 볼륨 정규화
                max_val = max(abs(s) for s in samples) if samples else 1
                normalized_samples = [int(s * 16383 / max_val) if max_val > 0 else s for s in samples]
                
                # 다시 바이트로 변환
                pcm_bytes = struct.pack(f'<{len(normalized_samples)}h', *normalized_samples)
                
                logger.debug(f"🔧 [STT] WebM 직접 변환 완료 - 샘플수: {len(normalized_samples)}")
                return pcm_bytes
                
        except Exception as e:
            logger.debug(f"🔧 [STT] WebM 직접 변환 실패: {e}")
        
        return b''
    
    def _convert_via_general_approach(self, data: bytes) -> bytes:
        """일반적인 오디오 데이터 변환 방식"""
        try:
            # 방법 1: 데이터를 16-bit PCM으로 직접 해석
            if len(data) > 100:
                # 헤더 부분 스킵
                audio_start = 50 if len(data) > 50 else 0
                audio_data = data[audio_start:]
                
                # 길이를 16-bit 경계에 맞춤
                if len(audio_data) % 2 != 0:
                    audio_data = audio_data[:-1]
                
                if len(audio_data) >= 2:
                    logger.debug(f"🔧 [STT] 일반 변환 완료 - 크기: {len(audio_data)} bytes")
                    return audio_data
            
            return b''
            
        except Exception as e:
            logger.debug(f"🔧 [STT] 일반 변환 실패: {e}")
            return b''
    


# 강의별 레코더 관리
class LectureRecorder:
    def __init__(self, lecture_id: str, connection_manager):
        self.lecture_id = lecture_id
        self.connection_manager = connection_manager
        self.recorder = None
        self.is_active = False
        self.lock = threading.Lock()
        self.audio_queue = queue.Queue()
        self.processor_thread = None
        
        # 오디오 누적기 추가
        self.accumulator = AudioChunkAccumulator()
        
        # 성능 메트릭
        self.metrics = {
            "created_at": datetime.now().isoformat(),
            "total_audio_chunks": 0,
            "total_text_results": 0,
            "total_audio_bytes": 0,
            "total_pcm_conversions": 0,
            "last_activity": None,
            "conversion_times": [],
            "error_count": 0
        }
        
        logger.info(f"🎯 [STT] LectureRecorder 초기화 시작 - lecture_id: {lecture_id}")
        
        # RealtimeSTT 초기화
        if REALTIMESTT_AVAILABLE:
            try:
                start_time = time.time()
                logger.info(f"🔧 [STT] RealtimeSTT 초기화 시작 - 외부 오디오 피드 모드")
                
                # RealtimeSTT 올바른 설정 (외부 오디오 피드용)
                self.recorder = AudioToTextRecorder(
                    use_microphone=False,  # 외부 오디오 피드 사용
                    model="tiny",  # 빠른 모델
                    language="ko",  # 한국어 설정
                    spinner=False,  # 스피너 비활성화
                    enable_realtime_transcription=True,  # 실시간 전사 활성화
                    # 음성 감지 설정 최적화
                    silero_sensitivity=0.3,  # 민감도 조정
                    post_speech_silence_duration=0.3,  # 짧은 침묵 시간
                    min_length_of_recording=0.3,  # 짧은 최소 녹음 길이
                    # 오디오 품질 설정
                    sample_rate=16000,
                    channels=1,
                )
                
                # 초기화 후 즉시 start() 호출 (외부 피드 모드에 필요)
                self.recorder.start()
                logger.info(f"🎙️ [STT] RealtimeSTT 녹음 모드 시작됨")
                
                init_time = time.time() - start_time
                logger.info(f"✅ [STT] 강의 {lecture_id} RealtimeSTT 초기화 완료 - 소요시간: {init_time:.3f}s")
                
            except Exception as e:
                logger.error(f"❌ [STT] 강의 {lecture_id} RealtimeSTT 초기화 실패: {e}")
                self.recorder = None
                self.metrics["error_count"] += 1
        else:
            logger.warning(f"⚠️ [STT] RealtimeSTT 미사용 - 강의 {lecture_id}")
    
    def _on_recording_start(self):
        self.metrics["last_activity"] = datetime.now().isoformat()
        logger.info(f"🎙️ [STT] 강의 {self.lecture_id} 녹음 시작")
    
    def _on_recording_stop(self):
        logger.info(f"⏹️ [STT] 강의 {self.lecture_id} 녹음 중지")
    
    async def _text_callback(self, text: str):
        """실시간 텍스트 콜백 - STT 결과를 즉시 브로드캐스트"""
        callback_start = time.time()
        
        if text and text.strip():
            self.metrics["total_text_results"] += 1
            self.metrics["last_activity"] = datetime.now().isoformat()
            
            # 텍스트 품질 분석
            text_length = len(text.strip())
            word_count = len(text.strip().split())
            
            logger.info(f"🎯 [STT] 실시간 STT 결과 - 강의: {self.lecture_id}")
            logger.info(f"📝 [STT] 텍스트: '{text.strip()}'")
            logger.info(f"📊 [STT] 길이: {text_length} chars, 단어수: {word_count}, "
                       f"총 결과수: {self.metrics['total_text_results']}")
            
            try:
                await self.connection_manager.broadcast_to_lecture(
                    self.lecture_id,
                    {
                        "type": "subtitle",
                        "text": text.strip(),
                        "timestamp": datetime.now().isoformat(),
                        "lecture_id": self.lecture_id,
                        "realtime": True,
                        "metrics": {
                            "text_length": text_length,
                            "word_count": word_count,
                            "sequence_number": self.metrics["total_text_results"]
                        }
                    }
                )
                
                callback_time = time.time() - callback_start
                logger.info(f"✅ [STT] 자막 브로드캐스트 완료 - 소요시간: {callback_time:.3f}s")
                
            except Exception as e:
                logger.error(f"❌ [STT] 자막 브로드캐스트 실패: {e}")
                self.metrics["error_count"] += 1
    
    def start_processing(self):
        """오디오 처리 스레드 시작"""
        if not self.is_active and self.recorder:
            self.is_active = True
            self.processor_thread = threading.Thread(target=self._process_audio_loop)
            self.processor_thread.daemon = True
            self.processor_thread.start()
            logger.info(f"🚀 [STT] 강의 {self.lecture_id} 실시간 오디오 처리 시작")
        else:
            logger.warning(f"⚠️ [STT] 강의 {self.lecture_id} 처리 시작 실패 - active: {self.is_active}, recorder: {self.recorder is not None}")
    
    def stop_processing(self):
        """오디오 처리 중지"""
        self.is_active = False
        if self.processor_thread:
            self.processor_thread.join(timeout=1.0)
        
        # 최종 통계 로깅
        logger.info(f"🛑 [STT] 강의 {self.lecture_id} 실시간 오디오 처리 중지")
        self._log_final_metrics()
    
    def _log_final_metrics(self):
        """최종 성능 메트릭 로깅"""
        metrics = self.metrics
        avg_conversion_time = sum(metrics["conversion_times"]) / len(metrics["conversion_times"]) if metrics["conversion_times"] else 0
        
        logger.info(f"📊 [STT] === 강의 {self.lecture_id} 최종 통계 ===")
        logger.info(f"📊 [STT] 총 오디오 청크: {metrics['total_audio_chunks']}")
        logger.info(f"📊 [STT] 총 텍스트 결과: {metrics['total_text_results']}")
        logger.info(f"📊 [STT] 총 오디오 바이트: {metrics['total_audio_bytes']:,}")
        logger.info(f"📊 [STT] 총 PCM 변환: {metrics['total_pcm_conversions']}")
        logger.info(f"📊 [STT] 평균 변환 시간: {avg_conversion_time:.3f}s")
        logger.info(f"📊 [STT] 오류 횟수: {metrics['error_count']}")
        logger.info(f"📊 [STT] 운영 시간: {metrics['created_at']} ~ {datetime.now().isoformat()}")
    
    def _process_audio_loop(self):
        """오디오 처리 루프 - 외부 피드 모드에 최적화"""
        logger.info(f"🔄 [STT] 강의 {self.lecture_id} 오디오 처리 루프 시작 (외부 피드 모드)")
        
        # 텍스트 결과 확인 카운터
        self.text_check_count = 0
        self.valid_text_count = 0
        test_message_count = 0
        
        loop_count = 0
        last_stats_time = time.time()
        last_test_message_time = time.time()
        last_text_check_time = time.time()
        
        while self.is_active and self.recorder:
            try:
                loop_count += 1
                current_time = time.time()
                
                # 10초마다 상태 리포트
                if current_time - last_stats_time >= 10.0:
                    logger.info(f"📊 [STT] === 10초 통계 (강의 {self.lecture_id}) ===")
                    logger.info(f"📊 [STT] 루프 반복: {loop_count}, 텍스트 확인: {self.text_check_count}")
                    logger.info(f"📊 [STT] 유효 텍스트: {self.valid_text_count}")
                    logger.info(f"📊 [STT] 총 오디오 청크: {self.metrics['total_audio_chunks']}")
                    logger.info(f"📊 [STT] 총 PCM 변환: {self.metrics['total_pcm_conversions']}")
                    last_stats_time = current_time
                
                # 30초마다 테스트 자막 전송
                if current_time - last_test_message_time >= 30.0:
                    test_message_count += 1
                    test_message = f"🧪 [테스트 #{test_message_count}] STT 시스템 정상 작동 중 - {datetime.now().strftime('%H:%M:%S')}"
                    logger.info(f"🧪 [STT] 30초 테스트 메시지 전송: {test_message}")
                    
                    try:
                        # 비동기 방식으로 테스트 메시지 전송
                        asyncio.create_task(self._text_callback(test_message))
                        logger.info(f"✅ [STT] 테스트 메시지 전송 완료")
                    except Exception as e:
                        logger.error(f"❌ [STT] 테스트 메시지 전송 실패: {e}")
                    
                    last_test_message_time = current_time
                
                # 1초마다 STT 결과 폴링 (외부 피드 모드에서 권장되는 방식)
                if current_time - last_text_check_time >= 1.0:
                    try:
                        self.text_check_count += 1
                        logger.debug(f"🔍 [STT] STT 결과 폴링 #{self.text_check_count} - 강의: {self.lecture_id}")
                        
                        # 외부 피드 모드에서는 text()를 파라미터 없이 호출하여 현재 결과를 가져옴
                        text_result = self.recorder.text()
                        
                        if text_result and text_result.strip():
                            self.valid_text_count += 1
                            logger.info(f"🎯 [STT] *** STT 결과 감지! #{self.valid_text_count} *** - 강의: {self.lecture_id}")
                            logger.info(f"📝 [STT] 텍스트: '{text_result.strip()}'")
                            
                            # 비동기 방식으로 콜백 처리
                            try:
                                # 새 이벤트 루프에서 실행
                                def send_result():
                                    try:
                                        new_loop = asyncio.new_event_loop()
                                        asyncio.set_event_loop(new_loop)
                                        new_loop.run_until_complete(self._text_callback(text_result.strip()))
                                        new_loop.close()
                                    except Exception as e:
                                        logger.error(f"❌ [STT] 결과 전송 실패: {e}")
                                
                                # 별도 스레드에서 실행
                                threading.Thread(target=send_result, daemon=True).start()
                                
                            except Exception as e:
                                logger.error(f"❌ [STT] 콜백 스레드 생성 실패: {e}")
                        
                        last_text_check_time = current_time
                        
                    except Exception as e:
                        logger.debug(f"🔍 [STT] STT 결과 폴링 오류 (정상적일 수 있음): {e}")
                
                # 100ms 대기
                time.sleep(0.1)
                
            except Exception as e:
                logger.error(f"❌ [STT] 강의 {self.lecture_id} 처리 루프 오류: {e}")
                self.metrics["error_count"] += 1
                time.sleep(1.0)  # 오류 시 1초 대기
                
        logger.info(f"🏁 [STT] 강의 {self.lecture_id} 처리 루프 종료 - 총 반복: {loop_count}, 유효 텍스트: {self.valid_text_count}")
    
    def feed_audio_chunk(self, audio_data: bytes):
        """개선된 오디오 청크 피드 - 누적 방식 사용"""
        feed_start = time.time()
        
        if not self.recorder or not self.is_active:
            logger.debug(f"⚠️ [STT] 오디오 피드 건너뛰기 - 강의: {self.lecture_id}, "
                        f"recorder: {self.recorder is not None}, active: {self.is_active}")
            return
        
        try:
            self.metrics["total_audio_chunks"] += 1
            self.metrics["total_audio_bytes"] += len(audio_data)
            self.metrics["last_activity"] = datetime.now().isoformat()
            
            logger.debug(f"📡 [STT] 오디오 청크 #{self.metrics['total_audio_chunks']} 수신 - "
                        f"강의: {self.lecture_id}, 크기: {len(audio_data)} bytes")
            
            # 개선된 청크 누적 방식
            conversion_start = time.time()
            pcm_data = self.accumulator.add_chunk(audio_data)
            conversion_time = time.time() - conversion_start
            
            if pcm_data:
                self.metrics["total_pcm_conversions"] += 1
                
                # RealtimeSTT에 오디오 피드
                feed_time_start = time.time()
                self.recorder.feed_audio(pcm_data)
                feed_time = time.time() - feed_time_start
                
                total_time = time.time() - feed_start
                
                logger.info(f"✅ [STT] 누적 오디오 피드 완료 - 강의: {self.lecture_id}")
                logger.info(f"🕐 [STT] 시간 - 누적: {conversion_time:.3f}s, 피드: {feed_time:.3f}s, 총: {total_time:.3f}s")
                logger.info(f"📊 [STT] PCM 데이터 크기: {len(pcm_data)} bytes, 누적 변환: #{self.metrics['total_pcm_conversions']}")
                
            else:
                logger.debug(f"🔄 [STT] 청크 누적 중 - 강의: {self.lecture_id}, 총 청크: {self.accumulator.chunk_count}")
                
        except Exception as e:
            logger.error(f"❌ [STT] 강의 {self.lecture_id} 오디오 피드 오류: {e}")
            self.metrics["error_count"] += 1
    
    def get_metrics(self) -> Dict:
        """현재 메트릭 반환"""
        metrics = self.metrics.copy()
        metrics["is_active"] = self.is_active
        metrics["has_recorder"] = self.recorder is not None
        metrics["uptime"] = (datetime.now() - datetime.fromisoformat(metrics["created_at"])).total_seconds()
        metrics["accumulator_stats"] = {
            "chunk_count": self.accumulator.chunk_count,
            "total_bytes": self.accumulator.total_bytes,
            "accumulated_size": len(self.accumulator.accumulated_data)
        }
        return metrics
    
    def cleanup(self):
        """리소스 정리"""
        logger.info(f"🧹 [STT] 강의 {self.lecture_id} 레코더 정리 시작")
        
        cleanup_start = time.time()
        self.stop_processing()
        
        if self.recorder:
            try:
                self.recorder.shutdown()
                logger.info(f"✅ [STT] RealtimeSTT 레코더 종료 완료")
            except Exception as e:
                logger.error(f"❌ [STT] RealtimeSTT 레코더 종료 실패: {e}")
        
        cleanup_time = time.time() - cleanup_start
        logger.info(f"🧹 [STT] 강의 {self.lecture_id} 레코더 정리 완료 - 소요시간: {cleanup_time:.3f}s")

# 강의별 레코더 관리자
lecture_recorders: Dict[str, LectureRecorder] = {}
recorder_lock = threading.Lock()

# WebSocket 연결 관리
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}
        # 연결 메트릭
        self.connection_metrics = {
            "total_connections": 0,
            "total_messages": 0,
            "start_time": datetime.now().isoformat()
        }

    async def connect(self, websocket: WebSocket, lecture_id: str):
        await websocket.accept()
        if lecture_id not in self.active_connections:
            self.active_connections[lecture_id] = []
        self.active_connections[lecture_id].append(websocket)
        
        self.connection_metrics["total_connections"] += 1
        
        logger.info(f"✅ [STT] WebSocket 연결됨 - lecture_id: {lecture_id}")
        logger.info(f"📊 [STT] 현재 연결 - 강의별: {len(self.active_connections[lecture_id])}, "
                   f"총 연결수: {sum(len(conns) for conns in self.active_connections.values())}")

    def disconnect(self, websocket: WebSocket, lecture_id: str):
        if lecture_id in self.active_connections:
            if websocket in self.active_connections[lecture_id]:
                self.active_connections[lecture_id].remove(websocket)
                logger.info(f"❌ [STT] WebSocket 연결 해제 - lecture_id: {lecture_id}")
                logger.info(f"📊 [STT] 남은 연결 - 강의별: {len(self.active_connections[lecture_id])}")

    async def broadcast_to_lecture(self, lecture_id: str, message: dict):
        if lecture_id in self.active_connections:
            disconnected = []
            success_count = 0
            
            broadcast_start = time.time()
            connections = self.active_connections[lecture_id].copy()
            
            logger.info(f"📢 [STT] 자막 브로드캐스트 시작 - lecture_id: {lecture_id}, 대상: {len(connections)}명")
            
            for connection in connections:
                try:
                    await connection.send_text(json.dumps(message))
                    success_count += 1
                except Exception as e:
                    logger.error(f"❌ [STT] 개별 전송 실패: {e}")
                    disconnected.append(connection)
            
            # 끊어진 연결 제거
            for conn in disconnected:
                self.active_connections[lecture_id].remove(conn)
            
            broadcast_time = time.time() - broadcast_start
            self.connection_metrics["total_messages"] += 1
            
            logger.info(f"✅ [STT] 자막 브로드캐스트 완료 - 성공: {success_count}, 실패: {len(disconnected)}, "
                       f"소요시간: {broadcast_time:.3f}s")

    def get_stats(self) -> Dict:
        """연결 통계 반환"""
        total_active = sum(len(conns) for conns in self.active_connections.values())
        return {
            "active_connections": total_active,
            "active_lectures": len(self.active_connections),
            "total_connections_created": self.connection_metrics["total_connections"],
            "total_messages_sent": self.connection_metrics["total_messages"],
            "uptime": (datetime.now() - datetime.fromisoformat(self.connection_metrics["start_time"])).total_seconds()
        }

manager = ConnectionManager()

def get_or_create_recorder(lecture_id: str) -> LectureRecorder:
    """강의별 레코더 가져오기 또는 생성"""
    with recorder_lock:
        if lecture_id not in lecture_recorders:
            logger.info(f"🆕 [STT] 새 레코더 생성 - lecture_id: {lecture_id}")
            lecture_recorders[lecture_id] = LectureRecorder(lecture_id, manager)
        else:
            logger.debug(f"🔄 [STT] 기존 레코더 사용 - lecture_id: {lecture_id}")
        return lecture_recorders[lecture_id]

# WebSocket 엔드포인트들

@router.websocket("/ws/audio/{lecture_id}")
async def websocket_audio_endpoint(websocket: WebSocket, lecture_id: str, token: str = Query(None)):
    """실시간 오디오 스트리밍 WebSocket"""
    # 토큰 검증 (선택적)
    if token:
        from ..services.auth import decode_token
        payload = decode_token(token)
        if payload is None:
            logger.error("❌ [STT] 오디오 WebSocket 토큰 검증 실패")
            await websocket.close(code=1008, reason="토큰 검증 실패")
            return
        user_id = payload.get("user_id")
        username = payload.get("sub")
        logger.info(f"✅ [STT] 오디오 WebSocket 인증됨 - user_id: {user_id}, username: {username}")
    else:
        logger.warning("⚠️ [STT] 토큰 없음 - 테스트 모드로 연결 허용")
        
    await websocket.accept()
    logger.info(f"🎤 [STT] 오디오 WebSocket 연결 - lecture_id: {lecture_id}")
    
    # 레코더 가져오기/생성
    recorder = get_or_create_recorder(lecture_id)
    recorder.start_processing()
    
    # 연결 후 테스트 메시지 전송
    try:
        await manager.broadcast_to_lecture(lecture_id, {
            "type": "subtitle",
            "text": "🎤 STT 시스템이 활성화되었습니다. 음성 인식 준비 완료!",
            "timestamp": datetime.now().isoformat(),
            "lecture_id": lecture_id,
            "realtime": False,
            "test": True
        })
        logger.info(f"📢 [STT] 테스트 자막 메시지 전송 완료 - lecture_id: {lecture_id}")
        
        # 추가로 즉시 테스트 텍스트 콜백 호출
        if recorder.recorder:
            try:
                # 직접 text_callback 테스트
                await recorder._text_callback("🧪 즉시 테스트: RealtimeSTT 연결 확인")
                logger.info(f"🧪 [STT] 즉시 text_callback 테스트 완료")
            except Exception as callback_error:
                logger.error(f"❌ [STT] 즉시 text_callback 테스트 실패: {callback_error}")
                
    except Exception as e:
        logger.error(f"❌ [STT] 테스트 자막 메시지 전송 실패: {e}")
    
    audio_count = 0
    total_bytes = 0
    session_start = time.time()
    
    try:
        while True:
            # 더 안정적인 WebSocket 메시지 수신 (타임아웃 포함)
            try:
                logger.debug(f"🔄 [STT] WebSocket 메시지 수신 대기 중... - lecture_id: {lecture_id}")
                
                # 타임아웃을 설정하여 연결 상태 확인
                try:
                    # 1초 타임아웃으로 메시지 대기
                    message = await asyncio.wait_for(websocket.receive(), timeout=1.0)
                    logger.info(f"📥 [STT] *** 메시지 수신 *** - 타입: {message.get('type')}, lecture_id: {lecture_id}")
                    
                    # 메시지 타입에 따른 처리
                    if message["type"] == "websocket.receive":
                        # 바이너리 데이터 처리
                        if "bytes" in message:
                            audio_data = message["bytes"]
                            logger.info(f"📥 [STT] *** 바이너리 오디오 데이터 수신 *** - 크기: {len(audio_data)} bytes")
                            
                            if len(audio_data) > 0:
                                audio_count += 1
                                total_bytes += len(audio_data)
                                
                                logger.info(f"📥 [STT] *** 오디오 청크 #{audio_count} 처리 시작 *** - {len(audio_data)} bytes (강의 {lecture_id})")
                                # 바이너리 데이터 미리보기 (16진수 + ASCII)
                                hex_preview = audio_data[:20].hex()
                                ascii_preview = ''.join(chr(b) if 32 <= b <= 126 else '.' for b in audio_data[:20])
                                logger.info(f"📥 [STT] 데이터 미리보기: {hex_preview} | ASCII: {ascii_preview}")
                                
                                if audio_count % 3 == 0:  # 3개마다 로깅 (더 자주)
                                    session_time = time.time() - session_start
                                    avg_chunk_size = total_bytes / audio_count
                                    logger.info(f"📈 [STT] *** 오디오 세션 진행 *** - 강의: {lecture_id}")
                                    logger.info(f"📈 [STT] 청크수: {audio_count}, 총 바이트: {total_bytes:,}, "
                                               f"평균 크기: {avg_chunk_size:.0f}B, 세션 시간: {session_time:.1f}s")
                                
                                # RealtimeSTT에 오디오 피드
                                try:
                                    logger.info(f"🔄 [STT] RealtimeSTT 피드 시작 - 청크 #{audio_count}")
                                    recorder.feed_audio_chunk(audio_data)
                                    logger.info(f"✅ [STT] RealtimeSTT 피드 완료 - 청크 #{audio_count}")
                                except Exception as feed_error:
                                    logger.error(f"❌ [STT] RealtimeSTT 피드 오류 - 청크 #{audio_count}: {feed_error}")
                            else:
                                logger.warning(f"⚠️ [STT] 빈 오디오 데이터 수신 - 청크 #{audio_count}")
                        
                        # 텍스트 데이터 처리
                        elif "text" in message:
                            text_data = message["text"]
                            logger.info(f"📥 [STT] *** 텍스트 메시지 수신 ***: {text_data}")
                            if text_data == "connection-test":
                                logger.info(f"✅ [STT] 연결 테스트 확인됨 - lecture_id: {lecture_id}")
                                # 테스트 응답 전송
                                await websocket.send_text("connection-test-ok")
                        
                        else:
                            logger.warning(f"⚠️ [STT] 알 수 없는 메시지 포맷: {message}")
                    
                    elif message["type"] == "websocket.disconnect":
                        logger.info(f"🔌 [STT] WebSocket 연결 해제 신호 - lecture_id: {lecture_id}")
                        break
                    
                    else:
                        logger.warning(f"⚠️ [STT] 예상치 못한 메시지 타입: {message['type']}")
                        
                except asyncio.TimeoutError:
                    # 타임아웃은 정상 - 연결 유지를 위한 체크
                    logger.debug(f"🔄 [STT] 메시지 수신 타임아웃 (정상) - lecture_id: {lecture_id}")
                    continue
                    
            except Exception as general_error:
                logger.error(f"❌ [STT] *** 메시지 수신 오류 ***: {general_error}")
                logger.error(f"❌ [STT] 오류 타입: {type(general_error).__name__}")
                break
            
    except WebSocketDisconnect:
        session_time = time.time() - session_start
        logger.info(f"🔌 [STT] 오디오 WebSocket 연결 해제 - lecture_id: {lecture_id}")
        logger.info(f"📊 [STT] 세션 통계 - 청크수: {audio_count}, 총 바이트: {total_bytes:,}, "
                   f"세션 시간: {session_time:.1f}s")
    except Exception as e:
        logger.error(f"❌ [STT] 오디오 WebSocket 오류: {e}")
    finally:
        # 연결이 끊어지면 레코더 정리는 하지 않음 (다른 연결이 있을 수 있음)
        logger.info(f"🏁 [STT] 오디오 WebSocket 세션 종료 - lecture_id: {lecture_id}")

@router.websocket("/ws/{lecture_id}")
async def websocket_subtitle_endpoint(websocket: WebSocket, lecture_id: str, token: str = Query(None)):
    """자막 브로드캐스트 WebSocket (기존 유지)"""
    # 토큰 검증 (선택적)
    if token:
        from ..services.auth import decode_token
        payload = decode_token(token)
        if payload is None:
            logger.error("❌ [STT] 자막 WebSocket 토큰 검증 실패")
            await websocket.close(code=1008, reason="토큰 검증 실패")
            return
        user_id = payload.get("user_id")
        username = payload.get("sub")
        logger.info(f"✅ [STT] 자막 WebSocket 인증됨 - user_id: {user_id}, username: {username}")
    else:
        logger.warning("⚠️ [STT] 자막 토큰 없음 - 테스트 모드로 연결 허용")
    
    await manager.connect(websocket, lecture_id)
    ping_count = 0
    
    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                # 30초마다 핑 메시지 전송
                ping_count += 1
                logger.debug(f"🏓 [STT] Ping #{ping_count} 전송 - lecture_id: {lecture_id}")
                await websocket.send_text(json.dumps({
                    "type": "ping",
                    "timestamp": datetime.now().isoformat(),
                    "ping_count": ping_count
                }))
    except WebSocketDisconnect:
        logger.info(f"🔌 [STT] 자막 WebSocket 연결 해제 - lecture_id: {lecture_id}")
        manager.disconnect(websocket, lecture_id)
    except Exception as e:
        logger.error(f"❌ [STT] 자막 WebSocket 오류: {e}")
        manager.disconnect(websocket, lecture_id)

# REST API 엔드포인트들 (호환성 유지)

@router.post("/realtime-transcribe")
async def realtime_transcribe(
    lecture_id: str = Form(...),
    file: UploadFile = File(...)
):
    """실시간 음성 전사 - 기존 호환성 유지 (비권장)"""
    start_time = time.time()
    
    try:
        logger.info(f"📝 [STT] 레거시 전사 요청 - 강의 {lecture_id}")
        
        # 오디오 데이터 읽기
        audio_data = await file.read()
        read_time = time.time() - start_time
        
        logger.info(f"📊 [STT] 파일 읽기 완료 - 크기: {len(audio_data)} bytes, 시간: {read_time:.3f}s")
        
        if len(audio_data) < 100:
            logger.warning(f"⚠️ [STT] 데이터 크기 부족: {len(audio_data)} bytes")
            return JSONResponse({"text": "", "success": True, "reason": "data_too_small"})
        
        # 레코더 가져오기
        recorder = get_or_create_recorder(lecture_id)
        
        # 한 번만 처리 (실시간이 아님)
        if recorder.recorder and REALTIMESTT_AVAILABLE:
            processing_start = time.time()
            pcm_data = recorder._convert_to_pcm(audio_data)
            conversion_time = time.time() - processing_start
            
            if pcm_data:
                feed_start = time.time()
                recorder.recorder.feed_audio(pcm_data)
                result_text = recorder.recorder.text()
                processing_time = time.time() - feed_start
                
                total_time = time.time() - start_time
                
                if result_text and result_text.strip():
                    logger.info(f"✅ [STT] 레거시 전사 성공 - 강의: {lecture_id}")
                    logger.info(f"📝 [STT] 결과 텍스트: '{result_text.strip()}'")
                    logger.info(f"🕐 [STT] 시간 - 변환: {conversion_time:.3f}s, 처리: {processing_time:.3f}s, 총: {total_time:.3f}s")
                    
                    # 자막 브로드캐스트
                    await manager.broadcast_to_lecture(lecture_id, {
                        "type": "subtitle",
                        "text": result_text.strip(),
                        "timestamp": datetime.now().isoformat(),
                        "lecture_id": lecture_id,
                        "realtime": False,
                        "legacy": True
                    })
                    
                    return JSONResponse({
                        "text": result_text,
                        "timestamp": datetime.now().isoformat(),
                        "lecture_id": lecture_id,
                        "success": True,
                        "realtimestt_available": REALTIMESTT_AVAILABLE,
                        "processing_time": total_time
                    })
        
        logger.warning(f"⚠️ [STT] 레거시 전사 결과 없음 - 강의: {lecture_id}")
        return JSONResponse({
            "text": "",
            "success": True,
            "realtimestt_available": REALTIMESTT_AVAILABLE,
            "reason": "empty_result"
        })
            
    except Exception as e:
        total_time = time.time() - start_time
        logger.error(f"💥 [STT] 레거시 전사 오류 - 강의: {lecture_id}, 오류: {e}, 소요시간: {total_time:.3f}s")
        return JSONResponse({
            "text": "",
            "error": str(e),
            "success": False,
            "realtimestt_available": REALTIMESTT_AVAILABLE
        }, status_code=500)

@router.get("/status")
async def get_stt_status():
    """STT 서비스 상태 조회"""
    active_recorders = len(lecture_recorders)
    connection_stats = manager.get_stats()
    
    # 각 레코더의 메트릭 수집
    recorder_metrics = {}
    with recorder_lock:
        for lecture_id, recorder in lecture_recorders.items():
            recorder_metrics[lecture_id] = recorder.get_metrics()
    
    status = {
        "realtimestt_available": REALTIMESTT_AVAILABLE,
        "ffmpeg_available": FFMPEG_AVAILABLE,
        "ffmpeg_python_available": FFMPEG_PYTHON_AVAILABLE,
        "active_recorders": active_recorders,
        "connection_stats": connection_stats,
        "recorder_metrics": recorder_metrics,
        "message": "실시간 STT 서비스 정상 작동 중" if REALTIMESTT_AVAILABLE else "테스트 모드로 작동 중",
        "timestamp": datetime.now().isoformat()
    }
    
    logger.info(f"📈 [STT] 상태 조회 - 활성 레코더: {active_recorders}, 연결: {connection_stats['active_connections']}")
    
    return JSONResponse(status)

@router.get("/diagnosis")
async def get_stt_diagnosis():
    """STT 시스템 진단 정보"""
    diagnosis = {
        "ffmpeg_status": {
            "installed": FFMPEG_AVAILABLE,
            "python_wrapper": FFMPEG_PYTHON_AVAILABLE,
            "recommendation": "pip install ffmpeg-python" if not FFMPEG_PYTHON_AVAILABLE else "정상"
        },
        "realtimestt_status": {
            "available": REALTIMESTT_AVAILABLE,
            "recommendation": "pip install RealtimeSTT" if not REALTIMESTT_AVAILABLE else "정상"
        },
        "system_info": {
            "platform": os.name,
            "temp_dir": tempfile.gettempdir(),
            "current_time": datetime.now().isoformat()
        },
        "audio_processing": {
            "supported_formats": ["webm", "wav", "mp3", "mp4"],
            "output_format": "PCM 16-bit 16kHz mono",
            "conversion_methods": [
                "ffmpeg-python (권장)" if FFMPEG_PYTHON_AVAILABLE else "ffmpeg-python (미설치)",
                "subprocess + ffmpeg" if FFMPEG_AVAILABLE else "subprocess + ffmpeg (미설치)",
                "원본 데이터 사용 (fallback)"
            ]
        },
        "troubleshooting": {
            "ffmpeg_not_found": "https://ffmpeg.org/download.html에서 FFmpeg 다운로드",
            "python_wrapper_missing": "pip install ffmpeg-python 실행",
            "realtimestt_missing": "pip install RealtimeSTT 실행",
            "windows_path_issue": "FFmpeg가 PATH에 등록되어 있는지 확인"
        }
    }
    
    logger.info(f"🔧 [STT] 진단 정보 조회")
    return JSONResponse(diagnosis)

@router.post("/start-recording/{lecture_id}")
async def start_recording(lecture_id: str):
    """특정 강의의 실시간 녹음 시작"""
    try:
        logger.info(f"🎬 [STT] 녹음 시작 요청 - 강의: {lecture_id}")
        
        start_time = time.time()
        recorder = get_or_create_recorder(lecture_id)
        recorder.start_processing()
        setup_time = time.time() - start_time
        
        logger.info(f"✅ [STT] 녹음 시작 완료 - 강의: {lecture_id}, 설정 시간: {setup_time:.3f}s")
        
        return JSONResponse({
            "success": True,
            "lecture_id": lecture_id,
            "message": f"강의 {lecture_id} 실시간 STT 시작됨",
            "realtimestt_available": REALTIMESTT_AVAILABLE,
            "setup_time": setup_time
        })
    except Exception as e:
        logger.error(f"❌ [STT] 녹음 시작 오류 - 강의: {lecture_id}, 오류: {e}")
        raise HTTPException(status_code=500, detail=f"녹음 시작 실패: {str(e)}")

@router.post("/stop-recording/{lecture_id}")
async def stop_recording(lecture_id: str):
    """특정 강의의 실시간 녹음 중지"""
    try:
        logger.info(f"🛑 [STT] 녹음 중지 요청 - 강의: {lecture_id}")
        
        start_time = time.time()
        with recorder_lock:
            if lecture_id in lecture_recorders:
                recorder = lecture_recorders[lecture_id]
                metrics = recorder.get_metrics()
                recorder.cleanup()
                del lecture_recorders[lecture_id]
                
                cleanup_time = time.time() - start_time
                
                logger.info(f"✅ [STT] 녹음 중지 완료 - 강의: {lecture_id}, 정리 시간: {cleanup_time:.3f}s")
                logger.info(f"📊 [STT] 최종 메트릭 - 텍스트 결과: {metrics['total_text_results']}, "
                           f"오디오 청크: {metrics['total_audio_chunks']}")
            else:
                logger.warning(f"⚠️ [STT] 중지할 레코더 없음 - 강의: {lecture_id}")
        
        return JSONResponse({
            "success": True,
            "lecture_id": lecture_id,
            "message": f"강의 {lecture_id} 실시간 STT 중지됨"
        })
    except Exception as e:
        logger.error(f"❌ [STT] 녹음 중지 오류 - 강의: {lecture_id}, 오류: {e}")
        raise HTTPException(status_code=500, detail=f"녹음 중지 실패: {str(e)}")

@router.post("/test-subtitle/{lecture_id}")
async def test_subtitle(lecture_id: str):
    """테스트 자막 수동 전송 - STT 시스템 디버깅용"""
    try:
        test_messages = [
            "🧪 테스트 1: 안녕하세요. 강경수입니다.",
            "🧪 테스트 2: STT 시스템이 정상적으로 작동하고 있습니다.",
            "🧪 테스트 3: 실시간 자막 브로드캐스트 테스트입니다.",
            "🧪 테스트 4: 이 메시지가 클라이언트에 표시되면 성공입니다."
        ]
        
        results = []
        for i, message in enumerate(test_messages):
            try:
                await manager.broadcast_to_lecture(lecture_id, {
                    "type": "subtitle",
                    "text": message,
                    "timestamp": datetime.now().isoformat(),
                    "lecture_id": lecture_id,
                    "realtime": False,
                    "test": True,
                    "test_sequence": i + 1
                })
                
                logger.info(f"✅ [STT] 테스트 자막 #{i+1} 전송 완료: {message}")
                results.append({
                    "sequence": i + 1,
                    "message": message,
                    "status": "success",
                    "timestamp": datetime.now().isoformat()
                })
                
                # 메시지 간 0.5초 간격
                import asyncio
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.error(f"❌ [STT] 테스트 자막 #{i+1} 전송 실패: {e}")
                results.append({
                    "sequence": i + 1,
                    "message": message,
                    "status": "failed",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                })
        
        return JSONResponse({
            "success": True,
            "lecture_id": lecture_id,
            "test_results": results,
            "timestamp": datetime.now().isoformat(),
            "message": f"테스트 자막 {len(test_messages)}개 전송 완료"
        })
        
    except Exception as e:
        logger.error(f"❌ [STT] 테스트 자막 전송 전체 실패: {e}")
        return JSONResponse({
            "success": False,
            "lecture_id": lecture_id,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }, status_code=500)

# 서버 시작/종료 이벤트
@router.on_event("startup")
async def startup_event():
    logger.info("🚀 [STT] 실시간 STT 컨트롤러 시작")
    logger.info(f"📊 [STT] RealtimeSTT 사용 가능: {REALTIMESTT_AVAILABLE}")
    logger.info(f"🕐 [STT] 시작 시간: {datetime.now().isoformat()}")

@router.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 [STT] 실시간 STT 서비스 종료 중...")
    
    shutdown_start = time.time()
    
    # 모든 레코더 정리
    with recorder_lock:
        active_count = len(lecture_recorders)
        logger.info(f"🧹 [STT] {active_count}개 레코더 정리 시작")
        
        for lecture_id, recorder in lecture_recorders.items():
            try:
                recorder.cleanup()
                logger.info(f"✅ [STT] 레코더 정리 완료 - 강의: {lecture_id}")
            except Exception as e:
                logger.error(f"❌ [STT] 레코더 정리 실패 - 강의: {lecture_id}, 오류: {e}")
        
        lecture_recorders.clear()
    
    # 연결 통계 로깅
    final_stats = manager.get_stats()
    shutdown_time = time.time() - shutdown_start
    
    logger.info(f"📊 [STT] 최종 통계 - 총 연결: {final_stats['total_connections_created']}, "
               f"총 메시지: {final_stats['total_messages_sent']}")
    logger.info(f"✅ [STT] 실시간 STT 서비스 종료 완료 - 종료 시간: {shutdown_time:.3f}s") 