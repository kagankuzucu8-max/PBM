import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { initializeNativePush, listenForNativePush } from "@/lib/nativePush";
import { useAuth } from "@/context/AuthContext";

export default function MobileNativeBridge() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let active = true;
    const handles = [];

    const setup = async () => {
      await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
      await StatusBar.setBackgroundColor({ color: "#FAFAFA" }).catch(() => undefined);
      await SplashScreen.hide().catch(() => undefined);
      await listenForNativePush((href) => navigate(href || "/social")).catch(() => undefined);

      const backHandle = await NativeApp.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else NativeApp.exitApp();
      });
      if (active) handles.push(backHandle);
      else backHandle.remove();

    };

    setup().catch(() => undefined);
    return () => {
      active = false;
      handles.forEach((handle) => handle.remove());
    };
  }, [navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user?.id) return;
    initializeNativePush((href) => navigate(href || "/social")).catch(() => undefined);
  }, [navigate, user?.id]);

  return null;
}
