package com.sheguard.controllers;

import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.firebase.cloud.StorageClient;
import com.sheguard.models.IncidentReport;
import com.sheguard.security.UserPrincipal;
import com.sheguard.services.FirebaseService;
import com.sheguard.services.IncidentReportService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileOutputStream;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
public class IncidentReportController {

    private final IncidentReportService reportService;
    private final FirebaseService firebaseService;

    public IncidentReportController(IncidentReportService reportService, FirebaseService firebaseService) {
        this.reportService = reportService;
        this.firebaseService = firebaseService;
    }

    @PostMapping
    public ResponseEntity<IncidentReport> submitReport(@AuthenticationPrincipal UserPrincipal principal,
                                                       @RequestBody IncidentReport report) {
        if (principal == null) return ResponseEntity.status(401).build();

        IncidentReport created = reportService.createReport(report, principal.getUid(), principal.getUsername());
        return ResponseEntity.ok(created);
    }

    @GetMapping("/mine")
    public ResponseEntity<List<IncidentReport>> getMyReports(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        List<IncidentReport> reports = reportService.findByReporterUid(principal.getUid());
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/{reference}")
    public ResponseEntity<IncidentReport> getReportByReference(@PathVariable String reference,
                                                               @AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        Optional<IncidentReport> opt = reportService.findByReference(reference);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        IncidentReport report = opt.get();
        // Access check: only reporter or admin can access full details
        boolean isOwner = principal.getUid().equals(report.getReporterUid());
        boolean isAdmin = principal.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (!isOwner && !isAdmin) {
            return ResponseEntity.status(403).build();
        }

        return ResponseEntity.ok(report);
    }

    @PostMapping(value = "/{reference}/evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadEvidence(@PathVariable String reference,
                                                              @RequestParam("file") MultipartFile file,
                                                              @AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        Optional<IncidentReport> opt = reportService.findByReference(reference);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        IncidentReport report = opt.get();
        if (!principal.getUid().equals(report.getReporterUid())) {
            return ResponseEntity.status(403).build();
        }

        String evidenceUrl = "";
        try {
            if (firebaseService.isConfigured() && firebaseService.getStorage() != null) {
                // Upload to Firebase Storage bucket
                StorageClient storage = firebaseService.getStorage();
                String blobPath = "evidence/" + reference + "/" + UUID.randomUUID() + "-" + file.getOriginalFilename();
                storage.bucket().create(blobPath, file.getBytes(), file.getContentType());
                evidenceUrl = "https://storage.googleapis.com/" + storage.bucket().getName() + "/" + blobPath;
            } else {
                // Local dev uploads directory
                File uploadDir = new File("uploads/evidence/" + reference);
                uploadDir.mkdirs();
                File target = new File(uploadDir, file.getOriginalFilename());
                try (FileOutputStream fos = new FileOutputStream(target)) {
                    fos.write(file.getBytes());
                }
                evidenceUrl = "/uploads/evidence/" + reference + "/" + file.getOriginalFilename();
            }

            report.setEvidenceUrl(evidenceUrl);
            report.setUpdatedAt(System.currentTimeMillis());
            reportService.updateStatus(reference, report.getStatus(), report.getReviewNotes(), "Evidence Attached");

            return ResponseEntity.ok(Map.of("status", "SUCCESS", "evidenceUrl", evidenceUrl));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Evidence upload failed: " + e.getMessage()));
        }
    }

    @GetMapping("/public")
    public ResponseEntity<List<IncidentReport>> getPublicSafetyReports(
            @RequestParam(required = false) String category,
            @RequestParam(required = false, defaultValue = "30") Integer daysAgo) {
        List<IncidentReport> publicReports = reportService.findPublicSafetyReports(category, daysAgo);
        return ResponseEntity.ok(publicReports);
    }
}
