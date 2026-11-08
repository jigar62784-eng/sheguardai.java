package com.sheguard.models;

public class EmergencyAlert {
    private String id;
    private String alertReference;
    private String userUid;
    private String userEmail;
    private String type; // SOS_EMERGENCY, ASSISTANCE_REQUEST
    private String message;
    private LocationCoordinates location;
    private String status = "SENT"; // SENT, ACKNOWLEDGED, DISPATCHED, RESOLVED, CANCELLED
    private String providerStatusSummary;
    private String acknowledgedBy;
    private Long acknowledgedAt;
    private String assignedOfficer;
    private String dispatchNotes;
    private Long resolvedAt;
    private long createdAt;

    public EmergencyAlert() {
        this.createdAt = System.currentTimeMillis();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getAlertReference() { return alertReference; }
    public void setAlertReference(String alertReference) { this.alertReference = alertReference; }

    public String getUserUid() { return userUid; }
    public void setUserUid(String userUid) { this.userUid = userUid; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public LocationCoordinates getLocation() { return location; }
    public void setLocation(LocationCoordinates location) { this.location = location; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getProviderStatusSummary() { return providerStatusSummary; }
    public void setProviderStatusSummary(String providerStatusSummary) { this.providerStatusSummary = providerStatusSummary; }

    public String getAcknowledgedBy() { return acknowledgedBy; }
    public void setAcknowledgedBy(String acknowledgedBy) { this.acknowledgedBy = acknowledgedBy; }

    public Long getAcknowledgedAt() { return acknowledgedAt; }
    public void setAcknowledgedAt(Long acknowledgedAt) { this.acknowledgedAt = acknowledgedAt; }

    public String getAssignedOfficer() { return assignedOfficer; }
    public void setAssignedOfficer(String assignedOfficer) { this.assignedOfficer = assignedOfficer; }

    public String getDispatchNotes() { return dispatchNotes; }
    public void setDispatchNotes(String dispatchNotes) { this.dispatchNotes = dispatchNotes; }

    public Long getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Long resolvedAt) { this.resolvedAt = resolvedAt; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }
}
