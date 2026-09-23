/**
 * AEGIS Maritime Defense & Pure ACO Route Optimizer
 * Frontend Application Engine (Vanilla JavaScript)
 * Faithfully implements all swimlanes from Experiment 4 Activity Diagram
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  const state = {
    currentRole: 'Fleet Commander',
    currentUser: 'commander',
    currentStep: 1,
    originPort: 'Penang (Malaysia)',
    destPort: 'Singapore (SE Gateway)',
    primaryRoute: null,
    alternateRoute: null,
    selectedRouteType: 'primary',
    isApproved: false,
    vesselStatus: 'MOORED',
    vesselIndex: 0,
    transitTimer: null,
    isAutoTransiting: false,
    map: null,
    layers: {
      piracy: null,
      restricted: null,
      candidates: null,
      primaryRoute: null,
      alternateRoute: null,
      vessel: null,
      ports: null
    },
    portsData: [],
    incidentsData: [],
    zonesData: []
  };

  // -------------------------------------------------------------
  // 1. INITIALIZE LEAFLET MARITIME MAP
  // -------------------------------------------------------------
  function initMap() {
    // Centered over Strait of Malacca
    state.map = L.map('maritime-map', {
      center: [3.2, 100.3],
      zoom: 7,
      minZoom: 5,
      maxZoom: 13,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(state.map);

    // High-performance CartoDB Dark Matter nautical basemap tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CartoDB</a> &copy; OpenStreetMap',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(state.map);

    // Initialize Layer Groups
    state.layers.piracy = L.layerGroup().addTo(state.map);
    state.layers.restricted = L.layerGroup().addTo(state.map);
    state.layers.candidates = L.layerGroup().addTo(state.map);
    state.layers.primaryRoute = L.layerGroup().addTo(state.map);
    state.layers.alternateRoute = L.layerGroup().addTo(state.map);
    state.layers.ports = L.layerGroup().addTo(state.map);
    state.layers.vessel = L.layerGroup().addTo(state.map);

    // Cursor position HUD
    state.map.on('mousemove', (e) => {
      const lat = e.latlng.lat.toFixed(3);
      const lng = e.latlng.lng.toFixed(3);
      const coordsElem = document.getElementById('cursor-coords');
      if (coordsElem) {
        coordsElem.textContent = `CURSOR: ${lat}°N, ${lng}°E`;
      }
    });
  }

  // -------------------------------------------------------------
  // 2. LOAD DATA (PORTS, PIRATE ATTACKS, RESTRICTED ZONES)
  // -------------------------------------------------------------
  async function loadInitialData() {
    try {
      // 1. Fetch Ports
      const portsRes = await fetch('/api/ports');
      const portsJson = await portsRes.json();
      state.portsData = portsJson.ports || [];
      renderPorts(state.portsData);

      // 2. Fetch Threats
      const threatRes = await fetch('/api/threats');
      const threatJson = await threatRes.json();
      state.incidentsData = threatJson.incidents || [];
      state.zonesData = threatJson.restricted_zones || [];
      renderPiracyIncidents(state.incidentsData);
      renderRestrictedZones(state.zonesData);

      // 3. Fetch Status & Logs
      await refreshSystemStatus();
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }

  function renderPorts(ports) {
    state.layers.ports.clearLayers();
    ports.forEach(port => {
      const customIcon = L.divIcon({
        className: 'custom-port-marker',
        html: `<div class="port-marker-box">⚓ ${port.name.split(' ')[0]}</div>`,
        iconSize: [80, 24],
        iconAnchor: [40, 12]
      });

      const marker = L.marker([port.lat, port.lon], { icon: customIcon });
      marker.bindPopup(`<strong>${port.name}</strong><br>Coords: ${port.lat.toFixed(3)}N, ${port.lon.toFixed(3)}E`);
      state.layers.ports.addLayer(marker);
    });
  }

  function renderPiracyIncidents(incidents) {
    state.layers.piracy.clearLayers();
    incidents.forEach(inc => {
      const circle = L.circleMarker([inc.latitude, inc.longitude], {
        radius: 3.5,
        color: '#f43f5e',
        fillColor: '#ff0055',
        fillOpacity: 0.65,
        weight: 1
      });

      circle.bindPopup(`
        <div style="font-family: var(--font-main); font-size: 11px;">
          <strong style="color: #f43f5e;">⚠️ PIRACY INCIDENT</strong><br>
          <strong>Date:</strong> ${inc.date}<br>
          <strong>Type:</strong> ${inc.attack_type}<br>
          <strong>Nearest:</strong> ${inc.nearest_country}<br>
          <strong>Location:</strong> ${inc.description}
        </div>
      `);
      state.layers.piracy.addLayer(circle);
    });
  }

  function renderRestrictedZones(zones) {
    state.layers.restricted.clearLayers();
    zones.forEach(zone => {
      // Radius in degrees to meters (~111,000 meters per degree)
      const radiusMeters = zone.radius_deg * 111000;
      const circle = L.circle(zone.center, {
        radius: radiusMeters,
        color: '#8b5cf6',
        dashArray: '6, 6',
        fillColor: '#8b5cf6',
        fillOpacity: 0.15,
        weight: 2
      });

      circle.bindPopup(`
        <div style="font-family: var(--font-main); font-size: 11px;">
          <strong style="color: #8b5cf6;">RESTRICTED CHOKEPOINT</strong><br>
          <strong>Zone:</strong> ${zone.name}<br>
          <strong>Penalty Weight:</strong> +${zone.penalty}<br>
          <em>${zone.description}</em>
        </div>
      `);
      state.layers.restricted.addLayer(circle);
    });
  }

  // -------------------------------------------------------------
  // 3. SYSTEM STATUS & AUDIT LOGS
  // -------------------------------------------------------------
  async function refreshSystemStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();

      // Update Audit Logs
      const logContainer = document.getElementById('audit-log-container');
      const logCountElem = document.getElementById('log-count');
      if (logCountElem) logCountElem.textContent = data.audit_logs_count || 0;

      if (logContainer && data.recent_logs) {
        logContainer.innerHTML = '';
        data.recent_logs.slice().reverse().forEach(entry => {
          const item = document.createElement('div');
          item.className = 'log-entry';
          item.innerHTML = `
            <div>
              <span class="log-time">[${entry.timestamp.split(' ')[1] || entry.timestamp}]</span>
              <span class="log-actor">${entry.actor}:</span>
              <span class="log-action">${entry.action}</span>
            </div>
            <div class="log-details">${entry.details}</div>
          `;
          logContainer.appendChild(item);
        });
      }

      // Update Vessel Status
      if (data.vessel_info) {
        const v = data.vessel_info;
        state.vesselStatus = v.status;
        const badge = document.getElementById('vessel-status-badge');
        if (badge) badge.textContent = v.status;
        const pos = document.getElementById('vessel-pos');
        if (pos) pos.textContent = `${v.current_lat.toFixed(2)}°N, ${v.current_lon.toFixed(2)}°E`;
        updateVesselMarker(v.current_lat, v.current_lon);
      }
    } catch (err) {
      console.error('Status refresh error:', err);
    }
  }

  // -------------------------------------------------------------
  // 4. SWIMLANE 1: DATA INGESTION & FALLBACK SIMULATION
  // -------------------------------------------------------------
  const btnSimulateFail = document.getElementById('btn-simulate-failure');
  const btnRestoreFail = document.getElementById('btn-restore-failure');
  const btnRefreshData = document.getElementById('btn-refresh-data');
  const alertBanner = document.getElementById('fallback-alert-banner');
  const dotAis = document.getElementById('dot-feed-ais');
  const labelAis = document.getElementById('label-feed-ais');

  if (btnSimulateFail) {
    btnSimulateFail.addEventListener('click', async () => {
      const res = await fetch('/api/data/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulate_failure_source: 'ais_gps_vessels' })
      });
      const data = await res.json();
      dotAis.className = 'feed-status-dot offline';
      labelAis.textContent = 'DROPPED (Using Cache Fallback)';
      labelAis.className = 'feed-metric text-crimson';

      if (data.alerts && data.alerts.length > 0) {
        alertBanner.textContent = data.alerts[0];
        alertBanner.classList.remove('hidden');
      }
      advanceStepper(1);
      await refreshSystemStatus();
    });
  }

  if (btnRestoreFail || btnRefreshData) {
    const restoreHandler = async () => {
      await fetch('/api/data/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      dotAis.className = 'feed-status-dot online';
      labelAis.textContent = 'Live Satellite Link';
      labelAis.className = 'feed-metric text-emerald';
      alertBanner.classList.add('hidden');
      await refreshSystemStatus();
    };

    if (btnRestoreFail) btnRestoreFail.addEventListener('click', restoreHandler);
    if (btnRefreshData) btnRefreshData.addEventListener('click', restoreHandler);
  }

  // -------------------------------------------------------------
  // 5. SWIMLANE 2: ROLE AUTHENTICATION & LOCKOUT TEST
  // -------------------------------------------------------------
  const roleChips = document.querySelectorAll('.role-chip');
  const activeRoleBadge = document.getElementById('active-role-badge');
  const authFeedback = document.getElementById('auth-feedback');
  const btnTestLockout = document.getElementById('btn-test-lockout');
  const btnUnlock = document.getElementById('btn-unlock-account');

  roleChips.forEach(chip => {
    chip.addEventListener('click', async () => {
      roleChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const user = chip.dataset.user;
      const pwd = chip.dataset.pwd;

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pwd })
      });
      const auth = await res.json();

      if (auth.success) {
        state.currentUser = user;
        state.currentRole = auth.role;
        if (activeRoleBadge) activeRoleBadge.textContent = auth.role.toUpperCase();
        if (authFeedback) {
          authFeedback.textContent = `Authenticated: ${auth.role}`;
          authFeedback.className = 'auth-feedback text-emerald';
        }
        advanceStepper(2);
      } else {
        if (authFeedback) {
          authFeedback.textContent = auth.error;
          authFeedback.className = 'auth-feedback text-crimson';
        }
      }
      await refreshSystemStatus();
    });
  });

  if (btnTestLockout) {
    btnTestLockout.addEventListener('click', async () => {
      // Send 3 wrong passwords
      for (let i = 0; i < 3; i++) {
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'commander', password: 'wrong_password_test' })
        });
      }
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'commander', password: 'wrong_password_test' })
      });
      const data = await res.json();
      if (authFeedback) {
        authFeedback.textContent = 'Account Locked: 3 Failed Attempts Recorded.';
        authFeedback.className = 'auth-feedback text-crimson';
      }
      alert('Security Policy Alert (Activity Diagram): User account "commander" has been LOCKED after 3 failed login attempts.');
      await refreshSystemStatus();
    });
  }

  if (btnUnlock) {
    btnUnlock.addEventListener('click', async () => {
      await fetch('/api/auth/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'commander' })
      });
      if (authFeedback) {
        authFeedback.textContent = 'Account "commander" unlocked.';
        authFeedback.className = 'auth-feedback text-cyan';
      }
      await refreshSystemStatus();
    });
  }

  // -------------------------------------------------------------
  // 6. SWIMLANE 3 & 4: THREAT MONITORING & PURE ACO SOLVER
  // -------------------------------------------------------------
  const btnRunACO = document.getElementById('btn-run-aco');
  const acoSpinner = document.getElementById('aco-spinner');
  const acoBtnText = document.getElementById('aco-btn-text');
  const selectOrigin = document.getElementById('select-origin');
  const selectDestination = document.getElementById('select-destination');

  if (btnRunACO) {
    btnRunACO.addEventListener('click', async () => {
      const origin = selectOrigin.value;
      const dest = selectDestination.value;

      if (origin === dest) {
        alert('Origin and destination ports cannot be the same!');
        return;
      }

      const nAnts = parseInt(document.getElementById('param-ants').value);
      const nIter = parseInt(document.getElementById('param-iter').value);

      // UI Loading state
      btnRunACO.disabled = true;
      acoSpinner.classList.remove('hidden');
      acoBtnText.textContent = 'COLONY EXPLORING WATERWAYS...';
      advanceStepper(4);

      try {
        const res = await fetch('/api/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin_port: origin,
            dest_port: dest,
            n_ants: nAnts,
            n_iterations: nIter
          })
        });
        const data = await res.json();

        if (data.success) {
          state.primaryRoute = data.primary_route;
          state.alternateRoute = data.alternate_route;

          // Render Routes on Leaflet Map
          renderAcoRoutes(data.primary_route, data.alternate_route, data.sample_candidates);

          // Update Comparison Cards
          updateRouteComparisonCards(data.primary_route, data.alternate_route);

          // Draw Canvas Convergence Graph
          drawConvergenceChart(data.convergence);

          // Enable Commander Review Action Bar
          enableCommanderActions();
          advanceStepper(5);

          const statusElem = document.getElementById('badge-opt-status');
          if (statusElem) {
            statusElem.textContent = 'Optimal Found';
            statusElem.className = 'badge badge-emerald';
          }
        } else {
          alert('Optimization failed: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('ACO error:', err);
        alert('Failed to run ACO optimizer.');
      } finally {
        btnRunACO.disabled = false;
        acoSpinner.classList.add('hidden');
        acoBtnText.textContent = '⚡ RUN PURE ACO ROUTE OPTIMIZER';
        await refreshSystemStatus();
      }
    });
  }

  function renderAcoRoutes(prim, alt, candidates) {
    // 1. Clear previous paths
    state.layers.candidates.clearLayers();
    state.layers.primaryRoute.clearLayers();
    state.layers.alternateRoute.clearLayers();

    // 2. Render ant candidate paths (translucent cyan)
    if (candidates && candidates.length > 0) {
      candidates.forEach(cand => {
        const poly = L.polyline(cand, {
          color: '#00f0ff',
          weight: 1,
          opacity: 0.18,
          smoothFactor: 1.0
        });
        state.layers.candidates.addLayer(poly);
      });
    }

    // 3. Render Alternate ACO Route (neon emerald dashed line)
    if (alt && alt.geo_coordinates) {
      const altPoly = L.polyline(alt.geo_coordinates, {
        color: '#10b981',
        weight: 3.5,
        opacity: 0.85,
        dashArray: '8, 8',
        smoothFactor: 1.0
      });
      altPoly.bindPopup(`<strong>Alternate Safe ACO Route</strong><br>Distance: ${alt.total_dist_nm} nm<br>Transit: ${alt.total_time_hrs} hrs`);
      state.layers.alternateRoute.addLayer(altPoly);
    }

    // 4. Render Primary ACO Route (electric cyan line with glow)
    if (prim && prim.geo_coordinates) {
      const primPoly = L.polyline(prim.geo_coordinates, {
        color: '#00f0ff',
        weight: 4.5,
        opacity: 0.95,
        smoothFactor: 1.0
      });
      primPoly.bindPopup(`<strong>Primary Safe ACO Route</strong><br>Distance: ${prim.total_dist_nm} nm<br>Transit: ${prim.total_time_hrs} hrs`);
      state.layers.primaryRoute.addLayer(primPoly);

      // Fit map bounds to show route comfortably
      state.map.fitBounds(primPoly.getBounds(), { padding: [40, 40] });
    }
  }

  function updateRouteComparisonCards(prim, alt) {
    if (prim) {
      document.getElementById('prim-cost').textContent = `Cost: ${prim.cost.toFixed(1)}`;
      document.getElementById('prim-dist').textContent = prim.total_dist_nm;
      document.getElementById('prim-time').textContent = prim.total_time_hrs;
      document.getElementById('prim-risk').textContent = prim.avg_risk;
      const peakElem = document.getElementById('prim-peak');
      peakElem.textContent = prim.max_risk;
      peakElem.className = prim.max_risk > 6.5 ? 'metric-val text-crimson' : 'metric-val text-cyan';
    }

    const cardAlt = document.getElementById('card-alternate-route');
    if (alt) {
      cardAlt.style.display = 'block';
      document.getElementById('alt-cost').textContent = `Cost: ${alt.cost.toFixed(1)}`;
      document.getElementById('alt-dist').textContent = alt.total_dist_nm;
      document.getElementById('alt-time').textContent = alt.total_time_hrs;
      document.getElementById('alt-risk').textContent = alt.avg_risk;
      const altPeakElem = document.getElementById('alt-peak');
      altPeakElem.textContent = alt.max_risk;
      altPeakElem.className = alt.max_risk > 6.5 ? 'metric-val text-crimson' : 'metric-val text-emerald';
    } else {
      cardAlt.style.display = 'none';
    }
  }

  // Route card selector (click between primary and alternate)
  const cardPrimary = document.getElementById('card-primary-route');
  const cardAlternate = document.getElementById('card-alternate-route');

  cardPrimary.addEventListener('click', () => {
    cardPrimary.classList.add('active');
    cardAlternate.classList.remove('active');
    state.selectedRouteType = 'primary';
  });

  cardAlternate.addEventListener('click', () => {
    cardAlternate.classList.add('active');
    cardPrimary.classList.remove('active');
    state.selectedRouteType = 'alternate';
  });

  // -------------------------------------------------------------
  // 7. SWIMLANE 5: FLEET COMMANDER REVIEW & DECISION
  // -------------------------------------------------------------
  const btnApprove = document.getElementById('btn-approve-route');
  const btnReject = document.getElementById('btn-reject-route');
  const approvalMsg = document.getElementById('approval-status-message');

  function enableCommanderActions() {
    btnApprove.disabled = false;
    btnReject.disabled = false;
    approvalMsg.textContent = 'Awaiting Fleet Commander review & authorization...';
    approvalMsg.className = 'approval-msg text-amber';
  }

  if (btnApprove) {
    btnApprove.addEventListener('click', async () => {
      const res = await fetch('/api/commander/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'APPROVE',
          selected_route_type: state.selectedRouteType
        })
      });
      const data = await res.json();

      if (data.status === 'APPROVED') {
        state.isApproved = true;
        btnApprove.disabled = true;
        btnReject.disabled = true;
        approvalMsg.textContent = '✓ ROUTE APPROVED BY COMMANDER. Transmitted to Vessel Crew.';
        approvalMsg.className = 'approval-msg text-emerald';

        // Enable Voyage Controls
        document.getElementById('btn-step-voyage').disabled = false;
        document.getElementById('btn-play-voyage').disabled = false;
        document.getElementById('btn-report-deviation').disabled = false;
        advanceStepper(6);
        await refreshSystemStatus();
      }
    });
  }

  if (btnReject) {
    btnReject.addEventListener('click', async () => {
      approvalMsg.textContent = 'Route rejected. Running ACO recalculation with taboo penalties...';
      approvalMsg.className = 'approval-msg text-crimson';
      btnReject.disabled = true;

      const res = await fetch('/api/commander/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'REJECT' })
      });
      const data = await res.json();

      if (data.status === 'RECALCULATED') {
        state.primaryRoute = data.new_route;
        state.alternateRoute = null;
        renderAcoRoutes(data.new_route, null, []);
        updateRouteComparisonCards(data.new_route, null);
        btnReject.disabled = false;
        approvalMsg.textContent = `Route recalculated (Cycle ${data.recalculation_count}). Review updated ACO path.`;
        approvalMsg.className = 'approval-msg text-cyan';
        await refreshSystemStatus();
      }
    });
  }

  // -------------------------------------------------------------
  // 8. SWIMLANE 6: VOYAGE EXECUTION & LIVE TRACKING
  // -------------------------------------------------------------
  const btnStepVoyage = document.getElementById('btn-step-voyage');
  const btnPlayVoyage = document.getElementById('btn-play-voyage');
  const btnReportDev = document.getElementById('btn-report-deviation');
  const btnResetVoyage = document.getElementById('btn-reset-voyage');
  const progressBar = document.getElementById('transit-progress-bar');
  const progressPercent = document.getElementById('vessel-progress');

  function updateVesselMarker(lat, lon) {
    state.layers.vessel.clearLayers();
    const shipIcon = L.divIcon({
      className: 'vessel-marker-container',
      html: `<div class="vessel-marker-icon">▲</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    const marker = L.marker([lat, lon], { icon: shipIcon });
    marker.bindPopup(`<strong>MV Sentinel Guardian</strong><br>Status: ${state.vesselStatus}<br>Pos: ${lat.toFixed(3)}N, ${lon.toFixed(3)}E`);
    state.layers.vessel.addLayer(marker);
  }

  async function stepVoyage() {
    const res = await fetch('/api/voyage/step', { method: 'POST' });
    const data = await res.json();

    if (data.finished) {
      clearInterval(state.transitTimer);
      state.isAutoTransiting = false;
      btnPlayVoyage.textContent = 'Auto Transit ⏯';
      btnStepVoyage.disabled = true;
      btnPlayVoyage.disabled = true;
      btnReportDev.disabled = true;
      progressBar.style.width = '100%';
      progressPercent.textContent = '100% (Completed)';
      advanceStepper(7);
      alert('Voyage Complete! (Activity Diagram): Final position logged and operational records archived.');
    } else if (data.status === 'EN_ROUTE') {
      progressBar.style.width = `${data.progress_percent}%`;
      progressPercent.textContent = `${data.progress_percent}%`;
      document.getElementById('vessel-pos').textContent = `${data.current_lat.toFixed(2)}°N, ${data.current_lon.toFixed(2)}°E`;
      updateVesselMarker(data.current_lat, data.current_lon);
    }
    await refreshSystemStatus();
  }

  if (btnStepVoyage) {
    btnStepVoyage.addEventListener('click', stepVoyage);
  }

  if (btnPlayVoyage) {
    btnPlayVoyage.addEventListener('click', () => {
      if (state.isAutoTransiting) {
        clearInterval(state.transitTimer);
        state.isAutoTransiting = false;
        btnPlayVoyage.textContent = 'Auto Transit ⏯';
      } else {
        state.isAutoTransiting = true;
        btnPlayVoyage.textContent = 'Pause ⏸';
        state.transitTimer = setInterval(stepVoyage, 600);
      }
    });
  }

  if (btnReportDev) {
    btnReportDev.addEventListener('click', async () => {
      const res = await fetch('/api/voyage/deviation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat_offset: 0.12, lon_offset: 0.08 })
      });
      const data = await res.json();
      alert(`Route Deviation Reported by Vessel Crew: Position offset +0.12N, +0.08E applied. System tracking updated.`);
      await refreshSystemStatus();
    });
  }

  if (btnResetVoyage) {
    btnResetVoyage.addEventListener('click', async () => {
      clearInterval(state.transitTimer);
      state.isAutoTransiting = false;
      await fetch('/api/voyage/reset', { method: 'POST' });
      progressBar.style.width = '0%';
      progressPercent.textContent = '0%';
      btnStepVoyage.disabled = true;
      btnPlayVoyage.disabled = true;
      btnReportDev.disabled = true;
      btnApprove.disabled = true;
      btnReject.disabled = true;
      state.isApproved = false;
      advanceStepper(1);
      await refreshSystemStatus();
    });
  }

  // -------------------------------------------------------------
  // 9. OPERATIONAL RECORDS EXPORT
  // -------------------------------------------------------------
  const btnExport = document.getElementById('btn-export-records');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      window.location.href = '/api/records/export';
    });
  }

  // -------------------------------------------------------------
  // 10. STEPPER NAVIGATION HELPER
  // -------------------------------------------------------------
  function advanceStepper(stepNumber) {
    state.currentStep = stepNumber;
    for (let i = 1; i <= 7; i++) {
      const node = document.getElementById(`step-node-${i}`);
      if (node) {
        node.classList.remove('active', 'completed');
        if (i < stepNumber) {
          node.classList.add('completed');
        } else if (i === stepNumber) {
          node.classList.add('active');
        }
      }
    }
  }

  // Stepper node click listener
  for (let i = 1; i <= 7; i++) {
    const node = document.getElementById(`step-node-${i}`);
    if (node) {
      node.addEventListener('click', () => {
        advanceStepper(i);
      });
    }
  }

  // -------------------------------------------------------------
  // 11. TAB SWITCHER
  // -------------------------------------------------------------
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Range slider sync
  ['param-ants', 'param-iter', 'param-alpha', 'param-beta', 'param-evap'].forEach(id => {
    const slider = document.getElementById(id);
    const valElem = document.getElementById(`val-${id}`);
    if (slider && valElem) {
      slider.addEventListener('input', () => {
        valElem.textContent = slider.value;
      });
    }
  });

  // -------------------------------------------------------------
  // 12. CANVAS CONVERGENCE CHART (VANILLA JS HTML5 CANVAS)
  // -------------------------------------------------------------
  function drawConvergenceChart(history) {
    const canvas = document.getElementById('convergenceChart');
    if (!canvas || !history || history.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let y = 30; y < height; y += 35) {
      ctx.beginPath();
      ctx.moveTo(35, y);
      ctx.lineTo(width - 15, y);
      ctx.stroke();
    }

    const iters = history.map(h => h.iteration);
    const bestCosts = history.map(h => h.best_cost || 0);
    const avgCosts = history.map(h => h.avg_cost || 0);

    const minCost = Math.min(...bestCosts.filter(c => c > 0)) * 0.95;
    const maxCost = Math.max(...avgCosts) * 1.05;

    const padLeft = 40;
    const padBottom = 25;
    const padTop = 15;
    const padRight = 15;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    function getX(iter) {
      return padLeft + ((iter - 1) / (iters.length - 1 || 1)) * chartW;
    }

    function getY(cost) {
      return height - padBottom - ((cost - minCost) / (maxCost - minCost || 1)) * chartH;
    }

    // Draw Average Colony Cost (dashed orange)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    history.forEach((h, idx) => {
      const x = getX(h.iteration);
      const y = getY(h.avg_cost);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Best Ant Route Cost (solid cyan with glow)
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([]);
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    history.forEach((h, idx) => {
      const x = getX(h.iteration);
      const y = getY(h.best_cost);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0; // reset glow

    // Axis Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px JetBrains Mono';
    ctx.fillText(`${minCost.toFixed(0)}`, 8, height - padBottom);
    ctx.fillText(`${maxCost.toFixed(0)}`, 8, padTop + 10);
    ctx.fillText('Iter 1', padLeft, height - 8);
    ctx.fillText(`Iter ${iters.length}`, width - 50, height - 8);
  }

  // -------------------------------------------------------------
  // 13. LAYER TOGGLE LISTENERS
  // -------------------------------------------------------------
  const togglePiracy = document.getElementById('toggle-piracy-layer');
  const toggleRestricted = document.getElementById('toggle-restricted-layer');
  const toggleCandidates = document.getElementById('toggle-candidates-layer');

  if (togglePiracy) {
    togglePiracy.addEventListener('change', (e) => {
      if (e.target.checked) state.map.addLayer(state.layers.piracy);
      else state.map.removeLayer(state.layers.piracy);
    });
  }

  if (toggleRestricted) {
    toggleRestricted.addEventListener('change', (e) => {
      if (e.target.checked) state.map.addLayer(state.layers.restricted);
      else state.map.removeLayer(state.layers.restricted);
    });
  }

  if (toggleCandidates) {
    toggleCandidates.addEventListener('change', (e) => {
      if (e.target.checked) state.map.addLayer(state.layers.candidates);
      else state.map.removeLayer(state.layers.candidates);
    });
  }

  // Initialize Map and Data
  initMap();
  loadInitialData();
});
