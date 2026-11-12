package com.erfan.ennvoapp;

import android.Manifest;
import android.app.DownloadManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.LayoutInflater;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int REQ_NOTIFICATIONS = 1001;
    private static final int REQ_RUNTIME = 1002;
    private static final int REQ_ON_DEMAND = 1003;

    private volatile boolean splashHold = true;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private String askedPermission = "";
    private int lastBarsTop = -1;
    private int lastBarsBottom = -1;
    private boolean inCall = false;
    private PowerManager.WakeLock prox;

    static volatile String pendingOpen = null;
    static volatile String pendingCall = null;
    static volatile String pendingShare = null;

    private final Runnable splashTimeout = () -> {
        splashHold = false;
        hideSplashOverlay();
    };
    /** Black launch screen with the Ennvo symbol and the wordmark. */
    private View splashOverlay = null;

    /**
     * Capacitor's BridgeActivity forces its own AppTheme in onCreate. That
     * theme drops the native splash background and the transparent system bars
     * this app relies on, so it is ignored and the theme from the manifest
     * (AppTheme.NoActionBarLaunch) stays in place.
     */
    @Override
    public void setTheme(int resid) {
        if (isCapacitorTheme(resid)) return;
        super.setTheme(resid);
    }

    private boolean isCapacitorTheme(int resid) {
        try {
            String name = getResources().getResourceEntryName(resid);
            if (!"AppTheme_NoActionBar".equals(name)) return false;
            return !getPackageName().equals(getResources().getResourcePackageName(resid));
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public void onCreate(Bundle saved) {
        // Fast native splash. The web page calls Android.appReady() after its
        // first painted frame, so the hand-off is seamless and there is no
        // second splash drawn by the web app.
        SplashScreen splash = SplashScreen.installSplashScreen(this);

        super.onCreate(saved);

        // The keep-on-screen condition needs the content view, so it can only
        // be installed once super.onCreate() has built the layout.
        splash.setKeepOnScreenCondition(() -> splashHold);
        splash.setOnExitAnimationListener(vp -> vp.getView().animate().alpha(0f).setDuration(120)
                .withEndAction(() -> vp.remove()).start());

        // The Ennvo launch screen (black, the logo symbol and the wordmark)
        // sits on top of the WebView until the app is ready.
        showSplashOverlay();

        // Never keep the native splash longer than 3.5 seconds, even if a page
        // fails to report ready.
        ui.postDelayed(splashTimeout, 3500);

        Notifier.activity = this;
        Notifier.channels(this);

        Window window = getWindow();
        // Black window background: the web app is dark, so a white frame
        // between the splash and the first painted pixel is never visible.
        window.setBackgroundDrawable(new ColorDrawable(Color.BLACK));
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) window.setNavigationBarContrastEnforced(false);
        applyBars(window, false);

        WebView web = getBridge().getWebView();
        web.setBackgroundColor(Color.BLACK);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new NativeBridge(), "AndroidInterface");
        web.addJavascriptInterface(new NativeBridge(), "Android");

        WebSettings settings = web.getSettings();
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setTextZoom(100);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // Capacitor's BridgeWebChromeClient is required for getUserMedia:
        // it routes WebRTC camera/mic permission requests to the Android
        // runtime permission dialog, and it also handles file chooser, JS
        // dialogs and console messages. A plain WebChromeClient silently
        // denies camera/mic and was the reason calls could not connect.
        web.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public Bitmap getDefaultVideoPoster() {
                return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
            }

            @Override
            public View getVideoLoadingProgressView() {
                return new View(MainActivity.this);
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                try {
                    WebView.HitTestResult result = view.getHitTestResult();
                    String url = result == null ? null : result.getExtra();
                    if (url != null && !url.isEmpty()) {
                        openExternal(url);
                        return true;
                    }
                } catch (Exception ignored) {}
                return super.onCreateWindow(view, isDialog, isUserGesture, resultMsg);
            }
        });

        setupInsets();
        askNotificationsOnce();
        handleIntent(getIntent());

        // FCM is optional: without google-services.json the app still builds and
        // every local feature works. Never crash when Firebase is not configured.
        try {
            if (!FirebaseApp.getApps(this).isEmpty()) {
                FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> Notifier.saveToken(this, token));
            }
        } catch (Exception ignored) {}
    }

    /** Adds the black Ennvo launch screen on top of the WebView. */
    private void showSplashOverlay() {
        try {
            android.view.ViewGroup root = findViewById(android.R.id.content);
            if (root == null) return;
            View overlay = LayoutInflater.from(this).inflate(R.layout.ennvo_splash, root, false);
            root.addView(overlay);
            splashOverlay = overlay;
        } catch (Exception ignored) { }
    }

    /** Fades the launch screen away once the app painted its first frame. */
    private void hideSplashOverlay() {
        final View overlay = splashOverlay;
        if (overlay == null) return;
        splashOverlay = null;
        runOnUiThread(() -> {
            try {
                overlay.animate().alpha(0f).setDuration(240).withEndAction(() -> {
                    try {
                        if (overlay.getParent() instanceof android.view.ViewGroup) {
                            ((android.view.ViewGroup) overlay.getParent()).removeView(overlay);
                        }
                    } catch (Exception ignored) { }
                }).start();
            } catch (Exception ignored) { }
        });
    }

    private void applyBars(Window window, boolean light) {
        if (window == null) return;
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) window.setNavigationBarContrastEnforced(false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(light);
        controller.setAppearanceLightNavigationBars(light);
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        // The status bar and the navigation bar stay visible: the phone's own
        // clock, notifications and the back / home / recents buttons must
        // always be reachable.
        controller.show(WindowInsetsCompat.Type.systemBars());
    }

    /**
     * The single owner of the window insets.
     *
     * Capacitor's own SystemBars plugin is disabled (capacitor.config.ts), so
     * the keyboard height is applied exactly once: the content view is padded
     * by the keyboard, which shrinks the WebView. The page then reflows like
     * in a native app instead of jumping, and the composer sits right on top
     * of the keyboard without any JavaScript compensation.
     */
    private void setupInsets() {
        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            boolean keyboard = insets.isVisible(WindowInsetsCompat.Type.ime()) && ime.bottom > 0;

            // The app fills the whole screen and the phone's own bars are drawn
            // on top of it: the status bar with the clock and the navigation
            // bar with back / home / recents stay visible, but the app draws
            // behind them. The web app pads its own headers with the published
            // inset, so nothing ends up under the bars.
            int left = Math.max(cutout.left, bars.left);
            int right = Math.max(cutout.right, bars.right);
            int bottom = keyboard ? ime.bottom : 0;

            v.setPadding(left, 0, right, bottom);

            float density = getResources().getDisplayMetrics().density;
            // The full height of the status bar (plus the part of the cutout
            // that the bar does not cover) and of the navigation bar.
            int cssTop = bars.top + Math.max(0, cutout.top - bars.top);
            int cssBottom = keyboard ? 0 : bars.bottom;
            if (cssTop != lastBarsTop || cssBottom != lastBarsBottom) {
                lastBarsTop = cssTop;
                lastBarsBottom = cssBottom;
                runJs("(function(){var s=document.documentElement.style;"
                        + "s.setProperty('--safe-area-inset-top','" + (cssTop / density) + "px');"
                        + "s.setProperty('--safe-area-inset-bottom','" + (cssBottom / density) + "px');"
                        + "s.setProperty('--safe-area-inset-left','" + (left / density) + "px');"
                        + "s.setProperty('--safe-area-inset-right','" + (right / density) + "px');"
                        + "s.setProperty('--keyboard-inset','" + (bottom / density) + "px');})()");
            }
            return insets;
        });
        content.requestApplyInsets();
    }

    private void askNotificationsOnce() {
        if (Build.VERSION.SDK_INT < 33) return;
        SharedPreferences sp = getSharedPreferences("app", MODE_PRIVATE);
        if (sp.getBoolean("notif_asked", false)) return;
        sp.edit().putBoolean("notif_asked", true).apply();
        if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_NOTIFICATIONS);
        }
    }

    private String[] permissionsFor(String name) {
        if (name == null) return new String[0];
        switch (name.toLowerCase()) {
            case "camera":
                return new String[]{Manifest.permission.CAMERA};
            case "microphone":
            case "mic":
                return new String[]{Manifest.permission.RECORD_AUDIO};
            case "notifications":
                return Build.VERSION.SDK_INT >= 33 ? new String[]{Manifest.permission.POST_NOTIFICATIONS} : new String[0];
            case "location":
                return new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION};
            case "media":
                return Build.VERSION.SDK_INT >= 33
                        ? new String[]{Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO, Manifest.permission.READ_MEDIA_AUDIO}
                        : new String[]{Manifest.permission.READ_EXTERNAL_STORAGE};
            case "contacts":
                return new String[]{Manifest.permission.READ_CONTACTS};
            case "bluetooth":
                return Build.VERSION.SDK_INT >= 31 ? new String[]{Manifest.permission.BLUETOOTH_CONNECT} : new String[0];
            default:
                return new String[0];
        }
    }

    private boolean hasPermission(String name) {
        if (name != null && name.equalsIgnoreCase("location")) {
            return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                    || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        }
        String[] perms = permissionsFor(name);
        if (perms.length == 0) return true;
        for (String p : perms) {
            if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) return false;
        }
        return true;
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] result) {
        super.onRequestPermissionsResult(code, permissions, result);
        if (code == REQ_ON_DEMAND) {
            runJs("window.onPermissionResult&&window.onPermissionResult(" + JSONObject.quote(askedPermission) + "," + hasPermission(askedPermission) + ")");
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        Notifier.foreground = true;
        Notifier.clearMessages(this);
    }

    @Override
    public void onStop() {
        Notifier.foreground = false;
        super.onStop();
    }

    @Override
    public void onResume() {
        super.onResume();
        injectInsetsAgain();
    }

    private void injectInsetsAgain() {
        View content = findViewById(android.R.id.content);
        if (content != null) content.requestApplyInsets();
    }

    @Override
    public void onDestroy() {
        if (Notifier.activity == this) Notifier.activity = null;
        ui.removeCallbacks(splashTimeout);
        super.onDestroy();
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    @Override
    public void onPause() {
        super.onPause();
        // A WebRTC call must keep running when the user leaves the app.
        if (inCall) {
            try {
                WebView web = getBridge().getWebView();
                web.onResume();
                web.resumeTimers();
            } catch (Exception ignored) {}
        }
    }

    void runJs(final String js) {
        runOnUiThread(() -> {
            try {
                getBridge().getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) {}
        });
    }

    void openExternal(String raw) {
        if (raw == null) return;
        String url = raw.trim();
        if (url.isEmpty()) return;

        if (url.startsWith("http://localhost") || url.startsWith("https://localhost")) {
            runJs("window.__ennvoOpenLink&&window.__ennvoOpenLink(" + JSONObject.quote(url) + ")");
            return;
        }
        if (url.startsWith("intent:")) {
            try {
                Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                return;
            } catch (Exception e) {
                try {
                    String packageName = Intent.parseUri(url, Intent.URI_INTENT_SCHEME).getPackage();
                    if (packageName != null) {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + packageName))
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                        return;
                    }
                } catch (Exception ignored) {}
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://" + url.substring("intent://".length())))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Exception ignored) {}
                return;
            }
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            return;
        } catch (Exception ignored) {}
        try {
            if (url.startsWith("tel:")) {
                startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } else if (url.startsWith("mailto:")) {
                startActivity(new Intent(Intent.ACTION_SENDTO, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            }
        } catch (Exception ignored) {}
    }

    private void handleIntent(final Intent intent) {
        if (intent == null) return;
        try {
            String openUrl = intent.getStringExtra("open_url");
            String conv = intent.getStringExtra("open_conv");
            String name = intent.getStringExtra("open_name");

            if (openUrl != null && !openUrl.isEmpty()) {
                pendingOpen = new JSONObject().put("type", "link").put("url", openUrl).put("n", name == null ? "" : name).toString();
                intent.removeExtra("open_url");
                runJs("window.onNativeOpen&&window.onNativeOpen()");
            } else if (conv != null && "__notifications__".equals(conv)) {
                pendingOpen = new JSONObject().put("c", "").put("n", name == null ? "" : name).put("type", "activity").toString();
                intent.removeExtra("open_conv");
                runJs("window.onNativeOpen&&window.onNativeOpen()");
            } else {
                boolean isActivity = "__activity__".equals(conv);
                if ((conv != null && !conv.isEmpty()) || isActivity || (name != null && !name.isEmpty())) {
                    pendingOpen = new JSONObject()
                            .put("c", isActivity ? "" : (conv == null ? "" : conv))
                            .put("n", name == null ? "" : name)
                            .put("type", isActivity ? "activity" : "chat")
                            .toString();
                    intent.removeExtra("open_conv");
                    intent.removeExtra("open_name");
                    runJs("window.onNativeOpen&&window.onNativeOpen()");
                }
            }

            String callAction = intent.getStringExtra("call_action");
            if (callAction != null && !callAction.isEmpty()) {
                pendingCall = new JSONObject()
                        .put("a", callAction)
                        .put("id", intent.getStringExtra("call_id"))
                        .put("name", intent.getStringExtra("call_name"))
                        .put("type", intent.getStringExtra("call_type"))
                        .toString();
                intent.removeExtra("call_action");
                Notifier.cancelCall(this);
                runJs("window.onNativeCallAction&&window.onNativeCallAction()");
            }

            if (Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
                String url = intent.getData().toString();
                intent.setData(null);
                if (!url.isEmpty() && !url.startsWith("http://localhost") && !url.startsWith("https://localhost")) {
                    runJs("window.__ennvoOpenLink&&window.__ennvoOpenLink(" + JSONObject.quote(url) + ")");
                }
            }

            String action = intent.getAction();
            if (Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action)) {
                handleShareIntent(intent, Intent.ACTION_SEND_MULTIPLE.equals(action));
            }
        } catch (Exception ignored) {}
    }

    private void handleShareIntent(final Intent intent, final boolean multi) {
        new Thread(() -> {
            try {
                JSONObject object = new JSONObject();
                JSONArray files = new JSONArray();
                String text = intent.getStringExtra(Intent.EXTRA_TEXT);
                if (text != null) object.put("text", text);

                List<Uri> uris = new ArrayList<>();
                if (multi) {
                    ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                    if (list != null) uris.addAll(list);
                } else {
                    Uri single = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                    if (single != null) uris.add(single);
                }

                File dir = new File(getCacheDir(), "shared");
                if (!dir.exists()) dir.mkdirs();
                int index = 0;
                for (Uri uri : uris) {
                    if (index >= 10) break;
                    index++;
                    String mime = getContentResolver().getType(uri);
                    String ext = mime == null ? null : MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
                    File file = new File(dir, "share_" + System.currentTimeMillis() + "_" + index + (ext == null ? "" : "." + ext));
                    try (InputStream in = getContentResolver().openInputStream(uri);
                         OutputStream out = new FileOutputStream(file)) {
                        if (in == null) continue;
                        byte[] buffer = new byte[65536];
                        int length;
                        while ((length = in.read(buffer)) > 0) out.write(buffer, 0, length);
                    }
                    files.put(new JSONObject().put("url", "/_capacitor_file_" + file.getAbsolutePath())
                            .put("mime", mime == null ? "" : mime)
                            .put("name", file.getName()));
                }
                object.put("files", files);
                pendingShare = object.toString();
                runJs("window.onShareReceived&&window.onShareReceived()");
            } catch (Exception ignored) {}
        }).start();
    }

    private void setProximity(boolean on) {
        try {
            if (prox != null && prox.isHeld()) prox.release();
            prox = null;
            if (!on) return;
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && pm.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) {
                prox = pm.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "ennvo:proximity");
                prox.acquire(3600000L);
            }
        } catch (Exception ignored) {}
    }

    public class NativeBridge {
        @JavascriptInterface
        public void showNotification(String title, String body, String icon, String type) {
            askNotificationsOnce();
            if ("activity".equals(type) || "like".equals(type) || "comment".equals(type) || "follow".equals(type)) {
                Notifier.showActivity(MainActivity.this, title, body, icon, "");
            } else {
                Notifier.showMessage(MainActivity.this, title, body, icon, null);
            }
        }

        @JavascriptInterface
        public void showNotification(String title, String body, String type) {
            askNotificationsOnce();
            showNotification(title, body, null, type);
        }

        @JavascriptInterface
        public void showMessageNotification(String title, String body, String avatar, String convId) {
            askNotificationsOnce();
            Notifier.showMessage(MainActivity.this, title, body, avatar, convId);
        }

        @JavascriptInterface
        public void showActivityNotification(String title, String body, String avatar, String url) {
            askNotificationsOnce();
            Notifier.showActivity(MainActivity.this, title, body, avatar, url);
        }

        @JavascriptInterface
        public void sendNotification(String title, String body) {
            askNotificationsOnce();
            Notifier.showMessage(MainActivity.this, title, body, null, null);
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            askNotificationsOnce();
        }

        @JavascriptInterface
        public void showIncomingCall(String name, String avatar, String type, String callId) {
            if (Notifier.foreground) return;
            Notifier.showCall(MainActivity.this, name, avatar, type, callId);
        }

        @JavascriptInterface
        public void dismissIncomingCall() {
            Notifier.cancelCall(MainActivity.this);
        }

        @JavascriptInterface
        public void setNotifMode(String mode) {
            if ("on".equals(mode) || "off".equals(mode) || "secret".equals(mode)) {
                getSharedPreferences("app", MODE_PRIVATE).edit().putString("notif_mode", mode).apply();
            }
        }

        @JavascriptInterface
        public String getNotifMode() {
            return getSharedPreferences("app", MODE_PRIVATE).getString("notif_mode", "on");
        }

        @JavascriptInterface
        public void setNativeConfig(String json) {
            getSharedPreferences("app", MODE_PRIVATE).edit().putString("native_config", json == null ? "" : json).apply();
        }

        @JavascriptInterface
        public void clearNativeConfig() {
            getSharedPreferences("app", MODE_PRIVATE).edit().remove("native_config").apply();
        }

        @JavascriptInterface
        public String getFcmToken() {
            return getSharedPreferences("app", MODE_PRIVATE).getString("fcm", "");
        }

        /**
         * Keeps a fresh Firebase ID token on the native side so a notification
         * "Decline" action can update the call instantly without booting a WebView.
         */
        @JavascriptInterface
        public void setAuthToken(String uid, String token) {
            Notifier.saveAuth(MainActivity.this, uid, token);
        }

        @JavascriptInterface
        public String getPendingOpen() {
            String value = pendingOpen;
            pendingOpen = null;
            return value == null ? "" : value;
        }

        @JavascriptInterface
        public String getPendingCallAction() {
            String value = pendingCall;
            pendingCall = null;
            return value == null ? "" : value;
        }

        @JavascriptInterface
        public String getPendingReplies() {
            return Notifier.takePending(MainActivity.this);
        }

        @JavascriptInterface
        public String getPendingShare() {
            String value = pendingShare;
            pendingShare = null;
            return value == null ? "" : value;
        }

        @JavascriptInterface
        public void setStatusBarColor(String hex, boolean isDark) {
            runOnUiThread(() -> {
                try {
                    Window window = getWindow();
                    applyBars(window, !isDark);
                    int color = Color.parseColor(hex);
                    WebView web = getBridge().getWebView();
                    web.setBackgroundColor(color);
                    // The window background is only visible in the areas the
                    // WebView does not cover (the notch while the keyboard is
                    // animating). Keeping it in sync with the app theme means
                    // no black band ever flashes.
                    window.setBackgroundDrawable(new ColorDrawable(color));
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public void startCall(String name, boolean video) {
            startCall(name, video, "");
        }

        @JavascriptInterface
        public void startCall(String name, boolean video, String callId) {
            final String callName = name == null ? "" : name;
            final boolean isVideo = video;
            final String id = callId == null ? "" : callId;
            runOnUiThread(() -> {
                inCall = true;
                runJs("window.__inCall=true");
                try {
                    ContextCompat.startForegroundService(MainActivity.this,
                            new Intent(MainActivity.this, CallService.class)
                                    .putExtra("name", callName)
                                    .putExtra("video", isVideo)
                                    .putExtra("call_id", id)
                                    .putExtra("source", "main"));
                } catch (Exception ignored) {}
                AudioManager audio = (AudioManager) getSystemService(AUDIO_SERVICE);
                if (audio != null) {
                    audio.setMode(AudioManager.MODE_IN_COMMUNICATION);
                    audio.setSpeakerphoneOn(isVideo);
                }
                setProximity(!isVideo);
            });
        }

        @JavascriptInterface
        public void endCall() {
            runOnUiThread(() -> {
                inCall = false;
                runJs("window.__inCall=false");
                try { stopService(new Intent(MainActivity.this, CallService.class)); } catch (Exception ignored) {}
                AudioManager audio = (AudioManager) getSystemService(AUDIO_SERVICE);
                if (audio != null) {
                    audio.setMode(AudioManager.MODE_NORMAL);
                    audio.setSpeakerphoneOn(false);
                }
                setProximity(false);
            });
        }

        @JavascriptInterface
        public void setSpeaker(boolean on) {
            final boolean speaker = on;
            runOnUiThread(() -> {
                AudioManager audio = (AudioManager) getSystemService(AUDIO_SERVICE);
                if (audio != null) audio.setSpeakerphoneOn(speaker);
                setProximity(!speaker && inCall);
            });
        }

        @JavascriptInterface
        public void setPip(boolean enabled, int width, int height) {
            // Picture-in-picture is not needed for the main shell; videos keep
            // playing in the WebView while the app is visible.
        }

        @JavascriptInterface
        public void requestBatteryExemption() {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:" + getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                openNotificationSettings();
            }
        }

        @JavascriptInterface
        public void openNotificationSettings() {
            try {
                Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                try {
                    startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.parse("package:" + getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Exception ignored) {}
            }
        }

        @JavascriptInterface
        public void openNotificationChannelSettings() {
            openNotificationSettings();
        }

        @JavascriptInterface
        public boolean hasPermission(String name) {
            return MainActivity.this.hasPermission(name);
        }

        @JavascriptInterface
        public void requestPermission(final String name) {
            runOnUiThread(() -> {
                askedPermission = name == null ? "" : name;
                List<String> missing = new ArrayList<>();
                for (String permission : permissionsFor(askedPermission)) {
                    if (checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) missing.add(permission);
                }
                if (missing.isEmpty()) {
                    runJs("window.onPermissionResult&&window.onPermissionResult(" + JSONObject.quote(askedPermission) + "," + hasPermission(askedPermission) + ")");
                    return;
                }
                requestPermissions(missing.toArray(new String[0]), REQ_ON_DEMAND);
            });
        }

        @JavascriptInterface
        public void setUserId(String uid) {
            askNotificationsOnce();
        }

        @JavascriptInterface
        public void openCall(String callId, String name, String avatar, String type) {
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(MainActivity.this, CallActivity.class)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                            .putExtra("call_action", "answer")
                            .putExtra("call_id", callId == null ? "" : callId)
                            .putExtra("call_name", name == null ? "" : name)
                            .putExtra("call_avatar", avatar == null ? "" : avatar)
                            .putExtra("call_type", type == null ? "voice" : type);
                    startActivity(i);
                } catch (Exception ignored) { }
            });
        }

        @JavascriptInterface
        public void setActiveChat(String convId) {
            Notifier.setActiveChat(MainActivity.this, convId);
        }

        @JavascriptInterface
        public void appReady() {
            splashHold = false;
            hideSplashOverlay();
            injectInsetsAgain();
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(() -> finishAffinity());
        }

        @JavascriptInterface
        public void openUrl(String url) {
            openExternal(url);
        }

        @JavascriptInterface
        public void shareText(String title, String text) {
            try {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                if (title != null && !title.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, title);
                send.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                Intent chooser = Intent.createChooser(send, title == null || title.isEmpty() ? "Share with" : title);
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(chooser);
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void downloadMedia(String url, String filename, String mime) {
            if (url == null || !url.startsWith("http")) return;
            try {
                String name = (filename == null || filename.isEmpty()) ? "ennvo-download" : filename.replace('/', '_').replace(':', '_');
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                        .setTitle(name)
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                if (mime != null && !mime.isEmpty()) request.setMimeType(mime);
                DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (manager != null) manager.enqueue(request);
                Toast.makeText(MainActivity.this, "Downloading " + name, Toast.LENGTH_SHORT).show();
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public String getAppInfo() {
            try {
                PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                long code = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
                return new JSONObject().put("versionName", info.versionName)
                        .put("versionCode", code)
                        .put("sdk", Build.VERSION.SDK_INT)
                        .put("model", Build.MODEL).toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public void vibrate(int milliseconds) {
            try {
                android.os.Vibrator vibrator = (android.os.Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (vibrator == null) return;
                int duration = Math.max(5, Math.min(milliseconds, 500));
                if (Build.VERSION.SDK_INT >= 26) {
                    vibrator.vibrate(android.os.VibrationEffect.createOneShot(duration, android.os.VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(duration);
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void setKeepScreenOn(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void openStore() {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + getPackageName()))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception e) {
                openUrl("https://play.google.com/store/apps/details?id=" + getPackageName());
            }
        }

        @JavascriptInterface
        public void reportError(String message, String stack) {}
    }
}
