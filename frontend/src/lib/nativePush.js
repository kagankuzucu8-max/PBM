import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { registerPushToken } from "@/lib/api";

let listenersReady = false;
let openHandler = null;

const platform = () => Capacitor.getPlatform();

const attachListeners = async () => {
  if (listenersReady || !Capacitor.isNativePlatform()) return;
  listenersReady = true;

  await PushNotifications.addListener("registration", ({ value }) => {
    registerPushToken({ token: value, platform: platform() }).catch(() => undefined);
  });

  await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const href = notification?.data?.href || "/social";
    if (openHandler) openHandler(href);
    else window.location.assign(href);
  });
};

export async function listenForNativePush(onOpen) {
  if (!Capacitor.isNativePlatform()) return { native: false };
  openHandler = onOpen || openHandler;
  await attachListeners();
  return { native: true };
}

export async function getNativePushPermission() {
  if (!Capacitor.isNativePlatform()) return "unsupported";
  const permission = await PushNotifications.checkPermissions();
  return permission.receive;
}

export async function initializeNativePush(onOpen) {
  if (!Capacitor.isNativePlatform()) return { native: false };
  await listenForNativePush(onOpen);
  if (platform() === "android") {
    await PushNotifications.createChannel({
      id: "pbm_social",
      name: "PBM Market Drops",
      description: "PBM Market Drop and position update notifications",
      importance: 4,
      visibility: 1,
      vibration: true,
    }).catch(() => undefined);
  }
  const permission = await PushNotifications.checkPermissions();
  if (permission.receive === "granted") await PushNotifications.register();
  return { native: true, permission: permission.receive };
}

export async function enableNativePush() {
  if (!Capacitor.isNativePlatform()) return { native: false };
  await attachListeners();
  if (platform() === "android") {
    await PushNotifications.createChannel({
      id: "pbm_social",
      name: "PBM Market Drops",
      description: "PBM Market Drop and position update notifications",
      importance: 4,
      visibility: 1,
      vibration: true,
    }).catch(() => undefined);
  }
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive !== "granted") {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive === "granted") await PushNotifications.register();
  return { native: true, permission: permission.receive };
}
