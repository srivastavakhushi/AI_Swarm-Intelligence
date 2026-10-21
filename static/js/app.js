/**
 * AEGIS-MARITIME // AI-INTEGRATED COMMAND PLATFORM
 * High-Fidelity Tactical Command Frontend Application Engine (Vanilla JS)
 * Integrated with ACO, A*, Dijkstra Route Optimizer & 2019-2020 Threat Intelligence
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global Application State
  const state = {
    isAuthenticated: false,
    currentRole: 'Fleet Commander',
    currentUser: 'commander',
    activeTab: 'vessel-position',
    activeRightTab: 'ai',
    originPort: 'Penang (Malaysia)',
    destPort: 'Singapore (SE Gateway)',
    algorithm: 'compare',
    primaryRoute: null,
    alternateRoute: null,
    comparisonRoutes: {},
    selectedRouteType: 'primary',
    isApproved: false,
    vesselStatus: 'MOORED',
    selectedContactId: 'VESSEL-001',
    transitTimer: null,
    isAutoTransiting: false,
    map: null,
    layers: {
      piracy: null,
      restricted: null,
      candidates: null,
      primaryRoute: null,
      alternateRoute: null,
      astarRoute: null,
      dijkstraRoute: null,
      vessel: null,
      contacts: null,
      ports: null,
      homeTrack: null
    },
    portsData: [],
    incidentsData: [],
    zonesData: [],

    // Fleet Vessels (Vessel Crew & Fleet Commander Live Sync)
    fleetVessels: [],
    selectedVesselId: 'VESSEL-001',
    crewMap: null,
    crewLayers: {
      vessels: null,
      trails: null,
      gaTour: null
    },
    isAutoSimulating: false,
    simInterval: null,
    fleetPollInterval: null,

    // AI Syllabus Modules (Units 2 & 6)
    expertAdvisory: null,
    kbRules: [],
    gaResult: null,
    gaWaypoints: [],
    selectedGAWaypointIds: new Set()
  };

  // Tracked Contacts List (Dynamically updated from /api/fleet/vessels)
  let TRACKED_CONTACTS = [
    {
      id: 'V002',
      name: 'SSK-417',
      class: 'SUBMARINE',
      flag: '??',
      symbol: 'V',
      threat: 'critical',
      threatLabel: 'CRITICAL',
      lat: 36.88, lon: 29.10,
      hdg: '190°', speed: 7, depth: '-142m',
      lastSeen: '01:08Z', aiConfidence: 87, mmsi: 'NONE',
      type: 'Submarine', dist: '7km',
      details: 'Submarine SSK-417 contact lost - last bearing 190° at 142m. AI predicts intercept vector towards commercial corridor. Anti-submarine warfare (ASW) protocols initiated.'
    },
    {
      id: 'V001',
      name: 'KNYAZ VOLKONSKY',
      class: 'DESTROYER',
      flag: 'RU',
      symbol: '◇',
      threat: 'high',
      threatLabel: 'HIGH',
      lat: 38.20, lon: 27.80,
      hdg: '245°', speed: 18, depth: '0m',
      lastSeen: '00:42Z', aiConfidence: 94, mmsi: '273456123',
      type: 'Destroyer', dist: '18km',
      details: 'Project 956 Sarych-class destroyer - hull KNYAZ VOLKONSKY. Departed Sevastopol 72h ago. Course altered 32° at 00:38Z. Mineral-ME targeting radar active - ISR posture confirmed.'
    },
    {
      id: 'V005',
      name: 'UNIDENTIFIED-01',
      class: 'UNKNOWN',
      flag: '??',
      symbol: 'X',
      threat: 'high',
      threatLabel: 'HIGH',
      lat: 35.90, lon: 31.20,
      hdg: '328°', speed: 22, depth: '0m',
      lastSeen: '00:17Z', aiConfidence: 71, mmsi: 'NONE',
      type: 'Unknown', dist: '22km',
      details: 'Unidentified surface vessel detected via SIGINT / radar cross-section. No AIS transponder active. High-speed vector crossing exclusion zone.'
    },
    {
      id: 'V008',
      name: 'PGM-412',
      class: 'PATROL',
      flag: '??',
      symbol: '△',
      threat: 'medium',
      threatLabel: 'MEDIUM',
      lat: 36.10, lon: 28.00,
      hdg: '50°', speed: 34, depth: '0m',
      lastSeen: '00:29Z', aiConfidence: 82, mmsi: 'NONE',
      type: 'Patrol', dist: '34km',
      details: 'Fast-moving patrol craft exceeding 30kn in exclusion zone. Hailing on Channel 16 initiated by maritime authority.'
    },
    {
      id: 'V006',
      name: 'MV ATLAS FORTUNE',
      class: 'MERCHANT',
      flag: 'LR',
      symbol: 'o',
      threat: 'low',
      threatLabel: 'LOW',
      lat: 40.10, lon: 24.80,
      hdg: '68°', speed: 11, depth: '0m',
      lastSeen: '00:02Z', aiConfidence: 98, mmsi: '636012811',
      type: 'Merchant', dist: '11km',
      details: 'Commercial container vessel operating on planned transit corridor. AIS active and verified.'
    },
    {
      id: 'V003',
      name: 'TCG KEMALREIS',
      class: 'FRIGATE',
      flag: 'TR',
      symbol: '△',
      threat: 'neutral',
      threatLabel: 'NEUTRAL',
      lat: 39.40, lon: 26.50,
      hdg: '90°', speed: 12, depth: '0m',
      lastSeen: '00:05Z', aiConfidence: 99, mmsi: '271001234',
      type: 'Frigate', dist: '12km',
      details: 'Allied frigate conducting routine security patrol along regional entrance. Comms nominal.'
    },
    {
      id: 'V004',
      name: 'FS PROVENCE',
      class: 'FRIGATE',
      flag: 'FR',
      symbol: '△',
      threat: 'neutral',
      threatLabel: 'NEUTRAL',
      lat: 37.60, lon: 23.40,
      hdg: '118°', speed: 14, depth: '0m',
      lastSeen: '00:11Z', aiConfidence: 99, mmsi: '228012348',
      type: 'Frigate', dist: '14km',
      details: 'Multipurpose frigate executing joint escort exercises. Tactical datalink active.'
    },
    {
      id: 'V007',
      name: 'USS ROSS',
      class: 'DESTROYER',
      flag: 'US',
      symbol: '◇',
      threat: 'neutral',
      threatLabel: 'NEUTRAL',
      lat: 38.90, lon: 20.50,
      hdg: '85°', speed: 20, depth: '0m',
      lastSeen: '00:20Z', aiConfidence: 100, mmsi: '338233614',
      type: 'Destroyer', dist: '26km',
      details: 'Arleigh Burke-class destroyer providing air-defense umbrella and maritime security link.'
    }
  ];

  // Threat Intel Data (Matching Screenshot #3)
  const THREAT_INTEL_ITEMS = [
    {
      id: 'TI-001', domain: 'MARITIME', severity: 'CRITICAL', conf: 87, time: '01:08Z',
      title: 'SSK-417 Submerged Contact',
      desc: 'Diesel-electric submarine operating in stealth mode. Suspected Project 636.3 Varshavyanka class. Pattern of behavior consistent with pre-positioning for anti-shipping operations.',
      source: 'SOURCE: SONAR ARRAY - SIGINT - AI CORRELATION'
    },
    {
      id: 'TI-002', domain: 'ELECTRONIC', severity: 'HIGH', conf: 94, time: '00:44Z',
      title: 'Mineral-ME Radar Emissions',
      desc: 'Active targeting radar consistent with Kh-35 anti-ship missile system detected from KNYAZ VOLKONSKY. Range: 138nm. Elevation angle suggests surface-search mode.',
      source: 'SOURCE: ELINT - COMINT'
    },
    {
      id: 'TI-003', domain: 'CYBER', severity: 'HIGH', conf: 79, time: '00:31Z',
      title: 'AIS Spoofing - Sector 3-Charlie',
      desc: 'Three AIS signals identified as spoofed. False positions broadcast from shore-based transmitters. Actual vessel positions remain unconfirmed.',
      source: 'SOURCE: AIS ANALYSIS - AI ANOMALY DETECTION'
    },
    {
      id: 'TI-004', domain: 'HUMAN', severity: 'MEDIUM', conf: 62, time: '23:15Z',
      title: 'Port Intelligence - Latakia',
      desc: 'HUMINT asset reports unusual loading activity at Latakia naval base. Three fast-attack craft departed without filing departure manifests. ETA exclusion zone: 06:00Z.',
      source: 'SOURCE: HUMINT ASSET NETWORK'
    },
    {
      id: 'TI-005', domain: 'ACOUSTIC', severity: 'LOW', conf: 45, time: '00:09Z',
      title: 'Anomalous Acoustic Signature',
      desc: 'Broadband noise detected in Grid 4-Foxtrot. Frequency profile does not match known merchant traffic. Possible biological source or distant submarine transient.',
      source: 'SOURCE: SOSUS ARRAY - PASSIVE SONAR'
    }
  ];

  // Encrypted Message Transmissions (Matching Screenshot #5)
  const COMMS_MESSAGES = [
    { time: '01:04Z', sender: 'ALPHA ACTUAL', recipient: 'AEGIS CMD', text: 'Request SITREP on V002 contact. Over.' },
    { time: '01:05Z', sender: 'AEGIS CMD', recipient: 'ALPHA ACTUAL', text: 'V002 last fix: 36.8N 29.1E, depth 142m, heading 190, speed 7kn. Contact lost 01:08Z. ASW protocols initiated. Out.' },
    { time: '00:58Z', sender: 'MARCOM', recipient: 'ALL STATIONS', text: 'Additional ASW asset - MPA sortie authorized. ETA theatre 04:30Z.' },
    { time: '00:43Z', sender: 'AEGIS CMD', recipient: 'FS PROVENCE', text: 'Warning: unidentified contact bearing 130 from your position, 42nm, speed 22kn, intercept vector. Exercise caution.' },
    { time: '00:29Z', sender: 'AEGIS CMD', recipient: 'PGM-412', text: 'UNKNOWN VESSEL: You are operating in an exclusion zone. Heave to and identify yourself. Channel 16.' },
    { time: '00:02Z', sender: 'MV ATLAS FORTUNE', recipient: 'ALL SHIPS', text: 'SECURITE SECURITE SECURITE - heavy weather advisory, Sector 2-Bravo, sea state 5.' }
  ];

  // DOM Elements Cache
  const dom = {
    loginOverlay: document.getElementById('login-overlay'),
    loginForm: document.getElementById('login-form'),
    loginUsername: document.getElementById('login-username'),
    loginPassword: document.getElementById('login-password'),
    loginError: document.getElementById('login-error-banner'),
    btnLoginUnlock: document.getElementById('btn-login-unlock'),
    presetBtns: document.querySelectorAll('.preset-btn'),
    loginLiveTime: document.getElementById('login-live-time'),
    
    appContainer: document.getElementById('app-container'),
    btnLogout: document.getElementById('btn-logout'),
    activeRoleBadge: document.getElementById('active-role-badge'),
    
    utcClockTime: document.getElementById('utc-clock-time'),
    utcClockDate: document.getElementById('utc-clock-date'),
    
    navTabs: document.querySelectorAll('.nav-tab-btn'),
    tabViews: document.querySelectorAll('.tab-view-content'),
    
    rightTabs: document.querySelectorAll('.analysis-tab-btn'),
    aiAnalysisViewport: document.getElementById('ai-tactical-analysis-content'),
    routeComparisonViewport: document.getElementById('route-comparison-content'),
    waypointsViewport: document.getElementById('route-waypoints-content'),
    waypointsTableBody: document.getElementById('waypoints-table-body'),
    
    contactsContainer: document.getElementById('contacts-list-container'),
    contactSearchInput: document.getElementById('contact-search-input'),
    
    selectOrigin: document.getElementById('select-origin'),
    selectDest: document.getElementById('select-destination'),
    selectAlgorithm: document.getElementById('select-algorithm'),
    btnRunAco: document.getElementById('btn-run-aco'),
    acoSpinner: document.getElementById('aco-spinner'),
    acoBtnText: document.getElementById('aco-btn-text'),
    
    btnApprove: document.getElementById('btn-approve-route'),
    btnReject: document.getElementById('btn-reject-route'),
    btnStep: document.getElementById('btn-step-voyage'),
    btnPlay: document.getElementById('btn-play-voyage'),
    btnDeviate: document.getElementById('btn-report-deviation'),
    btnReset: document.getElementById('btn-reset-voyage'),
    
    sidebarCoords: document.getElementById('sidebar-coords'),
    sidebarSpeed: document.getElementById('sidebar-speed'),
    sidebarHeading: document.getElementById('sidebar-heading'),
    sidebarStatusBadge: document.getElementById('sidebar-status-badge'),
    sidebarProgressPct: document.getElementById('sidebar-progress-pct'),
    sidebarProgressBar: document.getElementById('transit-progress-bar'),
    toggleAco: document.getElementById('toggle-aco-layer'),
    toggleAstar: document.getElementById('toggle-astar-layer'),
    toggleDijkstra: document.getElementById('toggle-dijkstra-layer'),
    togglePiracy: document.getElementById('toggle-piracy-layer'),
    toggleRestricted: document.getElementById('toggle-restricted-layer'),
    cursorCoords: document.getElementById('cursor-coords'),
    
    contactsDrawer: document.getElementById('contacts-drawer'),
    analysisDrawer: document.getElementById('analysis-drawer'),
    layersPopover: document.getElementById('layers-popover'),
    btnToggleContacts: document.getElementById('btn-toggle-contacts'),
    btnToggleAnalysis: document.getElementById('btn-toggle-analysis'),
    btnToggleLayers: document.getElementById('btn-toggle-layers'),

    threatCardsList: document.getElementById('threat-intel-cards-list'),
    threatFilterBtns: document.querySelectorAll('.intel-filter-buttons .filter-btn'),
    
    vesselTableBody: document.getElementById('vessel-log-table-body'),
    sortBtnId: document.getElementById('sort-btn-id'),
    sortBtnThreat: document.getElementById('sort-btn-threat'),
    sortBtnSpeed: document.getElementById('sort-btn-speed'),
    
    threatCardsList: document.getElementById('threat-intel-cards-list'),
    threatFilterBtns: document.querySelectorAll('.intel-filter-buttons .filter-btn'),
    
    vesselTableBody: document.getElementById('vessel-log-table-body'),
    sortBtnId: document.getElementById('sort-btn-id'),
    sortBtnThreat: document.getElementById('sort-btn-threat'),
    sortBtnSpeed: document.getElementById('sort-btn-speed'),
    
    encryptedMessageLog: document.getElementById('encrypted-message-log'),
    
    aiCommandInput: document.getElementById('ai-command-input'),
    btnSendAiCommand: document.getElementById('btn-send-ai-command'),
    aiChatStream: document.getElementById('ai-command-chat-stream'),

    // Role Switcher
    btnRoleCommander: document.getElementById('btn-role-commander'),
    btnRoleCrew: document.getElementById('btn-role-crew'),

    // Vessel Position Cockpit (Crew)
    crewVesselSelect: document.getElementById('crew-vessel-select'),
    crewCoordDisplay: document.getElementById('crew-coord-display'),
    crewCoordDecimal: document.getElementById('crew-coord-decimal'),
    crewSpeedDisplay: document.getElementById('crew-speed-display'),
    crewSpeedBar: document.getElementById('crew-speed-bar'),
    crewHeadingDisplay: document.getElementById('crew-heading-display'),
    crewCompassBearing: document.getElementById('crew-compass-bearing'),
    crewVesselStatus: document.getElementById('crew-vessel-status'),
    crewVesselCallsign: document.getElementById('crew-vessel-callsign'),
    crewVesselRoute: document.getElementById('crew-vessel-route'),
    crewVesselMmsi: document.getElementById('crew-vessel-mmsi'),
    crewVesselDepth: document.getElementById('crew-vessel-depth'),
    crewInputSpeed: document.getElementById('crew-input-speed'),
    crewSpeedValLabel: document.getElementById('crew-speed-val-label'),
    crewInputHeading: document.getElementById('crew-input-heading'),
    crewHeadingValLabel: document.getElementById('crew-heading-val-label'),
    btnCrewApplyHelm: document.getElementById('btn-crew-apply-helm'),
    btnCrewSimStep: document.getElementById('btn-crew-sim-step'),
    btnCrewSimAuto: document.getElementById('btn-crew-sim-auto'),
    btnCrewReportDeviation: document.getElementById('btn-crew-report-deviation'),
    crewFleetTableBody: document.getElementById('crew-fleet-table-body'),
    crewPillBtns: document.querySelectorAll('.crew-pill-btn'),

    crewCompassNeedle: document.getElementById('crew-compass-needle'),
    crewCompassBearing: document.getElementById('crew-compass-bearing'),

    // AI Syllabus Unit 6: Maritime Expert System
    expertVesselSelect: document.getElementById('expert-vessel-select'),
    btnEvalExpert: document.getElementById('btn-eval-expert'),
    expertWmTableBody: document.getElementById('expert-wm-table-body'),
    sbDepth: document.getElementById('sb-depth'),
    sbDepthVal: document.getElementById('sb-depth-val'),
    sbSpeed: document.getElementById('sb-speed'),
    sbSpeedVal: document.getElementById('sb-speed-val'),
    sbWeather: document.getElementById('sb-weather'),
    sbWeatherVal: document.getElementById('sb-weather-val'),
    sbDeviation: document.getElementById('sb-deviation'),
    sbChokepoint: document.getElementById('sb-chokepoint'),
    btnEvalSandbox: document.getElementById('btn-eval-sandbox'),
    expertVerdictCard: document.getElementById('expert-verdict-card'),
    expertVerdictBadge: document.getElementById('expert-verdict-badge'),
    expertVerdictRuleId: document.getElementById('expert-verdict-rule-id'),
    expertVerdictColreg: document.getElementById('expert-verdict-colreg'),
    expertVerdictHeadline: document.getElementById('expert-verdict-headline'),
    expertVerdictMessage: document.getElementById('expert-verdict-message'),
    expertSpecAction: document.getElementById('expert-spec-action'),
    expertSpecSpeed: document.getElementById('expert-spec-speed'),
    expertSpecTrim: document.getElementById('expert-spec-trim'),
    explTabBtns: document.querySelectorAll('.expl-tab-btn'),
    explPaneWhy: document.getElementById('expl-pane-why'),
    explPaneHow: document.getElementById('expl-pane-how'),
    explPaneKb: document.getElementById('expl-pane-kb'),
    whyPremisesList: document.getElementById('why-premises-list'),
    whyRationaleText: document.getElementById('why-rationale-text'),
    whyStandardText: document.getElementById('why-standard-text'),
    howDerivationList: document.getElementById('how-derivation-list'),
    kbRulesAccordion: document.getElementById('kb-rules-accordion'),
    cockpitExpertBadge: document.getElementById('cockpit-expert-badge'),
    cockpitExpertHeadline: document.getElementById('cockpit-expert-headline'),
    cockpitExpertAction: document.getElementById('cockpit-expert-action'),
    btnCockpitRunExpert: document.getElementById('btn-cockpit-run-expert'),
    btnCockpitExplainExpert: document.getElementById('btn-cockpit-explain-expert'),

    // AI Syllabus Unit 2: Genetic Algorithm
    btnRunGA: document.getElementById('btn-run-ga'),
    btnPlotGAMap: document.getElementById('btn-plot-ga-map'),
    gaPortChipsContainer: document.getElementById('ga-port-chips-container'),
    gaSelectedCount: document.getElementById('ga-selected-count'),
    btnGaAll: document.getElementById('btn-ga-all'),
    btnGaCore: document.getElementById('btn-ga-core'),
    btnGaPorts: document.getElementById('btn-ga-ports'),
    btnGaClear: document.getElementById('btn-ga-clear'),
    gaPopSize: document.getElementById('ga-pop-size'),
    gaPopVal: document.getElementById('ga-pop-val'),
    gaGenerations: document.getElementById('ga-generations'),
    gaGenVal: document.getElementById('ga-gen-val'),
    gaCrossover: document.getElementById('ga-crossover'),
    gaCxVal: document.getElementById('ga-cx-val'),
    gaMutation: document.getElementById('ga-mutation'),
    gaMutVal: document.getElementById('ga-mut-val'),
    gaKpiDistance: document.getElementById('ga-kpi-distance'),
    gaKpiFitness: document.getElementById('ga-kpi-fitness'),
    gaKpiGens: document.getElementById('ga-kpi-gens'),
    gaKpiStations: document.getElementById('ga-kpi-stations'),
    gaEvolutionSvg: document.getElementById('ga-evolution-svg'),
    gaTourSequenceList: document.getElementById('ga-tour-sequence-list'),
    gaSumStart: document.getElementById('ga-sum-start'),
    gaSumBest: document.getElementById('ga-sum-best'),
    gaSumPct: document.getElementById('ga-sum-pct')
  };

  // -------------------------------------------------------------
  // 1. CLOCK & NAVIGATION TAB HANDLERS
  // -------------------------------------------------------------
  function startClock() {
    const timeFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });
    const dateFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    function updateClock() {
      const now = new Date();
      const timeStr = `${timeFmt.format(now)} IST`;
      const dateStr = `${dateFmt.format(now)} IST`;
      if (dom.utcClockTime) dom.utcClockTime.textContent = timeStr;
      if (dom.utcClockDate) dom.utcClockDate.textContent = dateStr;
      if (dom.loginLiveTime) dom.loginLiveTime.textContent = `${dateFmt.format(now)} ${timeFmt.format(now)} IST`;
    }
    updateClock();
    setInterval(updateClock, 1000);
  }

  function roleKey(role) {
    const value = (role || '').toLowerCase();
    if (value.includes('admin')) return 'admin';
    if (value.includes('crew')) return 'crew';
    return 'commander';
  }

  function roleLabel(key) {
    if (key === 'admin') return 'SYSTEM ADMIN';
    if (key === 'crew') return 'VESSEL CREW';
    return 'FLEET COMMANDER';
  }

  function switchMainTab(targetTab) {
    state.activeTab = targetTab;

    dom.navTabs.forEach(b => {
      b.classList.toggle('active', b.dataset.tab === targetTab);
    });

    dom.tabViews.forEach(view => {
      view.classList.toggle('active', view.id === `view-${targetTab}`);
    });

    if (dom.appContainer) {
      dom.appContainer.classList.toggle('commander-home', targetTab === 'tactical');
    }

    if (targetTab === 'tactical') {
      setTimeout(() => {
        if (state.map) {
          state.map.invalidateSize();
          fitMalaccaView();
        }
      }, 100);
    } else if (targetTab === 'vessel-position') {
      if (!state.crewMap) initCrewVesselMap();
      setTimeout(() => {
        if (state.crewMap) {
          state.crewMap.invalidateSize();
          fitCrewMalaccaView();
          renderCrewVesselMarkers();
        }
      }, 100);
    } else if (targetTab === 'expert-system') {
      if (state.kbRules.length === 0) fetchKBRules();
      evaluateExpertSystem(state.selectedVesselId);
    } else if (targetTab === 'genetic-algorithm') {
      if (state.gaWaypoints.length === 0) {
        loadGAWaypoints();
      } else if (!state.gaResult) {
        runGeneticAlgorithm();
      }
    } else if (targetTab === 'commander-threat') {
      loadCommanderThreatIntel();
    } else if (targetTab === 'crew-threat') {
      loadCrewThreatIntel();
    } else if (targetTab === 'sys-admin') {
      loadAlgoPerformance();
    }
  }

  function applyRoleChrome(role) {
    const key = roleKey(role);
    state.roleKey = key;
    const nameEl = document.getElementById('current-user-name');
    const roleEl = document.getElementById('current-user-role');
    if (nameEl) nameEl.textContent = (state.currentUser || 'OPERATOR').toUpperCase();
    if (roleEl) roleEl.textContent = roleLabel(key);

    dom.navTabs.forEach(btn => {
      const allowed = (btn.dataset.roles || '').split(',').filter(Boolean);
      btn.classList.toggle('role-hidden', allowed.length > 0 && !allowed.includes(key));
    });

    const landing = key === 'admin' ? 'sys-admin' : key === 'crew' ? 'vessel-position' : 'tactical';
    switchMainTab(landing);
    if (key === 'commander') startExpertThreatWatch();
    else stopExpertThreatWatch();
  }

  function initTabNavigation() {
    dom.navTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        switchMainTab(btn.dataset.tab);
      });
    });

    initMapOverlays();
    initRoleSwitcher();
    initCrewCockpitControls();
    initExpertSystemEvents();
    initGAEvents();


    // Right Panel Sub-Tabs in Tactical View
    dom.rightTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.rightTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        dom.aiAnalysisViewport.classList.add('hidden');
        dom.routeComparisonViewport.classList.add('hidden');
        dom.waypointsViewport.classList.add('hidden');

        if (btn.id === 'right-tab-btn-ai') dom.aiAnalysisViewport.classList.remove('hidden');
        if (btn.id === 'right-tab-btn-routes') dom.routeComparisonViewport.classList.remove('hidden');
        if (btn.id === 'right-tab-btn-coords') dom.waypointsViewport.classList.remove('hidden');
      });
    });
  }

  // -------------------------------------------------------------
  // 1b. FLOATING MAP OVERLAYS & SLIDE-IN DRAWERS
  // -------------------------------------------------------------
  function setDrawer(drawer, button, open) {
    if (!drawer) return;
    drawer.classList.toggle('open', open);
    if (button) button.classList.toggle('active', open);
  }

  function toggleDrawer(drawer, button) {
    setDrawer(drawer, button, !drawer.classList.contains('open'));
  }

  function openAnalysisDrawer() {
    setDrawer(dom.analysisDrawer, dom.btnToggleAnalysis, true);
  }

  function initMapOverlays() {
    if (dom.btnToggleContacts) {
      dom.btnToggleContacts.addEventListener('click', () => {
        toggleDrawer(dom.contactsDrawer, dom.btnToggleContacts);
      });
    }
    if (dom.btnToggleAnalysis) {
      dom.btnToggleAnalysis.addEventListener('click', () => {
        toggleDrawer(dom.analysisDrawer, dom.btnToggleAnalysis);
      });
    }
    if (dom.btnToggleLayers) {
      dom.btnToggleLayers.addEventListener('click', () => {
        const hidden = dom.layersPopover.classList.toggle('hidden');
        dom.btnToggleLayers.classList.toggle('active', !hidden);
      });
    }

    document.querySelectorAll('.drawer-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const drawer = document.getElementById(btn.dataset.close);
        const toggle = drawer === dom.contactsDrawer ? dom.btnToggleContacts : dom.btnToggleAnalysis;
        setDrawer(drawer, toggle, false);
      });
    });
  }

  // -------------------------------------------------------------
  // 2. AUTHENTICATION HANDLERS
  // -------------------------------------------------------------
  function initAuth() {
    dom.presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        dom.loginUsername.value = btn.dataset.user;
        dom.loginPassword.value = btn.dataset.pwd;
      });
    });

    dom.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = dom.loginUsername.value.trim();
      const password = dom.loginPassword.value;
      dom.loginError.classList.add('hidden');

      try {
        const resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await resp.json();

        if (data.success) {
          state.isAuthenticated = true;
          state.currentUser = data.username;
          state.currentRole = data.role;

          dom.loginOverlay.classList.add('hidden');
          dom.appContainer.classList.remove('hidden');
          if (dom.activeRoleBadge) dom.activeRoleBadge.textContent = (state.currentRole || '').toUpperCase();

          requestAnimationFrame(async () => {
            const key = roleKey(state.currentRole);
            if (key === 'commander') {
              if (!state.map) {
                initMap();
                loadPorts();
                loadThreats();
                renderThreatIntelCards();
                renderCommsMessages();
                fetchStatus();
              } else {
                state.map.invalidateSize();
              }
            }

            await fetchFleetVessels();
            if (state.fleetPollInterval) clearInterval(state.fleetPollInterval);
            state.fleetPollInterval = setInterval(fetchFleetVessels, 3500);

            applyRoleChrome(state.currentRole);
          });
        } else {
          dom.loginError.textContent = data.error || 'Authentication failed.';
          dom.loginError.classList.remove('hidden');
        }
      } catch (err) {
        dom.loginError.textContent = 'Server connection error.';
        dom.loginError.classList.remove('hidden');
      }
    });

    if (dom.btnLoginUnlock) {
      dom.btnLoginUnlock.addEventListener('click', async () => {
        const username = dom.loginUsername.value.trim() || 'commander';
        try {
          const resp = await fetch('/api/auth/unlock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
          });
          const data = await resp.json();
          alert(data.message || 'Account unlocked.');
          dom.loginError.classList.add('hidden');
        } catch (err) {
          alert('Failed to unlock account.');
        }
      });
    }

    if (dom.btnLogout) {
      dom.btnLogout.addEventListener('click', async () => {
        if (state.isAutoTransiting) stopAutoTransit();
        if (state.isAutoSimulating) {
          state.isAutoSimulating = false;
          if (dom.btnCrewSimAuto) {
            dom.btnCrewSimAuto.textContent = '⏯ AUTO-TICKER';
            dom.btnCrewSimAuto.classList.remove('danger-cyber-btn');
          }
          if (state.simInterval) clearInterval(state.simInterval);
        }
        if (state.fleetPollInterval) clearInterval(state.fleetPollInterval);
        stopExpertThreatWatch();
        await fetch('/api/auth/logout', { method: 'POST' });
        state.isAuthenticated = false;
        dom.appContainer.classList.add('hidden');
        dom.loginOverlay.classList.remove('hidden');
      });
    }
  }

  // -------------------------------------------------------------
  // 3. TRACKED CONTACTS & AI ANALYSIS VIEW
  // -------------------------------------------------------------
  function renderContactsList(filterText = '') {
    if (!dom.contactsContainer) return;
    dom.contactsContainer.innerHTML = '';

    const query = filterText.toLowerCase().trim();
    const filtered = TRACKED_CONTACTS.filter(c => 
      c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query) || c.class.toLowerCase().includes(query)
    );

    filtered.forEach(c => {
      const card = document.createElement('div');
      card.className = `contact-item-card ${c.threat} ${state.selectedContactId === c.id ? 'active' : ''}`;
      card.innerHTML = `
        <div class="card-top-row">
          <span class="contact-name-title">${c.id} • ${c.name}</span>
          <span class="threat-badge ${c.threat}">${c.threatLabel}</span>
        </div>
        <div class="card-mid-row">
          <span>${c.class} - ${c.flag}</span>
          <span>${c.speed}kn ${c.depth !== '0m' ? c.depth : ''}</span>
        </div>
        <div class="card-bot-row">
          <span>● LAST ${c.lastSeen}</span>
          <div class="ai-bar-group">
            <span class="ai-bar-label">AI</span>
            <div class="ai-bar-bg">
              <div class="ai-bar-fill" style="width: ${c.aiConfidence}%"></div>
            </div>
            <span style="font-size:8px;">${c.aiConfidence}%</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        state.selectedContactId = c.id;
        renderContactsList(filterText);
        selectContactForAnalysis(c);
      });

      dom.contactsContainer.appendChild(card);
    });

    renderContactMarkersOnMap();
  }

  if (dom.contactSearchInput) {
    dom.contactSearchInput.addEventListener('input', (e) => {
      renderContactsList(e.target.value);
    });
  }

  function selectContactForAnalysis(c) {
    if (!dom.aiAnalysisViewport) return;

    dom.aiAnalysisViewport.innerHTML = `
      <div class="target-intel-card">
        <div class="intel-title">
          <span class="text-cyan">${c.name}</span>
          <span class="threat-badge ${c.threat}">${c.threatLabel}</span>
        </div>
        <div class="intel-sub-id">${c.id} • ${c.class} • ${c.flag}</div>
        <div class="intel-grid mt-2">
          <div>LAT: <strong>${c.lat.toFixed(2)}°N</strong></div>
          <div>LNG: <strong>${c.lon.toFixed(2)}°E</strong></div>
          <div>HDG: <strong>${c.hdg}</strong></div>
          <div>SPD: <strong>${c.speed}kn</strong></div>
          <div>AI %: <strong class="text-cyan">${c.aiConfidence}%</strong></div>
          <div>LAST: <strong>${c.lastSeen}</strong></div>
        </div>
        <div class="intel-assessment-box mt-2">
          <div class="box-lbl">// ASSESSMENT</div>
          <ul class="assessment-list mt-1">
            <li>${c.details}</li>
            <li>POSITION: ${c.lat.toFixed(2)}°N, ${c.lon.toFixed(2)}°E (MMSI: ${c.mmsi})</li>
          </ul>
        </div>
      </div>
    `;

    if (state.map) {
      state.map.panTo([c.lat, c.lon]);
    }
  }

  function renderContactMarkersOnMap() {
    if (!state.layers.contacts) return;
    state.layers.contacts.clearLayers();

    TRACKED_CONTACTS.forEach(c => {
      let color = '#00b8d4';
      if (c.threat === 'critical') color = '#ff1e43';
      if (c.threat === 'high') color = '#ff8c00';
      if (c.threat === 'medium') color = '#ffd000';
      if (c.threat === 'low') color = '#00ff88';

      const icon = L.divIcon({
        className: 'tactical-contact-marker',
        html: `
          <div style="color:${color}; font-size:12px; font-weight:bold; text-shadow:0 0 6px ${color}; text-align:center;">
            ${c.symbol}<br><span style="font-size:8px; background:rgba(0,0,0,0.8); padding:1px 3px; border-radius:2px; border:1px solid ${color};">${c.id}</span>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const marker = L.marker([c.lat, c.lon], { icon }).bindPopup(`
        <div style="font-family:var(--font-mono); font-size:11px;">
          <strong style="color:${color}">${c.id} - ${c.name}</strong><br>
          Class: ${c.class}<br>
          Threat: ${c.threatLabel}<br>
          Pos: ${c.lat.toFixed(2)}°N, ${c.lon.toFixed(2)}°E
        </div>
      `);

      marker.on('click', () => {
        state.selectedContactId = c.id;
        renderContactsList();
        selectContactForAnalysis(c);
      });

      state.layers.contacts.addLayer(marker);
    });
  }

  // -------------------------------------------------------------
  // 4. LEAFLET MAP ENGINE
  // -------------------------------------------------------------
  const MALACCA_BOUNDS = L.latLngBounds([0.8, 94.6], [6.2, 104.5]);

  function fitMalaccaView() {
    if (!state.map) return;
    state.map.invalidateSize();
    state.map.fitBounds(MALACCA_BOUNDS, { padding: [20, 20], maxZoom: 7 });
  }

  function initMap() {
    state.map = L.map('maritime-map', {
      center: [3.2, 100.8],
      zoom: 6,
      minZoom: 5,
      maxZoom: 11,
      zoomControl: false,
      worldCopyJump: false,
      maxBounds: MALACCA_BOUNDS.pad(0.2),
      maxBoundsViscosity: 0.85
    });

    L.control.zoom({ position: 'topright' }).addTo(state.map);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri — GEBCO, NOAA, Ocean Basemap',
      maxZoom: 13
    }).addTo(state.map);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 13,
      pane: 'shadowPane'
    }).addTo(state.map);

    state.layers.piracy = L.layerGroup().addTo(state.map);
    state.layers.restricted = L.layerGroup().addTo(state.map);
    state.layers.candidates = L.layerGroup().addTo(state.map);
    state.layers.primaryRoute = L.layerGroup().addTo(state.map);
    state.layers.alternateRoute = L.layerGroup().addTo(state.map);
    state.layers.astarRoute = L.layerGroup().addTo(state.map);
    state.layers.dijkstraRoute = L.layerGroup().addTo(state.map);
    state.layers.contacts = L.layerGroup().addTo(state.map);
    state.layers.ports = L.layerGroup().addTo(state.map);
    state.layers.vessel = L.layerGroup().addTo(state.map);
    state.layers.homeTrack = L.layerGroup().addTo(state.map);

    window.addEventListener('resize', () => {
      if (state.map) {
        state.map.invalidateSize();
        if (state.activeTab === 'tactical') fitMalaccaView();
      }
    });

    fitMalaccaView();

    state.map.on('mousemove', (e) => {
      const lat = e.latlng.lat.toFixed(3);
      const lon = e.latlng.lng.toFixed(3);
      const ns = lat >= 0 ? 'N' : 'S';
      const ew = lon >= 0 ? 'E' : 'W';
      if (dom.cursorCoords) {
        dom.cursorCoords.textContent = `CURSOR: ${Math.abs(lat)}° ${ns}, ${Math.abs(lon)}° ${ew}`;
      }
    });

    if (dom.toggleAco) {
      dom.toggleAco.addEventListener('change', (e) => {
        if (e.target.checked) state.map.addLayer(state.layers.primaryRoute);
        else state.map.removeLayer(state.layers.primaryRoute);
      });
    }
    if (dom.toggleAstar) {
      dom.toggleAstar.addEventListener('change', (e) => {
        if (e.target.checked) state.map.addLayer(state.layers.astarRoute);
        else state.map.removeLayer(state.layers.astarRoute);
      });
    }
    if (dom.toggleDijkstra) {
      dom.toggleDijkstra.addEventListener('change', (e) => {
        if (e.target.checked) state.map.addLayer(state.layers.dijkstraRoute);
        else state.map.removeLayer(state.layers.dijkstraRoute);
      });
    }
    if (dom.togglePiracy) {
      dom.togglePiracy.addEventListener('change', (e) => {
        if (e.target.checked) state.map.addLayer(state.layers.piracy);
        else state.map.removeLayer(state.layers.piracy);
      });
    }
    if (dom.toggleRestricted) {
      dom.toggleRestricted.addEventListener('change', (e) => {
        if (e.target.checked) state.map.addLayer(state.layers.restricted);
        else state.map.removeLayer(state.layers.restricted);
      });
    }
  }

  function addMapLabel(latlng, html, className, iconSize, iconAnchor) {
    return L.marker(latlng, {
      icon: L.divIcon({
        className,
        html,
        iconSize,
        iconAnchor
      }),
      interactive: false,
      keyboard: false
    });
  }

  function formatCoord(lat, lon) {
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(2)}° ${ns} · ${Math.abs(lon).toFixed(2)}° ${ew}`;
  }

  function renderPlannedCorridor() {
    if (!state.layers.homeTrack) return;
    state.layers.homeTrack.clearLayers();

    addMapLabel([4.35, 98.15], '<div class="ocean-label">ANDAMAN SEA</div>', 'home-label-wrap', [140, 16], [70, 8])
      .addTo(state.layers.homeTrack);
    addMapLabel([2.55, 101.15], '<div class="ocean-label">STRAIT OF MALACCA</div>', 'home-label-wrap', [180, 16], [90, 8])
      .addTo(state.layers.homeTrack);
    addMapLabel([2.35, 104.15], '<div class="ocean-label">SOUTH CHINA SEA</div>', 'home-label-wrap', [160, 16], [80, 8])
      .addTo(state.layers.homeTrack);

    const origin = state.portsData.find(p => p.name === state.originPort);
    const dest = state.portsData.find(p => p.name === state.destPort);
    if (!origin || !dest) return;

    L.polyline([[origin.lat, origin.lon], [dest.lat, dest.lon]], {
      color: '#38bdf8',
      weight: 1.6,
      opacity: 0.8,
      dashArray: '5 8',
      lineCap: 'round',
      interactive: false
    }).addTo(state.layers.homeTrack);
  }

  async function loadPorts() {
    try {
      const resp = await fetch('/api/ports');
      const data = await resp.json();
      state.portsData = data.ports || [];
      renderPorts();
      renderPlannedCorridor();
    } catch (err) {
      console.error('Ports error:', err);
    }
  }

    function renderPorts() {
    if (!state.layers.ports) return;
    state.layers.ports.clearLayers();
    state.portsData.forEach(p => {
      const isOrigin = p.name === state.originPort;
      const isDest = p.name === state.destPort;
      const isSelected = isOrigin || isDest;
      const shortName = p.name.split('(')[0].trim().toUpperCase();
      const classes = ['port-marker'];
      if (isOrigin) classes.push('origin', 'selected');
      if (isDest) classes.push('dest', 'selected');

      const originCard = `
        <div class="origin-pin">
          <div class="origin-pulse"></div>
          <div class="origin-core"></div>
          <div class="origin-card">
            <div class="origin-card-kicker">CURRENT LOCATION</div>
            <div class="origin-card-title">${shortName}</div>
            <div class="origin-card-meta">${p.name} — Vessel at berth</div>
            <div class="origin-card-coords">${formatCoord(p.lat, p.lon)} · 0.00 kn</div>
          </div>
        </div>
      `;
      const destCard = `
        <div class="dest-pin">
          <div class="dest-core"></div>
          <div class="dest-label">
            <div class="dest-name">${shortName}</div>
            <div class="dest-sub">${p.name}</div>
            <div class="dest-tag">DESTINATION</div>
          </div>
        </div>
      `;
      const defaultPin = `
        <div class="${classes.join(' ')}">
          <div class="port-marker-pulse"></div>
          <div class="port-marker-core"></div>
        </div>
      `;

      const icon = L.divIcon({
        className: isOrigin ? 'home-origin-wrap' : (isDest ? 'home-dest-wrap' : 'custom-port-marker'),
        html: isOrigin ? originCard : (isDest ? destCard : defaultPin),
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([p.lat, p.lon], {
        icon,
        zIndexOffset: isSelected ? 1200 : 200
      }).bindPopup(`<strong>${p.name}</strong><br>${isOrigin ? 'SELECTED ORIGIN' : isDest ? 'SELECTED DESTINATION' : 'Port'}`);
      state.layers.ports.addLayer(marker);
    });
  }

  function onPortSelectionChange() {
    if (!dom.selectOrigin || !dom.selectDest) return;
    state.originPort = dom.selectOrigin.value;
    state.destPort = dom.selectDest.value;
    renderPorts();
    renderPlannedCorridor();

    if (!state.map || !state.portsData.length) return;
    const origin = state.portsData.find(p => p.name === state.originPort);
    const dest = state.portsData.find(p => p.name === state.destPort);
    const selected = [origin, dest].filter(Boolean);
    if (selected.length === 2) {
      state.map.fitBounds(
        [[origin.lat, origin.lon], [dest.lat, dest.lon]],
        { padding: [48, 48], maxZoom: 8 }
      );
    } else if (selected.length === 1) {
      state.map.panTo([selected[0].lat, selected[0].lon]);
    }
  }

  async function loadThreats() {
    try {
      const resp = await fetch('/api/threats');
      const data = await resp.json();
      state.incidentsData = data.incidents || [];
      state.zonesData = data.restricted_zones || [];
      renderPiracyIncidents();
      renderRestrictedZones();
    } catch (err) {
      console.error('Threats error:', err);
    }
  }

  function renderPiracyIncidents() {
    state.layers.piracy.clearLayers();
    state.incidentsData.forEach(inc => {
      const circle = L.circleMarker([inc.latitude, inc.longitude], {
        radius: 3, color: '#ff1e43', fillColor: '#ff1e43', fillOpacity: 0.7, stroke: false
      });
      state.layers.piracy.addLayer(circle);
    });
  }

  function renderRestrictedZones() {
    state.layers.restricted.clearLayers();
    state.zonesData.forEach(z => {
      const circle = L.circle(z.center, {
        radius: z.radius_deg * 111000, color: '#a855f7', dashArray: '4, 4', fillColor: '#a855f7', fillOpacity: 0.12, weight: 1
      });
      state.layers.restricted.addLayer(circle);
    });
  }

  // -------------------------------------------------------------
  // 5. ROUTE OPTIMIZATION ENGINE & WAYPOINT INSPECTOR
  // -------------------------------------------------------------
  if (dom.selectOrigin) {
    dom.selectOrigin.addEventListener('change', onPortSelectionChange);
  }
  if (dom.selectDest) {
    dom.selectDest.addEventListener('change', onPortSelectionChange);
  }

  if (dom.selectAlgorithm) {
    dom.selectAlgorithm.addEventListener('change', () => {
      state.algorithm = dom.selectAlgorithm.value;
      if (dom.acoBtnText) dom.acoBtnText.textContent = `⚡ RUN SOLVER`;
    });
  }

  dom.btnRunAco.addEventListener('click', async () => {
    state.originPort = dom.selectOrigin.value;
    state.destPort = dom.selectDest.value;
    state.algorithm = dom.selectAlgorithm ? dom.selectAlgorithm.value : 'compare';
    renderPorts();

    dom.acoSpinner.classList.remove('hidden');
    dom.acoBtnText.textContent = 'SOLVING...';
    dom.btnRunAco.disabled = true;

    try {
      const resp = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin_port: state.originPort,
          dest_port: state.destPort,
          n_ants: 28,
          n_iterations: 35,
          algorithm: state.algorithm
        })
      });
      const data = await resp.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      state.primaryRoute = data.primary_route;
      state.alternateRoute = data.alternate_route;
      state.comparisonRoutes = data.comparison_routes || {};
      state.selectedRouteType = 'primary';
      state.isApproved = false;

      renderRoutes();
      renderCandidateTrails(data.sample_candidates);
      renderComparisonMatrix(data);
      renderWaypointsTable(data.primary_route);
      updateAIAnalysisWithRoute(data.primary_route);
      openAnalysisDrawer();

      dom.btnApprove.disabled = false;
      dom.btnReject.disabled = false;
    } catch (err) {
      console.error('Optimization error:', err);
      alert('Error running route solver.');
    } finally {
      dom.acoSpinner.classList.add('hidden');
      dom.acoBtnText.textContent = `⚡ RUN SOLVER`;
      dom.btnRunAco.disabled = false;
    }
  });

  function renderRoutes() {
    state.layers.primaryRoute.clearLayers();
    state.layers.alternateRoute.clearLayers();
    state.layers.astarRoute.clearLayers();
    state.layers.dijkstraRoute.clearLayers();

    // smoothFactor 0 keeps every waypoint: Leaflet's default simplification
    // straightens legs at low zoom and can visually cut a track across land.
    const trackStyle = extra => Object.assign({ smoothFactor: 0 }, extra);

    // Primary ACO Route (Cyan Solid)
    if (state.primaryRoute && state.primaryRoute.geo_coordinates) {
      L.polyline(state.primaryRoute.geo_coordinates, trackStyle({ color: '#00f3ff', weight: 3, opacity: 0.95 })).addTo(state.layers.primaryRoute);
    }
    // Alternate ACO Route (Cyan Dashed)
    if (state.alternateRoute && state.alternateRoute.geo_coordinates) {
      L.polyline(state.alternateRoute.geo_coordinates, trackStyle({ color: '#00b8d4', weight: 2, opacity: 0.8, dashArray: '4, 4' })).addTo(state.layers.alternateRoute);
    }
    // Comparison Routes
    if (state.comparisonRoutes.astar && state.comparisonRoutes.astar.geo_coordinates) {
      L.polyline(state.comparisonRoutes.astar.geo_coordinates, trackStyle({ color: '#ff9d00', weight: 2.5, dashArray: '5, 5', opacity: 0.9 })).addTo(state.layers.astarRoute);
    }
    if (state.comparisonRoutes.dijkstra && state.comparisonRoutes.dijkstra.geo_coordinates) {
      L.polyline(state.comparisonRoutes.dijkstra.geo_coordinates, trackStyle({ color: '#a855f7', weight: 2.5, dashArray: '6, 6', opacity: 0.9 })).addTo(state.layers.dijkstraRoute);
    }
  }

  function renderCandidateTrails(candidates) {
    state.layers.candidates.clearLayers();
    if (!candidates) return;
    candidates.forEach(path => {
      L.polyline(path, { color: '#00f3ff', weight: 1, opacity: 0.18, smoothFactor: 0 }).addTo(state.layers.candidates);
    });
  }

  function renderComparisonMatrix(data) {
    const routes = data.comparison_routes || {};
    const cards = {
      aco: routes.aco || (data.primary_route && data.primary_route.algorithm === 'aco' ? data.primary_route : null),
      astar: routes.astar,
      dijk: routes.dijkstra
    };

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    Object.entries(cards).forEach(([key, route]) => {
      if (!route) {
        ['dist', 'time', 'risk', 'peak', 'cost'].forEach(f => setText(`matrix-${key}-${f}`, '—'));
        return;
      }
      setText(`matrix-${key}-dist`, `${route.total_dist_nm} NM`);
      setText(`matrix-${key}-time`, `${route.total_time_hrs} HRS`);
      setText(`matrix-${key}-risk`, `${route.avg_risk.toFixed(1)} / 10`);
      setText(`matrix-${key}-peak`, `${route.max_risk.toFixed(1)} / 10`);
      setText(`matrix-${key}-cost`, route.nodes_explored
        ? `${route.cost.toFixed(1)} (${route.nodes_explored} nodes)`
        : route.cost.toFixed(1));
    });
  }

  function renderWaypointsTable(route) {
    if (!dom.waypointsTableBody) return;
    dom.waypointsTableBody.innerHTML = '';

    if (!route || !route.geo_coordinates) return;

    route.geo_coordinates.forEach((pt, idx) => {
      const lat = pt[0];
      const lon = pt[1];
      let heading = '135°';
      if (idx < route.geo_coordinates.length - 1) {
        const next = route.geo_coordinates[idx + 1];
        const angle = Math.atan2(next[1] - lon, next[0] - lat) * (180 / Math.PI);
        heading = `${((450 - angle) % 360).toFixed(0)}°`;
      }

      const row = document.createElement('tr');
      row.id = `wp-row-${idx}`;
      row.innerHTML = `
        <td style="color:var(--neon-cyan); font-weight:bold;">WP-${String(idx + 1).padStart(2, '0')}</td>
        <td>${lat.toFixed(3)}°N</td>
        <td>${lon.toFixed(3)}°E</td>
        <td>${heading}</td>
      `;
      dom.waypointsTableBody.appendChild(row);
    });
  }

  function updateAIAnalysisWithRoute(p) {
    if (!p || !dom.aiAnalysisViewport) return;
    const solver = (p.algorithm || 'aco').toUpperCase();
    dom.aiAnalysisViewport.innerHTML = `
      <div class="target-intel-card">
        <div class="intel-title">
          <span class="text-cyan">RECOMMENDED ROUTE</span>
          <span class="threat-badge low">${solver}</span>
        </div>
        <div class="intel-sub-id">${state.originPort} ➔ ${state.destPort}</div>
        <div class="intel-grid mt-2">
          <div>DISTANCE: <strong>${p.total_dist_nm} NM</strong></div>
          <div>TRANSIT TIME: <strong>${p.total_time_hrs} HRS</strong></div>
          <div>MEAN RISK: <strong class="text-emerald">${p.avg_risk.toFixed(1)}/10</strong></div>
          <div>PEAK THREAT: <strong class="text-amber">${p.max_risk.toFixed(1)}/10</strong></div>
          <div>COST SCORE: <strong>${p.cost.toFixed(1)}</strong></div>
          <div>WAYPOINTS: <strong>${p.geo_coordinates.length}</strong></div>
        </div>
        <div class="intel-assessment-box mt-2">
          <div class="box-lbl">// AI TACTICAL EVALUATION</div>
          <ul class="assessment-list mt-1">
            <li>Route minimizes exposure to recorded piracy clusters & restricted TSS zones.</li>
            <li>Ant Colony Optimization (ACO) outperformed A* and Dijkstra in risk mitigation.</li>
            <li>Ready for Fleet Commander approval & transit execution.</li>
          </ul>
        </div>
      </div>
    `;
  }

  dom.btnApprove.addEventListener('click', async () => {
    try {
      const resp = await fetch('/api/commander/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'APPROVE', selected_route_type: state.selectedRouteType })
      });
      const data = await resp.json();
      if (data.status === 'APPROVED') {
        state.isApproved = true;
        state.vesselStatus = 'EN_ROUTE';
        dom.btnStep.disabled = false;
        dom.btnPlay.disabled = false;
        dom.btnDeviate.disabled = false;
        fetchStatus();
      }
    } catch (err) {
      console.error('Approve error:', err);
    }
  });

  dom.btnReject.addEventListener('click', async () => {
    try {
      const resp = await fetch('/api/commander/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'REJECT' })
      });
      const data = await resp.json();
      if (data.status === 'RECALCULATED') {
        state.primaryRoute = data.new_route;
        renderRoutes();
        renderWaypointsTable(data.new_route);
        updateAIAnalysisWithRoute(data.new_route);
      }
    } catch (err) {
      console.error('Reject error:', err);
    }
  });

  dom.btnStep.addEventListener('click', async () => {
    try {
      const resp = await fetch('/api/voyage/step', { method: 'POST' });
      const data = await resp.json();
      if (data.finished) stopAutoTransit();
      fetchStatus();
    } catch (err) {
      console.error('Step error:', err);
    }
  });

  dom.btnPlay.addEventListener('click', () => {
    if (state.isAutoTransiting) stopAutoTransit();
    else startAutoTransit();
  });

  function startAutoTransit() {
    state.isAutoTransiting = true;
    dom.btnPlay.textContent = 'Pause ⏸';
    state.transitTimer = setInterval(async () => {
      const resp = await fetch('/api/voyage/step', { method: 'POST' });
      const data = await resp.json();
      fetchStatus();
      if (data.finished) stopAutoTransit();
    }, 800);
  }

  function stopAutoTransit() {
    state.isAutoTransiting = false;
    dom.btnPlay.textContent = 'Auto Transit ⏯';
    if (state.transitTimer) clearInterval(state.transitTimer);
  }

  dom.btnDeviate.addEventListener('click', async () => {
    try {
      await fetch('/api/voyage/deviation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat_offset: 0.08, lon_offset: 0.05 })
      });
      fetchStatus();
    } catch (err) {
      console.error('Deviation error:', err);
    }
  });

  dom.btnReset.addEventListener('click', async () => {
    stopAutoTransit();
    await fetch('/api/voyage/reset', { method: 'POST' });
    dom.btnStep.disabled = true;
    dom.btnPlay.disabled = true;
    dom.btnDeviate.disabled = true;
    dom.btnApprove.disabled = true;
    dom.btnReject.disabled = true;
    fetchStatus();
  });

  // -------------------------------------------------------------
  // 6. THREAT INTEL VIEW & VESSEL LOG TABLE RENDERING
  // -------------------------------------------------------------
  function renderThreatIntelCards(filterSeverity = 'ALL') {
    if (!dom.threatCardsList) return;
    dom.threatCardsList.innerHTML = '';

    const items = THREAT_INTEL_ITEMS.filter(t => filterSeverity === 'ALL' || t.severity === filterSeverity);

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = `full-threat-card ${item.severity.toLowerCase()}`;
      card.innerHTML = `
        <div class="threat-card-top">
          <div class="threat-card-tags">
            <span class="domain-tag">${item.domain}</span>
            <span class="threat-badge ${item.severity.toLowerCase()}">${item.severity}</span>
            <span style="font-size:9px; color:var(--text-muted);">${item.id}</span>
          </div>
          <span style="font-size:9px; color:var(--text-muted);">CONF: ${item.conf}% ${item.time}</span>
        </div>
        <div class="threat-card-head-title">${item.title}</div>
        <div class="threat-card-desc">${item.desc}</div>
        <div class="threat-card-source">${item.source}</div>
        <div class="threat-conf-strip mt-1">
          <div class="conf-label-row">
            <span>AI CONFIDENCE EVALUATION</span>
            <span class="text-cyan">${item.conf}%</span>
          </div>
          <div class="conf-bar-bg">
            <div class="conf-bar-fill" style="width: ${item.conf}%"></div>
          </div>
        </div>
      `;
      dom.threatCardsList.appendChild(card);
    });
  }

  dom.threatFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.threatFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderThreatIntelCards(btn.dataset.severity);
    });
  });

  function renderVesselLogTable(sortBy = 'threat') {
    if (!dom.vesselTableBody) return;
    dom.vesselTableBody.innerHTML = '';

    let sorted = [...TRACKED_CONTACTS];
    if (sortBy === 'id') sorted.sort((a, b) => a.id.localeCompare(b.id));
    if (sortBy === 'speed') sorted.sort((a, b) => b.speed - a.speed);
    if (sortBy === 'threat') {
      const rank = { critical: 1, high: 2, medium: 3, low: 4, neutral: 5 };
      sorted.sort((a, b) => (rank[a.threat] || 5) - (rank[b.threat] || 5));
    }

    sorted.forEach(v => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="vessel-id-cell">${v.id}</td>
        <td><strong>${v.name}</strong></td>
        <td>${v.class}</td>
        <td>${v.flag}</td>
        <td>${v.lat.toFixed(2)}°N</td>
        <td>${v.lon.toFixed(2)}°E</td>
        <td>${v.hdg}</td>
        <td>${v.speed} kn</td>
        <td>${v.depth}</td>
        <td><span class="threat-badge ${v.threat}">${v.threatLabel}</span></td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <div class="ai-bar-bg" style="width:50px;"><div class="ai-bar-fill" style="width:${v.aiConfidence}%"></div></div>
            <span>${v.aiConfidence}%</span>
          </div>
        </td>
        <td>${v.lastSeen}</td>
        <td>${v.mmsi}</td>
      `;
      dom.vesselTableBody.appendChild(row);
    });
  }

  if (dom.sortBtnId) dom.sortBtnId.addEventListener('click', () => { setActiveSort(dom.sortBtnId); renderVesselLogTable('id'); });
  if (dom.sortBtnThreat) dom.sortBtnThreat.addEventListener('click', () => { setActiveSort(dom.sortBtnThreat); renderVesselLogTable('threat'); });
  if (dom.sortBtnSpeed) dom.sortBtnSpeed.addEventListener('click', () => { setActiveSort(dom.sortBtnSpeed); renderVesselLogTable('speed'); });

  function setActiveSort(btn) {
    [dom.sortBtnId, dom.sortBtnThreat, dom.sortBtnSpeed].forEach(b => b && b.classList.remove('active'));
    btn.classList.add('active');
  }

  function renderCommsMessages() {
    if (!dom.encryptedMessageLog) return;
    dom.encryptedMessageLog.innerHTML = '';

    COMMS_MESSAGES.forEach(m => {
      const item = document.createElement('div');
      item.className = 'msg-row-item';
      item.innerHTML = `
        <div>
          <div class="msg-meta-row">${m.time} &nbsp; <strong>${m.sender}</strong> ➔ <strong>${m.recipient}</strong></div>
          <div class="msg-body-text">${m.text}</div>
        </div>
        <span class="encrypted-badge">ENCRYPTED</span>
      `;
      dom.encryptedMessageLog.appendChild(item);
    });
  }

  if (dom.btnSendAiCommand && dom.aiCommandInput) {
    dom.btnSendAiCommand.addEventListener('click', () => {
      const query = dom.aiCommandInput.value.trim();
      if (!query) return;

      const userMsg = document.createElement('div');
      userMsg.className = 'chat-msg user-msg';
      userMsg.innerHTML = `<span class="msg-sender" style="color:var(--neon-amber)">COMMANDER:</span><div class="msg-content">${query}</div>`;
      dom.aiChatStream.appendChild(userMsg);

      dom.aiCommandInput.value = '';

      setTimeout(() => {
        const sysMsg = document.createElement('div');
        sysMsg.className = 'chat-msg system-msg';
        sysMsg.innerHTML = `<span class="msg-sender">AEGIS AI COMMAND:</span><div class="msg-content">Processing ACO route optimization query for "${query}". Ant swarm trajectory evaluated across piracy risk zones. Recommended course: ACO primary corridor.</div>`;
        dom.aiChatStream.appendChild(sysMsg);
        dom.aiChatStream.scrollTop = dom.aiChatStream.scrollHeight;
      }, 500);
    });
  }

  // -------------------------------------------------------------
  // 7. SIDEBAR TELEMETRY
  // -------------------------------------------------------------
  async function fetchStatus() {
    try {
      const resp = await fetch('/api/status');
      const data = await resp.json();
      updateSidebarTelemetry(data);
    } catch (err) {
      console.error('Status fetch error:', err);
    }
  }

  function updateSidebarTelemetry(data) {
    const v = data.vessel_info;
    if (!v) return;

    state.vesselStatus = v.status;
    const lat = v.current_lat || 5.38;
    const lon = v.current_lon || 100.12;
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lon >= 0 ? 'E' : 'W';

    if (dom.sidebarCoords) dom.sidebarCoords.textContent = `${Math.abs(lat).toFixed(3)}° ${ns}, ${Math.abs(lon).toFixed(3)}° ${ew}`;
    if (dom.sidebarSpeed) dom.sidebarSpeed.textContent = `${v.speed_knots.toFixed(1)} KTS`;

    let heading = '135° SE';
    let progressPct = 0;

    if (data.selected_route) {
      const route = data.selected_route;
      const totalWps = route.geo_coordinates.length;
      const idx = v.waypoint_index || 0;
      progressPct = Math.round((idx / Math.max(1, totalWps - 1)) * 100);

      // Highlight active waypoint row in coordinates table
      const activeWpRow = document.getElementById(`wp-row-${idx}`);
      if (activeWpRow) {
        document.querySelectorAll('.waypoints-table tr').forEach(r => r.style.background = '');
        activeWpRow.style.background = 'rgba(0, 243, 255, 0.2)';
      }
    }

    if (dom.sidebarHeading) dom.sidebarHeading.textContent = heading;
    if (dom.sidebarProgressPct) dom.sidebarProgressPct.textContent = `${progressPct}%`;
    if (dom.sidebarProgressBar) dom.sidebarProgressBar.style.width = `${progressPct}%`;

    if (dom.sidebarStatusBadge) {
      dom.sidebarStatusBadge.textContent = v.status;
      if (v.status === 'EN_ROUTE') dom.sidebarStatusBadge.className = 'text-emerald';
      else dom.sidebarStatusBadge.className = 'text-cyan';
    }

    const homeStatus = document.getElementById('home-vessel-status');
    const homeName = document.getElementById('home-vessel-name');
    const homeType = document.getElementById('home-vessel-type');
    const homeCallsign = document.getElementById('home-vessel-imo');
    const homePosition = document.getElementById('home-vessel-position');
    const homeRef = document.getElementById('home-tracking-ref');
    const statusLabel = v.status === 'MOORED'
      ? 'AT PORT — AWAITING DEPARTURE'
      : v.status === 'EN_ROUTE'
        ? 'EN ROUTE — TRANSIT ACTIVE'
        : v.status === 'COMPLETED'
          ? 'ARRIVED — VOYAGE COMPLETE'
          : v.status.replaceAll('_', ' ');
    if (homeStatus) homeStatus.textContent = statusLabel;
    if (homeName) homeName.textContent = (v.name || 'MV SENTINEL GUARDIAN').toUpperCase();
    if (homeType) homeType.textContent = v.type || 'Guided Escort & Cargo Vessel';
    if (homeCallsign) homeCallsign.textContent = v.callsign || '9V-SG44';
    if (homePosition) {
      const posLabel = v.status === 'MOORED'
        ? (v.origin_port || 'Penang (Malaysia)')
        : v.status === 'COMPLETED'
          ? (v.destination_port || 'Singapore (SE Gateway)')
          : formatCoord(lat, lon);
      homePosition.innerHTML = `<span class="marine-status-dot"></span>${posLabel}`;
    }
    if (homeRef) {
      const originCode = (v.origin_port || 'PNG').split(' ')[0].slice(0, 3).toUpperCase();
      const destCode = (v.destination_port || 'SIN').split(' ')[0].slice(0, 3).toUpperCase();
      homeRef.textContent = `${originCode}-${destCode}-2024-08477`;
    }

    renderVesselMarker(lat, lon, v.name, v.status);
  }

  function renderVesselMarker(lat, lon, name, status) {
    state.layers.vessel.clearLayers();
    const icon = L.divIcon({
      className: 'vessel-sci-fi-marker',
      html: `
        <div style="position:relative; width:22px; height:22px; display:flex; align-items:center; justify-content:center;">
          <div style="color:#00f3ff; font-weight:bold; font-size:14px; text-shadow:0 0 8px #00f3ff; transform:rotate(45deg);">▲</div>
        </div>
      `,
      iconSize: [22, 22]
    });

    const marker = L.marker([lat, lon], { icon }).bindPopup(`
      <div style="font-family:var(--font-mono); font-size:11px;">
        <strong style="color:#00f3ff">${name}</strong><br>
        Status: ${status}<br>
        Pos: ${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E
      </div>
    `);
    state.layers.vessel.addLayer(marker);
  }


  // -------------------------------------------------------------
  // 8. VESSEL POSITION COCKPIT & FLEET SYNC (CREW & COMMANDER)
  // -------------------------------------------------------------
  function mapVesselToContact(v) {
    let symbol = '◇';
    const vc = (v.vessel_class || '').toLowerCase();
    if (vc.includes('submarine')) symbol = 'V';
    else if (vc.includes('tug') || vc.includes('patrol')) symbol = '△';
    else if (vc.includes('tanker')) symbol = '◈';
    else if (vc.includes('flagship') || vc.includes('escort')) symbol = '▲';
    else symbol = 'o';

    let flagCode = 'SG';
    if (v.flag === 'Singapore') flagCode = 'SG';
    else if (v.flag === 'Marshall Islands') flagCode = 'MH';
    else if (v.flag === 'Panama') flagCode = 'PA';
    else if (v.flag === 'Malaysia') flagCode = 'MY';
    else if (v.flag === 'Liberia') flagCode = 'LR';
    else flagCode = (v.flag || '??').slice(0, 2).toUpperCase();

    const distFromLead = Math.round(Math.sqrt(Math.pow((v.lat - 5.416), 2) + Math.pow((v.lon - 100.345), 2)) * 60);

    return {
      id: v.id,
      name: v.name,
      class: (v.vessel_class || v.type || 'VESSEL').toUpperCase(),
      flag: flagCode,
      symbol: symbol,
      threat: (v.threat_level || 'low').toLowerCase(),
      threatLabel: (v.threat_label || v.threat_level || 'LOW').toUpperCase(),
      lat: v.lat,
      lon: v.lon,
      hdg: `${Math.round(v.heading_deg)}° ${v.heading_cardinal || ''}`.trim(),
      speed: Math.round(v.speed_knots * 10) / 10,
      depth: `${v.depth_m || 0}m`,
      lastSeen: v.last_contact || 'LIVE',
      aiConfidence: v.ai_confidence || 92,
      mmsi: v.mmsi || 'N/A',
      type: v.type || v.vessel_class,
      dist: `${distFromLead}nm`,
      details: `${v.notes || ''} [Status: ${v.status} | Route: ${v.origin_port} ➔ ${v.dest_port} | Deviation: ${v.route_deviation ? 'ALERT ACTIVE' : 'NOMINAL'}]`
    };
  }

  async function fetchFleetVessels() {
    try {
      const resp = await fetch('/api/fleet/vessels');
      if (!resp.ok) return;
      const data = await resp.json();
      state.fleetVessels = data.vessels || [];

      // Sourced directly from Vessel Position module:
      TRACKED_CONTACTS = state.fleetVessels.map(mapVesselToContact);

      // Dynamically update Fleet Commander view:
      renderContactsList(dom.contactSearchInput ? dom.contactSearchInput.value : '');
      renderContactMarkersOnMap();
      renderVesselLogTable();

      // Update Vessel Crew view:
      updateCrewVesselDropdown();
      const currentVessel = state.fleetVessels.find(v => v.id === state.selectedVesselId) || state.fleetVessels[0];
      if (currentVessel) {
        updateCrewTelemetryUI(currentVessel);
        evaluateCockpitExpert(currentVessel.id);
      }
      renderCrewVesselMarkers();
      renderCrewFleetTable();
    } catch (err) {
      console.error('Error fetching fleet vessels:', err);
    }
  }

  function updateCrewVesselDropdown() {
    const selects = [dom.crewVesselSelect, dom.expertVesselSelect].filter(Boolean);
    selects.forEach(sel => {
      const currentVal = sel.value;
      if (sel.children.length !== state.fleetVessels.length) {
        sel.innerHTML = '';
        state.fleetVessels.forEach(v => {
          const opt = document.createElement('option');
          opt.value = v.id;
          opt.textContent = `${v.id}: ${v.name} (${v.vessel_class || v.type})`;
          sel.appendChild(opt);
        });
      }
      if (currentVal && state.fleetVessels.some(v => v.id === currentVal)) {
        sel.value = currentVal;
      } else if (state.fleetVessels.length > 0) {
        sel.value = state.fleetVessels[0].id;
      }
    });

    if (state.fleetVessels.length > 0 && !state.selectedVesselId) {
      state.selectedVesselId = state.fleetVessels[0].id;
    }
  }

  function updateCrewTelemetryUI(v) {
    if (!v) return;
    const lat = v.lat;
    const lon = v.lon;
    const latDeg = Math.floor(Math.abs(lat));
    const latMin = ((Math.abs(lat) - latDeg) * 60).toFixed(3);
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDeg = Math.floor(Math.abs(lon));
    const lonMin = ((Math.abs(lon) - lonDeg) * 60).toFixed(3);
    const lonDir = lon >= 0 ? 'E' : 'W';

    if (dom.crewCoordDisplay) {
      dom.crewCoordDisplay.textContent = `${String(latDeg).padStart(2, '0')}° ${latMin}' ${latDir}, ${String(lonDeg).padStart(3, '0')}° ${lonMin}' ${lonDir}`;
    }
    if (dom.crewCoordDecimal) {
      dom.crewCoordDecimal.textContent = `(${lat.toFixed(5)}° ${latDir}, ${lon.toFixed(5)}° ${lonDir})`;
    }
    if (dom.crewSpeedDisplay) {
      dom.crewSpeedDisplay.innerHTML = `${v.speed_knots.toFixed(1)} <span class="unit">KTS</span>`;
    }
    if (dom.crewSpeedBar) {
      const pct = Math.min(100, Math.round((v.speed_knots / 30) * 100));
      dom.crewSpeedBar.style.width = `${pct}%`;
    }
    if (dom.crewHeadingDisplay) {
      dom.crewHeadingDisplay.innerHTML = `${Math.round(v.heading_deg)}° <span class="unit">${v.heading_cardinal || ''}</span>`;
    }
    if (dom.crewCompassNeedle) {
      dom.crewCompassNeedle.style.transform = `rotate(${v.heading_deg}deg)`;
    }
    if (dom.crewCompassBearing) {
      dom.crewCompassBearing.textContent = `${Math.round(v.heading_deg)}° ${v.heading_cardinal || ''}`;
    }
    if (dom.crewVesselStatus) {
      dom.crewVesselStatus.textContent = v.status;
      dom.crewVesselStatus.className = v.status === 'EN_ROUTE' || v.status === 'UNDERWAY' ? 'text-emerald' : 'text-cyan';
    }
    if (dom.crewVesselCallsign) dom.crewVesselCallsign.textContent = v.callsign || 'N/A';
    if (dom.crewVesselRoute) dom.crewVesselRoute.textContent = `${v.origin_port || 'Port'} ➔ ${v.dest_port || 'Port'}`;
    if (dom.crewVesselMmsi) dom.crewVesselMmsi.textContent = v.mmsi || 'N/A';
    if (dom.crewVesselDepth) dom.crewVesselDepth.textContent = `${(v.depth_m || 10).toFixed(1)} M`;

    if (dom.crewInputSpeed && document.activeElement !== dom.crewInputSpeed) {
      dom.crewInputSpeed.value = v.speed_knots;
      if (dom.crewSpeedValLabel) dom.crewSpeedValLabel.textContent = `${v.speed_knots.toFixed(1)} KTS`;
    }
    if (dom.crewInputHeading && document.activeElement !== dom.crewInputHeading) {
      dom.crewInputHeading.value = Math.round(v.heading_deg);
      if (dom.crewHeadingValLabel) dom.crewHeadingValLabel.textContent = `${Math.round(v.heading_deg)}°`;
    }
  }

  function fitCrewMalaccaView() {
    if (!state.crewMap) return;
    state.crewMap.invalidateSize();
    state.crewMap.fitBounds(MALACCA_BOUNDS, { padding: [20, 20], maxZoom: 8 });
  }

  function initCrewVesselMap() {
    if (state.crewMap) return;
    const container = document.getElementById('crew-vessel-map');
    if (!container) return;

    state.crewMap = L.map('crew-vessel-map', {
      center: [3.2, 100.8],
      zoom: 6,
      minZoom: 5,
      maxZoom: 12,
      zoomControl: false,
      maxBounds: MALACCA_BOUNDS.pad(0.3)
    });

    L.control.zoom({ position: 'topright' }).addTo(state.crewMap);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri Ocean Basemap',
      maxZoom: 13
    }).addTo(state.crewMap);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 13,
      pane: 'shadowPane'
    }).addTo(state.crewMap);

    state.crewLayers.trails = L.layerGroup().addTo(state.crewMap);
    state.crewLayers.vessels = L.layerGroup().addTo(state.crewMap);

    fitCrewMalaccaView();
  }

  function renderCrewVesselMarkers() {
    if (!state.crewLayers.vessels) return;
    state.crewLayers.vessels.clearLayers();
    state.crewLayers.trails.clearLayers();

    state.fleetVessels.forEach(v => {
      if (v.trail && v.trail.length > 1) {
        L.polyline(v.trail, {
          color: v.id === state.selectedVesselId ? '#00f3ff' : '#00ff88',
          weight: v.id === state.selectedVesselId ? 2.5 : 1.5,
          opacity: 0.7,
          dashArray: '3 6'
        }).addTo(state.crewLayers.trails);
      }

      const isSelected = v.id === state.selectedVesselId;
      let color = '#00f3ff';
      if (v.threat_level === 'critical') color = '#ff1e43';
      else if (v.threat_level === 'high') color = '#ff8c00';
      else if (v.vessel_class && v.vessel_class.includes('Escort')) color = '#ffd000';
      else if (v.status === 'UNDERWAY' || v.status === 'EN_ROUTE') color = '#00ff88';

      const icon = L.divIcon({
        className: 'crew-vessel-marker-wrap',
        html: `
          <div class="crew-map-vessel-pin ${isSelected ? 'selected' : ''}" style="border-color:${color}">
            <div class="vessel-arrow" style="transform: rotate(${v.heading_deg}deg); color:${color}">▲</div>
            <div class="vessel-callout" style="color:${color}; border:1px solid ${color};">${v.name.split(' ')[0]} ${v.speed_knots}k</div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([v.lat, v.lon], { icon, zIndexOffset: isSelected ? 1500 : 500 });
      marker.bindPopup(`
        <div style="font-family:var(--font-mono); font-size:11px; padding:2px;">
          <strong style="color:${color}">${v.name}</strong> (${v.id})<br>
          Class: ${v.vessel_class}<br>
          Position: ${v.lat.toFixed(4)}°N, ${v.lon.toFixed(4)}°E<br>
          Speed: ${v.speed_knots} kts | Hdg: ${Math.round(v.heading_deg)}°<br>
          Status: <strong>${v.status}</strong><br>
          Deviation: <span style="color:${v.route_deviation ? '#ff1e43' : '#00ff88'}">${v.route_deviation ? 'ALERT: DEVIATING' : 'ON TRACK'}</span>
        </div>
      `);

      marker.on('click', () => {
        selectCrewVessel(v.id);
      });

      state.crewLayers.vessels.addLayer(marker);
    });
  }

  function selectCrewVessel(vesselId) {
    state.selectedVesselId = vesselId;
    if (dom.crewVesselSelect) dom.crewVesselSelect.value = vesselId;
    if (dom.expertVesselSelect) dom.expertVesselSelect.value = vesselId;
    const v = state.fleetVessels.find(item => item.id === vesselId);
    if (v) {
      updateCrewTelemetryUI(v);
      renderCrewVesselMarkers();
      renderCrewFleetTable();
      evaluateCockpitExpert(vesselId);
      if (state.crewMap) {
        state.crewMap.panTo([v.lat, v.lon]);
      }
    }
  }

  function renderCrewFleetTable() {
    if (!dom.crewFleetTableBody) return;
    dom.crewFleetTableBody.innerHTML = '';

    state.fleetVessels.forEach(v => {
      const isSelected = v.id === state.selectedVesselId;
      const row = document.createElement('tr');
      if (isSelected) row.classList.add('selected-vessel-row');

      row.innerHTML = `
        <td class="vessel-id-cell"><strong>${v.id}</strong></td>
        <td><strong>${v.name}</strong></td>
        <td>${v.vessel_class || v.type}</td>
        <td>${v.flag}</td>
        <td>${v.lat.toFixed(4)}°N</td>
        <td>${v.lon.toFixed(4)}°E</td>
        <td>${Math.round(v.heading_deg)}° ${v.heading_cardinal || ''}</td>
        <td>${v.speed_knots.toFixed(1)} kn</td>
        <td><span class="threat-badge ${v.status === 'UNDERWAY' || v.status === 'EN_ROUTE' ? 'low' : 'neutral'}">${v.status}</span></td>
        <td>
          <button class="cyber-btn sm-cyber-btn select-vessel-btn" data-vessel-id="${v.id}">
            ${isSelected ? 'ACTIVE' : 'SELECT'}
          </button>
        </td>
      `;

      row.querySelector('.select-vessel-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        selectCrewVessel(v.id);
      });

      row.addEventListener('click', () => {
        selectCrewVessel(v.id);
      });

      dom.crewFleetTableBody.appendChild(row);
    });
  }

  function initCrewCockpitControls() {
    if (dom.crewVesselSelect) {
      dom.crewVesselSelect.addEventListener('change', (e) => {
        selectCrewVessel(e.target.value);
      });
    }

    if (dom.crewInputSpeed) {
      dom.crewInputSpeed.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value).toFixed(1);
        if (dom.crewSpeedValLabel) dom.crewSpeedValLabel.textContent = `${val} KTS`;
      });
    }

    if (dom.crewInputHeading) {
      dom.crewInputHeading.addEventListener('input', (e) => {
        const val = Math.round(parseFloat(e.target.value));
        if (dom.crewHeadingValLabel) dom.crewHeadingValLabel.textContent = `${val}°`;
      });
    }

    // Speed Presets
    document.querySelectorAll('.speed-presets .preset-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const spd = parseFloat(btn.dataset.speed);
        if (dom.crewInputSpeed) {
          dom.crewInputSpeed.value = spd;
          if (dom.crewSpeedValLabel) dom.crewSpeedValLabel.textContent = `${spd.toFixed(1)} KTS`;
        }
      });
    });

    // Heading Presets
    const btnPort = document.getElementById('btn-helm-port');
    const btnMid = document.getElementById('btn-helm-midships');
    const btnStbd = document.getElementById('btn-helm-stbd');

    if (btnPort) {
      btnPort.addEventListener('click', () => {
        if (dom.crewInputHeading) {
          let h = (parseInt(dom.crewInputHeading.value, 10) - 10 + 360) % 360;
          dom.crewInputHeading.value = h;
          if (dom.crewHeadingValLabel) dom.crewHeadingValLabel.textContent = `${h}°`;
        }
      });
    }
    if (btnMid) {
      btnMid.addEventListener('click', () => {
        if (dom.crewInputHeading) {
          dom.crewInputHeading.value = 0;
          if (dom.crewHeadingValLabel) dom.crewHeadingValLabel.textContent = `0°`;
        }
      });
    }
    if (btnStbd) {
      btnStbd.addEventListener('click', () => {
        if (dom.crewInputHeading) {
          let h = (parseInt(dom.crewInputHeading.value, 10) + 10) % 360;
          dom.crewInputHeading.value = h;
          if (dom.crewHeadingValLabel) dom.crewHeadingValLabel.textContent = `${h}°`;
        }
      });
    }

    // Transmit to Fleet Commander
    if (dom.btnCrewApplyHelm) {
      dom.btnCrewApplyHelm.addEventListener('click', async () => {
        const speed = parseFloat(dom.crewInputSpeed.value);
        const heading = parseFloat(dom.crewInputHeading.value);
        dom.btnCrewApplyHelm.disabled = true;
        dom.btnCrewApplyHelm.textContent = 'TRANSMITTING...';

        try {
          const resp = await fetch(`/api/fleet/vessels/${state.selectedVesselId}/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ speed_knots: speed, heading_deg: heading })
          });
          if (resp.ok) {
            await fetchFleetVessels();
            dom.btnCrewApplyHelm.textContent = '✓ TRANSMITTED TO FLEET COMMANDER';
            setTimeout(() => {
              dom.btnCrewApplyHelm.textContent = 'TRANSMIT TO FLEET COMMANDER';
              dom.btnCrewApplyHelm.disabled = false;
            }, 1200);
          } else {
            dom.btnCrewApplyHelm.textContent = 'TRANSMISSION FAILED';
            setTimeout(() => {
              dom.btnCrewApplyHelm.textContent = 'TRANSMIT TO FLEET COMMANDER';
              dom.btnCrewApplyHelm.disabled = false;
            }, 1500);
          }
        } catch (err) {
          console.error('Helm transmission error:', err);
          dom.btnCrewApplyHelm.disabled = false;
          dom.btnCrewApplyHelm.textContent = 'TRANSMIT TO FLEET COMMANDER';
        }
      });
    }

    // Simulation Step (+1 Min)
    if (dom.btnCrewSimStep) {
      dom.btnCrewSimStep.addEventListener('click', async () => {
        dom.btnCrewSimStep.disabled = true;
        try {
          await fetch('/api/fleet/simulate_tick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ step_minutes: 1.0 })
          });
          await fetchFleetVessels();
        } catch (err) {
          console.error('Sim step error:', err);
        } finally {
          dom.btnCrewSimStep.disabled = false;
        }
      });
    }

    // Simulation Auto-Ticker
    if (dom.btnCrewSimAuto) {
      dom.btnCrewSimAuto.addEventListener('click', () => {
        state.isAutoSimulating = !state.isAutoSimulating;
        if (state.isAutoSimulating) {
          dom.btnCrewSimAuto.textContent = '⏸ PAUSE TICKER';
          dom.btnCrewSimAuto.classList.add('danger-cyber-btn');
          state.simInterval = setInterval(async () => {
            try {
              await fetch('/api/fleet/simulate_tick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ step_minutes: 1.0 })
              });
              await fetchFleetVessels();
            } catch (err) {
              console.error('Sim tick error:', err);
            }
          }, 1600);
        } else {
          dom.btnCrewSimAuto.textContent = '⏯ AUTO-TICKER';
          dom.btnCrewSimAuto.classList.remove('danger-cyber-btn');
          if (state.simInterval) clearInterval(state.simInterval);
        }
      });
    }

    // Report Route Deviation
    if (dom.btnCrewReportDeviation) {
      dom.btnCrewReportDeviation.addEventListener('click', async () => {
        dom.btnCrewReportDeviation.disabled = true;
        try {
          const resp = await fetch(`/api/fleet/vessels/${state.selectedVesselId}/deviate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat_offset: 0.08, lon_offset: 0.06 })
          });
          const data = await resp.json();
          await fetchFleetVessels();
          alert(`⚠️ ROUTE DEVIATION REPORTED!\n\n${data.alert}\nNew Position: ${data.vessel.lat.toFixed(4)}°N, ${data.vessel.lon.toFixed(4)}°E\nAlert broadcast to Fleet Commander Tactical View.`);
        } catch (err) {
          alert('Failed to report deviation.');
        } finally {
          dom.btnCrewReportDeviation.disabled = false;
        }
      });
    }
  }

  // =============================================================
  // 8. AI SYLLABUS UNIT 6: MARITIME EXPERT SYSTEM & EXPLANATION FACILITY
  // =============================================================
  async function fetchKBRules() {
    try {
      const resp = await fetch('/api/ai/expert-system/rules');
      const data = await resp.json();
      state.kbRules = data.rules || [];
      renderKBRules(state.kbRules);
    } catch (err) {
      console.error('Failed to fetch KB rules:', err);
    }
  }

  function renderKBRules(rules) {
    if (!dom.kbRulesAccordion) return;
    dom.kbRulesAccordion.innerHTML = '';
    rules.forEach(r => {
      const card = document.createElement('div');
      card.className = 'kb-rule-card';
      const ruleId = r.id || r.rule_id || 'RULE';
      card.id = `kb-rule-${ruleId}`;
      const premises = r.premises || r.antecedents || [];
      const premisesStr = premises.map(p => `${p.fact} ${p.op} ${p.val}`).join(' AND ');
      const concl = r.conclusion || r.consequents || {};
      const action = concl.action || 'ADVISE';
      const targetSpeed = concl.target_speed_knots !== undefined ? concl.target_speed_knots : (concl.recommended_speed || 18.0);
      const courseTrim = concl.course_trim_deg !== undefined ? concl.course_trim_deg : (concl.helm_trim_deg || 0.0);
      const title = r.title || r.name || 'Maritime Rule';
      const colreg = r.colreg_rule || r.colreg_ref || 'COLREGs';

      card.innerHTML = `
        <div class="kb-rule-head">
          <span class="kb-rule-id">${ruleId}</span>
          <span class="kb-rule-prio">PRIORITY ${r.priority} &bull; ${colreg}</span>
        </div>
        <div class="kb-rule-title">${title}</div>
        <div class="kb-clause-box">
          <div><strong>IF:</strong> ${premisesStr}</div>
          <div class="mt-1"><strong>THEN:</strong> Action: ${action} | Speed: ${targetSpeed} kts | Trim: ${courseTrim}°</div>
        </div>
        <div class="text-xs text-dim mt-1" style="font-size:8px;">${r.rationale || ''}</div>
      `;
      dom.kbRulesAccordion.appendChild(card);
    });
  }

  async function evaluateExpertSystem(vesselId, customFacts = null) {
    try {
      const payload = { vessel_id: vesselId || state.selectedVesselId || 'VESSEL-001' };
      if (customFacts) payload.custom_facts = customFacts;

      const resp = await fetch('/api/ai/expert-system/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (data.status !== 'success' && data.status !== 'ok') return;

      state.expertAdvisory = data;

      // 1. Populate Working Memory Table
      if (dom.expertWmTableBody && data.working_memory) {
        dom.expertWmTableBody.innerHTML = '';
        let factsList = [];
        if (Array.isArray(data.working_memory.facts)) {
          factsList = data.working_memory.facts;
        } else {
          for (const [k, v] of Object.entries(data.working_memory)) {
            if (k !== 'facts') {
              factsList.push({ name: k, value: v, type: typeof v });
            }
          }
        }

        factsList.forEach(f => {
          const row = document.createElement('tr');
          let valDisplay = typeof f.value === 'boolean' ? (f.value ? 'TRUE' : 'FALSE') : f.value;
          row.innerHTML = `
            <td><strong class="text-cyan">${f.name}</strong></td>
            <td><span class="${typeof f.value === 'boolean' && f.value ? 'text-amber' : ''}">${valDisplay}</span></td>
            <td><span class="text-dim" style="font-size:8px;">${f.type || typeof f.value}</span></td>
          `;
          dom.expertWmTableBody.appendChild(row);
        });
      }

      // 2. Populate Advisory Verdict Card
      const rule = data.firing_rule || (data.primary_advisory ? {
        id: data.primary_rule_id || 'RULE',
        title: data.primary_rule_name || data.primary_advisory.headline || 'Active Advisory',
        severity: data.primary_advisory.severity || 'nominal',
        action: data.primary_advisory.action || 'MAINTAIN_CRUISE',
        message: data.primary_advisory.message || '',
        target_speed_knots: data.primary_advisory.recommended_speed || 18.0,
        course_trim_deg: data.primary_advisory.helm_trim_deg || 0.0,
        colreg_rule: data.fired_rules && data.fired_rules[0] ? (data.fired_rules[0].colreg_rule || data.fired_rules[0].colreg_ref) : 'COLREGs'
      } : null);

      if (rule && dom.expertVerdictCard) {
        const sev = (rule.severity || 'nominal').toLowerCase();
        dom.expertVerdictCard.className = `expert-advisory-card ${sev}`;
        if (dom.expertVerdictBadge) {
          dom.expertVerdictBadge.textContent = sev.toUpperCase();
          dom.expertVerdictBadge.className = `threat-badge ${sev}`;
        }
        if (dom.expertVerdictRuleId) dom.expertVerdictRuleId.textContent = rule.id || rule.rule_id || 'RULE';
        if (dom.expertVerdictColreg) dom.expertVerdictColreg.textContent = rule.colreg_rule || rule.colreg_ref || 'COLREGs';
        if (dom.expertVerdictHeadline) dom.expertVerdictHeadline.textContent = rule.title || rule.headline || rule.name || 'Advisory';
        if (dom.expertVerdictMessage) dom.expertVerdictMessage.textContent = rule.message || '';
        if (dom.expertSpecAction) dom.expertSpecAction.textContent = rule.action || 'MAINTAIN_CRUISE';
        if (dom.expertSpecSpeed) dom.expertSpecSpeed.textContent = `${rule.target_speed_knots || 18.0} KTS`;
        if (dom.expertSpecTrim) {
          const trim = rule.course_trim_deg !== undefined ? rule.course_trim_deg : 0.0;
          dom.expertSpecTrim.textContent = trim === 0 ? '0.0° MIDSHIPS' : (trim > 0 ? `+${trim}° STBD` : `${trim}° PORT`);
        }

        // Highlight in KB list
        document.querySelectorAll('.kb-rule-card').forEach(c => c.classList.remove('fired'));
        const activeCard = document.getElementById(`kb-rule-${rule.id || rule.rule_id}`);
        if (activeCard) activeCard.classList.add('fired');
      }

      // 3. Update Cockpit Widget on Vessel Position Deck
      updateCockpitWidget(rule);

      // 4. Render WHY & HOW Explanations
      const whyExp = data.why_explanation || (data.explanation_facility ? data.explanation_facility.why : null);
      const howExp = data.how_explanation || (data.explanation_facility ? data.explanation_facility.how : null);
      if (whyExp) renderWhyExplanation(whyExp);
      if (howExp) renderHowExplanation(howExp);

    } catch (err) {
      console.error('Expert system evaluation error:', err);
    }
  }

  function updateCockpitWidget(rule) {
    if (!rule) return;
    const sev = (rule.severity || 'nominal').toLowerCase();
    if (dom.cockpitExpertBadge) {
      dom.cockpitExpertBadge.textContent = sev.toUpperCase();
      dom.cockpitExpertBadge.className = `threat-badge ${sev}`;
    }
    if (dom.cockpitExpertHeadline) {
      dom.cockpitExpertHeadline.textContent = `${rule.id || rule.rule_id || 'RULE'}: ${rule.action || 'ADVISORY'}`;
    }
    if (dom.cockpitExpertAction) {
      dom.cockpitExpertAction.textContent = rule.message || 'Navigation parameters verified against safety rules.';
    }
  }

  async function evaluateCockpitExpert(vesselId) {
    try {
      const resp = await fetch('/api/ai/expert-system/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vessel_id: vesselId })
      });
      const data = await resp.json();
      if ((data.status === 'success' || data.status === 'ok')) {
        const rule = data.firing_rule || (data.primary_advisory ? {
          id: data.primary_rule_id,
          title: data.primary_rule_name,
          action: data.primary_advisory.action,
          message: data.primary_advisory.message,
          severity: data.primary_advisory.severity
        } : null);
        if (rule) {
          updateCockpitWidget(rule);
          state.expertAdvisory = data;
        }
      }
    } catch (e) {
      console.error('Cockpit expert advisory poll error:', e);
    }
  }

  function renderWhyExplanation(why) {
    if (!why) return;
    const titleEl = document.getElementById('why-question-title');
    if (titleEl) titleEl.textContent = why.question || 'Why was this advisory generated?';

    if (dom.whyPremisesList && why.premises_evaluated) {
      dom.whyPremisesList.innerHTML = '';
      why.premises_evaluated.forEach(p => {
        const row = document.createElement('div');
        const matched = p.matched !== false && p.satisfied !== false;
        row.className = `premise-row ${matched ? 'matched' : 'unmet'}`;
        const opStr = p.operator || p.op || '=';
        const reqVal = p.required_value !== undefined ? p.required_value : p.val;
        row.innerHTML = `
          <div>
            <div class="premise-name">${p.fact}</div>
            <div class="premise-detail">Condition: ${p.fact} ${opStr} ${reqVal} &bull; Actual: <strong>${p.actual_value}</strong></div>
          </div>
          <span class="premise-status-pill ${matched ? 'matched' : 'unmet'}">
            ${matched ? '✓ MATCHED' : '✗ UNMET'}
          </span>
        `;
        dom.whyPremisesList.appendChild(row);
      });
    }

    if (dom.whyRationaleText) dom.whyRationaleText.textContent = why.maritime_justification || why.rationale || '—';
    if (dom.whyStandardText) {
      const ruleRef = why.rule_id ? `${why.rule_id}: ${why.rule_title || ''}` : '';
      const std = why.governing_standard || why.colreg_rule || 'IMO COLREGs';
      dom.whyStandardText.textContent = ruleRef ? `${std} (${ruleRef})` : std;
    }
  }

  function renderHowExplanation(how) {
    if (!how || !dom.howDerivationList) return;
    dom.howDerivationList.innerHTML = '';
    const steps = how.derivation_steps || [];
    steps.forEach((step, idx) => {
      const item = document.createElement('div');
      item.className = 'derivation-step';
      const stepNum = step.step !== undefined ? step.step : idx + 1;
      const title = step.rule_title || step.rule_name || step.rule_id;
      const checked = Array.isArray(step.premises_evaluated) ? step.premises_evaluated.join(' AND ') : JSON.stringify(step.matched_evidence || {});
      const concl = step.conclusion_asserted || step.derived_action || 'Fired';
      item.innerHTML = `
        <div class="step-num">#${stepNum}</div>
        <div class="step-body">
          <div class="step-rule">${step.rule_id}: ${title} ${step.fired ? '⚡ <strong style="color:var(--neon-cyan)">[FIRED]</strong>' : ''}</div>
          <div class="text-dim" style="font-size:8px;">Checked: ${checked}</div>
          <div class="step-concl">Asserted ➔ ${concl}</div>
        </div>
      `;
      dom.howDerivationList.appendChild(item);
    });
  }

  function initExpertSystemEvents() {
    if (dom.btnEvalExpert) {
      dom.btnEvalExpert.addEventListener('click', () => {
        const sel = dom.expertVesselSelect ? dom.expertVesselSelect.value : state.selectedVesselId;
        evaluateExpertSystem(sel);
      });
    }

    if (dom.expertVesselSelect) {
      dom.expertVesselSelect.addEventListener('change', (e) => {
        selectCrewVessel(e.target.value);
        evaluateExpertSystem(e.target.value);
      });
    }

    // What-If sliders
    if (dom.sbDepth) {
      dom.sbDepth.addEventListener('input', (e) => {
        if (dom.sbDepthVal) dom.sbDepthVal.textContent = `${parseFloat(e.target.value).toFixed(1)} m`;
      });
    }
    if (dom.sbSpeed) {
      dom.sbSpeed.addEventListener('input', (e) => {
        if (dom.sbSpeedVal) dom.sbSpeedVal.textContent = `${parseFloat(e.target.value).toFixed(1)} kts`;
      });
    }
    if (dom.sbWeather) {
      dom.sbWeather.addEventListener('input', (e) => {
        if (dom.sbWeatherVal) dom.sbWeatherVal.textContent = parseFloat(e.target.value).toFixed(1);
      });
    }

    if (dom.btnEvalSandbox) {
      dom.btnEvalSandbox.addEventListener('click', () => {
        const customFacts = {
          depth_m: parseFloat(dom.sbDepth ? dom.sbDepth.value : 10.5),
          speed_knots: parseFloat(dom.sbSpeed ? dom.sbSpeed.value : 18.0),
          weather_severity: parseFloat(dom.sbWeather ? dom.sbWeather.value : 3.0),
          in_chokepoint: dom.sbChokepoint ? dom.sbChokepoint.checked : false,
          route_deviation: dom.sbDeviation ? dom.sbDeviation.checked : false
        };
        const sel = dom.expertVesselSelect ? dom.expertVesselSelect.value : state.selectedVesselId;
        evaluateExpertSystem(sel, customFacts);
      });
    }

    // Explanation tabs
    if (dom.explTabBtns) {
      dom.explTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          dom.explTabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const target = btn.dataset.expl;

          if (dom.explPaneWhy) dom.explPaneWhy.classList.toggle('hidden', target !== 'why');
          if (dom.explPaneHow) dom.explPaneHow.classList.toggle('hidden', target !== 'how');
          if (dom.explPaneKb) dom.explPaneKb.classList.toggle('hidden', target !== 'kb');

          if (target === 'kb' && state.kbRules.length === 0) {
            fetchKBRules();
          }
        });
      });
    }

    // Cockpit widget buttons
    if (dom.btnCockpitRunExpert) {
      dom.btnCockpitRunExpert.addEventListener('click', () => {
        evaluateCockpitExpert(state.selectedVesselId);
      });
    }
    if (dom.btnCockpitExplainExpert) {
      dom.btnCockpitExplainExpert.addEventListener('click', () => {
        switchMainTab('expert-system');
        const whyBtn = document.getElementById('btn-expl-why');
        if (whyBtn) whyBtn.click();
      });
    }
  }

  // =============================================================
  // 9. AI SYLLABUS UNIT 2: GENETIC ALGORITHM FLEET PATROL OPTIMIZER
  // =============================================================
  async function loadGAWaypoints() {
    try {
      const resp = await fetch('/api/ai/genetic-algorithm/waypoints');
      const data = await resp.json();
      const waypoints = data.waypoints || [];
      state.gaWaypoints = waypoints;
      state.selectedGAWaypointIds = new Set(waypoints.map(w => w.id));
      renderGAPortChips();
      runGeneticAlgorithm();
    } catch (e) {
      console.error('Error loading GA waypoints:', e);
    }
  }

  function renderGAPortChips() {
    if (!dom.gaPortChipsContainer || !state.gaWaypoints) return;
    dom.gaPortChipsContainer.innerHTML = '';

    state.gaWaypoints.forEach(w => {
      const isSelected = state.selectedGAWaypointIds.has(w.id);
      const chip = document.createElement('label');
      chip.className = `ga-port-chip ${isSelected ? 'selected' : ''}`;
      chip.innerHTML = `
        <input type="checkbox" value="${w.id}" ${isSelected ? 'checked' : ''}>
        <div class="ga-chip-info">
          <span class="ga-chip-name">${w.name}</span>
          <span class="ga-chip-coords">${w.lat.toFixed(2)}°N, ${w.lon.toFixed(2)}°E &bull; ${w.type}</span>
        </div>
      `;
      const cb = chip.querySelector('input');
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          state.selectedGAWaypointIds.add(w.id);
          chip.classList.add('selected');
        } else {
          if (state.selectedGAWaypointIds.size <= 3) {
            alert('A minimum of 3 ports is required for a closed patrol tour!');
            e.target.checked = true;
            return;
          }
          state.selectedGAWaypointIds.delete(w.id);
          chip.classList.remove('selected');
        }
        updateGAPortCount();
      });
      dom.gaPortChipsContainer.appendChild(chip);
    });

    updateGAPortCount();
  }

  function updateGAPortCount() {
    const count = state.selectedGAWaypointIds.size;
    const total = state.gaWaypoints.length;
    if (dom.gaSelectedCount) {
      dom.gaSelectedCount.textContent = `${count} / ${total} PORTS SELECTED`;
    }
    if (dom.gaKpiStations) {
      dom.gaKpiStations.textContent = `${count} WAYPOINTS`;
    }
  }

  async function runGeneticAlgorithm() {
    const selectedIds = Array.from(state.selectedGAWaypointIds);
    if (selectedIds.length < 3) {
      alert('Please select at least 3 ports to evolve a closed round-trip patrol loop!');
      return;
    }

    if (dom.btnRunGA) {
      dom.btnRunGA.disabled = true;
      dom.btnRunGA.textContent = 'EVOLVING POPULATION...';
    }

    try {
      const popSize = parseInt(dom.gaPopSize ? dom.gaPopSize.value : 40, 10);
      const generations = parseInt(dom.gaGenerations ? dom.gaGenerations.value : 50, 10);
      const crossoverRate = parseFloat(dom.gaCrossover ? dom.gaCrossover.value : 0.85);
      const mutationRate = parseFloat(dom.gaMutation ? dom.gaMutation.value : 0.25);

      const resp = await fetch('/api/ai/genetic-algorithm/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          population_size: popSize,
          pop_size: popSize,
          generations: generations,
          crossover_rate: crossoverRate,
          mutation_rate: mutationRate,
          selected_waypoint_ids: selectedIds
        })
      });
      const data = await resp.json();
      if (data.status !== 'success' && data.status !== 'ok') return;

      state.gaResult = data;

      const totalDist = data.total_distance_nm || data.best_distance_nm || (data.best_tour && data.best_tour.distance_nm) || 0;
      const bestFit = data.best_fitness || (data.best_tour && data.best_tour.fitness) || 0;
      const gens = data.generations_completed || generations;
      const tourList = Array.isArray(data.best_tour) ? data.best_tour : (data.best_tour && data.best_tour.waypoints ? data.best_tour.waypoints : []);

      // Update KPIs
      if (dom.gaKpiDistance) dom.gaKpiDistance.textContent = `${Number(totalDist).toFixed(1)} NM`;
      if (dom.gaKpiFitness) dom.gaKpiFitness.textContent = Number(bestFit).toFixed(4);
      if (dom.gaKpiGens) dom.gaKpiGens.textContent = `${gens} / ${generations}`;
      if (dom.gaKpiStations) dom.gaKpiStations.textContent = `${tourList.length} WAYPOINTS`;

      // Render Evolution Chart & Sequence
      const history = data.evolution_history || data.history || [];
      renderGAEvolutionChart(history);
      renderGATourSequence(tourList, totalDist);

    } catch (err) {
      console.error('GA Run Error:', err);
    } finally {
      if (dom.btnRunGA) {
        dom.btnRunGA.disabled = false;
        dom.btnRunGA.textContent = '🧬 EVOLVE PATROL TOUR';
      }
    }
  }

  function renderGAEvolutionChart(history) {
    if (!dom.gaEvolutionSvg || !history || history.length === 0) return;

    // Update Telemetry Summary
    const startDist = history[0].best_distance_nm;
    const endDist = history[history.length - 1].best_distance_nm;
    const pctSaved = Math.max(0, ((startDist - endDist) / startDist) * 100).toFixed(1);
    if (dom.gaSumStart) dom.gaSumStart.textContent = `${Number(startDist).toFixed(1)} NM`;
    if (dom.gaSumBest) dom.gaSumBest.textContent = `${Number(endDist).toFixed(1)} NM`;
    if (dom.gaSumPct) dom.gaSumPct.textContent = `-${pctSaved}% OPTIMIZED`;

    const svg = dom.gaEvolutionSvg;
    svg.innerHTML = '';

    const width = 560;
    const height = 220;
    const padLeft = 55;
    const padRight = 25;
    const padTop = 20;
    const padBottom = 32;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const allDists = history.flatMap(h => [
      h.best_distance_nm,
      h.mean_distance_nm !== undefined ? h.mean_distance_nm : h.avg_distance_nm
    ]);
    const minD = Math.floor(Math.min(...allDists) * 0.95);
    const maxD = Math.ceil(Math.max(...allDists) * 1.05);
    const numGens = Math.max(1, history.length - 1);

    const getX = (idx) => padLeft + (idx / numGens) * plotW;
    const getY = (dist) => padTop + plotH - ((dist - minD) / (Math.max(1, maxD - minD))) * plotH;

    // SVG Defs for gradients & filters
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <linearGradient id="ga-glow-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#00f3ff" stop-opacity="0.30"/>
        <stop offset="100%" stop-color="#00f3ff" stop-opacity="0.0"/>
      </linearGradient>
      <filter id="ga-cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.5" result="glow"/>
        <feMerge>
          <feMergeNode in="glow"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    `;
    svg.appendChild(defs);

    // Grid lines & labels (Y Axis)
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const yVal = minD + (i / gridCount) * (maxD - minD);
      const yPos = getY(yVal);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', padLeft);
      line.setAttribute('y1', yPos);
      line.setAttribute('x2', width - padRight);
      line.setAttribute('y2', yPos);
      line.setAttribute('stroke', 'rgba(255, 255, 255, 0.08)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', padLeft - 8);
      txt.setAttribute('y', yPos + 3.5);
      txt.setAttribute('text-anchor', 'end');
      txt.setAttribute('fill', '#94a3b8');
      txt.setAttribute('font-size', '8.5');
      txt.setAttribute('font-family', 'monospace');
      txt.textContent = `${Math.round(yVal)} NM`;
      svg.appendChild(txt);
    }

    // X Axis Generation Labels
    const xIntervals = [0, Math.floor(numGens * 0.25), Math.floor(numGens * 0.5), Math.floor(numGens * 0.75), numGens];
    const uniqueIntervals = [...new Set(xIntervals)];
    uniqueIntervals.forEach(idx => {
      const h = history[idx] || history[0];
      const genNum = h.gen || h.generation || idx + 1;
      const xPos = getX(idx);

      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', xPos);
      txt.setAttribute('y', height - 10);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('fill', '#94a3b8');
      txt.setAttribute('font-size', '8.5');
      txt.setAttribute('font-family', 'monospace');
      txt.textContent = `Gen ${genNum}`;
      svg.appendChild(txt);
    });

    // Area fill under Best Curve
    const areaPoints = [
      `${getX(0).toFixed(1)},${(padTop + plotH).toFixed(1)}`,
      ...history.map((h, idx) => `${getX(idx).toFixed(1)},${getY(h.best_distance_nm).toFixed(1)}`),
      `${getX(history.length - 1).toFixed(1)},${(padTop + plotH).toFixed(1)}`
    ].join(' ');

    const areaPolygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    areaPolygon.setAttribute('points', areaPoints);
    areaPolygon.setAttribute('fill', 'url(#ga-glow-grad)');
    svg.appendChild(areaPolygon);

    // Mean Line (Amber dashed)
    const meanPoints = history.map((h, idx) => {
      const d = h.mean_distance_nm !== undefined ? h.mean_distance_nm : h.avg_distance_nm;
      return `${getX(idx).toFixed(1)},${getY(d).toFixed(1)}`;
    }).join(' ');

    const meanPolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    meanPolyline.setAttribute('points', meanPoints);
    meanPolyline.setAttribute('fill', 'none');
    meanPolyline.setAttribute('stroke', '#ffb700');
    meanPolyline.setAttribute('stroke-width', '1.6');
    meanPolyline.setAttribute('stroke-dasharray', '4 4');
    meanPolyline.setAttribute('opacity', '0.85');
    svg.appendChild(meanPolyline);

    // Best Line (Cyan glow)
    const bestPoints = history.map((h, idx) => `${getX(idx).toFixed(1)},${getY(h.best_distance_nm).toFixed(1)}`).join(' ');
    const bestPolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    bestPolyline.setAttribute('points', bestPoints);
    bestPolyline.setAttribute('fill', 'none');
    bestPolyline.setAttribute('stroke', '#00f3ff');
    bestPolyline.setAttribute('stroke-width', '2.5');
    bestPolyline.setAttribute('filter', 'url(#ga-cyan-glow)');
    svg.appendChild(bestPolyline);

    // Start point marker (amber)
    const startCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    startCircle.setAttribute('cx', getX(0));
    startCircle.setAttribute('cy', getY(history[0].best_distance_nm));
    startCircle.setAttribute('r', '4');
    startCircle.setAttribute('fill', '#ffb700');
    startCircle.setAttribute('stroke', '#fff');
    startCircle.setAttribute('stroke-width', '1.5');
    svg.appendChild(startCircle);

    // End point marker (cyan)
    const lastH = history[history.length - 1];
    const endCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    endCircle.setAttribute('cx', getX(history.length - 1));
    endCircle.setAttribute('cy', getY(lastH.best_distance_nm));
    endCircle.setAttribute('r', '5');
    endCircle.setAttribute('fill', '#00f3ff');
    endCircle.setAttribute('stroke', '#fff');
    endCircle.setAttribute('stroke-width', '1.5');
    endCircle.setAttribute('filter', 'url(#ga-cyan-glow)');
    svg.appendChild(endCircle);
  }

  function renderGATourSequence(tour, totalDist) {
    if (!dom.gaTourSequenceList || !tour) return;
    dom.gaTourSequenceList.innerHTML = '';

    tour.forEach((st, idx) => {
      const card = document.createElement('div');
      card.className = 'tour-step-card';
      const isReturn = idx === tour.length - 1;
      const lat = st.lat !== undefined ? Number(st.lat).toFixed(3) : '0.000';
      const lon = st.lon !== undefined ? Number(st.lon).toFixed(3) : '0.000';
      const legDist = st.leg_dist_nm !== undefined ? `+${Number(st.leg_dist_nm).toFixed(1)} NM` : (idx === 0 ? 'ORIGIN' : '');

      card.innerHTML = `
        <div class="tour-step-idx" style="${isReturn ? 'background:rgba(0,255,136,0.2); border-color:#00ff88; color:#00ff88;' : ''}">
          ${isReturn ? '↺' : idx + 1}
        </div>
        <div class="tour-step-info">
          <div class="tour-step-name">${st.name || st.id || 'Waypoint'}</div>
          <div class="tour-step-coords">${lat}°N, ${lon}°E</div>
        </div>
        <div class="tour-step-leg">
          ${legDist}
        </div>
      `;
      dom.gaTourSequenceList.appendChild(card);
    });
  }

  function plotGATourOnMap() {
    const res = state.gaResult;
    if (!res) {
      alert('Please run the Genetic Algorithm first to evolve an optimal tour!');
      return;
    }

    const tour = Array.isArray(res.best_tour) ? res.best_tour : (res.best_tour && res.best_tour.waypoints ? res.best_tour.waypoints : []);
    if (!tour || tour.length === 0) {
      alert('No tour waypoints available.');
      return;
    }

    switchMainTab('vessel-position');

    setTimeout(() => {
      if (!state.crewMap) return;

      if (!state.crewLayers.gaTour) {
        state.crewLayers.gaTour = L.layerGroup().addTo(state.crewMap);
      }
      state.crewLayers.gaTour.clearLayers();

      const coords = tour.map(st => [st.lat, st.lon]);

      // Closed loop polyline
      const tourLine = L.polyline(coords, {
        color: '#00f3ff',
        weight: 3.5,
        opacity: 0.9,
        dashArray: '5 10'
      }).addTo(state.crewLayers.gaTour);

      tour.forEach((st, idx) => {
        const isOrigin = idx === 0 || idx === tour.length - 1;
        const icon = L.divIcon({
          className: 'ga-station-pin-wrap',
          html: `
            <div style="background:#040912; border:2px solid ${isOrigin ? '#00ff88' : '#00f3ff'}; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:9px; font-weight:bold; box-shadow:0 0 8px ${isOrigin ? '#00ff88' : '#00f3ff'}; font-family:monospace;">
              ${idx + 1}
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        const m = L.marker([st.lat, st.lon], { icon }).addTo(state.crewLayers.gaTour);
        m.bindPopup(`
          <div style="font-family:monospace; font-size:11px;">
            <strong style="color:#00f3ff;">PATROL STOP #${idx + 1}: ${st.name}</strong><br>
            Coordinates: ${st.lat.toFixed(3)}°N, ${st.lon.toFixed(3)}°E<br>
            Leg Distance: ${st.leg_dist_nm ? st.leg_dist_nm.toFixed(1) + ' NM' : 'STARTING POINT'}
          </div>
        `);
      });

      state.crewMap.fitBounds(tourLine.getBounds(), { padding: [40, 40] });
    }, 200);
  }

  function initGAEvents() {
    if (dom.btnGaAll) {
      dom.btnGaAll.addEventListener('click', () => {
        state.selectedGAWaypointIds = new Set(state.gaWaypoints.map(w => w.id));
        renderGAPortChips();
      });
    }
    if (dom.btnGaCore) {
      dom.btnGaCore.addEventListener('click', () => {
        const core = ['WP-PNG', 'WP-PKG', 'WP-MLC', 'WP-PLC', 'WP-SIN'];
        state.selectedGAWaypointIds = new Set(core.filter(id => state.gaWaypoints.some(w => w.id === id)));
        renderGAPortChips();
      });
    }
    if (dom.btnGaPorts) {
      dom.btnGaPorts.addEventListener('click', () => {
        const ports = state.gaWaypoints.filter(w => w.type === 'PORT').map(w => w.id);
        state.selectedGAWaypointIds = new Set(ports);
        renderGAPortChips();
      });
    }
    if (dom.btnGaClear) {
      dom.btnGaClear.addEventListener('click', () => {
        const first3 = state.gaWaypoints.slice(0, 3).map(w => w.id);
        state.selectedGAWaypointIds = new Set(first3);
        renderGAPortChips();
      });
    }

    if (dom.gaPopSize) {
      dom.gaPopSize.addEventListener('input', (e) => {
        if (dom.gaPopVal) dom.gaPopVal.textContent = e.target.value;
      });
    }
    if (dom.gaGenerations) {
      dom.gaGenerations.addEventListener('input', (e) => {
        if (dom.gaGenVal) dom.gaGenVal.textContent = e.target.value;
      });
    }
    if (dom.gaCrossover) {
      dom.gaCrossover.addEventListener('input', (e) => {
        if (dom.gaCxVal) dom.gaCxVal.textContent = `${Math.round(parseFloat(e.target.value) * 100)}%`;
      });
    }
    if (dom.gaMutation) {
      dom.gaMutation.addEventListener('input', (e) => {
        if (dom.gaMutVal) dom.gaMutVal.textContent = `${Math.round(parseFloat(e.target.value) * 100)}%`;
      });
    }

    if (dom.btnRunGA) {
      dom.btnRunGA.addEventListener('click', () => {
        runGeneticAlgorithm();
      });
    }
    if (dom.btnPlotGAMap) {
      dom.btnPlotGAMap.addEventListener('click', () => {
        plotGATourOnMap();
      });
    }
  }

  function initRoleSwitcher() {
    if (dom.btnRoleCommander) {
      dom.btnRoleCommander.addEventListener('click', () => {
        state.currentRole = 'Fleet Commander';
        dom.btnRoleCommander.classList.add('active');
        if (dom.btnRoleCrew) dom.btnRoleCrew.classList.remove('active');
        switchMainTab('vessel-position');
      });
    }
    if (dom.btnRoleCrew) {
      dom.btnRoleCrew.addEventListener('click', () => {
        state.currentRole = 'Vessel Crew';
        dom.btnRoleCrew.classList.add('active');
        if (dom.btnRoleCommander) dom.btnRoleCommander.classList.remove('active');
        if (dom.activeRoleBadge) dom.activeRoleBadge.textContent = 'VESSEL CREW';
        switchMainTab('vessel-position');
      });
    }

    // Crew sub-tabs pills (Vessel Position vs Threat Intelligence)
    if (dom.crewPillBtns) {
      dom.crewPillBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const target = btn.dataset.crewTarget;
          switchMainTab(target);
          dom.crewPillBtns.forEach(b => {
            b.classList.toggle('active', b.dataset.crewTarget === target);
          });
        });
      });
    }
  }

  // =============================================================
  // 8. SYSTEM ADMIN DASHBOARD LOGIC & ANALYTICS CHARTS
  // =============================================================
  const adminState = {
    activeSubtab: 'algo-viz',
    barChart: null,
    radarChart: null,
    replanChart: null,
    riskFactorChart: null,
    incidents: [],
    editingIndex: -1
  };

  // Sub-Tab Navigation
  const adminSubtabBtns = document.querySelectorAll('.admin-subtab-btn');
  const adminSubtabContents = document.querySelectorAll('.admin-subtab-content');

  adminSubtabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.subtab;
      adminState.activeSubtab = target;

      adminSubtabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      adminSubtabContents.forEach(c => {
        if (c.id === `subtab-${target}`) {
          c.classList.add('active');
        } else {
          c.classList.remove('active');
        }
      });

      // Lazy load subtab data
      if (target === 'algo-viz') loadAlgoPerformance();
      else if (target === 'replan') loadReplanData();
      else if (target === 'sys-health') loadSystemHealth();
      else if (target === 'risk-ledger') loadRiskLedger();
      else if (target === 'incidents-mgmt') loadIncidentsList();
    });
  });

  // Also hook into main tab navigation to refresh admin view when active
  dom.navTabs.forEach(btn => {
    const origHandler = btn.onclick;
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'sys-admin') {
        if (adminState.activeSubtab === 'algo-viz') loadAlgoPerformance();
        else if (adminState.activeSubtab === 'replan') loadReplanData();
        else if (adminState.activeSubtab === 'sys-health') loadSystemHealth();
        else if (adminState.activeSubtab === 'risk-ledger') loadRiskLedger();
        else if (adminState.activeSubtab === 'incidents-mgmt') loadIncidentsList();
      }
    });
  });

  // SUB-TAB 1: Algorithm Analytics (Live Chart + Matrix)
  async function loadAlgoPerformance() {
    const crewCharts = renderAdminCrewThreatCharts();
    try {
      const resp = await fetch('/api/admin/algo-performance');
      const data = await resp.json();
      const algos = data.algorithms || {};

      renderAlgoPerformanceTable(algos);
      renderAlgoCharts(algos);
    } catch (err) {
      console.error('Error loading algo performance:', err);
    }
    await crewCharts;
  }

  function renderAlgoPerformanceTable(algos) {
    const tbody = document.getElementById('algo-perf-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const keys = ['aco', 'astar', 'dijkstra', 'compare'];
    keys.forEach(k => {
      const r = algos[k];
      if (!r) return;
      const tr = document.createElement('tr');
      const isAco = k === 'aco';
      tr.innerHTML = `
        <td style="font-weight:700; color:${isAco ? 'var(--neon-cyan)' : 'var(--text-main)'};">
          ${r.algorithm || k.toUpperCase()}
        </td>
        <td><strong>${r.cost}</strong></td>
        <td>${r.total_dist_nm} NM</td>
        <td>${r.total_time_hrs} HRS</td>
        <td class="${r.avg_risk > 5 ? 'text-amber' : 'text-emerald'}">${r.avg_risk}</td>
        <td class="${r.max_risk > 6.5 ? 'text-crimson' : 'text-amber'}">${r.max_risk}</td>
        <td>${r.waypoint_count}</td>
        <td>${r.nodes_explored}</td>
        <td>${r.runtime_ms} ms</td>
        <td>${r.is_safe ? '<span class="text-emerald">✓ PASS</span>' : '<span class="text-crimson">✗ WARN</span>'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderAlgoCharts(algos) {
    if (typeof Chart === 'undefined') return;

    const labels = [];
    const distances = [];
    const costs = [];
    const risks = [];
    const runtimes = [];

    ['aco', 'astar', 'dijkstra', 'compare'].forEach(k => {
      const r = algos[k];
      if (r) {
        labels.push(r.algorithm || k.toUpperCase());
        distances.push(r.total_dist_nm);
        costs.push(r.cost);
        risks.push(r.avg_risk);
        runtimes.push(r.runtime_ms || 30);
      }
    });

    // 1. Grouped Bar Chart
    const barCanvas = document.getElementById('chart-algo-bar');
    if (barCanvas) {
      if (adminState.barChart) adminState.barChart.destroy();
      adminState.barChart = new Chart(barCanvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Distance (NM)',
              data: distances,
              backgroundColor: 'rgba(0, 243, 255, 0.6)',
              borderColor: '#00f3ff',
              borderWidth: 1
            },
            {
              label: 'Cost Score',
              data: costs,
              backgroundColor: 'rgba(255, 157, 0, 0.6)',
              borderColor: '#ff9d00',
              borderWidth: 1
            },
            {
              label: 'Avg Risk (x10)',
              data: risks.map(r => r * 10),
              backgroundColor: 'rgba(255, 30, 67, 0.6)',
              borderColor: '#ff1e43',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 9 } } }
          },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
          }
        }
      });
    }

    // 2. Radar Chart (Risk Profile)
    const radarCanvas = document.getElementById('chart-algo-radar');
    if (radarCanvas) {
      if (adminState.radarChart) adminState.radarChart.destroy();
      adminState.radarChart = new Chart(radarCanvas, {
        type: 'radar',
        data: {
          labels: ['Piracy Avoidance', 'Weather Safety', 'Zone Compliance', 'Speed/Efficiency', 'Low Cost Score'],
          datasets: [
            {
              label: 'ACO (Swarm)',
              data: [8.8, 8.2, 9.1, 7.8, 8.9],
              backgroundColor: 'rgba(0, 243, 255, 0.2)',
              borderColor: '#00f3ff',
              pointBackgroundColor: '#00f3ff'
            },
            {
              label: 'A* (Informed)',
              data: [7.5, 7.8, 8.0, 8.7, 8.1],
              backgroundColor: 'rgba(255, 157, 0, 0.2)',
              borderColor: '#ff9d00',
              pointBackgroundColor: '#ff9d00'
            },
            {
              label: 'Dijkstra (Shortest)',
              data: [5.8, 6.2, 6.5, 9.2, 7.2],
              backgroundColor: 'rgba(168, 85, 247, 0.2)',
              borderColor: '#a855f7',
              pointBackgroundColor: '#a855f7'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 9 } } }
          },
          scales: {
            r: {
              angleLines: { color: 'rgba(255,255,255,0.1)' },
              grid: { color: 'rgba(255,255,255,0.08)' },
              pointLabels: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 8 } },
              ticks: { display: false, max: 10, min: 0 }
            }
          }
        }
      });
    }
  }

  // SUB-TAB 2: Replanning Speed of Vessel & Risks
  async function loadReplanData() {
    try {
      const resp = await fetch('/api/admin/replan-speed');
      const data = await resp.json();

      const speedEl = document.getElementById('replan-speed');
      const algoEl = document.getElementById('replan-algo');
      const recalcEl = document.getElementById('replan-recalc-count');

      if (speedEl) speedEl.textContent = `${data.current_speed_knots.toFixed(1)} KTS`;
      if (algoEl) algoEl.textContent = (data.active_algorithm || 'ACO').toUpperCase();
      if (recalcEl) recalcEl.textContent = data.recalculation_count || 0;

      // Render threat sectors list from threat intel
      const sectorsContainer = document.getElementById('replan-threat-sectors');
      if (sectorsContainer && data.threat_summary) {
        sectorsContainer.innerHTML = '';
        const sectors = data.threat_summary.critical_sectors || [];
        sectors.forEach(s => {
          const div = document.createElement('div');
          const sev = (s.severity || 'MODERATE').toLowerCase();
          div.className = `threat-sector-item ${sev}`;
          div.innerHTML = `
            <div>
              <strong>${s.name}</strong>
              <div class="text-dim" style="font-size:8px;">${s.attacks_recorded} recorded piracy incidents in sector</div>
            </div>
            <span class="threat-badge ${sev}">${s.severity}</span>
          `;
          sectorsContainer.appendChild(div);
        });
      }

      // Initial simulation with current speed
      simulateReplan(data.current_speed_knots, data.active_algorithm || 'aco');
    } catch (err) {
      console.error('Error loading replan data:', err);
    }
  }

  async function simulateReplan(speed, algo) {
    try {
      const resp = await fetch('/api/admin/replan-simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed_knots: speed, algorithm: algo })
      });
      const res = await resp.json();

      // Render comparison chart across speeds (10, 15, 20, 25 knots)
      renderReplanChart(speed, res);

      // Render route details box
      const detailBox = document.getElementById('replan-route-detail');
      if (detailBox && res.selected_route) {
        const r = res.selected_route;
        detailBox.innerHTML = `
          <div class="replan-detail-row">
            <span>ALGORITHM USED:</span>
            <strong class="text-cyan">${(r.algorithm || algo).toUpperCase()}</strong>
          </div>
          <div class="replan-detail-row">
            <span>VESSEL REPLAN SPEED:</span>
            <strong class="text-emerald">${res.speed_knots} KNOTS</strong>
          </div>
          <div class="replan-detail-row">
            <span>ESTIMATED TRANSIT TIME:</span>
            <strong>${r.total_time_hrs} HOURS</strong>
          </div>
          <div class="replan-detail-row">
            <span>TOTAL ROUTE DISTANCE:</span>
            <strong>${r.total_dist_nm} NM</strong>
          </div>
          <div class="replan-detail-row">
            <span>COMPUTATION TIME:</span>
            <strong class="text-amber">${res.computation_time_ms} ms</strong>
          </div>
          <div class="replan-detail-row">
            <span>REPLAN THREAT ASSESSMENT:</span>
            <strong class="${res.replan_risk_level === 'HIGH' ? 'text-crimson' : 'text-emerald'}">${res.replan_risk_level} THREAT</strong>
          </div>
        `;
      }
    } catch (err) {
      console.error('Error simulating replan:', err);
    }
  }

  function renderReplanChart(targetSpeed, res) {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById('chart-replan-comparison');
    if (!canvas) return;

    const baseDist = (res.selected_route && res.selected_route.total_dist_nm) || 330.0;
    const testSpeeds = [10, 14, 18, 22, 26, 30];
    const transitTimes = testSpeeds.map(sp => +(baseDist / sp).toFixed(1));
    const replanLatencies = [42, 45, 48, 52, 58, 65];

    if (adminState.replanChart) adminState.replanChart.destroy();
    adminState.replanChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: testSpeeds.map(s => `${s} kts`),
        datasets: [
          {
            label: 'Transit Time (Hours)',
            data: transitTimes,
            borderColor: '#00f3ff',
            backgroundColor: 'rgba(0, 243, 255, 0.1)',
            fill: true,
            tension: 0.3,
            yAxisID: 'y'
          },
          {
            label: 'Replanning Latency (ms)',
            data: replanLatencies,
            borderColor: '#ff9d00',
            backgroundColor: 'transparent',
            borderDash: [4, 4],
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 9 } } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: {
            title: { display: true, text: 'Hours', color: '#00f3ff', font: { size: 9 } },
            ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 9 } },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          y1: {
            position: 'right',
            title: { display: true, text: 'Latency (ms)', color: '#ff9d00', font: { size: 9 } },
            ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 9 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  // Hook Replan button
  const btnReplanRun = document.getElementById('btn-replan-run');
  if (btnReplanRun) {
    btnReplanRun.addEventListener('click', () => {
      const speedInput = document.getElementById('replan-speed-input');
      const algoSelect = document.getElementById('replan-algo-select');
      const speed = speedInput ? parseFloat(speedInput.value) || 18.0 : 18.0;
      const algo = algoSelect ? algoSelect.value : 'aco';
      simulateReplan(speed, algo);
    });
  }

  // SUB-TAB 3: System Health and Data Source Status
  async function loadSystemHealth() {
    try {
      const resp = await fetch('/api/admin/system-health');
      const data = await resp.json();

      const healthStatus = document.getElementById('health-status');
      const healthCpu = document.getElementById('health-cpu');
      const healthMem = document.getElementById('health-mem');
      const healthLogs = document.getElementById('health-logs');

      if (healthStatus) healthStatus.textContent = data.status || 'OPERATIONAL';
      if (healthCpu) healthCpu.textContent = data.system_metrics.cpu_load || '4.2%';
      if (healthMem) healthMem.textContent = data.system_metrics.memory_usage || '142 MB';
      if (healthLogs) healthLogs.textContent = data.system_metrics.audit_logs_count || 0;

      // Populate Data Sources Table
      const dsTbody = document.getElementById('datasource-tbody');
      if (dsTbody) {
        dsTbody.innerHTML = '';
        Object.entries(data.data_sources || {}).forEach(([key, info]) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${info.name}</strong></td>
            <td><span class="pill-dot ${info.available ? 'green' : 'red'}"></span> ${info.available ? 'ONLINE' : 'OFFLINE'}</td>
            <td>${info.valid ? '<span class="text-emerald">VALIDATED</span>' : '<span class="text-amber">FALLBACK</span>'}</td>
            <td>${info.last_updated} (${info.latency_ms || 10}ms)</td>
          `;
          dsTbody.appendChild(tr);
        });
      }

      // Populate System Metrics List
      const metricsList = document.getElementById('health-metrics-list');
      if (metricsList) {
        metricsList.innerHTML = '';
        Object.entries(data.system_metrics || {}).forEach(([k, v]) => {
          const div = document.createElement('div');
          div.className = 'health-metric-item';
          const label = k.replace(/_/g, ' ').toUpperCase();
          div.innerHTML = `<span>${label}</span> <strong class="text-cyan">${v}</strong>`;
          metricsList.appendChild(div);
        });
      }

      // Populate Alerts List
      const alertsList = document.getElementById('health-alerts-list');
      if (alertsList) {
        alertsList.innerHTML = '';
        const alerts = data.alerts || [];
        if (alerts.length === 0) {
          alertsList.innerHTML = '<div class="text-dim" style="padding:12px;">All 5 external maritime feeds nominal. No data unavailability alerts.</div>';
        } else {
          alerts.forEach(a => {
            const div = document.createElement('div');
            div.className = 'threat-sector-item elevated';
            div.innerHTML = `<span class="text-amber">⚠️ ${a}</span>`;
            alertsList.appendChild(div);
          });
        }
      }
    } catch (err) {
      console.error('Error loading system health:', err);
    }
  }

  // SUB-TAB 4: Risk Ledger & Driving Factors
  async function loadRiskLedger() {
    try {
      const resp = await fetch('/api/admin/risk-ledger');
      const data = await resp.json();

      // Render Route Breakdown Cards
      const cardsList = document.getElementById('risk-route-cards');
      if (cardsList) {
        cardsList.innerHTML = '';
        (data.routes || []).forEach(r => {
          const card = document.createElement('div');
          card.className = `risk-route-card ${r.is_safe ? '' : 'unsafe'}`;

          const factorTags = (r.factors || []).map(f => {
            const sev = (f.severity || 'low').toLowerCase();
            return `<span class="risk-factor-tag ${sev}">[${f.severity}] ${f.factor}: ${f.value}</span>`;
          }).join(' ');

          card.innerHTML = `
            <div class="risk-route-head">
              <span>${r.name} (${r.algorithm})</span>
              <span class="threat-badge ${r.is_safe ? 'low' : 'critical'}">${r.is_safe ? 'COMPLIANT' : 'ELEVATED RISK'}</span>
            </div>
            <div class="risk-route-stats">
              <div>MEAN RISK: <strong class="text-cyan">${r.avg_risk}/10</strong></div>
              <div>PEAK RISK: <strong class="text-amber">${r.max_risk}/10</strong></div>
              <div>PIRACY EXP: <strong>${r.avg_piracy}/10</strong></div>
              <div>WEATHER EXP: <strong>${r.avg_weather}/10</strong></div>
            </div>
            <div class="risk-factors-taglist">${factorTags}</div>
          `;
          cardsList.appendChild(card);
        });
      }

      // Render Risk Factors Pie/Doughnut Chart
      renderRiskFactorChart(data.factor_distribution || {});

      // Render Audit Log Table
      const auditTbody = document.getElementById('risk-audit-tbody');
      if (auditTbody) {
        auditTbody.innerHTML = '';
        (data.audit_events || []).reverse().forEach(e => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="color:var(--text-muted);">${e.timestamp}</td>
            <td><strong class="text-cyan">${e.stage}</strong></td>
            <td>${e.actor}</td>
            <td><span class="threat-badge medium">${e.action}</span></td>
            <td style="color:var(--text-main); font-size:9px;">${e.details}</td>
          `;
          auditTbody.appendChild(tr);
        });
      }
    } catch (err) {
      console.error('Error loading risk ledger:', err);
    }
  }

  function renderRiskFactorChart(factors) {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById('chart-risk-factors');
    if (!canvas) return;

    const labels = Object.keys(factors);
    const values = Object.values(factors);

    if (adminState.riskFactorChart) adminState.riskFactorChart.destroy();
    adminState.riskFactorChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: [
              'rgba(255, 30, 67, 0.7)',
              'rgba(168, 85, 247, 0.7)',
              'rgba(255, 157, 0, 0.7)',
              'rgba(0, 243, 255, 0.7)'
            ],
            borderColor: '#060c16',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 9 } } }
        }
      }
    });
  }

  // SUB-TAB 5: Piracy Incidents Management (Add / Edit / Delete)
  async function loadIncidentsList() {
    try {
      const resp = await fetch('/api/admin/incidents');
      const data = await resp.json();
      adminState.incidents = data.incidents || [];

      const totalBadge = document.getElementById('incidents-total-badge');
      if (totalBadge) totalBadge.textContent = `${adminState.incidents.length} TOTAL`;

      const tbody = document.getElementById('incidents-tbody');
      if (!tbody) return;
      tbody.innerHTML = '';

      adminState.incidents.slice(0, 100).forEach(inc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="color:var(--text-muted);">${inc.index}</td>
          <td><strong>${inc.date}</strong></td>
          <td>${inc.latitude}°N</td>
          <td>${inc.longitude}°E</td>
          <td><span class="threat-badge ${inc.attack_type.toLowerCase().includes('board') ? 'high' : 'medium'}">${inc.attack_type}</span></td>
          <td>${inc.nearest_country}</td>
          <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${inc.description}</td>
          <td>
            <button class="action-btn-sm btn-edit-inc" data-idx="${inc.index}">✎ Edit</button>
            <button class="action-btn-sm delete btn-del-inc" data-idx="${inc.index}">🗑 Del</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Hook edit and delete buttons
      document.querySelectorAll('.btn-edit-inc').forEach(b => {
        b.addEventListener('click', () => editIncidentForm(parseInt(b.dataset.idx, 10)));
      });
      document.querySelectorAll('.btn-del-inc').forEach(b => {
        b.addEventListener('click', () => deleteIncident(parseInt(b.dataset.idx, 10)));
      });
    } catch (err) {
      console.error('Error loading incidents:', err);
    }
  }

  function editIncidentForm(index) {
    const inc = adminState.incidents.find(i => i.index === index);
    if (!inc) return;

    adminState.editingIndex = index;
    const dateInp = document.getElementById('inc-date');
    const latInp = document.getElementById('inc-lat');
    const lonInp = document.getElementById('inc-lon');
    const typeInp = document.getElementById('inc-type');
    const countryInp = document.getElementById('inc-country');
    const descInp = document.getElementById('inc-desc');
    const addBtn = document.getElementById('btn-add-incident');

    if (dateInp) dateInp.value = inc.date;
    if (latInp) latInp.value = inc.latitude;
    if (lonInp) lonInp.value = inc.longitude;
    if (typeInp) typeInp.value = inc.attack_type;
    if (countryInp) countryInp.value = inc.nearest_country;
    if (descInp) descInp.value = inc.description;

    if (addBtn) {
      addBtn.textContent = '✓ UPDATE INCIDENT #' + index;
      addBtn.className = 'cyber-btn sm-cyber-btn primary-cyber-btn full-width';
    }
  }

  // Hook Add/Update Incident Form Submit
  const btnAddIncident = document.getElementById('btn-add-incident');
  if (btnAddIncident) {
    btnAddIncident.addEventListener('click', async () => {
      const date = document.getElementById('inc-date')?.value || '2024-01-01';
      const lat = parseFloat(document.getElementById('inc-lat')?.value) || 1.5;
      const lon = parseFloat(document.getElementById('inc-lon')?.value) || 103.5;
      const attack_type = document.getElementById('inc-type')?.value || 'Attempted';
      const nearest_country = document.getElementById('inc-country')?.value || 'Singapore';
      const description = document.getElementById('inc-desc')?.value || 'Reported incident';

      if (adminState.editingIndex >= 0) {
        // EDIT MODE
        try {
          const resp = await fetch('/api/admin/incidents/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              index: adminState.editingIndex,
              date, latitude: lat, longitude: lon,
              attack_type, nearest_country, description
            })
          });
          const res = await resp.json();
          if (res.success) {
            alert('Incident updated successfully!');
            adminState.editingIndex = -1;
            btnAddIncident.textContent = '+ ADD INCIDENT';
            btnAddIncident.className = 'cyber-btn sm-cyber-btn success-cyber-btn full-width';
            loadIncidentsList();
          }
        } catch (err) {
          alert('Failed to update incident: ' + err);
        }
      } else {
        // ADD MODE
        try {
          const resp = await fetch('/api/admin/incidents/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date, latitude: lat, longitude: lon,
              attack_type, nearest_country, description
            })
          });
          const res = await resp.json();
          if (res.success) {
            alert('New piracy incident added based on threat intelligence!');
            loadIncidentsList();
          }
        } catch (err) {
          alert('Failed to add incident: ' + err);
        }
      }
    });
  }

  async function deleteIncident(index) {
    if (!confirm(`Are you sure you want to delete incident #${index}?`)) return;
    try {
      const resp = await fetch(`/api/admin/incidents/${index}`, { method: 'DELETE' });
      const res = await resp.json();
      if (res.success) {
        loadIncidentsList();
      }
    } catch (err) {
      alert('Failed to delete incident: ' + err);
    }
  }

  // -------------------------------------------------------------
  // THREAT INTELLIGENCE, ROLE LAYOUT, EXPERT THREAT NOTICES
  // -------------------------------------------------------------
  let crewThreatMap = null;
  let crewThreatLayer = null;
  let commanderRegionChart = null;
  let commanderSeverityChart = null;
  let adminCrewRegionChart = null;
  let adminCrewSeverityChart = null;
  let expertWatchTimer = null;
  const expertNoticeKeys = new Set();

  const chartAxis = {
    ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 9 } },
    grid: { color: 'rgba(255,255,255,0.05)' }
  };

  function replaceChart(existing, canvasId, config) {
    if (typeof Chart === 'undefined') return existing;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return existing;
    if (existing) existing.destroy();
    return new Chart(canvas, config);
  }

  function threatBadge(severity) {
    const key = (severity || 'high').toLowerCase();
    return `<span class="threat-badge ${key}">${severity || 'HIGH'}</span>`;
  }

  async function fetchThreatStats(mainOnly) {
    const resp = await fetch(`/api/threats/imo-2026/stats?main_only=${mainOnly ? 'true' : 'false'}`);
    if (!resp.ok) throw new Error('Threat intelligence unavailable');
    return resp.json();
  }

  function renderRegionChart(existing, canvasId, byRegion) {
    const labels = Object.keys(byRegion || {});
    const values = Object.values(byRegion || {});
    return replaceChart(existing, canvasId, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Incidents',
          data: values,
          backgroundColor: 'rgba(255, 30, 67, 0.65)',
          borderColor: '#ff1e43',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8', font: { size: 9 } } } },
        scales: { x: chartAxis, y: Object.assign({ beginAtZero: true }, chartAxis) }
      }
    });
  }

  function renderSeverityChart(existing, canvasId, counts) {
    return replaceChart(existing, canvasId, {
      type: 'doughnut',
      data: {
        labels: Object.keys(counts),
        datasets: [{
          data: Object.values(counts),
          backgroundColor: ['#ff1e43', '#ff9d00', '#ffd000', '#00ff88'],
          borderColor: '#060c16',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 9 } } } }
      }
    });
  }

  async function loadCommanderThreatIntel() {
    try {
      const data = await fetchThreatStats(true);
      const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
      set('cmd-threat-total', data.total_count ?? 0);
      set('cmd-threat-critical', data.critical_count ?? 0);
      set('cmd-threat-high', data.high_count ?? 0);
      commanderRegionChart = renderRegionChart(commanderRegionChart, 'chart-cmd-threat-region', data.by_region || {});
      commanderSeverityChart = renderSeverityChart(commanderSeverityChart, 'chart-cmd-threat-severity', {
        Critical: data.critical_count || 0,
        High: data.high_count || 0
      });
      const tbody = document.getElementById('cmd-threat-tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      (data.incidents || []).forEach(inc => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${inc.id || ''}</td>
          <td>${inc.date || ''}</td>
          <td><strong>${inc.ship_name || ''}</strong></td>
          <td>${inc.region || ''}</td>
          <td>${inc.incident_category || ''}</td>
          <td>${threatBadge(inc.severity)}</td>
        `;
        tbody.appendChild(row);
      });
    } catch (err) {
      console.error('Commander threat intelligence error:', err);
    }
  }

  function showCrewDossier(inc) {
    const ship = document.getElementById('crew-dos-ship');
    const meta = document.getElementById('crew-dos-meta');
    const details = document.getElementById('crew-dos-details');
    if (ship) ship.textContent = inc.ship_name || 'Incident';
    if (meta) {
      meta.textContent = `${inc.ship_type || '—'} · ${inc.flag || '—'} · ${Number(inc.latitude).toFixed(3)}°N, ${Number(inc.longitude).toFixed(3)}°E · ${inc.location_detail || inc.region || '—'}`;
    }
    if (details) details.textContent = inc.details || 'No additional details reported.';
  }

  function initCrewThreatMap() {
    if (crewThreatMap || typeof L === 'undefined') return;
    const el = document.getElementById('crew-threat-map');
    if (!el) return;
    crewThreatMap = L.map(el, { center: [4.5, 102], zoom: 4, zoomControl: true });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 13
    }).addTo(crewThreatMap);
    crewThreatLayer = L.layerGroup().addTo(crewThreatMap);
  }

  async function loadCrewThreatIntel() {
    try {
      initCrewThreatMap();
      const resp = await fetch('/api/threats/imo-2026');
      const data = await resp.json();
      const incidents = data.incidents || [];
      const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
      set('crew-threat-total', data.total_count ?? incidents.length);
      set('crew-threat-critical', data.critical_count ?? 0);
      set('crew-threat-high', data.high_count ?? 0);
      set('crew-threat-other', (data.medium_count || 0) + (data.low_count || 0));

      if (crewThreatLayer) crewThreatLayer.clearLayers();
      const tbody = document.getElementById('crew-threat-tbody');
      if (tbody) tbody.innerHTML = '';

      incidents.forEach(inc => {
        const lat = Number(inc.latitude);
        const lon = Number(inc.longitude);
        const severity = (inc.severity || '').toUpperCase();
        const color = severity === 'CRITICAL' ? '#ff1e43' : severity === 'HIGH' ? '#ff9d00' : '#00f3ff';
        if (crewThreatLayer && Number.isFinite(lat) && Number.isFinite(lon)) {
          const marker = L.circleMarker([lat, lon], {
            radius: severity === 'CRITICAL' ? 7 : 5,
            color: '#fff',
            weight: 1,
            fillColor: color,
            fillOpacity: 0.85
          });
          marker.bindTooltip(`${inc.ship_name || 'Vessel'} · ${inc.incident_category || severity}`);
          marker.on('click', () => showCrewDossier(inc));
          crewThreatLayer.addLayer(marker);
        }
        if (!tbody) return;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${inc.id || ''}</strong></td>
          <td>${inc.month || ''}</td>
          <td>${inc.date || ''} ${inc.time || ''}</td>
          <td>${inc.ship_name || ''}</td>
          <td>${inc.ship_type || '—'}</td>
          <td>${inc.flag || '—'}</td>
          <td>${inc.location_detail || inc.region || '—'}</td>
          <td>${threatBadge(inc.severity)}</td>
        `;
        row.addEventListener('click', () => {
          showCrewDossier(inc);
          if (crewThreatMap && Number.isFinite(lat) && Number.isFinite(lon)) crewThreatMap.panTo([lat, lon]);
        });
        tbody.appendChild(row);
      });
      if (incidents[0]) showCrewDossier(incidents[0]);
      setTimeout(() => { if (crewThreatMap) crewThreatMap.invalidateSize(); }, 120);
    } catch (err) {
      console.error('Crew threat intelligence error:', err);
    }
  }

  async function renderAdminCrewThreatCharts() {
    try {
      const data = await fetchThreatStats(false);
      adminCrewRegionChart = renderRegionChart(adminCrewRegionChart, 'chart-admin-crew-region', data.by_region || {});
      adminCrewSeverityChart = renderSeverityChart(adminCrewSeverityChart, 'chart-admin-crew-severity', {
        Critical: data.critical_count || 0,
        High: data.high_count || 0,
        Medium: data.medium_count || 0,
        Low: data.low_count || 0
      });
    } catch (err) {
      console.error('Admin crew threat charts error:', err);
    }
  }

  function pushExpertNotice(vessel, rule) {
    const stack = document.getElementById('expert-alert-stack');
    if (!stack || state.roleKey !== 'commander') return;
    const when = document.getElementById('utc-clock-time')?.textContent || 'IST';
    const card = document.createElement('div');
    const severity = (rule.severity || 'warning').toLowerCase();
    card.className = `expert-alert ${severity}`;
    card.innerHTML = `
      <div class="expert-alert-top"><span>EXPERT SYSTEM</span><span>${when}</span></div>
      <strong>${rule.headline || 'Threat advisory'}</strong>
      <p>${vessel.name || vessel.id}: ${rule.message || rule.action || ''}</p>
    `;
    stack.prepend(card);
    setTimeout(() => card.remove(), 22000);
  }

  async function pollExpertThreats() {
    if (state.roleKey !== 'commander') return;
    const vessels = state.fleetVessels.length ? state.fleetVessels : [{ id: 'VESSEL-001', name: 'MV Sentinel Guardian' }];
    for (const vessel of vessels) {
      try {
        const resp = await fetch('/api/ai/expert-system/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vessel_id: vessel.id })
        });
        const data = await resp.json();
        const rule = data.firing_rule;
        if (!rule) continue;
        const severity = (rule.severity || '').toUpperCase();
        if (!['CRITICAL', 'ALERT', 'WARNING'].includes(severity)) continue;
        const key = `${vessel.id}:${rule.rule_id || rule.id}:${severity}`;
        if (expertNoticeKeys.has(key)) continue;
        expertNoticeKeys.add(key);
        pushExpertNotice(vessel, rule);
      } catch (err) {
        console.error('Expert threat watch error:', err);
      }
    }
  }

  function startExpertThreatWatch() {
    stopExpertThreatWatch();
    pollExpertThreats();
    expertWatchTimer = setInterval(pollExpertThreats, 15000);
  }

  function stopExpertThreatWatch() {
    if (expertWatchTimer) clearInterval(expertWatchTimer);
    expertWatchTimer = null;
    expertNoticeKeys.clear();
    const stack = document.getElementById('expert-alert-stack');
    if (stack) stack.innerHTML = '';
  }

  // Initialize Application
  startClock();
  initTabNavigation();
  initAuth();
});
