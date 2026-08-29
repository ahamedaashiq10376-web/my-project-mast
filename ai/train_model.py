"""
MastiGuard AI - Model Training Module
---------------------------------------
This script prepares and trains machine learning models to detect Bovine Mastitis
using physiological, milk quality, and herd health history parameters.

NOTE: Training is pending user verification of the dataset feature mapping and confirmation.
"""

import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
import joblib

DATASET_PATH = os.path.join(os.path.dirname(__file__), 'dataset', 'mastitis.csv')
MODEL_SAVE_PATH = os.path.join(os.path.dirname(__file__), 'mastitis_model.pkl')

def load_data(filepath=DATASET_PATH):
    """
    Loads and cleans raw bovine mastitis dataset.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Dataset not found at {filepath}")
        
    df = pd.read_csv(filepath)
    # Select main 13 relevant columns
    cols = ['ID_muestra', 'N_Vaca', 'Muestreo', 'ED', 'DEL', 'Estado', 'Estado_n', 'NP', 'PL', 'CE', 'CCS', 'SCCS', 'Resultado']
    df = df[cols].copy()
    
    # Filter rows with valid binary target (Resultado in [0, 1])
    df['Resultado'] = pd.to_numeric(df['Resultado'], errors='coerce')
    df = df.dropna(subset=['Resultado']).copy()
    df['Resultado'] = df['Resultado'].astype(int)
    
    return df

def preprocess_features(df, test_size=0.2, random_state=42):
    """
    Preprocesses features:
    - Excludes identifiers: ID_muestra, N_Vaca
    - Excludes direct label correlates / target derivations: CCS, SCCS (if preventing leakage)
    - Predictive Features: ED (Age), DEL (Days in Lactation), Estado (Reproductive Status), NP (Parity), PL (Milk Yield), CE (Electrical Conductivity)
    """
    # Feature set selection
    feature_cols = ['ED', 'DEL', 'Estado', 'NP', 'PL', 'CE']
    target_col = 'Resultado'
    
    X = df[feature_cols].copy()
    y = df[target_col].copy()
    
    # Define numerical and categorical columns
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
    
    return X_train_proc, X_test_proc, y_train, y_test, preprocessor

def evaluate_model(model, X_test, y_test):
    """
    Calculates key evaluation metrics for disease forecasting.
    Sensitivity (Recall) and Specificity are critical clinical metrics.
    """
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1] if hasattr(model, "predict_proba") else None
    
    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()
    
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    sensitivity = recall_score(y_test, y_pred, zero_division=0) # True Positive Rate
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0        # True Negative Rate
    f1 = f1_score(y_test, y_pred, zero_division=0)
    auc = roc_auc_score(y_test, y_proba) if y_proba is not None else 0.0
    
    return {
        'Accuracy': acc,
        'Precision': prec,
        'Sensitivity (Recall)': sensitivity,
        'Specificity': specificity,
        'F1-Score': f1,
        'ROC-AUC': auc,
        'TN': tn,
        'FP': fp,
        'FN': fn,
        'TP': tp
    }

def train_and_compare():
    """
    Trains multiple baseline models and selects the best performer based on Sensitivity & F1-Score.
    """
    print("==================================================")
    print(" MastiGuard AI - Model Training & Evaluation")
    print("==================================================")
    print("Loading dataset from:", DATASET_PATH)
    df = load_data()
    print(f"Dataset loaded successfully: {len(df)} total valid records.")
    print("Class Balance (Resultado):", df['Resultado'].value_counts().to_dict())
    
    X_train, X_test, y_train, y_test, preprocessor = preprocess_features(df)
    print(f"Stratified Train set: {X_train.shape[0]} samples | Test set: {X_test.shape[0]} samples")
    
    models = {
        'Random Forest': RandomForestClassifier(n_estimators=100, random_state=42),
        'Gradient Boosting': GradientBoostingClassifier(random_state=42),
        'Logistic Regression': LogisticRegression(random_state=42, max_iter=1000),
        'Support Vector Machine': SVC(probability=True, random_state=42)
    }
    
    results = {}
    best_model = None
    best_score = -1.0
    best_name = ""
    
    print("\n--- Training and Comparing 4 Machine Learning Models ---")
    for name, model in models.items():
        model.fit(X_train, y_train)
        metrics = evaluate_model(model, X_test, y_test)
        results[name] = metrics
        
        # Optimize for balance of Recall (Sensitivity for early warning) and F1-Score
        score = (metrics['Sensitivity (Recall)'] * 0.6) + (metrics['F1-Score'] * 0.4)
        if score > best_score:
            best_score = score
            best_model = model
            best_name = name
            
        print(f"\nModel: [{name}]")
        print(f"  Accuracy            : {metrics['Accuracy']:.4f}")
        print(f"  Precision           : {metrics['Precision']:.4f}")
        print(f"  Recall (Sensitivity): {metrics['Sensitivity (Recall)']:.4f}")
        print(f"  Specificity         : {metrics['Specificity']:.4f}")
        print(f"  F1-Score            : {metrics['F1-Score']:.4f}")
        print(f"  ROC-AUC             : {metrics['ROC-AUC']:.4f}")
        print(f"  Confusion Matrix    : TN={metrics['TN']}, FP={metrics['FP']}, FN={metrics['FN']}, TP={metrics['TP']}")

    print("\n==================================================")
    print(f" SELECTED BEST MODEL: {best_name}")
    print(f" Optimized metric score (Recall-weighted): {best_score:.4f}")
    print("==================================================")
    
    # Save complete pipeline artifact
    artifact = {
        'model': best_model,
        'preprocessor': preprocessor,
        'model_name': best_name,
        'features': ['ED', 'DEL', 'Estado', 'NP', 'PL', 'CE'],
        'metrics': results[best_name]
    }
    joblib.dump(artifact, MODEL_SAVE_PATH)
    print(f"Model & preprocessing pipeline saved to: {MODEL_SAVE_PATH}")
    return results, best_name

if __name__ == '__main__':
    train_and_compare()

