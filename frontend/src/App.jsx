import React, { useState, useEffect } from 'react';
import './App.css';

// Default API URLs (Primary 8001, Fallback 8000)
const PRIMARY_API = 'http://127.0.0.1:8001';
const FALLBACK_API = 'http://127.0.0.1:8000';
const LOCAL_STORAGE_KEY = 'mastiguard_prediction_history';

function App() {
  // Navigation active tab (Default landing page set to 'dashboard' as configured)
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'predict', 'history', 'trend', 'performance'

  // Cow Parameters Form State
  const [formData, setFormData] = useState({
    cow_id: 'COW-1056',
    ED: 44,
    DEL: 180,
    Estado: 'No gestante',
    NP: 1,
    PL: 18.5,
    CE: 6.5
  });

  const [loading, setLoading] = useState(false);
  
  // Default sample result preview so Predict tab renders output initially
  const [result, setResult] = useState({
    cow_id: 'COW-1056',
    prediction: 1,
    label: 'Mastitis',
    risk_score: 0.82,
    risk_category: 'High Risk',
    model_used: 'Random Forest',
    saved_to_db: true,
    disclaimer: 'AI prediction for research/prototype use only. This does not constitute a veterinary diagnosis.'
  });

  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking'); // 'online', 'offline', 'checking'
  const [dbStatus, setDbStatus] = useState(false); // MongoDB connected flag
  const [activeApi, setActiveApi] = useState(PRIMARY_API);

  // History State
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Model Performance Metrics State
  const [modelPerf, setModelPerf] = useState({
    model_name: "Random Forest",
    dataset_summary: { total_records: 966, train_samples: 772, test_samples: 194 },
    metrics: {
      accuracy: 0.8041,
      accuracy_pct: "80.41%",
      precision: 0.7757,
      precision_pct: "77.57%",
      recall_sensitivity: 0.8557,
      recall_pct: "85.57%",
      specificity: 0.7526,
      specificity_pct: "75.26%",
      f1_score: 0.8137,
      roc_auc: 0.8863
    },
    confusion_matrix: {
      true_negatives_tn: 73,
      false_positives_fp: 24,
      false_negatives_fn: 14,
      true_positives_tp: 83
    },
    top_features: [
      { feature: "ED", importance_pct: 26.70, description: "Cow Age in months (Parity & age progression factor in subclinical exposure)" },
      { feature: "DEL", importance_pct: 21.22, description: "Days in Lactation (Stage of lactation cycle affecting immune susceptibility)" },
      { feature: "PL", importance_pct: 19.94, description: "Daily Milk Yield in Liters/day (Drop in milk production caused by udder tissue inflammation)" },
      { feature: "CE", importance_pct: 16.30, description: "Electrical Conductivity in mS/cm (Physiological biomarker of ionic changes in infected milk)" },
      { feature: "NP", importance_pct: 10.47, description: "Parity / Number of Calvings (History of previous lactations)" }
    ],
    explanations: {
      feature_importance_disclaimer: "Feature importance indicates which input variables contributed most to the Random Forest model's decisions. It does not imply medical causation.",
      diagnostic_disclaimer: "This software prototype is intended for AI research and screening support. It does NOT constitute a clinical veterinary diagnosis."
    }
  });

  // Load History & Model Performance on mount
  useEffect(() => {
    checkHealthAndLoadPredictions();
    fetchModelPerformance();
  }, []);

  const fetchModelPerformance = async () => {
    try {
      const res = await fetch(`${PRIMARY_API}/model-performance`);
      if (res.ok) {
        const perfData = await res.json();
        setModelPerf(perfData);
      }
    } catch (e) {
      console.warn("Could not fetch model performance from backend, using evaluation cache:", e);
    }
  };

  const loadHistoryFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load prediction history from localStorage:", e);
    }
  };

  const checkHealthAndLoadPredictions = async () => {
    setApiStatus('checking');
    let targetApi = PRIMARY_API;
    let isOnline = false;
    let isDbConnected = false;

    try {
      const res = await fetch(`${PRIMARY_API}/health`);
      if (res.ok) {
        const healthData = await res.json();
        isOnline = true;
        isDbConnected = !!healthData.mongodb_connected;
        targetApi = PRIMARY_API;
      }
    } catch (err) {
      try {
        const res2 = await fetch(`${FALLBACK_API}/health`);
        if (res2.ok) {
          const healthData2 = await res2.json();
          isOnline = true;
          isDbConnected = !!healthData2.mongodb_connected;
          targetApi = FALLBACK_API;
        }
      } catch (err2) {
        isOnline = false;
      }
    }

    setApiStatus(isOnline ? 'online' : 'offline');
    setDbStatus(isDbConnected);
    setActiveApi(targetApi);

    if (isOnline) {
      try {
        const predRes = await fetch(`${targetApi}/predictions`);
        if (predRes.ok) {
          const mongoRecords = await predRes.json();
          if (Array.isArray(mongoRecords) && mongoRecords.length > 0) {
            const formatted = mongoRecords.map((item, idx) => ({
              id: item.created_at || idx.toString(),
              cow_id: item.cow_id || 'COW-UNKNOWN',
              date_time: item.date_time || (item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'),
              prediction: item.prediction,
              label: item.label,
              risk_score: item.risk_score,
              risk_category: item.risk_category,
              model_used: item.model_used,
              features: item.features || {}
            }));

            setHistory(formatted);
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formatted));
            } catch (e) {}
            return;
          }
        }
      } catch (e) {
        console.warn("Could not fetch predictions from MongoDB API, falling back to localStorage:", e);
      }
    }

    loadHistoryFromLocalStorage();
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const loadPreset = (preset) => {
    if (preset === 'high') {
      setFormData({
        cow_id: 'COW-2218',
        ED: 44,
        DEL: 272,
        Estado: 'Gestante',
        NP: 2,
        PL: 13.9,
        CE: 7.2
      });
    } else if (preset === 'low') {
      setFormData({
        cow_id: 'COW-898',
        ED: 25,
        DEL: 40,
        Estado: 'Gestante',
        NP: 1,
        PL: 18.5,
        CE: 4.5
      });
    } else if (preset === 'subclinical') {
      setFormData({
        cow_id: 'COW-1056',
        ED: 44,
        DEL: 180,
        Estado: 'No gestante',
        NP: 1,
        PL: 18.5,
        CE: 6.5
      });
    }
    setResult(null);
    setError(null);
  };

  const saveToHistory = (newEntry) => {
    const updated = [newEntry, ...history];
    setHistory(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save prediction to localStorage:", e);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear all prediction history?")) {
      setHistory([]);
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch (e) {
        console.error("Failed to clear localStorage:", e);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const payload = {
      cow_id: formData.cow_id.trim() || 'COW-1056',
      ED: parseFloat(formData.ED),
      DEL: parseFloat(formData.DEL),
      Estado: formData.Estado,
      NP: parseInt(formData.NP, 10),
      PL: parseFloat(formData.PL),
      CE: parseFloat(formData.CE)
    };

    let targetUrl = `${activeApi}/predict`;

    try {
      let response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok && activeApi === PRIMARY_API) {
        targetUrl = `${FALLBACK_API}/predict`;
        response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'API prediction error' }));
        throw new Error(errorData.detail || `HTTP Error ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      setApiStatus('online');
      if (data.saved_to_db) {
        setDbStatus(true);
      }

      const historyRecord = {
        id: Date.now().toString(),
        cow_id: data.cow_id || formData.cow_id.trim() || 'COW-UNKNOWN',
        date_time: new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        prediction: data.prediction,
        label: data.label,
        risk_score: data.risk_score,
        risk_category: data.risk_category,
        model_used: data.model_used,
        features: {
          ED: payload.ED,
          DEL: payload.DEL,
          Estado: payload.Estado,
          NP: payload.NP,
          PL: payload.PL,
          CE: payload.CE
        }
      };

      saveToHistory(historyRecord);

      setTimeout(() => {
        checkHealthAndLoadPredictions();
      }, 500);

    } catch (err) {
      console.error("Prediction Error:", err);
      setError(`Cannot connect to FastAPI backend at ${targetUrl}. Please make sure the backend server is running.`);
      setApiStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  const isHighOrModerateRisk = result && (result.prediction === 1 || result.risk_category === 'High Risk' || result.risk_category === 'Moderate Risk');

  // Statistics Computations from actual prediction history
  const totalPredictions = history.length;
  const highRiskCases = history.filter(h => h.risk_category === 'High Risk');
  const moderateRiskCases = history.filter(h => h.risk_category === 'Moderate Risk');
  const lowRiskCases = history.filter(h => h.risk_category === 'Low Risk');
  const noRiskCases = history.filter(h => h.risk_category === 'No Risk');

  const highRiskCount = highRiskCases.length;
  const moderateRiskCount = moderateRiskCases.length;
  const lowRiskCount = lowRiskCases.length;
  const noRiskCount = noRiskCases.length;

  const highPct = totalPredictions > 0 ? ((highRiskCount / totalPredictions) * 100).toFixed(1) : 0;
  const modPct = totalPredictions > 0 ? ((moderateRiskCount / totalPredictions) * 100).toFixed(1) : 0;
  const lowPct = totalPredictions > 0 ? ((lowRiskCount / totalPredictions) * 100).toFixed(1) : 0;
  const noRiskPct = totalPredictions > 0 ? ((noRiskCount / totalPredictions) * 100).toFixed(1) : 0;

  const recentPredictions = history.slice(0, 5);

  const filteredHistory = history.filter(item => {
    const matchesCow = item.cow_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'ALL' || item.risk_category === filterCategory;
    return matchesCow && matchesCategory;
  });

  // Risk Trend Computations
  const chronoHistory = [...history].reverse();
  const hasEnoughHistoryForTrend = chronoHistory.length >= 2;

  let trendDirection = 'Stable';
  let earlierAvg = 0;
  let recentAvg = 0;
  let overallAvg = 0;
  let pctChangeStr = '0.0%';

  if (hasEnoughHistoryForTrend) {
    const mid = Math.floor(chronoHistory.length / 2);
    const earlierHalf = chronoHistory.slice(0, mid);
    const recentHalf = chronoHistory.slice(mid);

    earlierAvg = earlierHalf.reduce((sum, item) => sum + item.risk_score, 0) / earlierHalf.length;
    recentAvg = recentHalf.reduce((sum, item) => sum + item.risk_score, 0) / recentHalf.length;
    overallAvg = chronoHistory.reduce((sum, item) => sum + item.risk_score, 0) / chronoHistory.length;

    const diff = recentAvg - earlierAvg;
    pctChangeStr = `${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(1)}%`;

    if (diff > 0.03) {
      trendDirection = 'Increasing';
    } else if (diff < -0.03) {
      trendDirection = 'Decreasing';
    } else {
      trendDirection = 'Stable';
    }
  }

  const getRiskBadgeClass = (category) => {
    switch (category) {
      case 'High Risk':
        return 'risk-tag high-risk';
      case 'Moderate Risk':
        return 'risk-tag moderate-risk';
      case 'Low Risk':
        return 'risk-tag low-risk';
      case 'No Risk':
        return 'risk-tag no-risk';
      default:
        return 'risk-tag';
    }
  };

  // Dynamic SVG Circular Gauge Stroke Calculation
  const gaugeScorePct = result ? (result.risk_score * 100) : 0;
  const radius = 60;
  const circumference = 2 * Math.PI * radius; // ~376.99
  const strokeDashoffset = circumference - (circumference * gaugeScorePct) / 100;

  // Gauge Stroke Color based on risk level
  let gaugeColor = '#059669'; // Green Low Risk
  if (result) {
    if (result.risk_category === 'High Risk') gaugeColor = '#dc2626';
    else if (result.risk_category === 'Moderate Risk') gaugeColor = '#d97706';
    else if (result.risk_category === 'No Risk') gaugeColor = '#0284c7';
  }

  return (
    <div className="app-container">
      {/* Header Navbar */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon">🐄</div>
          <div className="brand-text">
            <h1>MastiGuard AI</h1>
            <p className="brand-subtitle">AI-Powered Early Mastitis Risk Assessment</p>
          </div>
        </div>

        {/* Navigation Order: 1. Dashboard, 2. Predict, 3. Prediction History, 4. Risk Trend, 5. Model Performance */}
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span>🏠 Dashboard</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'predict' ? 'active' : ''}`}
            onClick={() => setActiveTab('predict')}
          >
            <span>⚡ Predict</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <span>📜 Prediction History</span>
            {totalPredictions > 0 && <span className="tab-badge">{totalPredictions}</span>}
          </button>

          <button
            className={`nav-tab trend-tab-btn ${activeTab === 'trend' ? 'active' : ''}`}
            onClick={() => setActiveTab('trend')}
          >
            <span>📈 Risk Trend</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'performance' ? 'active' : ''}`}
            onClick={() => setActiveTab('performance')}
          >
            <span>📊 Model Performance</span>
          </button>
        </nav>

        <div className="header-status">
          <span className="ai-active-badge">
            <span className="status-dot-pulse"></span>
            AI ENGINE ACTIVE
          </span>
          <span className="storage-badge" style={{ background: dbStatus ? '#d1fae5' : '#eff6ff', color: dbStatus ? '#047857' : '#1d4ed8', borderColor: dbStatus ? '#6ee7b7' : '#bfdbfe' }}>
            {dbStatus ? '🍃 MongoDB Connected' : '💾 LocalStorage Fallback'}
          </span>
        </div>
      </header>

      {/* Benchmark Metric Cards */}
      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-icon">🎯</div>
          <div className="metric-info">
            <h3>{modelPerf.metrics.recall_pct}</h3>
            <p>Model Sensitivity (Recall)</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⚡</div>
          <div className="metric-info">
            <h3>7–14 Days</h3>
            <p>Subclinical Early Warning</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-info">
            <h3>{modelPerf.model_name}</h3>
            <p>Evaluated Model Artifact</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🧪</div>
          <div className="metric-info">
            <h3>CE & PL</h3>
            <p>Physiological Biomarkers</p>
          </div>
        </div>
      </div>

      {/* ==================================================
          TAB: PREDICT PAGE (REDESIGNED CLEAN WHITE SAAS DASHBOARD)
      ================================================== */}
      {activeTab === 'predict' && (
        <main className="predict-two-column-layout">
          {/* LEFT COLUMN: COW INFORMATION CARD */}
          <section className="cow-info-card">
            <div className="card-title-header">
              <h2>📋 COW INFORMATION</h2>
              <p className="card-subtitle-text">Enter cow parameters for AI analysis</p>
            </div>

            {/* Quick Preset Buttons */}
            <div className="preset-button-bar">
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Presets:</span>
              <button type="button" className="preset-pill-btn" onClick={() => loadPreset('high')}>🔴 High Risk Cow</button>
              <button type="button" className="preset-pill-btn" onClick={() => loadPreset('subclinical')}>🟡 Subclinical Risk</button>
              <button type="button" className="preset-pill-btn" onClick={() => loadPreset('low')}>🟢 Healthy Cow</button>
            </div>

            <form onSubmit={handleSubmit} className="cow-form-grid">
              {/* Cow ID */}
              <div className="form-input-group full-width">
                <label className="form-label-row" htmlFor="cow_id">
                  <span className="form-label-title"><span className="field-icon">🆔</span> Cow ID / Ear Tag</span>
                </label>
                <input
                  type="text"
                  id="cow_id"
                  name="cow_id"
                  className="input-control"
                  value={formData.cow_id}
                  onChange={handleInputChange}
                  placeholder="e.g. COW-1056"
                  required
                />
              </div>

              {/* ED - Cow Age */}
              <div className="form-input-group">
                <label className="form-label-row" htmlFor="ED">
                  <span className="form-label-title"><span className="field-icon">📅</span> Cow Age</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>(months)</span>
                </label>
                <input
                  type="number"
                  id="ED"
                  name="ED"
                  className="input-control"
                  value={formData.ED}
                  onChange={handleInputChange}
                  min="1"
                  max="200"
                  required
                />
              </div>

              {/* DEL - Days in Lactation */}
              <div className="form-input-group">
                <label className="form-label-row" htmlFor="DEL">
                  <span className="form-label-title"><span className="field-icon">⏱️</span> Days in Lactation</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>(days)</span>
                </label>
                <input
                  type="number"
                  id="DEL"
                  name="DEL"
                  className="input-control"
                  value={formData.DEL}
                  onChange={handleInputChange}
                  min="1"
                  max="600"
                  required
                />
              </div>

              {/* Estado - Reproductive Status */}
              <div className="form-input-group">
                <label className="form-label-row" htmlFor="Estado">
                  <span className="form-label-title"><span className="field-icon">🔄</span> Reproductive Status</span>
                </label>
                <select
                  id="Estado"
                  name="Estado"
                  className="select-control"
                  value={formData.Estado}
                  onChange={handleInputChange}
                  required
                >
                  <option value="Gestante">Gestante (Pregnant)</option>
                  <option value="Abierta">Abierta (Open / Non-bred)</option>
                  <option value="Inseminada">Inseminada (Inseminated)</option>
                  <option value="No gestante">No gestante (Non-pregnant)</option>
                  <option value="Estéril">Estéril (Sterile)</option>
                </select>
              </div>

              {/* NP - Parity */}
              <div className="form-input-group">
                <label className="form-label-row" htmlFor="NP">
                  <span className="form-label-title"><span className="field-icon">🐄</span> Parity / Calvings</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>(count)</span>
                </label>
                <input
                  type="number"
                  id="NP"
                  name="NP"
                  className="input-control"
                  value={formData.NP}
                  onChange={handleInputChange}
                  min="1"
                  max="15"
                  required
                />
              </div>

              {/* PL - Daily Milk Yield */}
              <div className="form-input-group">
                <label className="form-label-row" htmlFor="PL">
                  <span className="form-label-title"><span className="field-icon">🥛</span> Daily Milk Yield</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>(L/day)</span>
                </label>
                <input
                  type="number"
                  id="PL"
                  name="PL"
                  className="input-control"
                  value={formData.PL}
                  onChange={handleInputChange}
                  step="0.1"
                  min="0.1"
                  max="50"
                  required
                />
              </div>

              {/* CE - Electrical Conductivity */}
              <div className="form-input-group">
                <label className="form-label-row" htmlFor="CE">
                  <span className="form-label-title"><span className="field-icon">⚡</span> Electrical Conductivity</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>(mS/cm)</span>
                </label>
                <input
                  type="number"
                  id="CE"
                  name="CE"
                  className="input-control"
                  value={formData.CE}
                  onChange={handleInputChange}
                  step="0.1"
                  min="1.0"
                  max="15.0"
                  required
                />
              </div>

              {/* Submit Main Button */}
              <button type="submit" className="analyze-submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    <span>Analyzing Cow Parameters...</span>
                  </>
                ) : (
                  <>
                    <span>⚡ ANALYZE COW RISK</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* RIGHT COLUMN: AI RISK ANALYSIS CARD */}
          <section className="ai-risk-card">
            <div className="card-title-header">
              <h2>🧠 AI RISK ANALYSIS</h2>
            </div>

            {error && (
              <div className="error-card">
                <h3 className="error-title">⚠️ API Connection Error</h3>
                <p className="error-message">{error}</p>
                <button className="retry-btn" onClick={checkHealthAndLoadPredictions}>
                  Retry Connection 🔄
                </button>
              </div>
            )}

            {!result && !error && (
              <div className="empty-analysis-state">
                <div className="medical-ai-icon">🩺</div>
                <h3>Ready for Prediction</h3>
                <p>Enter the cow parameter values on the left and click <strong>Analyze Cow Risk</strong> to run the model inference.</p>
              </div>
            )}

            {result && !error && (
              <div className="active-analysis-container">
                {/* BIG CIRCULAR PERCENTAGE GAUGE */}
                <div className="gauge-section">
                  <div className="gauge-svg-wrapper">
                    <svg className="gauge-svg" viewBox="0 0 160 160">
                      <circle
                        className="gauge-bg-circle"
                        cx="80"
                        cy="80"
                        r={radius}
                      />
                      <circle
                        className="gauge-fill-circle"
                        cx="80"
                        cy="80"
                        r={radius}
                        stroke={gaugeColor}
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                      />
                    </svg>
                    <div className="gauge-center-content">
                      <span className="gauge-percentage-number">
                        {(result.risk_score * 100).toFixed(0)}%
                      </span>
                      <span className="gauge-title-label">MASTITIS RISK SCORE</span>
                    </div>
                  </div>

                  <div className={`category-risk-badge ${result.risk_category === 'High Risk' ? 'high-risk' : result.risk_category === 'Moderate Risk' ? 'moderate-risk' : result.risk_category === 'Low Risk' ? 'low-risk' : 'no-risk'}`}>
                    {result.risk_category}
                  </div>
                </div>

                {/* HORIZONTAL RISK SCALE CONTINUUM BAR */}
                <div className="risk-scale-box">
                  <div className="scale-tick-numbers">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                  <div className="scale-track-grid">
                    <div className={`scale-segment norisk ${result.risk_category === 'No Risk' ? 'active' : ''}`}></div>
                    <div className={`scale-segment low ${result.risk_category === 'Low Risk' ? 'active' : ''}`}></div>
                    <div className={`scale-segment moderate ${result.risk_category === 'Moderate Risk' ? 'active' : ''}`}></div>
                    <div className={`scale-segment high ${result.risk_category === 'High Risk' ? 'active' : ''}`}></div>
                  </div>
                  <div className="scale-category-labels">
                    <span>No Risk</span>
                    <span>Low</span>
                    <span>Moderate</span>
                    <span>High</span>
                  </div>
                </div>

                {/* FOUR INFORMATION CARDS GRID */}
                <div className="four-info-cards-grid">
                  <div className="info-stat-card">
                    <span className="info-card-label">Risk Score</span>
                    <span className="info-card-value">{(result.risk_score * 100).toFixed(1)}%</span>
                  </div>

                  <div className="info-stat-card">
                    <span className="info-card-label">Risk Category</span>
                    <span className="info-card-value" style={{ color: gaugeColor }}>{result.risk_category}</span>
                  </div>

                  <div className="info-stat-card">
                    <span className="info-card-label">Model Used</span>
                    <span className="info-card-value">{result.model_used}</span>
                  </div>

                  <div className="info-stat-card">
                    <span className="info-card-label">Prediction Status</span>
                    <span className="info-card-value">{result.prediction === 1 ? 'Mastitis Detected' : 'Healthy / Normal'}</span>
                  </div>
                </div>

                {/* TWO SIDE-BY-SIDE CARDS: AI ASSESSMENT & EARLY WARNING */}
                <div className="side-by-side-grid">
                  <div className="side-card">
                    <div className="side-card-title">🤖 AI ASSESSMENT</div>
                    <div className="side-card-body">
                      {isHighOrModerateRisk
                        ? 'Subclinical biomarker parameters indicate elevated risk of udder tissue inflammation and ionic changes.'
                        : 'Milk electrical conductivity and yield parameters are within normal physiological baseline ranges.'}
                    </div>
                  </div>

                  <div className="side-card" style={{ borderColor: isHighOrModerateRisk ? '#fca5a5' : '#a7f3d0', background: isHighOrModerateRisk ? '#fef2f2' : '#ecfdf5' }}>
                    <div className="side-card-title" style={{ color: isHighOrModerateRisk ? '#dc2626' : '#059669' }}>⚠️ EARLY WARNING</div>
                    <div className="side-card-body" style={{ color: isHighOrModerateRisk ? '#991b1b' : '#065f46' }}>
                      {isHighOrModerateRisk
                        ? 'High mastitis risk detected. Increase monitoring and consider veterinary evaluation.'
                        : 'No significant risk detected from the submitted parameters.'}
                    </div>
                  </div>
                </div>

                {/* KEY INPUT PARAMETERS DISPLAY */}
                <div className="key-params-box">
                  <div className="key-params-title">📊 KEY INPUT PARAMETERS</div>
                  <div className="key-params-grid-list">
                    <div className="param-display-chip">
                      <span className="chip-name">Cow ID</span>
                      <span className="chip-val">{formData.cow_id}</span>
                    </div>
                    <div className="param-display-chip">
                      <span className="chip-name">Conductivity (CE)</span>
                      <span className="chip-val">{formData.CE} mS/cm</span>
                    </div>
                    <div className="param-display-chip">
                      <span className="chip-name">Milk Yield (PL)</span>
                      <span className="chip-val">{formData.PL} L/day</span>
                    </div>
                    <div className="param-display-chip">
                      <span className="chip-name">Lactation (DEL)</span>
                      <span className="chip-val">{formData.DEL} days</span>
                    </div>
                    <div className="param-display-chip">
                      <span className="chip-name">Age (ED)</span>
                      <span className="chip-val">{formData.ED} mos</span>
                    </div>
                    <div className="param-display-chip">
                      <span className="chip-name">Parity (NP)</span>
                      <span className="chip-val">{formData.NP}</span>
                    </div>
                  </div>
                </div>

                {/* RECOMMENDED ACTIONS CHECKLIST */}
                <div className="recommended-actions-card">
                  <div className="actions-title">📋 RECOMMENDED ACTIONS</div>
                  <div className="checklist-items-list">
                    <div className="check-item"><span className="check-icon">✓</span> Closely monitor the cow</div>
                    <div className="check-item"><span className="check-icon">✓</span> Check milk quality indicators</div>
                    <div className="check-item"><span className="check-icon">✓</span> Review milking hygiene</div>
                    <div className="check-item"><span className="check-icon">✓</span> Maintain clean and dry bedding</div>
                    <div className="check-item"><span className="check-icon">✓</span> Consider veterinary consultation</div>
                  </div>
                </div>

                {/* WHAT THIS MEANS SECTION */}
                <div className="meaning-info-box">
                  <h5>💡 WHAT THIS MEANS</h5>
                  <p>
                    The AI model analyzes the submitted cow parameters and estimates the mastitis risk level. This prototype is intended for early-warning research and monitoring support.
                  </p>
                </div>

                {/* DISCLAIMER FOOTER NOTE */}
                <div className="disclaimer-text-note">
                  AI prediction for research/prototype use only. This does not constitute a veterinary diagnosis.
                </div>
              </div>
            )}
          </section>
        </main>
      )}

      {/* ==================================================
          TAB: DASHBOARD HOME VIEW
      ================================================== */}
      {activeTab === 'dashboard' && (
        <div className="dashboard-view">
          {/* Prominent High Risk Alert Section */}
          {highRiskCount > 0 && (
            <div className="alert-banner">
              <div className="alert-header">
                <h3>🚨 High Risk Alert</h3>
                <span className="alert-badge">{highRiskCount} Cow(s) At Risk</span>
              </div>
              <div className="alert-body">
                <p>
                  <strong>Urgent Veterinary Warning:</strong> High-risk mastitis indicators detected in your herd history.
                  Immediate udder inspection and clinical monitoring are strongly recommended.
                </p>
                <div className="alert-cow-list">
                  {highRiskCases.slice(0, 3).map((item) => (
                    <div key={item.id} className="alert-cow-item">
                      <span><strong>{item.cow_id}</strong> has an <strong>{(item.risk_score * 100).toFixed(1)}%</strong> mastitis risk score.</span>
                      <span>{item.date_time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Risk Trend Teaser Card */}
          <div className="dashboard-trend-teaser">
            <div className="teaser-info">
              <h4>📈 Herd Risk Trend & Early Warning Analysis</h4>
              <p>
                {hasEnoughHistoryForTrend
                  ? `Current Risk Trend: ${trendDirection} (${pctChangeStr} shift in recent screenings)`
                  : 'Run at least 2 predictions to calculate temporal risk trajectory and early warnings.'}
              </p>
            </div>
            <button
              className="preset-pill-btn"
              style={{ background: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
              onClick={() => setActiveTab('trend')}
            >
              View Risk Trend Analysis 📈 →
            </button>
          </div>

          {/* Actual Statistics Cards Grid */}
          <div className="dashboard-stats-grid">
            <div className="stat-box">
              <span className="stat-number">{totalPredictions}</span>
              <span className="stat-title">Total Predictions</span>
            </div>

            <div className="stat-box high-stat">
              <span className="stat-number">{highRiskCount}</span>
              <span className="stat-title">High Risk Cases</span>
            </div>

            <div className="stat-box moderate-stat">
              <span className="stat-number">{moderateRiskCount}</span>
              <span className="stat-title">Moderate Risk</span>
            </div>

            <div className="stat-box low-stat">
              <span className="stat-number">{lowRiskCount}</span>
              <span className="stat-title">Low Risk Cases</span>
            </div>

            <div className="stat-box norisk-stat">
              <span className="stat-number">{noRiskCount}</span>
              <span className="stat-title">No Risk Cases</span>
            </div>
          </div>

          {totalPredictions > 0 ? (
            <>
              {/* Risk Distribution Visualization */}
              <div className="distribution-card">
                <div className="card-title-bar">
                  <h3>📊 Herd Risk Distribution</h3>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Based on {totalPredictions} predictions from {dbStatus ? 'MongoDB Database' : 'LocalStorage'}
                  </span>
                </div>

                <div className="dist-bar-container">
                  {highRiskCount > 0 && (
                    <div
                      className="dist-segment high"
                      style={{ width: `${highPct}%` }}
                      title={`High Risk: ${highPct}% (${highRiskCount})`}
                    ></div>
                  )}
                  {moderateRiskCount > 0 && (
                    <div
                      className="dist-segment moderate"
                      style={{ width: `${modPct}%` }}
                      title={`Moderate Risk: ${modPct}% (${moderateRiskCount})`}
                    ></div>
                  )}
                  {lowRiskCount > 0 && (
                    <div
                      className="dist-segment low"
                      style={{ width: `${lowPct}%` }}
                      title={`Low Risk: ${lowPct}% (${lowRiskCount})`}
                    ></div>
                  )}
                  {noRiskCount > 0 && (
                    <div
                      className="dist-segment norisk"
                      style={{ width: `${noRiskPct}%` }}
                      title={`No Risk: ${noRiskPct}% (${noRiskCount})`}
                    ></div>
                  )}
                </div>

                <div className="dist-legend">
                  <div className="legend-item">
                    <span className="legend-dot high"></span>
                    <span>High Risk: {highPct}% ({highRiskCount})</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot moderate"></span>
                    <span>Moderate Risk: {modPct}% ({moderateRiskCount})</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot low"></span>
                    <span>Low Risk: {lowPct}% ({lowRiskCount})</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot norisk"></span>
                    <span>No Risk: {noRiskPct}% ({noRiskCount})</span>
                  </div>
                </div>
              </div>

              {/* Recent 5 Predictions Section */}
              <div className="recent-card">
                <div className="card-title-bar">
                  <h3>🕒 Recent 5 Predictions</h3>
                  <button
                    className="preset-pill-btn"
                    onClick={() => setActiveTab('history')}
                  >
                    View All History ({totalPredictions}) →
                  </button>
                </div>

                <div className="recent-list">
                  {recentPredictions.map((item) => (
                    <div key={item.id} className="recent-item">
                      <div className="recent-info">
                        <span className="recent-cow-id">{item.cow_id}</span>
                        <span className="recent-date">{item.date_time}</span>
                      </div>
                      <div className="recent-right">
                        <span className={getRiskBadgeClass(item.risk_category)}>
                          {item.risk_category}
                        </span>
                        <span className="recent-score">
                          {(item.risk_score * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Clean Empty Dashboard State */
            <div className="empty-dashboard-state">
              <div className="medical-ai-icon">🩺</div>
              <h4>No Predictions Recorded Yet</h4>
              <p>Run your first prediction using the form to generate herd health statistics and risk distributions.</p>
              <button
                className="cta-btn"
                onClick={() => setActiveTab('predict')}
              >
                Run First Prediction ⚡
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================================================
          TAB: PREDICTION HISTORY VIEW
      ================================================== */}
      {activeTab === 'history' && (
        <section className="history-section">
          <div className="history-header-bar">
            <div>
              <h2>
                📜 Prediction Screening History
                <span className="storage-badge" style={{ background: dbStatus ? '#d1fae5' : '#eff6ff', color: dbStatus ? '#047857' : '#1d4ed8', borderColor: dbStatus ? '#6ee7b7' : '#bfdbfe' }}>
                  {dbStatus ? '🍃 MongoDB Database Persistence' : '💾 Browser LocalStorage Fallback'}
                </span>
              </h2>
            </div>
            <button
              type="button"
              className="clear-btn"
              onClick={handleClearHistory}
              disabled={history.length === 0}
            >
              Clear History 🗑️
            </button>
          </div>

          {/* History Counters Summary */}
          <div className="history-stats-grid">
            <div className="history-stat-card">
              <div>
                <div className="hstat-num">{totalPredictions}</div>
                <div className="hstat-label">Total Screenings</div>
              </div>
            </div>

            <div className="history-stat-card high">
              <div>
                <div className="hstat-num" style={{ color: '#dc2626' }}>{highRiskCount}</div>
                <div className="hstat-label">High Risk</div>
              </div>
            </div>

            <div className="history-stat-card moderate">
              <div>
                <div className="hstat-num" style={{ color: '#d97706' }}>{moderateRiskCount}</div>
                <div className="hstat-label">Moderate Risk</div>
              </div>
            </div>

            <div className="history-stat-card low">
              <div>
                <div className="hstat-num" style={{ color: '#059669' }}>{lowRiskCount + noRiskCount}</div>
                <div className="hstat-label">Low / No Risk</div>
              </div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="history-controls">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Search by Cow ID (e.g. COW-2218)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              className="filter-select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option value="High Risk">High Risk</option>
              <option value="Moderate Risk">Moderate Risk</option>
              <option value="Low Risk">Low Risk</option>
              <option value="No Risk">No Risk</option>
            </select>
          </div>

          {/* History Table */}
          {filteredHistory.length > 0 ? (
            <div className="table-responsive">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Cow ID</th>
                    <th>Date & Time</th>
                    <th>Risk Category</th>
                    <th>Risk Score</th>
                    <th>Prediction</th>
                    <th>CE (mS/cm)</th>
                    <th>PL (L/day)</th>
                    <th>Model Used</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 700 }}>{item.cow_id}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{item.date_time}</td>
                      <td>
                        <span className={getRiskBadgeClass(item.risk_category)}>
                          {item.risk_category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{(item.risk_score * 100).toFixed(1)}%</td>
                      <td>
                        <span style={{ fontWeight: 600, color: item.prediction === 1 ? '#dc2626' : '#059669' }}>
                          {item.prediction} ({item.label})
                        </span>
                      </td>
                      <td>{item.features?.CE ?? 'N/A'}</td>
                      <td>{item.features?.PL ?? 'N/A'}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.model_used}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="history-empty">
              <h4>No Prediction History Found</h4>
              <p>
                {history.length === 0
                  ? 'Run your first prediction using the Predict tab to record screening history.'
                  : 'No history records match your search filter.'}
              </p>
            </div>
          )}
        </section>
      )}

      {/* ==================================================
          TAB: RISK TREND & EARLY WARNING VIEW
      ================================================== */}
      {activeTab === 'trend' && (
        <div className="trend-view">
          {hasEnoughHistoryForTrend ? (
            <>
              {/* Early Warning Card */}
              <div className={`early-warning-card ${trendDirection.toLowerCase()}`}>
                <div className="warning-title">
                  {trendDirection === 'Increasing' && '⚠️ Early Warning: Mastitis Risk is Increasing'}
                  {trendDirection === 'Stable' && 'ℹ️ Risk Trend Stable'}
                  {trendDirection === 'Decreasing' && '✅ Risk Trend Improving'}
                </div>
                <div className="warning-text">
                  {trendDirection === 'Increasing' &&
                    'Mastitis risk is increasing based on recent prediction history. Increase monitoring and review farm hygiene and milking practices.'}
                  {trendDirection === 'Stable' &&
                    'Continue routine monitoring and good farm management practices.'}
                  {trendDirection === 'Decreasing' &&
                    'Recent risk levels are decreasing. Continue regular monitoring and hygiene practices.'}
                </div>
              </div>

              {/* Risk Trend Status Card Grid */}
              <div className="trend-status-grid">
                <div className="trend-stat-box">
                  <span className="stat-title">Trend Status</span>
                  <span className={`trend-badge ${trendDirection.toLowerCase()}`}>
                    {trendDirection === 'Increasing' && 'Increasing ↗️'}
                    {trendDirection === 'Stable' && 'Stable ➡️'}
                    {trendDirection === 'Decreasing' && 'Decreasing ↘️'}
                  </span>
                </div>

                <div className="trend-stat-box">
                  <span className="stat-title">Current Average Risk</span>
                  <span className="stat-number">{(recentAvg * 100).toFixed(1)}%</span>
                </div>

                <div className="trend-stat-box">
                  <span className="stat-title">Previous Average Risk</span>
                  <span className="stat-number">{(earlierAvg * 100).toFixed(1)}%</span>
                </div>

                <div className="trend-stat-box">
                  <span className="stat-title">Net Percentage Change</span>
                  <span
                    className="stat-number"
                    style={{ color: (recentAvg - earlierAvg) > 0.03 ? '#dc2626' : (recentAvg - earlierAvg) < -0.03 ? '#059669' : '#0f172a' }}
                  >
                    {pctChangeStr}
                  </span>
                </div>
              </div>

              {/* SVG Risk Trend Chart */}
              <div className="trend-chart-card">
                <div className="card-title-bar">
                  <h3>📈 Risk Score Trend Over Time</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {chronoHistory.length} Predictions from {dbStatus ? 'MongoDB Database' : 'LocalStorage'}
                  </span>
                </div>

                <div className="chart-wrapper">
                  <svg className="chart-svg" viewBox="0 0 700 240">
                    <line x1="50" y1="30" x2="670" y2="30" stroke="#e2e8f0" strokeDasharray="4" />
                    <line x1="50" y1="80" x2="670" y2="80" stroke="#e2e8f0" strokeDasharray="4" />
                    <line x1="50" y1="130" x2="670" y2="130" stroke="#e2e8f0" strokeDasharray="4" />
                    <line x1="50" y1="180" x2="670" y2="180" stroke="#e2e8f0" strokeDasharray="4" />

                    <text x="40" y="34" textAnchor="end" fontSize="11" fill="#64748b" fontWeight="600">100%</text>
                    <text x="40" y="84" textAnchor="end" fontSize="11" fill="#64748b" fontWeight="600">75%</text>
                    <text x="40" y="134" textAnchor="end" fontSize="11" fill="#64748b" fontWeight="600">50%</text>
                    <text x="40" y="184" textAnchor="end" fontSize="11" fill="#64748b" fontWeight="600">25%</text>

                    {(() => {
                      const width = 620;
                      const height = 150;
                      const startX = 60;
                      const startY = 180;

                      const points = chronoHistory.map((item, idx) => {
                        const x = startX + (idx / Math.max(chronoHistory.length - 1, 1)) * width;
                        const y = startY - (item.risk_score * height);
                        return { x, y, item };
                      });

                      const pointsString = points.map(p => `${p.x},${p.y}`).join(' ');

                      return (
                        <>
                          <polyline
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="3"
                            points={pointsString}
                          />

                          {points.map((p, i) => {
                            let circleColor = '#059669';
                            if (p.item.risk_category === 'High Risk') circleColor = '#dc2626';
                            else if (p.item.risk_category === 'Moderate Risk') circleColor = '#d97706';

                            return (
                              <g key={p.item.id}>
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="6"
                                  fill={circleColor}
                                  stroke="#ffffff"
                                  strokeWidth="2"
                                />
                                <text
                                  x={p.x}
                                  y={p.y - 12}
                                  textAnchor="middle"
                                  fontSize="10"
                                  fontWeight="700"
                                  fill="#0f172a"
                                >
                                  {p.item.cow_id} ({(p.item.risk_score * 100).toFixed(0)}%)
                                </text>
                                <text
                                  x={p.x}
                                  y="210"
                                  textAnchor="middle"
                                  fontSize="10"
                                  fill="#64748b"
                                >
                                  #{i + 1}
                                </text>
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                </div>

                <div className="trend-timeline-list">
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Prediction History Timeline ({dbStatus ? 'MongoDB Database' : 'LocalStorage Cache'}):
                  </h4>
                  {chronoHistory.map((item, index) => (
                    <div key={item.id} className="timeline-row">
                      <span style={{ fontWeight: 700 }}>#{index + 1} - {item.cow_id}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.date_time}</span>
                      <span className={getRiskBadgeClass(item.risk_category)}>{item.risk_category}</span>
                      <span style={{ fontWeight: 800 }}>{(item.risk_score * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* High Risk Cases Summary Card */}
              <div className="trend-high-summary">
                <div className="card-title-bar">
                  <h3>🚨 High Risk Cases Summary</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {highRiskCount} Record(s) Flagged
                  </span>
                </div>

                {highRiskCount > 0 ? (
                  <div className="high-cow-grid">
                    {highRiskCases.map((item) => (
                      <div key={item.id} className="high-cow-card">
                        <div>
                          <div className="high-cow-name">{item.cow_id}</div>
                          <div style={{ fontSize: '11px', color: '#991b1b' }}>{item.date_time}</div>
                        </div>
                        <div className="high-cow-score">
                          {(item.risk_score * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', paddingTop: '8px' }}>
                    No high-risk records in your current prediction history.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="empty-dashboard-state">
              <div className="medical-ai-icon">📈</div>
              <h4>Not Enough Prediction History to Calculate a Trend</h4>
              <p>Not enough prediction history to calculate a trend. At least 2 prediction records are required to analyze risk trends over time.</p>
              <button
                className="cta-btn"
                onClick={() => setActiveTab('predict')}
              >
                Run Predictions ⚡
              </button>
            </div>
          )}

          <div className="feature-disclaimer">
            <p>
              <strong>Trend Disclaimer:</strong> Risk trend is based on recorded AI predictions and is intended for monitoring support, not veterinary diagnosis.
            </p>
          </div>
        </div>
      )}

      {/* ==================================================
          TAB: MODEL PERFORMANCE EVALUATION VIEW
      ================================================== */}
      {activeTab === 'performance' && (
        <div className="performance-view">
          {/* Classification Metrics Grid */}
          <div className="dashboard-stats-grid">
            <div className="stat-box">
              <span className="stat-number" style={{ color: '#2563eb' }}>{modelPerf.metrics.accuracy_pct}</span>
              <span className="stat-title">Accuracy</span>
            </div>

            <div className="stat-box">
              <span className="stat-number" style={{ color: '#059669' }}>{modelPerf.metrics.recall_pct}</span>
              <span className="stat-title">Recall (Sensitivity)</span>
            </div>

            <div className="stat-box">
              <span className="stat-number" style={{ color: '#d97706' }}>{modelPerf.metrics.precision_pct}</span>
              <span className="stat-title">Precision</span>
            </div>

            <div className="stat-box">
              <span className="stat-number" style={{ color: '#4338ca' }}>{modelPerf.metrics.f1_score}</span>
              <span className="stat-title">F1 Score</span>
            </div>

            <div className="stat-box">
              <span className="stat-number" style={{ color: '#0284c7' }}>{modelPerf.metrics.roc_auc}</span>
              <span className="stat-title">ROC-AUC</span>
            </div>
          </div>

          <div className="perf-grid">
            {/* Confusion Matrix Card */}
            <div className="perf-card">
              <div className="card-title-bar">
                <h3>📊 Confusion Matrix</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Evaluated on {modelPerf.dataset_summary.test_samples} Hold-out Test Samples
                </span>
              </div>

              <div className="matrix-container">
                <div className="matrix-cell tn">
                  <span className="matrix-val">{modelPerf.confusion_matrix.true_negatives_tn}</span>
                  <span className="matrix-label">True Negatives (TN)</span>
                  <span className="matrix-sub">Healthy Cow Correctly Predicted</span>
                </div>

                <div className="matrix-cell fp">
                  <span className="matrix-val">{modelPerf.confusion_matrix.false_positives_fp}</span>
                  <span className="matrix-label">False Positives (FP)</span>
                  <span className="matrix-sub">False Alarm (Over-prediction)</span>
                </div>

                <div className="matrix-cell fn">
                  <span className="matrix-val">{modelPerf.confusion_matrix.false_negatives_fn}</span>
                  <span className="matrix-label">False Negatives (FN)</span>
                  <span className="matrix-sub">Missed Infection (False Healthy)</span>
                </div>

                <div className="matrix-cell tp">
                  <span className="matrix-val">{modelPerf.confusion_matrix.true_positives_tp}</span>
                  <span className="matrix-label">True Positives (TP)</span>
                  <span className="matrix-sub">Mastitis Risk Correctly Flagged</span>
                </div>
              </div>
            </div>

            {/* Feature Importance Card */}
            <div className="perf-card">
              <div className="card-title-bar">
                <h3>🧪 Top Feature Importances</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Gini Impurity Relative Contribution
                </span>
              </div>

              <div className="feature-list">
                {modelPerf.top_features.map((item) => (
                  <div key={item.feature} className="feature-item">
                    <div className="feature-bar-label">
                      <span>{item.feature}</span>
                      <span>{item.importance_pct}%</span>
                    </div>
                    <div className="feature-bar-bg">
                      <div
                        className="feature-bar-fill"
                        style={{ width: `${item.importance_pct}%` }}
                      ></div>
                    </div>
                    <span className="feature-desc">{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Explanations and Disclaimers */}
          <div className="explanation-box">
            <p>
              <strong>Feature Importance Disclosure:</strong> {modelPerf.explanations.feature_importance_disclaimer}
            </p>
            <p style={{ marginTop: '8px' }}>
              <strong>Scientific & Forecasting Disclosure:</strong> {modelPerf.explanations.diagnostic_disclaimer} 7-14 day forecasting is supported as subclinical screening guidance based on biomarker trends, not deterministic longitudinal proof.
            </p>
          </div>
        </div>
      )}

      {/* Disclaimer Footer */}
      <footer className="disclaimer-footer">
        <p>
          <strong>SIH Research Prototype Disclaimer:</strong> MastiGuard AI is developed strictly for artificial intelligence research and SIH demonstration purposes.
          Model predictions do not constitute a clinical veterinary diagnosis and require real-world field validation.
        </p>
      </footer>
    </div>
  );
}

export default App;
