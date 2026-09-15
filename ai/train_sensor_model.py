"""
MastiGuard AI - Genuine Sensor Model Training & Evaluation Pipeline
---------------------------------------------------------------------
Phase 2 - Phase 8: Data Inspection, Feature Engineering, Dataset Strategy,
Model Training (Random Forest, Gradient Boosting, Logistic Regression, SVM),
Group-Based Train/Test Split, Model Selection, and Artifact Generation.
"""

import os
import json
import pandas as pd
import numpy as np
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix
)
import joblib

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW_KAGGLE_PATH = os.path.join(PROJECT_ROOT, "ai", "dataset", "cow_mastitis_from_milk_kaggle.csv")
SENSOR_DATASET_PATH = os.path.join(PROJECT_ROOT, "ai", "dataset", "mastitis_sensor.csv")
SENSOR_MODEL_PATH = os.path.join(PROJECT_ROOT, "ai", "mastitis_sensor_model.pkl")
EVAL_SAVE_PATH = os.path.join(PROJECT_ROOT, "ml", "sensor_evaluation_results.json")

def phase2_inspect_data():
    """PHASE 2 — INSPECT THE DATA"""
    print("\n=======================================================")
    print("PHASE 2 — DATA INSPECTION REPORT")
    print("=======================================================")
    if not os.path.exists(RAW_KAGGLE_PATH):
        raise FileNotFoundError(f"Raw Kaggle dataset not found at {RAW_KAGGLE_PATH}")

    df = pd.read_csv(RAW_KAGGLE_PATH)
    rows, cols = df.shape
    
    print(f"File Name           : {os.path.basename(RAW_KAGGLE_PATH)}")
    print(f"Row Count           : {rows}")
    print(f"Column Count        : {cols}")
    print(f"Column Names        : {df.columns.tolist()}")
    print("\nMissing Values per Column:")
    for col, val in df.isnull().sum().items():
        print(f"  - {col:20s}: {val}")
    print(f"\nDuplicate Rows      : {df.duplicated().sum()}")
    print(f"Target Distribution : {df['class1'].value_counts().to_dict()}")

    return df

def phase3_feature_engineering_and_leakage_check(raw_df):
    """PHASE 3 — FEATURE ENGINEERING & LEAKAGE AUDIT"""
    print("\n=======================================================")
    print("PHASE 3 — FEATURE ENGINEERING & LEAKAGE AUDIT")
    print("=======================================================")
    
    selected_features = ['Milk_pH', 'Milk_Temperature', 'Milk_Conductivity', 'Somatic_Cell_Count', 'Milk_Yield', 'Day']
    print(f"Selected Model Features: {selected_features}")
    print("Excluded Features      : Clotting (Clinical symptom post-onset), Milk_Colour/RGB (Preserved for UI/MongoDB)")
    return selected_features

def phase4_dataset_strategy(raw_df, selected_features):
    """PHASE 4 — DATASET STRATEGY"""
    cols_to_keep = ['Cow_ID'] + selected_features + ['class1']
    sensor_df = raw_df[cols_to_keep].copy()
    sensor_df['data_source'] = 'Kaggle Cow Mastitis (From milk)'
    
    os.makedirs(os.path.dirname(SENSOR_DATASET_PATH), exist_ok=True)
    sensor_df.to_csv(SENSOR_DATASET_PATH, index=False)
    return sensor_df

