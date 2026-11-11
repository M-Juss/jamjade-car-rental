import copy
import unittest

import numpy as np

import train_pilot as trainer


def fixture():
    records, rows = [], []
    for session in range(1, 4):
        record = {"recording_id": f"record-{session}", "session_id": f"session-{session}",
                  "session_number": session, "partition": "development", "code": f"S{session:02d}-FSS-R001"}
        records.append(record)
        for category, target in enumerate(trainer.CLASSES):
            for repeat in range(2):
                rows.append({"interval_id": f"{session}-{category}-{repeat}",
                             "recording_id": record["recording_id"], "session_id": record["session_id"], "target": target,
                             "metadata": {"role": "supervised_target", "start_ms": 0, "end_ms": 200},
                             "features": {column: category + session * 0.01 + repeat * 0.001 for column in trainer.COLUMNS}})
    return {"schema": trainer.VERSION, "recordings": records, "features": {
        "schema": "rc-interval-statistics-v1", "source": {"partition": "development", "files": records},
        "definition": {"feature_columns": trainer.COLUMNS}, "examples": rows}}


class PilotTrainingTests(unittest.TestCase):
    def test_grouped_folds_hold_every_example_out_once(self):
        matrix, targets, groups, _, _ = trainer.dataset(fixture())
        splits = trainer.folds(matrix, targets, groups)
        self.assertEqual(len(splits), 3)
        seen = []
        for train, held in splits:
            self.assertFalse(set(groups[train]) & set(groups[held]))
            seen.extend(held.tolist())
        self.assertEqual(sorted(seen), list(range(30)))

    def test_labels_and_identity_never_enter_the_matrix(self):
        payload = fixture()
        matrix, _, _, _, _ = trainer.dataset(payload)
        for record in payload["recordings"]:
            record["code"] = "HA-HB-fake-name"
        for row in payload["features"]["examples"]:
            row["metadata"]["end_ms"] = 9000
        changed, _, _, _, _ = trainer.dataset(payload)
        np.testing.assert_array_equal(matrix, changed)
        self.assertEqual(matrix.shape, (30, 30))

    def test_rejects_reserved_and_conflicting_or_invalid_evidence(self):
        mutations = {
            "reserved partition": lambda p: p["features"]["source"].update(partition="final_evaluation"),
            "reserved recording": lambda p: p["recordings"][0].update(partition="final_evaluation"),
            "session mismatch": lambda p: p["features"]["examples"][0].update(session_id="other"),
            "duplicate interval": lambda p: p["features"]["examples"][1].update(interval_id="1-0-0"),
            "unknown class": lambda p: p["features"]["examples"][0].update(target="unknown"),
            "context": lambda p: p["features"]["examples"][0]["metadata"].update(role="stationary_context"),
            "extra feature": lambda p: p["features"]["examples"][0]["features"].update(session_number=1),
            "nan": lambda p: p["features"]["examples"][0]["features"].update(acceleration_forward_mean=float("nan")),
        }
        for name, mutate in mutations.items():
            with self.subTest(name=name):
                payload = fixture()
                mutate(payload)
                with self.assertRaises(ValueError):
                    trainer.dataset(payload)

    def test_training_fold_must_contain_every_target(self):
        payload = fixture()
        payload["features"]["examples"] = [row for row in payload["features"]["examples"]
                                            if row["target"] != "harsh_braking" or row["session_id"] == "session-1"]
        matrix, targets, groups, _, _ = trainer.dataset(payload)
        with self.assertRaisesRegex(ValueError, "missing a target"):
            trainer.folds(matrix, targets, groups)

    def test_scaler_fits_only_the_current_training_fold(self):
        matrix, targets, groups, _, _ = trainer.dataset(fixture())
        train, held = trainer.folds(matrix, targets, groups)[0]
        estimator = trainer.models()["balanced_logistic"]
        estimator.fit(matrix[train], targets[train])
        np.testing.assert_allclose(estimator[0].mean_, matrix[train].mean(axis=0))
        self.assertFalse(np.allclose(estimator[0].mean_, matrix.mean(axis=0)))

    def test_dummy_accuracy_cannot_hide_zero_harsh_recall(self):
        actual = ["normal_motion"] * 8 + ["harsh_acceleration", "harsh_braking"]
        report = trainer.metrics(actual, ["normal_motion"] * 10)
        self.assertEqual(report["accuracy"], 0.8)
        self.assertEqual(report["per_class"]["harsh_braking"]["recall"], 0.0)
        self.assertLess(report["macro_f1_fixed_five_classes"], 0.2)

    def test_trains_all_comparisons_and_round_trips_saved_models(self):
        result = trainer.train(copy.deepcopy(fixture()))
        self.assertFalse(result["protocol"]["final_evaluation_used"])
        self.assertEqual(result["summary"]["examples"], 30)
        self.assertEqual(set(result["models"]), set(trainer.models()))
        for comparison in result["comparisons"].values():
            predictions = comparison["out_of_session_predictions"]
            self.assertEqual(len({row["interval_id"] for row in predictions}), 30)
            self.assertEqual(sum(sum(row) for row in comparison["pooled_out_of_session"]["confusion_matrix_actual_rows_predicted_columns"]), 30)
            self.assertEqual(len(comparison["folds"]), 3)


if __name__ == "__main__":
    unittest.main()
