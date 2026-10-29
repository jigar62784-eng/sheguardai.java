package com.sheguard.models;

public class TrustedContact {
    private String id;
    private String userUid;
    private String name;
    private String relationship;
    private String phoneNumber;
    private String email;
    private boolean notifyOnSos = true;
    private long createdAt;

    public TrustedContact() {
        this.createdAt = System.currentTimeMillis();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserUid() { return userUid; }
    public void setUserUid(String userUid) { this.userUid = userUid; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRelationship() { return relationship; }
    public void setRelationship(String relationship) { this.relationship = relationship; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public boolean isNotifyOnSos() { return notifyOnSos; }
    public void setNotifyOnSos(boolean notifyOnSos) { this.notifyOnSos = notifyOnSos; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }
}
