package com.sheguard.controllers;

import com.sheguard.models.AuditLog;
import com.sheguard.models.IncidentReport;
import com.sheguard.security.UserPrincipal;
import com.sheguard.services.AdminService;
import com.sheguard.services.IncidentReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;
    private final IncidentReportService reportService;

    public AdminController(AdminService adminService, IncidentReportService reportService) {
        this.adminService = adminService;
        this.reportService = reportService;
    }

    @GetMapping("/analytics")
    public ResponseEntity<Map<String, Object>> getAnalytics() {
        Map<String, Object> analytics = adminService.getAnalytics();
        return ResponseEntity.ok(analytics);
    }

    @GetMapping("/reports")
    public ResponseEntity<List<IncidentReport>> getAllReports() {
        List<IncidentReport> reports = reportService.getAllReports();
        return ResponseEntity.ok(reports);
    }

    @PatchMapping("/reports/{reference}/status")
    public ResponseEntity<IncidentReport> updateReportStatus(@PathVariable String reference,
                                                            @RequestBody Map<String, String> body,
                                                            @AuthenticationPrincipal UserPrincipal principal) {
        String newStatus = body.get("status");
        String reviewNotes = body.getOrDefault("reviewNotes", "");
        String adminEmail = principal != null ? principal.getUsername() : "admin@sheguard";

        IncidentReport updated = reportService.updateStatus(reference, newStatus, reviewNotes, adminEmail);

        // Record in audit log
        adminService.recordAudit(
                "STATUS_UPDATE_" + newStatus,
                principal != null ? principal.getUid() : "SYSTEM",
                adminEmail,
                reference,
                "Status set to " + newStatus + (reviewNotes.isBlank() ? "" : ". Notes: " + reviewNotes)
        );

        return ResponseEntity.ok(updated);
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<List<AuditLog>> getAuditLogs() {
        List<AuditLog> logs = adminService.getAuditLogs();
        return ResponseEntity.ok(logs);
    }
}
