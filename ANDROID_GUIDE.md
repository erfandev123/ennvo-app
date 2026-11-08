# Ennvo Android Setup & Codes (Manual / Command Prompt)

Here are the complete codes and commands to set up the Android app on your computer via Command Prompt / Terminal.

---

## Step 1: Install & Generate Android Project

Run these commands in your project root:

```bash
npm install
npm run build
npx cap add android
```

This creates the fresh `android/` directory.

---

## Step 2: `AndroidManifest.xml` Code

File location after running `npx cap add android`:
📁 `android/app/src/main/AndroidManifest.xml`

Replace its content or add the permissions below:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- All Required Permissions for Camera, Mic, Storage & Notification -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true"
        android:hardwareAccelerated="true">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths"></meta-data>
        </provider>
    </application>

</manifest>
```

---

## Step 3: `MainActivity.java` Code

File location:
📁 `android/app/src/main/java/com/ennvo/app/MainActivity.java`

This code enables hardware acceleration, hardware back button navigation, fast render cache, and transparent edge-to-edge status bar:

```java
package com.ennvo.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.NotificationCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String CHANNEL_ID = "ennvo_notifications";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Hardware Accelerated full-screen Edge-to-Edge
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );

        // 2. Transparent modern Status Bar & Navigation Bar
        window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
        window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);

        // 3. Create Notification Channel for Android 8.0+
        createNotificationChannel();

        // 4. Ultra-Fast WebView caching, DOM storage, and Java Notification Bridge
        if (bridge != null && bridge.getWebView() != null) {
            webView = bridge.getWebView();
            WebSettings settings = webView.getSettings();
            settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            webView.setScrollBarStyle(WebView.SCROLLBARS_INSIDE_OVERLAY);

            // Add JavaScript Interface for Native Android Notifications & Back Handling
            webView.addJavascriptInterface(new AndroidBridge(this), "AndroidInterface");
            webView.addJavascriptInterface(new AndroidBridge(this), "Android");
        }
    }

    // Hardware Back Button: Delegate to web app first, never exit prematurely
    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("if (typeof window.handleAndroidBack === 'function') { window.handleAndroidBack(); } else { window.history.back(); }", null);
        } else {
            super.onBackPressed();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Ennvo Notifications";
            String description = "Social updates, calls and messages";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{100, 200, 100, 200});

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    // Java Bridge class accessed from web Javascript
    public class AndroidBridge {
        Context mContext;

        AndroidBridge(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void showNotification(String title, String body, String icon, String type) {
            sendNotification(title, body, type);
        }

        @JavascriptInterface
        public void showNotification(String title, String body, String type) {
            sendNotification(title, body, type);
        }

        @JavascriptInterface
        public void sendNotification(String title, String body) {
            sendNotification(title, body, "general");
        }

        private void sendNotification(String title, String body, String type) {
            Intent intent = new Intent(mContext, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(mContext, 0, intent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);

            Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            NotificationCompat.Builder notificationBuilder =
                new NotificationCompat.Builder(mContext, CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setAutoCancel(true)
                    .setSound(defaultSoundUri)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setVibrate(new long[]{100, 200, 100, 200})
                    .setContentIntent(pendingIntent);

            NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

            if (notificationManager != null) {
                notificationManager.notify((int) System.currentTimeMillis(), notificationBuilder.build());
            }
        }

        @JavascriptInterface
        public void setStatusBarColor(String hexColor, boolean isDark) {
            runOnUiThread(() -> {
                try {
                    Window window = getWindow();
                    WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window, window.getDecorView());
                    if (insetsController != null) {
                        insetsController.setAppearanceLightStatusBars(!isDark);
                    }
                } catch (Exception e) {}
            });
        }

        @JavascriptInterface
        public void exitApp() {
            finishAffinity();
        }
    }
}
```

---

## Step 4: Sync & Build APK

Whenever you make changes to the React code:

```bash
npm run build
npx cap sync android
```

### To build the APK from Command Prompt:
```bash
cd android
gradlew assembleDebug
```
(On Mac/Linux: `./gradlew assembleDebug`)

Your APK will be ready in:
📁 `android/app/build/outputs/apk/debug/app-debug.apk`
