package com.sheguard.models;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class IncidentReport {
    private String reference;
    private String reporterUid;
    private String reporterEmail;
    private String category;
    private String incidentDate;
    private String incidentTime;
    private String description;
    private LocationCoordinates location;
    private LocationCoordinates fuzzedLocation; // ~500m fuzzed coordinates for public display
    private String evidenceUrl;
    private String status = "SUBMITTED";
    private String priority = "MEDIUM"; // CRITICAL, HIGH, MEDIUM, LOW
    private boolean consentGiven = false;
    private boolean isPublicSafeDisplayEligible = false;
    private String reviewNotes;
    private String reviewedBy;
    private String assignedOfficerId;
    private String assignedOfficerName;
    private String assignedDepartment;
    private List<Map<String, Object>> timeline = new ArrayList<>();
    private long createdAt;
    private long updatedAt;

    public IncidentReport() {
        this.createdAt = System.currentTimeMillis();
        this.updatedAt = System.currentTimeMillis();
    }

    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }

    public String getReporterUid() { return reporterUid; }
    public void setReporterUid(String reporterUid) { this.reporterUid = reporterUid; }

    public String getReporterEmail() { return reporterEmail; }
    public void setReporterEmail(String reporterEmail) { this.reporterEmail = reporterEmail; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getIncidentDate() { return incidentDate; }
    public void setIncidentDate(String incidentDate) { this.incidentDate = incidentDate; }

    public String getIncidentTime() { return incidentTime; }
    public void setIncidentTime(String incidentTime) { this.incidentTime = incidentTime; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocationCoordinates getLocation() { return location; }
    public void setLocation(LocationCoordinates location) { this.location = location; }

    public LocationCoordinates getFuzzedLocation() { return fuzzedLocation; }
    public void setFuzzedLocation(LocationCoordinates fuzzedLocation) { this.fuzzedLocation = fuzzedLocation; }

    public String getEvidenceUrl() { return evidenceUrl; }
    public void setEvidenceUrl(String evidenceUrl) { this.evidenceUrl = evidenceUrl; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public boolean isConsentGiven() { return consentGiven; }
    public void setConsentGiven(boolean consentGiven) { this.consentGiven = consentGiven; }

    public boolean isPublicSafeDisplayEligible() { return isPublicSafeDisplayEligible; }
    public void setPublicSafeDisplayEligible(boolean publicSafeDisplayEligible) { isPublicSafeDisplayEligible = publicSafeDisplayEligible; }

    public String getReviewNotes() { return reviewNotes; }
    public void setReviewNotes(String reviewNotes) { this.reviewNotes = reviewNotes; }

    public String getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(String reviewedBy) { this.reviewedBy = reviewedBy; }

    public String getAssignedOfficerId() { return assignedOfficerId; }
    public void setAssignedOfficerId(String assignedOfficerId) { this.assignedOfficerId = assignedOfficerId; }

    public String getAssignedOfficerName() { return assignedOfficerName; }
    public void setAssignedOfficerName(String assignedOfficerName) { this.assignedOfficerName = assignedOfficerName; }

    public String getAssignedDepartment() { return assignedDepartment; }
    public void setAssignedDepartment(String assignedDepartment) { this.assignedDepartment = assignedDepartment; }

    public List<Map<String, Object>> getTimeline() { return timeline; }
    public void setTimeline(List<Map<String, Object>> timeline) { this.timeline = timeline; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }

    public long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(long updatedAt) { this.updatedAt = updatedAt; }
}
