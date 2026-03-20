import whisper
import torch
from pyannote.audio import Pipeline
import os
import subprocess
import yt_dlp
from deep_translator import GoogleTranslator
from typing import List, Dict, Any

class Transcriber:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Transcriber, cls).__new__(cls)
            cls._instance.device = "cuda" if torch.cuda.is_available() else "cpu"
            cls._instance.model_name = "base"
            print(f"Loading Whisper model {cls._instance.model_name} on {cls._instance.device}...")
            cls._instance.model = whisper.load_model(cls._instance.model_name, device=cls._instance.device)
            
            # Diarization pipeline (requires HF_TOKEN)
            cls._instance.hf_token = os.getenv("HF_TOKEN")
            cls._instance.diarization_pipeline = None
            if cls._instance.hf_token:
                try:
                    cls._instance.diarization_pipeline = Pipeline.from_pretrained(
                        "pyannote/speaker-diarization-3.1",
                        use_auth_token=cls._instance.hf_token
                    )
                    if cls._instance.device == "cuda":
                        cls._instance.diarization_pipeline.to(torch.device("cuda"))
                except Exception as e:
                    print(f"Failed to load diarization pipeline: {e}")
            else:
                print("HF_TOKEN not found. Speaker diarization will be disabled.")
                
        return cls._instance

    def download_from_url(self, url: str, output_template: str) -> str:
        options = {
            'format': 'bestaudio/best',
            'outtmpl': output_template,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'quiet': True,
        }
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)
            # yt-dlp replaces %(ext)s with the final extension
            return ydl.prepare_filename(info).rsplit('.', 1)[0] + '.mp3'

    def restore_audio_file(self, audio_path: str) -> str:
        output_path = audio_path.rsplit('.', 1)[0] + '_restored.wav'
        # Simple ffmpeg highpass and afftdn (FFT based noise reduction)
        try:
            subprocess.run([
                'ffmpeg', '-y', '-i', audio_path,
                '-af', 'highpass=f=200,lowpass=f=3000,afftdn',
                output_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return output_path
        except Exception as e:
            print(f"Audio restoration failed: {e}")
            return audio_path

    def transcribe(self, audio_path: str, diarize: bool = False, translate: bool = False, restore_audio: bool = False, mode: str = "rapido", language: str = "pt") -> Dict[str, Any]:
        # Switch model size based on mode
        target_model = "tiny" if mode == "rapido" else ("large" if mode == "preciso" else "base")
        if self.model_name != target_model:
            print(f"Switching Whisper model from {self.model_name} to {target_model}...")
            self.model = whisper.load_model(target_model, device=self.device)
            self.model_name = target_model

        # Native whisper translation task (only translates to English)
        # If user wants another language and translate=True, we translate post-transcription
        task = "translate" if (translate and language.startswith("en")) else "transcribe"
        
        if restore_audio:
            print(f"Restoring audio: {audio_path}")
            audio_path = self.restore_audio_file(audio_path)
            
        print(f"Transcribing {audio_path} with model {self.model_name}...")
        # Basic Whisper transcription
        result = self.model.transcribe(audio_path, fp16=(self.device == "cuda"), task=task)
        
        final_text = result["text"]
        segments = result["segments"]
        detected_language = result["language"]

        if translate and not language.startswith("en"):
            print(f"Translating text to {language}...")
            try:
                # Use deep-translator to translate
                translator = GoogleTranslator(source='auto', target=language)
                
                # Split text if it's too long, but for standard transcription < 5000 chars it's fine.
                # A robust implementation would chunk texts or translate segments.
                for seg in segments:
                    if seg["text"].strip():
                        seg["text"] = translator.translate(seg["text"].strip())
                final_text = " ".join([s["text"] for s in segments])
            except Exception as e:
                print(f"Translation failed: {e}")
        
        if diarize and self.diarization_pipeline:
            # Diarization logic
            diarization = self.diarization_pipeline(audio_path)
            segments = []
            
            # Match whisper segments with diarization speakers
            # This is a simplified version; for production, more robust alignment is needed
            for segment in result["segments"]:
                start = segment["start"]
                end = segment["end"]
                
                # Find speaker for this segment range
                speaker = "Unknown"
                for turn, _, speaker_id in diarization.itertracks(yield_label=True):
                    if turn.start <= start <= turn.end or start <= turn.start <= end:
                        speaker = speaker_id
                        break
                        
                segments.append({
                    "start": start,
                    "end": end,
                    "speaker": speaker,
                    "text": segment["text"].strip()
                })
            
            return {
                "text": final_text,
                "language": detected_language,
                "segments": segments,
                "diarized": True
            }
            
        return {
            "text": final_text,
            "language": detected_language,
            "segments": segments,
            "diarized": False
        }

# Global singleton
transcriber_service = Transcriber()
