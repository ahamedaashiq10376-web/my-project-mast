import React, { useState, useEffect } from 'react';
import './App.css';
import { translations } from './translations';

export default function App() {
  const [lang, setLang] = useState('en');
  const t = translations[lang] || translations.en;

  const [activeTab, setActiveTab] = useState('dashboard');
  const [history, setHistory] = useState([]);
  const [selectedCow, setSelectedCow] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState('7days');

  // Form State
  const [formData, setFormData] = useState({
    cow_id: 'COW-1056',
    age_months: '36',
    del_days: '90',
    estado_reproductivo: 'Gestante',
    np_calvings: '2',
    pl_milk_yield: '24.5',
    milk_ph: '6.65',
    milk_temperature: '38.3',
    milk_temp: '38.3',
    milk_colour: 'Normal White',
    ec: '5.4',
    electrical_conductivity: '5.4',
    scc: '210000',
    somatic_cell_count: '210000'
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [activePrediction, setActivePrediction] = useState(null);

  // Load predictions on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('https://mastiguard-api.onrender.com/predictions');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      } else {
        const local = JSON.parse(localStorage.getItem('mastiguard_history') || '[]');
        setHistory(local);
      }
    } catch (e) {
      const local = JSON.parse(localStorage.getItem('mastiguard_history') || '[]');
      setHistory(local);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Keep alias keys in sync
      ...(name === 'milk_temperature' ? { milk_temp: value } : {}),
      ...(name === 'ec' ? { electrical_conductivity: value } : {}),
      ...(name === 'scc' ? { somatic_cell_count: value } : {})
    }));
  };

  const handlePreset = (presetType) => {
    if (presetType === 'high') {
      setFormData({
        cow_id: 'COW-2218',
        age_months: '48',
        del_days: '140',
        estado_reproductivo: 'Abierta',
        np_calvings: '3',
        pl_milk_yield: '16.2',
        milk_ph: '7.15',
        milk_temperature: '39.6',
        milk_temp: '39.6',
        milk_colour: 'Yellowish / Viscous',
        ec: '7.8',
        electrical_conductivity: '7.8',
        scc: '850000',
        somatic_cell_count: '850000'
      });
    } else if (presetType === 'subclinical') {
      setFormData({
        cow_id: 'COW-1842',
        age_months: '30',
        del_days: '60',
        estado_reproductivo: 'Inseminada',
        np_calvings: '1',
        pl_milk_yield: '22.0',
        milk_ph: '6.85',
        milk_temperature: '38.8',
        milk_temp: '38.8',
        milk_colour: 'Normal White',
        ec: '6.3',
        electrical_conductivity: '6.3',
        scc: '390000',
        somatic_cell_count: '390000'
      });
    } else {
      setFormData({
        cow_id: 'COW-1002',
        age_months: '32',
        del_days: '80',
        estado_reproductivo: 'Gestante',
        np_calvings: '2',
        pl_milk_yield: '26.8',
        milk_ph: '6.60',
        milk_temperature: '38.2',
        milk_temp: '38.2',
        milk_colour: 'Normal White',
        ec: '5.2',
        electrical_conductivity: '5.2',
        scc: '180000',
        somatic_cell_count: '180000'
      });
    }
  };

  const handleSubmitPrediction = async (e) => {
    e.preventDefault();

    // Cleanly convert numeric inputs using Number()
    const cowId = (formData.cow_id || 'COW-1056').trim();
    const ph = Number(formData.milk_ph);
    const temp = Number(formData.milk_temperature ?? formData.milk_temp);
    const ecVal = Number(formData.ec ?? formData.electrical_conductivity);
    const sccVal = Number(formData.scc ?? formData.somatic_cell_count);

    const milkYieldRaw = formData.pl_milk_yield;
    const milkYield = milkYieldRaw !== '' && milkYieldRaw !== null && milkYieldRaw !== undefined ? Number(milkYieldRaw) : 18.5;

    const delDaysRaw = formData.del_days;
    const delDays = delDaysRaw !== '' && delDaysRaw !== null && delDaysRaw !== undefined ? Number(delDaysRaw) : 60;

    const ageMonthsRaw = formData.age_months;
    const ageMonths = ageMonthsRaw !== '' && ageMonthsRaw !== null && ageMonthsRaw !== undefined ? Number(ageMonthsRaw) : 36;

    const npCalvingsRaw = formData.np_calvings;
    const npCalvings = npCalvingsRaw !== '' && npCalvingsRaw !== null && npCalvingsRaw !== undefined ? Number(npCalvingsRaw) : 1;

    // Strict validation rules: check for empty, NaN, Infinity, or non-positive values
    if (!cowId) {
      alert("Validation Error: Cow ID / Ear Tag cannot be empty.");
      return;
    }
    if (isNaN(ph) || !isFinite(ph) || ph <= 0) {
      alert("Validation Error: Please enter a valid positive numeric Milk pH (e.g. 6.65).");
      return;
    }
    if (isNaN(temp) || !isFinite(temp) || temp <= 0) {
      alert("Validation Error: Please enter a valid positive numeric Milk Temperature in °C (e.g. 38.3).");
      return;
    }
    if (isNaN(ecVal) || !isFinite(ecVal) || ecVal < 0) {
      alert("Validation Error: Please enter a valid non-negative numeric Electrical Conductivity (EC) in mS/cm (e.g. 5.4).");
      return;
    }
    if (isNaN(sccVal) || !isFinite(sccVal) || sccVal < 0) {
      alert("Validation Error: Please enter a valid non-negative numeric Somatic Cell Count (SCC) in cells/mL (e.g. 210000).");
      return;
    }

    setAnalyzing(true);

    const payload = {
      cow_id: cowId,
      milk_ph: ph,
      Milk_pH: ph,
      milk_temperature: temp,
      milk_temp: temp,
      Milk_Temperature: temp,
      ec: ecVal,
      electrical_conductivity: ecVal,
      Milk_Conductivity: ecVal,
      CE: ecVal,
      scc: sccVal,
      somatic_cell_count: sccVal,
      Somatic_Cell_Count: sccVal,
      milk_colour: (formData.milk_colour || 'Normal White').trim(),
      pl_milk_yield: !isNaN(milkYield) && isFinite(milkYield) ? milkYield : 18.5,
      Milk_Yield: !isNaN(milkYield) && isFinite(milkYield) ? milkYield : 18.5,
      PL: !isNaN(milkYield) && isFinite(milkYield) ? milkYield : 18.5,
      del_days: !isNaN(delDays) && isFinite(delDays) ? delDays : 60,
      Day: !isNaN(delDays) && isFinite(delDays) ? delDays : 60,
      DEL: !isNaN(delDays) && isFinite(delDays) ? delDays : 60,
      age_months: !isNaN(ageMonths) && isFinite(ageMonths) ? ageMonths : 36,
      ED: !isNaN(ageMonths) && isFinite(ageMonths) ? ageMonths : 36,
      estado_reproductivo: formData.estado_reproductivo || 'Gestante',
      Estado: formData.estado_reproductivo || 'Gestante',
      np_calvings: !isNaN(npCalvings) && isFinite(npCalvings) ? npCalvings : 1,
      NP: !isNaN(npCalvings) && isFinite(npCalvings) ? npCalvings : 1
    };

    console.log("Submitting Prediction Payload (Exact JSON sent):", JSON.stringify(payload, null, 2));

    try {
      const res = await fetch('https://mastiguard-api.onrender.com/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        console.log("Received Prediction API Response:", result);
        setActivePrediction(result);
        fetchHistory();
      } else {
        const errData = await res.json().catch(() => ({}));
        let errMsg = 'Server error processing prediction request.';
        if (typeof errData.detail === 'string') {
          errMsg = errData.detail;
        } else if (Array.isArray(errData.detail)) {
          errMsg = errData.detail.map(d => `${d.loc ? d.loc.join('.') : 'Field'}: ${d.msg}`).join('\n');
        } else if (errData.message) {
          errMsg = errData.message;
        }

        if (res.status === 422) {
          alert(`Validation Error (HTTP 422):\n${errMsg}`);
        } else if (res.status === 400) {
          alert(`Bad Request (HTTP 400):\n${errMsg}`);
        } else if (res.status === 500) {
          alert(`Server Error (HTTP 500):\n${errMsg}`);
        } else {
          alert(`Prediction API Error (HTTP ${res.status}):\n${errMsg}`);
        }
      }
    } catch (err) {
      console.error("Prediction network error:", err);
      alert("API Connection Error: Unable to connect to MastiGuard AI backend. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Dynamic Dashboard Stats Calculations
  const totalPredictions = history.length;
  const highRiskList = history.filter(h => h.risk_category === 'High Risk' || (h.risk_percentage >= 65));
  const moderateRiskList = history.filter(h => h.risk_category === 'Moderate Risk' || (h.risk_percentage >= 35 && h.risk_percentage < 65));
  const lowRiskList = history.filter(h => h.risk_category === 'Low Risk' || h.risk_category === 'No Risk' || (h.risk_percentage < 35));

  const highCount = highRiskList.length;
  const moderateCount = moderateRiskList.length;
  const lowCount = lowRiskList.length;

  // Herd Health Score (0 - 100)
  const herdHealthScore = totalPredictions > 0
    ? Math.max(0, Math.min(100, Math.round(100 - ((highCount * 45 + moderateCount * 20) / totalPredictions))))
    : 82;

  const getScoreStatusLabel = (score) => {
    if (score >= 80) return { label: t.healthScoreGood || "GOOD", class: "good" };
    if (score >= 60) return { label: t.healthScoreFair || "FAIR", class: "watch" };
    return { label: t.healthScoreAttention || "CRITICAL", class: "critical" };
  };
  const scoreStatus = getScoreStatusLabel(herdHealthScore);

  // Priority Cow Calculation
  const priorityCow = highRiskList.length > 0 ? highRiskList[0] : (history[0] || null);

  // Milk Health Snapshot Averages
  const validPhs = history.map(h => h.input_parameters?.Milk_pH || h.milk_ph).filter(Boolean);
  const validEcs = history.map(h => h.input_parameters?.Milk_Conductivity || h.electrical_conductivity).filter(Boolean);
  const validSccs = history.map(h => h.input_parameters?.Somatic_Cell_Count || h.somatic_cell_count).filter(Boolean);
  const validTemps = history.map(h => h.input_parameters?.Milk_Temperature || h.milk_temp).filter(Boolean);

  const avgPh = validPhs.length > 0 ? (validPhs.reduce((a, b) => Number(a) + Number(b), 0) / validPhs.length).toFixed(2) : null;
  const avgEc = validEcs.length > 0 ? (validEcs.reduce((a, b) => Number(a) + Number(b), 0) / validEcs.length).toFixed(1) : null;
  const avgScc = validSccs.length > 0 ? Math.round(validSccs.reduce((a, b) => Number(a) + Number(b), 0) / validSccs.length).toLocaleString() : null;
  const avgTemp = validTemps.length > 0 ? (validTemps.reduce((a, b) => Number(a) + Number(b), 0) / validTemps.length).toFixed(1) : null;

  // Recent 5 Predictions
  const recentPredictions = history.slice(0, 5);

  // Unique Cow Map Nodes
  const uniqueCowMap = [];
  const seenCows = new Set();
  history.forEach(h => {
    const cid = h.cow_id || 'COW-UNKNOWN';
    if (!seenCows.has(cid)) {
      seenCows.add(cid);
      uniqueCowMap.push(h);
    }
  });

  return (
    <div className="command-center-layout">
      {/* DESKTOP 3D GLASS SIDEBAR */}
      <aside className="app-sidebar float-3d-panel">
        <div className="sidebar-top">
          <div className="sidebar-brand-box">
            <div className="sidebar-logo-icon float-badge-3d">🐄</div>
            <div className="sidebar-brand-text">
              <h2>MastiGuard AI</h2>
              <div className="sidebar-tagline">{t.appSubtitle}</div>
            </div>
          </div>

          <nav className="sidebar-nav-menu">
            <button
              className={`sidebar-menu-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <span className="menu-icon">🏠</span>
              <span>{t.navDashboard.replace('🏠 ', '')}</span>
            </button>
            <button
              className={`sidebar-menu-btn ${activeTab === 'predict' ? 'active' : ''}`}
              onClick={() => setActiveTab('predict')}
            >
              <span className="menu-icon">⚡</span>
              <span>{t.navPredict.replace('⚡ ', '')}</span>
            </button>
            <button
              className={`sidebar-menu-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <span className="menu-icon">📜</span>
              <span>{t.navHistory.replace('📜 ', '')}</span>
            </button>
            <button
              className={`sidebar-menu-btn ${activeTab === 'trend' ? 'active' : ''}`}
              onClick={() => setActiveTab('trend')}
            >
              <span className="menu-icon">📈</span>
              <span>{t.navTrend.replace('📈 ', '')}</span>
            </button>
            <button
              className={`sidebar-menu-btn ${activeTab === 'performance' ? 'active' : ''}`}
              onClick={() => setActiveTab('performance')}
            >
              <span className="menu-icon">📊</span>
              <span>{t.navPerformance.replace('📊 ', '')}</span>
            </button>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-lang-box">
            <span className="sidebar-lang-label">🌐 Language:</span>
            <div className="lang-selector-group">
              <button
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
              >
                {t.langEnglish}
              </button>
              <button
                className={`lang-btn ${lang === 'ta' ? 'active' : ''}`}
                onClick={() => setLang('ta')}
              >
                {t.langTamil}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE RESPONSIVE HEADER (< 1024px) */}
      <header className="mobile-cmd-header">
        <div className="mobile-nav-top">
          <div className="mobile-brand-title">
            <div className="sidebar-logo-icon">🐄</div>
            <div>
              <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 900 }}>MastiGuard AI</h2>
              <div style={{ fontSize: '10px', color: '#64748b' }}>{t.appSubtitle}</div>
            </div>
          </div>
          <div className="lang-selector-group">
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
            <button className={`lang-btn ${lang === 'ta' ? 'active' : ''}`} onClick={() => setLang('ta')}>தமிழ்</button>
          </div>
        </div>

        <nav className="mobile-nav-menu-scroll">
          <button className={`mobile-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>{t.navDashboard}</button>
          <button className={`mobile-nav-btn ${activeTab === 'predict' ? 'active' : ''}`} onClick={() => setActiveTab('predict')}>{t.navPredict}</button>
          <button className={`mobile-nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>{t.navHistory}</button>
          <button className={`mobile-nav-btn ${activeTab === 'trend' ? 'active' : ''}`} onClick={() => setActiveTab('trend')}>{t.navTrend}</button>
          <button className={`mobile-nav-btn ${activeTab === 'performance' ? 'active' : ''}`} onClick={() => setActiveTab('performance')}>{t.navPerformance}</button>
        </nav>
      </header>

      {/* MAIN COMMAND CENTER CONTENT */}
      <main className="cmd-main-wrapper">

        {/* TOP FARMER HEADER BANNER */}
        <div className="cmd-top-header-bar glass-3d-card">
          <div className="header-brand-info">
            <div className="hero-badge-pill">✨ HERD INSIGHTS AGRI-COMMAND CENTER</div>
            <h1 className="header-command-title">{t.cmdMainTitle}</h1>
            <p className="header-command-sub">{t.cmdMainSub}</p>
          </div>

          <div className="farmer-profile-badge glass-3d-card">
            <div className="farmer-avatar-glow">👨‍🌾</div>
            <div className="farmer-info">
              <div className="farmer-name">{t.farmerProfileName || "Herd Management"}</div>
              <div className="farm-sub">{t.farmerProfileSub || "GreenPastures Dairy"}</div>
            </div>
          </div>
        </div>

        {/* TAB 1: DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <div className="cmd-sections-grid">

            {/* SECTION 2 — 3D HERO BANNER WITH FLOATING GLASS BADGES */}
            <section className="glass-3d-hero-container">
              <div className="hero-text-content">
                <h2 className="hero-title">{t.cmdMainTitle}</h2>
                <p className="hero-subtitle">{t.heroSubtitle3D || "Smart herd monitoring for early mastitis risk detection."}</p>

                <div className="hero-cta-group">
                  <button className="hero-action-btn primary-3d-glow" onClick={() => setActiveTab('predict')}>
                    ⚡ {t.dashRunFirstPredictionBtn || "Run Screen Analysis"}
                  </button>
                  <button className="hero-action-btn secondary-glass" onClick={() => setActiveTab('history')}>
                    📜 {t.btnViewAllHistory}
                  </button>
                </div>
              </div>

              {/* RIGHT 3D COW HEALTH ILLUSTRATION CONTAINER */}
              <div className="hero-3d-visual-wrapper">
                <div className="cow-aura-glow"></div>
                <div className="cow-3d-illustration-frame float-3d-card">
                  <span className="cow-emoji-hero">🐄</span>
                </div>

                {/* FLOATING 3D GLASS PARAMETER BADGES */}
                <div className="floating-badge-3d badge-ph float-anim-1">
                  <span className="badge-icon">🧪</span>
                  <span className="badge-name">pH</span>
                  <span className="badge-val">{avgPh ? avgPh : t.dataUnavailable}</span>
                </div>

                <div className="floating-badge-3d badge-ec float-anim-2">
                  <span className="badge-icon">⚡</span>
                  <span className="badge-name">EC</span>
                  <span className="badge-val">{avgEc ? `${avgEc} mS/cm` : t.dataUnavailable}</span>
                </div>

                <div className="floating-badge-3d badge-temp float-anim-3">
                  <span className="badge-icon">🌡️</span>
                  <span className="badge-name">Temp</span>
                  <span className="badge-val">{avgTemp ? `${avgTemp} °C` : t.dataUnavailable}</span>
                </div>

                <div className="floating-badge-3d badge-scc float-anim-4">
                  <span className="badge-icon">🔬</span>
                  <span className="badge-name">SCC</span>
                  <span className="badge-val">{avgScc ? `${avgScc}` : t.dataUnavailable}</span>
                </div>
              </div>
            </section>

            {/* SECTION 3 & 4 — 3D SCORE & FLOATING RISK ORBS */}
            <div className="score-trio-container">

              {/* 3D HERD HEALTH SCORE CARD */}
              <div className="cmd-card glass-3d-card score-main-ring-box float-3d-hover">
                <h3 className="score-card-title">HERD HEALTH SCORE</h3>

                <div className="score-ring-wrapper">
                  <svg className="score-ring-svg" viewBox="0 0 120 120">
                    <circle className="score-ring-bg" cx="60" cy="60" r="48" />
                    <circle
                      className={`score-ring-fill ${scoreStatus.class}`}
                      cx="60"
                      cy="60"
                      r="48"
                      style={{
                        strokeDasharray: 301.5,
                        strokeDashoffset: 301.5 - (301.5 * herdHealthScore) / 100
                      }}
                    />
                  </svg>
                  <div className="score-ring-center">
                    <div className="score-num">{herdHealthScore}</div>
                    <div className="score-denom">/ 100</div>
                  </div>
                </div>

                <div className={`score-status-label ${scoreStatus.class}`}>
                  {scoreStatus.label}
                </div>
              </div>

              {/* SECTION 4 — FLOATING RISK ORBS / PANELS */}
              <div className="risk-trio-grid">
                <div className="risk-summary-card high glass-3d-orb float-orb-high">
                  <div className="risk-orb-glow high"></div>
                  <div className="risk-card-left">
                    <h4>HIGH RISK</h4>
                    <p>{t.highRiskNeedAttention}</p>
                  </div>
                  <div className="risk-card-count">{highCount} Cows</div>
                </div>

                <div className="risk-summary-card moderate glass-3d-orb float-orb-mod">
                  <div className="risk-orb-glow moderate"></div>
                  <div className="risk-card-left">
                    <h4>MODERATE RISK</h4>
                    <p>{t.moderateRiskMonitorClosely}</p>
                  </div>
                  <div className="risk-card-count">{moderateCount} Cows</div>
                </div>

                <div className="risk-summary-card low glass-3d-orb float-orb-low">
                  <div className="risk-orb-glow low"></div>
                  <div className="risk-card-left">
                    <h4>LOW / NO RISK</h4>
                    <p>{t.lowRiskAllGood}</p>
                  </div>
                  <div className="risk-card-count">{lowCount} Cows</div>
                </div>
              </div>

            </div>

            {/* SECTION 5 & 6 — PRIORITY COW & LIVE HERD HEALTH CHART */}
            <div className="cmd-two-col-grid">

              {/* SECTION 5 — PRIORITY COW CARD */}
              <div className="cmd-card glass-3d-card priority-cow-section float-3d-hover">
                <div className="priority-cow-header">
                  <div>
                    <span className="priority-badge-title">📌 PRIORITY COW</span>
                    <div className="priority-cow-id-tag">
                      {priorityCow ? priorityCow.cow_id : 'COW-2218'}
                    </div>
                  </div>

                  <div className="priority-risk-badge-box">
                    <span className={`category-risk-badge ${priorityCow?.risk_category === 'High Risk' ? 'high-risk' : 'low-risk'}`}>
                      {priorityCow ? priorityCow.risk_category : 'HIGH RISK'}
                    </span>
                    <div className="priority-risk-pct">
                      {priorityCow ? `${priorityCow.risk_percentage}%` : '80%'}
                    </div>
                  </div>
                </div>

                {/* 3D COW FRAME AVATAR WITH CIRCULAR RISK RING */}
                <div className="priority-avatar-frame-box">
                  <div className="priority-ring-aura high"></div>
                  <div className="priority-cow-avatar-3d">
                    🐄
                  </div>
                </div>

                <div className="priority-indicators-box glass-inner">
                  <div className="priority-indicators-title">{t.mainIndicatorsTitle}</div>
                  <div className="priority-indicators-list">
                    <div className="indicator-bullet-item">
                      <span className="indicator-dot"></span>
                      <span>{t.indicatorHighEc}</span>
                    </div>
                    <div className="indicator-bullet-item">
                      <span className="indicator-dot"></span>
                      <span>{t.indicatorElevatedTemp}</span>
                    </div>
                    <div className="indicator-bullet-item">
                      <span className="indicator-dot"></span>
                      <span>{t.indicatorAbnormalPh}</span>
                    </div>
                  </div>
                </div>

                <button className="priority-view-btn primary-3d-glow" onClick={() => setActiveTab('predict')}>
                  {t.btnViewCowHealth}
                </button>
              </div>

              {/* SECTION 6 — LIVE HERD HEALTH 3D VISUALIZATION CHART */}
              <div className="cmd-card glass-3d-card trend-chart-section float-3d-hover">
                <div className="cmd-card-header">
                  <h3>📊 {t.liveHerdHealthTitle || "Live Herd Health"}</h3>
                  <button className="trend-filter-btn glass-btn">
                    {t.filter7Days} ▼
                  </button>
                </div>

                <div className="svg-trend-chart-wrapper">
                  <svg viewBox="0 0 400 180" className="trend-chart-svg">
                    <defs>
                      <linearGradient id="gradHealthy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="gradHigh" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#dc2626" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    <line x1="20" y1="30" x2="380" y2="30" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="20" y1="80" x2="380" y2="80" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="20" y1="130" x2="380" y2="130" stroke="#e2e8f0" strokeDasharray="3 3" />

                    {/* Healthy Curve Fill & Line */}
                    <path d="M 30 110 Q 90 40, 150 50 T 270 40 T 370 30 L 370 150 L 30 150 Z" fill="url(#gradHealthy)" />
                    <path d="M 30 110 Q 90 40, 150 50 T 270 40 T 370 30" fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" />

                    {/* Watch Curve */}
                    <path d="M 30 130 Q 90 90, 150 110 T 270 95 T 370 100" fill="none" stroke="#d97706" strokeWidth="3" strokeDasharray="4 4" />

                    {/* High Risk Curve Fill & Line */}
                    <path d="M 30 145 Q 90 135, 150 120 T 270 135 T 370 140 L 370 150 L 30 150 Z" fill="url(#gradHigh)" />
                    <path d="M 30 145 Q 90 135, 150 120 T 270 135 T 370 140" fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />

                    {/* Glowing Points */}
                    <circle cx="270" cy="40" r="5" fill="#059669" className="glowing-point" />
                    <circle cx="270" cy="135" r="5" fill="#dc2626" className="glowing-point" />
                  </svg>
                </div>

                <div className="trend-legend-bar">
                  <div className="legend-item"><span className="legend-line healthy"></span> Healthy</div>
                  <div className="legend-item"><span className="legend-line watch"></span> Moderate / Watch</div>
                  <div className="legend-item"><span className="legend-line high"></span> High Risk</div>
                </div>
              </div>

            </div>

            {/* SECTION 7 — MILK HEALTH 3D PARAMETERS */}
            <div className="cmd-card glass-3d-card milk-snapshot-card">
              <div className="cmd-card-header">
                <h3>🥛 {t.milkSnapshotTitle}</h3>
              </div>

              <div className="milk-snapshot-grid">
                <div className="milk-param-card glass-3d-orb">
                  <div className="milk-param-icon">🧪</div>
                  <div className="milk-param-title">{t.avgPhLabel}</div>
                  <div className="milk-param-value">
                    {avgPh ? avgPh : <span className="milk-unavailable">{t.dataUnavailable}</span>}
                  </div>
                  <div className="milk-param-unit">pH</div>
                </div>

                <div className="milk-param-card glass-3d-orb">
                  <div className="milk-param-icon">⚡</div>
                  <div className="milk-param-title">{t.avgEcLabel}</div>
                  <div className="milk-param-value">
                    {avgEc ? avgEc : <span className="milk-unavailable">{t.dataUnavailable}</span>}
                  </div>
                  <div className="milk-param-unit">mS/cm</div>
                </div>

                <div className="milk-param-card glass-3d-orb">
                  <div className="milk-param-icon">🔬</div>
                  <div className="milk-param-title">{t.avgSccLabel}</div>
                  <div className="milk-param-value">
                    {avgScc ? avgScc : <span className="milk-unavailable">{t.dataUnavailable}</span>}
                  </div>
                  <div className="milk-param-unit">cells/mL</div>
                </div>

                <div className="milk-param-card glass-3d-orb">
                  <div className="milk-param-icon">🌡️</div>
                  <div className="milk-param-title">{t.avgTempLabel}</div>
                  <div className="milk-param-value">
                    {avgTemp ? avgTemp : <span className="milk-unavailable">{t.dataUnavailable}</span>}
                  </div>
                  <div className="milk-param-unit">°C</div>
                </div>
              </div>
            </div>

            {/* SECTION 8 — HERD HEALTH MAP (ELEVATED 3D NODES) */}
            <div className="cmd-card glass-3d-card herd-map-card">
              <div className="cmd-card-header">
                <div>
                  <h3>🗺️ {t.herdMapTitle}</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{t.herdMapSub}</p>
                </div>
                <div className="map-legend-pills">
                  <span className="legend-pill green">🟢 Normal</span>
                  <span className="legend-pill orange">🟠 Watch</span>
                  <span className="legend-pill red">🔴 High Risk</span>
                </div>
              </div>

              <div className="herd-map-chips-grid">
                {uniqueCowMap.length > 0 ? (
                  uniqueCowMap.map((cow, idx) => {
                    const isHigh = cow.risk_category === 'High Risk' || cow.risk_percentage >= 65;
                    const isMod = cow.risk_category === 'Moderate Risk' || (cow.risk_percentage >= 35 && cow.risk_percentage < 65);
                    const statusClass = isHigh ? 'red' : isMod ? 'orange' : 'green';

                    return (
                      <div
                        key={idx}
                        className={`cow-map-chip node-3d ${statusClass}`}
                        onClick={() => setSelectedCow(cow)}
                      >
                        <span className="chip-status-dot"></span>
                        <span className="cow-id-lbl">{cow.cow_id || `COW-${1000 + idx}`}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="no-cows-msg">{t.noCowsRecorded}</div>
                )}
              </div>
            </div>

            {/* SECTION 9 & 10 — AI INSIGHTS & RECENT PREDICTIONS TIMELINE */}
            <div className="cmd-two-col-grid">

              {/* SECTION 9 — TODAY'S HERD INSIGHT */}
              <div className="cmd-card glass-3d-card insight-card">
                <div className="cmd-card-header">
                  <h3>💡 {t.todayInsightTitle}</h3>
                </div>

                <div className="insight-bullets-list">
                  {totalPredictions > 0 ? (
                    <>
                      {highCount > 0 && (
                        <div className="insight-item high">
                          <span className="insight-icon">🚨</span>
                          <span>{t.insightHighRiskCount.replace('{count}', highCount)}</span>
                        </div>
                      )}
                      <div className="insight-item healthy">
                        <span className="insight-icon">🟢</span>
                        <span>{t.insightHealthyPct.replace('{pct}', ((lowCount / totalPredictions) * 100).toFixed(0))}</span>
                      </div>
                      <div className="insight-item info">
                        <span className="insight-icon">📊</span>
                        <span>{t.insightStableTrend}</span>
                      </div>
                    </>
                  ) : (
                    <div className="insight-item info">
                      <span className="insight-icon">ℹ️</span>
                      <span>{t.insightNoData}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 10 — RECENT PREDICTIONS FLOATING GLASS TIMELINE */}
              <div className="cmd-card glass-3d-card recent-timeline-card">
                <div className="cmd-card-header">
                  <h3>🕒 {t.recentPredTitle}</h3>
                  <button className="trend-filter-btn glass-btn" onClick={() => setActiveTab('history')}>
                    {t.btnViewAllHistory}
                  </button>
                </div>

                <div className="recent-glass-timeline">
                  {recentPredictions.length > 0 ? (
                    recentPredictions.map((item, idx) => (
                      <div key={idx} className="timeline-glass-item">
                        <div className="timeline-cow-id">🐄 {item.cow_id || 'COW-UNKNOWN'}</div>
                        <div className="timeline-risk-badge">
                          <span className={`category-risk-badge ${item.risk_category === 'High Risk' ? 'high-risk' : 'low-risk'}`}>
                            {item.risk_category || 'Low Risk'}
                          </span>
                        </div>
                        <div className="timeline-pct">{item.risk_percentage || 20}%</div>
                      </div>
                    ))
                  ) : (
                    <p className="no-data-text">{t.dashNoPredictionsText}</p>
                  )}
                </div>
              </div>

            </div>

            {/* SECTION 11 — EARLY DETECTION CARD */}
            <div className="early-detection-banner float-3d-panel">
              <div className="early-icon-box float-badge-3d">🛡️</div>
              <div className="early-text-box">
                <h4>{t.earlyDetectionTitle}</h4>
                <p>{t.earlyDetectionSub}</p>
              </div>
            </div>

          </div>
        )}

        {/* OTHER TABS REMAIN COMPLETELY UNCHANGED */}
        {activeTab === 'predict' && (
          <div className="predict-two-column-layout">
            <div className="predict-left-column">
              <div className="cow-info-card glass-3d-card">
                <div className="card-title-header">
                  <h2>{t.cowInfoTitle}</h2>
                  <p className="card-subtitle-text">{t.cowInfoSub}</p>
                </div>

                <div className="preset-button-bar">
                  <span>{t.presetsLabel}</span>
                  <button className="preset-pill-btn" onClick={() => handlePreset('high')}>{t.presetHigh}</button>
                  <button className="preset-pill-btn" onClick={() => handlePreset('subclinical')}>{t.presetSubclinical}</button>
                  <button className="preset-pill-btn" onClick={() => handlePreset('low')}>{t.presetLow}</button>
                </div>

                <form onSubmit={handleSubmitPrediction} className="cow-form-grid">
                  <div className="form-input-group full-width">
                    <label className="form-label-row">
                      <span className="form-label-title">🏷️ {t.labelCowId}</span>
                    </label>
                    <input
                      type="text"
                      name="cow_id"
                      value={formData.cow_id}
                      onChange={handleInputChange}
                      className="input-control"
                      required
                    />
                  </div>

                  <div className="form-input-group">
                    <label className="form-label-row">
                      <span>🎂 {t.labelAge} {t.unitMonths}</span>
                    </label>
                    <input
                      type="number"
                      name="age_months"
                      value={formData.age_months}
                      onChange={handleInputChange}
                      className="input-control"
                    />
                  </div>

                  <div className="form-input-group">
                    <label className="form-label-row">
                      <span>📅 {t.labelDel} {t.unitDays}</span>
                    </label>
                    <input
                      type="number"
                      name="del_days"
                      value={formData.del_days}
                      onChange={handleInputChange}
                      className="input-control"
                    />
                  </div>

                  <div className="form-input-group">
                    <label className="form-label-row">
                      <span>🍼 {t.labelPl} {t.unitLPerDay}</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="pl_milk_yield"
                      value={formData.pl_milk_yield}
                      onChange={handleInputChange}
                      className="input-control"
                    />
                  </div>

                  <div className="form-input-group">
                    <label className="form-label-row">
                      <span>🧪 {t.labelMilkPh}</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="milk_ph"
                      value={formData.milk_ph}
                      onChange={handleInputChange}
                      className="input-control"
                      required
                    />
                  </div>

                  <div className="form-input-group">
                    <label className="form-label-row">
                      <span>🌡️ {t.labelMilkTemp} {t.unitC}</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="milk_temperature"
                      value={formData.milk_temperature || formData.milk_temp || ''}
                      onChange={handleInputChange}
                      className="input-control"
                      required
                    />
                  </div>

                  <div className="form-input-group">
                    <label className="form-label-row">
                      <span>⚡ {t.labelCe} {t.unitMsCm}</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="ec"
                      value={formData.ec || formData.electrical_conductivity || ''}
                      onChange={handleInputChange}
                      className="input-control"
                      required
                    />
                  </div>

                  <div className="form-input-group">
                    <label className="form-label-row">
                      <span>🔬 {t.labelScc} {t.unitCellsMl}</span>
                    </label>
                    <input
                      type="number"
                      name="scc"
                      value={formData.scc || formData.somatic_cell_count || ''}
                      onChange={handleInputChange}
                      className="input-control"
                      required
                    />
                  </div>

                  <div className="form-input-group full-width">
                    <label className="form-label-row">
                      <span>🎨 {t.labelMilkColour || "Milk Colour / RGB"}</span>
                    </label>
                    <input
                      type="text"
                      name="milk_colour"
                      value={formData.milk_colour || ''}
                      onChange={handleInputChange}
                      placeholder="e.g. Normal White, Yellowish, Slight Red"
                      className="input-control"
                    />
                  </div>

                  <button type="submit" disabled={analyzing} className="analyze-submit-btn">
                    {analyzing ? t.btnAnalyzing : t.btnAnalyzeRisk}
                  </button>
                </form>
              </div>
            </div>

            <div className="predict-right-column">
              <div className="ai-risk-card glass-3d-card">
                <div className="card-title-header">
                  <h2>{t.aiCardTitle}</h2>
                </div>

                {activePrediction ? (
                  <div className="active-analysis-container">
                    <div className="gauge-section">
                      <div className="gauge-svg-wrapper">
                        <svg className="gauge-svg" viewBox="0 0 120 120">
                          <circle className="gauge-bg-circle" cx="60" cy="60" r="48" />
                          <circle
                            className="gauge-fill-circle"
                            cx="60"
                            cy="60"
                            r="48"
                            style={{
                              strokeDasharray: 301.5,
                              strokeDashoffset: 301.5 - (301.5 * (activePrediction.risk_percentage ?? (activePrediction.risk_score * 100))) / 100,
                              stroke: (activePrediction.risk_percentage ?? (activePrediction.risk_score * 100)) > 65 ? '#dc2626' : (activePrediction.risk_percentage ?? (activePrediction.risk_score * 100)) > 35 ? '#d97706' : '#059669'
                            }}
                          />
                        </svg>
                        <div className="gauge-center-content">
                          <div className="gauge-percentage-number">
                            {activePrediction.risk_percentage ?? Math.round((activePrediction.risk_score || 0) * 100)}%
                          </div>
                          <div className="gauge-title-label">{t.gaugeTitle}</div>
                        </div>
                      </div>

                      <div className={`category-risk-badge ${activePrediction.risk_category === 'High Risk' ? 'high-risk' : 'low-risk'}`}>
                        {activePrediction.risk_category || (activePrediction.prediction === 1 ? 'High Risk' : 'Low Risk')}
                      </div>

                      <div className="risk-score-sub-explanation" style={{ textAlign: 'center', fontSize: '12px', color: '#64748b', marginTop: '10px', padding: '0 12px', lineHeight: '1.4', fontStyle: 'italic' }}>
                        {t.riskScoreExplanation}
                      </div>
                    </div>

                    {/* FOUR INFORMATION STAT CARDS */}
                    <div className="four-info-cards-grid">
                      <div className="info-stat-card">
                        <div className="info-card-label">{t.infoLabelPredStatus || "Assessment Result"}</div>
                        <div className="info-card-value" style={{ color: activePrediction.prediction === 1 ? '#dc2626' : '#059669' }}>
                          {activePrediction.prediction === 1 ? (t.valMastitisDetected || 'High Mastitis Risk Flagged') : (t.valHealthyNormal || 'Healthy / Normal')}
                        </div>
                      </div>
                      <div className="info-stat-card">
                        <div className="info-card-label">{t.chipCowId || "Cow ID"}</div>
                        <div className="info-card-value">{activePrediction.cow_id || 'COW-1056'}</div>
                      </div>
                      <div className="info-stat-card" style={{ gridColumn: '1 / -1' }}>
                        <div className="info-card-label">{t.infoLabelModelUsed || "Model Used"}</div>
                        <div className="info-card-value" style={{ fontSize: '13px', fontWeight: '700' }}>
                          {activePrediction.model_used || 'Gradient Boosting Classifier (Sensor Model)'}
                        </div>
                      </div>
                    </div>

                    {/* AI EXPLANATION & CLINICAL ASSESSMENT */}
                    <div className="side-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div className="side-card-title">🧠 AI Physiological Explanation</div>
                      <div className="side-card-body" style={{ marginTop: '6px', fontSize: '13px', lineHeight: '1.5', color: '#1e293b' }}>
                        {activePrediction.ai_explanation || (activePrediction.risk_percentage > 65 ? t.aiAssessmentHighText : t.aiAssessmentLowText)}
                      </div>
                    </div>

                    {/* OUT OF DISTRIBUTION WARNING NOTICE */}
                    {activePrediction.warning && (
                      <div className="side-card" style={{ background: '#fffbe6', border: '1px solid #ffe58f', marginTop: '12px' }}>
                        <div className="side-card-title" style={{ color: '#d46b08' }}>⚠️ Training Range Notice</div>
                        <div className="side-card-body" style={{ marginTop: '4px', fontSize: '12px', lineHeight: '1.4', color: '#873800' }}>
                          {activePrediction.warning}
                        </div>
                      </div>
                    )}

                    {/* KEY INPUT PARAMETERS SUMMARY */}
                    {activePrediction.input_parameters && (
                      <div className="key-params-box">
                        <div className="key-params-title">Input Biomarkers</div>
                        <div className="key-params-grid-list">
                          <div className="param-display-chip">
                            <span className="chip-name">pH:</span>
                            <span className="chip-val">{activePrediction.input_parameters.Milk_pH || activePrediction.input_parameters.milk_ph || '-'}</span>
                          </div>
                          <div className="param-display-chip">
                            <span className="chip-name">Temp:</span>
                            <span className="chip-val">{activePrediction.input_parameters.Milk_Temperature || activePrediction.input_parameters.milk_temp || '-'} °C</span>
                          </div>
                          <div className="param-display-chip">
                            <span className="chip-name">EC:</span>
                            <span className="chip-val">{activePrediction.input_parameters.Milk_Conductivity || activePrediction.input_parameters.electrical_conductivity || '-'} mS/cm</span>
                          </div>
                          <div className="param-display-chip">
                            <span className="chip-name">SCC:</span>
                            <span className="chip-val">{activePrediction.input_parameters.Somatic_Cell_Count ? Number(activePrediction.input_parameters.Somatic_Cell_Count).toLocaleString() : '-'}</span>
                          </div>
                          {activePrediction.input_parameters.Milk_Colour && (
                            <div className="param-display-chip" style={{ gridColumn: '1 / -1' }}>
                              <span className="chip-name">Milk Colour:</span>
                              <span className="chip-val">{activePrediction.input_parameters.Milk_Colour}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty-analysis-state">
                    <div className="medical-ai-icon">🧬</div>
                    <h3>{t.emptyReadyTitle}</h3>
                    <p>{t.emptyReadyText}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-page-container glass-3d-card" style={{ padding: '24px' }}>
            <h2>📜 {t.navHistory}</h2>
            <p>{t.dashDistSubMongo.replace('{count}', history.length)}</p>

            <div className="table-responsive" style={{ marginTop: '20px' }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Cow ID</th>
                    <th>Date / Time</th>
                    <th>Risk Category</th>
                    <th>Risk Score %</th>
                    <th>pH</th>
                    <th>EC (mS/cm)</th>
                    <th>SCC (cells/mL)</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}>
                      <td><strong>{h.cow_id || 'COW-1001'}</strong></td>
                      <td>{h.timestamp || 'Recent'}</td>
                      <td>
                        <span className={`risk-tag ${h.risk_category === 'High Risk' ? 'high-risk' : 'low-risk'}`}>
                          {h.risk_category || 'Low Risk'}
                        </span>
                      </td>
                      <td><strong>{h.risk_percentage || 20}%</strong></td>
                      <td>{h.input_parameters?.Milk_pH || h.milk_ph || '-'}</td>
                      <td>{h.input_parameters?.Milk_Conductivity || h.electrical_conductivity || '-'}</td>
                      <td>{h.input_parameters?.Somatic_Cell_Count || h.somatic_cell_count || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'trend' && (
          <div className="trend-page-container glass-3d-card" style={{ padding: '24px' }}>
            <h2>📈 {t.navTrend}</h2>
            <p>{t.dashTrendTeaserTextHasTrend.replace('{trend}', 'Stable').replace('{change}', '0%')}</p>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="performance-page-container glass-3d-card" style={{ padding: '24px' }}>
            <h2>📊 {t.navPerformance}</h2>
            <div className="metrics-row" style={{ marginTop: '20px' }}>
              <div className="metric-card">
                <div className="metric-icon">🎯</div>
                <div className="metric-info">
                  <h3>100%</h3>
                  <p>{t.metricSensitivity}</p>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon">⏳</div>
                <div className="metric-info">
                  <h3>7–14 Days</h3>
                  <p>{t.metricSubclinical}</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
