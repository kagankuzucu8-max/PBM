import React, { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

const STORAGE_KEY = "pbm.mobile.install.dismissed";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function isIosSafari() {
  const userAgent = window.navigator.userAgent || "";
  const isAppleTouch =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(userAgent);
  return isAppleTouch && isSafari;
}

export default function MobileInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const isMobile = window.matchMedia?.("(max-width: 767px)")?.matches;
    const dismissed = window.localStorage.getItem(STORAGE_KEY) === "1";
    if (!isMobile || dismissed || isStandalone()) return undefined;

    if (isIosSafari()) {
      setIosHint(true);
      setVisible(true);
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setIosHint(false);
      setVisible(true);
    };

    const handleInstalled = () => {
      window.localStorage.setItem(STORAGE_KEY, "1");
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => undefined);
    window.localStorage.setItem(STORAGE_KEY, "1");
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="md:hidden fixed left-4 right-4 bottom-[72px] z-40 rounded-lg border border-zinc-200 bg-white shadow-xl">
      <div className="p-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-md bg-zinc-950 flex items-center justify-center shrink-0">
          <Smartphone className="w-4 h-4 text-white" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-zinc-950 leading-5">Install PBM</div>
          <div className="text-xs text-zinc-500 leading-5">
            {iosHint ? "Share menu > Add to Home Screen" : "Add PBM to your home screen."}
          </div>
        </div>
        {deferredPrompt ? (
          <button
            type="button"
            onClick={install}
            className="h-9 px-3 inline-flex items-center gap-2 rounded-md bg-zinc-950 text-white text-xs font-semibold active:bg-zinc-800 transition-colors"
            aria-label="Install PBM"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
            Add
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 active:bg-zinc-100 transition-colors shrink-0"
          aria-label="Dismiss install prompt"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
