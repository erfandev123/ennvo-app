package com.erfan.ennvoapp;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Data-only FCM receiver. Every payload is rendered by Notifier so messages,
 * calls and activity notifications share the same avatars, channels and tap
 * targets as notifications produced inside the WebView.
 */
public class AppFcmService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        getSharedPreferences("app", MODE_PRIVATE).edit().putBoolean("push_ok", true).apply();

        String type = data.get("type");

        // App is open: hand the payload to the WebView, which shows the in-app
        // toast immediately. No system notification is posted, so the same
        // message never appears twice.
        MainActivity main = Notifier.activity;
        if (Notifier.foreground && main != null && !"call".equals(type) && !"call_cancel".equals(type)) {
            try {
                org.json.JSONObject out = new org.json.JSONObject();
                for (Map.Entry<String, String> e : data.entrySet()) {
                    if (e.getKey() != null && e.getValue() != null) out.put(e.getKey(), e.getValue());
                }
                main.runJs("window.onFcmMessage&&window.onFcmMessage(" + org.json.JSONObject.quote(out.toString()) + ")");
            } catch (Exception ignored) { }
            return;
        }
        if ("call".equals(type)) {
            Notifier.showCall(this, data.get("name"), data.get("avatar"), data.get("callType"), data.get("callId"));
        } else if ("call_cancel".equals(type)) {
            Notifier.cancelCall(this);
        } else if ("activity".equals(type)) {
            Notifier.showActivity(this, data.get("title"), data.get("body"), data.get("avatar"), data.get("url"));
        } else if (data.get("body") != null) {
            Notifier.showMessage(this, data.get("title"), data.get("body"), data.get("avatar"), data.get("convId"));
        }
    }

    @Override
    public void onNewToken(String token) {
        Notifier.saveToken(this, token);
    }
}
