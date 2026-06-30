import { useState, useEffect, useCallback, useRef } from "react";

// ── Categories ────────────────────────────────────────────────────────────────
const BRIT_BIT = "The Brit Bit";

const CATEGORIES = [
  "UK News", "World", "Politics", "Money", "Crime",
  "Health", "Business", "Technology", "Sport", "Entertainment",
];

const CATEGORY_ICONS = {
  "UK News": "🇬🇧", World: "🌍", Politics: "🏛️", Money: "💰", Crime: "⚖️",
  Health: "🏥", Business: "📈", Technology: "💻", Sport: "⚽", Entertainment: "🎬",
  [BRIT_BIT]: "✨",
};

const CATEGORY_COLORS = {
  "UK News": "#E63946", World: "#2A9D8F", Politics: "#6A0572", Money: "#F4A300",
  Crime: "#9D0208", Health: "#06A77D", Business: "#0077B6", Technology: "#00B4D8",
  Sport: "#2DC653", Entertainment: "#F77F00", [BRIT_BIT]: "#D4AF37",
};

const BRIT_BIT_TAGLINE = "The week's news — but funnier, weirder and more honest than anyone else will tell you";
const BRIT_BIT_OPENING = "Every Thursday we take the week's biggest stories, find the bits nobody talked about, add a few numbers that'll make you go blimey, throw in something only Britain could produce, and wrap it up with an opinion hot enough to burn your tongue. You're welcome.";

const BRIT_BIT_SECTIONS = [
  { key: "hot_take", label: "The Hot Take" },
  { key: "bet_you_didnt_know", label: "Bet You Didn't Know" },
  { key: "britain_by_numbers", label: "Britain by Numbers" },
  { key: "what_do_you_reckon", label: "What Do You Reckon" },
  { key: "you_couldnt_make_it_up", label: "You Couldn't Make It Up" },
  { key: "story_of_the_week", label: "Story of the Week" },
  { key: "only_in_britain", label: "Only in Britain" },
];

const SWIPE_THRESHOLD = 50;

// ── Utility ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function dateGroupLabel(dateStr) {
  if (!dateStr) return "Earlier";
  const date = new Date(dateStr);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  // Built manually rather than via a single toLocaleDateString call — en-GB
  // omits the comma ("Monday 28 June") and en-US gets the day/month order
  // wrong ("Monday, June 28"); neither matches "Monday, 28 June".
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  const dayMonth = date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  return `${weekday}, ${dayMonth}`;
}

// Groups already-newest-first items into { label, entries: [{ item, index }] }
// sections, keeping each item's original index into `items` so click
// handlers and "is this the selected story" checks still work unchanged.
function groupByDate(items) {
  const groups = [];
  let current = null;
  items.forEach((item, index) => {
    const label = dateGroupLabel(item.pubDate);
    if (!current || current.label !== label) {
      current = { label, entries: [] };
      groups.push(current);
    }
    current.entries.push({ item, index });
  });
  return groups;
}

// ── Header ────────────────────────────────────────────────────────────────────
function Header({ theme, onThemeToggle }) {
  return (
    <div className="header-inner">
      <div className="logo">
        <span className="logo-text">
          Brief<span className="logo-accent">UK</span>
        </span>
        <span className="logo-tagline">Every story – 60 words or less.</span>
      </div>
      <button
        className="theme-toggle"
        onClick={onThemeToggle}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
    </div>
  );
}

// ── Category nav ──────────────────────────────────────────────────────────────
function CategoryNav({ active, onSelect, todayCounts }) {
  const britBitColor = CATEGORY_COLORS[BRIT_BIT];
  const britBitActive = active === BRIT_BIT;
  return (
    <nav className="category-nav">
      {CATEGORIES.map((cat) => {
        const isActive = cat === active;
        const color = CATEGORY_COLORS[cat];
        const count = todayCounts[cat] || 0;
        return (
          <button
            key={cat}
            className="category-btn"
            onClick={() => onSelect(cat)}
            style={isActive ? { background: color, color: "#fff", borderColor: "transparent" } : undefined}
          >
            {CATEGORY_ICONS[cat]} {cat}
            {count > 0 && <span className="cat-badge">{count}</span>}
          </button>
        );
      })}
      <span className="nav-divider" aria-hidden="true" />
      <button
        className={`category-btn brit-bit-btn${britBitActive ? " brit-bit-active" : ""}`}
        onClick={() => onSelect(BRIT_BIT)}
        style={britBitActive ? { background: britBitColor, color: "#111", borderColor: "transparent" } : undefined}
      >
        ✨ The Brit Bit
      </button>
    </nav>
  );
}

