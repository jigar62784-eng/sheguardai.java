package com.sheguard.services;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.cloud.FirestoreClient;
import com.google.firebase.cloud.StorageClient;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;

@Service
public class FirebaseService {
    private static final Logger log = LoggerFactory.getLogger(FirebaseService.class);

    @Value("${sheguard.firebase.credentials-path:serviceAccountKey.json}")
    private String credentialsPath;

    @Value("${sheguard.firebase.database-url:}")
    private String databaseUrl;

    @Value("${sheguard.firebase.storage-bucket:sheguard-safety.appspot.com}")
    private String storageBucket;

    private boolean configured = false;
    private String configurationStatusMessage = "Not initialized";

    @PostConstruct
    public void init() {
        try {
            if (!FirebaseApp.getApps().isEmpty()) {
                this.configured = true;
                this.configurationStatusMessage = "Firebase Admin SDK initialized using existing app";
                log.info("[SheGuard Backend] Firebase already initialized.");
                return;
            }

            InputStream serviceAccount = null;

            // 1. Check direct file path
            File file = new File(credentialsPath);
            if (file.exists() && file.isFile()) {
                serviceAccount = new FileInputStream(file);
                log.info("[SheGuard Backend] Found Firebase credentials at: {}", file.getAbsolutePath());
            } else {
                // 2. Check classpath
                serviceAccount = getClass().getClassLoader().getResourceAsStream(credentialsPath);
            }

            if (serviceAccount == null) {
                // 3. Check GOOGLE_APPLICATION_CREDENTIALS env var
                String envCredentials = System.getenv("GOOGLE_APPLICATION_CREDENTIALS");
                if (envCredentials != null && new File(envCredentials).exists()) {
                    serviceAccount = new FileInputStream(envCredentials);
                    log.info("[SheGuard Backend] Found Firebase credentials from GOOGLE_APPLICATION_CREDENTIALS: {}", envCredentials);
                }
            }

            if (serviceAccount == null) {
                this.configured = false;
                this.configurationStatusMessage = "Firebase serviceAccountKey.json not found at '" + credentialsPath +
                        "' or in environment variable GOOGLE_APPLICATION_CREDENTIALS.";
                log.warn("[SheGuard Backend] {}", configurationStatusMessage);
                return;
            }

            FirebaseOptions.Builder builder = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount));

            if (databaseUrl != null && !databaseUrl.isBlank()) {
                builder.setDatabaseUrl(databaseUrl);
            }
            if (storageBucket != null && !storageBucket.isBlank()) {
                builder.setStorageBucket(storageBucket);
            }

            FirebaseApp.initializeApp(builder.build());
            this.configured = true;
            this.configurationStatusMessage = "Firebase Admin SDK connected successfully";
            log.info("[SheGuard Backend] Firebase initialized successfully with project credentials.");
        } catch (Exception e) {
            this.configured = false;
            this.configurationStatusMessage = "Failed to initialize Firebase: " + e.getMessage();
            log.error("[SheGuard Backend] Firebase initialization error:", e);
        }
    }

    public boolean isConfigured() {
        return configured;
    }

    public String getConfigurationStatusMessage() {
        return configurationStatusMessage;
    }

    public FirebaseAuth getAuth() {
        if (!configured) return null;
        return FirebaseAuth.getInstance();
    }

    public Firestore getFirestore() {
        if (!configured) return null;
        return FirestoreClient.getFirestore();
    }

    public StorageClient getStorage() {
        if (!configured) return null;
        return StorageClient.getInstance();
    }
}