def phase5_and_6_train_and_evaluate(sensor_df, selected_features):
    """PHASE 5 & 6 — GROUP-BASED TRAINING, EVALUATION & SELECTION"""
    print("\n=======================================================")
    print("PHASE 5 & 6 — MODEL TRAINING & SELECTION (0.6*REC + 0.4*F1)")
    print("=======================================================")
    
    X = sensor_df[selected_features]
    y = sensor_df['class1']
    groups = sensor_df['Cow_ID']

    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(gss.split(X, y, groups))

    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
    groups_train, groups_test = groups.iloc[train_idx], groups.iloc[test_idx]

    print(f"Train samples: {len(X_train)} (Cows: {groups_train.nunique()})")
    print(f"Test samples : {len(X_test)} (Cows: {groups_test.nunique()})")
    print(f"Group Leakage Check: Overlapping Cows = {set(groups_train).intersection(set(groups_test))}")

    preprocessor = ColumnTransformer(
        transformers=[('num', StandardScaler(), selected_features)]
    )

    X_train_proc = preprocessor.fit_transform(X_train)
    X_test_proc = preprocessor.transform(X_test)

    candidate_models = {
        "Gradient Boosting Classifier": GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=4, random_state=42),
        "Random Forest Classifier": RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42),
        "Logistic Regression": LogisticRegression(C=1.0, max_iter=1000, random_state=42),
        "Support Vector Machine (SVM)": SVC(C=1.0, kernel='rbf', probability=True, random_state=42)
    }

    results = {}
    print("\n" + "="*95)
    print(f"{'Model Name':30s} | {'Score':7s} | {'Recall':7s} | {'F1':6s} | {'Accuracy':8s} | {'Precision':9s} | {'ROC-AUC':7s}")
    print("="*95)

    for name, model in candidate_models.items():
        model.fit(X_train_proc, y_train)
        y_pred = model.predict(X_test_proc)
        y_proba = model.predict_proba(X_test_proc)[:, 1]

        cm = confusion_matrix(y_test, y_pred)
        tn, fp, fn, tp = [int(x) for x in cm.ravel()]

        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, zero_division=0))
        rec = float(recall_score(y_test, y_pred, zero_division=0))
        spec = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
        f1 = float(f1_score(y_test, y_pred, zero_division=0))
        auc = float(roc_auc_score(y_test, y_proba))

        sel_score = round(0.6 * rec + 0.4 * f1, 4)

        results[name] = {
            "selection_score": sel_score,
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "specificity": round(spec, 4),
            "f1": round(f1, 4),
            "roc_auc": round(auc, 4),
            "confusion_matrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
            "model_obj": model
        }

        print(f"{name:30s} | {sel_score:7.4f} | {rec*100:6.2f}% | {f1:6.4f} | {acc*100:7.2f}% | {prec*100:8.2f}% | {auc:7.4f}")

    print("="*95)

    best_name = max(results.keys(), key=lambda k: (results[k]['selection_score'], results[k]['recall'], results[k]['f1']))
    best_res = results[best_name]

    print(f"\nWINNING MODEL SELECTED: {best_name}")
    print(f"Selection Score       : {best_res['selection_score']}")

    return results, best_name, preprocessor, selected_features

def phase8_save_artifact(best_name, results, preprocessor, selected_features):
    """PHASE 8 — SAVE MODEL ARTIFACT & EVALUATION RESULTS"""
    best_res = results[best_name]
    artifact = {
        "model": best_res['model_obj'],
        "preprocessor": preprocessor,
        "model_name": best_name,
        "features": selected_features,
        "metrics": best_res,
        "data_source": "Kaggle Cow Mastitis (From milk)"
    }

    joblib.dump(artifact, SENSOR_MODEL_PATH)
    print(f"Saved winning model artifact to: {SENSOR_MODEL_PATH}")

    eval_payload = {
        "sensor_model": {
            "model_name": best_name,
            "selection_score": best_res['selection_score'],
            "features_used": selected_features,
            "metrics": {
                "accuracy": best_res['accuracy'],
                "precision": best_res['precision'],
                "recall_sensitivity": best_res['recall'],
                "specificity": best_res['specificity'],
                "f1_score": best_res['f1'],
                "roc_auc": best_res['roc_auc']
            },
            "confusion_matrix": best_res['confusion_matrix']
        }
    }

    os.makedirs(os.path.dirname(EVAL_SAVE_PATH), exist_ok=True)
    with open(EVAL_SAVE_PATH, "w") as f:
        json.dump(eval_payload, f, indent=2)

if __name__ == "__main__":
    raw_df = phase2_inspect_data()
    selected_features = phase3_feature_engineering_and_leakage_check(raw_df)
    sensor_df = phase4_dataset_strategy(raw_df, selected_features)
    results, best_name, preprocessor, selected_features = phase5_and_6_train_and_evaluate(sensor_df, selected_features)
    phase8_save_artifact(best_name, results, preprocessor, selected_features)
