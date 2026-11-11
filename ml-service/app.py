import hmac
import logging
import os
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from services.model_service import ModelRegistry, TrainingError, registry

API_KEY = os.getenv("ML_SERVICE_API_KEY")
if not API_KEY or len(API_KEY) < 32:
    raise RuntimeError("ML_SERVICE_API_KEY must contain at least 32 characters.")

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
app = FastAPI(title="EduPredict Machine Learning Service", version="1.0.0")


class TrainingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    records: list[dict[str, Any]] = Field(min_length=1, max_length=100_000)


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    features: dict[str, Any] = Field(min_length=1, max_length=20)


async def require_api_key(
    supplied_key: Annotated[str | None, Header(alias="X-ML-Service-Key")] = None,
) -> None:
    if not supplied_key or not hmac.compare_digest(supplied_key, API_KEY):
        raise HTTPException(status_code=401, detail="Invalid ML service credentials.")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/ml/train/{model_type}", dependencies=[Depends(require_api_key)])
def train_model(model_type: str, request: TrainingRequest) -> dict[str, Any]:
    try:
        result = registry.train(model_type, request.records)
        logging.getLogger("edupredict.ml").info(
            "Trained %s model using %s validated records.", model_type, result["datasetSize"]
        )
        return {"success": True, "data": result}
    except TrainingError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Training data could not be validated.") from error


@app.post("/api/ml/predict/{model_type}", dependencies=[Depends(require_api_key)])
def predict(model_type: str, request: PredictionRequest) -> dict[str, Any]:
    try:
        return {"success": True, "data": registry.predict(model_type, request.features)}
    except TrainingError as error:
        status = 409 if "has not been trained" in str(error) else 422
        raise HTTPException(status_code=status, detail=str(error)) from error


@app.get("/api/ml/models", dependencies=[Depends(require_api_key)])
def models() -> dict[str, Any]:
    return {"success": True, "data": registry.models()}


@app.get("/api/ml/models/{model_id}", dependencies=[Depends(require_api_key)])
def model_detail(model_id: str) -> dict[str, Any]:
    details = [
        item
        for model in registry.evaluation().values()
        for item in model["history"]
        if item["modelId"] == model_id
    ]
    if not details:
        raise HTTPException(status_code=404, detail="Model version not found.")
    return {"success": True, "data": details[0]}


@app.get("/api/ml/evaluation", dependencies=[Depends(require_api_key)])
def evaluation() -> dict[str, Any]:
    return {"success": True, "data": registry.evaluation()}


def create_registry(model_dir: str) -> ModelRegistry:
    return ModelRegistry(model_dir)
