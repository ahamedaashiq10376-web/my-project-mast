"""
MastiGuard AI - Inference Script
--------------------------------
Provides single-sample and batch prediction functions for early forecasting
of Bovine Mastitis using milk quality and cow history input features.
"""

import os
import pandas as pd
import joblib

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'mastitis_model.pkl')

def load_inference_artifact(model_path=MODEL_PATH):
    """
    Loads saved model pipeline artifact.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at {model_path}. Please train the model first by running train_model.py.")
    return joblib.load(model_path)

def predict_mastitis_risk(input_data: dict, model_path=MODEL_PATH):
    """
    Predicts mastitis risk for a single cow based on milk quality and physiological parameters.
    """
    artifact = load_inference_artifact(model_path)
    model = artifact['model']
    preprocessor = artifact['preprocessor']
    model_name = artifact.get('model_name', 'Trained Classifier')
    
    df_sample = pd.DataFrame([input_data])
    X_proc = preprocessor.transform(df_sample)
    
    pred = int(model.predict(X_proc)[0])
    prob = float(model.predict_proba(X_proc)[0][1]) if hasattr(model, "predict_proba") else (1.0 if pred == 1 else 0.0)
    
    # Define risk category based on probability threshold
    if prob < 0.35:
        risk_category = "Low Risk (Healthy)"
    elif prob < 0.65:
        risk_category = "Moderate Risk (Monitor Udder Health)"
    else:
        risk_category = "High Risk (Early Mastitis Warning)"
        
    return {
        'prediction': pred,
        'label': 'Mastitis' if pred == 1 else 'Healthy',
        'risk_score': round(prob, 4),
        'risk_category': risk_category,
        'model_used': model_name,
        'disclaimer': 'Software prototype model developed for SIH AI research demonstration. Does NOT constitute a clinical veterinary diagnosis and requires real-world veterinary validation.'
    }

if __name__ == '__main__':
    # Demonstration sample input (Cow with elevated electrical conductivity 7.2 mS/cm)
    sample_cow_high_risk = {
        'ED': 44,             # 44 months old (~3.6 years)
        'DEL': 272,           # 272 days in lactation
        'Estado': 'Gestante',  # Pregnant
        'NP': 2,              # 2 past calvings
        'PL': 13.9,           # 13.9 L daily yield
        'CE': 7.2             # Electrical conductivity 7.2 mS/cm (Elevated)
    }

    # Demonstration sample input (Cow with normal electrical conductivity 5.2 mS/cm)
    sample_cow_low_risk = {
        'ED': 44,             # 44 months old
        'DEL': 272,           # 272 days in lactation
        'Estado': 'Gestante',  # Pregnant
        'NP': 2,              # 2 past calvings
        'PL': 15.0,           # 15.0 L daily yield
        'CE': 5.2             # Electrical conductivity 5.2 mS/cm (Normal)
    }

    print("==================================================")
    print(" MastiGuard AI - Inference Module Benchmark")
    print("==================================================")
    
    if os.path.exists(MODEL_PATH):
        print("\n[Sample 1 - Elevated Conductivity (7.2 mS/cm)]")
        res1 = predict_mastitis_risk(sample_cow_high_risk)
        for k, v in res1.items():
            print(f"  {k}: {v}")
            
        print("\n[Sample 2 - Normal Conductivity (5.2 mS/cm)]")
        res2 = predict_mastitis_risk(sample_cow_low_risk)
        for k, v in res2.items():
            print(f"  {k}: {v}")
    else:
        print(f"Notice: Model artifact '{MODEL_PATH}' not found. Please run 'python ai/train_model.py' first.")

