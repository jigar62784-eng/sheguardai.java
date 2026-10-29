package com.sheguard.services;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.sheguard.models.IncidentReport;
import com.sheguard.models.LocationCoordinates;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class IncidentReportService {
    private static final Logger log = LoggerFactory.getLogger(IncidentReportService.class);
    private static final String COLLECTION = "reports";

    private final FirebaseService firebaseService;
    // In-memory fallback repository when Firestore credentials have not yet been placed by user
    private final Map<String, IncidentReport> memoryReports = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    public IncidentReportService(FirebaseService firebaseService) {
        this.firebaseService = firebaseService;
    }

    /**
     * Generates a unique tracking reference: SG-YYYYMMDD-XXXX
     */
    public String generateReference() {
        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int randNum = 1000 + random.nextInt(9000);
        return String.format("SG-%s-%d", datePart, randNum);
    }

    /**
     * Creates and saves a new confidential incident report
     */
    public IncidentReport createReport(IncidentReport report, String reporterUid, String reporterEmail) {
        report.setReference(generateReference());
        report.setReporterUid(reporterUid);
        report.setReporterEmail(reporterEmail);
        report.setStatus("SUBMITTED");
        report.setCreatedAt(System.currentTimeMillis());
        report.setUpdatedAt(System.currentTimeMillis());

        // Compute privacy-fuzzed coordinates for public display
        if (report.getLocation() != null && report.getLocation().getLatitude() != null && report.getLocation().getLongitude() != null) {
            double fuzzedLat = report.getLocation().getLatitude() + ((random.nextDouble() - 0.5) * 0.008);
            double fuzzedLon = report.getLocation().getLongitude() + ((random.nextDouble() - 0.5) * 0.008);
            report.setFuzzedLocation(new LocationCoordinates(
                    Math.round(fuzzedLat * 100000.0) / 100000.0,
                    Math.round(fuzzedLon * 100000.0) / 100000.0,
                    "General Area (Privacy-Protected)",
                    null
            ));
        }

        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                db.collection(COLLECTION).document(report.getReference()).set(report).get();
                log.info("[SheGuard Reports] Saved report {} to Cloud Firestore.", report.getReference());
            } catch (Exception e) {
                log.error("[SheGuard Reports] Firestore save failed, using local storage: {}", e.getMessage());
                memoryReports.put(report.getReference(), report);
            }
        } else {
            memoryReports.put(report.getReference(), report);
            log.info("[SheGuard Reports] Stored report {} in local repository (Firestore unconfigured).", report.getReference());
        }

        return report;
    }

    /**
     * Retrieves all reports submitted by a specific user
     */
    public List<IncidentReport> findByReporterUid(String reporterUid) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                List<QueryDocumentSnapshot> docs = db.collection(COLLECTION)
                        .whereEqualTo("reporterUid", reporterUid)
                        .get().get().getDocuments();

                List<IncidentReport> list = new ArrayList<>();
                for (QueryDocumentSnapshot doc : docs) {
                    list.add(doc.toObject(IncidentReport.class));
                }
                list.sort((a, b) -> Long.compare(b.getCreatedAt(), a.getCreatedAt()));
                return list;
            } catch (Exception e) {
                log.warn("[SheGuard Reports] Could not query Firestore: {}", e.getMessage());
            }
        }

        return memoryReports.values().stream()
                .filter(r -> reporterUid.equals(r.getReporterUid()))
                .sorted((a, b) -> Long.compare(b.getCreatedAt(), a.getCreatedAt()))
                .toList();
    }

    /**
     * Retrieves a report by its unique tracking reference
     */
    public Optional<IncidentReport> findByReference(String reference) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                var doc = db.collection(COLLECTION).document(reference).get().get();
                if (doc.exists()) {
                    return Optional.ofNullable(doc.toObject(IncidentReport.class));
                }
            } catch (Exception e) {
                log.warn("[SheGuard Reports] Failed to get doc {}: {}", reference, e.getMessage());
            }
        }
        return Optional.ofNullable(memoryReports.get(reference));
    }

    /**
     * Retrieves public safety map reports (Only verified & eligible, returning fuzzed coordinates)
     */
    public List<IncidentReport> findPublicSafetyReports(String category, Integer daysAgo) {
        long cutoffTime = System.currentTimeMillis() - ((daysAgo != null ? daysAgo : 30) * 86400000L);

        List<IncidentReport> all = getAllReports();
        List<IncidentReport> sanitized = new ArrayList<>();

        for (IncidentReport r : all) {
            // Must be eligible for public display and verified or under review
            if (r.isPublicSafeDisplayEligible() && r.getCreatedAt() >= cutoffTime) {
                if (category != null && !category.equalsIgnoreCase("all") && !category.equalsIgnoreCase(r.getCategory())) {
                    continue;
                }

                // Create privacy-sanitized clone
                IncidentReport safeCopy = new IncidentReport();
                safeCopy.setReference(r.getReference());
                safeCopy.setCategory(r.getCategory());
                safeCopy.setIncidentDate(r.incidentDate);
                safeCopy.setIncidentTime(r.incidentTime);
                safeCopy.setDescription(r.getDescription());
                safeCopy.setStatus(r.getStatus());
                // Strictly use fuzzed location, never precise coordinates
                safeCopy.setLocation(r.getFuzzedLocation() != null ? r.getFuzzedLocation() : r.getLocation());
                sanitized.add(safeCopy);
            }
        }

        return sanitized;
    }

    /**
     * Updates verification status by an authorized admin/moderator
     */
    public IncidentReport updateStatus(String reference, String status, String reviewNotes, String adminEmail) {
        Optional<IncidentReport> opt = findByReference(reference);
        if (opt.isEmpty()) {
            throw new IllegalArgumentException("Report reference not found: " + reference);
        }

        IncidentReport report = opt.get();
        report.setStatus(status.toUpperCase());
        report.setReviewNotes(reviewNotes);
        report.setReviewedBy(adminEmail);
        report.setUpdatedAt(System.currentTimeMillis());

        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                db.collection(COLLECTION).document(reference).set(report).get();
            } catch (Exception e) {
                log.error("[SheGuard Reports] Firestore update failed: {}", e.getMessage());
                memoryReports.put(reference, report);
            }
        } else {
            memoryReports.put(reference, report);
        }

        return report;
    }

    public List<IncidentReport> getAllReports() {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                List<QueryDocumentSnapshot> docs = db.collection(COLLECTION).get().get().getDocuments();
                List<IncidentReport> list = new ArrayList<>();
                for (QueryDocumentSnapshot doc : docs) {
                    list.add(doc.toObject(IncidentReport.class));
                }
                list.sort((a, b) -> Long.compare(b.getCreatedAt(), a.getCreatedAt()));
                return list;
            } catch (Exception e) {
                log.warn("[SheGuard Reports] Firestore list error: {}", e.getMessage());
            }
        }
        return new ArrayList<>(memoryReports.values());
    }
}
