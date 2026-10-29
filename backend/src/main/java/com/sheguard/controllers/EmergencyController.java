package com.sheguard.controllers;

import com.sheguard.models.EmergencyAlert;
import com.sheguard.models.LocationCoordinates;
import com.sheguard.security.UserPrincipal;
import com.sheguard.services.EmergencyAlertService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/emergency")
public class EmergencyController {

    private final EmergencyAlertService alertService;

    public EmergencyController(EmergencyAlertService alertService) {
        this.alertService = alertService;
    }

    @PostMapping("/alerts")
    public ResponseEntity<EmergencyAlert> triggerAlert(@AuthenticationPrincipal UserPrincipal principal,
                                                       @RequestBody Map<String, Object> body) {
        if (principal == null) return ResponseEntity.status(401).build();

        String type = (String) body.getOrDefault("type", "SOS_EMERGENCY");
        String message = (String) body.getOrDefault("message", "EMERGENCY SOS: I need immediate help.");

        LocationCoordinates location = null;
        if (body.get("location") instanceof Map<?, ?> locMap) {
            Double lat = locMap.get("latitude") instanceof Number ? ((Number) locMap.get("latitude")).doubleValue() : null;
            Double lon = locMap.get("longitude") instanceof Number ? ((Number) locMap.get("longitude")).doubleValue() : null;
            Integer acc = locMap.get("accuracy") instanceof Number ? ((Number) locMap.get("accuracy")).intValue() : null;
            location = new LocationCoordinates(lat, lon, "GPS Point", acc);
        }

        EmergencyAlert alert = alertService.triggerAlert(
                principal.getUid(),
                principal.getUsername(),
                type,
                message,
                location
        );

        return ResponseEntity.ok(alert);
    }

    @GetMapping("/alerts")
    public ResponseEntity<List<EmergencyAlert>> getAlertHistory(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        List<EmergencyAlert> history = alertService.getAlertsForUser(principal.getUid());
        return ResponseEntity.ok(history);
    }
}
