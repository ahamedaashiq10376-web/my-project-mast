# MastiGuard AI - Machine Learning Module

**Project Title:** MastiGuard AI  
**Problem Statement:** AI-Based Predictive Modelling for Early Forecasting of Bovine Mastitis in Dairy Farms (SIH)  
**Module:** AI / Machine Learning (Core Research Prototype)

---

## 1. Dataset Overview

- **Dataset Path:** `ai/dataset/mastitis.csv`
- **Total Valid Records:** 966 records (111 unique dairy cows across 1 to 11 sequential weekly sampling events)
- **Class Balance:** Perfectly balanced (~50% Healthy / ~50% Mastitis)
  - `0` (Healthy): 482 records (49.9%)
  - `1` (Mastitis): 484 records (50.1%)
- **Data Splitting:** Stratified 80/20 train-test split (772 train samples, 194 test samples).

---

## 2. Model Feature Engineering & Target Mapping

### Selected Predictive Features ($X$):
1. `CE` (Electrical Conductivity): Direct physiological biomarker of udder inflammation and cell membrane ion permeability.
2. `PL` (Milk Yield): Daily milk volume produced in L/day.
3. `ED` (Cow Age in Months): Animal age factor.
4. `DEL` (Days in Lactation): Days post-calving.
5. `NP` (Parity): Number of past calvings.
6. `Estado` (Reproductive Status): Categorical feature One-Hot Encoded (`Gestante`, `Abierta`, `Inseminada`, `No gestante`, `Estéril`).

### Excluded Features:
- `ID_muestra` & `N_Vaca`: Identifier columns (excluded to prevent animal ID memorization/leakage).
- `CCS` & `SCCS`: Direct mathematical drivers of `Resultado` ($\text{CCS} \ge 200,000$). Excluded to prevent target leakage.

### Target Variable ($y$):
- `Resultado`: Binary indicator (`0` = Healthy, `1` = Mastitis Risk).

---

## 3. Empirical Model Training & Evaluation Results

All four candidate machine learning algorithms were trained on the stratified training set (772 samples) and evaluated on the holdout test set (194 samples):

| Model | Accuracy | Precision | **Recall (Sensitivity)** | Specificity | F1-Score | ROC-AUC | Confusion Matrix (TN, FP, FN, TP) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Random Forest (SELECTED)** | **80.41%** | **77.57%** | **85.57%** | **75.26%** | **81.37%** | **0.8863** | **TN=73, FP=24, FN=14, TP=83** |
| Gradient Boosting | 78.35% | 75.70% | 83.51% | 73.20% | 79.41% | 0.8635 | TN=71, FP=26, FN=16, TP=81 |
| Support Vector Machine (SVM) | 75.77% | 74.04% | 79.38% | 72.16% | 76.62% | 0.8262 | TN=70, FP=27, FN=20, TP=77 |
| Logistic Regression | 73.20% | 73.68% | 72.16% | 74.23% | 72.92% | 0.7833 | TN=72, FP=25, FN=27, TP=70 |

### Best Model Selection Rationale:
**Random Forest Classifier** was selected as the optimal model for the MastiGuard AI prototype because it achieved the highest **Sensitivity / Recall (85.57%)** and **F1-Score (81.37%)**, minimizing False Negatives (FN = 14 missed cases out of 97 true disease cases). In an early disease warning system, high sensitivity is paramount to prevent undetected herd outbreaks.

The complete trained model pipeline and preprocessor are saved at [`ai/mastitis_model.pkl`](file:///c:/Users/AASHIQ/Desktop/MastiGuard-AI/ai/mastitis_model.pkl).

---

## 4. Inference & Risk Categorization

The [`ai/predict.py`](file:///c:/Users/AASHIQ/Desktop/MastiGuard-AI/ai/predict.py) inference module returns:
- `prediction`: `0` (Healthy) or `1` (Mastitis Risk)
- `risk_score`: Probability prediction (0.0 to 1.0)
- `risk_category`:
  - **`Low Risk (Healthy)`**: Probability < 0.35
  - **`Moderate Risk (Monitor Udder Health)`**: 0.35 $\le$ Probability < 0.65
  - **`High Risk (Early Mastitis Warning)`**: Probability $\ge$ 0.65

### Usage Example:
```python
from ai.predict import predict_mastitis_risk

sample = {
    'ED': 44,             # Age in months
    'DEL': 272,           # Days in lactation
    'Estado': 'Gestante',  # Reproductive status
    'NP': 2,              # Calving count
    'PL': 13.9,           # Milk yield (L/day)
    'CE': 7.2             # Electrical conductivity (mS/cm)
}

result = predict_mastitis_risk(sample)
print(result)
```

---

## 5. Scope & Clinical Disclaimer

1. **Prototype Nature:** This machine learning module is a software prototype created strictly for SIH research and demonstration purposes.
2. **Clinical Validation:** The model does NOT constitute a clinical veterinary diagnosis and requires real-world field validation with veterinary clinical datasets.
