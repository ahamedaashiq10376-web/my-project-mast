# MastiGuard AI

**AI-Based Predictive Modelling for Early Forecasting of Bovine Mastitis in Dairy Farms**  
*SIH Problem Statement Research Prototype*

---

## 1. Project Structure

```
MastiGuard-AI/
├── ai/
│   ├── dataset/
│   │   └── mastitis.csv        # Empirical research dataset (966 records)
│   ├── train_model.py          # Machine learning model training script
│   ├── predict.py              # Single/batch inference helper module
│   ├── mastitis_model.pkl      # Serialized Random Forest model artifact
│   ├── requirements.txt        # ML dependencies
│   └── README.md               # AI module documentation
├── backend/
│   ├── app.py                  # FastAPI REST server
│   └── requirements.txt        # Backend API dependencies
└── README.md                   # Project overview & running instructions
```

---

## 2. Setting Up & Starting the Backend API

### Prerequisites
Make sure Python 3.10+ is installed.

### Step 1: Install Dependencies
```bash
pip install -r backend/requirements.txt
```

### Step 2: Start the FastAPI Server
Run Uvicorn from the project root directory:

```bash
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at:
- **Base URL:** `http://127.0.0.1:8000`
- **Interactive OpenAPI Docs:** `http://127.0.0.1:8000/docs`
- **ReDoc:** `http://127.0.0.1:8000/redoc`

---

## 3. API Endpoints

### 1. Health Check Endpoint
- **Method:** `GET`
- **URL:** `http://127.0.0.1:8000/health`
- **Response:**
  ```json
  {
    "status": "MastiGuard AI API is running"
  }
  ```

---

### 2. Predict Mastitis Risk Endpoint
- **Method:** `POST`
- **URL:** `http://127.0.0.1:8000/predict`
- **Headers:** `Content-Type: application/json`

#### Request Payload (`JSON`):
```json
{
  "ED": 44,
  "DEL": 272,
  "Estado": "Gestante",
  "NP": 2,
  "PL": 13.9,
  "CE": 7.2
}
```

| Field | Description | Example Value |
| :--- | :--- | :--- |
| `ED` | Cow age in months | `44` |
| `DEL` | Days in Lactation (days post-calving) | `272` |
| `Estado` | Reproductive Status (`Gestante`, `Abierta`, `Inseminada`, `No gestante`, `Estéril`) | `"Gestante"` |
| `NP` | Parity / Number of past calvings | `2` |
| `PL` | Daily Milk Yield in Liters/day | `13.9` |
| `CE` | Electrical Conductivity of milk in mS/cm | `7.2` |

#### Response JSON:
```json
{
  "prediction": 1,
  "label": "Mastitis",
  "risk_score": 0.8,
  "risk_category": "High Risk",
  "model_used": "Random Forest",
  "disclaimer": "Software prototype prediction for AI research demonstration. Does NOT constitute a clinical veterinary diagnosis and requires real-world veterinary validation."
}
```

---

## 4. Risk Category Definitions

The API categorizes the predicted probability score into four risk levels:

| Risk Score Range | Risk Category | Action Recommendation |
| :--- | :--- | :--- |
| **0% – 25%** (`0.00 - 0.25`) | **`No Risk`** | Healthy condition. Routine herd management. |
| **26% – 50%** (`0.26 - 0.50`) | **`Low Risk`** | Low probability of inflammation. Monitor standard yield. |
| **51% – 75%** (`0.51 - 0.75`) | **`Moderate Risk`** | Subclinical sign warning. Monitor conductivity & udder. |
| **76% – 100%** (`0.76 - 1.00`) | **`High Risk`** | High probability of early mastitis. Isolate/inspect animal. |

---

## 5. Model Evaluation Summary

- **Selected Model:** Random Forest Classifier
- **Accuracy:** `80.41%`
- **Recall / Sensitivity:** `85.57%`
- **F1-Score:** `81.37%`
- **ROC-AUC:** `0.8863`
