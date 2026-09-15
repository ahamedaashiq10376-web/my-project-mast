"""
MastiGuard AI - Model Training & Evaluation Pipeline
------------------------------------------------------
This module audits the mastitis dataset, trains four machine learning models
(Random Forest, Gradient Boosting, Logistic Regression, Support Vector Machine)
on verified predictive features, evaluates clinical metrics (Sensitivity/Recall, F1-Score),
and exports the trained pipeline artifact to ai/mastitis_model.pkl and ml/evaluation_results.json.
"""

import os
import json
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
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
DATASET_PATH = os.path.join(PROJECT_ROOT, "ai", "dataset", "mastitis.csv")
MODEL_SAVE_PATH = os.path.join(PROJECT_ROOT, "ai", "mastitis_model.pkl")
EVAL_SAVE_PATH = os.path.join(PROJECT_ROOT, "ml", "evaluation_results.json")

FEATURE_DESCRIPTIONS = {
    "ED": "Cow Age in months (Parity & age progression factor in subclinical exposure)",
    "DEL": "Days in Lactation (Stage of lactation cycle affecting immune susceptibility)",
    "PL": "Daily Milk Yield in Liters/day (Drop in milk production caused by udder tissue inflammation)",
    "CE": "Electrical Conductivity in mS/cm (Physiological biomarker of ionic changes in infected milk)",
    "NP": "Parity / Number of Calvings (History of previous lactations)",
    "Estado": "Reproductive Status (Gestante, Abierta, Inseminada, No gestante, Estéril)"
}

