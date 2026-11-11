import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

from services.model_service import ModelRegistry, TrainingError, _demand_training_rows, _validate_records


def performance_records(count: int = 40) -> list[dict[str, object]]:
    start = date(2024, 1, 1)
    return [
        {
            "previousGpa": 1.5 + (index % 25) / 10,
            "attendancePercentage": 55 + (index * 7) % 46,
            "assignmentAverage": 35 + (index * 11) % 66,
            "quizAverage": 30 + (index * 13) % 71,
            "midtermScore": 25 + (index * 17) % 76,
            "previousSemesterPerformance": 40 + (index * 5) % 61,
            "courseEnrollment": 20 + index,
            "semester": 1 + index % 8,
            "department": "Science" if index % 2 else "Arts",
            "finalScore": 30 + (index * 9) % 71,
            "snapshotDate": f"{start + timedelta(days=index)}T12:00:00Z",
        }
        for index in range(count)
    ]


def dropout_records(count: int = 64) -> list[dict[str, object]]:
    records = []
    for index in range(count):
        dropped = index % 2
        records.append(
            {
                "attendancePercentage": 90 - dropped * 35 + index % 10,
                "gpa": 3.5 - dropped * 2 + (index % 7) / 10,
                "failedCourses": dropped + index % 3,
                "previousPerformance": 80 - dropped * 30 + index % 15,
                "semesterProgression": 1 + index % 8,
                "enrollmentHistory": 1 + index % 5,
                "courseCompletionHistory": 90 - dropped * 50 + index % 10,
                "department": "Science" if index % 2 else "Arts",
                "dropped": dropped,
                "snapshotDate": f"2024-{1 + index // 16:02d}-{1 + index % 16:02d}T12:00:00Z",
            }
        )
    return records


def demand_records() -> list[dict[str, object]]:
    return [
        {
            "courseCode": f"COURSE-{course}",
            "department": "Science" if course % 2 else "Arts",
            "academicYear": f"{2020 + term}-{2021 + term}",
            "semester": 1,
            "enrollment": 20 + course * 3 + term * (course + 2),
            "courseCompletionRate": 65 + term,
        }
        for course in range(4)
        for term in range(5)
    ]


class ModelServiceTests(unittest.TestCase):
    def test_preprocessing_deduplicates_and_accepts_missing_features(self) -> None:
        records = performance_records()
        records[0]["attendancePercentage"] = None
        features, target, _ = _validate_records("performance", records + [records[1]])
        self.assertEqual(len(features), 40)
        self.assertEqual(len(target), 40)

    def test_preprocessing_discards_out_of_range_records(self) -> None:
        records = performance_records()
        records[0]["finalScore"] = 120
        records[1]["attendancePercentage"] = 105
        features, target, _ = _validate_records("performance", records)
        self.assertEqual(len(features), 38)
        self.assertEqual(len(target), 38)

    def test_performance_model_trains_persists_and_predicts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            registry = ModelRegistry(Path(directory))
            trained = registry.train("performance", performance_records())
            self.assertIn("rmse", trained["metrics"])
            self.assertTrue(trained["featureImportance"])
            prediction = registry.predict("performance", performance_records()[-1])
            self.assertGreaterEqual(prediction["predictedFinalScore"], 0)
            self.assertLessEqual(prediction["predictedFinalScore"], 100)
            restored = ModelRegistry(Path(directory))
            self.assertEqual(restored.models()[0]["status"], "trained")
            self.assertEqual(restored.get_model("performance")["metadata"]["modelId"], trained["modelId"])

    def test_dropout_model_reports_classification_metrics(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            registry = ModelRegistry(Path(directory))
            trained = registry.train("dropout", dropout_records())
            self.assertIn("recall", trained["metrics"])
            self.assertIn("rocAuc", trained["metrics"])
            prediction = registry.predict("dropout", dropout_records()[0])
            self.assertIn(prediction["riskLevel"], {"Low Risk", "Medium Risk", "High Risk"})
            self.assertIn("riskProbability", prediction)
            self.assertIn("mainContributingFactors", prediction)

    def test_course_demand_model_uses_lagged_periods(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            registry = ModelRegistry(Path(directory))
            records = demand_records()
            trained = registry.train("course-demand", records)
            self.assertIn("rmse", trained["metrics"])
            self.assertEqual(trained["dataSplit"], "Chronological holdout using the latest academic periods.")
            prediction = registry.predict(
                "course-demand",
                {
                    "semester": 1,
                    "academicYearIndex": 20261,
                    "previousEnrollment": 40,
                    "priorPreviousEnrollment": 35,
                    "demandTrend": 5,
                    "courseCompletionRate": 80,
                    "coursePopularity": 40,
                    "department": "Science",
                },
            )
            self.assertGreaterEqual(prediction["predictedEnrollment"], 0)

    def test_course_demand_rejects_insufficient_history(self) -> None:
        records = [
            item for item in demand_records()
            if item["academicYear"] in {"2020-2021", "2021-2022"}
        ]
        with self.assertRaisesRegex(TrainingError, "at least 4 distinct academic periods"):
            _demand_training_rows(records)

    def test_failed_training_does_not_replace_active_model(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            registry = ModelRegistry(Path(directory))
            original = registry.train("performance", performance_records())
            with self.assertRaises(TrainingError):
                registry.train("performance", performance_records(5))
            self.assertEqual(
                registry.get_model("performance")["metadata"]["modelId"],
                original["modelId"],
            )


if __name__ == "__main__":
    unittest.main()
