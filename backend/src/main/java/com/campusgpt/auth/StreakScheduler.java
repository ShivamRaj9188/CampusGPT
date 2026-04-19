package com.campusgpt.auth;

import com.campusgpt.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class StreakScheduler {

    private final UserRepository userRepository;

    /**
     * Run every day at midnight to reset streaks for users who
     * didn't have activity in the last 24 hours.
     */
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void burnExpiredStreaks() {
        log.info("Running scheduled task to burn expired streaks...");
        // If the last activity was before the start of yesterday, the streak is lost.
        LocalDateTime threshold = LocalDateTime.now().minusDays(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        
        int updatedUsers = userRepository.resetExpiredStreaks(threshold);
        log.info("Burned streaks for {} users who missed their study sessions.", updatedUsers);
    }
}
