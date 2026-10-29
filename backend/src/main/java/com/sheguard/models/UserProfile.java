package com.sheguard.models;

import java.util.List;

public class UserProfile {
    private String uid;
    private String email;
    private String displayName;
    private String phoneNumber;
    private String emergencyMedicalNotes;
    private List<String> roles;
    private boolean locationSharingEnabled = true;
    private boolean emailNotificationsEnabled = true;
    private long createdAt;
    private long updatedAt;

    public UserProfile() {}

    public UserProfile(String uid, String email, String displayName, String phoneNumber) {
        this.uid = uid;
        this.email = email;
        this.displayName = displayName;
        this.phoneNumber = phoneNumber;
        this.roles = List.of("USER");
        this.createdAt = System.currentTimeMillis();
        this.updatedAt = System.currentTimeMillis();
    }

    public String getUid() { return uid; }
    public void setUid(String uid) { this.uid = uid; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getEmergencyMedicalNotes() { return emergencyMedicalNotes; }
    public void setEmergencyMedicalNotes(String emergencyMedicalNotes) { this.emergencyMedicalNotes = emergencyMedicalNotes; }

    public List<String> getRoles() { return roles; }
    public void setRoles(List<String> roles) { this.roles = roles; }

    public boolean isLocationSharingEnabled() { return locationSharingEnabled; }
    public void setLocationSharingEnabled(boolean locationSharingEnabled) { this.locationSharingEnabled = locationSharingEnabled; }

    public boolean isEmailNotificationsEnabled() { return emailNotificationsEnabled; }
    public void setEmailNotificationsEnabled(boolean emailNotificationsEnabled) { this.emailNotificationsEnabled = emailNotificationsEnabled; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }

    public long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(long updatedAt) { this.updatedAt = updatedAt; }
}
