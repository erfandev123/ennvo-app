package com.erfan.ennvoapp;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.ServerPath;

import org.json.JSONObject;

/**
 * Ultra-light call screen.
 *
 * It is a second Capacitor BridgeActivity that only loads the tiny call bundle
 * (public/call), so answering a call never parses the full app. The origin is
 * still https://localhost, which means the Firebase Auth session and global
 * settings are shared with the main app.
 */
public class CallActivity extends BridgeActivity {
    private static final int REQ_CALL_PERMISSIONS = 2001;

    /** The call page currently on screen, used to route notification actions. */
    static volatile CallActivity active = null;

    private final Handler ui = new Handler(Looper.getMainLooper());
    private volatile String callId = "";
    private volatile String callName = "";
    private volatile String callType = "voice";
    private volatile String callAction = "open";
    private volatile String callAvatar = "";
    private volatile boolean ownsCallService = false;
    /**
     * True when the main app already owns the running call. In that case the
     * lightweight screen must not touch the audio route or the foreground
     * service when it closes, otherwise the ongoing call loses its sound.
     */
    private volatile boolean keepAudioForMainCall = false;
    private boolean backHandled = false;

    @Override
    public void onCreate(Bundle saved) {
        Intent intent = getIntent();
        readIntent(intent);

        if (Build.VERSION.SDK_INT >= 27) {
            try {
                setShowWhenLocked(true);
                setTurnScreenOn(true);
            } catch (Exception ignored) { }
        }
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Only the call bundle is hosted at the app root, keeping the
        // https://localhost origin (shared Firebase login) but never parsing
        // the full React application.
        bridgeBuilder.setServerPath(new ServerPath(ServerPath.PathType.ASSET_PATH, "public/call"));
        super.onCreate(saved);

        active = this;
        setVolumeControlStream(AudioManager.STREAM_VOICE_CALL);
        Notifier.cancelCall(this);

        window.setBackgroundDrawable(new ColorDrawable(Color.BLACK));

        try {
            WebView web = getBridge().getWebView();
            web.setBackgroundColor(Color.BLACK);
            web.setOverScrollMode(View.OVER_SCROLL_NEVER);
            web.getSettings().setMediaPlaybackRequiresUserGesture(false);
            web.getSettings().setDomStorageEnabled(true);
            web.addJavascriptInterface(new CallBridge(), "AndroidCallScreen");
        } catch (Exception ignored) { }

        // The interface may be injected after the page's first script tick;
        // let the page re-read id/name/action and auto-accept if needed.
        runJs("window.onCallNativeReady&&window.onCallNativeReady()");

        applyAudioMode();

        // Legacy path: an already-posted notification may still carry a
        // Decline PendingIntent that targets this activity. New notifications
        // decline from ReplyReceiver, so no WebView is normally involved.
        if ("decline".equals(callAction)) {
            declineCall();
            return;
        }

        // The call page reads these through getCallInfo().
        if ("answer".equals(callAction)) {
            runJs("window.onCallIntent&&window.onCallIntent()");
        }
    }

    private void readIntent(Intent intent) {
        if (intent == null) return;

        String id = intent.getStringExtra("call_id");
        String name = intent.getStringExtra("call_name");
        String type = intent.getStringExtra("call_type");
        String action = intent.getStringExtra("call_action");
        String avatar = intent.getStringExtra("call_avatar");

        if (id != null && !id.isEmpty()) callId = id;
        if (name != null && !name.isEmpty()) callName = name;
        if (type != null && !type.isEmpty()) callType = type;
        if (action != null && !action.isEmpty()) callAction = action;
        if (avatar != null && !avatar.isEmpty()) callAvatar = avatar;
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readIntent(intent);
        Notifier.cancelCall(this);

        if ("decline".equals(callAction)) {
            declineCall();
            return;
        }

        runJs("window.onCallIntent&&window.onCallIntent()");

        if ("answer".equals(callAction)) {
            runJs("window.onCallAccept&&window.onCallAccept()");
        }
    }

    private void applyAudioMode() {
        try {
            AudioManager audio = (AudioManager) getSystemService(AUDIO_SERVICE);
            if (audio != null) {
                audio.setMode(AudioManager.MODE_IN_COMMUNICATION);
                audio.setSpeakerphoneOn("video".equals(callType));
            }
        } catch (Exception ignored) { }
    }

    private void resetAudio() {
        try {
            AudioManager audio = (AudioManager) getSystemService(AUDIO_SERVICE);
            if (audio != null) {
                audio.setMode(AudioManager.MODE_NORMAL);
                audio.setSpeakerphoneOn(false);
            }
        } catch (Exception ignored) { }
    }

    void runJs(final String js) {
        runOnUiThread(() -> {
            try {
                getBridge().getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) { }
        });
    }

    private void finishScreen() {
        if (isFinishing()) return;
        if (ownsCallService) {
            ownsCallService = false;
            try { stopService(new Intent(this, CallService.class)); } catch (Exception ignored) { }
        }
        resetAudio();
        try {
            finishAndRemoveTask();
        } catch (Exception e) {
            finish();
        }
    }

    /**
     * Hardware Back behaves like a native call screen: the web page hangs up
     * (Firestore + media cleanup), then the activity closes even if JS is dead.
     */
    @Override
    public void onBackPressed() {
        if (backHandled) return;
        backHandled = true;
        runJs("window.onAndroidBack&&window.onAndroidBack()");
        ui.postDelayed(this::finishScreen, 900);
    }

