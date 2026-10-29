package com.sheguard.controllers;

import com.sheguard.services.FirebaseService;
import com.sheguard.services.NotificationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final FirebaseService firebaseService;
    private final NotificationService notificationService;

    @Value("${sheguard.routing.osrm-url:https://router.project-osrm.org}")
    private String osrmUrl;

    public HealthController(FirebaseService firebaseService, NotificationService notificationService) {
        this.firebaseService = firebaseService;
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getSystemHealth() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "ONLINE");
        health.put("service", "SheGuard Women Safety Incident Reporting System");
        health.put("timestamp", System.currentTimeMillis());

        Map<String, Object> integrations = new HashMap<>();
        integrations.put("firebaseAdmin", Map.of(
                "configured", firebaseService.isConfigured(),
                "status", firebaseService.getConfigurationStatusMessage()
        ));
        integrations.put("emailAlerts", Map.of(
                "configured", notificationService.isEmailConfigured()
        ));
        integrations.put("smsAlerts", Map.of(
                "configured", notificationService.isTwilioConfigured()
        ));
        integrations.put("routingService", Map.of(
                "configured", true,
                "url", osrmUrl
        ));

        health.put("integrations", integrations);
        return ResponseEntity.ok(health);
    }
}