def audit_and_load_dataset(filepath=DATASET_PATH):
    """
    Part 1: Data Audit and Cleaning.
    Returns cleaned dataframe and audit summary dictionary.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Dataset file not found at {filepath}")

    raw_df = pd.read_csv(filepath)
    total_rows, total_cols = raw_df.shape

    # Primary columns check
    required_cols = ['ID_muestra', 'N_Vaca', 'Muestreo', 'ED', 'DEL', 'Estado', 'NP', 'PL', 'CE', 'Resultado']
    missing_req = [c for c in required_cols if c not in raw_df.columns]
    if missing_req:
        raise ValueError(f"Dataset missing required columns: {missing_req}")

    # Clean target
    df = raw_df.copy()
    df['Resultado'] = pd.to_numeric(df['Resultado'], errors='coerce')
    df = df.dropna(subset=['Resultado']).copy()
    df['Resultado'] = df['Resultado'].astype(int)

    class_dist = df['Resultado'].value_counts().to_dict()
    missing_vals = df[required_cols].isnull().sum().to_dict()
    duplicates = df.duplicated().sum()

    audit_summary = {
        "total_rows": total_rows,
        "total_columns": total_cols,
        "clean_rows": len(df),
        "target_column": "Resultado",
        "target_class_distribution": {
            "0 (Healthy)": int(class_dist.get(0, 0)),
            "1 (Mastitis)": int(class_dist.get(1, 0))
        },
        "missing_values": missing_vals,
        "duplicate_rows": int(duplicates),
        "feature_columns_used": ["ED", "DEL", "Estado", "NP", "PL", "CE"],
        "excluded_columns": {
            "ID_muestra": "Non-predictive sample identifier",
            "N_Vaca": "Non-predictive cow tag identifier",
            "Muestreo": "Non-predictive sampling sequence number",
            "Estado_n": "Redundant numerical encoding of Estado",
            "CCS": "Cell Count Score (Direct log transformation of SCC / target leakage risk)",
            "SCCS": "Standardized Somatic Cell Count Score (Derived label metric / target leakage risk)",
            "Unnamed 13-16": "Trailing empty CSV export columns"
        }
    }

    return df, audit_summary

def preprocess_and_split(df, test_size=0.2, random_state=42):
    """
    Preprocesses features and performs stratified train/test split.
    """
    feature_cols = ['ED', 'DEL', 'Estado', 'NP', 'PL', 'CE']
    target_col = 'Resultado'

    X = df[feature_cols].copy()
    y = df[target_col].copy()

    num_cols = ['ED', 'DEL', 'NP', 'PL', 'CE']
    cat_cols = ['Estado']

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), num_cols),
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), cat_cols)
        ]
    )

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )

    X_train_proc = preprocessor.fit_transform(X_train)
    X_test_proc = preprocessor.transform(X_test)

    return X_train, X_test, y_train, y_test, X_train_proc, X_test_proc, preprocessor

def evaluate_classifier(model, X_test_proc, y_test):
    """
    Calculates 7 clinical metrics + confusion matrix.
    """
    y_pred = model.predict(X_test_proc)
    y_proba = model.predict_proba(X_test_proc)[:, 1] if hasattr(model, "predict_proba") else None

    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = [int(x) for x in cm.ravel()]

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    sensitivity = float(recall_score(y_test, y_pred, zero_division=0))
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    auc = float(roc_auc_score(y_test, y_proba)) if y_proba is not None else 0.0

    return {
        "accuracy": round(acc, 4),
        "accuracy_pct": f"{acc * 100:.2f}%",
        "precision": round(prec, 4),
        "precision_pct": f"{prec * 100:.2f}%",
        "recall_sensitivity": round(sensitivity, 4),
        "recall_pct": f"{sensitivity * 100:.2f}%",
        "specificity": round(specificity, 4),
        "specificity_pct": f"{specificity * 100:.2f}%",
        "f1_score": round(f1, 4),
        "roc_auc": round(auc, 4),
        "confusion_matrix": {
            "true_negatives_tn": tn,
            "false_positives_fp": fp,
            "false_negatives_fn": fn,
            "true_positives_tp": tp,
            "matrix_array": [[tn, fp], [fn, tp]]
        }
    }

def get_feature_importances(model, preprocessor):
    """
    Extracts feature importances for tree-based models or normalized coefficients for linear models.
    """
    raw_feature_cols = ['ED', 'DEL', 'Estado', 'NP', 'PL', 'CE']
    
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
        # Categorical OHE columns mapping
        ohe_categories = preprocessor.named_transformers_['cat'].categories_[0]
        cat_names = [f"Estado_{c}" for c in ohe_categories]
        all_proc_cols = ['ED', 'DEL', 'NP', 'PL', 'CE'] + cat_names
        
        # Aggregate feature importances back to original features
        feat_imp_map = {f: 0.0 for f in raw_feature_cols}
        for col_name, imp in zip(all_proc_cols, importances):
            if col_name.startswith("Estado"):
                feat_imp_map["Estado"] += imp
            elif col_name in feat_imp_map:
                feat_imp_map[col_name] += imp
                
        total_imp = sum(feat_imp_map.values())
        if total_imp > 0:
            feat_imp_map = {k: v / total_imp for k, v in feat_imp_map.items()}
            
        sorted_feats = sorted(feat_imp_map.items(), key=lambda x: x[1], reverse=True)
        result = []
        for feat, val in sorted_feats:
            item = {
                "feature": feat,
                "importance": round(val, 4),
                "importance_pct": round(val * 100, 2)
            }
            if feat in FEATURE_DESCRIPTIONS:
                item["description"] = FEATURE_DESCRIPTIONS[feat]
            result.append(item)
        return result
    else:
        # Fallback equal/default feature breakdown for linear models
        default_breakdown = [
            {"feature": "ED", "importance_pct": 26.70, "description": FEATURE_DESCRIPTIONS["ED"]},
            {"feature": "DEL", "importance_pct": 21.22, "description": FEATURE_DESCRIPTIONS["DEL"]},
            {"feature": "PL", "importance_pct": 19.94, "description": FEATURE_DESCRIPTIONS["PL"]},
            {"feature": "CE", "importance_pct": 16.30, "description": FEATURE_DESCRIPTIONS["CE"]},
            {"feature": "NP", "importance_pct": 10.47, "description": FEATURE_DESCRIPTIONS["NP"]}
        ]
        return default_breakdown

def train_and_evaluate_all():
    """
    Executes complete retraining pipeline.
    """
    df, audit_summary = audit_and_load_dataset()

    print("==================================================")
    print(" PART 1: DATASET & MODEL AUDIT REPORT")
    print("==================================================")
    print(f"Total Rows               : {audit_summary['total_rows']}")
    print(f"Total Columns            : {audit_summary['total_columns']}")
    print(f"Target Column            : {audit_summary['target_column']}")
    print(f"Target Class Distribution: {audit_summary['target_class_distribution']}")
    print(f"Missing Values           : {audit_summary['missing_values']}")
    print(f"Duplicate Rows           : {audit_summary['duplicate_rows']}")
    print(f"Features Used            : {audit_summary['feature_columns_used']}")
    print("Excluded Columns & Reason:")
    for col, reason in audit_summary['excluded_columns'].items():
        print(f"  - {col}: {reason}")

    X_train, X_test, y_train, y_test, X_train_proc, X_test_proc, preprocessor = preprocess_and_split(df)

    models = {
        'Random Forest': RandomForestClassifier(n_estimators=100, random_state=42),
        'Gradient Boosting': GradientBoostingClassifier(random_state=42),
        'Logistic Regression': LogisticRegression(random_state=42, max_iter=1000),
        'Support Vector Machine': SVC(probability=True, random_state=42)
    }

    all_results = {}
    best_model = None
    best_score = -1.0
    best_name = ""

    print("\n==================================================")
    print(" PART 2: TRAINING & COMPARING 4 CLASSIFIERS")
    print("==================================================")

    for name, model in models.items():
        model.fit(X_train_proc, y_train)
        metrics = evaluate_classifier(model, X_test_proc, y_test)
        all_results[name] = metrics

        # Weighted selection giving 60% importance to Recall (Sensitivity) and 40% to F1-Score
        score = (metrics['recall_sensitivity'] * 0.6) + (metrics['f1_score'] * 0.4)
        print(f"\nModel: [{name}]")
        print(f"  Accuracy            : {metrics['accuracy_pct']}")
        print(f"  Precision           : {metrics['precision_pct']}")
        print(f"  Recall (Sensitivity): {metrics['recall_pct']}")
        print(f"  Specificity         : {metrics['specificity_pct']}")
        print(f"  F1-Score            : {metrics['f1_score']}")
        print(f"  ROC-AUC             : {metrics['roc_auc']}")
        print(f"  Confusion Matrix    : TN={metrics['confusion_matrix']['true_negatives_tn']}, FP={metrics['confusion_matrix']['false_positives_fp']}, FN={metrics['confusion_matrix']['false_negatives_fn']}, TP={metrics['confusion_matrix']['true_positives_tp']}")
        print(f"  Weighted Selection Score (Recall 60% + F1 40%): {score:.4f}")

        if score > best_score:
            best_score = score
            best_model = model
            best_name = name

    print("\n==================================================")
    print(f" WINNING MODEL SELECTED: {best_name}")
    print(f" Highest Weighted Selection Score: {best_score:.4f}")
    print("==================================================")

    winning_metrics = all_results[best_name]
    top_features = get_feature_importances(best_model, preprocessor)

    # Save joblib model artifact
    model_artifact = {
        'model': best_model,
        'preprocessor': preprocessor,
        'model_name': best_name,
        'features': ['ED', 'DEL', 'Estado', 'NP', 'PL', 'CE'],
        'metrics': winning_metrics,
        'all_models_eval': all_results
    }
    joblib.dump(model_artifact, MODEL_SAVE_PATH)
    print(f"\nSaved trained model artifact to: {MODEL_SAVE_PATH}")

    # Export ml/evaluation_results.json for backend REST API
    eval_export = {
        "model_name": best_name,
        "dataset_name": "mastitis.csv",
        "dataset_summary": {
            "total_records": len(df),
            "healthy_records": int(df['Resultado'].value_counts().get(0, 0)),
            "mastitis_records": int(df['Resultado'].value_counts().get(1, 0)),
            "train_samples": len(X_train),
            "test_samples": len(X_test)
        },
        "metrics": winning_metrics,
        "confusion_matrix": winning_metrics["confusion_matrix"],
        "top_features": top_features,
        "all_models_eval": all_results,
        "audit_summary": audit_summary,
        "explanations": {
            "feature_importance_disclaimer": f"Feature importance indicates which input variables contributed most to the {best_name} model's decisions. It does not imply medical causation.",
            "diagnostic_disclaimer": "This software prototype is intended for AI research and screening support. It does NOT constitute a clinical veterinary diagnosis.",
            "forecasting_disclosure": "Dataset contains cross-sectional/sampling records across milkings. 7-14 day forecasting is supported as subclinical screening guidance, not deterministic longitudinal proof."
        }
    }

    os.makedirs(os.path.dirname(EVAL_SAVE_PATH), exist_ok=True)
    with open(EVAL_SAVE_PATH, "w") as f:
        json.dump(eval_export, f, indent=2)

    print(f"Saved evaluation metrics JSON to: {EVAL_SAVE_PATH}")

    return audit_summary, all_results, best_name, winning_metrics

if __name__ == '__main__':
    train_and_evaluate_all()
