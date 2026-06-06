import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, CheckCheck, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import { fmtDate } from "@/lib/format";

export default function NotificationCenter({ className = "", browserAlerts = false, viewport = "all" }) {
  const navigate = useNavigate();
  const [viewportActive, setViewportActive] = useState(() => {
    if (typeof window === "undefined" || viewport === "all") return true;
    return viewport === "desktop"
      ? window.matchMedia("(min-width: 768px)").matches
      : window.matchMedia("(max-width: 767px)").matches;
  });
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const initialized = useRef(false);
  const latestId = useRef("");
  const unread = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  const reload = useCallback(async () => {
    if (!viewportActive) return;
    try {
      const rows = await listNotifications();
      const notifications = Array.isArray(rows) ? rows : [];
      const nextLatest = notifications[0];
      if (
        browserAlerts &&
        initialized.current &&
        nextLatest &&
        nextLatest.id !== latestId.current &&
        !nextLatest.read_at &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const notification = new Notification(nextLatest.title || "PBM notification", {
          body: nextLatest.body || "A new PBM update is available.",
          icon: "/pbm-icon-192.png",
          tag: nextLatest.id,
        });
        notification.onclick = () => {
          window.focus();
          window.location.assign(nextLatest.href || "/social");
        };
      }
      latestId.current = nextLatest?.id || "";
      initialized.current = true;
      setItems(notifications);
      setError("");
    } catch {
      setError("Notifications need the latest Supabase SQL.");
    } finally {
      setLoading(false);
    }
  }, [browserAlerts, viewportActive]);

  useEffect(() => {
    if (viewport === "all") return undefined;
    const media = window.matchMedia(viewport === "desktop" ? "(min-width: 768px)" : "(max-width: 767px)");
    const update = () => setViewportActive(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [viewport]);

  useEffect(() => {
    if (!viewportActive) return undefined;
    setLoading(true);
    reload();
    const interval = window.setInterval(reload, 30000);
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [reload, viewportActive]);

  const openItem = async (item) => {
    if (!item.read_at) {
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry)),
      );
      markNotificationRead(item.id).catch(() => undefined);
    }
    setOpen(false);
    navigate(item.href || "/social");
  };

  const markAll = async () => {
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || readAt })));
    await markAllNotificationsRead().catch(() => reload());
  };

  const enableBrowserAlerts = async () => {
    if (!("Notification" in window)) return;
    await Notification.requestPermission();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          reload();
        }}
        className={`relative inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition-colors ${className}`}
        aria-label="Open notifications"
        title="Notifications"
      >
        <Bell className="w-4 h-4" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-zinc-950 text-white text-[9px] font-bold leading-4 text-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/25"
            onClick={() => setOpen(false)}
            aria-label="Close notifications"
          />
          <section className="absolute right-3 top-3 bottom-3 w-[calc(100%-24px)] max-w-[420px] bg-white border border-zinc-200 rounded-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">PBM</div>
                <h2 className="font-heading font-extrabold text-xl text-zinc-950 mt-0.5">Notifications</h2>
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={markAll}
                    className="w-9 h-9 inline-flex items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
                    aria-label="Mark all notifications read"
                    title="Mark all read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-9 h-9 inline-flex items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
                  aria-label="Close notifications"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {browserAlerts && "Notification" in window && Notification.permission !== "granted" && (
              <button
                type="button"
                onClick={enableBrowserAlerts}
                className="mx-4 mt-4 px-3 py-2.5 rounded-md border border-zinc-200 text-left flex items-center gap-3 hover:bg-zinc-50 transition-colors"
              >
                <BellRing className="w-4 h-4 text-zinc-700 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold text-zinc-950">Enable browser alerts</span>
                  <span className="block text-xs text-zinc-500 mt-0.5">Show new PBM posts while the app is open.</span>
                </span>
              </button>
            )}

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="px-5 py-16 text-center text-sm text-zinc-400">Loading...</div>
              ) : error ? (
                <div className="px-5 py-16 text-center text-sm text-zinc-500">{error}</div>
              ) : items.length === 0 ? (
                <div className="px-5 py-16 text-center text-sm text-zinc-400">No notifications yet.</div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openItem(item)}
                      className={`w-full px-5 py-4 text-left hover:bg-zinc-50 transition-colors ${
                        item.read_at ? "bg-white" : "bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.read_at ? "bg-zinc-200" : "bg-zinc-950"}`} />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-zinc-950">{item.title}</span>
                          {item.body && <span className="block text-sm text-zinc-600 leading-relaxed mt-1 line-clamp-3">{item.body}</span>}
                          <span className="block text-xs text-zinc-400 tabular-nums mt-2">{fmtDate(item.created_at)}</span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
