# apps/ml-service/main.py
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

import uvicorn
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware

from schemas import AnalyzeRequest, AnalyzeResponse
from analysis_service import SpamAnalysisService, get_analysis_service


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    service = get_analysis_service()
    try:
        service.load_model()
        print("[ML Service] Ready ✓")
    except FileNotFoundError as e:
        print(f"[ML Service] WARNING: {e}")
        print("[ML Service] Running without model — train first!")
    yield


app = FastAPI(
    title="Spam Detection ML Service",
    description="Ensemble BiLSTM + TF-IDF spam classifier",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000"],   # тільки NestJS gateway
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "spam-detection-ml"}


@app.post(
    "/analyze",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_200_OK,
)
async def analyze(
    request: AnalyzeRequest,
    service: SpamAnalysisService = Depends(get_analysis_service),
) -> AnalyzeResponse:
    try:
        return service.analyze(request)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error: {type(e).__name__}: {e}",
        )


@app.post("/train")
async def train(
    file: UploadFile = File(...),
    service: SpamAnalysisService = Depends(get_analysis_service),
) -> dict:
    name = (file.filename or "").lower()
    if name and not name.endswith((".csv", ".tsv", ".txt", "")) and "." in name:
        ext = name.rsplit(".", 1)[-1]
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type .{ext} — use .csv, .tsv, .txt or no extension",
        )
    contents = await file.read()
    try:
        return service.train_from_csv(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Training failed: {type(e).__name__}: {e}",
        )


@app.get("/model/info")
async def model_info() -> dict[str, object]:
    from pathlib import Path
    import json
    p = Path("artifacts/model/metrics.json")
    return json.loads(p.read_text()) if p.exists() else {"status": "no metrics"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=True,
        log_level=os.getenv("LOG_LEVEL", "info"),
    )