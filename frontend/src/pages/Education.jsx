import React, { useEffect, useMemo, useState } from "react";
import { Play, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fmtDate } from "@/lib/format";
import { addEducationVideo, deleteEducationVideo, listEducationVideos } from "@/lib/api";

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const normalizeYouTubeId = (value) => {
  const candidate = String(value || "").trim().replace(/[^a-zA-Z0-9_-].*$/, "");
  return YOUTUBE_ID_RE.test(candidate) ? candidate : "";
};

const extractYouTubeId = (url) => {
  const raw = String(url || "").trim();
  if (!raw) return "";

  const directId = normalizeYouTubeId(raw);
  if (directId) return directId;

  const looseMatch = raw.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/);
  if (looseMatch) return looseMatch[1];

  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    const parsed = new URL(hasScheme ? raw : `https://${raw}`);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") return normalizeYouTubeId(parsed.pathname.split("/").filter(Boolean)[0]);

    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const videoParam = parsed.searchParams.get("v");
      if (videoParam) return normalizeYouTubeId(videoParam);

      const nestedUrl = parsed.searchParams.get("u");
      if (parsed.pathname === "/attribution_link" && nestedUrl) return extractYouTubeId(nestedUrl);

      const parts = parsed.pathname.split("/").filter(Boolean);
      const keyedIndex = parts.findIndex((part) => ["embed", "shorts", "live", "v"].includes(part));
      if (keyedIndex >= 0) return normalizeYouTubeId(parts[keyedIndex + 1]);
    }
  } catch {
    return "";
  }

  return "";
};

const thumbnailFor = (youtubeId) => `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;

export default function EducationPage() {
  const { user, isAdmin } = useAuth();
  const [videos, setVideos] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [form, setForm] = useState({ title: "", video_url: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeVideo = useMemo(
    () => videos.find((video) => video.id === activeId) || videos[0],
    [activeId, videos]
  );

  const reload = async () => {
    try {
      const data = await listEducationVideos();
      setVideos(data || []);
    } catch (loadError) {
      setError(loadError.response?.data?.detail || loadError.message || "Videos could not be loaded.");
      setVideos([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const addVideo = async (event) => {
    event.preventDefault();
    setError("");
    const youtubeId = extractYouTubeId(form.video_url);
    if (!form.title.trim() || !youtubeId) {
      setError("Video name and a valid YouTube video link are required.");
      return;
    }

    setSaving(true);
    try {
      await addEducationVideo({
        title: form.title.trim(),
        video_url: form.video_url.trim(),
        youtube_id: youtubeId,
        thumbnail_url: thumbnailFor(youtubeId),
      });
      setForm({ title: "", video_url: "" });
      await reload();
    } catch (insertError) {
      setError(insertError.response?.data?.detail || insertError.message || "Video could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const deleteVideo = async (video) => {
    if (!confirm("Delete this video?")) return;
    try {
      await deleteEducationVideo(video.id);
      setVideos((items) => items.filter((item) => item.id !== video.id));
      if (activeId === video.id) setActiveId(null);
    } catch (deleteError) {
      setError(deleteError.response?.data?.detail || deleteError.message || "Video could not be deleted.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Education</div>
        <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">Education</h1>
        <p className="text-sm text-zinc-500 mt-1.5">Saved trading lessons and training videos for the PBM workspace.</p>
      </div>

      <div className="grid xl:grid-cols-[420px_1fr] gap-5">
        <div className="space-y-5">
          {isAdmin && (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
                New video
              </div>
              <form onSubmit={addVideo} className="p-5 space-y-3" data-testid="education-video-form">
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Video name"
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <input
                  value={form.video_url}
                  onChange={(event) => setForm({ ...form, video_url: event.target.value })}
                  placeholder="YouTube link"
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                {error && <div className="text-xs text-rose-600">{error}</div>}
                <button
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 bg-zinc-950 text-white rounded-md text-sm font-medium h-10 hover:bg-zinc-800 transition-colors disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" /> Add video
                </button>
              </form>
            </div>
          )}

          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
              Library
            </div>
            {loading ? (
              <div className="px-5 py-16 text-center text-sm text-zinc-400">Loading...</div>
            ) : videos.length === 0 ? (
              <div className="px-5 py-16 text-center text-sm text-zinc-400">No videos yet.</div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {videos.map((video) => (
                  <li key={video.id} className="group">
                    <button
                      onClick={() => setActiveId(video.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        activeVideo?.id === video.id ? "bg-zinc-50" : "hover:bg-zinc-50"
                      }`}
                      data-testid={`education-video-${video.id}`}
                    >
                      <div className="w-20 h-12 bg-zinc-100 border border-zinc-200 rounded overflow-hidden shrink-0">
                        <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-zinc-950 truncate">{video.title}</div>
                        <div className="text-xs text-zinc-400 tabular-nums mt-0.5">{fmtDate(video.created_at)}</div>
                      </div>
                      {isAdmin && video.user_id === user.id && (
                        <span
                          onClick={(event) => { event.stopPropagation(); deleteVideo(video); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-rose-600 transition-all"
                          role="button"
                          tabIndex={0}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
            Player
          </div>
          {!activeVideo ? (
            <div className="px-5 py-24 text-center text-sm text-zinc-400">
              <Play className="w-8 h-8 mx-auto text-zinc-300 mb-2" strokeWidth={1.25} />
              Select a video.
            </div>
          ) : (
            <div>
              <div className="aspect-video bg-zinc-950">
                <iframe
                  title={activeVideo.title}
                  src={`https://www.youtube.com/embed/${activeVideo.youtube_id}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <div className="p-5">
                <div className="font-semibold text-zinc-950">{activeVideo.title}</div>
                <div className="text-xs text-zinc-500 mt-1">{activeVideo.author_email || "PBM"}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
