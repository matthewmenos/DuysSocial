import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Avatar, Icon } from "../../components/Icon";
import { PageError, PageLoading } from "../../components/PageState";

type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "links" };

type LegalDoc = {
  slug: string;
  title: string;
  updated: string;
  blocks: LegalBlock[];
  related: string[];
};

type LegalResponse = { title: string; body: string; doc?: LegalDoc };

const PAGES = [
  { slug: "terms", label: "Terms of Service", icon: "document" },
  { slug: "privacy", label: "Privacy Policy", icon: "shield" },
  { slug: "guidelines", label: "Community Guidelines", icon: "users" },
] as const;

const TITLES: Record<string, string> = Object.fromEntries(PAGES.map((p) => [p.slug, p.label]));

/** Same slug rules as the legacy sidebar: lowercase, dashes, max 50 chars. */
function slugify(text: string, fallback: string) {
  const id = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
  return id || fallback;
}

/** Mirrors DUYS/duys/templates/legal/_layout.html (glass back bar + article). */
export function LegalPage() {
  const { page } = useParams();
  const slug = String(page || "terms").toLowerCase();
  const nav = useNavigate();
  const { boot } = useAuth();
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [fallbackTitle, setFallbackTitle] = useState("");
  const [loadErr, setLoadErr] = useState("");
  const [tocOpen, setTocOpen] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const headingRefs = useRef(new Map<string, HTMLElement | null>());

  const known = (PAGES as readonly { slug: string }[]).some((p) => p.slug === slug);

  useEffect(() => {
    let alive = true;
    setDoc(null);
    setFallbackTitle("");
    setLoadErr("");
    setActiveId("");
    if (!known) {
      setLoadErr("not_found");
      return;
    }
    api(`/api/legal/${slug}`)
      .then((d: LegalResponse) => {
        if (!alive) return;
        if (d.doc) {
          setDoc(d.doc);
        } else {
          // Back-compat with a pre-structured endpoint: one paragraph body.
          setFallbackTitle(d.title || TITLES[slug]);
          setDoc({
            slug,
            title: d.title || TITLES[slug],
            updated: String(new Date().getFullYear()),
            blocks: [{ kind: "p", text: d.body || "" }],
            related: PAGES.map((p) => p.slug).filter((s) => s !== slug),
          });
        }
      })
      .catch((ex) => {
        if (alive) setLoadErr((ex as Error).message || "Could not load this page.");
      });
    return () => {
      alive = false;
    };
  }, [slug, known]);

  const headings = useMemo(
    () =>
      (doc?.blocks || [])
        .filter((b): b is { kind: "h2"; text: string } => b.kind === "h2")
        .map((b, i) => ({ id: slugify(b.text, `section-${i}`), text: b.text })),
    [doc],
  );

  useEffect(() => {
    document.title = doc ? `${doc.title} · ${boot?.appName || "DUYS"}` : boot?.appName || "DUYS";
    return () => {
      document.title = boot?.appName || "DUYS";
    };
  }, [doc, boot?.appName]);
  // Legacy scroll-spy: the deepest h2 still above one-third of the viewport wins.
  useEffect(() => {
    if (!doc) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        let current = "";
        for (const [id, el] of headingRefs.current) {
          if (el && el.getBoundingClientRect().top <= window.innerHeight / 3) current = id;
        }
        setActiveId(current);
      }, 100);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", update);
      clearTimeout(timer);
    };
  }, [doc]);

  // Close the floating contents drawer when tapping anywhere outside it.
  useEffect(() => {
    if (!tocOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".legal-sidebar")) setTocOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [tocOpen]);

  async function copyLink(id: string) {
    const url = `${window.location.origin}/legal/${slug}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((cur) => (cur === id ? "" : cur)), 1600);
  }

  function goBack() {
    // History can be empty when the page is opened straight from a shared link.
    if (window.history.length > 1) nav(-1);
    else if (document.referrer) window.location.href = document.referrer;
    else nav(boot?.user ? "/" : "/auth/login", { replace: true });
  }

  if (loadErr) {
    return (
      <div className="legal-standalone">
        <Brand />
        <PageError message={loadErr} onRetry={() => window.location.reload()} />
        <p className="legal-foot">
          <Link to={boot?.user ? "/" : "/auth/login"}>Back to home</Link>
        </p>
      </div>
    );
  }
  if (!doc) return <PageLoading label={`Loading ${TITLES[slug] || "legal page"}…`} />;



  const appName = boot?.appName || "DUYS";
  return (
    <div className="legal-shell">
      <div className="page-head glass-bar">
        <button className="icon-btn" aria-label="Back" onClick={goBack}>
          <Icon name="arrow-left" size={22} />
        </button>
        <h1>{doc.title}</h1>
      </div>
      <div className="legal-body">
        <article className="legal-page" aria-label={doc.title}>
          {fallbackTitle ? <h1>{fallbackTitle}</h1> : null}
          <p className="legal-updated">Last updated: {doc.updated}</p>
          {doc.blocks.map((b, i) => {
            if (b.kind === "h2") {
              const id = slugify(b.text, `section-${i}`);
              return (
                <h2
                  key={id}
                  id={id}
                  ref={(el) => {
                    headingRefs.current.set(id, el);
                  }}
                >
                  <span>{b.text}</span>
                  <button
                    className="legal-anchor"
                    type="button"
                    title="Copy link to section"
                    aria-label={`Copy link to ${b.text}`}
                    onClick={() => void copyLink(id)}
                  >
                    <Icon name={copiedId === id ? "verify" : "copy"} size={15} />
                  </button>
                </h2>
              );
            }
            if (b.kind === "list") {
              return (
                <ul key={`list-${i}`}>
                  {b.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              );
            }
            if (b.kind === "links") {
              return (
                <p key="links" className="legal-links">
                  See also:{" "}
                  {doc.related.map((rel, ri) => (
                    <Fragment key={rel}>
                      {ri > 0 && " · "}
                      <Link to={`/legal/${rel}`}>{TITLES[rel] || rel}</Link>
                    </Fragment>
                  ))}
                </p>
              );
            }
            return <p key={`p-${i}`}>{b.text}</p>;
          })}
        </article>
        <aside className={`legal-sidebar${tocOpen ? " open" : ""}`} aria-label="On this page">
          <button
            className="legal-sidebar-toggle"
            type="button"
            aria-expanded={tocOpen}
            aria-label="Toggle contents"
            onClick={() => setTocOpen((v) => !v)}
          >
            <Icon name="menu" size={20} />
            On this page
          </button>
          <nav className="legal-sidebar-nav" aria-label="Sections">
            <ul>
              {PAGES.filter((p) => p.slug !== slug).map((p) => (
                <li key={p.slug} className="legal-toc-item">
                  <Link to={`/legal/${p.slug}`}>
                    <Icon name={p.icon} size={15} /> {p.label}
                  </Link>
                </li>
              ))}
              {headings.map((h) => (
                <li key={h.id} className="legal-toc-item legal-toc-h2">
                  <a
                    href={`#${h.id}`}
                    className={activeId === h.id ? "active" : ""}
                    onClick={(e) => {
                      e.preventDefault();
                      headingRefs.current.get(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      setTocOpen(false);
                    }}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
      {!boot?.user && (
        <div className="legal-standalone-foot">
          <Link className="legal-brand" to="/auth/login">
            <Avatar url="/icons/logo.png" size={30} alt={appName} />
            <span>{appName}</span>
          </Link>
          <p className="legal-foot">
            <Link to="/auth/login">Back to sign in</Link>
          </p>
        </div>
      )}
    </div>
  );
}

function Brand() {
  return (
    <Link className="legal-brand" to="/auth/login">
      <Avatar url="/icons/logo.png" size={34} alt="DUYS" />
      <span>DUYS</span>
    </Link>
  );
}
