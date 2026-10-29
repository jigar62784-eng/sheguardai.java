package com.sheguard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

@SpringBootApplication(exclude = { UserDetailsServiceAutoConfiguration.class })
public class SheGuardApplication {
    public static void main(String[] args) {
        SpringApplication.run(SheGuardApplication.class, args);
    }
}
