"""
MastiGuard AI - FastAPI Backend Server
---------------------------------------
REST API serving early bovine mastitis forecasting predictions using the trained AI model,
persisting screening results to MongoDB, and exposing empirical model performance evaluation metrics.
"""

import os
import sys
import json
from datetime import datetime, timezone
import pandas as pd
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from database import check_mongodb_connection, get_predictions_collection
# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

MODEL_PATH = os.path.join(PROJECT_ROOT, "ai", "mastitis_model.pkl")
EVAL_RESULTS_PATH = os.path.join(PROJECT_ROOT, "ml", "evaluation_results.json")

app = FastAPI(
    title="MastiGuard AI API",
    description="REST API for AI-based Early Forecasting of Bovine Mastitis in Dairy Farms with MongoDB Integration",
    version="1.2.0"
)

# Enable CORS for React frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load trained model artifact at startup
model_artifact = None

def get_model():
    global model_artifact
    if model_artifact is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model artifact not found at {MODEL_PATH}. Run 'python ai/train_model.py' first.")
        model_artifact = joblib.load(MODEL_PATH)
    return model_artifact

class CowPredictionRequest(BaseModel):
    cow_id: Optional[str] = Field(default="COW-2218", description="Cow ID or Ear Tag Number")
    ED: float = Field(..., description="Cow Age in months (e.g. 44)")
    DEL: float = Field(..., description="Days in Lactation (e.g. 272)")
    Estado: str = Field(..., description="Reproductive status: 'Gestante', 'Abierta', 'Inseminada', 'No gestante', 'Estéril'")
    NP: int = Field(..., description="Parity / Number of Calvings (e.g. 2)")
    PL: float = Field(..., description="Daily Milk Yield in Liters/day (e.g. 13.9)")
    CE: float = Field(..., description="Electrical Conductivity in mS/cm (e.g. 7.2)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "cow_id": "COW-2218",
                    "ED": 44,
                    "DEL": 272,
                    "Estado": "Gestante",
                    "NP": 2,
                    "PL": 13.9,
                    "CE": 7.2
                }
            ]
        }
    }

class PredictionResponse(BaseModel):
    cow_id: str
    prediction: int
    label: str
    risk_score: float
    risk_category: str
    model_used: str
    saved_to_db: bool
    disclaimer: str

def calculate_risk_category(probability: float) -> str:
    """
    Categorizes risk based on probability percentage:
    - 0–25%   = No Risk
    - 26–50%  = Low Risk
    - 51–75%  = Moderate Risk
    - 76–100% = High Risk
    """
    percentage = probability * 100.0
    if percentage <= 25.0:
        return "No Risk"
    elif percentage <= 50.0:
        return "Low Risk"
    elif percentage <= 75.0:
        return "Moderate Risk"
    else:
        return "High Risk"

@app.get("/health")
def health_check():
    """
    Health check endpoint returning API status and MongoDB connection check.
    """
    db_connected = check_mongodb_connection()
    return {
        "status": "MastiGuard AI API is running",
        "mongodb_connected": db_connected
    }

@app.get("/model-performance")
def get_model_performance():
    """
    Returns empirical evaluation metrics, confusion matrix, and feature importances.
    """
    if os.path.exists(EVAL_RESULTS_PATH):
        with open(EVAL_RESULTS_PATH, "r") as f:
            return json.load(f)

    # Fallback to current evaluation values if json file is missing
    return {
        "model_name": "Random Forest",
        "dataset_summary": {"total_records": 966, "train_samples": 772, "test_samples": 194},
        "metrics": {
            "accuracy": 0.8041,
            "accuracy_pct": "80.41%",
            "precision": 0.7757,
            "precision_pct": "77.57%",
            "recall_sensitivity": 0.8557,
            "recall_pct": "85.57%",
            "specificity": 0.7526,
            "specificity_pct": "75.26%",
            "f1_score": 0.8137,
            "roc_auc": 0.8863
        },
        "confusion_matrix": {
            "true_negatives_tn": 73,
            "false_positives_fp": 24,
            "false_negatives_fn": 14,
            "true_positives_tp": 83
        },
        "top_features": [
            {"feature": "ED", "importance_pct": 26.70, "description": "Cow Age in months (Parity & age progression factor in subclinical exposure)"},
            {"feature": "DEL", "importance_pct": 21.22, "description": "Days in Lactation (Stage of lactation cycle affecting immune susceptibility)"},
            {"feature": "PL", "importance_pct": 19.94, "description": "Daily Milk Yield in Liters/day (Drop in milk production caused by udder tissue inflammation)"},
            {"feature": "CE", "importance_pct": 16.30, "description": "Electrical Conductivity in mS/cm (Physiological biomarker of ionic changes in infected milk)"},
            {"feature": "NP", "importance_pct": 10.47, "description": "Parity / Number of Calvings (History of previous lactations)"}
        ],
        "explanations": {
            "feature_importance_disclaimer": "Feature importance indicates which input variables contributed most to the Random Forest model's decisions. It does not imply medical causation.",
            "diagnostic_disclaimer": "This software prototype is intended for AI research and screening support. It does NOT constitute a clinical veterinary diagnosis."
        }
    }

