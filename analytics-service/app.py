import hmac
import os
from math import isfinite
from typing import Annotated

import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

API_KEY = os.getenv("ANALYTICS_SERVICE_API_KEY")
if not API_KEY:
    raise RuntimeError("ANALYTICS_SERVICE_API_KEY must be configured before starting the service.")

app = FastAPI(title="EduPredict Analytics Service", version="1.0.0")


class CorrelationRequest(BaseModel):
    x: list[float] = Field(min_length=2, max_length=10000)
    y: list[float] = Field(min_length=2, max_length=10000)


class ValueRecord(BaseModel):
    entityId: str = Field(min_length=1, max_length=100)
    value: float


class SeriesRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    values: list[ValueRecord] = Field(min_length=4, max_length=10000)


class OutlierRequest(BaseModel):
    series: list[SeriesRequest] = Field(min_length=1, max_length=20)


async def require_api_key(
    supplied_key: Annotated[str | None, Header(alias="X-Analytics-Key")] = None,
) -> None:
    if not supplied_key or not hmac.compare_digest(supplied_key, API_KEY):
        raise HTTPException(status_code=401, detail="Invalid analytics service credentials.")


def validate_finite(values: list[float]) -> None:
    if any(not isfinite(value) for value in values):
        raise HTTPException(status_code=422, detail="All measurements must be finite numbers.")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze/correlation", dependencies=[Depends(require_api_key)])
async def correlation(request: CorrelationRequest) -> dict[str, int | float | str | None]:
    if len(request.x) != len(request.y):
        raise HTTPException(status_code=422, detail="The x and y arrays must have equal lengths.")
    validate_finite(request.x)
    validate_finite(request.y)

    sample = pd.DataFrame({"x": request.x, "y": request.y}).dropna()
    coefficient = None
    if len(sample) >= 2 and sample["x"].nunique() > 1 and sample["y"].nunique() > 1:
        value = float(np.corrcoef(sample["x"].to_numpy(), sample["y"].to_numpy())[0, 1])
        coefficient = round(value, 3) if isfinite(value) else None
    return {"method": "Pearson", "sampleSize": int(len(sample)), "coefficient": coefficient}


@app.post("/analyze/outliers", dependencies=[Depends(require_api_key)])
async def outliers(request: OutlierRequest) -> dict[str, list[dict[str, object]]]:
    results: list[dict[str, object]] = []
    for series in request.series:
        values = [record.value for record in series.values]
        validate_finite(values)
        measurements = pd.Series(values, dtype="float64")
        q1 = float(measurements.quantile(0.25))
        q3 = float(measurements.quantile(0.75))
        spread = q3 - q1
        lower = q1 - 1.5 * spread
        upper = q3 + 1.5 * spread
        mean = float(measurements.mean())
        standard_deviation = float(measurements.std(ddof=0))

        for record in series.values:
            z_score = (record.value - mean) / standard_deviation if standard_deviation else 0.0
            if record.value < lower or record.value > upper or abs(z_score) >= 3:
                results.append({
                    "series": series.name,
                    "entityId": record.entityId,
                    "value": record.value,
                    "lowerFence": round(lower, 3),
                    "upperFence": round(upper, 3),
                    "zScore": round(z_score, 3),
                    "method": "IQR and z-score",
                })
    return {"outliers": results}
