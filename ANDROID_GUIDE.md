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

import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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

        // 2. Transparent modern Status Bar & Navigation
        window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
        window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);

        // 3. Ultra-Fast WebView caching & smooth rendering
        if (bridge != null && bridge.getWebView() != null) {
            WebView webView = bridge.getWebView();
            WebSettings settings = webView.getSettings();
            settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            webView.setScrollBarStyle(WebView.SCROLLBARS_INSIDE_OVERLAY);
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
