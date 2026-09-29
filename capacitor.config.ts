import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ennvo.app',
  appName: 'Ennvo',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#0b0813',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      androidSpinnerStyle: 'small',
      spinnerColor: '#7c3aed',
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      overlaysWebView: true
    }
  }
};

export default config;
