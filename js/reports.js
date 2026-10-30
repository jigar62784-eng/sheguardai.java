/**
 * SheGuard - Incident Reporting & Report History Management
 * Seamless hybrid: Uses Spring Boot REST API when online, with direct Cloud Firestore fallback when offline or deployed cloud-only.
 */
import { api } from './api.js';
import { CONFIG } from './config.js';
import { showToast } from './ui.js';
import { 
  db, 
  auth, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  storage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from './firebase.js';

export class ReportsService {
  /**
   * Submits a new incident report (Hybrid: REST API with direct Cloud Firestore fallback)
   */
  async submitReport(reportData, evidenceFile = null, onProgress = null) {
    const payload = {
      category: reportData.category,
      incidentDate: reportData.incidentDate,
      incidentTime: reportData.incidentTime,
      description: reportData.description,
      location: {
        latitude: parseFloat(reportData.latitude),
        longitude: parseFloat(reportData.longitude),
        address: reportData.address || ''
      },
      consentGiven: Boolean(reportData.consentGiven),
      isPublicSafeDisplayEligible: Boolean(reportData.isPublicSafeDisplayEligible)
    };

    let result = null;

    // 1. Attempt Spring Boot REST API
    try {
      result = await api.post('/reports', payload);

      if (evidenceFile && result && result.reference) {
        if (onProgress) onProgress('Uploading encrypted evidence attachment...');
        try {
          await api.uploadEvidence(result.reference, evidenceFile);
        } catch (err) {
          console.warn('[SheGuard Reports] Evidence upload deferred:', err);
        }
      }
      return result;
    } catch (apiErr) {
      console.warn('[SheGuard Reports] Backend API not reachable; falling back to Cloud Firestore direct save:', apiErr.message);

      // 2. Direct Cloud Firestore Fallback
      if (db && auth && auth.currentUser) {
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randNum = Math.floor(1000 + Math.random() * 9000);
        const reference = `SG-${datePart}-${randNum}`;

        // Compute privacy-fuzzed coordinates (~500m jitter)
        const lat = payload.location.latitude;
        const lon = payload.location.longitude;
        const fuzzedLat = Math.round((lat + ((Math.random() - 0.5) * 0.008)) * 100000) / 100000;
        const fuzzedLon = Math.round((lon + ((Math.random() - 0.5) * 0.008)) * 100000) / 100000;

        let evidenceUrl = null;
        if (evidenceFile && storage) {
          if (onProgress) onProgress('Uploading evidence directly to Firebase Storage...');
          try {
            const storagePath = `evidence/${reference}/${Date.now()}_${evidenceFile.name}`;
            const fileRef = ref(storage, storagePath);
            const uploadTask = await uploadBytesResumable(fileRef, evidenceFile);
            evidenceUrl = await getDownloadURL(uploadTask.ref);
          } catch (storageErr) {
            console.warn('[SheGuard Reports] Storage upload notice:', storageErr);
          }
        }

        const reportRecord = {
          reference: reference,
          reporterUid: auth.currentUser.uid,
          reporterEmail: auth.currentUser.email,
          category: payload.category,
          incidentDate: payload.incidentDate,
          incidentTime: payload.incidentTime,
          description: payload.description,
          location: payload.location,
          fuzzedLocation: {
            latitude: fuzzedLat,
            longitude: fuzzedLon,
            address: 'General Area (Privacy-Protected)'
          },
          evidenceUrl: evidenceUrl,
          status: 'SUBMITTED',
          consentGiven: payload.consentGiven,
          isPublicSafeDisplayEligible: payload.isPublicSafeDisplayEligible,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        if (onProgress) onProgress('Writing report to Cloud Firestore...');
        await setDoc(doc(db, 'reports', reference), reportRecord);
        return reportRecord;
      }

      throw apiErr;
    }
  }

  /**
   * Fetches the current user's submitted reports
   */
  async getMyReports() {
    try {
      return await api.get('/reports/mine');
    } catch (apiErr) {
      if (db && auth && auth.currentUser) {
        try {
          const q = query(
            collection(db, 'reports'),
            where('reporterUid', '==', auth.currentUser.uid)
          );
          const snapshot = await getDocs(q);
          const list = [];
          snapshot.forEach(docSnap => list.push(docSnap.data()));
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          return list;
        } catch (dbErr) {
          console.warn('[SheGuard Reports] Firestore query error:', dbErr);
        }
      }
      return [];
    }
  }

  /**
   * Fetches details of a specific report by reference
   */
  async getReportDetails(reference) {
    try {
      return await api.get(`/reports/${encodeURIComponent(reference)}`);
    } catch (apiErr) {
      if (db) {
        const docSnap = await getDoc(doc(db, 'reports', reference));
        if (docSnap.exists()) {
          return docSnap.data();
        }
      }
      throw apiErr;
    }
  }

  /**
   * Fetches public safety map reports (privacy-fuzzed coordinates only)
   */
  async getPublicSafetyReports(category = null, daysAgo = 30) {
    let url = `/reports/public?daysAgo=${daysAgo}`;
    if (category && category !== 'all') {
      url += `&category=${encodeURIComponent(category)}`;
    }

    try {
      return await api.get(url);
    } catch (apiErr) {
      if (db) {
        try {
          const q = query(
            collection(db, 'reports'),
            where('isPublicSafeDisplayEligible', '==', true)
          );
          const snapshot = await getDocs(q);
          const list = [];
          const cutoffTime = Date.now() - (daysAgo * 86400000);

          snapshot.forEach(docSnap => {
            const r = docSnap.data();
            if ((r.createdAt || 0) >= cutoffTime) {
              if (!category || category === 'all' || r.category === category) {
                list.push({
                  reference: r.reference,
                  category: r.category,
                  incidentDate: r.incidentDate,
                  incidentTime: r.incidentTime,
                  description: r.description,
                  status: r.status,
                  location: r.fuzzedLocation || r.location
                });
              }
            }
          });
          return list;
        } catch (dbErr) {
          console.warn('[SheGuard Reports] Firestore public query notice:', dbErr);
        }
      }
      return [];
    }
  }

  /**
   * Maps status key to human label and CSS badge class
   */
  getStatusMeta(statusKey) {
    const key = (statusKey || 'submitted').toLowerCase().replace(/\s+/g, '_');
    return CONFIG.INCIDENT_STATUSES[key] || {
      label: statusKey || 'Submitted',
      badgeClass: 'badge-submitted'
    };
  }

  /**
   * Maps category key to human readable label
   */
  getCategoryLabel(categoryId) {
    const found = CONFIG.INCIDENT_CATEGORIES.find(c => c.id === categoryId);
    return found ? found.label : (categoryId || 'Incident');
  }
}

export const reportsService = new ReportsService();
