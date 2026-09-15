"""
MastiGuard AI - Inference Module
--------------------------------
Provides single-sample prediction functions for early forecasting of Bovine Mastitis
using the trained genuine sensor machine learning model artifact (ai/mastitis_sensor_model.pkl).
"""

import os
import pandas as pd
import joblib

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SENSOR_MODEL_PATH = os.path.join(PROJECT_ROOT, "ai", "mastitis_sensor_model.pkl")
BASELINE_MODEL_PATH = os.path.join(PROJECT_ROOT, "ai", "mastitis_model.pkl")

def load_inference_artifact(sensor_path=SENSOR_MODEL_PATH, baseline_path=BASELINE_MODEL_PATH):
    """
    Loads saved model pipeline artifact using joblib. Prefers genuine sensor model (mastitis_sensor_model.pkl).
    """
    if os.path.exists(sensor_path):
        return joblib.load(sensor_path)
    elif os.path.exists(baseline_path):
        return joblib.load(baseline_path)
    else:
        raise FileNotFoundError(f"No model artifact found at {sensor_path} or {baseline_path}. Run 'python ai/train_sensor_model.py' first.")

def calculate_risk_category(prob: float) -> str:
    """
    Early Warning Risk threshold classification:
    - < 0.35 = Low Risk
    - 0.35 to < 0.65 = Moderate Risk
    - >= 0.65 = High Risk
    """
    if prob < 0.35:
        return "Low Risk"
    elif prob < 0.65:
        return "Moderate Risk"
    else:
        return "High Risk"

def generate_ai_explanation(features_used: list, sample_data: dict, prob: float, risk_category: str) -> str:
    """
    Generates AI explanation referencing ONLY genuine trained features.
    CRITICAL: Never claims Colour/RGB influenced prediction.
    """
    reasons = []
    
    if "Milk_pH" in sample_data:
        ph = sample_data["Milk_pH"]
        if ph >= 6.9:
            reasons.append(f"Elevated milk pH ({ph:.2f}, physiological threshold >= 6.90)")
        elif ph <= 6.3:
            reasons.append(f"Abnormally low milk pH ({ph:.2f}, physiological threshold <= 6.30)")
        elif ph < 6.7:
            reasons.append(f"Normal physiological milk pH ({ph:.2f})")
            
    if "Milk_Temperature" in sample_data:
        temp = sample_data["Milk_Temperature"]
        if temp >= 39.0:
            reasons.append(f"Elevated milk temperature ({temp:.1f} °C, fever/inflammation indicator)")
        elif temp < 38.8:
            reasons.append(f"Normal milk temperature ({temp:.1f} °C)")

    if "Milk_Conductivity" in sample_data:
        ec = sample_data["Milk_Conductivity"]
        if ec >= 6.5:
            reasons.append(f"Increased electrical conductivity ({ec:.1f} mS/cm, cell membrane ion permeability change)")
        elif ec < 6.0:
            reasons.append(f"Normal electrical conductivity ({ec:.1f} mS/cm)")

    if "Somatic_Cell_Count" in sample_data:
        scc = sample_data["Somatic_Cell_Count"]
        if scc >= 250000:
            reasons.append(f"Elevated somatic cell count ({int(scc):,} cells/mL, leukocyte migration)")
        elif scc < 200000:
            reasons.append(f"Normal somatic cell count ({int(scc):,} cells/mL)")

    if "Milk_Yield" in sample_data:
        y = sample_data["Milk_Yield"]
        if y < 14.0:
            reasons.append(f"Drop in daily milk production ({y:.1f} L/day)")

    if risk_category == "High Risk":
        summary = f"High Risk ({prob*100:.1f}% risk score) driven by: " + "; ".join(reasons) if reasons else f"High Risk detected ({prob*100:.1f}% risk score)."
    elif risk_category == "Moderate Risk":
        summary = f"Moderate Risk ({prob*100:.1f}% risk score). Recommended udder health monitoring based on: " + "; ".join(reasons) if reasons else f"Moderate Risk detected ({prob*100:.1f}% risk score)."
    else:
        summary = f"Low Risk ({prob*100:.1f}% risk score). Normal physiological parameters: " + "; ".join(reasons) if reasons else f"Low Risk (Healthy) detected ({prob*100:.1f}% risk score)."

    return summary

