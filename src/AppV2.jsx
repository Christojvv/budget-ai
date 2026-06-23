import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://hcbawiywefgzhjhfjwee.supabase.co",
  "sb_publishable_t39og82lzf6d0_7visdAhw_qoPD4jLf"
);

const formatZAR = (value) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(value || 0));

const DEFAULT_CATEGORIES = ["Groceries", "Transport", "Eating Out", "Entertainment", "Medical", "Subscriptions", "Other"];

const load = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  const [tab, setTab] = useState("accounts");
  const [accounts, setAccounts] = useState(() => load("accounts", [
    { id: 1, name: "Primary Account", balance: 12450.75 },
    { id: 2, name: "Savings Account", balance: 45000 },
    { id: 3, name: "Investment Account", balance: 98000 },
  ]));
  const [nextAccId, setNextAccId] = useState(() => load("nextAccId", 4));
  const [openId, setOpenId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [tempValue, setTempValue] = useState("");

  const [categories, setCategories] = useState([]);
  const [weeklyBudget, setWeeklyBudget] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [newCatName, setNewCatName] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [pendingTxs, setPendingTxs] = useState([]);
  const [showPending, setShowPending] = useState(false);
  const [budgetView, setBudgetView] = useState("overview");
  const [dbLoading, setDbLoading] = useState(false);
  const fileRef = useRef();

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load user data from Supabase when logged in
  useEffect(() => {
    if (!session) return;
    loadUserData();
  }, [session]);

  const loadUserData = async () => {
    setDbLoading(true);
    const uid = session.user.id;

    const [{ data: cats }, { data: budgets }, { data: txs }] = await Promise.all([
      supabase.from("categories").select("*").eq("user_id", uid),
      supabase.from("budgets").select("*").eq("user_id", uid).single(),
      supabase.from("transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    ]);

    if (cats && cats.length > 0) {
      setCategories(cats.map((c) => ({ id: c.id, name: c.name, budget: c.budget })));
    } else {
      const defaults = DEFAULT_CATEGORIES.map((name, i) => ({ id: i + 1, name, budget: 0 }));
      setCategories(defaults);
      await Promise.all(defaults.map((c) =>
        supabase.from("categories").insert({ id: c.id, name: c.name, budget: c.budget, user_id: uid })
      ));
    }

    if (budgets) {
      setWeeklyBudget(budgets.weekly || 0);
      setMonthlyBudget(budgets.monthly || 0);
    }

    if (txs) {
      setTransactions(txs.map((t) => ({ id: t.id, description: t.description, amount: t.amount, date: t.date, categoryId: t.category_id })));
    }

    setDbLoading(false);
  };

  // Persist accounts locally
  useEffect(() => save("accounts", accounts), [accounts]);
  useEffect(() => save("nextAccId", nextAccId), [nextAccId]);

  // Sync budgets to Supabase
  const syncBudgets = async (weekly, monthly) => {
    if (!session) return;
    await supabase.from("budgets").upsert({ user_id: session.user.id, weekly, monthly });
  };

  const total = accounts.reduce((sum, a) => sum + a.balance, 0);
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0,0,0,0); return d; })();
  const weeklySpent = transactions.filter((t) => new Date(t.date) >= weekStart).reduce((s, t) => s + t.amount, 0);
  const monthlySpent = transactions.filter((t) => new Date(t.date).getMonth() === new Date().getMonth()).reduce((s, t) => s + t.amount, 0);
  const totalSpent = transactions.reduce((s, t) => s + t.amount, 0);
  const spentByCategory = (catId) => transactions.filter((t) => t.categoryId === catId).reduce((s, t) => s + t.amount, 0);

  // Auth handlers
  const handleSignUp = async () => {
    setAuthError(""); setAuthMsg("");
    const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
    else setAuthMsg("Check your email to confirm your account!");
  };

  const handleLogin = async () => {
    setAuthError(""); setAuthMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setTransactions([]); setCategories([]); setWeeklyBudget(0); setMonthlyBudget(0);
  };

  // Account handlers
  const toggleCard = (id) => setOpenId((prev) => (prev === id ? null : id));
  const requestDelete = (e, id) => { e.stopPropagation(); setPendingDeleteId(id); setShowConfirm(true); };
  const confirmDelete = () => {
    setAccounts((prev) => prev.filter((a) => a.id !== pendingDeleteId));
    if (openId === pendingDeleteId) setOpenId(null);
    setShowConfirm(false); setPendingDeleteId(null);
  };
  const addAccount = () => {
    if (!newName.trim()) return;
    setAccounts((prev) => [...prev, { id: nextAccId, name: newName.trim(), balance: 0 }]);
    setNextAccId((n) => n + 1);
    setNewName(""); setShowAddAccount(false);
  };
  const startEditing = (e, id, balance) => { e.stopPropagation(); setEditingId(id); setTempValue(balance); };
  const saveBalance = (id) => {
    setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, balance: parseFloat(tempValue) || 0 } : a));
    setEditingId(null);
  };

  // Category handlers
  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const newCat = { id: Date.now(), name: newCatName.trim(), budget: 0 };
    setCategories((prev) => [...prev, newCat]);
    setNewCatName("");
    if (session) await supabase.from("categories").insert({ ...newCat, user_id: session.user.id });
  };
  const updateCatBudget = async (id, val) => {
    const budget = parseFloat(val) || 0;
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, budget } : c));
    if (session) await supabase.from("categories").update({ budget }).eq("id", id).eq("user_id", session.user.id);
  };
  const deleteCategory = async (id) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    if (session) await supabase.from("categories").delete().eq("id", id).eq("user_id", session.user.id);
  };

  // Transaction handlers
  const confirmPendingTxs = async () => {
    setTransactions((prev) => [...prev, ...pendingTxs]);
    if (session) {
      await Promise.all(pendingTxs.map((t) =>
        supabase.from("transactions").insert({
          id: t.id, description: t.description, amount: t.amount,
          date: t.date, category_id: t.categoryId, user_id: session.user.id
        })
      ));
    }
    setPendingTxs([]); setShowPending(false);
  };

  const clearAllTransactions = async () => {
    setTransactions([]);
    if (session) await supabase.from("transactions").delete().eq("user_id", session.user.id);
    setShowClearConfirm(false);
  };

  // Screenshot handler
  const handleScreenshot = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAiLoading(true); setAiError("");
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const categoryList = categories.map((c) => `${c.id}: ${c.name}`).join(", ");
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.REACT_APP_ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: file.type, data: base64 } },
              { type: "text", text: `Extract all transactions from this banking screenshot. Return ONLY a JSON array, no markdown, no explanation. Each item: {"description": string, "amount": number (positive ZAR), "date": "YYYY-MM-DD", "categoryId": number}. Assign the most appropriate categoryId from: ${categoryList}. If unsure use the last id. Today is ${new Date().toISOString().split("T")[0]}.` }
            ]
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.find((b) => b.type === "text")?.text || "[]";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      const withIds = parsed.map((t) => ({ ...t, id: crypto.randomUUID(), categoryId: t.categoryId || categories[categories.length - 1].id }));
      setPendingTxs(withIds);
      setShowPending(true);
    } catch {
      setAiError("Could not parse screenshot. Try a clearer image.");
    } finally {
      setAiLoading(false);
      e.target.value = "";
    }
  };

  const s = {
    page: { minHeight: "100vh", background: "radial-gradient(circle at top, #f8fafc 0%, #eef2f7 100%)", display: "flex", justifyContent: "center", padding: "32px 20px", fontFamily: "ui-sans-serif, system-ui, sans-serif", color: "#0f172a" },
    wrap: { width: "100%", maxWidth: 960 },
    tabs: { display: "flex", gap: 8, marginBottom: 32, background: "white", padding: 6, borderRadius: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.07)", width: "fit-content" },
    tab: (a) => ({ padding: "10px 24px", borderRadius: 12, border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer", background: a ? "linear-gradient(135deg,#6d28d9,#8b5cf6)" : "transparent", color: a ? "white" : "#64748b", transition: "0.2s" }),
    card: (open) => ({ background: "rgba(255,255,255,0.9)", borderRadius: 20, padding: 20, position: "relative", cursor: "pointer", transition: "0.25s ease", border: "1px solid rgba(15,23,42,0.06)", boxShadow: open ? "0 18px 40px rgba(0,0,0,0.12)" : "0 8px 20px rgba(0,0,0,0.06)", transform: open ? "translateY(-4px)" : "translateY(0)" }),
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 },
    overlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20, zIndex: 100 },
    modal: { width: "100%", maxWidth: 380, background: "white", borderRadius: 20, padding: 26, boxShadow: "0 30px 80px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", gap: 14, boxSizing: "border-box" },
    input: { width: "100%", padding: 12, borderRadius: 14, border: "1px solid #dbe2ea", textAlign: "center", fontSize: 14, boxSizing: "border-box" },
    btnPrimary: { flex: 1, padding: 12, borderRadius: 14, border: "none", background: "linear-gradient(135deg,#6d28d9,#8b5cf6)", color: "white", fontWeight: 600, cursor: "pointer" },
    btnSecondary: { flex: 1, padding: 12, borderRadius: 14, border: "1px solid #dbe2ea", background: "white", cursor: "pointer" },
    section: { background: "white", borderRadius: 20, padding: 24, boxShadow: "0 8px 20px rgba(0,0,0,0.06)", marginBottom: 18 },
    label: { fontSize: 12, opacity: 0.55, marginBottom: 4 },
    progressBar: (pct, over) => ({ height: 8, borderRadius: 99, background: over ? "#ef4444" : "#8b5cf6", width: `${Math.min(pct, 100)}%`, transition: "width 0.4s ease" }),
  };

  // Auth screen
  if (authLoading) return <div style={{ ...s.page, justifyContent: "center", alignItems: "center" }}><div style={{ fontSize: 16, opacity: 0.5 }}>Loading…</div></div>;

  if (!session) return (
    <div style={{ ...s.page, alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1 }}>💰 MyBudget</div>
          <div style={{ fontSize: 13, opacity: 0.5, marginTop: 6 }}>Your personal finance tracker</div>
        </div>
        <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            {["login", "signup"].map((m) => (
              <button key={m} onClick={() => { setAuthMode(m); setAuthError(""); setAuthMsg(""); }} style={{ flex: 1, padding: 10, borderRadius: 12, border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", background: authMode === m ? "#0f172a" : "#f1f5f9", color: authMode === m ? "white" : "#64748b" }}>
                {m === "login" ? "Log In" : "Sign Up"}
              </button>
            ))}
          </div>
          <div>
            <div style={s.label}>Email</div>
            <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="you@email.com" style={{ ...s.input, textAlign: "left" }} />
          </div>
          <div>
            <div style={s.label}>Password</div>
            <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (authMode === "login" ? handleLogin() : handleSignUp())} placeholder="••••••••" style={{ ...s.input, textAlign: "left" }} />
          </div>
          {authError && <div style={{ color: "#ef4444", fontSize: 13 }}>{authError}</div>}
          {authMsg && <div style={{ color: "#10b981", fontSize: 13 }}>{authMsg}</div>}
          <button onClick={authMode === "login" ? handleLogin : handleSignUp} style={{ ...s.btnPrimary, padding: 14 }}>
            {authMode === "login" ? "Log In" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );

  if (dbLoading) return <div style={{ ...s.page, justifyContent: "center", alignItems: "center" }}><div style={{ fontSize: 16, opacity: 0.5 }}>Loading your data…</div></div>;

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={s.tabs}>
            <button style={s.tab(tab === "accounts")} onClick={() => setTab("accounts")}>💳 Accounts</button>
            <button style={s.tab(tab === "budget")} onClick={() => setTab("budget")}>📊 Budget Tracker</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 13, opacity: 0.5 }}>{session.user.email}</div>
            <button onClick={handleLogout} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid #dbe2ea", background: "white", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Log Out</button>
          </div>
        </div>

        {/* ACCOUNTS TAB */}
        {tab === "accounts" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 6 }}>Total Portfolio</div>
              <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1 }}>{formatZAR(total)}</div>
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.5 }}>Live account overview</div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
              <button onClick={() => setShowAddAccount(true)} style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#6d28d9,#8b5cf6)", color: "white", fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 10px 25px rgba(109,40,217,0.25)" }}>+ Add Account</button>
            </div>
            <div style={s.grid}>
              {accounts.map((account) => (
                <div key={account.id} onClick={() => toggleCard(account.id)} onMouseEnter={() => setHoverId(account.id)} onMouseLeave={() => setHoverId(null)} style={s.card(openId === account.id)}>
                  {hoverId === account.id && (
                    <button onClick={(e) => requestDelete(e, account.id)} style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: 8, border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                  )}
                  <div style={{ fontSize: 16, fontWeight: 650, marginBottom: 10 }}>{account.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>Balance</div>
                  {editingId === account.id ? (
                    <input autoFocus value={tempValue} onChange={(e) => setTempValue(e.target.value)} onBlur={() => saveBalance(account.id)} onKeyDown={(e) => e.key === "Enter" && saveBalance(account.id)} onClick={(e) => e.stopPropagation()} style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #dbe2ea", textAlign: "center", fontSize: 20, fontWeight: 700, boxSizing: "border-box" }} />
                  ) : (
                    <div onClick={(e) => startEditing(e, account.id, account.balance)} style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>{formatZAR(account.balance)}</div>
                  )}
                  <div style={{ maxHeight: openId === account.id ? 180 : 0, overflow: "hidden", transition: "max-height 0.35s ease" }}>
                    <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "#f8fafc", fontSize: 12, lineHeight: 1.7, color: "#475569" }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Account Intelligence</div>
                      <div>• Status: Active</div>
                      <div>• Monthly Trend: Stable</div>
                      <div>• Security Level: Verified</div>
                      <div>• Last Activity: Recent</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* BUDGET TAB */}
        {tab === "budget" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {["overview", "categories", "transactions"].map((v) => (
                <button key={v} onClick={() => setBudgetView(v)} style={{ padding: "8px 18px", borderRadius: 10, border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", background: budgetView === v ? "#0f172a" : "#e2e8f0", color: budgetView === v ? "white" : "#64748b" }}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            <div style={{ ...s.section, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>📸 Upload Banking Screenshot</div>
                <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>AI will extract and categorise your transactions</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleScreenshot} style={{ display: "none" }} />
              <button onClick={() => fileRef.current.click()} disabled={aiLoading} style={{ marginLeft: "auto", padding: "10px 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#6d28d9,#8b5cf6)", color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: aiLoading ? 0.6 : 1 }}>
                {aiLoading ? "Processing…" : "Choose Image"}
              </button>
              {aiError && <div style={{ width: "100%", color: "#ef4444", fontSize: 13 }}>{aiError}</div>}
            </div>

            {budgetView === "overview" && (
              <>
                <div style={s.section}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Budget Settings</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={s.label}>Weekly Budget</div>
                      <input type="number" value={weeklyBudget || ""} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setWeeklyBudget(v); syncBudgets(v, monthlyBudget); }} placeholder="0.00" style={{ ...s.input, textAlign: "left" }} />
                    </div>
                    <div>
                      <div style={s.label}>Monthly Budget</div>
                      <input type="number" value={monthlyBudget || ""} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setMonthlyBudget(v); syncBudgets(weeklyBudget, v); }} placeholder="0.00" style={{ ...s.input, textAlign: "left" }} />
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
                  {[
                    { label: "Spent This Week", amount: weeklySpent, budget: weeklyBudget },
                    { label: "Spent This Month", amount: monthlySpent, budget: monthlyBudget },
                    { label: "Total All Time", amount: totalSpent, budget: null },
                  ].map((item) => {
                    const pct = item.budget ? (item.amount / item.budget) * 100 : 0;
                    const over = pct > 100;
                    return (
                      <div key={item.label} style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 8px 20px rgba(0,0,0,0.06)" }}>
                        <div style={s.label}>{item.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{formatZAR(item.amount)}</div>
                        {item.budget > 0 && (
                          <>
                            <div style={{ height: 8, borderRadius: 99, background: "#e2e8f0", marginBottom: 4 }}>
                              <div style={s.progressBar(pct, over)} />
                            </div>
                            <div style={{ fontSize: 11, color: over ? "#ef4444" : "#64748b" }}>
                              {over ? `Over by ${formatZAR(item.amount - item.budget)}` : `${formatZAR(item.budget - item.amount)} remaining`}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={s.section}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Category Breakdown</div>
                  {categories.map((cat) => {
                    const spent = spentByCategory(cat.id);
                    const pct = cat.budget ? (spent / cat.budget) * 100 : 0;
                    const over = pct > 100;
                    return (
                      <div key={cat.id} style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                          <span>{cat.name}</span>
                          <span style={{ color: over ? "#ef4444" : "#0f172a" }}>{formatZAR(spent)}{cat.budget > 0 ? ` / ${formatZAR(cat.budget)}` : ""}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 99, background: "#e2e8f0" }}>
                          {cat.budget > 0 && <div style={s.progressBar(pct, over)} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {budgetView === "categories" && (
              <div style={s.section}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Manage Categories</div>
                {categories.map((cat) => (
                  <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{cat.name}</div>
                    <input type="number" value={cat.budget || ""} onChange={(e) => updateCatBudget(cat.id, e.target.value)} placeholder="Budget" style={{ width: 120, padding: "8px 12px", borderRadius: 10, border: "1px solid #dbe2ea", fontSize: 13, boxSizing: "border-box" }} />
                    <button onClick={() => deleteCategory(cat.id)} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} placeholder="New category name" style={{ ...s.input, textAlign: "left", flex: 1 }} />
                  <button onClick={addCategory} style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#6d28d9,#8b5cf6)", color: "white", fontWeight: 600, cursor: "pointer" }}>Add</button>
                </div>
              </div>
            )}

            {budgetView === "transactions" && (
              <div style={s.section}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>All Transactions ({transactions.length})</div>
                  {transactions.length > 0 && (
                    <button onClick={() => setShowClearConfirm(true)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Clear All</button>
                  )}
                </div>
                {transactions.length === 0 && <div style={{ opacity: 0.5, fontSize: 13 }}>No transactions yet. Upload a screenshot to get started.</div>}
                {transactions.map((tx) => {
                  const cat = categories.find((c) => c.id === tx.categoryId);
                  return (
                    <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{tx.description}</div>
                        <div style={{ fontSize: 11, opacity: 0.5 }}>{tx.date} · {cat?.name || "Uncategorised"}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: "#ef4444" }}>-{formatZAR(tx.amount)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* MODALS */}
      {showAddAccount && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ textAlign: "center", fontSize: 18, fontWeight: 600 }}>Create New Account</div>
            <div>
              <div style={s.label}>Account Name</div>
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addAccount()} placeholder="e.g. Emergency Fund" style={s.input} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={addAccount} style={s.btnPrimary}>Add</button>
              <button onClick={() => setShowAddAccount(false)} style={s.btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div style={{ ...s.overlay, zIndex: 200 }}>
          <div style={{ ...s.modal, maxWidth: 320, textAlign: "center" }}>
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>Delete this account?</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={confirmDelete} style={{ ...s.btnPrimary, background: "#ef4444" }}>Delete</button>
              <button onClick={() => setShowConfirm(false)} style={s.btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div style={{ ...s.overlay, zIndex: 200 }}>
          <div style={{ ...s.modal, maxWidth: 320, textAlign: "center" }}>
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>Clear all transactions? This cannot be undone.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={clearAllTransactions} style={{ ...s.btnPrimary, background: "#ef4444" }}>Clear All</button>
              <button onClick={() => setShowClearConfirm(false)} style={s.btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPending && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: 500, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Review Extracted Transactions</div>
            <div style={{ fontSize: 12, opacity: 0.5 }}>Adjust categories if needed, then confirm.</div>
            {pendingTxs.map((tx, i) => (
              <div key={tx.id} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{tx.description}</div>
                  <div style={{ fontWeight: 700, color: "#ef4444" }}>-{formatZAR(tx.amount)}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, opacity: 0.5 }}>{tx.date}</span>
                  <select value={tx.categoryId} onChange={(e) => setPendingTxs((prev) => prev.map((t, j) => j === i ? { ...t, categoryId: parseInt(e.target.value) } : t))} style={{ marginLeft: "auto", padding: "4px 8px", borderRadius: 8, border: "1px solid #dbe2ea", fontSize: 12 }}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={confirmPendingTxs} style={s.btnPrimary}>Confirm All</button>
              <button onClick={() => setShowPending(false)} style={s.btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}