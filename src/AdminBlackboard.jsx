import { useState, useEffect, useCallback } from "react";

const API = "/api/blackboard-admin";
const CARD_TYPES = ["cover", "stats", "formula_table", "bars", "conclusion", "generic"];

const TEMPLATES = {
  cover: {
    category_tag: "INSIGHTS · TOPIC",
    slide_number: 1,
    headline_parts: [
      { text: "Your headline ", accent: false },
      { text: "goes here", accent: true }
    ],
    subtext: "Supporting text for the cover card.",
    footer: "Footer line."
  },
  stats: {
    section_label: "THE HEADLINE STAT",
    slide_number: 2,
    pairs: [
      { icon: "📊", value: "£0,000", label: "First statistic label", source: "Source, 2025" },
      { icon: "📈", value: "£0,000", label: "Second statistic label", source: "Source, 2025" }
    ],
    insight: "Key insight sentence here."
  },
  formula_table: {
    section_label: "THE BREAKDOWN",
    slide_number: 3,
    formula: "Minimum × 1.25 = Comfortable",
    body: "Explanation of the formula and methodology.",
    table_headers: ["Household", "Minimum", "Comfortable"],
    table_rows: [
      ["Single adult", "£0,000", "~£0,000"],
      ["Couple, no kids", "£0,000", "~£0,000"]
    ],
    footnote: "All figures gross, before tax."
  },
  bars: {
    section_label: "QUICK VERDICT",
    slide_number: 4,
    intro: "For a single adult outside London:",
    bars: [
      { salary: "£25k", label: "Below the minimum", pct: 14 },
      { salary: "£40k", label: "Broadly comfortable", pct: 50 },
      { salary: "£60k+", label: "Well above typical pay", pct: 100 }
    ],
    note: "In London, add roughly £15k–£20k."
  },
  conclusion: {
    section_label: "BOTTOM LINE",
    slide_number: 5,
    headline: "Main conclusion headline.",
    subtext: "Supporting conclusion text.",
    highlights: [
      { color: "#16324F", badge: "KEY FIGURE", value: "£0,000", description: "description here." },
      { color: "#B8541F", badge: "TAKE-HOME", value: "£0,000", description: "description here." }
    ],
    sources: "Sources: Source A · Source B · Source C"
  },
  generic: {
    title: "Card Title",
    body: "Card content goes here."
  }
};

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

  .adm-wrap { min-height: 100vh; background: #f0f2f5; }

  /* Topbar */
  .adm-topbar {
    position: sticky; top: 0; z-index: 100;
    background: #16324F; border-bottom: 4px solid #E63946;
    padding: 0 24px; height: 60px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .adm-topbar-title { font-size: 16px; font-weight: 700; color: #fff; }
  .adm-topbar-logo { font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #fff; }
  .adm-topbar-logo span { color: #E63946; }
  .adm-back { background: none; border: none; color: rgba(255,255,255,0.8); font-size: 14px; cursor: pointer; padding: 6px 0; }
  .adm-back:hover { color: #fff; }

  /* Content area */
  .adm-content { max-width: 900px; margin: 0 auto; padding: 28px 24px 60px; }

  /* Buttons */
  .adm-btn-primary {
    background: #E63946; color: #fff; border: none;
    border-radius: 6px; padding: 9px 18px; font-size: 14px; font-weight: 600;
    cursor: pointer; white-space: nowrap;
  }
  .adm-btn-primary:hover { background: #c62833; }
  .adm-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
  .adm-btn-ghost {
    background: transparent; color: #16324F; border: 1px solid #ccd0d9;
    border-radius: 6px; padding: 9px 18px; font-size: 14px; font-weight: 600;
    cursor: pointer; white-space: nowrap;
  }
  .adm-btn-ghost:hover { background: #e8eaf0; }
  .adm-btn-danger {
    background: transparent; color: #c62833; border: 1px solid #f5c0c3;
    border-radius: 6px; padding: 7px 12px; font-size: 13px; font-weight: 600;
    cursor: pointer; white-space: nowrap;
  }
  .adm-btn-danger:hover { background: #fde8e9; }
  .adm-btn-sm { padding: 7px 14px; font-size: 13px; }

  /* Series cards */
  .adm-series {
    background: #fff; border-radius: 10px; border: 1px solid #dde1e9;
    margin-bottom: 20px; overflow: hidden;
  }
  .adm-series-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid #eef0f5; gap: 12px;
  }
  .adm-series-title { font-size: 15px; font-weight: 700; color: #16324F; }
  .adm-series-slug { font-size: 12px; color: #8b92a5; margin-top: 2px; font-family: monospace; }

  /* Table */
  .adm-table { width: 100%; border-collapse: collapse; }
  .adm-table th {
    text-align: left; padding: 10px 20px; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em; color: #8b92a5;
    background: #f8f9fb; border-bottom: 1px solid #eef0f5;
  }
  .adm-table td { padding: 12px 20px; border-bottom: 1px solid #f2f4f8; vertical-align: middle; }
  .adm-table tr:last-child td { border-bottom: none; }
  .adm-table tr:hover td { background: #fafbfc; }

  .adm-type-badge {
    display: inline-block; background: #eef2ff; color: #4255c7;
    border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 600; font-family: monospace;
  }
  .adm-status-btn {
    border: none; border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 700; cursor: pointer;
  }
  .adm-status-pub { background: #d4f4e3; color: #1a7a47; }
  .adm-status-pub:hover { background: #c0ecd6; }
  .adm-status-draft { background: #f2f4f8; color: #8b92a5; }
  .adm-status-draft:hover { background: #e8eaf0; }

  /* Form */
  .adm-form-wrap { max-width: 900px; margin: 0 auto; padding: 28px 24px 60px; }
  .adm-form { background: #fff; border-radius: 10px; border: 1px solid #dde1e9; padding: 28px; }
  .adm-row { display: flex; gap: 16px; margin-bottom: 20px; }
  .adm-field { display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .adm-field-sm { flex: 0 0 120px; }
  .adm-field-xs { flex: 0 0 90px; }
  .adm-field label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #8b92a5; }
  .adm-input {
    border: 1px solid #ccd0d9; border-radius: 6px; padding: 9px 12px;
    font-size: 14px; color: #1a1f2e; outline: none; width: 100%;
    background: #fff; font-family: inherit;
  }
  .adm-input:focus { border-color: #16324F; box-shadow: 0 0 0 3px rgba(22,50,79,0.12); }
  .adm-input:disabled { background: #f2f4f8; color: #8b92a5; cursor: not-allowed; }
  select.adm-input { cursor: pointer; }

  .adm-textarea {
    border: 1px solid #ccd0d9; border-radius: 6px; padding: 12px;
    font-size: 13px; color: #1a1f2e; outline: none; width: 100%; resize: vertical;
    font-family: 'SF Mono', 'Fira Code', monospace; line-height: 1.5;
  }
  .adm-textarea:focus { border-color: #16324F; box-shadow: 0 0 0 3px rgba(22,50,79,0.12); }
  .adm-textarea-error { border-color: #E63946; }
  .adm-field-error { font-size: 12px; color: #E63946; margin-top: 4px; }

  /* Toggle switch */
  .adm-toggle { position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; }
  .adm-toggle input { opacity: 0; width: 0; height: 0; }
  .adm-toggle-slider {
    position: absolute; inset: 0; background: #ccd0d9; border-radius: 24px; transition: 0.2s;
  }
  .adm-toggle-slider::before {
    content: ''; position: absolute; height: 18px; width: 18px;
    left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.2s;
  }
  .adm-toggle input:checked + .adm-toggle-slider { background: #1a7a47; }
  .adm-toggle input:checked + .adm-toggle-slider::before { transform: translateX(20px); }

  /* Form footer */
  .adm-form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #eef0f5; }
  .adm-error { background: #fde8e9; color: #c62833; border-radius: 6px; padding: 10px 14px; font-size: 13px; margin-top: 12px; }

  /* Login */
  .adm-login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0e1a2e; }
  .adm-login-card { background: #fff; border-radius: 12px; padding: 40px 36px; width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 16px; }
  .adm-login-logo { font-family: Georgia, serif; font-size: 32px; font-weight: 700; color: #16324F; text-align: center; }
  .adm-login-logo span { color: #E63946; }
  .adm-login-subtitle { text-align: center; font-size: 13px; color: #8b92a5; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
  .adm-login-card .adm-btn-primary { width: 100%; padding: 12px; font-size: 15px; }

  /* Misc */
  .adm-loading { text-align: center; padding: 40px; color: #8b92a5; }
  .adm-empty { text-align: center; padding: 48px; color: #8b92a5; background: #fff; border-radius: 10px; border: 1px dashed #dde1e9; }
`;

function defaultForm() {
  return {
    series_slug: "",
    series_title: "",
    card_number: 1,
    card_type: "cover",
    sort_order: 10,
    published: true,
  };
}

export default function AdminBlackboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem("bb_admin_token") || "");
  const [pwInput, setPwInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [view, setView] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [contentJson, setContentJson] = useState(JSON.stringify(TEMPLATES.cover, null, 2));
  const [jsonError, setJsonError] = useState("");
  const [saving, setSaving] = useState(false);

  const authHeaders = useCallback(() => ({
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [token]);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setApiError("");
    try {
      const res = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        setToken("");
        sessionStorage.removeItem("bb_admin_token");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCards(data.cards || []);
    } catch (e) {
      setApiError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (token) loadCards(); }, [token, loadCards]);

  async function login(e) {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await fetch(API, { headers: { Authorization: `Bearer ${pwInput}` } });
      if (res.ok) {
        sessionStorage.setItem("bb_admin_token", pwInput);
        setToken(pwInput);
      } else {
        setAuthError("Incorrect password");
      }
    } catch {
      setAuthError("Connection error — check your network");
    }
  }

  function openNew(seriesSlug = "", seriesTitle = "") {
    setEditingId(null);
    const f = { ...defaultForm(), series_slug: seriesSlug, series_title: seriesTitle };
    setForm(f);
    setContentJson(JSON.stringify(TEMPLATES[f.card_type], null, 2));
    setJsonError("");
    setApiError("");
    setView("form");
  }

  function openEdit(card) {
    setEditingId(card.id);
    setForm({
      series_slug: card.series_slug,
      series_title: card.series_title,
      card_number: card.card_number,
      card_type: card.card_type,
      sort_order: card.sort_order,
      published: card.published,
    });
    setContentJson(JSON.stringify(card.content, null, 2));
    setJsonError("");
    setApiError("");
    setView("form");
  }

  function closeForm() {
    setView("list");
    setEditingId(null);
    setJsonError("");
    setApiError("");
  }

  function handleFormChange(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    if (field === "card_type") {
      setContentJson(JSON.stringify(TEMPLATES[value], null, 2));
      setJsonError("");
    }
  }

  async function saveCard(e) {
    e.preventDefault();
    let content;
    try {
      content = JSON.parse(contentJson);
    } catch (err) {
      setJsonError("Invalid JSON: " + err.message);
      return;
    }
    setJsonError("");
    setSaving(true);
    setApiError("");
    const body = { ...form, content };
    try {
      const url = editingId ? `${API}?id=${editingId}` : API;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      closeForm();
      loadCards();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCard(id, label) {
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    setApiError("");
    try {
      const res = await fetch(`${API}?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      loadCards();
    } catch (err) {
      setApiError(err.message);
    }
  }

  async function togglePublished(card) {
    setApiError("");
    try {
      await fetch(`${API}?id=${card.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ ...card, published: !card.published }),
      });
      loadCards();
    } catch (err) {
      setApiError(err.message);
    }
  }

  const series = {};
  for (const card of cards) {
    if (!series[card.series_slug]) {
      series[card.series_slug] = { title: card.series_title, slug: card.series_slug, cards: [] };
    }
    series[card.series_slug].cards.push(card);
  }

  // ── Login ──────────────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="adm-login-wrap">
          <form className="adm-login-card" onSubmit={login}>
            <div className="adm-login-logo">Brief<span>UK</span></div>
            <div className="adm-login-subtitle">Blackboard Admin</div>
            <input
              className="adm-input"
              type="password"
              placeholder="Password"
              value={pwInput}
              onChange={e => setPwInput(e.target.value)}
              autoFocus
            />
            {authError && <div className="adm-error">{authError}</div>}
            <button className="adm-btn-primary" type="submit">Sign in</button>
          </form>
        </div>
      </>
    );
  }

  // ── Add / Edit form ───────────────────────────────────────────────────────────
  if (view === "form") {
    const isNew = !editingId;
    return (
      <>
        <style>{STYLES}</style>
        <div className="adm-wrap">
          <div className="adm-topbar">
            <button className="adm-back" onClick={closeForm}>← Back to list</button>
            <span className="adm-topbar-title">{isNew ? "Add Card" : "Edit Card"}</span>
            <div />
          </div>
          <div className="adm-form-wrap">
            <form className="adm-form" onSubmit={saveCard}>

              <div className="adm-row">
                <div className="adm-field">
                  <label>Series Slug</label>
                  <input
                    className="adm-input"
                    value={form.series_slug}
                    onChange={e => handleFormChange("series_slug", e.target.value)}
                    placeholder="salary-comfort-2025"
                    required
                    disabled={!isNew}
                  />
                </div>
                <div className="adm-field">
                  <label>Series Title</label>
                  <input
                    className="adm-input"
                    value={form.series_title}
                    onChange={e => handleFormChange("series_title", e.target.value)}
                    placeholder="What salary is actually comfortable?"
                    required
                  />
                </div>
              </div>

              <div className="adm-row">
                <div className="adm-field adm-field-sm">
                  <label>Card Number</label>
                  <input
                    className="adm-input"
                    type="number"
                    min={1}
                    value={form.card_number}
                    onChange={e => handleFormChange("card_number", Number(e.target.value))}
                    required
                  />
                </div>
                <div className="adm-field adm-field-sm">
                  <label>Sort Order</label>
                  <input
                    className="adm-input"
                    type="number"
                    step={10}
                    value={form.sort_order}
                    onChange={e => handleFormChange("sort_order", Number(e.target.value))}
                  />
                </div>
                <div className="adm-field adm-field-sm">
                  <label>Card Type</label>
                  <select
                    className="adm-input"
                    value={form.card_type}
                    onChange={e => handleFormChange("card_type", e.target.value)}
                  >
                    {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="adm-field adm-field-xs">
                  <label>Published</label>
                  <label className="adm-toggle">
                    <input
                      type="checkbox"
                      checked={form.published}
                      onChange={e => handleFormChange("published", e.target.checked)}
                    />
                    <span className="adm-toggle-slider" />
                  </label>
                </div>
              </div>

              <div className="adm-field" style={{ marginBottom: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label>Content (JSON)</label>
                  <button
                    type="button"
                    className="adm-btn-ghost adm-btn-sm"
                    onClick={() => {
                      setContentJson(JSON.stringify(TEMPLATES[form.card_type], null, 2));
                      setJsonError("");
                    }}
                  >
                    Load {form.card_type} template
                  </button>
                </div>
                <textarea
                  className={`adm-textarea${jsonError ? " adm-textarea-error" : ""}`}
                  value={contentJson}
                  onChange={e => { setContentJson(e.target.value); setJsonError(""); }}
                  rows={22}
                  spellCheck={false}
                />
                {jsonError && <div className="adm-field-error">{jsonError}</div>}
              </div>

              {apiError && <div className="adm-error">{apiError}</div>}

              <div className="adm-form-actions">
                <button type="button" className="adm-btn-ghost" onClick={closeForm}>Cancel</button>
                <button type="submit" className="adm-btn-primary" disabled={saving}>
                  {saving ? "Saving…" : isNew ? "Add Card" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </>
    );
  }

  // ── Series list ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>
      <div className="adm-wrap">
        <div className="adm-topbar">
          <div className="adm-topbar-logo">Brief<span>UK</span> <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "inherit", fontSize: 14, fontWeight: 400 }}>/ Blackboard Admin</span></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="adm-btn-primary adm-btn-sm" onClick={() => openNew()}>+ New Series</button>
            <button
              className="adm-btn-ghost adm-btn-sm"
              style={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.2)" }}
              onClick={() => { setToken(""); sessionStorage.removeItem("bb_admin_token"); }}
            >
              Logout
            </button>
          </div>
        </div>

        <div className="adm-content">
          {loading && <div className="adm-loading">Loading…</div>}
          {apiError && <div className="adm-error" style={{ marginBottom: 16 }}>{apiError}</div>}

          {!loading && Object.keys(series).length === 0 && (
            <div className="adm-empty">
              No series yet. Click <strong>+ New Series</strong> to create your first Blackboard.
            </div>
          )}

          {Object.values(series).map(s => (
            <div key={s.slug} className="adm-series">
              <div className="adm-series-header">
                <div>
                  <div className="adm-series-title">{s.title}</div>
                  <div className="adm-series-slug">{s.slug}</div>
                </div>
                <button className="adm-btn-primary adm-btn-sm" onClick={() => openNew(s.slug, s.title)}>
                  + Add Card
                </button>
              </div>

              <table className="adm-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Sort</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {s.cards.map(card => (
                    <tr key={card.id}>
                      <td style={{ fontWeight: 600, color: "#1a1f2e" }}>{card.card_number}</td>
                      <td><span className="adm-type-badge">{card.card_type}</span></td>
                      <td style={{ color: "#8b92a5" }}>{card.sort_order}</td>
                      <td>
                        <button
                          className={`adm-status-btn ${card.published ? "adm-status-pub" : "adm-status-draft"}`}
                          onClick={() => togglePublished(card)}
                          title="Click to toggle"
                        >
                          {card.published ? "Published" : "Draft"}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="adm-btn-ghost adm-btn-sm" onClick={() => openEdit(card)}>Edit</button>
                          <button
                            className="adm-btn-danger"
                            onClick={() => deleteCard(card.id, `Card #${card.card_number} (${card.card_type})`)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
