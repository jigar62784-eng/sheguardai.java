package com.sheguard.models;

public class AuditLog {
    private String id;
    private String action;
    private String adminUid;
    private String adminEmail;
    private String targetReference;
    private String details;
    private long timestamp;

    public AuditLog() {
        this.timestamp = System.currentTimeMillis();
    }

    public AuditLog(String action, String adminUid, String adminEmail, String targetReference, String details) {
        this.action = action;
        this.adminUid = adminUid;
        this.adminEmail = adminEmail;
        this.targetReference = targetReference;
        this.details = details;
        this.timestamp = System.currentTimeMillis();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getAdminUid() { return adminUid; }
    public void setAdminUid(String adminUid) { this.adminUid = adminUid; }

    public String getAdminEmail() { return adminEmail; }
    public void setAdminEmail(String adminEmail) { this.adminEmail = adminEmail; }

    public String getTargetReference() { return targetReference; }
    public void setTargetReference(String targetReference) { this.targetReference = targetReference; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
}
