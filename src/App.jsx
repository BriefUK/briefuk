import { useState, useEffect, useCallback, useRef } from "react";

// ── Categories ────────────────────────────────────────────────────────────────
const BRIT_BIT = "The Brit Bit";
const BLACKBOARD = "Blackboard";

const CATEGORIES = [
  "UK News", "World", "Politics", "Money", "Crime",
  "Health", "Business", "Technology", "Sport", "Entertainment",
];

const CATEGORY_ICONS = {
  "UK News": "🇬🇧", World: "🌍", Politics: "🏛️", Money: "💰", Crime: "⚖️",
  Health: "🏥", Business: "📈", Technology: "💻", Sport: "⚽", Entertainment: "🎬",
  [BRIT_BIT]: "✨", [BLACKBOARD]: "📋",
};

const CATEGORY_COLORS = {
  "UK News": "#E63946", World: "#2A9D8F", Politics: "#6A0572", Money: "#F4A300",
  Crime: "#9D0208", Health: "#06A77D", Business: "#0077B6", Technology: "#00B4D8",
  Sport: "#2DC653", Entertainment: "#F77F00", [BRIT_BIT]: "#D4AF37", [BLACKBOARD]: "#16324F",
};

const BRIT_BIT_TAGLINE = "The week's news — but funnier, weirder and more honest than anyone else will tell you";
const BRIT_BIT_OPENING = "Every Thursday we take the week's biggest stories, find the bits nobody talked about, add a few numbers that'll make you go blimey, throw in something only Britain could produce, and wrap it up with an opinion hot enough to burn your tongue. You're welcome.";

const BRIT_BIT_SECTIONS = [
  { key: "hot_take",             label: "The Hot Take",          pill: "#E63946" },
  { key: "bet_you_didnt_know",   label: "Bet You Didn't Know",   pill: "#1B2A4A" },
  { key: "britain_by_numbers",   label: "Britain by Numbers",    pill: "#D4AF37" },
  { key: "what_do_you_reckon",   label: "What Do You Reckon",    pill: "#E63946" },
  { key: "you_couldnt_make_it_up", label: "You Couldn't Make It Up", pill: "#1B2A4A" },
  { key: "story_of_the_week",    label: "Story of the Week",     pill: "#D4AF37" },
  { key: "only_in_britain",      label: "Only in Britain",       pill: "#E63946" },
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
  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return (
    <div className="header-inner">
      <div className="logo">
        <img src="/icon.svg" alt="BriefUK" className="logo-icon" />
        <div className="logo-text-wrap">
          <span className="logo-text">
            Brief<span className="logo-accent">UK</span>
          </span>
          <span className="header-vdivider" aria-hidden="true" />
          <span className="logo-tagline">Every story – 60 words or less.</span>
        </div>
      </div>
      <div className="header-right">
        <span className="header-date">{dateStr}</span>
        <button
          className="theme-toggle"
          onClick={onThemeToggle}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </div>
  );
}

// ── Mobile pill nav (hidden on desktop, shown on mobile) ─────────────────────
function CategoryNav({ active, onSelect, todayCounts }) {
  const britBitActive = active === BRIT_BIT;
  const blackboardActive = active === BLACKBOARD;
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
        style={britBitActive ? { background: "#E63946", color: "#fff", borderColor: "transparent" } : undefined}
      >
        ✨ The Brit Bit
      </button>
      <button
        className={`category-btn blackboard-pill-btn${blackboardActive ? " blackboard-pill-active" : ""}`}
        onClick={() => onSelect(BLACKBOARD)}
        style={blackboardActive ? { background: "#16324F", color: "#fff", borderColor: "transparent" } : undefined}
      >
        📋 Blackboard
      </button>
    </nav>
  );
}

