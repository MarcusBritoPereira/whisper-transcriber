from faster_whisper import WhisperModel
import torch
from pyannote.audio import Pipeline
import os
import subprocess
import yt_dlp
from deep_translator import GoogleTranslator
from typing import Dict, Any, Optional
import time
import logging

logger = logging.getLogger(__name__)


class Transcriber:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Transcriber, cls).__new__(cls)
            cls._instance.device = "cuda" if torch.cuda.is_available() else "cpu"
            # No Mac, "int8" é excelente para CPU. Em CUDA, "float16" é melhor.
            cls._instance.compute_type = "float16" if cls._instance.device == "cuda" else "int8"
            cls._instance.model_name = "base"
            
            print(f"Loading Faster-Whisper model {cls._instance.model_name} on {cls._instance.device} ({cls._instance.compute_type})...")
            cls._instance.model = WhisperModel(
                cls._instance.model_name, 
                device=cls._instance.device, 
                compute_type=cls._instance.compute_type
            )

            cls._instance.hf_token = os.getenv("HF_TOKEN")
            cls._instance.diarization_pipeline = None
            if cls._instance.hf_token:
                try:
                    cls._instance.diarization_pipeline = Pipeline.from_pretrained(
                        "pyannote/speaker-diarization-3.1",
                        use_auth_token=cls._instance.hf_token,
                    )
                    if cls._instance.device == "cuda":
                        cls._instance.diarization_pipeline.to(torch.device("cuda"))
                except Exception as exc:
                    print(f"Failed to load diarization pipeline: {exc}")
            else:
                print("HF_TOKEN not found. Speaker diarization will be disabled.")

        return cls._instance

    def download_from_url(self, url: str, output_template: str) -> str:
        options = {
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }
            ],
            "quiet": True,
        }
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)
            return ydl.prepare_filename(info).rsplit(".", 1)[0] + ".mp3"

    def restore_audio_file(self, audio_path: str) -> str:
        output_path = audio_path.rsplit(".", 1)[0] + "_restored.wav"
        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    audio_path,
                    "-af",
                    "highpass=f=200,lowpass=f=3000,afftdn",
                    output_path,
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return output_path
        except Exception as exc:
            print(f"Audio restoration failed: {exc}")
            return audio_path

    def transcribe(
        self,
        audio_path: str,
        diarize: bool = False,
        translate: bool = False,
        restore_audio: bool = False,
        mode: str = "rapido",
        language: str = "pt",
    ) -> Dict[str, Any]:
        target_model = "tiny" if mode == "rapido" else ("medium" if mode == "preciso" else "base")
        
        if self.model_name != target_model:
            print(f"Switching Faster-Whisper model from {self.model_name} to {target_model}...")
            self.model = WhisperModel(target_model, device=self.device, compute_type=self.compute_type)
            self.model_name = target_model

        task = "translate" if (translate and language.startswith("en")) else "transcribe"

        temp_restored = None
        if restore_audio:
            print(f"Restoring audio: {audio_path}")
            restored = self.restore_audio_file(audio_path)
            if restored != audio_path:
                temp_restored = restored
                audio_path = restored

        try:
            print(f"Transcribing {audio_path} with Faster-Whisper ({self.model_name})...")
            start_t = time.time()
            
            # faster-whisper transcribe returns (segments_generator, info)
            segments_gen, info = self.model.transcribe(
                audio_path, 
                beam_size=5, 
                language=language if language != "auto" else None,
                task=task
            )
            
            base_segments = []
            full_text_list = []
            
            for seg in segments_gen:
                base_segments.append({
                    "start": seg.start,
                    "end": seg.end,
                    "speaker": None,
                    "text": seg.text.strip(),
                })
                full_text_list.append(seg.text.strip())
            
            end_t = time.time()
            final_text = " ".join(full_text_list).strip()
            detected_language = info.language
            
            print(f"Transcription finished in {end_t - start_t:.2f}s using Faster-Whisper {self.model_name}")
            logger.info(f"TRANSCRIPTION_FINISHED: {audio_path}")

            if translate and not language.startswith("en"):
                print(f"Translating text to {language}...")
                try:
                    translator = GoogleTranslator(source="auto", target=language)
                    for seg in base_segments:
                        if seg["text"]:
                            seg["text"] = translator.translate(seg["text"])
                    final_text = " ".join([s["text"] for s in base_segments]).strip()
                except Exception as exc:
                    print(f"Translation failed: {exc}")

            if diarize and self.diarization_pipeline:
                print("Running speaker diarization...")
                diarization = self.diarization_pipeline(audio_path)
                diarized_segments = []

                for segment in base_segments:
                    start = segment["start"]
                    end = segment["end"]

                    speaker = "Unknown"
                    for turn, _, speaker_id in diarization.itertracks(yield_label=True):
                        if turn.start <= start <= turn.end or start <= turn.start <= end:
                            speaker = speaker_id
                            break

                    diarized_segments.append(
                        {
                            "start": start,
                            "end": end,
                            "speaker": speaker,
                            "text": segment["text"],
                        }
                    )

                return {
                    "text": final_text,
                    "language": detected_language,
                    "segments": diarized_segments,
                    "diarized": True,
                }

            return {
                "text": final_text,
                "language": detected_language,
                "segments": base_segments,
                "diarized": False,
            }
        finally:
            if temp_restored and os.path.exists(temp_restored):
                os.remove(temp_restored)


transcriber_service = Transcriber()

