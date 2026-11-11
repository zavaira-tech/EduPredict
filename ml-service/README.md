# EduPredict ML service

This FastAPI service trains and serves performance, dropout-risk, and course-demand models. It has no MongoDB connection: the authenticated Express backend selects real academic records, removes direct identifiers, and sends only the model features and outcomes required for each task. The service must not be exposed directly to browsers or public networks.

## Windows setup (PowerShell)

Use Python 3.11–3.13 for the supported scikit-learn runtime.

```powershell
cd ml-service
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
$env:ML_SERVICE_API_KEY = [guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
uvicorn app:app --host 127.0.0.1 --port 8000
```

Set the same `ML_SERVICE_API_KEY` in `backend/.env`, along with
`ML_SERVICE_URL=http://127.0.0.1:8000`. Configure both values only in local
environment files; do not commit secrets. Use HTTPS and a private network
between services when deploying them on different hosts. The service rejects
startup without a 32-character secret. Model artifacts are written beneath
`saved_models/`; restrict write access to the service account and never copy
user-supplied Joblib/pickle files into that directory. The service checks its
own artifact manifest and checksum when restoring models.

## Training and data requirements

Training is triggered manually by an administrator through the Express API;
ordinary prediction requests never trigger training. The backend filters
academic records using the role-independent training boundary and sends no
student names, email addresses, or account identifiers.

* **Performance:** at least 20 unique records with real final scores and
  pre-final assessment features. Candidates are compared on a reproducible
  20% holdout split using MAE, MSE, RMSE, and R². Lower RMSE selects the model.
* **Dropout:** at least 30 completed/dropped enrollment records, including at
  least 8 records from each outcome class. Active enrollments are censored and
  excluded. A stratified holdout is used. Highest dropout-class recall wins,
  with F1 as a tie-breaker.
* **Course demand:** at least 4 distinct periods and 10 sequential
  course-period observations. The latest periods are held out chronologically.
  When those requirements are not met the endpoint returns a clear 422 error;
  no records or metrics are fabricated.

Each successful run writes an immutable version and its evaluation metadata.
The previously active model remains available unless a replacement has trained
and evaluated successfully. Evaluation returns `not-trained` for an untrained
model and does not invent metrics.

Features use values known by the prediction date. Regression and classification
pipelines impute missing input features, encode departments, scale linear
models, and use a fixed random seed. Course demand uses only lagged enrollment
counts. Predictions are estimates, not causal explanations or decisions;
academic support suggestions are non-punitive. Synthetic examples are used
only in automated tests and are never used by the application for training.

## API

All `/api/ml/*` routes require the `X-ML-Service-Key` header and are intended
for calls from the backend only. `GET /health` is a liveness endpoint and does
not return data or model details.