// ── Nav sidebar ───────────────────────────────────────────────────────────────
function NavSidebar({ active, onSelect, todayCounts }) {
  return (
    <nav className="nav-sidebar">
      <div className="nav-sb-label">News</div>
      {CATEGORIES.map((cat) => {
        const isActive = active === cat;
        const color = CATEGORY_COLORS[cat];
        const count = todayCounts[cat] || 0;
        return (
          <button
            key={cat}
            className={`nav-sb-item${isActive ? " nav-sb-item-active" : ""}`}
            onClick={() => onSelect(cat)}
            style={isActive ? { color, borderLeftColor: color, background: `${color}12` } : undefined}
          >
            <span className="nav-sb-icon">{CATEGORY_ICONS[cat]}</span>
            <span className="nav-sb-text">{cat}</span>
            {count > 0 && <span className="cat-badge">{count}</span>}
          </button>
        );
      })}
      <div className="nav-sb-divider" />
      <div className="nav-sb-label">Featured</div>
      <button
        className="nav-sb-item nav-sb-featured"
        onClick={() => onSelect(BRIT_BIT)}
        style={{
          background: active === BRIT_BIT ? "#E63946" : undefined,
          color: active === BRIT_BIT ? "#fff" : "#E63946",
          borderLeftColor: "transparent",
        }}
      >
        <span className="nav-sb-icon">✨</span>
        <span className="nav-sb-text">The Brit Bit</span>
      </button>
      <button
        className="nav-sb-item nav-sb-featured"
        onClick={() => onSelect(BLACKBOARD)}
        style={{
          background: active === BLACKBOARD ? "#16324F" : undefined,
          color: active === BLACKBOARD ? "#fff" : undefined,
          borderLeftColor: "transparent",
        }}
      >
        <span className="nav-sb-icon">📋</span>
        <span className="nav-sb-text">Blackboard</span>
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
  const panelRef = useRef(null);

  useEffect(() => {
    setImgFailed(false);
    setShareOpen(false);
    panelRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [story?.id]);

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
    <section className="main-panel" ref={panelRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
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
      <section className="brit-bit-panel">
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
    <section className="brit-bit-panel">
      <p className="brit-bit-tagline" style={{ color: accentColor }}>{BRIT_BIT_TAGLINE}</p>
      <p className="brit-bit-opening">{BRIT_BIT_OPENING}</p>
      {BRIT_BIT_SECTIONS.map(({ key, label, pill }) => (
        <div key={key} className="brit-bit-card">
          <span className="brit-bit-pill" style={{ background: pill }}>{label}</span>
          <p className="brit-bit-section-body">{edition[key]}</p>
        </div>
      ))}
    </section>
  );
}

// ── Blackboard ────────────────────────────────────────────────────────────────
function useScrollFadeIn() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, visible];
}