    @Override
    public void onPause() {
        super.onPause();
        // Keep WebRTC alive while the call screen is not front-most (screen
        // off during a voice call, permission dialog, etc.).
        try {
            WebView web = getBridge().getWebView();
            web.onResume();
            web.resumeTimers();
        } catch (Exception ignored) { }
    }

    @Override
    public void onDestroy() {
        if (active == this) active = null;
        if (ownsCallService) {
            ownsCallService = false;
            try { stopService(new Intent(this, CallService.class)); } catch (Exception ignored) { }
        }
        if (!keepAudioForMainCall) resetAudio();
        super.onDestroy();
    }

    private void declineCall() {
        Notifier.cancelCall(this);
        final String id = callId;
        new Thread(() -> Notifier.declineNative(this, id)).start();
        ui.postDelayed(this::finishScreen, 220);
    }

    /**
     * Hands the user over to the full app.
     *
     * @param keepCall true when the call itself already runs in MainActivity;
     *                 the call service and the audio route must stay alive.
     */
    private void openMainActivity(final boolean keepCall) {
        runOnUiThread(() -> {
            Intent main = new Intent(CallActivity.this, MainActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            try {
                startActivity(main);
            } catch (Exception ignored) { }

            if (keepCall) {
                // MainActivity owns the media. Closing this screen must not
                // stop the foreground service or reset the audio route.
                keepAudioForMainCall = true;
                try {
                    finishAndRemoveTask();
                } catch (Exception e) {
                    finish();
                }
                return;
            }

            finishScreen();
        });
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] result) {
        super.onRequestPermissionsResult(code, permissions, result);
        if (code == REQ_CALL_PERMISSIONS) {
            runJs("window.onCallPermissions&&window.onCallPermissions(" + (hasCallPermissions() ? "true" : "false") + ")");
        }
    }

    private String[] neededCallPermissions() {
        boolean video = "video".equals(callType);
        return video
                ? new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO}
                : new String[]{Manifest.permission.RECORD_AUDIO};
    }

    public class CallBridge {
        @JavascriptInterface
        public String getCallInfo() {
            try {
                return new JSONObject()
                        .put("id", callId)
                        .put("name", callName)
                        .put("type", callType)
                        .put("action", callAction)
                        .put("avatar", callAvatar)
                        .toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public String getCallAction() {
            return callAction == null ? "open" : callAction;
        }

        @JavascriptInterface
        public boolean hasCallPermissions() {
            for (String permission : neededCallPermissions()) {
                if (ContextCompat.checkSelfPermission(CallActivity.this, permission) != PackageManager.PERMISSION_GRANTED) {
                    return false;
                }
            }
            return true;
        }

        @JavascriptInterface
        public void requestCallPermissions() {
            runOnUiThread(() -> {
                if (hasCallPermissions()) {
                    runJs("window.onCallPermissions&&window.onCallPermissions(true)");
                    return;
                }
                requestPermissions(neededCallPermissions(), REQ_CALL_PERMISSIONS);
            });
        }

        @JavascriptInterface
        public void startCall(String name, boolean video) {
            startCall(name, video, callId);
        }

        @JavascriptInterface
        public void startCall(String name, boolean video, String id) {
            runOnUiThread(() -> {
                ownsCallService = true;
                if (id != null && !id.isEmpty()) callId = id;
                try {
                    Intent service = new Intent(CallActivity.this, CallService.class)
                            .putExtra("name", name == null ? callName : name)
                            .putExtra("video", video)
                            .putExtra("call_id", callId)
                            .putExtra("source", "call");
                    ContextCompat.startForegroundService(CallActivity.this, service);
                } catch (Exception ignored) { }
                try {
                    AudioManager audio = (AudioManager) getSystemService(AUDIO_SERVICE);
                    if (audio != null) {
                        audio.setMode(AudioManager.MODE_IN_COMMUNICATION);
                        audio.setSpeakerphoneOn(video);
                    }
                } catch (Exception ignored) { }
            });
        }

        @JavascriptInterface
        public void setSpeaker(boolean speaker) {
            runOnUiThread(() -> {
                try {
                    AudioManager audio = (AudioManager) getSystemService(AUDIO_SERVICE);
                    if (audio != null) audio.setSpeakerphoneOn(speaker);
                } catch (Exception ignored) { }
            });
        }

        @JavascriptInterface
        public void endCall() {
            runOnUiThread(() -> {
                ownsCallService = false;
                try {
                    stopService(new Intent(CallActivity.this, CallService.class));
                } catch (Exception ignored) { }
                resetAudio();
            });
        }

        @JavascriptInterface
        public void declineCall() {
            CallActivity.this.declineCall();
        }

        @JavascriptInterface
        public void openApp() {
            openMainActivity(false);
        }

        /**
         * Opens the main app while the call itself runs in MainActivity. The
         * call service and the audio route stay untouched, so the ongoing call
         * keeps its sound instead of going silent when this screen closes.
         */
        @JavascriptInterface
        public void openAppKeepingCall() {
            openMainActivity(true);
        }

        @JavascriptInterface
        public void appReady() {
            // The page owns the whole window; nothing to hide natively.
        }

        @JavascriptInterface
        public void finishCall() {
            runOnUiThread(CallActivity.this::finishScreen);
        }

        @JavascriptInterface
        public String getFcmToken() {
            return getSharedPreferences("app", MODE_PRIVATE).getString("fcm", "");
        }

        @JavascriptInterface
        public void setAuthToken(String uid, String token) {
            Notifier.saveAuth(CallActivity.this, uid, token);
        }

        @JavascriptInterface
        public void saveAuthToken(String uid, String token) {
            Notifier.saveAuth(CallActivity.this, uid, token);
        }
    }
}
