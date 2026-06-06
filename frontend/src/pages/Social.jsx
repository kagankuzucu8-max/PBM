import React, { useEffect, useState } from "react";
import { BadgeCheck, Expand, ImagePlus, Send, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { getMarketType } from "@/lib/market";
import { fmtDate } from "@/lib/format";
import { notifySocialPost } from "@/lib/api";

const BIASES = ["bullish", "bearish", "neutral"];
const CHANNEL_AUTHOR_NAME = "kaanxbt";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FALLBACK_IMAGE_BYTES = 4 * 1024 * 1024;

const cleanSymbol = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const safeFileName = (name) =>
  String(name || "position.png")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80) || "position.png";

const fileToDataUrl = (imageFile) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(imageFile);
  });

const friendlyUploadError = (uploadError) => {
  const message = uploadError?.message || "Image upload failed.";
  if (/bucket|not found|row-level security|policy|permission/i.test(message)) {
    return "Social image storage is not ready in Supabase. Run the updated Supabase SQL, then try again.";
  }
  return message;
};

export default function SocialPage() {
  const { user, isAdmin } = useAuth();
  const canPost = Boolean(isAdmin);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const [form, setForm] = useState({
    symbol: "BTCUSDT",
    timeframe: "1h",
    bias: "neutral",
    confidence: "",
    summary: "",
  });

  const reload = async () => {
    const { data } = await supabase
      .from("social_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);
    setPosts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const createPost = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!canPost) {
      setError("This PBM channel is read-only for your account.");
      return;
    }
    const symbol = cleanSymbol(form.symbol);
    if (!symbol || !file) {
      setError("Symbol and image are required.");
      return;
    }
    if (!file.type?.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image is too large. Please upload an image under 8 MB.");
      return;
    }

    setSaving(true);
    const imagePath = `${user.id}/${Date.now()}-${safeFileName(file.name)}`;
    const upload = await supabase.storage.from("social-images").upload(imagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/png",
    });

    let imageUrl = "";
    let storedImagePath = imagePath;

    if (upload.error) {
      if (file.size > FALLBACK_IMAGE_BYTES) {
        setSaving(false);
        setError(friendlyUploadError(upload.error));
        return;
      }
      storedImagePath = null;
      try {
        imageUrl = await fileToDataUrl(file);
      } catch (readError) {
        setSaving(false);
        setError(readError.message || friendlyUploadError(upload.error));
        return;
      }
    } else {
      const { data: publicData } = supabase.storage.from("social-images").getPublicUrl(imagePath);
      imageUrl = publicData.publicUrl;
    }

    const { data: createdPost, error: insertError } = await supabase
      .from("social_posts")
      .insert({
        user_id: user.id,
        author_email: user.email,
        author_nickname: CHANNEL_AUTHOR_NAME,
        symbol,
        market: getMarketType(symbol),
        timeframe: form.timeframe.trim() || "1h",
        bias: form.bias,
        confidence: form.confidence === "" ? null : Number(form.confidence),
        summary: form.summary.trim(),
        image_url: imageUrl,
        image_path: storedImagePath,
      })
      .select("*")
      .single();

    if (insertError) {
      if (storedImagePath) await supabase.storage.from("social-images").remove([storedImagePath]);
      setError(insertError.message);
    } else {
      notifySocialPost({
        post_id: createdPost?.id,
        symbol,
        timeframe: form.timeframe.trim() || "1h",
        bias: form.bias,
        confidence: form.confidence === "" ? null : Number(form.confidence),
        summary: form.summary.trim(),
        image_url: imageUrl,
      })
        .then((result) => {
          const webCount = result?.web_created || 0;
          const mailCount = result?.sent || 0;
          if (result?.skipped && webCount > 0) {
            setNotice(`Shared. Web notification sent to ${webCount} traders. Email is not configured.`);
          } else if (result?.skipped) {
            setNotice("Shared. No notification recipients were found.");
          } else {
            setNotice(`Shared. ${webCount} web and ${mailCount} email notifications sent.`);
          }
        })
        .catch(() => setNotice("Shared. Notifications could not be sent."));
      setFile(null);
      setForm({ symbol: "BTCUSDT", timeframe: "1h", bias: "neutral", confidence: "", summary: "" });
      await reload();
    }
    setSaving(false);
  };

  const deletePost = async (post) => {
    if (!confirm("Delete this post?")) return;
    await supabase.from("social_posts").delete().eq("id", post.id);
    if (post.image_path) await supabase.storage.from("social-images").remove([post.image_path]);
    setPosts((items) => items.filter((item) => item.id !== post.id));
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Community</div>
        <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">Social</h1>
        <p className="text-sm text-zinc-500 mt-1.5">Live PBM position updates and market notes.</p>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,760px)_320px] gap-5 items-start">
        <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
            <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Latest positions</div>
            <div className="text-xs tabular-nums text-zinc-400">{posts.length} posts</div>
          </div>

          {canPost && (
            <form onSubmit={createPost} className="px-5 py-5 border-b border-zinc-200" data-testid="social-post-form">
              <div className="flex items-start gap-3">
                <AuthorAvatar />
                <div className="min-w-0 flex-1 space-y-3">
                  <textarea
                    value={form.summary}
                    onChange={(event) => setForm({ ...form, summary: event.target.value })}
                    rows={3}
                    placeholder="Share a position update..."
                    className="w-full px-0 py-1 text-[15px] bg-white border-0 focus:outline-none resize-none placeholder:text-zinc-400"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      value={form.symbol}
                      onChange={(event) => setForm({ ...form, symbol: event.target.value })}
                      placeholder="Symbol"
                      className="min-w-0 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                    <input
                      value={form.timeframe}
                      onChange={(event) => setForm({ ...form, timeframe: event.target.value })}
                      placeholder="Timeframe"
                      className="min-w-0 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                    <select
                      value={form.bias}
                      onChange={(event) => setForm({ ...form, bias: event.target.value })}
                      className="min-w-0 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      {BIASES.map((bias) => (
                        <option key={bias} value={bias}>{bias}</option>
                      ))}
                    </select>
                    <input
                      value={form.confidence}
                      onChange={(event) => setForm({ ...form, confidence: event.target.value })}
                      type="number"
                      step="any"
                      min="-100"
                      max="100"
                      placeholder="Score"
                      className="min-w-0 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <label className="min-w-0 flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-950 transition-colors cursor-pointer">
                      <span className="w-9 h-9 inline-flex items-center justify-center border border-zinc-200 rounded-md shrink-0">
                        <ImagePlus className="w-4 h-4" strokeWidth={1.75} />
                      </span>
                      <span className="truncate max-w-48">{file ? file.name : "Add chart image"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => setFile(event.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 bg-zinc-950 text-white rounded-md text-sm font-medium h-9 px-4 hover:bg-zinc-800 transition-colors disabled:opacity-60"
                    >
                      <Send className="w-4 h-4" strokeWidth={1.75} />
                      Share
                    </button>
                  </div>
                  {error && <div className="text-xs text-rose-600">{error}</div>}
                  {notice && <div className="text-xs text-emerald-700">{notice}</div>}
                </div>
              </div>
            </form>
          )}

          {loading ? (
            <div className="px-5 py-16 text-center text-sm text-zinc-400">Loading...</div>
          ) : posts.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-zinc-400">No posts yet.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {posts.map((post) => (
                <article key={post.id} className="px-5 py-5 bg-white hover:bg-zinc-50/50 transition-colors" data-testid={`social-post-${post.symbol}`}>
                  <div className="flex items-start gap-3">
                    <AuthorAvatar />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-sm text-zinc-950 truncate">
                              {post.author_nickname || CHANNEL_AUTHOR_NAME}
                            </span>
                            <BadgeCheck className="w-4 h-4 text-zinc-700 shrink-0" strokeWidth={2} />
                            <span className="text-xs text-zinc-400 truncate">@pbm · {fmtDate(post.created_at)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="font-semibold tabular-nums text-zinc-950">{post.symbol}</span>
                            <span className="text-xs text-zinc-500">{post.timeframe}</span>
                            <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${biasClass(post.bias)}`}>
                              {post.bias}
                            </span>
                            {post.confidence != null && (
                              <span className="text-xs tabular-nums text-zinc-500">
                                Score <span className="font-semibold text-zinc-800">{Number(post.confidence).toFixed(0)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        {post.user_id === user.id && (
                          <button onClick={() => deletePost(post)} className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors" aria-label="Delete post">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {post.summary && <p className="text-sm text-zinc-700 leading-relaxed mt-3 whitespace-pre-wrap">{post.summary}</p>}

                      <button
                        type="button"
                        onClick={() => setActiveImage(post)}
                        className="relative block w-full aspect-video mt-3 bg-zinc-50 border border-zinc-200 rounded-lg overflow-hidden text-left group"
                        aria-label={`Open ${post.symbol} image`}
                      >
                        <img src={post.image_url} alt={post.symbol} className="w-full h-full object-cover" />
                        <span className="absolute right-2 top-2 w-8 h-8 inline-flex items-center justify-center rounded-md bg-white/90 border border-zinc-200 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Expand className="w-4 h-4" />
                        </span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="bg-white border border-zinc-200 rounded-lg overflow-hidden xl:sticky xl:top-8">
          <div className="px-5 py-3.5 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
            Channel
          </div>
          <div className="p-5">
            <div className="flex items-center gap-3">
              <AuthorAvatar size="large" />
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-zinc-950">
                  PBM Social
                  <BadgeCheck className="w-4 h-4 text-zinc-700" />
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">@pbm</div>
              </div>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed mt-4">
              Official PBM position channel. New posts are delivered to the web notification center and email.
            </p>
            {!canPost && (
              <div className="mt-4 px-3 py-2.5 border border-zinc-200 rounded-md text-xs text-zinc-500">
                This channel is read-only for your account.
              </div>
            )}
          </div>
        </aside>
      </div>

      {activeImage && (
        <div className="fixed inset-0 bg-zinc-950/70 z-50 flex items-center justify-center p-4 md:p-6" onClick={() => setActiveImage(null)}>
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden max-w-5xl w-full" onClick={(event) => event.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Position snapshot</div>
                <div className="font-semibold tabular-nums text-zinc-950 mt-0.5">{activeImage.symbol}</div>
              </div>
              <button onClick={() => setActiveImage(null)} className="p-2 text-zinc-500 hover:text-zinc-950 transition-colors" aria-label="Close image">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-zinc-50">
              <img src={activeImage.image_url} alt={activeImage.symbol} className="w-full max-h-[78vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthorAvatar({ size = "default" }) {
  const dimensions = size === "large" ? "w-11 h-11" : "w-9 h-9";
  return (
    <div className={`${dimensions} rounded-md bg-zinc-950 text-white inline-flex items-center justify-center font-heading font-extrabold text-xs shrink-0`}>
      PBM
    </div>
  );
}

function biasClass(bias) {
  if (bias === "bullish") return "bg-emerald-100 text-emerald-700";
  if (bias === "bearish") return "bg-rose-100 text-rose-700";
  return "bg-zinc-100 text-zinc-700";
}
