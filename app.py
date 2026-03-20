import os
import shutil
import whisper
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import torch

app = FastAPI(title="Whisper Audio Transcriber")

# Load Whisper model (using base for efficiency)
print("Loading Whisper model...")
model = whisper.load_model("base")
print("Model loaded.")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse("static/index.html")

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    # Validate file type
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File provided is not an audio file.")

    # Save temp file
    temp_file_path = f"temp_{file.filename}"
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # Transcribe
        print(f"Transcribing {temp_file_path}...")
        result = model.transcribe(temp_file_path, fp16=False) # fp16=False for CPU compatibility
        return {"text": result["text"], "language": result.get("language", "unknown")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
