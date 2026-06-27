import os
import re
import hashlib
import asyncio
import edge_tts
from gtts import gTTS
import logging

logger = logging.getLogger(__name__)

class AudioGenerator:
    PROMPT_REGEX = re.compile(r'^\s*([a-z]{2})(?:\(([mf])\))?:\s*(.+)$', re.MULTILINE)
    
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
    def parse_segments(text: str):
        if not text:
            return []
            
        segments = []
        
        # Check if text is in bracket format, e.g., [ja:人生][vi:cuộc đời]
        bracket_matches = re.findall(r'\[([a-z]{2,3}(?:-[a-zA-Z0-9]+)?):\s*([^\]]+)\]', text)
        if bracket_matches:
            for lang, content in bracket_matches:
                segments.append({
                    'text': content.strip(),
                    'lang': lang.strip().lower()
                })
            return segments
            
        # Fallback to line-by-line format
        lines = text.split('\n')
        current_lang = 'en'
        
        for line in lines:
            if not line.strip():
                continue 
                
            match = AudioGenerator.PROMPT_REGEX.match(line)
            if match:
                lang = match.group(1)
                content = match.group(3)
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
    async def generate_tts(cls, text: str, output_path: str) -> bool:
        """
        Generates premium TTS audio file using Microsoft Edge TTS as primary,
        falling back to Google TTS (gTTS) if Edge TTS fails or voice is unsupported.
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

            segments = cls.parse_segments(text)
            if not segments:
                return False
                
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # 1. Synthesize all segments to temp files
            temp_files = []
            import tempfile
            
            for i, seg in enumerate(segments):
                if i > 0:
                    await asyncio.sleep(0.25) # Pace requests to avoid rate-limiting from Edge TTS servers
                
                seg_text = seg['text']
                if not seg_text.strip():
                    continue
                    
                lang = seg['lang']
                
                # Create Temp File
                fd, temp_path = tempfile.mkstemp(suffix=f"_{i}.mp3")
                os.close(fd)
                
                # Try Edge TTS first (Primary)
                success_edge = False
                voice_edge = cls.EDGE_VOICES.get(lang)
                
                edge_err = None
                if voice_edge:
                    print(f"\n[TTS GENERATOR] [TRY EDGE] Attempting Microsoft Edge TTS for lang '{lang}' using voice '{voice_edge}'...")
                    try:
                        communicate = edge_tts.Communicate(seg_text, voice_edge)
                        await communicate.save(temp_path)
                        success_edge = True
                        log_msg = f"[TTS GENERATOR] [SUCCESS EDGE] Microsoft Edge TTS generated successfully. Voice: '{voice_edge}' | Lang: '{lang}' | Segment: '{seg_text[:40]}...'"
                        print(log_msg)
                        logger.info(log_msg)
                    except Exception as ee:
                        edge_err = str(ee)
                        msg = f"\n==================================================\n[TTS WARNING] Microsoft Edge TTS failed for voice '{voice_edge}'!\nSegment text: '{seg_text}'\nError details: {ee}\n=================================================="
                        print(msg)
                        logger.error(msg)
                else:
                    print(f"\n[TTS GENERATOR] No specific Edge TTS voice mapped for lang '{lang}' (supported keys: {list(cls.EDGE_VOICES.keys())})")
                
                # Fallback to gTTS if Edge TTS failed or lang not supported
                if not success_edge:
                    print(f"[TTS GENERATOR] [TRY GTTS] Falling back to Google TTS (gTTS) for lang '{lang}'...")
                    try:
                        # run gtts in thread since it's synchronous/blocking
                        def run_gtts():
                            tts = gTTS(text=seg_text, lang=lang)
                            tts.save(temp_path)
                        await asyncio.to_thread(run_gtts)
                        log_msg = f"[TTS GENERATOR] [SUCCESS GTTS] Google TTS generated successfully. Lang: '{lang}' | Segment: '{seg_text[:40]}...'"
                        print(log_msg)
                        logger.info(log_msg)
                    except Exception as ge:
                        msg = f"\n==================================================\n[TTS CRITICAL ERROR] Google TTS fallback also failed!\nSegment text: '{seg_text}'\nError details: {ge}\n=================================================="
                        print(msg)
                        logger.error(msg)
                        # Clean up and exit if both failed
                        if os.path.exists(temp_path):
                            os.remove(temp_path)
                        raise ValueError(f"Both Edge TTS and gTTS failed. Edge: {edge_err or 'No voice mapped'}. gTTS: {ge}")
                        
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