function parseInline(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function BlackboardCard({ card }) {
  const [ref, visible] = useScrollFadeIn();
  const { content, card_type } = card;

  function renderInner() {
    switch (card_type) {
      case "cover":
        return (
          <div className="bb-cover">
            <div className="bb-category-tag">{content.category_tag}</div>
            <h2 className="bb-headline">
              {content.headline_parts?.map((part, i) => (
                <span key={i} style={part.accent ? { color: "#B8541F" } : undefined}>{part.text}</span>
              ))}
            </h2>
            <p className="bb-subtext">{parseInline(content.subtext)}</p>
            {content.footer && <p className="bb-footer">{content.footer}</p>}
          </div>
        );
      case "stats":
        return (
          <div className="bb-stats">
            <div className="bb-section-label">{content.section_label}</div>
            <div className="bb-stat-pairs">
              {content.pairs?.map((pair, i) => (
                <div key={i} className="bb-stat-pair">
                  <div className="bb-stat-icon">{pair.icon}</div>
                  <div className="bb-stat-value">{pair.value}</div>
                  <div className="bb-stat-label">{pair.label}</div>
                  <div className="bb-stat-source">{pair.source}</div>
                </div>
              ))}
            </div>
            {content.insight && <p className="bb-insight">{parseInline(content.insight)}</p>}
          </div>
        );
      case "formula_table":
        return (
          <div className="bb-formula-table">
            <div className="bb-section-label">{content.section_label}</div>
            <div className="bb-formula">{content.formula}</div>
            <p className="bb-body">{parseInline(content.body)}</p>
            <table className="bb-table">
              <thead>
                <tr>{content.table_headers?.map((h, i) => <th key={i}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {content.table_rows?.map((row, i) => (
                  <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {content.footnote && <p className="bb-footnote">{content.footnote}</p>}
          </div>
        );
      case "bars":
        return (
          <div className="bb-bars">
            <div className="bb-section-label">{content.section_label}</div>
            {content.intro && <p className="bb-body">{content.intro}</p>}
            <div className="bb-bar-list">
              {content.bars?.map((bar, i) => (
                <div key={i} className="bb-bar-row">
                  <div className="bb-bar-salary">{bar.salary}</div>
                  <div className="bb-bar-track">
                    <div className="bb-bar-fill" style={{ width: `${bar.pct}%` }} />
                  </div>
                  <div className="bb-bar-label">{bar.label}</div>
                </div>
              ))}
            </div>
            {content.note && <p className="bb-note">{parseInline(content.note)}</p>}
          </div>
        );
      case "conclusion":
        return (
          <div className="bb-conclusion">
            <div className="bb-section-label">{content.section_label}</div>
            <h3 className="bb-conclusion-headline">{content.headline}</h3>
            {content.subtext && <p className="bb-body">{parseInline(content.subtext)}</p>}
            <div className="bb-highlights">
              {content.highlights?.map((h, i) => (
                <div key={i} className="bb-highlight" style={{ borderColor: h.color }}>
                  <div className="bb-highlight-badge" style={{ background: h.color }}>{h.badge}</div>
                  <div className="bb-highlight-value">{h.value}</div>
                  <div className="bb-highlight-desc">{h.description}</div>
                </div>
              ))}
            </div>
            {content.sources && <p className="bb-sources">{content.sources}</p>}
          </div>
        );
      default:
        return <p className="bb-body">{JSON.stringify(content)}</p>;
    }
  }

  if (card_type === "image") {
    return (
      <div className="bb-image-card bb-card-visible">
        <img src={content.image_url} alt="" style={{ width: "100%", display: "block" }} />
      </div>
    );
  }

  return (
    <div ref={ref} className={`bb-card${visible ? " bb-card-visible" : ""}`}>
      <div className="bb-slide-number">0{content.slide_number}</div>
      {renderInner()}
    </div>
  );
}

function BlackboardSeriesSidebar({ seriesList, activeSlug, onSelect }) {
  if (seriesList.length <= 1) return null;
  return (
    <aside className="bb-series-sidebar">
      <div className="bb-series-sidebar-label">All Series</div>
      {seriesList.map(s => (
        <button
          key={s.series_slug}
          className={`bb-series-btn${s.series_slug === activeSlug ? " bb-series-btn-active" : ""}`}
          onClick={() => onSelect(s.series_slug)}
        >
          {s.series_title}
        </button>
      ))}
    </aside>
  );
}

function BlackboardMobileNav({ seriesList, activeSlug, onSelect }) {
  if (seriesList.length <= 1) return null;
  return (
    <div className="bb-series-mobile-nav">
      {seriesList.map(s => (
        <button
          key={s.series_slug}
          className={`bb-series-pill${s.series_slug === activeSlug ? " bb-series-pill-active" : ""}`}
          onClick={() => onSelect(s.series_slug)}
        >
          {s.series_title}
        </button>
      ))}
    </div>
  );
}

function BlackboardPanel({ data, loading, onRetry, seriesList, onSelectSeries }) {
  const activeSlug = data?.series_slug;

  if (loading) {
    return (
      <div className="bb-layout">
        <section className="bb-panel">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bb-card bb-card-visible">
              <div className="skel-line" style={{ width: "20%", height: 10, marginBottom: 20 }} />
              <div className="skel-line" style={{ width: "80%", height: 32, marginBottom: 12 }} />
              <div className="skel-line" style={{ width: "100%", height: 14, marginBottom: 8 }} />
              <div className="skel-line" style={{ width: "70%", height: 14 }} />
            </div>
          ))}
        </section>
      </div>
    );
  }

  if (!data || !data.cards?.length) {
    return (
      <div className="bb-layout">
        <section className="bb-panel">
          <div className="bb-empty">
            <div className="empty-icon">📋</div>
            <p className="empty-title">Nothing on the board yet</p>
            <p className="empty-sub">Check back soon</p>
            <button className="btn-primary" style={{ background: "#16324F", marginTop: 8 }} onClick={onRetry}>
              Try again
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="bb-layout">
      <section className="bb-panel">
        <BlackboardMobileNav seriesList={seriesList} activeSlug={activeSlug} onSelect={onSelectSeries} />
        <div className="bb-series-header">{data.series_title}</div>
        {data.cards.map((card) => <BlackboardCard key={card.id} card={card} />)}
        <div className="bb-credit">Blackboard by BriefUK</div>
      </section>
      <BlackboardSeriesSidebar seriesList={seriesList} activeSlug={activeSlug} onSelect={onSelectSeries} />
    </div>
  );
}

// ── Shortcuts hint ────────────────────────────────────────────────────────────
const SHORTCUTS = [
  { keys: ["↑", "↓"],  label: "Previous / next story" },
  { keys: ["←", "→"],  label: "Previous / next category" },
  { keys: ["O"],        label: "Open full article" },
  { keys: ["D"],        label: "Toggle dark / light" },
  { keys: ["1–9"],      label: "Jump to category" },
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

// ── Install banner ───────────────────────────────────────────────────────────
function InstallBanner() {
  const [show, setShow] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem("briefuk-pwa-dismissed")) return;

    if (isIOS) { setShow(true); return; }

    function onBeforeInstall(e) { e.preventDefault(); setPrompt(e); setShow(true); }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() { localStorage.setItem("briefuk-pwa-dismissed", "1"); setShow(false); }

  async function install() {
    if (prompt) { prompt.prompt(); const { outcome } = await prompt.userChoice; if (outcome === "accepted") { setShow(false); return; } }
    dismiss();
  }

  if (!show) return null;
  return (
    <div className="install-banner">
      <img src="/icon-192.png" alt="" className="install-banner-icon" />
      <div className="install-banner-text">
        <strong>Add BriefUK to Home Screen</strong>
        <span>{isIOS ? "Tap Share → 'Add to Home Screen'" : "Install for fast access & offline reading"}</span>
      </div>
      {!isIOS && <button className="install-banner-btn" onClick={install}>Install</button>}
      <button className="install-banner-dismiss" onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("briefuk-theme") || "dark");
  const [activeCategory, setActiveCategory] = useState(
    () => localStorage.getItem("briefuk-category") || "UK News"
  );
  const [newsByCategory, setNewsByCategory] = useState({});
  const [loading, setLoading] = useState({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  // readIds: { [storyId]: readTimestamp }  — persisted in localStorage.
  // Pruned on load so entries older than 3 days never accumulate.
  const [readIds, setReadIds] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("briefuk-read") || "{}");
      const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
      return Object.fromEntries(Object.entries(stored).filter(([, ts]) => ts > cutoff));
    } catch { return {}; }
  });
  const [britBitEdition, setBritBitEdition] = useState(null);
  const [britBitLoading, setBritBitLoading] = useState(false);
  const [britBitFetched, setBritBitFetched] = useState(false);
  const [blackboardData, setBlackboardData] = useState(null);
  const [blackboardAllSeries, setBlackboardAllSeries] = useState([]);
  const [blackboardLoading, setBlackboardLoading] = useState(false);
  const [blackboardFetched, setBlackboardFetched] = useState(false);

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

  const fetchBlackboard = useCallback(async () => {
    setBlackboardLoading(true);
    try {
      const res = await fetch("/api/blackboard");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setBlackboardAllSeries(data.allSeries || []);
      setBlackboardData(data);
    } catch {
      setBlackboardData(null);
      setBlackboardAllSeries([]);
    } finally {
      setBlackboardFetched(true);
      setBlackboardLoading(false);
    }
  }, []);

  function selectBlackboardSeries(slug) {
    const found = blackboardAllSeries.find(s => s.series_slug === slug);
    if (found) {
      setBlackboardData(found);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  useEffect(() => {
    localStorage.setItem("briefuk-category", activeCategory);
    setSelectedIndex(0);
    if (activeCategory === BRIT_BIT) {
      if (!britBitFetched) fetchBritBit();
      return;
    }
    if (activeCategory === BLACKBOARD) {
      if (!blackboardFetched) fetchBlackboard();
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

      // All categories in tab order so ← → can cycle through them all.
      const allCats = [...CATEGORIES, BRIT_BIT, BLACKBOARD];
      const catIdx = allCats.indexOf(activeCategory);

      if (e.key === "ArrowUp" && activeCategory !== BRIT_BIT) {
        // No preventDefault — don't block vertical page / trackpad scroll.
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "ArrowDown" && activeCategory !== BRIT_BIT) {
        setSelectedIndex((i) => Math.min(i + 1, (newsByCategory[activeCategory]?.length ?? 1) - 1));
      } else if (e.key === "ArrowLeft") {
        if (catIdx > 0) setActiveCategory(allCats[catIdx - 1]);
      } else if (e.key === "ArrowRight") {
        if (catIdx < allCats.length - 1) setActiveCategory(allCats[catIdx + 1]);
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

  function markRead(id) {
    if (!id || readIds[id]) return;
    setReadIds((prev) => {
      const next = { ...prev, [id]: Date.now() };
      try { localStorage.setItem("briefuk-read", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // Mark the visible story as read whenever it changes (keyboard, swipe, click).
  useEffect(() => {
    if (selectedStory?.id) markRead(selectedStory.id);
  }, [selectedStory?.id]);

  // Desktop: scroll page to top on every story change so the article image
  // is never hidden behind the sticky header.
  useEffect(() => {
    if (window.innerWidth > 768) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [selectedIndex]);

  // Badge = stories published within the last 24 hours that haven't been read yet.
  const window24h = Date.now() - 24 * 60 * 60 * 1000;
  const todayCounts = {};
  for (const [cat, stories] of Object.entries(newsByCategory)) {
    const n = stories.filter(
      (s) => s.pubDate && new Date(s.pubDate).getTime() > window24h && !readIds[s.id]
    ).length;
    if (n > 0) todayCounts[cat] = n;
  }

  return (
    <div className="app-shell" data-theme={theme} style={{
      background: activeCategory === BRIT_BIT
        ? theme === "dark"
          ? "radial-gradient(120% 55% at 50% 0%, rgba(233,180,76,0.16), transparent 55%), linear-gradient(180deg, #141a2a, #0e1320)"
          : "linear-gradient(180deg, #fbf3df 0%, #f6f1e8 100%)"
        : activeCategory === BLACKBOARD
          ? `url('/${blackboardData?.series_slug === "what-is-ilr" ? "blackboard-ilr-bg.png" : "blackboard-bg.png"}') center/cover no-repeat fixed`
          : "var(--bg)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:wght@400;700;800&display=swap');
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

        /* ── Dark mode header overrides ──────────────────── */
        .app-shell[data-theme="dark"] .topbar { background: #060f1a; }
        .app-shell[data-theme="dark"] .logo-tagline { color: rgba(255,255,255,0.3); }

        /* ── Smooth theme transition ──────────────────────── */
        .app-shell, .app-shell * {
          transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
        }

        /* ── Scrollbar ────────────────────────────────────── */
        .sidebar::-webkit-scrollbar { width: 4px; }
        .sidebar::-webkit-scrollbar-track { background: var(--surface); }
        .sidebar::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 4px; }

        /* ── Shell ────────────────────────────────────────── */
        .app-shell { min-height: 100vh; color: var(--text-1); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

        /* ── Topbar ───────────────────────────────────────── */
        .topbar { position: sticky; top: 0; z-index: 100; background: var(--topbar-bg); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border-2); }
        .header-inner { max-width: 1400px; margin: 0 auto; padding: 16px 12px 10px; display: flex; align-items: center; justify-content: space-between; }
        .logo { display: flex; align-items: center; gap: 10px; }
        .logo-icon { width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0; }
        .logo-text-wrap { display: flex; align-items: center; gap: 12px; }
        .logo-text { font-weight: 900; font-size: 48px; letter-spacing: -0.03em; color: var(--text-1); line-height: 1; }
        .logo-accent { color: #E63946; }
        .logo-tagline { font-size: 15px; color: var(--text-5); font-weight: 500; letter-spacing: 0.01em; }
        .theme-toggle { background: var(--surface-2); border: 1px solid var(--border); border-radius: 20px; padding: 6px 12px; font-size: 16px; cursor: pointer; flex-shrink: 0; line-height: 1; }

        /* ── Mobile pill nav (desktop: hidden) ───────────── */
        .category-nav { display: none; gap: 6px; align-items: center; overflow-x: auto; padding: 10px 12px 14px; scrollbar-width: none; }
        .category-nav::-webkit-scrollbar { display: none; }
        .category-btn { flex-shrink: 0; background: var(--surface); color: var(--text-5); border: 1px solid var(--border); border-radius: 20px; padding: 9px 16px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
        .nav-divider { flex-shrink: 0; width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
        .brit-bit-btn { color: #E63946; border-color: #E63946; }
        .brit-bit-btn:not(.brit-bit-active):hover { background: rgba(230,57,70,0.1); }
        .blackboard-pill-btn { color: #16324F; border-color: #16324F; }
        .blackboard-pill-btn:not(.blackboard-pill-active):hover { background: rgba(22,50,79,0.1); }

        /* ── Nav sidebar ──────────────────────────────────── */
        .nav-sidebar { width: 180px; flex-shrink: 0; position: sticky; top: 74px; max-height: calc(100vh - 74px); overflow-y: auto; padding: 20px 12px 40px 0; scrollbar-width: none; }
        .nav-sidebar::-webkit-scrollbar { display: none; }
        .nav-sb-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: var(--text-5); padding: 0 12px 10px; }
        .nav-sb-item { display: flex; align-items: center; gap: 7px; width: 100%; background: none; border: none; border-left: 2px solid transparent; padding: 10px 12px; font-size: 15px; font-weight: 600; color: var(--text-3); cursor: pointer; text-align: left; border-radius: 0 8px 8px 0; transition: background 0.15s, color 0.15s; margin-bottom: 1px; }
        .nav-sb-item:hover { background: var(--surface-2); color: var(--text-1); }
        .nav-sb-item-active { font-weight: 700; }
        .nav-sb-icon { font-size: 15px; flex-shrink: 0; }
        .nav-sb-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .nav-sb-divider { height: 1px; background: var(--border); margin: 12px 10px; }
        .nav-sb-featured { border-radius: 8px; margin-bottom: 6px; padding: 11px 12px; font-weight: 700; }
        .nav-sb-featured:hover { opacity: 0.85; }

        /* ── Category hero ─────────────────────────────────── */
        .category-hero { padding: 4px 0 14px; }
        .category-hero-title { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; margin-bottom: 0; }

        /* ── Layout ───────────────────────────────────────── */
        .layout { max-width: 1400px; margin: 0 auto; display: flex; gap: 20px; padding: 24px 12px 60px; align-items: flex-start; }
        .main-area { flex: 1; min-width: 0; }
        .inner-layout { display: flex; gap: 24px; align-items: flex-start; }

        /* ── Sidebar ──────────────────────────────────────── */
        .sidebar { width: 360px; flex-shrink: 0; position: sticky; top: 74px; max-height: calc(100vh - 74px); overflow-y: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
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
        .brit-bit-panel { flex: 1; min-width: 0; padding: 24px 0 60px; }
        .brit-bit-tagline { font-size: 16px; font-weight: 700; margin-bottom: 16px; line-height: 1.5; }
        .brit-bit-opening { font-size: 14px; line-height: 1.7; color: var(--text-3); margin-bottom: 24px; }
        .brit-bit-card { border-radius: 16px; padding: 18px 20px 20px; margin-bottom: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.07); background: #ffffff; }
        .app-shell[data-theme="dark"] .brit-bit-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); box-shadow: none; }
        .brit-bit-pill { display: inline-block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #fff; border-radius: 20px; padding: 3px 10px; margin-bottom: 12px; }
        .brit-bit-section-body { font-size: 15px; line-height: 1.7; color: var(--text-2); }

        /* ── Blackboard ───────────────────────────────────── */
        .blackboard-btn { color: #16324F; border-color: #16324F; }
        .blackboard-btn:not(.blackboard-active):hover { background: rgba(22,50,79,0.1); }
        .bb-layout { flex: 1; min-width: 0; display: flex; align-items: flex-start; }
        .bb-panel { flex: 1; min-width: 0; padding: 24px 0 80px; }
        .bb-series-header { font-family: 'Playfair Display', Georgia, serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.55); margin-bottom: 28px; }
        .bb-series-sidebar { display: none; }
        .bb-series-mobile-nav { display: flex; overflow-x: auto; gap: 8px; padding: 0 4px 20px; scrollbar-width: none; }
        .bb-series-mobile-nav::-webkit-scrollbar { display: none; }
        .bb-series-pill { flex-shrink: 0; background: var(--surface-2); border: 1px solid var(--border); border-radius: 20px; padding: 8px 14px; color: var(--text-1); font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: background 0.2s, color 0.2s; }
        .bb-series-pill:hover { background: var(--surface-1); color: var(--text-1); }
        .bb-series-pill-active { background: #16324F; border-color: rgba(22,50,79,0.4); color: #fff; }
        .bb-card { background: #FAF8F3; border-radius: 16px; padding: 32px 28px 36px; margin-bottom: 20px; opacity: 0; transform: translateY(28px); transition: opacity 0.55s ease, transform 0.55s ease; }
        .bb-card-visible { opacity: 1; transform: translateY(0); }
        .bb-image-card { max-width: 600px; margin: 0 auto 20px; border-radius: 16px; overflow: hidden; }
        .bb-image-card img { width: 100%; display: block; }
        .bb-slide-number { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; color: #B8541F; margin-bottom: 16px; text-transform: uppercase; }
        .bb-section-label { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #B8541F; margin-bottom: 16px; }
        .bb-category-tag { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #B8541F; margin-bottom: 20px; }
        .bb-headline { font-family: 'Playfair Display', Georgia, serif; font-size: 32px; font-weight: 700; line-height: 1.25; color: #16324F; margin-bottom: 20px; }
        .bb-subtext { font-size: 15px; line-height: 1.75; color: #333; margin-bottom: 12px; }
        .bb-footer { font-size: 13px; color: #777; font-style: italic; }
        .bb-stat-pairs { display: flex; flex-direction: column; gap: 20px; margin-bottom: 20px; }
        .bb-stat-pair { border-left: 3px solid #B8541F; padding-left: 16px; }
        .bb-stat-icon { font-size: 20px; margin-bottom: 4px; }
        .bb-stat-value { font-family: 'Playfair Display', Georgia, serif; font-size: 30px; font-weight: 700; color: #16324F; line-height: 1.1; }
        .bb-stat-label { font-size: 14px; color: #333; margin-top: 4px; }
        .bb-stat-source { font-size: 11px; color: #999; margin-top: 2px; }
        .bb-insight { font-size: 14px; line-height: 1.65; color: #555; padding: 14px 16px; background: rgba(22,50,79,0.06); border-radius: 8px; }
        .bb-formula { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; font-weight: 700; color: #16324F; margin-bottom: 12px; }
        .bb-body { font-size: 14px; line-height: 1.7; color: #444; margin-bottom: 20px; }
        .bb-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        .bb-table th { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #16324F; padding: 8px 12px; border-bottom: 2px solid #16324F; text-align: left; }
        .bb-table td { font-size: 14px; color: #333; padding: 10px 12px; border-bottom: 1px solid rgba(22,50,79,0.1); }
        .bb-table tr:last-child td { border-bottom: none; }
        .bb-table td:not(:first-child) { font-weight: 700; color: #16324F; }
        .bb-footnote { font-size: 11px; color: #999; font-style: italic; margin-top: 8px; }
        .bb-bar-list { display: flex; flex-direction: column; gap: 14px; margin: 16px 0 20px; }
        .bb-bar-row { display: grid; grid-template-columns: 52px 1fr auto; gap: 10px; align-items: center; }
        .bb-bar-salary { font-family: 'Playfair Display', Georgia, serif; font-size: 13px; font-weight: 700; color: #16324F; }
        .bb-bar-track { height: 8px; background: rgba(22,50,79,0.12); border-radius: 4px; overflow: hidden; }
        .bb-bar-fill { height: 100%; background: linear-gradient(90deg, #16324F, #B8541F); border-radius: 4px; }
        .bb-bar-label { font-size: 12px; color: #555; white-space: nowrap; }
        .bb-note { font-size: 13px; color: #555; line-height: 1.6; padding: 12px 14px; background: rgba(184,84,31,0.07); border-radius: 8px; border-left: 3px solid #B8541F; }
        .bb-conclusion-headline { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: #16324F; margin-bottom: 12px; line-height: 1.3; }
        .bb-highlights { display: flex; flex-direction: column; gap: 14px; margin: 20px 0; }
        .bb-highlight { border-left: 3px solid; padding: 14px 16px; background: rgba(22,50,79,0.04); border-radius: 0 8px 8px 0; }
        .bb-highlight-badge { font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #fff; display: inline-block; padding: 2px 8px; border-radius: 4px; margin-bottom: 8px; }
        .bb-highlight-value { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; color: #16324F; margin-bottom: 4px; }
        .bb-highlight-desc { font-size: 13px; color: #555; }
        .bb-sources { font-size: 11px; color: #999; line-height: 1.6; margin-top: 8px; }
        .bb-credit { text-align: center; font-family: 'Playfair Display', Georgia, serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-top: 16px; }
        .bb-empty { padding: 60px 28px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }

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

        /* ── Install banner ──────────────────────────────── */
        .install-banner { display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 400; background: var(--surface); border-top: 1px solid var(--border); padding: 12px 16px; align-items: center; gap: 10px; box-shadow: 0 -4px 20px rgba(0,0,0,0.2); }
        .install-banner-icon { width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0; }
        .install-banner-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .install-banner-text strong { font-size: 13px; color: var(--text-1); }
        .install-banner-text span { font-size: 12px; color: var(--text-4); }
        .install-banner-btn { flex-shrink: 0; background: #E63946; color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .install-banner-dismiss { flex-shrink: 0; background: none; border: none; color: var(--text-5); font-size: 16px; cursor: pointer; padding: 4px 8px; line-height: 1; }

        /* ── Header elements (base: mobile defaults) ─────── */
        .header-vdivider { display: none; }
        .header-right { display: flex; align-items: center; gap: 12px; }
        .header-date { display: none; font-size: 11px; }

        /* ── Desktop header ───────────────────────────────── */
        @media (min-width: 769px) {
          .topbar { background: #16324F; backdrop-filter: none; border-bottom: 4px solid #E63946; }
          .header-inner { background: transparent; border-bottom: none; padding: 30px 24px; }
          .logo-icon { display: none; }
          .logo-text-wrap { flex-direction: row; align-items: center; gap: 20px; }
          .logo-text { font-family: Georgia, 'Times New Roman', serif; font-size: 38px; font-weight: 700; color: #fff; letter-spacing: 0; }
          .logo-tagline { font-size: 14px; color: rgba(255,255,255,0.4); letter-spacing: 0.01em; display: block; }
          .header-vdivider { display: block; width: 1px; height: 30px; background: rgba(255,255,255,0.15); flex-shrink: 0; }
          .header-date { display: block; color: rgba(255,255,255,0.3); letter-spacing: 0.08em; }
          .theme-toggle { display: block; }
          .nav-sidebar { top: 104px; max-height: calc(100vh - 104px); }
          .sidebar { top: 104px; max-height: calc(100vh - 104px); }
          .bb-series-sidebar { display: flex; flex-direction: column; gap: 6px; width: 220px; flex-shrink: 0; padding: 24px 0 24px 20px; position: sticky; top: 104px; max-height: calc(100vh - 104px); overflow-y: auto; }
          .bb-series-sidebar-label { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-5); margin-bottom: 8px; padding-left: 2px; }
          .bb-series-btn { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; text-align: left; color: var(--text-1); font-size: 13px; font-family: 'Playfair Display', Georgia, serif; font-weight: 600; cursor: pointer; line-height: 1.4; transition: background 0.2s, color 0.2s, border-color 0.2s; width: 100%; }
          .bb-series-btn:hover { background: var(--surface-1); color: var(--text-1); }
          .bb-series-btn-active { background: #16324F; border-color: rgba(22,50,79,0.4); color: #fff; }
          .bb-series-mobile-nav { display: none; }
        }

        /* ── Mobile ───────────────────────────────────────── */
        @media (max-width: 768px) {
          .nav-sidebar { display: none; }
          .category-nav { display: flex; }
          .sidebar { display: none; }
          .layout { padding: 16px 0 0; gap: 0; }
          .inner-layout { gap: 0; }
          .category-hero { padding: 4px 12px 14px; }
          .main-panel { border-radius: 0; border-left: none; border-right: none; min-height: calc(100vh - 142px); }
          .brit-bit-panel { padding: 16px 12px 48px; }
          .bb-panel { padding: 16px 12px 60px; }
          .bb-card { padding: 24px 20px 28px; }
          .bb-headline { font-size: 26px; }
          .bb-bar-row { grid-template-columns: 44px 1fr; }
          .bb-bar-label { grid-column: 1 / -1; font-size: 11px; }
          .topbar { background: #16324F; backdrop-filter: none; border-bottom: 4px solid #E63946; }
          .header-inner { padding: 16px 12px; }
          .logo-icon { display: none; }
          .logo-text { font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #fff; letter-spacing: 0; }
          .logo-tagline { display: none; }
          .story-headline { font-size: 22px; }
          .category-hero-title { font-size: 18px; }
          .shortcuts-hint { display: none; }
          .install-banner { display: flex; }
        }
      `}</style>

      <div className="topbar">
        <Header theme={theme} onThemeToggle={toggleTheme} />
        <CategoryNav active={activeCategory} onSelect={setActiveCategory} todayCounts={todayCounts} />
      </div>

      <div className="layout">
        <NavSidebar active={activeCategory} onSelect={setActiveCategory} todayCounts={todayCounts} />
        {activeCategory === BRIT_BIT ? (
          <BritBitPanel
            edition={britBitEdition}
            loading={britBitLoading}
            accentColor={accentColor}
            onRetry={fetchBritBit}
          />
        ) : activeCategory === BLACKBOARD ? (
          <BlackboardPanel
            data={blackboardData}
            loading={blackboardLoading}
            onRetry={fetchBlackboard}
            seriesList={blackboardAllSeries}
            onSelectSeries={selectBlackboardSeries}
          />
        ) : (
          <div className="main-area">
            <CategoryHero category={activeCategory} accentColor={accentColor} />
            <div className="inner-layout">
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
            </div>
          </div>
        )}
      </div>

      <ShortcutsHint />
      <InstallBanner />
    </div>
  );
}
