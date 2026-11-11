import hashlib
import json
import logging
import math
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

LOGGER = logging.getLogger("edupredict.ml")
RANDOM_STATE = 42
SEED = RANDOM_STATE

PERFORMANCE_NUMERIC = [
    "previousGpa",
    "attendancePercentage",
    "assignmentAverage",
    "quizAverage",
    "midtermScore",
    "previousSemesterPerformance",
    "courseEnrollment",
    "semester",
]
PERFORMANCE_CATEGORICAL = ["department"]
DROPOUT_NUMERIC = [
    "attendancePercentage",
    "gpa",
    "failedCourses",
    "previousPerformance",
    "semesterProgression",
    "enrollmentHistory",
    "courseCompletionHistory",
]
DROPOUT_CATEGORICAL = ["department"]
DEMAND_NUMERIC = [
    "semester",
    "academicYearIndex",
    "previousEnrollment",
    "priorPreviousEnrollment",
    "demandTrend",
    "courseCompletionRate",
    "coursePopularity",
]
DEMAND_CATEGORICAL = ["department"]

TRAINING_CONFIG: dict[str, dict[str, Any]] = {
    "performance": {
        "numeric": PERFORMANCE_NUMERIC,
        "categorical": PERFORMANCE_CATEGORICAL,
        "minimumRows": 20,
        "target": "finalScore",
        "kind": "regression",
    },
    "dropout": {
        "numeric": DROPOUT_NUMERIC,
        "categorical": DROPOUT_CATEGORICAL,
        "minimumRows": 30,
        "target": "dropped",
        "kind": "classification",
    },
    "course-demand": {
        "numeric": DEMAND_NUMERIC,
        "categorical": DEMAND_CATEGORICAL,
        "minimumRows": 10,
        "target": "enrollment",
        "kind": "demand",
    },
}


class TrainingError(ValueError):
    """A validation or minimum-data error that is safe to show to API clients."""


class IqrCapper(BaseEstimator, TransformerMixin):
    def fit(self, values: pd.DataFrame, y: Any = None) -> "IqrCapper":
        frame = pd.DataFrame(values)
        first = frame.quantile(0.25)
        third = frame.quantile(0.75)
        spread = third - first
        self.lower_ = first - 1.5 * spread
        self.upper_ = third + 1.5 * spread
        return self

    def transform(self, values: pd.DataFrame) -> pd.DataFrame:
        frame = pd.DataFrame(values).copy()
        return frame.clip(self.lower_, self.upper_, axis="columns")


