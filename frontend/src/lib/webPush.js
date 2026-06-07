import { getApp, getApps, initializeApp } from "firebase/app";
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { registerPushToken } from "@/lib/api";
import { getRuntimeEnv } from "@/lib/runtimeEnv";

const firebaseConfig = () => ({
  apiKey: getRuntimeEnv("REACT_APP_FIREBASE_API_KEY"),
  authDomain: getRuntimeEnv("REACT_APP_FIREBASE_AUTH_DOMAIN"),
  projectId: getRuntimeEnv("REACT_APP_FIREBASE_PROJECT_ID"),
  storageBucket: getRuntimeEnv("REACT_APP_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getRuntimeEnv("REACT_APP_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getRuntimeEnv("REACT_APP_FIREBASE_APP_ID"),
});

const vapidKey = () => getRuntimeEnv("REACT_APP_FIREBASE_VAPID_KEY");

const messagingClient = async () => {
  if (!(await isSupported())) throw new Error("Web Push is not supported on this device.");
  const config = firebaseConfig();
  if (!config.apiKey || !config.projectId || !config.messagingSenderId || !config.appId || !vapidKey()) {
    throw new Error("Firebase Web Push configuration is missing.");
  }
  const app = getApps().length ? getApp() : initializeApp(config);
  return getMessaging(app);
};

export async function enableWebPush() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Web Push is not supported on this device.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const registration = await navigator.serviceWorker.ready;
  const messaging = await messagingClient();
  const token = await getToken(messaging, { vapidKey: vapidKey(), serviceWorkerRegistration: registration });
  if (!token) throw new Error("The browser did not return a Web Push token.");
  await registerPushToken({ token, platform: "web", active: true });
  return { permission, token };
}

export async function disableWebPush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const messaging = await messagingClient();
  const token = await getToken(messaging, { vapidKey: vapidKey(), serviceWorkerRegistration: registration });
  if (token) {
    await registerPushToken({ token, platform: "web", active: false }).catch(() => undefined);
    await deleteToken(messaging).catch(() => undefined);
  }
}
