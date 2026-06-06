import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pbm.trading",
  appName: "PBM",
  webDir: "build",
  server: {
    url: process.env.PBM_MOBILE_URL || "https://pbm-marketdesk.kagankuzucu8-max.workers.dev",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#FAFAFA",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#FAFAFA",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#FAFAFA",
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
