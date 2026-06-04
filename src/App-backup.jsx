import { useEffect, useState } from "react";

const formatZAR = (value) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number(value || 0));

let nextId = 4;

export default function App() {
  const [accounts, setAccounts] = useState([
    { id: 1, name: "Primary Account", balance: 12450.75 },
    { id: 2, name: "Savings Account", balance: 45000 },
    { id: 3, name: "Investment Account", balance: 98000 },
  ]);

  const [openId, setOpenId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [tempValue, setTempValue] = useState("");

  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  const toggleCard = (id) => setOpenId((prev) => (prev === id ? null : id));

  const requestDelete = (e, id) => {
    e.stopPropagation();
    setPendingDeleteId(id);
    setShowConfirm(true);
  };

  const confirmDelete = () => {
    setAccounts((prev) => prev.filter((a) => a.id !== pendingDeleteId));
    if (openId === pendingDeleteId) setOpenId(null);
    setShowConfirm(false);
    setPendingDeleteId(null);
  };

  const addAccount = () => {
    if (!newName.trim()) return;
    setAccounts((prev) => [...prev, { id: nextId++, name: newName.trim(), balance: 0 }]);
    setNewName("");
    setShowModal(false);
  };

  const startEditing = (e, id, balance) => {
    e.stopPropagation();
    setEditingId(id);
    setTempValue(balance);
  };

  const saveBalance = (id) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, balance: parseFloat(tempValue) || 0 } : a))
    );
    setEditingId(null);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top, #f8fafc 0%, #eef2f7 100%)",
        display: "flex",
        justifyContent: "center",
        padding: "48px 20px",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ width: "100%", maxWidth: 920 }}>

        {/* HEADER */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 6 }}>Total Portfolio</div>
          <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1 }}>{formatZAR(total)}</div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.5 }}>Live account overview</div>
        </div>

        {/* ADD BUTTON */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: "12px 22px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, #6d28d9, #8b5cf6)",
              color: "white",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 10px 25px rgba(109,40,217,0.25)",
            }}
          >
            + Add Account
          </button>
        </div>

        {/* GRID */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 18,
          }}
        >
          {accounts.map((account) => (
            <div
              key={account.id}
              onClick={() => toggleCard(account.id)}
              onMouseEnter={() => setHoverId(account.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{
                background: "rgba(255,255,255,0.9)",
                borderRadius: 20,
                padding: 20,
                position: "relative",
                cursor: "pointer",
                transition: "box-shadow 0.25s ease, transform 0.25s ease",
                border: "1px solid rgba(15,23,42,0.06)",
                boxShadow: openId === account.id ? "0 18px 40px rgba(0,0,0,0.12)" : "0 8px 20px rgba(0,0,0,0.06)",
                transform: openId === account.id ? "translateY(-4px)" : "translateY(0)",
              }}
            >
              {/* DELETE BUTTON */}
              {hoverId === account.id && (
                <button
                  onClick={(e) => requestDelete(e, account.id)}
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: "none",
                    background: "rgba(239,68,68,0.1)",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              )}

              {/* NAME */}
              <div style={{ fontSize: 16, fontWeight: 650, marginBottom: 10 }}>{account.name}</div>

              {/* BALANCE */}
              <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>Balance</div>
              {editingId === account.id ? (
                <input
                  autoFocus
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                  onBlur={() => saveBalance(account.id)}
                  onKeyDown={(e) => e.key === "Enter" && saveBalance(account.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid #dbe2ea",
                    textAlign: "center",
                    fontSize: 20,
                    fontWeight: 700,
                    boxSizing: "border-box",
                  }}
                />
              ) : (
                <div
                  onClick={(e) => startEditing(e, account.id, account.balance)}
                  style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}
                >
                  {formatZAR(account.balance)}
                </div>
              )}

              {/* DROPDOWN */}
              <div
                style={{
                  maxHeight: openId === account.id ? 180 : 0,
                  overflow: "hidden",
                  transition: "max-height 0.35s ease",
                }}
              >
                <div
                  style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 14,
                    background: "#f8fafc",
                    fontSize: 12,
                    lineHeight: 1.7,
                    color: "#475569",
                  }}
                >
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
      </div>

      {/* ADD MODAL */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 380,
              background: "white",
              borderRadius: 20,
              padding: 26,
              boxShadow: "0 30px 80px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxSizing: "border-box",
            }}
          >
            <div style={{ textAlign: "center", fontSize: 18, fontWeight: 600 }}>Create New Account</div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Account Name</div>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAccount()}
                placeholder="e.g. Emergency Fund"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid #dbe2ea",
                  textAlign: "center",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={addAccount}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 14,
                  border: "none",
                  background: "linear-gradient(135deg, #6d28d9, #8b5cf6)",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Add
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid #dbe2ea",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {showConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
            zIndex: 200,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 320,
              background: "white",
              borderRadius: 20,
              padding: 26,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>
              Are you sure you want to delete this account?
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={confirmDelete}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 14,
                  border: "none",
                  background: "#ef4444",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid #dbe2ea",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}