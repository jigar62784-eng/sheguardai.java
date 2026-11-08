package com.sheguard.services;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.sheguard.models.AuditLog;
import com.sheguard.models.EmergencyAlert;
import com.sheguard.models.IncidentReport;
import com.sheguard.models.PoliceOfficer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PoliceService {
    private static final Logger log = LoggerFactory.getLogger(PoliceService.class);

    private static final String REPORTS_COLLECTION = "reports";
    private static final String ALERTS_COLLECTION = "emergency_alerts";
    private static final String OFFICERS_COLLECTION = "police_officers";
    private static final String AUDIT_COLLECTION = "audit_logs";

    private final FirebaseService firebaseService;
    private final IncidentReportService reportService;
    private final AdminService adminService;
    private final EmergencyAlertService alertService;

    private final Map<String, PoliceOfficer> memoryOfficers = new ConcurrentHashMap<>();

    public PoliceService(FirebaseService firebaseService,
                         IncidentReportService reportService,
                         AdminService adminService,
                         EmergencyAlertService alertService) {
        this.firebaseService = firebaseService;
        this.reportService = reportService;
        this.adminService = adminService;
        this.alertService = alertService;

        initPreAuthorizedOfficers();
    }

    private void initPreAuthorizedOfficers() {
        PoliceOfficer p1 = new PoliceOfficer("OFF-101", "DL-WSC-042", "Inspector Priya Sharma", "priya.sharma@sheguard.police.gov", "Women Safety Wing (Central Division)", "Police Inspector (PI)", "POLICE_ADMIN");
        PoliceOfficer p2 = new PoliceOfficer("OFF-102", "DL-CCU-089", "Officer Vikram Rao", "vikram.rao@sheguard.police.gov", "Cyber Crime Investigation Cell - Unit 4", "Sub-Inspector (SI)", "POLICE_OFFICER");
        PoliceOfficer p0 = new PoliceOfficer("OFF-100", "IPS-HQ-001", "Commissioner Arvind Verma, IPS", "commissioner@sheguard.police.gov", "State Police Directorate & Public Safety Command", "Commissioner of Police", "SUPER_ADMIN");
        PoliceOfficer p4 = new PoliceOfficer("OFF-104", "DL-MOD-019", "Officer S. Mukherjee", "s.mukherjee@sheguard.police.gov", "Rapid Response Dispatch & Incident Verification", "Assistant Sub-Inspector (ASI)", "MODERATOR");

        memoryOfficers.put(p1.getId(), p1);
        memoryOfficers.put(p2.getId(), p2);
        memoryOfficers.put(p0.getId(), p0);
        memoryOfficers.put(p4.getId(), p4);
    }

    public Map<String, Object> getDashboardStats() {
        List<IncidentReport> all = reportService.getAllReports();
        List<EmergencyAlert> alerts = getEmergencyAlerts(null);

        int total = all.size();
        long newReports = all.stream().filter(r -> "SUBMITTED".equalsIgnoreCase(r.getStatus())).count();
        long pending = all.stream().filter(r -> r.getStatus() != null && r.getStatus().toUpperCase().contains("PENDING")).count();
        long investigating = all.stream().filter(r -> "UNDER_INVESTIGATION".equalsIgnoreCase(r.getStatus()) || "ASSIGNED".equalsIgnoreCase(r.getStatus())).count();
        long verified = all.stream().filter(r -> "VERIFIED".equalsIgnoreCase(r.getStatus())).count();
        long resolved = all.stream().filter(r -> "RESOLVED".equalsIgnoreCase(r.getStatus())).count();
        long activeSos = alerts.stream().filter(a -> "SENT".equalsIgnoreCase(a.getStatus()) || "ACTIVE".equalsIgnoreCase(a.getStatus()) || "PENDING".equalsIgnoreCase(a.getStatus())).count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalIncidents", total);
        stats.put("newReports", newReports);
        stats.put("pendingVerification", pending);
        stats.put("underInvestigation", investigating);
        stats.put("verifiedCases", verified);
        stats.put("resolvedCases", resolved);
        stats.put("activeSosAlerts", activeSos);
        stats.put("databaseConnected", firebaseService.isConfigured());

        return stats;
    }

    public List<IncidentReport> getReports(String status, String category, String search) {
        List<IncidentReport> all = reportService.getAllReports();
        return all.stream().filter(r -> {
            if (status != null && !status.equalsIgnoreCase("ALL") && !status.equalsIgnoreCase(r.getStatus())) return false;
            if (category != null && !category.equalsIgnoreCase("ALL") && !category.equalsIgnoreCase(r.getCategory())) return false;
            if (search != null && !search.isBlank()) {
                String q = search.toLowerCase();
                boolean refM = r.getReference() != null && r.getReference().toLowerCase().contains(q);
                boolean descM = r.getDescription() != null && r.getDescription().toLowerCase().contains(q);
                boolean offM = r.getAssignedOfficerName() != null && r.getAssignedOfficerName().toLowerCase().contains(q);
                if (!refM && !descM && !offM) return false;
            }
            return true;
        }).toList();
    }

    public IncidentReport assignReport(String reference, String officerId, String officerName, String department, String priority, String actorEmail) {
        Optional<IncidentReport> opt = reportService.findByReference(reference);
        if (opt.isEmpty()) throw new IllegalArgumentException("Report reference not found: " + reference);

        IncidentReport r = opt.get();
        r.setAssignedOfficerId(officerId);
        r.setAssignedOfficerName(officerName);
        r.setAssignedDepartment(department);
        r.setPriority(priority != null ? priority : "HIGH");
        r.setStatus("ASSIGNED");
        r.setUpdatedAt(System.currentTimeMillis());

        Map<String, Object> event = new HashMap<>();
        event.put("action", "OFFICER_ASSIGNED");
        event.put("officerName", officerName);
        event.put("timestamp", System.currentTimeMillis());
        event.put("notes", "Assigned to " + officerName + " (" + department + ") with priority " + priority);
        r.getTimeline().add(event);

        saveReport(r);

        adminService.recordAudit("CASE_ASSIGNED", officerId, actorEmail, reference, "Assigned to " + officerName);
        return r;
    }

    public IncidentReport updateStatus(String reference, String newStatus, String notes, String officerId, String officerName) {
        Optional<IncidentReport> opt = reportService.findByReference(reference);
        if (opt.isEmpty()) throw new IllegalArgumentException("Report not found: " + reference);

        IncidentReport r = opt.get();
        String oldStatus = r.getStatus();
        r.setStatus(newStatus.toUpperCase());
        r.setReviewNotes(notes);
        r.setReviewedBy(officerName);
        r.setUpdatedAt(System.currentTimeMillis());

        Map<String, Object> event = new HashMap<>();
        event.put("action", "STATUS_CHANGE");
        event.put("previousStatus", oldStatus);
        event.put("newStatus", newStatus);
        event.put("officerName", officerName);
        event.put("timestamp", System.currentTimeMillis());
        event.put("notes", notes);
        r.getTimeline().add(event);

        saveReport(r);

        adminService.recordAudit("STATUS_UPDATE_" + newStatus, officerId, officerName, reference, "Status transitioned from " + oldStatus + " to " + newStatus + ". Notes: " + notes);
        return r;
    }

    public List<EmergencyAlert> getEmergencyAlerts(String statusFilter) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                List<QueryDocumentSnapshot> docs = db.collection(ALERTS_COLLECTION).get().get().getDocuments();
                List<EmergencyAlert> list = new ArrayList<>();
                for (QueryDocumentSnapshot doc : docs) {
                    list.add(doc.toObject(EmergencyAlert.class));
                }
                list.sort((a, b) -> Long.compare(b.getCreatedAt(), a.getCreatedAt()));
                return list;
            } catch (Exception e) {
                log.warn("[Police Service] Firestore emergency query notice: {}", e.getMessage());
            }
        }
        return Collections.emptyList();
    }

    public EmergencyAlert acknowledgeAlert(String alertId, String officerId, String officerName) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                var docRef = db.collection(ALERTS_COLLECTION).document(alertId);
                var doc = docRef.get().get();
                if (doc.exists()) {
                    EmergencyAlert alert = doc.toObject(EmergencyAlert.class);
                    if (alert != null) {
                        alert.setStatus("ACKNOWLEDGED");
                        alert.setAcknowledgedBy(officerName);
                        alert.setAcknowledgedAt(System.currentTimeMillis());
                        docRef.set(alert).get();
                        adminService.recordAudit("SOS_ACKNOWLEDGED", officerId, officerName, alert.getAlertReference(), "SOS distress signal claimed by " + officerName);
                        return alert;
                    }
                }
            } catch (Exception e) {
                log.error("[Police Service] Acknowledge alert error: {}", e.getMessage());
            }
        }
        EmergencyAlert mock = new EmergencyAlert();
        mock.setId(alertId);
        mock.setStatus("ACKNOWLEDGED");
        mock.setAcknowledgedBy(officerName);
        mock.setAcknowledgedAt(System.currentTimeMillis());
        return mock;
    }

    public EmergencyAlert updateAlertStatus(String alertId, String status, String notes, String officerId, String officerName) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                var docRef = db.collection(ALERTS_COLLECTION).document(alertId);
                var doc = docRef.get().get();
                if (doc.exists()) {
                    EmergencyAlert alert = doc.toObject(EmergencyAlert.class);
                    if (alert != null) {
                        alert.setStatus(status.toUpperCase());
                        alert.setDispatchNotes(notes);
                        alert.setAssignedOfficer(officerName);
                        if ("RESOLVED".equalsIgnoreCase(status)) {
                            alert.setResolvedAt(System.currentTimeMillis());
                        }
                        docRef.set(alert).get();
                        adminService.recordAudit("SOS_STATUS_" + status, officerId, officerName, alert.getAlertReference(), "SOS status updated to " + status + ". Notes: " + notes);
                        return alert;
                    }
                }
            } catch (Exception e) {
                log.error("[Police Service] Update alert status error: {}", e.getMessage());
            }
        }
        EmergencyAlert mock = new EmergencyAlert();
        mock.setId(alertId);
        mock.setStatus(status.toUpperCase());
        mock.setDispatchNotes(notes);
        mock.setAssignedOfficer(officerName);
        return mock;
    }

    public List<PoliceOfficer> getOfficers() {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                List<QueryDocumentSnapshot> docs = db.collection(OFFICERS_COLLECTION).get().get().getDocuments();
                if (!docs.isEmpty()) {
                    List<PoliceOfficer> list = new ArrayList<>();
                    for (QueryDocumentSnapshot doc : docs) {
                        list.add(doc.toObject(PoliceOfficer.class));
                    }
                    return list;
                }
            } catch (Exception ignored) {}
        }
        return new ArrayList<>(memoryOfficers.values());
    }

    public PoliceOfficer createOfficer(PoliceOfficer officer) {
        if (officer.getId() == null) {
            officer.setId("OFF-" + (100 + memoryOfficers.size() + 1));
        }
        officer.setCreatedAt(System.currentTimeMillis());
        memoryOfficers.put(officer.getId(), officer);

        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                db.collection(OFFICERS_COLLECTION).document(officer.getId()).set(officer).get();
            } catch (Exception e) {
                log.warn("[Police Service] Officer Firestore save warning: {}", e.getMessage());
            }
        }
        return officer;
    }

    public PoliceOfficer toggleOfficerStatus(String officerId, String newStatus) {
        PoliceOfficer o = memoryOfficers.get(officerId);
        if (o != null) {
            o.setStatus(newStatus.toUpperCase());
            if (firebaseService.isConfigured()) {
                try {
                    Firestore db = firebaseService.getFirestore();
                    db.collection(OFFICERS_COLLECTION).document(officerId).set(o).get();
                } catch (Exception ignored) {}
            }
        }
        return o;
    }

    private void saveReport(IncidentReport report) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                db.collection(REPORTS_COLLECTION).document(report.getReference()).set(report).get();
            } catch (Exception e) {
                log.warn("[Police Service] Save report error: {}", e.getMessage());
            }
        }
    }
}
