import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.erfan.ennvoapp',
  appName: 'Ennvo',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    backgroundColor: '#ffffff'
  },
  plugins: {
    // Ennvo handles the window insets itself: the Android shell pads the
    // content view by the keyboard height, so the page reflows exactly like a
    // native app. Letting Capacitor do it as well applied the keyboard height
    // twice, which made the page jump and showed a black band on top.
    SystemBars: {
      insetsHandling: 'disable',
      hidden: true,
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      launchFadeOutDuration: 100,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      overlaysWebView: true
    }
  }
};

export default config;
