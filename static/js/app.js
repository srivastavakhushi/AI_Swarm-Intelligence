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
    activeTab: 'tactical',
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
    selectedContactId: 'KNYAZ-VOLKONSKY',
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
    zonesData: []
  };

  // Tracked Contacts List (Matching Screenshot #1 & #4)
  const TRACKED_CONTACTS = [
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
    
    encryptedMessageLog: document.getElementById('encrypted-message-log'),
    
    aiCommandInput: document.getElementById('ai-command-input'),
    btnSendAiCommand: document.getElementById('btn-send-ai-command'),
    aiChatStream: document.getElementById('ai-command-chat-stream')
  };

  // -------------------------------------------------------------
  // 1. CLOCK & NAVIGATION TAB HANDLERS
  // -------------------------------------------------------------
  function formatIST(now) {
    // IST is a fixed UTC+5:30 offset (Asia/Kolkata, no daylight saving).
    const shifted = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
    const hours = String(shifted.getUTCHours()).padStart(2, '0');
    const mins = String(shifted.getUTCMinutes()).padStart(2, '0');
    const secs = String(shifted.getUTCSeconds()).padStart(2, '0');
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    return {
      timeStr: `${hours}:${mins}:${secs} IST`,
      dateStr: `${year}-${month}-${day} IST`,
      full: `${year}-${month}-${day} ${hours}:${mins}:${secs} IST`
    };
  }

  function startClock() {
    function updateClock() {
      const ist = formatIST(new Date());
      if (dom.utcClockTime) dom.utcClockTime.textContent = ist.timeStr;
      if (dom.utcClockDate) dom.utcClockDate.textContent = ist.dateStr;
      if (dom.loginLiveTime) dom.loginLiveTime.textContent = ist.full;
    }
    updateClock();
    setInterval(updateClock, 1000);
  }

  function initTabNavigation() {
    dom.navTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        state.activeTab = targetTab;

        dom.navTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        dom.tabViews.forEach(view => {
          if (view.id === `view-${targetTab}`) {
            view.classList.add('active');
          } else {
            view.classList.remove('active');
          }
        });

        if (dom.appContainer) {
          dom.appContainer.classList.toggle('commander-home', targetTab === 'tactical');
        }

        if (targetTab === 'tactical' && state.map) {
          setTimeout(() => {
            state.map.invalidateSize();
            fitMalaccaView();
          }, 100);
        }
      });
    });

    initMapOverlays();

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
          dom.activeRoleBadge.textContent = state.currentRole.toUpperCase();

          requestAnimationFrame(() => {
            if (!state.map) {
              initMap();
              loadPorts();
              loadThreats();
              renderContactsList();
              renderThreatIntelCards();
              renderVesselLogTable();
              renderCommsMessages();
              fetchStatus();
            } else {
              state.map.invalidateSize();
            }
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

  // Initialize Application
  startClock();
  initTabNavigation();
  initAuth();
});
