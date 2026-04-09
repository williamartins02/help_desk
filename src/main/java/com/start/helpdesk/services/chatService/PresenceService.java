package com.start.helpdesk.services;

import org.springframework.stereotype.Service;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Collections;

/**
 * Rastreia quais usuários (e-mails) estão conectados ao chat no momento.
 * Thread-safe via ConcurrentHashMap.
 */
@Service
public class PresenceService {

    private final Set<String> onlineUsers = ConcurrentHashMap.newKeySet();

    public void userEntrou(String email) {
        if (email != null && !email.isBlank()) onlineUsers.add(email);
    }

    public void userSaiu(String email) {
        if (email != null) onlineUsers.remove(email);
    }

    public boolean estaOnline(String email) {
        return email != null && onlineUsers.contains(email);
    }

    public Set<String> getOnlineUsers() {
        return Collections.unmodifiableSet(onlineUsers);
    }
}
