"""
MastiGuard AI - Model Evaluation & Feature Importance Documentation Script
-------------------------------------------------------------------------
Evaluates the trained Random Forest Classifier on empirical test data from mastitis.csv,
computes classification metrics, confusion matrix, feature importances, and scientific disclosures,
and persists evaluation artifacts to ml/evaluation_results.json.
"""

import os
import json
import pandas as pd
import numpy as np
import joblib
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, roc_auc_score
from sklearn.model_selection import train_test_split

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATASET_PATH = os.path.join(PROJECT_ROOT, "ai", "dataset", "mastitis.csv")
MODEL_PATH = os.path.join(PROJECT_ROOT, "ai", "mastitis_model.pkl")
ML_DIR = os.path.join(PROJECT_ROOT, "ml")
OUTPUT_JSON_PATH = os.path.join(ML_DIR, "evaluation_results.json")

def evaluate_and_document():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model artifact not found at {MODEL_PATH}")
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}")

    os.makedirs(ML_DIR, exist_ok=True)

    # 1. Load Dataset
    df = pd.read_csv(DATASET_PATH)
    cols = ['ID_muestra', 'N_Vaca', 'Muestreo', 'ED', 'DEL', 'Estado', 'Estado_n', 'NP', 'PL', 'CE', 'CCS', 'SCCS', 'Resultado']
    df = df[cols].copy()
    df['Resultado'] = pd.to_numeric(df['Resultado'], errors='coerce')
    df = df.dropna(subset=['Resultado']).copy()
    df['Resultado'] = df['Resultado'].astype(int)

    # 2. Train/Test Split (Matching Stratified 80/20 Split)
    feature_cols = ['ED', 'DEL', 'Estado', 'NP', 'PL', 'CE']
    target_col = 'Resultado'

    X = df[feature_cols].copy()
    y = df[target_col].copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # 3. Load Trained Artifact
    artifact = joblib.load(MODEL_PATH)
    model = artifact["model"]
    preprocessor = artifact["preprocessor"]
    model_name = artifact.get("model_name", "Random Forest Classifier")

    # Transform test features
    X_test_proc = preprocessor.transform(X_test)
    y_pred = model.predict(X_test_proc)
    y_proba = model.predict_proba(X_test_proc)[:, 1] if hasattr(model, "predict_proba") else None

    # 4. Compute Metrics
    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0)) # Sensitivity
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    auc = float(roc_auc_score(y_test, y_proba)) if y_proba is not None else 0.0

    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = [int(val) for val in cm.ravel()]
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0

    # 5. Extract Feature Importances
    # Get feature names from column transformer
    try:
        feature_names = preprocessor.get_feature_names_out()
    except Exception:
        feature_names = [f"feature_{i}" for i in range(X_test_proc.shape[1])]

    importances = model.feature_importances_
    
    # Map feature importances to clean names
    raw_feature_importances = []
    for name, imp in zip(feature_names, importances):
        clean_name = name.replace("num__", "").replace("cat__", "")
        raw_feature_importances.append({
            "feature": clean_name,
            "importance": float(imp),
            "importance_pct": round(float(imp) * 100.0, 2)
        })

    # Group importances by primary feature domain
    domain_importances = {}
    for item in raw_feature_importances:
        feat = item["feature"]
        base_name = feat.split("_")[0] if "_" in feat else feat
        domain_importances[base_name] = domain_importances.get(base_name, 0.0) + item["importance"]

    sorted_top_features = [
        {"feature": name, "importance": float(imp), "importance_pct": round(float(imp) * 100.0, 2)}
        for name, imp in sorted(domain_importances.items(), key=lambda x: x[1], reverse=True)
    ]

    # Feature explanations dictionary
    feature_descriptions = {
        "CE": "Electrical Conductivity in mS/cm (Physiological biomarker of ionic changes in infected milk)",
        "PL": "Daily Milk Yield in Liters/day (Drop in milk production caused by udder tissue inflammation)",
        "DEL": "Days in Lactation (Stage of lactation cycle affecting immune susceptibility)",
        "ED": "Cow Age in months (Parity & age progression factor in subclinical exposure)",
        "NP": "Parity / Number of Calvings (History of previous lactations)",
        "Estado": "Reproductive Status (Hormonal stage: Gestante, Abierta, Inseminada, etc.)"
    }

    top_5_features = sorted_top_features[:5]
    for item in top_5_features:
        item["description"] = feature_descriptions.get(item["feature"], "Physiological cow parameter")

    # 6. Build Comprehensive Evaluation Results JSON
    results_doc = {
        "model_name": model_name,
        "dataset_name": "mastitis.csv",
        "dataset_summary": {
            "total_records": len(df),
            "healthy_records": int((df['Resultado'] == 0).sum()),
            "mastitis_records": int((df['Resultado'] == 1).sum()),
            "train_samples": len(X_train),
            "test_samples": len(X_test)
        },
        "metrics": {
            "accuracy": round(acc, 4),
            "accuracy_pct": f"{acc * 100:.2f}%",
            "precision": round(prec, 4),
            "precision_pct": f"{prec * 100:.2f}%",
            "recall_sensitivity": round(rec, 4),
            "recall_pct": f"{rec * 100:.2f}%",
            "specificity": round(specificity, 4),
            "specificity_pct": f"{specificity * 100:.2f}%",
            "f1_score": round(f1, 4),
            "roc_auc": round(auc, 4)
        },
        "confusion_matrix": {
            "true_negatives_tn": tn,
            "false_positives_fp": fp,
            "false_negatives_fn": fn,
            "true_positives_tp": tp,
            "matrix_array": [[tn, fp], [fn, tp]]
        },
        "top_features": top_5_features,
        "all_feature_importances": sorted_top_features,
        "explanations": {
            "feature_importance_disclaimer": "Feature importance indicates which input variables contributed most to the Random Forest model's decisions. It does not imply medical causation.",
            "diagnostic_disclaimer": "This software prototype is intended for AI research and screening support. It does NOT constitute a clinical veterinary diagnosis.",
            "forecasting_disclosure": "Dataset contains cross-sectional/sampling records across milkings. 7-14 day forecasting is supported as subclinical screening guidance, not deterministic longitudinal proof."
        }
    }

    with open(OUTPUT_JSON_PATH, "w") as f:
        json.dump(results_doc, f, indent=2)

    # Save copy in ai/ folder as well
    ai_json_path = os.path.join(PROJECT_ROOT, "ai", "evaluation_results.json")
    with open(ai_json_path, "w") as f:
        json.dump(results_doc, f, indent=2)

    print("==================================================")
    print(" EMPIRICAL MODEL EVALUATION COMPLETED")
    print("==================================================")
    print(f"Model Artifact     : {model_name}")
    print(f"Dataset Records    : {len(df)} total ({len(X_train)} train / {len(X_test)} test)")
    print(f"Accuracy           : {acc:.4f} ({acc * 100:.2f}%)")
    print(f"Precision          : {prec:.4f} ({prec * 100:.2f}%)")
    print(f"Recall/Sensitivity : {rec:.4f} ({rec * 100:.2f}%)")
    print(f"Specificity        : {specificity:.4f} ({specificity * 100:.2f}%)")
    print(f"F1 Score           : {f1:.4f}")
    print(f"ROC-AUC            : {auc:.4f}")
    print(f"Confusion Matrix   : TN={tn}, FP={fp}, FN={fn}, TP={tp}")
    print("\nTop 5 Important Features:")
    for f_item in top_5_features:
        print(f"  - {f_item['feature']:<10}: {f_item['importance_pct']}% ({f_item['description']})")
    print(f"\nSaved evaluation results to: {OUTPUT_JSON_PATH}")

    return results_doc

if __name__ == "__main__":
    evaluate_and_document()
