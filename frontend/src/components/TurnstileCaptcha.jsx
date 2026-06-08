import React, { useEffect, useRef } from "react";
import { getRuntimeEnv } from "@/lib/runtimeEnv";

const TURNSTILE_SCRIPT_ID = "pbm-turnstile-script";
const TURNSTILE_SITE_KEY = getRuntimeEnv("REACT_APP_TURNSTILE_SITE_KEY");

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.turnstile), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile could not load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => reject(new Error("Turnstile could not load"));
    document.head.appendChild(script);
  });
}

export const TURNSTILE_CONFIGURED = Boolean(TURNSTILE_SITE_KEY);

export default function TurnstileCaptcha({ onToken, resetKey }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return undefined;

    let active = true;
    loadTurnstile()
      .then((turnstile) => {
        if (!active || !turnstile || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "light",
          appearance: "interaction-only",
          size: "flexible",
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
      })
      .catch(() => onToken(""));

    return () => {
      active = false;
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onToken]);

  useEffect(() => {
    if (!window.turnstile || widgetIdRef.current === null) return;
    window.turnstile.reset(widgetIdRef.current);
    onToken("");
  }, [onToken, resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;

  return <div ref={containerRef} className="w-full min-h-[1px]" aria-label="Security verification" />;
}
