package com.sheguard.controllers;

import com.sheguard.models.AuditLog;
import com.sheguard.models.EmergencyAlert;
import com.sheguard.models.IncidentReport;
import com.sheguard.models.PoliceOfficer;
import com.sheguard.security.UserPrincipal;
import com.sheguard.services.AdminService;
import com.sheguard.services.IncidentReportService;
import com.sheguard.services.PoliceService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/police")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'POLICE_ADMIN', 'POLICE_OFFICER', 'MODERATOR')")
public class PoliceController {

    private final PoliceService policeService;
    private final IncidentReportService reportService;
    private final AdminService adminService;

    public PoliceController(PoliceService policeService, IncidentReportService reportService, AdminService adminService) {
        this.policeService = policeService;
        this.reportService = reportService;
        this.adminService = adminService;
    }

    @GetMapping("/dashboard-stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        return ResponseEntity.ok(policeService.getDashboardStats());
    }

    @GetMapping("/reports")
    public ResponseEntity<List<IncidentReport>> getReports(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(policeService.getReports(status, category, search));
    }

    @GetMapping("/reports/{reference}")
    public ResponseEntity<IncidentReport> getReportByReference(@PathVariable String reference) {
        return reportService.findByReference(reference)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/reports/{reference}/status")
    public ResponseEntity<IncidentReport> updateStatus(
            @PathVariable String reference,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal principal) {
        String newStatus = body.getOrDefault("status", "UNDER_INVESTIGATION");
        String notes = body.getOrDefault("reviewNotes", "");
        String officerId = principal != null ? principal.getUid() : "OFF-001";
        String officerName = principal != null ? principal.getName() : "Police Officer";

        IncidentReport updated = policeService.updateStatus(reference, newStatus, notes, officerId, officerName);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/reports/{reference}/assign")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'POLICE_ADMIN')")
    public ResponseEntity<IncidentReport> assignReport(
            @PathVariable String reference,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal principal) {
        String officerId = body.getOrDefault("assignedOfficerId", "OFF-101");
        String officerName = body.getOrDefault("assignedOfficerName", "Officer");
        String department = body.getOrDefault("assignedDepartment", "Women Safety Wing");
        String priority = body.getOrDefault("priority", "HIGH");
        String actorEmail = principal != null ? principal.getUsername() : "police.admin@sheguard";

        IncidentReport assigned = policeService.assignReport(reference, officerId, officerName, department, priority, actorEmail);
        return ResponseEntity.ok(assigned);
    }

    @GetMapping("/emergency/alerts")
    public ResponseEntity<List<EmergencyAlert>> getEmergencyAlerts(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(policeService.getEmergencyAlerts(status));
    }

    @PatchMapping("/emergency/alerts/{id}/acknowledge")
    public ResponseEntity<EmergencyAlert> acknowledgeAlert(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal principal) {
        String officerId = principal != null ? principal.getUid() : "OFF-001";
        String officerName = principal != null ? principal.getName() : "Responding Officer";
        return ResponseEntity.ok(policeService.acknowledgeAlert(id, officerId, officerName));
    }

    @PatchMapping("/emergency/alerts/{id}/status")
    public ResponseEntity<EmergencyAlert> updateAlertStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal principal) {
        String status = body.getOrDefault("status", "DISPATCHED");
        String notes = body.getOrDefault("dispatchNotes", "");
        String officerId = principal != null ? principal.getUid() : "OFF-001";
        String officerName = principal != null ? principal.getName() : "Responding Officer";
        return ResponseEntity.ok(policeService.updateAlertStatus(id, status, notes, officerId, officerName));
    }

    @GetMapping("/officers")
    public ResponseEntity<List<PoliceOfficer>> getOfficers() {
        return ResponseEntity.ok(policeService.getOfficers());
    }

    @PostMapping("/officers")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'POLICE_ADMIN')")
    public ResponseEntity<PoliceOfficer> createOfficer(@RequestBody PoliceOfficer officer) {
        return ResponseEntity.ok(policeService.createOfficer(officer));
    }

    @PatchMapping("/officers/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'POLICE_ADMIN')")
    public ResponseEntity<PoliceOfficer> toggleOfficerStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String status = body.getOrDefault("status", "ACTIVE");
        return ResponseEntity.ok(policeService.toggleOfficerStatus(id, status));
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<List<AuditLog>> getAuditLogs() {
        return ResponseEntity.ok(adminService.getAuditLogs());
    }

    @GetMapping("/analytics")
    public ResponseEntity<Map<String, Object>> getAnalytics() {
        return ResponseEntity.ok(adminService.getAnalytics());
    }
}