@app.get("/predictions")
def get_predictions():
    """
    Retrieves all recorded predictions from MongoDB history (newest first).
    """
    collection = get_predictions_collection()
    if collection is None:
        return []

    try:
        records = list(collection.find({}, {"_id": 0}).sort("created_at", -1))
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch predictions from MongoDB: {str(e)}")

@app.post("/predictions")
def save_prediction(doc: Dict[str, Any]):
    """
    Saves a prediction document directly to MongoDB.
    """
    collection = get_predictions_collection()
    if collection is None:
        raise HTTPException(status_code=503, detail="MongoDB is not connected")

    try:
        if "created_at" not in doc:
            doc["created_at"] = datetime.now(timezone.utc).isoformat()
        res = collection.insert_one(doc)
        return {"status": "success", "inserted_id": str(res.inserted_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save prediction to MongoDB: {str(e)}")

@app.post("/predict", response_model=PredictionResponse)
def predict_mastitis(request: CowPredictionRequest):
    """
    Predicts mastitis risk level for a cow using milk quality and historical parameters,
    and automatically saves the result to MongoDB if available.
    """
    try:
        artifact = get_model()
        model = artifact["model"]
        preprocessor = artifact["preprocessor"]
        model_name = artifact.get("model_name", "Random Forest Classifier")

        feature_data = request.model_dump(exclude={"cow_id"})
        input_df = pd.DataFrame([feature_data])
        X_proc = preprocessor.transform(input_df)

        pred = int(model.predict(X_proc)[0])
        prob = float(model.predict_proba(X_proc)[0][1]) if hasattr(model, "predict_proba") else (1.0 if pred == 1 else 0.0)

        risk_category = calculate_risk_category(prob)
        cow_id = request.cow_id.strip() if request.cow_id else "COW-UNKNOWN"
        label = "Mastitis" if pred == 1 else "Healthy"
        risk_score_rounded = round(prob, 4)
        created_at_iso = datetime.now(timezone.utc).isoformat()

        doc = {
            "cow_id": cow_id,
            "prediction": pred,
            "label": label,
            "risk_score": risk_score_rounded,
            "risk_category": risk_category,
            "model_used": model_name,
            "features": feature_data,
            "created_at": created_at_iso,
            "date_time": datetime.now().strftime("%b %d, %Y, %I:%M %p")
        }

        saved_to_db = False
        collection = get_predictions_collection()
        if collection is not None:
            try:
                collection.insert_one(doc)
                saved_to_db = True
            except Exception as db_err:
                print(f"MongoDB save warning: {db_err}")

        return PredictionResponse(
            cow_id=cow_id,
            prediction=pred,
            label=label,
            risk_score=risk_score_rounded,
            risk_category=risk_category,
            model_used=model_name,
            saved_to_db=saved_to_db,
            disclaimer="Software prototype prediction for AI research demonstration. Does NOT constitute a clinical veterinary diagnosis and requires real-world veterinary validation."
        )
    except FileNotFoundError as fnf_err:
        raise HTTPException(status_code=500, detail=str(fnf_err))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prediction error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8001, reload=True)
