from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import uuid
import asyncio
from services.transcriber import transcriber_service
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="UPscribe API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class TranscriptionResponse(BaseModel):
    text: str
    language: str
    segments: List[dict]
    diarized: bool

class TranslateRequest(BaseModel):
    text: str
    target_language: str

class SummarizeRequest(BaseModel):
    text: str

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    diarize: bool = Form(False),
    language: str = Form("pt"),
    translate: bool = Form(False),
    restore_audio: bool = Form(False),
    mode: str = Form("rapido")
):
    if not file and not url:
        raise HTTPException(status_code=400, detail="Either file or url must be provided")
    file_id = str(uuid.uuid4())
    temp_path = ""
    
    if file:
        allowed_extensions = (".mp3", ".wav", ".m4a", ".ogg", ".flac", ".opus", ".mp4", ".mpeg", ".webm")
        if not file.filename.lower().endswith(allowed_extensions) and not file.content_type.startswith("audio/"):
            raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")
            
        ext = os.path.splitext(file.filename)[1]
        if not ext:
            ext = ".mp3"
        temp_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    elif url:
        temp_path = os.path.join(UPLOAD_DIR, f"{file_id}.%(ext)s")
        # yt-dlp logic is handled by the transcriber service, which will return the actual path
        temp_path = transcriber_service.download_from_url(url, temp_path)
    
    if not temp_path or not os.path.exists(temp_path):
        raise HTTPException(status_code=500, detail="Error retrieving audio file.")
    
    try:
        result = transcriber_service.transcribe(
            temp_path, 
            diarize=diarize, 
            translate=translate, 
            restore_audio=restore_audio,
            mode=mode,
            language=language
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/translate_text")
async def translate_text_endpoint(req: TranslateRequest):
    try:
        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source='auto', target=req.target_language)
        
        # handle length limits
        chunk_size = 4000
        chunks = [req.text[i:i+chunk_size] for i in range(0, len(req.text), chunk_size)]
        translated_chunks = [translator.translate(chunk) for chunk in chunks]
        
        return {"translated_text": " ".join(translated_chunks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/summarize")
async def summarize_endpoint(req: SummarizeRequest):
    try:
        from sumy.parsers.plaintext import PlaintextParser
        from sumy.nlp.tokenizers import Tokenizer
        from sumy.summarizers.lsa import LsaSummarizer
        
        # For simplicity, fallback to Portuguese tokenizer
        parser = PlaintextParser.from_string(req.text, Tokenizer("portuguese"))
        summarizer = LsaSummarizer()
        
        # Summarize to 3 sentences
        sentences = summarizer(parser.document, 4)
        summary = " ".join(str(s) for s in sentences)
        
        if not summary.strip():
            summary = req.text[:500] + "..." if len(req.text) > 500 else req.text
            
        return {"summary": summary}
    except Exception as e:
        print(f"Summary error: {e}")
        return {"summary": req.text[:500] + "..." if len(req.text) > 500 else req.text}

@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket connected")
    
    try:
        while True:
            # Receive audio chunk (binary)
            data = await websocket.receive_bytes()
            
            # Temporary save chunk to disk for Whisper (Whisper needs a file/buffer)
            chunk_id = str(uuid.uuid4())
            chunk_path = os.path.join(UPLOAD_DIR, f"chunk_{chunk_id}.wav")
            
            with open(chunk_path, "wb") as f:
                f.write(data)
            
            try:
                # Transcribe small chunk
                # Note: In a real scenario, we'd use a rolling buffer
                result = transcriber_service.transcribe(chunk_path, diarize=False)
                await websocket.send_json({
                    "text": result["text"],
                    "partial": True
                })
            finally:
                if os.path.exists(chunk_path):
                    os.remove(chunk_path)
                    
    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
