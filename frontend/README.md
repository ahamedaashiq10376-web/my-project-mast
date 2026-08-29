# MastiGuard AI - React Frontend Dashboard

**Module:** Web Dashboard  
**Framework:** React + Vite (Vanilla CSS)  
**Project:** MastiGuard AI (SIH Prototype)

---

## 1. Project Overview

The **MastiGuard AI** dashboard provides an interactive, professional web interface for predicting bovine mastitis risk. It connects to the FastAPI backend API (`POST /predict`) to evaluate cow physiological and milk quality parameters (`ED`, `DEL`, `Estado`, `NP`, `PL`, `CE`).

---

## 2. Setup & Installation Instructions

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **FastAPI Backend Running:** The backend API should be running on `http://127.0.0.1:8001` or `http://127.0.0.1:8000`.

### Step 1: Install Dependencies
From the `frontend/` directory, run:

```bash
npm install
```

### Step 2: Start Development Server
Run the Vite development server:

```bash
npm run dev
```

The frontend application will start locally at:
- **Local URL:** `http://localhost:5173`

---

## 3. Features Implemented

- **SIH Dashboard Branding:** Modern dark slate theme with glassmorphism panels.
- **API Status Indicator:** Live health monitoring dot connected to backend (`GET /health`).
- **Quick Sample Presets:**
  - 🔴 **High Risk Cow** (`CE = 7.2 mS/cm`, `PL = 13.9 L/day`, `ED = 44 mo`)
  - 🟡 **Subclinical Risk** (`CE = 6.3 mS/cm`, `PL = 11.2 L/day`, `ED = 52 mo`)
  - 🟢 **Healthy Cow** (`CE = 4.5 mS/cm`, `PL = 18.5 L/day`, `ED = 25 mo`)
- **Interactive Input Form:** Validated inputs for `ED`, `DEL`, `Estado`, `NP`, `PL`, and `CE`.
- **Dynamic Result Display:**
  - **High Risk Alert Card:** Crimson glowing alert with probability gauge and recommended isolation steps.
  - **Healthy / Low Risk Card:** Emerald checkmark card with routine monitoring guidance.
- **Error Handling:** Connection error card with one-click retry button when backend API is offline.
