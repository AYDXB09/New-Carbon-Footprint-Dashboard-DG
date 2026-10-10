import { useMemo } from "react";
import { marked } from "marked";
import "../Profile/Profile.css"; // .main — the shared page-content container
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../lib/auth";
import termsMd from "../../legal/TERMS.md?raw";
import privacyMd from "../../legal/PRIVACY.md?raw";
import "./Legal.css";

// The canonical text lives in docs/TERMS.md and docs/PRIVACY.md (what GitHub
// renders). Vite can't import from outside web/, so byte-identical copies are
// bundled from src/legal/ — tests/legal.test.ts fails if they ever drift.
//
// These pages are public (Login links to them, signed out), but a signed-in
// user following the sidebar's own Terms/Privacy link must not suddenly get
// the marketing menu — the exact swap that read as "two different menus"
// elsewhere — so the sidebar variant follows the session.
export default function Legal({ kind }: { kind: "terms" | "privacy" }) {
  const { session } = useAuth();

  const html = useMemo(() => {
    const raw = marked.parse(kind === "terms" ? termsMd : privacyMd, { async: false }) as string;
    return (
      raw
        // The markdown cross-links to its sibling by filename (right for
        // GitHub); in the app they are routes.
        .replace(/href="PRIVACY\.md"/g, 'href="/privacy"')
        .replace(/href="TERMS\.md"/g, 'href="/terms"')
        // External links open in a new tab, without handing over window.opener.
        .replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"')
    );
  }, [kind]);

  return (
    <div className="shell">
      {session ? <Sidebar /> : <Sidebar variant="marketing" />}
      <main className="main legal">
        <article dangerouslySetInnerHTML={{ __html: html }} />
      </main>
    </div>
  );
}
