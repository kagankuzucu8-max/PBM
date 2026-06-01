import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Plus, Bookmark } from "lucide-react";
import SymbolSearch from "@/components/SymbolSearch";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fetchTicker24h, getMarketType } from "@/lib/market";
import { fmtPrice, fmtPct } from "@/lib/format";

export default function Watchlists() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null);
  const [items, setItems] = useState([]);
  const [tickers, setTickers] = useState({});
  const [newListName, setNewListName] = useState("");
  const [adding, setAdding] = useState(false);

  const reloadLists = async () => {
    const { data } = await supabase.from("watchlists").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
    setLists(data || []);
    if ((data || []).length > 0 && !activeListId) setActiveListId(data[0].id);
  };

  useEffect(() => { if (user) reloadLists(); }, [user]);

  useEffect(() => {
    if (!activeListId) { setItems([]); return; }
    (async () => {
      const { data } = await supabase
        .from("watchlist_items")
        .select("*")
        .eq("watchlist_id", activeListId)
        .order("created_at", { ascending: true });
      setItems(data || []);
    })();
  }, [activeListId]);

  useEffect(() => {
    let alive = true;
    if (items.length === 0) return;
    const update = async () => {
      const results = await Promise.all(items.map((i) => fetchTicker24h(i.symbol).catch(() => null)));
      if (!alive) return;
      const m = {};
      results.forEach((t, idx) => { if (t) m[items[idx].symbol] = t; });
      setTickers(m);
    };
    update();
    const id = setInterval(update, 15_000);
    return () => { alive = false; clearInterval(id); };
  }, [items]);

  const createList = async () => {
    if (!newListName.trim()) return;
    await supabase.from("watchlists").insert({ user_id: user.id, name: newListName.trim() });
    setNewListName("");
    await reloadLists();
  };

  const deleteList = async (id) => {
    if (!confirm("Delete this watchlist?")) return;
    await supabase.from("watchlists").delete().eq("id", id);
    if (activeListId === id) setActiveListId(null);
    await reloadLists();
  };

  const addSymbol = async (sym) => {
    if (!activeListId) return;
    const { error } = await supabase.from("watchlist_items").insert({
      watchlist_id: activeListId,
      user_id: user.id,
      symbol: sym,
      market: getMarketType(sym),
    });
    if (!error) {
      const { data } = await supabase.from("watchlist_items").select("*").eq("watchlist_id", activeListId).order("created_at");
      setItems(data || []);
    }
    setAdding(false);
  };

  const removeItem = async (id) => {
    await supabase.from("watchlist_items").delete().eq("id", id);
    setItems((s) => s.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Workspace</div>
        <h1 className="text-4xl font-heading font-extrabold tracking-tight text-zinc-950 mt-1">Watchlists</h1>
        <p className="text-sm text-zinc-500 mt-1.5">Organize the markets you track. Click a row to open the full analysis view.</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-5">
        {/* Sidebar of lists */}
        <div className="space-y-3">
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">Your lists</div>
            <ul className="py-1">
              {lists.map((l) => (
                <li key={l.id} className="flex items-center group">
                  <button
                    onClick={() => setActiveListId(l.id)}
                    data-testid={`list-${l.name}`}
                    className={`flex-1 flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                      activeListId === l.id ? "bg-zinc-100 text-zinc-950 font-semibold" : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" strokeWidth={1.75} />
                    {l.name}
                  </button>
                  <button
                    onClick={() => deleteList(l.id)}
                    data-testid={`list-delete-${l.name}`}
                    className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-rose-600 transition-all"
                    aria-label="Delete list"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
              {lists.length === 0 && (
                <li className="px-4 py-4 text-xs text-zinc-400 text-center">No lists yet.</li>
              )}
            </ul>
            <div className="border-t border-zinc-100 p-3 flex gap-2">
              <input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createList()}
                placeholder="New list name"
                data-testid="new-list-name-input"
                className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
              <button
                onClick={createList}
                data-testid="create-list-btn"
                className="px-2.5 py-1.5 bg-zinc-950 text-white rounded text-xs font-semibold hover:bg-zinc-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="lg:col-span-3 bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between gap-3">
            <div className="text-[11px] tracking-[0.1em] uppercase font-semibold text-zinc-500">
              {lists.find((l) => l.id === activeListId)?.name || "Select a list"}
            </div>
            {activeListId && (
              <button
                onClick={() => setAdding((s) => !s)}
                data-testid="add-symbol-btn"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-950 hover:text-zinc-700"
              >
                <Plus className="w-3.5 h-3.5" /> Add symbol
              </button>
            )}
          </div>
          {adding && (
            <div className="px-5 py-3 border-b border-zinc-100">
              <SymbolSearch onPick={addSymbol} placeholder="BTCUSDT, ETHUSDT…" autoFocus />
            </div>
          )}
          {!activeListId ? (
            <div className="px-5 py-16 text-center text-sm text-zinc-400">Select or create a list to begin.</div>
          ) : items.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-zinc-400">No symbols. Use "Add symbol" to start.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">Symbol</th>
                  <th className="text-right px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">Price</th>
                  <th className="text-right px-5 py-2.5 text-[10px] tracking-[0.08em] uppercase font-semibold text-zinc-500">24h %</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const t = tickers[i.symbol];
                  const ch = t?.changePct;
                  return (
                    <tr key={i.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors group">
                      <td className="px-5 py-3">
                        <button onClick={() => navigate(`/asset/${i.symbol}`)} data-testid={`open-${i.symbol}`} className="font-semibold tabular-nums text-sm text-zinc-950 hover:underline">
                          {i.symbol}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-sm">{t ? fmtPrice(t.last) : "—"}</td>
                      <td className={`px-5 py-3 text-right tabular-nums text-sm font-medium ${ch == null ? "" : ch >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {ch == null ? "—" : fmtPct(ch)}
                      </td>
                      <td className="px-2 py-3">
                        <button onClick={() => removeItem(i.id)} data-testid={`remove-${i.symbol}`} className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-rose-600 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
