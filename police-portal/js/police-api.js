/**
 * SheGuard Police Portal - Dedicated Law-Enforcement API & Firestore Bridge
 * Architecture: FRONTEND 2 (Police / Admin Application)
 * 
 * Synchronizes with the SAME Firebase Project & Spring Boot Backend as the User Portal.
 */

import { firebaseConfig } from '../../js/firebase-config.js';

// Try loading Firebase Modular SDK or Compat SDK
let db = null;
let auth = null;

try {
  if (typeof window !== 'undefined' && window.firebase) {
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }
    db = window.firebase.firestore();
    auth = window.firebase.auth();
  }
} catch (e) {
  console.warn('[Police API] Firebase SDK initialization notice:', e.message);
}

const BACKEND_BASE_URL = (typeof window !== 'undefined' && window.SHEGUARD_API_URL) ? window.SHEGUARD_API_URL : 'http://localhost:8080/api';

class PoliceApiClient {
  constructor() {
    this.baseUrl = BACKEND_BASE_URL.replace(/\/$/, '');
  }

  /**
   * Helper to fetch authenticated Firebase Bearer token
   */
  async getAuthHeader() {
    if (auth && auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        return { 'Authorization': `Bearer ${token}` };
      } catch (e) {
        console.warn('[Police API] Failed to acquire ID token:', e);
      }
    }
    return {};
  }

  /**
   * Dispatches REST request with fallback handling
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const authHeaders = await this.getAuthHeader();

    const headers = {
      'Accept': 'application/json',
      ...authHeaders,
      ...options.headers
    };

    if (!(options.body instanceof FormData) && options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 8000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.status === 204) return null;

      const contentType = response.headers.get('content-type') || '';
      let data = null;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const msg = (data && data.message) || `Police API HTTP ${response.status}`;
        throw new Error(msg);
      }
      return data;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  // ==========================================
  // INCIDENT REPORTS (SHARED FIRESTORE / REST)
  // ==========================================

  /**
   * Fetch all reports from Spring Boot or directly from Firestore collection 'reports'
   */
  async getReports(filters = {}) {
    // 1. Try Spring Boot REST API
    try {
      const queryParams = new URLSearchParams();
      if (filters.status && filters.status !== 'ALL') queryParams.set('status', filters.status);
      if (filters.category && filters.category !== 'ALL') queryParams.set('category', filters.category);
      if (filters.search) queryParams.set('q', filters.search);

      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
      return await this.request(`/admin/reports${qs}`);
    } catch (apiErr) {
      console.warn('[Police API] Backend API offline, connecting directly to shared Cloud Firestore:', apiErr.message);

      // 2. Direct Firestore fallback
      if (db) {
        try {
          const snapshot = await db.collection('reports').get();
          const list = [];
          snapshot.forEach(docSnap => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          return list;
        } catch (dbErr) {
          console.warn('[Police API] Firestore read notice:', dbErr.message);
        }
      }

      // 3. Check localStorage for local reports submitted on this device
      return this.getLocalReportsCache();
    }
  }

  /**
   * Get specific incident details by reference ID
   */
  async getReportByReference(reference) {
    try {
      return await this.request(`/reports/${encodeURIComponent(reference)}`);
    } catch (apiErr) {
      if (db) {
        try {
          const docSnap = await db.collection('reports').doc(reference).get();
          if (docSnap.exists) {
            return { id: docSnap.id, ...docSnap.data() };
          }
        } catch (e) {
          console.warn('[Police API] Firestore getReport error:', e);
        }
      }

      const all = this.getLocalReportsCache();
      const found = all.find(r => r.reference === reference);
      if (found) return found;

      throw new Error(`Report reference ${reference} not found in database.`);
    }
  }

  /**
   * Update report investigation status (Synchronizes across both frontends)
   */
  async updateReportStatus(reference, newStatus, reviewNotes = '', officer = {}) {
    const payload = {
      status: newStatus.toUpperCase(),
      reviewNotes: reviewNotes || `Status updated to ${newStatus} by ${officer.name || 'Police Officer'}.`,
      assignedOfficerId: officer.id || officer.uid || 'OFF-001',
      assignedOfficerName: officer.name || 'Officer',
      updatedAt: Date.now()
    };

    // 1. Try Backend REST API
    try {
      return await this.request(`/admin/reports/${encodeURIComponent(reference)}/status`, {
        method: 'PATCH',
        body: payload
      });
    } catch (apiErr) {
      console.warn('[Police API] Backend unreachable; updating Cloud Firestore directly:', apiErr.message);

      // 2. Direct Firestore update
      if (db) {
        try {
          const reportRef = db.collection('reports').doc(reference);
          await reportRef.set(payload, { merge: true });

          // Also record in audit log
          await this.recordAuditLog({
            action: `STATUS_${newStatus.toUpperCase()}`,
            targetReference: reference,
            officerName: officer.name || 'Police Officer',
            officerBadge: officer.badgeNumber || 'SG-OFF',
            details: payload.reviewNotes
          });

          return { reference, ...payload };
        } catch (dbErr) {
          console.warn('[Police API] Firestore write warning:', dbErr);
        }
      }

      // 3. Update local cache
      const cached = this.getLocalReportsCache();
      const idx = cached.findIndex(r => r.reference === reference);
      if (idx !== -1) {
        cached[idx] = { ...cached[idx], ...payload };
        this.saveLocalReportsCache(cached);
        return cached[idx];
      }

      return { reference, ...payload };
    }
  }

  /**
   * Assign an officer and department to an incident
   */
  async assignOfficer(reference, officerData, notes = '') {
    const payload = {
      assignedOfficerId: officerData.id || officerData.badgeNumber,
      assignedOfficerName: officerData.name,
      assignedDepartment: officerData.department,
      priority: officerData.priority || 'HIGH',
      status: 'ASSIGNED',
      updatedAt: Date.now()
    };

    try {
      return await this.request(`/admin/reports/${encodeURIComponent(reference)}/assign`, {
        method: 'PATCH',
        body: payload
      });
    } catch (e) {
      if (db) {
        try {
          await db.collection('reports').doc(reference).set(payload, { merge: true });
        } catch (err) {}
      }

      const cached = this.getLocalReportsCache();
      const idx = cached.findIndex(r => r.reference === reference);
      if (idx !== -1) {
        cached[idx] = { ...cached[idx], ...payload };
        this.saveLocalReportsCache(cached);
      }
      return { reference, ...payload };
    }
  }

  /**
   * Append chronological investigation note
   */
  async addInvestigationNote(reference, noteText, officer) {
    const noteEntry = {
      id: `NOTE-${Date.now()}`,
      reference,
      officerName: officer.name,
      badgeNumber: officer.badgeNumber,
      note: noteText,
      timestamp: Date.now()
    };

    if (db) {
      try {
        await db.collection('reports').doc(reference).collection('investigation_notes').doc(noteEntry.id).set(noteEntry);
      } catch (e) {
        console.warn('[Police API] Firestore note error:', e);
      }
    }

    // Also persist in local storage history
    const key = `sheguard_notes_${reference}`;
    const notes = JSON.parse(localStorage.getItem(key) || '[]');
    notes.unshift(noteEntry);
    localStorage.setItem(key, JSON.stringify(notes));

    return noteEntry;
  }

  async getInvestigationNotes(reference) {
    const key = `sheguard_notes_${reference}`;
    const local = JSON.parse(localStorage.getItem(key) || '[]');

    if (db) {
      try {
        const snap = await db.collection('reports').doc(reference).collection('investigation_notes').get();
        const remote = [];
        snap.forEach(d => remote.push(d.data()));
        if (remote.length > 0) {
          remote.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          return remote;
        }
      } catch (e) {}
    }

    return local;
  }

  // ==========================================
  // EMERGENCY SOS ALERTS (SHARED DB)
  // ==========================================

  /**
   * Retrieve active and past SOS distress alerts
   */
  async getEmergencyAlerts() {
    try {
      return await this.request('/emergency/alerts');
    } catch (apiErr) {
      if (db) {
        try {
          const snapshot = await db.collection('emergency_alerts').get();
          const list = [];
          snapshot.forEach(docSnap => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          return list;
        } catch (dbErr) {
          console.warn('[Police API] Firestore alerts read warning:', dbErr);
        }
      }

      // Check local SOS records
      const local = JSON.parse(localStorage.getItem('sheguard_police_emergency_alerts') || '[]');
      return local;
    }
  }

  /**
   * Officer acknowledges active emergency alert
   */
  async acknowledgeEmergencyAlert(alertId, officer) {
    const payload = {
      status: 'ACKNOWLEDGED',
      acknowledgedBy: officer.name,
      acknowledgedBadge: officer.badgeNumber,
      acknowledgedAt: Date.now()
    };

    if (db) {
      try {
        await db.collection('emergency_alerts').doc(alertId).set(payload, { merge: true });
      } catch (e) {}
    }

    const local = JSON.parse(localStorage.getItem('sheguard_police_emergency_alerts') || '[]');
    const idx = local.findIndex(a => a.id === alertId);
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...payload };
      localStorage.setItem('sheguard_police_emergency_alerts', JSON.stringify(local));
    }

    return payload;
  }

  /**
   * Officer updates SOS response progress (DISPATCHED, ON_SCENE, RESOLVED)
   */
  async updateEmergencyAlertStatus(alertId, status, notes = '', officer = {}) {
    const payload = {
      status,
      dispatchNotes: notes,
      assignedOfficer: officer.name || 'Response Unit',
      updatedAt: Date.now()
    };

    if (db) {
      try {
        await db.collection('emergency_alerts').doc(alertId).set(payload, { merge: true });
      } catch (e) {}
    }

    const local = JSON.parse(localStorage.getItem('sheguard_police_emergency_alerts') || '[]');
    const idx = local.findIndex(a => a.id === alertId);
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...payload };
      localStorage.setItem('sheguard_police_emergency_alerts', JSON.stringify(local));
    }

    return payload;
  }

  // ==========================================
  // AUDIT LOGS
  // ==========================================

  async getAuditLogs() {
    try {
      return await this.request('/admin/audit-logs');
    } catch (e) {
      if (db) {
        try {
          const snapshot = await db.collection('audit_logs').get();
          const list = [];
          snapshot.forEach(docSnap => list.push(docSnap.data()));
          list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          return list;
        } catch (err) {}
      }
      return JSON.parse(localStorage.getItem('sheguard_police_audit_logs') || '[]');
    }
  }

  async recordAuditLog(logData) {
    const entry = {
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action: logData.action,
      targetReference: logData.targetReference || 'N/A',
      officerName: logData.officerName || 'Police Personnel',
      officerBadge: logData.officerBadge || 'SG-OFF',
      details: logData.details || '',
      timestamp: Date.now()
    };

    if (db) {
      try {
        await db.collection('audit_logs').doc(entry.id).set(entry);
      } catch (e) {}
    }

    const local = JSON.parse(localStorage.getItem('sheguard_police_audit_logs') || '[]');
    local.unshift(entry);
    localStorage.setItem('sheguard_police_audit_logs', JSON.stringify(local.slice(0, 100)));
    return entry;
  }

  // ==========================================
  // LOCAL STORAGE HELPER FALLBACKS
  // ==========================================

  getLocalReportsCache() {
    // Collect any reports stored in user portal storage or police cache
    const combined = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sheguard_reports_')) {
          const items = JSON.parse(localStorage.getItem(key) || '[]');
          items.forEach(item => {
            if (!combined.some(r => r.reference === item.reference)) {
              combined.push(item);
            }
          });
        }
      }
    } catch (e) {}

    // Add baseline realistic demonstration records if database is fresh
    if (combined.length === 0) {
      const baseline = this.getBaselineDemonstrationReports();
      return baseline;
    }
    return combined;
  }

  saveLocalReportsCache(reports) {
    try {
      localStorage.setItem('sheguard_police_cached_reports', JSON.stringify(reports));
    } catch (e) {}
  }

  getBaselineDemonstrationReports() {
    return [
      {
        reference: 'SG-20261102-4821',
        category: 'stalking',
        incidentDate: '2026-11-02',
        incidentTime: '21:30',
        description: 'Repeatedly followed by two unidentified individuals on a motorcycle from Metro station exit towards residential block.',
        location: { latitude: 28.6139, longitude: 77.2090, address: 'Near Rajiv Chowk Metro Gate 3, Central Precinct' },
        status: 'UNDER_INVESTIGATION',
        assignedOfficerName: 'Inspector Priya Sharma',
        assignedDepartment: 'Women Safety Wing',
        priority: 'HIGH',
        createdAt: Date.now() - 3600000 * 2,
        updatedAt: Date.now() - 1800000
      },
      {
        reference: 'SG-20261102-3109',
        category: 'harassment',
        incidentDate: '2026-11-02',
        incidentTime: '18:45',
        description: 'Verbal harassment and intimidating behavior near bus transit stop.',
        location: { latitude: 28.5355, longitude: 77.3910, address: 'Sector 62 Transit Hub, Noida' },
        status: 'PENDING_VERIFICATION',
        priority: 'MEDIUM',
        createdAt: Date.now() - 3600000 * 4,
        updatedAt: Date.now() - 3600000 * 4
      },
      {
        reference: 'SG-20261101-9042',
        category: 'cyber_harassment',
        incidentDate: '2026-11-01',
        incidentTime: '14:20',
        description: 'Receiving threatening calls and unsolicited personal image extortion via social media messaging.',
        location: { latitude: 28.7041, longitude: 77.1025, address: 'Cyber Precinct North' },
        status: 'VERIFIED',
        assignedOfficerName: 'Officer Vikram Rao',
        assignedDepartment: 'Cyber Crime Unit 4',
        priority: 'CRITICAL',
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 43200000
      },
      {
        reference: 'SG-20261031-1554',
        category: 'unsafe_location',
        incidentDate: '2026-10-31',
        incidentTime: '23:00',
        description: 'Non-functional streetlights across 400m pedestrian walkway with broken surveillance cameras.',
        location: { latitude: 28.5800, longitude: 77.2300, address: 'Lajpat Nagar Ring Road Underpass' },
        status: 'RESOLVED',
        assignedOfficerName: 'Officer S. Mukherjee',
        assignedDepartment: 'Field Patrol Unit',
        priority: 'LOW',
        createdAt: Date.now() - 86400000 * 2,
        updatedAt: Date.now() - 86400000
      }
    ];
  }
}

export const policeApi = new PoliceApiClient();
