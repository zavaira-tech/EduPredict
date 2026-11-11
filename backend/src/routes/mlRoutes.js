import { Router } from "express";
import {
  getEvaluation,
  getModel,
  listModels,
  listPredictionHistory,
  predict,
  trainModel,
} from "../controllers/mlController.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.post("/train/:modelType", authorizeRoles("admin"), trainModel);
router.post(
  "/predict/:modelType",
  authorizeRoles("admin", "analyst", "teacher", "student"),
  predict,
);
router.get(
  "/predictions",
  authorizeRoles("admin", "analyst", "teacher", "student"),
  listPredictionHistory,
);
router.get("/models", authorizeRoles("admin", "analyst"), listModels);
router.get("/models/:modelId", authorizeRoles("admin", "analyst"), getModel);
router.get("/evaluation", authorizeRoles("admin", "analyst"), getEvaluation);

export default router;
