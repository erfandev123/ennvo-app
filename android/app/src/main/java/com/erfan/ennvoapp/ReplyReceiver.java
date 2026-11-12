package com.erfan.ennvoapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Bundle;

import androidx.core.app.RemoteInput;

/**
 * Handles notification actions that must not open the app:
 * inline reply, dismiss, decline and hang-up.
 */
public class ReplyReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(final Context ctx, final Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (action == null) return;

        if ("hangup".equals(action)) {
            hangup(ctx);
            return;
        }

        final int id = intent.getIntExtra("id", 0);
        if ("dismiss".equals(action)) {
            Notifier.forget(id);
            return;
        }

        if ("decline".equals(action) || "decline_native".equals(action)) {
            final String callId = intent.getStringExtra("call_id");
            Notifier.cancelCall(ctx);
            if (callId == null || callId.isEmpty()) return;

            CallActivity call = CallActivity.active;
            if (call != null) {
                call.runJs("window.onNativeDecline&&window.onNativeDecline()");
            }

            final PendingResult pending = goAsync();
            new Thread(() -> {
                try {
                    Notifier.declineNative(ctx, callId);
                } finally {
                    pending.finish();
                }
            }).start();
            return;
        }

        Bundle results = RemoteInput.getResultsFromIntent(intent);
        CharSequence text = results == null ? null : results.getCharSequence("reply_text");
        if (text == null || text.toString().trim().isEmpty()) return;

        final String reply = text.toString().trim();
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                Notifier.handleReply(ctx, id, reply);
            } finally {
                pending.finish();
            }
        }).start();
    }

    /**
     * The ongoing-call notification's Hang up action. If the lightweight call
     * page is alive it hangs up there (Firestore + WebRTC cleanup). Otherwise
     * the full app is asked. A delayed service stop guarantees the notification
     * disappears even if the WebView is gone.
     */
    private void hangup(final Context ctx) {
        CallActivity call = CallActivity.active;
        if (call != null) {
            call.runJs("window.onNativeHangup&&window.onNativeHangup()");
        } else {
            MainActivity main = Notifier.activity;
            if (main != null) main.runJs("window.onNativeHangup&&window.onNativeHangup()");
        }

        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                Thread.sleep(900);
            } catch (InterruptedException ignored) { }
            try {
                ctx.stopService(new Intent(ctx, CallService.class));
            } catch (Exception ignored) { }
            try {
                AudioManager audio = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
                if (audio != null) {
                    audio.setMode(AudioManager.MODE_NORMAL);
                    audio.setSpeakerphoneOn(false);
                }
            } catch (Exception ignored) { }
            try {
                Notifier.cancelCall(ctx);
            } catch (Exception ignored) { }
            pending.finish();
        }).start();
    }
}