// ── Category hero ────────────────────────────────────────────────────────────
function CategoryHero({ category, accentColor }) {
  return (
    <div className="category-hero">
      <h1 className="category-hero-title" style={{ color: accentColor }}>
        {CATEGORY_ICONS[category]} {category}
      </h1>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function SidebarSkeleton() {
  return (
    <div className="sidebar-list">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="sidebar-item sidebar-skel-row">
          <div className="skel-line" style={{ width: "35%", height: 9 }} />
          <div className="skel-line" style={{ width: "95%", height: 13, marginTop: 8 }} />
          <div className="skel-line" style={{ width: "70%", height: 13, marginTop: 6 }} />
        </div>
      ))}
    </div>
  );
}

function Sidebar({ items, selectedIndex, onSelect, accentColor, loading, lastUpdated, onRefresh }) {
  const sidebarRef = useRef(null);
  const [showTopBtn, setShowTopBtn] = useState(false);

  function handleSidebarScroll() {
    setShowTopBtn((sidebarRef.current?.scrollTop ?? 0) > 200);
  }
  function scrollToTop() {
    sidebarRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <aside className="sidebar" ref={sidebarRef} onScroll={handleSidebarScroll}>
      <div className="sidebar-head">
        <span className="sidebar-count">
          <strong style={{ color: accentColor }}>{items.length}</strong> stories
          {lastUpdated && <span className="sidebar-updated"> · Updated {timeAgo(lastUpdated)}</span>}
        </span>
        <button className="refresh-btn" onClick={onRefresh} aria-label="Refresh">↻</button>
      </div>
      {loading ? (
        <SidebarSkeleton />
      ) : items.length === 0 ? (
        <div className="sidebar-empty">No stories.</div>
      ) : (
        groupByDate(items).map((group) => (
          <div className="date-group" key={group.label}>
            <div className="date-group-header">{group.label}</div>
            <ul className="sidebar-list">
              {group.entries.map(({ item, index }) => (
                <li key={item.id}>
                  <button
                    className={`sidebar-item${index === selectedIndex ? " active" : ""}`}
                    style={index === selectedIndex ? { borderLeftColor: accentColor, background: `${accentColor}14` } : undefined}
                    onClick={() => onSelect(index)}
                  >
                    <span className="sidebar-item-meta">
                      <span style={{ color: accentColor }}>{item.source}</span> · {timeAgo(item.pubDate)}
                      {item.wordCount ? <span className="word-count-badge"> · {item.wordCount} words</span> : null}
                    </span>
                    <span className="sidebar-item-title">{item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      {showTopBtn && (
        <button className="back-to-top" onClick={scrollToTop} aria-label="Back to top">↑ Top</button>
      )}
    </aside>
  );
}

// ── Story panel ───────────────────────────────────────────────────────────────
function buildShareText(story) {
  return `${story.brief}\n\n${story.link}\n\nvia BriefUK`;
}

function StoryPanel({ story, index, total, accentColor, categoryIcon, loading, onPrev, onNext, onRetry }) {
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareRef = useRef(null);

  useEffect(() => { setImgFailed(false); setShareOpen(false); }, [story?.id]);

  useEffect(() => {
    if (!shareOpen) return;
    function onOutside(e) { if (!shareRef.current?.contains(e.target)) setShareOpen(false); }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [shareOpen]);

  // Only swipe horizontally when the gesture is more horizontal than vertical,
  // so normal vertical page scrolling is never intercepted.
  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) return;
    if (deltaX < 0) onNext(); else onPrev();
  }

  function openShare(url) { window.open(url, "_blank", "noopener,noreferrer"); setShareOpen(false); }
  function copyLink() {
    const text = story ? buildShareText(story) : "";
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setShareOpen(false);
    setTimeout(() => setCopied(false), 1800);
  }

  if (loading) {
    return (
      <section className="main-panel">
        <div className="story-banner story-banner-skel" />
        <div className="story-body">
          <div className="skel-line" style={{ width: "30%", height: 11, marginBottom: 16 }} />
          <div className="skel-line" style={{ width: "90%", height: 24, marginBottom: 10 }} />
          <div className="skel-line" style={{ width: "60%", height: 24, marginBottom: 20 }} />
          <div className="skel-line" style={{ width: "100%", height: 14, marginBottom: 8 }} />
          <div className="skel-line" style={{ width: "100%", height: 14, marginBottom: 8 }} />
          <div className="skel-line" style={{ width: "80%", height: 14 }} />
        </div>
      </section>
    );
  }

  if (!story) {
    return (
      <section className="main-panel main-panel-empty">
        <div className="empty-icon">📡</div>
        <p className="empty-title">Couldn't load stories</p>
        <p className="empty-sub">Check your connection and try again</p>
        <button className="btn-primary" style={{ background: accentColor }} onClick={onRetry}>
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="main-panel" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {story.image && !imgFailed ? (
        <img src={story.image} alt="" className="story-banner" onError={() => setImgFailed(true)} />
      ) : (
        <div
          className="story-banner story-banner-gradient"
          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}55)` }}
        >
          <span className="story-banner-icon">{categoryIcon}</span>
        </div>
      )}

      <div className="story-body">
        <div className="story-meta">
          <span className="story-source" style={{ color: accentColor, borderColor: accentColor }}>
            {story.source}
          </span>
          <span className="story-time">{timeAgo(story.pubDate)}</span>
        </div>
        <h2 className="story-headline">{story.title}</h2>

        <p className="story-brief">{story.brief}</p>
        {story.wordCount ? <span className="word-count-badge story-word-count">{story.wordCount} words</span> : null}

        <div className="story-actions">
          <a href={story.link} target="_blank" rel="noopener noreferrer"
            className="btn-primary" style={{ background: accentColor }}>
            Read Full Story →
          </a>
          <div className="share-wrap" ref={shareRef}>
            <button className="btn-secondary" onClick={() => setShareOpen((o) => !o)}>
              {copied ? "Copied!" : "Share"}
            </button>
            {shareOpen && (
              <div className="share-menu">
                <button className="share-option" onClick={() => openShare(`https://wa.me/?text=${encodeURIComponent(buildShareText(story))}`)}>
                  WhatsApp
                </button>
                <button className="share-option" onClick={() => openShare(`https://twitter.com/intent/tweet?text=${encodeURIComponent(buildShareText(story))}`)}>
                  Twitter / X
                </button>
                <button className="share-option" onClick={copyLink}>
                  Copy link
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="story-nav">
        <button className="nav-btn" onClick={onPrev} disabled={index === 0}>← Previous</button>
        <span className="story-counter">{index + 1} of {total}</span>
        <button className="nav-btn" onClick={onNext} disabled={index === total - 1}>Next →</button>
      </div>
    </section>
  );
}

// ── The Brit Bit ──────────────────────────────────────────────────────────────
function BritBitPanel({ edition, loading, accentColor, onRetry }) {
  if (loading) {
    return (
      <section className="main-panel brit-bit-panel">
        <div className="skel-line" style={{ width: "60%", height: 14, marginBottom: 24 }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ marginBottom: 22 }}>
            <div className="skel-line" style={{ width: "30%", height: 16, marginBottom: 10 }} />
            <div className="skel-line" style={{ width: "100%", height: 13, marginBottom: 6 }} />
            <div className="skel-line" style={{ width: "85%", height: 13 }} />
          </div>
        ))}
      </section>
    );
  }

  if (!edition) {
    return (
      <section className="main-panel main-panel-empty">
        <div className="empty-icon">✨</div>
        <p className="empty-title">This week's edition isn't ready yet</p>
        <p className="empty-sub">The Brit Bit refreshes every Thursday at 8am</p>
        <button className="btn-primary" style={{ background: accentColor }} onClick={onRetry}>
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="main-panel brit-bit-panel">
      <p className="brit-bit-tagline" style={{ color: accentColor }}>{BRIT_BIT_TAGLINE}</p>
      <p className="brit-bit-opening">{BRIT_BIT_OPENING}</p>
      {BRIT_BIT_SECTIONS.map(({ key, label }) => (
        <div key={key} className="brit-bit-section">
          <h3 className="brit-bit-section-title" style={{ color: accentColor }}>{label}</h3>
          <p className="brit-bit-section-body">{edition[key]}</p>
        </div>
      ))}
    </section>
  );
}

// ── Shortcuts hint ────────────────────────────────────────────────────────────
const SHORTCUTS = [
  { keys: ["←", "→"],  label: "Previous / next story" },
  { keys: ["O"],       label: "Open full article" },
  { keys: ["D"],       label: "Toggle dark / light" },
  { keys: ["1–9"],     label: "Jump to category" },
];

function ShortcutsHint() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="shortcuts-hint" ref={ref}>
      {open && (
        <div className="shortcuts-popover" role="tooltip">
          {SHORTCUTS.map(({ keys, label }) => (
            <div className="shortcut-row" key={label}>
              <span className="shortcut-keys">
                {keys.map((k) => <kbd key={k}>{k}</kbd>)}
              </span>
              <span className="shortcut-label">{label}</span>
            </div>
          ))}
        </div>
      )}
      <button
        className="shortcuts-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Keyboard shortcuts"
        aria-expanded={open}
      >
        ⌨ Shortcuts
      </button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("briefuk-theme") || "dark");
  const [activeCategory, setActiveCategory] = useState("UK News");
  const [newsByCategory, setNewsByCategory] = useState({});
  const [loading, setLoading] = useState({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [britBitEdition, setBritBitEdition] = useState(null);
  const [britBitLoading, setBritBitLoading] = useState(false);
  const [britBitFetched, setBritBitFetched] = useState(false);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("briefuk-theme", next);
      return next;
    });
  }

  // Stories arrive pre-summarised by Claude via the scheduled cron pipeline —
  // the frontend never calls Claude or fetches RSS directly.
  const fetchCategory = useCallback(async (category) => {
    setLoading((prev) => ({ ...prev, [category]: true }));
    try {
      const res = await fetch(`/api/news?category=${encodeURIComponent(category)}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setNewsByCategory((prev) => ({ ...prev, [category]: data.items }));
      setLastUpdated(new Date());
    } catch {
      setNewsByCategory((prev) => ({ ...prev, [category]: [] }));
    } finally {
      setLoading((prev) => ({ ...prev, [category]: false }));
    }
  }, []);

  const fetchBritBit = useCallback(async () => {
    setBritBitLoading(true);
    try {
      const res = await fetch("/api/brit-bit");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setBritBitEdition(data.edition);
    } catch {
      setBritBitEdition(null);
    } finally {
      setBritBitFetched(true);
      setBritBitLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
    if (activeCategory === BRIT_BIT) {
      if (!britBitFetched) fetchBritBit();
      return;
    }
    if (!newsByCategory[activeCategory]) fetchCategory(activeCategory);
  }, [activeCategory]);

  // Keyboard shortcuts — registered on every render cycle so handlers always
  // have the latest selectedStory and activeCategory without stale closures.
  useEffect(() => {
    function onKey(e) {
      // Don't intercept when the user is typing in a form field.
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;

      if (e.key === "ArrowLeft" && activeCategory !== BRIT_BIT) {
        e.preventDefault(); // prevent page scroll — we own this key here
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "ArrowRight" && activeCategory !== BRIT_BIT) {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, (newsByCategory[activeCategory]?.length ?? 1) - 1));
      } else if (e.key === "o" || e.key === "O") {
        if (selectedStory?.link) window.open(selectedStory.link, "_blank", "noopener,noreferrer");
      } else if (e.key === "d" || e.key === "D") {
        toggleTheme();
      } else if (e.key >= "1" && e.key <= "9") {
        const cat = CATEGORIES[parseInt(e.key, 10) - 1];
        if (cat) setActiveCategory(cat);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const currentNews = newsByCategory[activeCategory] || [];
  const isLoading = !!loading[activeCategory];
  const accentColor = CATEGORY_COLORS[activeCategory];
  const selectedStory = currentNews[selectedIndex];

  const goPrev = () => setSelectedIndex((i) => Math.max(i - 1, 0));
  const goNext = () => setSelectedIndex((i) => Math.min(i + 1, currentNews.length - 1));

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCounts = {};
  for (const [cat, stories] of Object.entries(newsByCategory)) {
    const n = stories.filter((s) => s.pubDate?.slice(0, 10) === todayStr).length;
    if (n > 0) todayCounts[cat] = n;
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        a { color: inherit; }

        /* ── Theme tokens ─────────────────────────────────── */
        .app-shell[data-theme="dark"] {
          --bg:        #0a0b0e;
          --topbar-bg: rgba(10,11,14,0.92);
          --surface:   #111318;
          --surface-2: #1a1c22;
          --border:    #1e2028;
          --border-2:  #1a1c22;
          --text-1:    #f0f0f0;
          --text-2:    #dddddd;
          --text-3:    #999999;
          --text-4:    #666666;
          --text-5:    #555555;
          --text-6:    #444444;
          --skel:      #1e2028;
          --scrollbar: #2a2d35;
        }
        .app-shell[data-theme="light"] {
          --bg:        #f8f8f8;
          --topbar-bg: rgba(248,248,248,0.92);
          --surface:   #ffffff;
          --surface-2: #f0f0f0;
          --border:    #eeeeee;
          --border-2:  #e8e8e8;
          --text-1:    #111111;
          --text-2:    #333333;
          --text-3:    #555555;
          --text-4:    #777777;
          --text-5:    #888888;
          --text-6:    #aaaaaa;
          --skel:      #e5e5e5;
          --scrollbar: #cccccc;
        }

        /* ── Smooth theme transition ──────────────────────── */
        .app-shell, .app-shell * {
          transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
        }

        /* ── Scrollbar ────────────────────────────────────── */
        .sidebar::-webkit-scrollbar { width: 4px; }
        .sidebar::-webkit-scrollbar-track { background: var(--surface); }
        .sidebar::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 4px; }

        /* ── Shell ────────────────────────────────────────── */
        .app-shell { min-height: 100vh; background: var(--bg); color: var(--text-1); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

        /* ── Topbar ───────────────────────────────────────── */
        .topbar { position: sticky; top: 0; z-index: 100; background: var(--topbar-bg); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border-2); }
        .header-inner { max-width: 1280px; margin: 0 auto; padding: 16px 12px 10px; display: flex; align-items: center; justify-content: space-between; }
        .logo { display: flex; align-items: center; gap: 14px; }
        .logo-text { font-weight: 900; font-size: 40px; letter-spacing: -0.03em; color: var(--text-1); line-height: 1; }
        .logo-accent { color: #E63946; }
        .logo-tagline { font-size: 13px; color: var(--text-5); font-weight: 500; letter-spacing: 0.01em; }
        .theme-toggle { background: var(--surface-2); border: 1px solid var(--border); border-radius: 20px; padding: 6px 12px; font-size: 16px; cursor: pointer; flex-shrink: 0; line-height: 1; }

        /* ── Category nav ─────────────────────────────────── */
        .category-nav { max-width: 1280px; margin: 0 auto; display: flex; gap: 6px; align-items: center; overflow-x: auto; padding: 10px 12px 14px; scrollbar-width: none; }
        .category-nav::-webkit-scrollbar { display: none; }
        .category-btn { flex-shrink: 0; background: var(--surface); color: var(--text-5); border: 1px solid var(--border); border-radius: 20px; padding: 9px 16px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
        .nav-divider { flex-shrink: 0; width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
        .brit-bit-btn { color: #D4AF37; border-color: #D4AF37; }
        .brit-bit-btn:not(.brit-bit-active):hover { background: #D4AF3718; }

        /* ── Category hero ─────────────────────────────────── */
        .category-hero { max-width: 1280px; margin: 0 auto; padding: 4px 12px 14px; }
        .category-hero-title { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; margin-bottom: 0; }

        /* ── Layout ───────────────────────────────────────── */
        .layout { max-width: 1280px; margin: 0 auto; display: flex; gap: 24px; padding: 24px 12px 60px; align-items: flex-start; }

        /* ── Sidebar ──────────────────────────────────────── */
        .sidebar { width: 360px; flex-shrink: 0; position: sticky; top: 142px; max-height: calc(100vh - 142px); overflow-y: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
        .sidebar-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--surface); z-index: 2; }
        .sidebar-count { font-size: 12px; color: var(--text-5); }
        .sidebar-updated { color: var(--text-6); }
        .refresh-btn { background: none; border: none; color: var(--text-5); font-size: 15px; cursor: pointer; }
        .date-group + .date-group { border-top: 1px solid var(--border); }
        .date-group-header { position: sticky; top: 44px; z-index: 1; background: var(--surface); padding: 8px 16px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-5); }
        .sidebar-list { list-style: none; }
        .sidebar-item { width: 100%; text-align: left; background: none; border: none; border-left: 3px solid transparent; padding: 14px 16px; cursor: pointer; display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--border-2); color: inherit; }
        .sidebar-item-meta { font-size: 11px; color: var(--text-4); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .sidebar-item-title { font-size: 13px; color: var(--text-2); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .sidebar-empty { padding: 40px 16px; text-align: center; color: var(--text-6); font-size: 13px; }
        .sidebar-skel-row { cursor: default; }

        /* ── Main panel ───────────────────────────────────── */
        .main-panel { flex: 1; min-width: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .story-banner { width: 100%; height: 220px; object-fit: cover; object-position: center top; display: block; }
        .story-banner-gradient { display: flex; align-items: center; justify-content: center; }
        .story-banner-icon { font-size: 72px; }
        .story-banner-skel { background: var(--skel); animation: pulse 1.5s ease-in-out infinite; }
        .story-body { padding: 28px; }
        .story-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .story-source { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid; padding: 3px 10px; border-radius: 20px; }
        .story-time { font-size: 12px; color: var(--text-5); }
        .story-headline { font-size: 28px; font-weight: 900; line-height: 1.25; letter-spacing: -0.02em; color: var(--text-1); margin-bottom: 16px; }
        .story-brief { font-size: 15px; line-height: 1.7; color: var(--text-3); margin-bottom: 8px; }
        .word-count-badge { font-size: 11px; color: var(--text-5); font-weight: 600; text-transform: none; letter-spacing: normal; }
        .story-word-count { display: block; margin-bottom: 24px; }
        .story-actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .share-wrap { position: relative; }
        .share-menu { position: absolute; bottom: calc(100% + 8px); left: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.25); min-width: 140px; z-index: 50; }
        .share-option { display: block; width: 100%; text-align: left; background: none; border: none; padding: 10px 14px; font-size: 13px; font-weight: 600; color: var(--text-2); cursor: pointer; }
        .share-option:hover { background: var(--surface-2); }
        .btn-primary { color: #fff; border: none; border-radius: 8px; padding: 12px 22px; font-weight: 700; font-size: 14px; text-decoration: none; display: inline-flex; align-items: center; cursor: pointer; }
        .btn-secondary { background: var(--surface-2); color: var(--text-2); border: none; border-radius: 8px; padding: 12px 22px; font-weight: 700; font-size: 14px; cursor: pointer; }
        .story-nav { display: flex; align-items: center; justify-content: space-between; padding: 20px 28px; border-top: 1px solid var(--border); }
        .nav-btn { background: var(--surface-2); color: var(--text-2); border: none; border-radius: 8px; padding: 10px 16px; font-weight: 700; font-size: 13px; cursor: pointer; }
        .nav-btn:disabled { opacity: 0.3; cursor: default; }
        .story-counter { font-size: 12px; color: var(--text-5); font-weight: 700; }
        .main-panel-empty { padding: 60px 28px; text-align: center; color: var(--text-6); }
        .empty-icon { font-size: 40px; margin-bottom: 16px; }
        .empty-title { font-weight: 700; color: var(--text-4); margin-bottom: 8px; }
        .empty-sub { font-size: 13px; margin-bottom: 20px; }

        /* ── The Brit Bit ─────────────────────────────────── */
        .brit-bit-panel { flex: 1; padding: 32px 36px 40px; }
        .brit-bit-tagline { font-size: 16px; font-weight: 700; margin-bottom: 16px; line-height: 1.5; }
        .brit-bit-opening { font-size: 14px; line-height: 1.7; color: var(--text-3); margin-bottom: 32px; padding-bottom: 28px; border-bottom: 1px solid var(--border); }
        .brit-bit-section { margin-bottom: 26px; }
        .brit-bit-section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
        .brit-bit-section-body { font-size: 15px; line-height: 1.7; color: var(--text-2); }

        /* ── Skeleton ─────────────────────────────────────── */
        .skel-line { background: var(--skel); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite; }

        /* ── Category badge ───────────────────────────────── */
        .cat-badge { display: inline-flex; align-items: center; justify-content: center; background: #E63946; color: #fff; font-size: 10px; font-weight: 800; border-radius: 10px; padding: 1px 5px; min-width: 16px; margin-left: 5px; line-height: 1.4; }

        /* ── Back to top ──────────────────────────────────── */
        .back-to-top { position: fixed; bottom: 70px; left: 20px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 20px; padding: 6px 12px; font-size: 11px; font-weight: 700; color: var(--text-4); cursor: pointer; z-index: 200; }
        .back-to-top:hover { color: var(--text-2); border-color: var(--text-5); }

        /* ── Keyboard shortcuts hint ──────────────────────── */
        .shortcuts-hint { position: fixed; bottom: 20px; right: 20px; z-index: 300; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
        .shortcuts-btn { background: var(--surface-2); border: 1px solid var(--border); border-radius: 20px; padding: 6px 12px; font-size: 11px; font-weight: 600; color: var(--text-5); cursor: pointer; white-space: nowrap; }
        .shortcuts-btn:hover { color: var(--text-3); border-color: var(--text-5); }
        .shortcuts-popover { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.25); min-width: 220px; }
        .shortcut-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .shortcut-keys { display: flex; gap: 4px; flex-shrink: 0; }
        kbd { background: var(--surface-2); border: 1px solid var(--border); border-radius: 5px; padding: 2px 6px; font-size: 11px; font-family: inherit; font-weight: 700; color: var(--text-2); }
        .shortcut-label { font-size: 12px; color: var(--text-4); }

        /* ── Mobile ───────────────────────────────────────── */
        @media (max-width: 768px) {
          .sidebar { display: none; }
          .layout { padding: 16px 0 0; gap: 0; }
          .main-panel { border-radius: 0; border-left: none; border-right: none; min-height: calc(100vh - 142px); }
          .logo-text { font-size: 28px; }
          .logo-tagline { display: none; }
          .story-headline { font-size: 22px; }
          .category-hero-title { font-size: 18px; }
        }
      `}</style>

      <div className="topbar">
        <Header theme={theme} onThemeToggle={toggleTheme} />
        <CategoryNav active={activeCategory} onSelect={setActiveCategory} todayCounts={todayCounts} />
      </div>

      {activeCategory !== BRIT_BIT && <CategoryHero category={activeCategory} accentColor={accentColor} />}

      <div className="layout">
        {activeCategory === BRIT_BIT ? (
          <BritBitPanel
            edition={britBitEdition}
            loading={britBitLoading}
            accentColor={accentColor}
            onRetry={fetchBritBit}
          />
        ) : (
          <>
            <Sidebar
              items={currentNews}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              accentColor={accentColor}
              loading={isLoading}
              lastUpdated={lastUpdated}
              onRefresh={() => fetchCategory(activeCategory)}
            />
            <StoryPanel
              story={selectedStory}
              index={selectedIndex}
              total={currentNews.length}
              accentColor={accentColor}
              categoryIcon={CATEGORY_ICONS[activeCategory]}
              loading={isLoading}
              onPrev={goPrev}
              onNext={goNext}
              onRetry={() => fetchCategory(activeCategory)}
            />
          </>
        )}
      </div>

      <ShortcutsHint />
    </div>
  );
}
