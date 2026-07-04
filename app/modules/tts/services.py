import os
import re
import hashlib
import asyncio
import edge_tts
from gtts import gTTS
import logging
import json
import base64
import httpx

logger = logging.getLogger(__name__)

class AudioGenerator:
    PROMPT_REGEX = re.compile(r'^\s*([a-zA-Z0-9_-]+):\s*(.+)$', re.MULTILINE)
    
    # Premium Microsoft Edge TTS Voices mapping
    EDGE_VOICES = {
        'ja': 'ja-JP-NanamiNeural',
        'vi': 'vi-VN-HoaiMyNeural',
        'en': 'en-US-AriaNeural',
        'zh': 'zh-CN-XiaoxiaoNeural',
        'ko': 'ko-KR-SunHiNeural',
        'fr': 'fr-FR-DeniseNeural',
        'de': 'de-DE-KillianNeural',
        'es': 'es-ES-ElviraNeural',
        'ru': 'ru-RU-SvetlanaNeural',
        'it': 'it-IT-ElsaNeural'
    }

    @staticmethod
    def parse_segments(text: str, default_lang: str = "vi"):
        if not text:
            return []
            
        segments = []
        
        # Check if text is in bracket format, e.g., [ja:人生][vi:cuộc đời]
        bracket_matches = re.findall(r'\[([a-zA-Z0-9_-]+):\s*([^\]]+)\]', text)
        if bracket_matches:
            for lang, content in bracket_matches:
                segments.append({
                    'text': content.strip(),
                    'lang': lang.strip().lower()
                })
            return segments
            
        # Fallback to line-by-line format
        lines = text.split('\n')
        current_lang = default_lang
        
        for line in lines:
            if not line.strip():
                continue 
                
            match = AudioGenerator.PROMPT_REGEX.match(line)
            if match:
                lang = match.group(1)
                content = match.group(2) # Group 2 contains text now since we simplified regex
                current_lang = lang
                segments.append({
                    'text': content.strip(),
                    'lang': lang
                })
            else:
                segments.append({
                    'text': line.strip(),
                    'lang': current_lang
                })
                
        return segments

    @classmethod
    async def generate_google_cloud_tts(cls, text: str, lang: str, api_key: str, output_path: str, voice_name: str = None) -> bool:
        try:
            if not voice_name:
                # Map standard languages to Google Cloud TTS voices (Neural2 is premium and very high quality)
                voice_map = {
                    "vi": "vi-VN-Neural2-A",
                    "en": "en-US-Neural2-H",
                    "ja": "ja-JP-Neural2-C",
                    "zh": "zh-CN-Neural2-C",
                    "ko": "ko-KR-Neural2-A",
                    "fr": "fr-FR-Neural2-B",
                    "de": "de-DE-Neural2-F",
                    "es": "es-ES-Neural2-F",
                    "ru": "ru-RU-Wavenet-A",
                    "it": "it-IT-Neural2-C"
                }
                base_lang = lang.split('-')[0].lower()
                voice_name = voice_map.get(base_lang, "en-US-Neural2-H")

            lang_code = lang
            if voice_name and len(voice_name.split("-")) >= 2:
                lang_code = "-".join(voice_name.split("-")[:2])

            url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
            payload = {
                "input": {"text": text},
                "voice": {
                    "languageCode": lang_code,
                    "name": voice_name
                },
                "audioConfig": {
                    "audioEncoding": "MP3"
                }
            }
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, timeout=20.0)
                if response.status_code == 200:
                    data = response.json()
                    audio_content = data.get("audioContent")
                    if audio_content:
                        with open(output_path, "wb") as f:
                            f.write(base64.b64decode(audio_content))
                        logger.info(f"[TTS GOOGLE CLOUD SUCCESS] Synthesized lang '{lang}' using voice '{voice_name}'")
                        return True
                logger.error(f"[TTS GOOGLE CLOUD ERROR] API responded {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"[TTS GOOGLE CLOUD EXCEPTION] {e}")
        return False

    @classmethod
    async def generate_tts(cls, text: str, output_path: str, default_lang: str = "vi") -> bool:
        """
        Generates premium TTS audio file using Google Cloud TTS (if configured),
        Microsoft Edge TTS as primary fallback, and Google TTS (gTTS) as secondary fallback.
        Supports multi-language segments and merges them if pydub is available.
        """
        try:
            # Ensure /usr/bin and /usr/local/bin are in PATH so pydub/ffmpeg can be found
            extra_paths = ["/usr/bin", "/usr/local/bin"]
            current_path = os.environ.get("PATH", "")
            for p in extra_paths:
                if p not in current_path:
                    current_path += os.pathsep + p
            os.environ["PATH"] = current_path

            # Load settings
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            settings_path = os.path.join(base_dir, "core", "tts_settings.json")
            tts_engine = "edge"
            google_key = ""
            default_voices = {}
            
            if os.path.exists(settings_path):
                try:
                    with open(settings_path, "r", encoding="utf-8") as sf:
                        config_data = json.load(sf)
                        tts_engine = config_data.get("default_engine", "edge")
                        google_key = config_data.get("google_api_key", "")
                        default_voices = config_data.get("default_voices", {})
                except Exception:
                    pass

            segments = cls.parse_segments(text, default_lang)
            if not segments:
                return False
                
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # 1. Synthesize all segments to temp files
            temp_files = []
            import tempfile
            
            for i, seg in enumerate(segments):
                if i > 0:
                    await asyncio.sleep(0.25) # Pace requests to avoid rate-limiting
                
                seg_text = seg['text']
                if not seg_text.strip():
                    continue
                    
                lang = seg['lang']
                
                # Create Temp File
                fd, temp_path = tempfile.mkstemp(suffix=f"_{i}.mp3")
                os.close(fd)
                
                success_segment = False
                
                # Look up customized voice name and engine from user settings
                # If lang is already a full voice string (contains 'Neural' or 'Wavenet'), use it directly!
                is_full_voice = "Neural" in lang or "Wavenet" in lang or len(lang) > 10
                
                if is_full_voice:
                    tag_engine = "google" if ("Neural2" in lang or "Wavenet" in lang) else "edge"
                    configured_voice = lang
                else:
                    voice_data = default_voices.get(lang)
                    if isinstance(voice_data, dict):
                        tag_engine = voice_data.get("engine", tts_engine)
                        configured_voice = voice_data.get("voice")
                    else:
                        tag_engine = tts_engine
                        configured_voice = voice_data # it's a string or None
                
                # 1. Try Google Cloud TTS first if tag_engine is "google"
                if tag_engine == "google" and google_key.strip():
                    print(f"\n[TTS GENERATOR] [TRY GOOGLE CLOUD] Attempting Google Cloud TTS for tag '{lang}'...")
                    success_segment = await cls.generate_google_cloud_tts(seg_text, lang, google_key.strip(), temp_path, configured_voice)
                    
                # 2. Try Edge TTS if tag_engine is "edge" or if Google Cloud failed
                if not success_segment and tag_engine != "gtts":
                    voice_edge = configured_voice or cls.EDGE_VOICES.get(lang.split('-')[0].lower())
                    edge_err = None
                    if voice_edge:
                        print(f"\n[TTS GENERATOR] [TRY EDGE] Attempting Microsoft Edge TTS for tag '{lang}' using voice '{voice_edge}'...")
                        try:
                            communicate = edge_tts.Communicate(seg_text, voice_edge)
                            await communicate.save(temp_path)
                            success_segment = True
                            log_msg = f"[TTS GENERATOR] [SUCCESS EDGE] Microsoft Edge TTS generated successfully. Voice: '{voice_edge}' | Tag: '{lang}'"
                            print(log_msg)
                            logger.info(log_msg)
                        except Exception as ee:
                            edge_err = str(ee)
                            logger.error(f"[TTS WARNING] Microsoft Edge TTS failed for voice '{voice_edge}': {ee}")
                    
                # 3. Fallback to gTTS as final resort
                if not success_segment:
                    # If configured_voice was specified and is a short code (like 'vi', 'en'), use it, otherwise fallback to split tag
                    gtts_lang = configured_voice if (configured_voice and len(configured_voice) <= 5) else lang.split('-')[0].lower()
                    print(f"[TTS GENERATOR] [TRY GTTS] Falling back to Google TTS (gTTS) for tag '{lang}' using lang '{gtts_lang}'...")
                    try:
                        def run_gtts():
                            tts = gTTS(text=seg_text, lang=gtts_lang)
                            tts.save(temp_path)
                        await asyncio.to_thread(run_gtts)
                        success_segment = True
                        log_msg = f"[TTS GENERATOR] [SUCCESS GTTS] Google TTS generated successfully. Lang: '{gtts_lang}'"
                        print(log_msg)
                        logger.info(log_msg)
                    except Exception as ge:
                        logger.error(f"[TTS CRITICAL ERROR] Google TTS fallback also failed: {ge}")
                        if os.path.exists(temp_path):
                            os.remove(temp_path)
                        raise ValueError(f"All TTS engines failed for text segment '{seg_text[:20]}'")
                    except Exception as ge:
                        logger.error(f"[TTS CRITICAL ERROR] Google TTS fallback also failed: {ge}")
                        if os.path.exists(temp_path):
                            os.remove(temp_path)
                        raise ValueError(f"All TTS engines failed for text segment '{seg_text[:20]}'")
                        
                temp_files.append(temp_path)
                
            if not temp_files:
                return False
                
            # 2. Concatenate
            if len(temp_files) == 1:
                # Only 1 segment, direct copy from temp to final
                import shutil
                shutil.copyfile(temp_files[0], output_path)
                success = True
            else:
                # Merge using pydub
                try:
                    from pydub import AudioSegment
                    
                    # Programmatically search and set standard ffmpeg/ffprobe paths if PATH is restricted on VPS
                    for fpath in ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg.exe"]:
                        if os.path.exists(fpath):
                            AudioSegment.converter = fpath
                            break
                    for fpath in ["/usr/bin/ffprobe", "/usr/local/bin/ffprobe", "/usr/bin/ffprobe.exe"]:
                        if os.path.exists(fpath):
                            AudioSegment.ffprobe = fpath
                            break
                    
                    def concat_task():
                        combined = AudioSegment.empty()
                        pause = AudioSegment.silent(duration=300) # 300ms pause
                        
                        for idx, tf in enumerate(temp_files):
                            if idx > 0:
                                combined += pause
                            combined += AudioSegment.from_file(tf)
                            
                        combined.export(output_path, format="mp3")
                        
                    await asyncio.to_thread(concat_task)
                    success = True
                except Exception as pe:
                    logger.error(f"Pydub concatenation failed (missing ffmpeg), falling back to first segment: {pe}")
                    # Fallback copy first segment
                    import shutil
                    shutil.copyfile(temp_files[0], output_path)
                    success = True
                    
            # 3. Clean up temp files
            for tf in temp_files:
                if os.path.exists(tf):
                    try:
                        os.remove(tf)
                    except:
                        pass
                        
            return success
        except Exception as e:
            logger.error(f"AudioGenerator error: {e}")
            raise e

    @classmethod
    def get_voice_hash(cls, text: str) -> str:
        return hashlib.md5(text.encode('utf-8')).hexdigest()
