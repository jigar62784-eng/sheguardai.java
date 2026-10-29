package com.sheguard.services;

import com.google.cloud.firestore.Firestore;
import com.sheguard.models.AuditLog;
import com.sheguard.models.IncidentReport;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AdminService {
    private static final Logger log = LoggerFactory.getLogger(AdminService.class);
    private static final String AUDIT_COLLECTION = "audit_logs";

    private final FirebaseService firebaseService;
    private final IncidentReportService reportService;
    private final List<AuditLog> memoryAuditLogs = Collections.synchronizedList(new ArrayList<>());

    public AdminService(FirebaseService firebaseService, IncidentReportService reportService) {
        this.firebaseService = firebaseService;
        this.reportService = reportService;
    }

    /**
     * Computes genuine incident analytics across database
     */
    public Map<String, Object> getAnalytics() {
        List<IncidentReport> all = reportService.getAllReports();

        int total = all.size();
        long pending = all.stream().filter(r -> "PENDING_REVIEW".equalsIgnoreCase(r.getStatus()) || "SUBMITTED".equalsIgnoreCase(r.getStatus())).count();
        long verified = all.stream().filter(r -> "VERIFIED".equalsIgnoreCase(r.getStatus())).count();
        long resolved = all.stream().filter(r -> "RESOLVED".equalsIgnoreCase(r.getStatus())).count();
        long rejected = all.stream().filter(r -> "REJECTED".equalsIgnoreCase(r.getStatus())).count();

        Map<String, Integer> byCategory = new HashMap<>();
        for (IncidentReport r : all) {
            String cat = r.getCategory() != null ? r.getCategory() : "other";
            byCategory.put(cat, byCategory.getOrDefault(cat, 0) + 1);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("totalReports", total);
        result.put("pendingReview", pending);
        result.put("verified", verified);
        result.put("resolved", resolved);
        result.put("rejected", rejected);
        result.put("byCategory", byCategory);
        result.put("databaseConnected", firebaseService.isConfigured());

        return result;
    }

    /**
     * Records an administrative action in the audit trail
     */
    public void recordAudit(String action, String adminUid, String adminEmail, String targetReference, String details) {
        AuditLog audit = new AuditLog(action, adminUid, adminEmail, targetReference, details);
        audit.setId(UUID.randomUUID().toString());

        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                db.collection(AUDIT_COLLECTION).document(audit.getId()).set(audit).get();
            } catch (Exception e) {
                memoryAuditLogs.add(0, audit);
            }
        } else {
            memoryAuditLogs.add(0, audit);
        }
    }

    public List<AuditLog> getAuditLogs() {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                var docs = db.collection(AUDIT_COLLECTION).get().get().getDocuments();
                List<AuditLog> list = new ArrayList<>();
                for (var doc : docs) {
                    list.add(doc.toObject(AuditLog.class));
                }
                list.sort((a, b) -> Long.compare(b.getTimestamp(), a.getTimestamp()));
                return list;
            } catch (Exception ignored) {}
        }

        return new ArrayList<>(memoryAuditLogs);
    }
}