def predict_mastitis_risk(input_data: dict):
    """
    Predicts mastitis risk for a single cow based on genuine trained features.
    """
    artifact = load_inference_artifact()
    model = artifact['model']
    preprocessor = artifact['preprocessor']
    model_name = artifact.get('model_name', 'Gradient Boosting Classifier')
    features = artifact.get('features', ['Milk_pH', 'Milk_Temperature', 'Milk_Conductivity', 'Somatic_Cell_Count', 'Milk_Yield', 'Day'])

    # Map input payload cleanly to exact model feature names
    sample_data = {}
    
    if 'Milk_pH' in features:
        sample_data['Milk_pH'] = float(
            input_data.get('Milk_pH') if input_data.get('Milk_pH') is not None else input_data.get('milk_ph', 6.6)
        )
        sample_data['Milk_Temperature'] = float(
            input_data.get('Milk_Temperature') if input_data.get('Milk_Temperature') is not None else input_data.get('milk_temp', 38.3)
        )
        sample_data['Milk_Conductivity'] = float(
            input_data.get('Milk_Conductivity') if input_data.get('Milk_Conductivity') is not None else input_data.get('electrical_conductivity', input_data.get('CE', input_data.get('milk_conductivity', 5.5)))
        )
        sample_data['Somatic_Cell_Count'] = float(
            input_data.get('Somatic_Cell_Count') if input_data.get('Somatic_Cell_Count') is not None else input_data.get('somatic_cell_count', input_data.get('scc', 200000.0))
        )
        sample_data['Milk_Yield'] = float(
            input_data.get('Milk_Yield') if input_data.get('Milk_Yield') is not None else input_data.get('pl_milk_yield', input_data.get('PL', input_data.get('milk_yield', 18.5)))
        )
        sample_data['Day'] = float(
            input_data.get('Day') if input_data.get('Day') is not None else input_data.get('del_days', input_data.get('DEL', input_data.get('day', 60)))
        )
    else:
        # Fallback to Baseline Model Features
        sample_data['ED'] = float(input_data.get('ED', input_data.get('age_months', 44)))
        sample_data['DEL'] = float(input_data.get('DEL', input_data.get('del_days', 180)))
        sample_data['Estado'] = str(input_data.get('Estado', input_data.get('estado_reproductivo', 'Gestante')))
        sample_data['NP'] = float(input_data.get('NP', input_data.get('np_calvings', 1)))
        sample_data['PL'] = float(input_data.get('PL', input_data.get('pl_milk_yield', 18.5)))
        sample_data['CE'] = float(input_data.get('CE', input_data.get('electrical_conductivity', 6.5)))

    # Ensure DataFrame columns strictly match features list order
    df_sample = pd.DataFrame([sample_data])[features]
    X_proc = preprocessor.transform(df_sample)

    pred = int(model.predict(X_proc)[0])
    prob = float(model.predict_proba(X_proc)[0][1]) if hasattr(model, "predict_proba") else (1.0 if pred == 1 else 0.0)

    risk_percentage = round(prob * 100)
    risk_category = calculate_risk_category(prob)
    explanation = generate_ai_explanation(features, sample_data, prob, risk_category)

    # Check for out-of-distribution bounds
    ood_warnings = []
    if 'Milk_pH' in sample_data:
        ph_v = sample_data['Milk_pH']
        if ph_v < 6.0 or ph_v > 8.0:
            ood_warnings.append(f"pH ({ph_v:.2f})")
        temp_v = sample_data['Milk_Temperature']
        if temp_v < 35.0 or temp_v > 42.0:
            ood_warnings.append(f"Temperature ({temp_v:.1f} °C)")
        ec_v = sample_data['Milk_Conductivity']
        if ec_v < 2.0 or ec_v > 15.0:
            ood_warnings.append(f"EC ({ec_v:.1f} mS/cm)")
        scc_v = sample_data['Somatic_Cell_Count']
        if scc_v < 10000 or scc_v > 3000000:
            ood_warnings.append(f"SCC ({int(scc_v):,} cells/mL)")

    warning_text = None
    if ood_warnings:
        warning_text = f"Input parameter(s) [{', '.join(ood_warnings)}] are outside the model's observed training range; prediction should be interpreted cautiously."

    return {
        'prediction': pred,
        'label': 'Mastitis' if pred == 1 else 'Healthy',
        'risk_score': round(prob, 4),
        'risk_percentage': risk_percentage,
        'risk_category': risk_category,
        'model_used': f"{model_name} (Sensor Model)" if 'Milk_pH' in features else model_name,
        'features_used': features,
        'input_parameters': sample_data,
        'ai_explanation': explanation,
        'warning': warning_text,
        'disclaimer': 'Software prototype model developed for SIH AI research demonstration. Does NOT constitute a clinical veterinary diagnosis and requires real-world veterinary validation.'
    }

if __name__ == '__main__':
    # Case A: Healthy-like cow
    caseA = {'milk_ph': 6.7, 'milk_temp': 38.5, 'electrical_conductivity': 4.0, 'somatic_cell_count': 100000, 'pl_milk_yield': 22.0, 'del_days': 60}
    
    # Case B: Higher-risk cow
    caseB = {'milk_ph': 6.2, 'milk_temp': 39.5, 'electrical_conductivity': 7.0, 'somatic_cell_count': 700000, 'pl_milk_yield': 10.0, 'del_days': 120}

    print("=== Inference Module Validation Test ===")
    print("Case A (Healthy-like) Result:", predict_mastitis_risk(caseA))
    print("\nCase B (Higher-risk) Result :", predict_mastitis_risk(caseB))
