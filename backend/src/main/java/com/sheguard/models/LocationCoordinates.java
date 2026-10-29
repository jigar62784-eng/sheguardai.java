package com.sheguard.models;

public class LocationCoordinates {
    private Double latitude;
    private Double longitude;
    private String address;
    private Integer accuracy;

    public LocationCoordinates() {}

    public LocationCoordinates(Double latitude, Double longitude, String address, Integer accuracy) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.address = address;
        this.accuracy = accuracy;
    }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public Integer getAccuracy() { return accuracy; }
    public void setAccuracy(Integer accuracy) { this.accuracy = accuracy; }
}
