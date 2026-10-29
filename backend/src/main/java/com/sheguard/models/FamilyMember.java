package com.sheguard.models;

public class FamilyMember {
    private String id;
    private String userId;
    private String targetUserId;
    private String email;
    private String displayName;
    private String phoneNumber;
    private String relationship;
    private boolean canViewLocation = true;
    private String sharingStatus = "ACTIVE";
    private long connectedAt;

    public FamilyMember() {
        this.connectedAt = System.currentTimeMillis();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getTargetUserId() { return targetUserId; }
    public void setTargetUserId(String targetUserId) { this.targetUserId = targetUserId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getRelationship() { return relationship; }
    public void setRelationship(String relationship) { this.relationship = relationship; }

    public boolean isCanViewLocation() { return canViewLocation; }
    public void setCanViewLocation(boolean canViewLocation) { this.canViewLocation = canViewLocation; }

    public String getSharingStatus() { return sharingStatus; }
    public void setSharingStatus(String sharingStatus) { this.sharingStatus = sharingStatus; }

    public long getConnectedAt() { return connectedAt; }
    public void setConnectedAt(long connectedAt) { this.connectedAt = connectedAt; }
}