def _pipeline(
    numeric_features: list[str], categorical_features: list[str], estimator: Any, scale: bool
) -> Pipeline:
    numeric_steps: list[tuple[str, Any]] = [
        ("imputer", SimpleImputer(strategy="median", keep_empty_features=True)),
        ("outlier_capper", IqrCapper()),
    ]
    if scale:
        numeric_steps.append(("scaler", StandardScaler()))
    categorical = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="most_frequent", keep_empty_features=True)),
            ("encoder", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    preprocess = ColumnTransformer(
        [
            ("numeric", Pipeline(numeric_steps), numeric_features),
            ("categorical", categorical, categorical_features),
        ],
        remainder="drop",
    )
    return Pipeline([("preprocess", preprocess), ("model", estimator)])


def _candidates(kind: str) -> dict[str, tuple[Any, bool]]:
    if kind == "regression":
        return {
            "Linear Regression": (LinearRegression(), True),
            "Random Forest Regressor": (
                RandomForestRegressor(n_estimators=200, min_samples_leaf=2, random_state=SEED),
                False,
            ),
            "Gradient Boosting Regressor": (
                GradientBoostingRegressor(n_estimators=100, random_state=SEED),
                False,
            ),
        }
    if kind == "classification":
        return {
            "Logistic Regression": (
                LogisticRegression(max_iter=1000, class_weight="balanced", random_state=SEED),
                True,
            ),
            "Random Forest Classifier": (
                RandomForestClassifier(
                    n_estimators=200, min_samples_leaf=2, class_weight="balanced", random_state=SEED
                ),
                False,
            ),
            "Gradient Boosting Classifier": (
                GradientBoostingClassifier(n_estimators=100, random_state=SEED),
                False,
            ),
        }
    return {
        "Linear Regression": (LinearRegression(), True),
        "Random Forest Regressor": (
            RandomForestRegressor(n_estimators=200, min_samples_leaf=2, random_state=SEED),
            False,
        ),
        "Gradient Boosting Regressor": (
            GradientBoostingRegressor(n_estimators=100, random_state=SEED),
            False,
        ),
    }


def _validate_records(
    model_type: str, records: list[dict[str, Any]]
) -> tuple[pd.DataFrame, pd.Series, dict[str, Any]]:
    if not isinstance(records, list) or not records:
        raise TrainingError("Provide validated historical academic records to train this model.")
    if len(records) > 100_000:
        raise TrainingError("A training request may contain at most 100,000 records.")
    config = TRAINING_CONFIG[model_type]
    data = pd.DataFrame.from_records(records)
    target = config["target"]
    required_features = config["numeric"] + config["categorical"]
    if target not in data:
        raise TrainingError(f"Training records must include the '{target}' outcome.")
    missing_features = [name for name in required_features if name not in data.columns]
    if missing_features:
        raise TrainingError(f"Training records are missing required features: {', '.join(missing_features)}.")

    if model_type not in {"performance", "dropout"} or "snapshotDate" not in data:
        raise TrainingError("Training records must include their historical prediction-date snapshot.")
    data = data[required_features + [target, "snapshotDate"]].drop_duplicates()
    data["_snapshot"] = pd.to_datetime(data["snapshotDate"], errors="coerce", utc=True)
    data = data.dropna(subset=["_snapshot"])
    for column in config["numeric"] + [target]:
        data[column] = pd.to_numeric(data[column], errors="coerce")
        data.loc[~np.isfinite(data[column]), column] = np.nan
    data = data.dropna(subset=[target])
    for column in config["categorical"]:
        data[column] = data[column].apply(
            lambda value: str(value).strip()[:100] if pd.notna(value) and str(value).strip() else np.nan
        )
    data = data.dropna(subset=config["numeric"] + config["categorical"], how="all")
    if len(data) < config["minimumRows"]:
        raise TrainingError(
            f"At least {config['minimumRows']} valid, unique historical records are required; "
            f"only {len(data)} were available."
        )

    features = data[required_features]
    target_values = data[target]
    if config["kind"] == "regression":
        target_values = target_values.clip(0, 100)
        if target_values.nunique() < 3:
            raise TrainingError("At least three distinct outcome values are required for regression.")
    elif config["kind"] == "classification":
        target_values = target_values.astype(int)
        if not set(target_values.unique()).issubset({0, 1}):
            raise TrainingError("Dropout outcomes must be binary values (0 or 1).")
        counts = target_values.value_counts()
        if len(counts) != 2 or int(counts.min()) < 8:
            raise TrainingError("At least 8 completed and 8 dropped enrollment records are required.")
    data = data.reset_index(drop=True)
    features = data[required_features]
    target_values = data[target].reset_index(drop=True)
    return features, target_values, {**config, "snapshots": data["_snapshot"]}


def _period_sort_key(record: dict[str, Any]) -> tuple[int, int]:
    year = str(record.get("academicYear", ""))
    match = re.search(r"(?:19|20)\d{2}", year)
    year_value = int(match.group()) if match else -1
    semester = int(record.get("semester", 0))
    return year_value * 10 + semester, semester


def _demand_training_rows(records: list[dict[str, Any]]) -> tuple[pd.DataFrame, pd.Series]:
    if not isinstance(records, list) or not records:
        raise TrainingError("Provide actual historical course-enrollment totals to train this model.")
    if len(records) > 100_000:
        raise TrainingError("A training request may contain at most 100,000 records.")

    grouped: dict[tuple[str, str, int], dict[str, Any]] = {}
    seen_periods: set[tuple[int, int]] = set()
    for record in records:
        course = record.get("courseCode")
        year = record.get("academicYear")
        semester = record.get("semester")
        count = record.get("enrollment")
        if (
            not isinstance(course, str)
            or not course.strip()
            or not isinstance(year, str)
            or not year.strip()
            or isinstance(semester, bool)
            or not isinstance(semester, (int, float))
            or not float(semester).is_integer()
            or not 1 <= int(semester) <= 20
            or isinstance(count, bool)
            or not isinstance(count, (int, float))
            or not math.isfinite(float(count))
            or count < 0
        ):
            continue
        key = (course.strip()[:100], year.strip()[:20], int(semester))
        if key in grouped:
            raise TrainingError("Historical demand input contains duplicate course-period totals.")
        grouped[key] = {
            **record,
            "courseCode": key[0],
            "academicYear": key[1],
            "semester": key[2],
            "enrollment": int(count),
        }
        period_key = _period_sort_key(grouped[key])
        seen_periods.add(period_key)

    if len(seen_periods) < 4:
        raise TrainingError(
            "Course-demand forecasting is not reliable yet: at least 4 distinct academic periods are required."
        )

    ordered = sorted(grouped.values(), key=lambda row: (_period_sort_key(row), row["courseCode"]))
    course_histories: dict[str, list[dict[str, Any]]] = {}
    for record in ordered:
        course_histories.setdefault(record["courseCode"], []).append(record)

    rows: list[dict[str, Any]] = []
    for course_records in course_histories.values():
        for index in range(1, len(course_records)):
            previous = course_records[index - 1]
            current = course_records[index]
            previous_count = previous["enrollment"]
            prior_count = course_records[index - 2]["enrollment"] if index > 1 else previous_count
            previous_rate = previous.get("courseCompletionRate")
            try:
                previous_rate_value = float(previous_rate)
            except (TypeError, ValueError):
                previous_rate_value = np.nan
            period_key = _period_sort_key(current)
            rows.append(
                {
                    "semester": current["semester"],
                    "academicYearIndex": period_key[0],
                    "previousEnrollment": previous_count,
                    "priorPreviousEnrollment": prior_count,
                    "demandTrend": previous_count - prior_count,
                    "courseCompletionRate": previous_rate_value,
                    "coursePopularity": previous_count,
                    "department": current.get("department"),
                    "enrollment": current["enrollment"],
                    "_period": period_key,
                }
            )
    if len(rows) < TRAINING_CONFIG["course-demand"]["minimumRows"]:
        raise TrainingError(
            "At least 10 sequential course-period observations across the available history are required."
        )

    data = pd.DataFrame(rows)
    feature_columns = DEMAND_NUMERIC + DEMAND_CATEGORICAL
    for column in DEMAND_NUMERIC:
        data[column] = pd.to_numeric(data[column], errors="coerce")
        data.loc[~np.isfinite(data[column]), column] = np.nan
    data["department"] = data["department"].apply(
        lambda value: str(value).strip()[:100] if pd.notna(value) and str(value).strip() else np.nan
    )
    data = data.dropna(subset=["enrollment"])
    return data[feature_columns], data["enrollment"], data


class ModelRegistry:
    def __init__(self, model_dir: str | Path | None = None) -> None:
        self.model_dir = Path(model_dir or os.getenv("ML_MODEL_DIR", Path(__file__).parents[1] / "saved_models"))
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self._active: dict[str, dict[str, Any]] = {}
        self._history: dict[str, list[dict[str, Any]]] = {name: [] for name in TRAINING_CONFIG}
        self._lock = threading.RLock()
        self._load_internal_models()

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as model_file:
            for block in iter(lambda: model_file.read(1024 * 1024), b""):
                digest.update(block)
        return digest.hexdigest()

    def _load_internal_models(self) -> None:
        root = self.model_dir.resolve()
        for metadata_path in sorted(root.glob("*.json")):
            try:
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                model_name = metadata.get("modelType")
                filename = metadata.get("artifact")
                if (
                    model_name not in TRAINING_CONFIG
                    or not isinstance(filename, str)
                    or not re.fullmatch(r"[a-f0-9-]+\.joblib", filename)
                ):
                    continue
                artifact_path = (root / filename).resolve(strict=True)
                if artifact_path.parent != root or self._sha256(artifact_path) != metadata.get("artifactSha256"):
                    LOGGER.warning("Skipping a model artifact with an invalid path or checksum.")
                    continue
                model = joblib.load(artifact_path)
                entry = {"metadata": metadata, "pipeline": model}
                self._history[model_name].append(metadata)
                active = self._active.get(model_name)
                if active is None or metadata.get("trainedAt", "") > active["metadata"].get("trainedAt", ""):
                    self._active[model_name] = entry
            except (OSError, ValueError, TypeError, json.JSONDecodeError, EOFError) as error:
                LOGGER.warning("Unable to load an internal model manifest (%s).", type(error).__name__)

    def train(self, model_type: str, records: list[dict[str, Any]]) -> dict[str, Any]:
        with self._lock:
            if model_type == "course-demand":
                features, target, demand_rows = _demand_training_rows(records)
                config = TRAINING_CONFIG[model_type]
                split_periods = sorted({row for row in demand_rows["_period"]})
                test_periods = max(1, math.ceil(len(split_periods) * 0.2))
                holdout = set(split_periods[-test_periods:])
                train_mask = ~demand_rows["_period"].isin(holdout)
                test_mask = demand_rows["_period"].isin(holdout)
                train_indices = np.flatnonzero(train_mask.to_numpy())
                test_indices = np.flatnonzero(test_mask.to_numpy())
                if len(train_indices) < 8 or not len(test_indices):
                    raise TrainingError("There is not enough historical demand to make a chronological test split.")
                x_train, x_test = features.iloc[train_indices], features.iloc[test_indices]
                y_train, y_test = target.iloc[train_indices], target.iloc[test_indices]
            else:
                features, target, config = _validate_records(model_type, records)
                snapshots = config["snapshots"]
                unique_snapshots = sorted(snapshots.unique())
                if len(unique_snapshots) < 2:
                    raise TrainingError(
                        "At least two distinct historical snapshot dates are required for leakage-safe evaluation."
                    )
                test_dates = max(1, math.ceil(len(unique_snapshots) * 0.2))
                holdout = set(unique_snapshots[-test_dates:])
                test_mask = snapshots.isin(holdout)
                train_indices = np.flatnonzero((~test_mask).to_numpy())
                test_indices = np.flatnonzero(test_mask.to_numpy())
                if len(train_indices) < 8 or not len(test_indices):
                    raise TrainingError(
                        "There is not enough historical data for a chronological train/test split."
                    )
                x_train, x_test = features.iloc[train_indices], features.iloc[test_indices]
                y_train, y_test = target.iloc[train_indices], target.iloc[test_indices]
                if config["kind"] == "classification" and (
                    y_train.nunique() != 2 or y_test.nunique() != 2
                ):
                    raise TrainingError(
                        "Both completed and dropped outcomes must be represented in the chronological holdout."
                    )

            candidate_results: list[dict[str, Any]] = []
            for name, (estimator, scale) in _candidates(config["kind"]).items():
                candidate = _pipeline(config["numeric"], config["categorical"], estimator, scale)
                candidate.fit(x_train, y_train)
                predictions = candidate.predict(x_test)
                if config["kind"] in {"regression", "demand"}:
                    mse = float(mean_squared_error(y_test, predictions))
                    metrics = {
                        "mae": float(mean_absolute_error(y_test, predictions)),
                        "mse": mse,
                        "rmse": float(math.sqrt(mse)),
                        "r2": (
                            float(r2_score(y_test, predictions))
                            if len(y_test) > 1 and y_test.nunique() > 1
                            else None
                        ),
                    }
                    score = metrics["rmse"]
                else:
                    probabilities = candidate.predict_proba(x_test)[:, 1]
                    metrics = {
                        "accuracy": float(accuracy_score(y_test, predictions)),
                        "precision": float(precision_score(y_test, predictions, zero_division=0)),
                        "recall": float(recall_score(y_test, predictions, zero_division=0)),
                        "f1": float(f1_score(y_test, predictions, zero_division=0)),
                        "rocAuc": float(roc_auc_score(y_test, probabilities)),
                        "confusionMatrix": confusion_matrix(y_test, predictions, labels=[0, 1]).tolist(),
                    }
                    score = metrics["recall"]
                candidate_results.append(
                    {"algorithm": name, "pipeline": candidate, "metrics": metrics, "selectionScore": score}
                )

            if config["kind"] == "classification":
                selected = max(
                    candidate_results,
                    key=lambda result: (result["selectionScore"], result["metrics"]["f1"]),
                )
                selection_metric = "recall"
            else:
                selected = min(candidate_results, key=lambda result: result["selectionScore"])
                selection_metric = "rmse"

            model_id = str(uuid.uuid4())
            version = f"1.0.{len(self._history[model_type]) + 1}"
            artifact_name = f"{model_id}.joblib"
            artifact_path = self.model_dir / artifact_name
            temporary_path = self.model_dir / f".{model_id}.joblib.tmp"
            metadata = {
                "modelId": model_id,
                "modelType": model_type,
                "modelName": model_type.replace("-", " ").title(),
                "algorithm": selected["algorithm"],
                "modelVersion": version,
                "status": "trained",
                "trainedAt": datetime.now(timezone.utc).isoformat(),
                "datasetSize": int(len(features)),
                "trainingSize": int(len(x_train)),
                "testSize": int(len(x_test)),
                "featureList": config["numeric"] + config["categorical"],
                "metrics": selected["metrics"],
                "selectionMetric": selection_metric,
                "selectionRule": (
                    "Highest dropout-class recall, then F1, on a stratified holdout set."
                    if config["kind"] == "classification"
                    else "Lowest RMSE on a held-out test set."
                ),
                "candidates": [
                    {"algorithm": result["algorithm"], "metrics": result["metrics"]}
                    for result in candidate_results
                ],
                "dataSplit": (
                    "Chronological holdout using the latest academic periods."
                    if model_type == "course-demand"
                    else "Chronological holdout using the latest historical snapshot dates."
                ),
            }
            try:
                joblib.dump(selected["pipeline"], temporary_path)
                os.replace(temporary_path, artifact_path)
                metadata["artifact"] = artifact_name
                metadata["artifactSha256"] = self._sha256(artifact_path)
                manifest_path = self.model_dir / f"{model_id}.json"
                manifest_temp = self.model_dir / f".{model_id}.json.tmp"
                manifest_temp.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
                os.replace(manifest_temp, manifest_path)
            except OSError:
                temporary_path.unlink(missing_ok=True)
                artifact_path.unlink(missing_ok=True)
                raise

            self._active[model_type] = {"metadata": metadata, "pipeline": selected["pipeline"]}
            self._history[model_type].append(metadata)
            return self._public_metadata(metadata)

    @staticmethod
    def _public_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
        return {key: value for key, value in metadata.items() if not key.startswith("artifact")}

    def models(self) -> list[dict[str, Any]]:
        return [
            {
                "modelType": model_type,
                "status": "trained" if model_type in self._active else "not-trained",
                "active": self._public_metadata(self._active[model_type]["metadata"])
                if model_type in self._active
                else None,
            }
            for model_type in TRAINING_CONFIG
        ]

    def evaluation(self) -> dict[str, Any]:
        return {
            model_type: {
                "status": "trained" if model_type in self._active else "not-trained",
                "active": self._public_metadata(self._active[model_type]["metadata"])
                if model_type in self._active
                else None,
                "history": [self._public_metadata(item) for item in self._history[model_type]],
            }
            for model_type in TRAINING_CONFIG
        }

    def get_model(self, model_type: str) -> dict[str, Any]:
        entry = self._active.get(model_type)
        if not entry:
            raise TrainingError(f"The {model_type} model has not been trained on sufficient historical data.")
        return entry

    def predict(self, model_type: str, features: dict[str, Any]) -> dict[str, Any]:
        entry = self.get_model(model_type)
        config = TRAINING_CONFIG[model_type]
        columns = config["numeric"] + config["categorical"]
        row: dict[str, Any] = {}
        for name in columns:
            value = features.get(name)
            if name in config["numeric"]:
                if value is None:
                    row[name] = np.nan
                    continue
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                    raise TrainingError(f"Feature '{name}' must be a finite number.")
                row[name] = float(value)
            else:
                if value is not None and not isinstance(value, str):
                    raise TrainingError(f"Feature '{name}' must be a string.")
                row[name] = value
        frame = pd.DataFrame([row], columns=columns)

        if model_type == "performance":
            score = float(np.clip(entry["pipeline"].predict(frame)[0], 0, 100))
            return {
                "predictedFinalScore": round(score, 2),
                "predictedGrade": _grade(score),
                "expectedGpa": round(score / 25, 2),
                "performanceCategory": _performance_category(score),
                "modelId": entry["metadata"]["modelId"],
                "modelName": entry["metadata"]["modelName"],
                "modelVersion": entry["metadata"]["modelVersion"],
                "featuresUsed": columns,
            }

        if model_type == "dropout":
            probabilities = entry["pipeline"].predict_proba(frame)[0]
            classes = list(entry["pipeline"].named_steps["model"].classes_)
            probability = float(probabilities[classes.index(1)])
            level = "High Risk" if probability >= 0.6 else "Medium Risk" if probability >= 0.3 else "Low Risk"
            factors = _risk_factors(features)
            recommendations = _recommendations(factors, level)
            return {
                "riskLevel": level,
                "riskProbability": round(probability, 4),
                "mainContributingFactors": factors,
                "recommendations": recommendations,
                "disclaimer": "This is an estimated risk, not a prediction of certainty or proof of causation.",
                "modelId": entry["metadata"]["modelId"],
                "modelName": entry["metadata"]["modelName"],
                "modelVersion": entry["metadata"]["modelVersion"],
                "featuresUsed": columns,
            }

        enrollment = max(0, float(entry["pipeline"].predict(frame)[0]))
        previous = float(features.get("previousEnrollment") or 0)
        trend_delta = enrollment - previous
        category = "High Demand" if enrollment >= 100 else "Medium Demand" if enrollment >= 30 else "Low Demand"
        trend = "Increasing" if trend_delta > 2 else "Decreasing" if trend_delta < -2 else "Stable"
        return {
            "predictedEnrollment": int(round(enrollment)),
            "demandCategory": category,
            "expectedDemandTrend": trend,
            "modelId": entry["metadata"]["modelId"],
            "modelName": entry["metadata"]["modelName"],
            "modelVersion": entry["metadata"]["modelVersion"],
            "featuresUsed": columns,
        }


def _grade(score: float) -> str:
    return "A" if score >= 90 else "B" if score >= 80 else "C" if score >= 70 else "D" if score >= 60 else "F"


def _performance_category(score: float) -> str:
    return (
        "Excellent" if score >= 90 else
        "Good" if score >= 80 else
        "Average" if score >= 70 else
        "Below Average" if score >= 60 else
        "At Risk"
    )


def _risk_factors(features: dict[str, Any]) -> list[dict[str, Any]]:
    indicators: list[dict[str, Any]] = []
    checks = [
        ("attendancePercentage", lambda value: value < 75, "Attendance below 75%"),
        ("gpa", lambda value: value < 2, "GPA below 2.0"),
        ("failedCourses", lambda value: value >= 1, "Previous failed course(s)"),
        ("previousPerformance", lambda value: value < 60, "Previous performance below 60"),
        ("courseCompletionHistory", lambda value: value < 60, "Course completion below 60%"),
    ]
    for feature, condition, label in checks:
        value = features.get(feature)
        if isinstance(value, (int, float)) and not isinstance(value, bool) and condition(value):
            indicators.append({"feature": feature, "value": value, "indicator": label})
    return indicators or [
        {
            "feature": "modelEstimate",
            "value": None,
            "indicator": "Risk estimate reflects patterns in the historical training data; it is not causal.",
        }
    ]


def _recommendations(factors: list[dict[str, Any]], risk_level: str) -> list[str]:
    recommendations: list[str] = []
    factor_names = {factor["feature"] for factor in factors}
    if "attendancePercentage" in factor_names:
        recommendations.append("Consider academic attendance support.")
    if "gpa" in factor_names or "previousPerformance" in factor_names:
        recommendations.append("Recommend additional academic guidance.")
    if "failedCourses" in factor_names or "courseCompletionHistory" in factor_names:
        recommendations.append("Suggest subject-specific tutoring.")
    if risk_level == "High Risk":
        recommendations.append("Offer a referral for supportive academic advising.")
    return recommendations or ["Continue regular academic check-ins and review progress."]


registry = ModelRegistry()
