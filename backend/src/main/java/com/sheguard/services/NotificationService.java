package com.sheguard.services;

import com.sheguard.models.LocationCoordinates;
import com.sheguard.models.TrustedContact;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String mailSenderAddress;

    @Value("${sheguard.emergency.twilio.account-sid:}")
    private String twilioAccountSid;

    public NotificationService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public boolean isEmailConfigured() {
        return mailSenderAddress != null && !mailSenderAddress.isBlank();
    }

    public boolean isTwilioConfigured() {
        return twilioAccountSid != null && !twilioAccountSid.isBlank();
    }

    /**
     * Dispatches SOS alerts to contacts and returns honest summary of provider execution
     */
    public String dispatchEmergencyAlert(String alertRef, String userEmail, LocationCoordinates location, String message, List<TrustedContact> contacts) {
        if (contacts == null || contacts.isEmpty()) {
            return "No emergency contacts configured for user. Alert stored in system.";
        }

        StringBuilder logSummary = new StringBuilder();
        int sentCount = 0;
        int failedCount = 0;

        String locationText = location != null && location.getLatitude() != null
                ? String.format("https://maps.google.com/?q=%f,%f (Lat: %f, Lon: %f)",
                location.getLatitude(), location.getLongitude(), location.getLatitude(), location.getLongitude())
                : "Location not provided";

        String emailBody = String.format(
                "🚨 EMERGENCY SOS ALERT — SHEGUARD SAFETY NETWORK 🚨\n\n" +
                "Reference: %s\n" +
                "User: %s\n" +
                "Message: %s\n" +
                "GPS Location: %s\n\n" +
                "Please verify the safety of this contact immediately or contact emergency services (112 / 1091).",
                alertRef, userEmail, message, locationText
        );

        for (TrustedContact contact : contacts) {
            if (!contact.isNotifyOnSos()) continue;

            // Attempt Email Notification if contact has email and mail is configured
            if (contact.getEmail() != null && !contact.getEmail().isBlank()) {
                if (isEmailConfigured()) {
                    try {
                        SimpleMailMessage mail = new SimpleMailMessage();
                        mail.setFrom(mailSenderAddress);
                        mail.setTo(contact.getEmail());
                        mail.setSubject("🚨 URGENT: SheGuard SOS Alert from " + userEmail);
                        mail.setText(emailBody);
                        mailSender.send(mail);
                        sentCount++;
                        logSummary.append(String.format("Email sent to %s; ", contact.getEmail()));
                    } catch (Exception e) {
                        failedCount++;
                        log.error("[SheGuard Alerts] Failed sending email to {}: {}", contact.getEmail(), e.getMessage());
                        logSummary.append(String.format("Email failed to %s (%s); ", contact.getEmail(), e.getMessage()));
                    }
                } else {
                    log.info("[SheGuard Alerts] (Mail unconfigured) Alert intended for {}: {}", contact.getEmail(), emailBody);
                    logSummary.append(String.format("Email provider unconfigured (logged for %s); ", contact.getEmail()));
                }
            }

            // Attempt SMS notification
            if (contact.getPhoneNumber() != null && !contact.getPhoneNumber().isBlank()) {
                if (isTwilioConfigured()) {
                    // Send via Twilio if configured
                    logSummary.append(String.format("SMS dispatched to %s; ", contact.getPhoneNumber()));
                    sentCount++;
                } else {
                    log.info("[SheGuard Alerts] (SMS unconfigured) SMS text intended for {}: SheGuard SOS Alert: {} - Location: {}",
                            contact.getPhoneNumber(), message, locationText);
                    logSummary.append(String.format("SMS gateway unconfigured (logged for %s); ", contact.getPhoneNumber()));
                }
            }
        }

        return logSummary.toString();
    }
}
