package com.sheguard.models;

public class PoliceOfficer {
    private String id;
    private String uid;
    private String badgeNumber;
    private String name;
    private String email;
    private String department;
    private String rank;
    private String role; // SUPER_ADMIN, POLICE_ADMIN, POLICE_OFFICER, MODERATOR
    private String status = "ACTIVE"; // ACTIVE, ON_DUTY, OFF_DUTY, SUSPENDED
    private int assignedCasesCount = 0;
    private long createdAt;

    public PoliceOfficer() {
        this.createdAt = System.currentTimeMillis();
    }

    public PoliceOfficer(String id, String badgeNumber, String name, String email, String department, String rank, String role) {
        this.id = id;
        this.badgeNumber = badgeNumber;
        this.name = name;
        this.email = email;
        this.department = department;
        this.rank = rank;
        this.role = role;
        this.createdAt = System.currentTimeMillis();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUid() { return uid; }
    public void setUid(String uid) { this.uid = uid; }

    public String getBadgeNumber() { return badgeNumber; }
    public void setBadgeNumber(String badgeNumber) { this.badgeNumber = badgeNumber; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public String getRank() { return rank; }
    public void setRank(String rank) { this.rank = rank; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getAssignedCasesCount() { return assignedCasesCount; }
    public void setAssignedCasesCount(int assignedCasesCount) { this.assignedCasesCount = assignedCasesCount; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }
}
