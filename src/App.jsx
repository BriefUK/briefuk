import { useState, useEffect, useCallback, useRef } from "react";

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "UK News", "World", "Politics", "Money", "Crime",
  "Health", "Business", "Technology", "Sport", "Entertainment",
];

const CATEGORY_ICONS = {
  "UK News": "🇬🇧", World: "🌍", Politics: "🏛️", Money: "💰", Crime: "⚖️",
  Health: "🏥", Business: "📈", Technology: "💻", Sport: "⚽", Entertainment: "🎬",
};

const CATEGORY_COLORS = {
  "UK News": "#E63946", World: "#2A9D8F", Politics: "#6A0572", Money: "#F4A300",
  Crime: "#9D0208", Health: "#06A77D", Business: "#0077B6", Technology: "#00B4D8",
  Sport: "#2DC653", Entertainment: "#F77F00",
};

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

// ── Header ────────────────────────────────────────────────────────────────────
function Header({ theme, onThemeToggle }) {
  return (
    <div className="header-inner">
      <div className="logo">
        <span className="logo-text">
          Brief<span className="logo-accent">UK</span>
        </span>
        <span className="logo-tagline">Every story. 60 words.</span>
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
function CategoryNav({ active, onSelect }) {
  return (
    <nav className="category-nav">
      {CATEGORIES.map((cat) => {
        const isActive = cat === active;
        const color = CATEGORY_COLORS[cat];
        return (
          <button
            key={cat}
            className="category-btn"
            onClick={() => onSelect(cat)}
            style={isActive ? { background: color, color: "#fff", borderColor: "transparent" } : undefined}
          >
            {CATEGORY_ICONS[cat]} {cat}
          </button>
        );
      })}
    </nav>
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
  return (
    <aside className="sidebar">
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
        <ul className="sidebar-list">
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                className={`sidebar-item${i === selectedIndex ? " active" : ""}`}
                style={i === selectedIndex ? { borderLeftColor: accentColor, background: `${accentColor}14` } : undefined}
                onClick={() => onSelect(i)}
              >
                <span className="sidebar-item-meta">
                  <span style={{ color: accentColor }}>{item.source}</span> · {timeAgo(item.pubDate)}
                </span>
                <span className="sidebar-item-title">{item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

// ── Story panel ───────────────────────────────────────────────────────────────
function StoryPanel({ story, index, total, accentColor, categoryIcon, loading, onPrev, onNext, onShare, shared, onRetry }) {
  const touchStartX = useRef(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => { setImgFailed(false); }, [story?.id]);

  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta < 0) onNext(); else onPrev();
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
        <div className="story-actions">
          <a href={story.link} target="_blank" rel="noopener noreferrer"
            className="btn-primary" style={{ background: accentColor }}>
            Read Full Story →
          </a>
          <button className="btn-secondary" onClick={() => onShare(story)}>
            {shared ? "Link copied!" : "Share"}
          </button>
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

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("briefuk-theme") || "dark");
  const [activeCategory, setActiveCategory] = useState("UK News");
  const [newsByCategory, setNewsByCategory] = useState({});
  const [loading, setLoading] = useState({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [shared, setShared] = useState(false);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("briefuk-theme", next);
  }

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

  useEffect(() => {
    setSelectedIndex(0);
    if (!newsByCategory[activeCategory]) fetchCategory(activeCategory);
  }, [activeCategory]);

  const currentNews = newsByCategory[activeCategory] || [];
  const isLoading = !!loading[activeCategory];
  const accentColor = CATEGORY_COLORS[activeCategory];
  const selectedStory = currentNews[selectedIndex];

  const goPrev = () => setSelectedIndex((i) => Math.max(i - 1, 0));
  const goNext = () => setSelectedIndex((i) => Math.min(i + 1, currentNews.length - 1));

  function handleShare(story) {
    if (navigator.share) { navigator.share({ title: story.title, url: story.link }).catch(() => {}); return; }
    navigator.clipboard?.writeText(story.link).catch(() => {});
    setShared(true);
    setTimeout(() => setShared(false), 1500);
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
        .header-inner { max-width: 1280px; margin: 0 auto; padding: 16px 20px 10px; display: flex; align-items: center; justify-content: space-between; }
        .logo { display: flex; align-items: center; gap: 14px; }
        .logo-text { font-weight: 900; font-size: 40px; letter-spacing: -0.03em; color: var(--text-1); line-height: 1; }
        .logo-accent { color: #E63946; }
        .logo-tagline { font-size: 13px; color: var(--text-5); font-weight: 500; letter-spacing: 0.01em; }
        .theme-toggle { background: var(--surface-2); border: 1px solid var(--border); border-radius: 20px; padding: 6px 12px; font-size: 16px; cursor: pointer; flex-shrink: 0; line-height: 1; }

        /* ── Category nav ─────────────────────────────────── */
        .category-nav { max-width: 1280px; margin: 0 auto; display: flex; gap: 8px; overflow-x: auto; padding: 10px 20px 14px; scrollbar-width: none; }
        .category-nav::-webkit-scrollbar { display: none; }
        .category-btn { flex-shrink: 0; background: var(--surface); color: var(--text-5); border: 1px solid var(--border); border-radius: 20px; padding: 9px 16px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s; }

        /* ── Layout ───────────────────────────────────────── */
        .layout { max-width: 1280px; margin: 0 auto; display: flex; gap: 24px; padding: 24px 20px 60px; align-items: flex-start; }

        /* ── Sidebar ──────────────────────────────────────── */
        .sidebar { width: 360px; flex-shrink: 0; position: sticky; top: 142px; max-height: calc(100vh - 142px); overflow-y: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
        .sidebar-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--surface); z-index: 1; }
        .sidebar-count { font-size: 12px; color: var(--text-5); }
        .sidebar-updated { color: var(--text-6); }
        .refresh-btn { background: none; border: none; color: var(--text-5); font-size: 15px; cursor: pointer; }
        .sidebar-list { list-style: none; }
        .sidebar-item { width: 100%; text-align: left; background: none; border: none; border-left: 3px solid transparent; padding: 14px 16px; cursor: pointer; display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--border-2); color: inherit; }
        .sidebar-item-meta { font-size: 11px; color: var(--text-4); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .sidebar-item-title { font-size: 13px; color: var(--text-2); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .sidebar-empty { padding: 40px 16px; text-align: center; color: var(--text-6); font-size: 13px; }
        .sidebar-skel-row { cursor: default; }

        /* ── Main panel ───────────────────────────────────── */
        .main-panel { flex: 1; min-width: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .story-banner { width: 100%; height: 220px; object-fit: cover; display: block; }
        .story-banner-gradient { display: flex; align-items: center; justify-content: center; }
        .story-banner-icon { font-size: 72px; }
        .story-banner-skel { background: var(--skel); animation: pulse 1.5s ease-in-out infinite; }
        .story-body { padding: 28px; }
        .story-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .story-source { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid; padding: 3px 10px; border-radius: 20px; }
        .story-time { font-size: 12px; color: var(--text-5); }
        .story-headline { font-size: 28px; font-weight: 900; line-height: 1.25; letter-spacing: -0.02em; color: var(--text-1); margin-bottom: 16px; }
        .story-brief { font-size: 15px; line-height: 1.7; color: var(--text-3); margin-bottom: 24px; }
        .story-actions { display: flex; gap: 12px; flex-wrap: wrap; }
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

        /* ── Skeleton ─────────────────────────────────────── */
        .skel-line { background: var(--skel); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite; }

        /* ── Mobile ───────────────────────────────────────── */
        @media (max-width: 768px) {
          .sidebar { display: none; }
          .layout { padding: 16px 0 0; gap: 0; }
          .main-panel { border-radius: 0; border-left: none; border-right: none; min-height: calc(100vh - 142px); }
          .logo-text { font-size: 28px; }
          .logo-tagline { display: none; }
          .story-headline { font-size: 22px; }
        }
      `}</style>

      <div className="topbar">
        <Header theme={theme} onThemeToggle={toggleTheme} />
        <CategoryNav active={activeCategory} onSelect={setActiveCategory} />
      </div>

      <div className="layout">
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
          onShare={handleShare}
          shared={shared}
          onRetry={() => fetchCategory(activeCategory)}
        />
      </div>
    </div>
  );
}
