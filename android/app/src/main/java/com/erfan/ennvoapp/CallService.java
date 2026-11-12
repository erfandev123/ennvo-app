package com.erfan.ennvoapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * Keeps the microphone/camera alive while a call is running and gives the user
 * a WhatsApp-style "ongoing call" notification with a Hang up action.
 *
 * `source` says which Activity owns the WebRTC session:
 *   - "main": the full app (CallOverlay) owns it
 *   - "call": the lightweight CallActivity/call page owns it
 * Tapping the ongoing notification must return to the screen that owns the
 * call, otherwise the user lands on a second WebView that knows nothing about
 * the running peer connection.
 */
public class CallService extends Service {
    static final String CH = "app_ongoing";
    private static final int ID = 9002;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String name = intent == null ? "" : intent.getStringExtra("name");
        boolean video = intent != null && intent.getBooleanExtra("video", false);
        String callId = intent == null ? "" : intent.getStringExtra("call_id");
        String source = intent == null ? "call" : intent.getStringExtra("source");
        boolean ownsMain = "main".equals(source);

        Notifier.channels(this);

        Intent openIntent;
        if (ownsMain) {
            // Just bring the app forward. Passing call_action would make the app
            // believe a brand-new call action arrived and restart the UI.
            openIntent = new Intent(this, MainActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        } else {
            openIntent = new Intent(this, CallActivity.class)
                    .setAction("app.CALL.open")
                    .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    .putExtra("call_action", "open")
                    .putExtra("call_id", callId == null ? "" : callId)
                    .putExtra("call_name", name == null ? "" : name)
                    .putExtra("call_type", video ? "video" : "voice");
        }
        PendingIntent open = PendingIntent.getActivity(this, 5, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent hangupIntent = new Intent(this, ReplyReceiver.class)
                .setAction("hangup")
                .putExtra("call_id", callId == null ? "" : callId)
                .putExtra("source", ownsMain ? "main" : "call");
        PendingIntent hangup = PendingIntent.getBroadcast(this, 6, hangupIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, CH)
                .setSmallIcon(Notifier.smallIcon(this))
                .setColor(Notifier.ACCENT)
                .setContentTitle(name == null || name.isEmpty() ? "Ennvo Call" : name)
                .setContentText(video ? "Ongoing video call" : "Ongoing voice call")
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setWhen(System.currentTimeMillis())
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .setContentIntent(open)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Hang up", hangup)
                .build();

        try {
            if (Build.VERSION.SDK_INT >= 29) {
                int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                        | (video ? ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA : 0);
                try {
                    startForeground(ID, notification, type);
                } catch (SecurityException se) {
                    startForeground(ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
                }
            } else {
                startForeground(ID, notification);
            }
        } catch (Exception e) {
            stopSelf();
        }

        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(ID);
        } catch (Exception ignored) { }
        super.onDestroy();
    }
}
