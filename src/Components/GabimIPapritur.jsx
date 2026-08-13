import { Component } from "react";

/**
 * The last thing standing between a failed render and a black screen.
 *
 * Without one of these, React 18 answers an error thrown while rendering by unmounting the whole
 * tree: `#root` is emptied, the body keeps the dark background it was given before the app booted,
 * and what the user is looking at is a blank page with no message, no button and no way back. It
 * had happened for real - the app disappeared on a phone and stayed gone until the site's data was
 * cleared by hand.
 *
 * The usual cause is not a bug in a page but a **missing chunk**. Every page is a separate file
 * (`lazy()` in App.jsx), so a deploy that renames them leaves a browser holding an older service
 * worker asking for names the server no longer has - as does a cache entry the phone evicted under
 * storage pressure. The import rejects, the rejection surfaces through render, and the app is gone
 * for good, because nothing retries it.
 *
 * So that case is not just reported, it is repaired: the caches and the service worker are the
 * stale things, and dropping them and reloading brings the app back on the files that actually
 * exist. Once per minute at most, or a page that is broken for any other reason would reload itself
 * for ever.
 *
 * **The ledger is never touched.** IndexedDB is where every transaction lives and none of this goes
 * near it - only the copy of the *app* is thrown away, and that is what the message says, because
 * "something went wrong" next to a personal ledger reads as "your data is gone".
 */

const CELESI_PROVES = "financarepersonal.rikuperim";
const NDERMJET_PROVAVE = 60_000;

/** Whether this is a file that failed to arrive, rather than a fault in the code that ran. */
function eshteCopeQeMungon(gabimi) {
  const teksti = String(gabimi?.message || gabimi || "");
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|error loading dynamically imported/i.test(
    teksti
  );
}

/** Drops this app's cached copy - not its data - and comes back on whatever the server now serves. */
async function pastroDheRingarko() {
  try {
    const regjistrimet = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(regjistrimet.map((r) => r.unregister()));
  } catch {
    // An unregister the browser refuses is not worth stopping the reload for.
  }
  try {
    const emrat = (await window.caches?.keys?.()) || [];
    await Promise.all(emrat.map((emri) => window.caches.delete(emri)));
  } catch {
    // Same: the reload below is still worth trying.
  }
  window.location.reload();
}

class GabimIPapritur extends Component {
  constructor(props) {
    super(props);
    this.state = { gabimi: null, duke: false };
  }

  static getDerivedStateFromError(gabimi) {
    return { gabimi };
  }

  componentDidCatch(gabimi) {
    if (!eshteCopeQeMungon(gabimi)) return;
    // A reload that lands on the same broken state must not become a loop, so one attempt per
    // minute: enough to fix the deploy that has just happened, not enough to spin.
    let efundit = 0;
    try {
      efundit = Number(sessionStorage.getItem(CELESI_PROVES)) || 0;
    } catch {
      efundit = 0;
    }
    if (Date.now() - efundit < NDERMJET_PROVAVE) return;
    try {
      sessionStorage.setItem(CELESI_PROVES, String(Date.now()));
    } catch {
      // Private mode: the repair still runs, it just cannot remember that it did.
    }
    this.setState({ duke: true });
    pastroDheRingarko();
  }

  render() {
    const { gabimi, duke } = this.state;
    if (!gabimi) return this.props.children;

    const mungon = eshteCopeQeMungon(gabimi);
    // Written without the app's stylesheet or its component library: whatever failed to load may be
    // exactly what this screen would have needed to render itself.
    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          color: "#e6edf5",
          background: "#080f1a",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            {duke ? "Duke rikuperuar aplikacionin..." : "Aplikacioni nuk u hap dot"}
          </h1>
          <p style={{ fontSize: "0.95rem", lineHeight: 1.6, opacity: 0.85, marginBottom: "0.5rem" }}>
            {mungon
              ? "Kjo pajisje kishte një kopje të vjetër të aplikacionit dhe një skedar i saj nuk ekziston më. Rifreskimi e merr versionin e ri."
              : "Diçka e papritur ndodhi gjatë hapjes së kësaj faqeje."}
          </p>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.6, opacity: 0.7, marginBottom: "1.5rem" }}>
            <strong>Të dhënat tuaja janë të paprekura</strong> - transaksionet, llogaritë dhe
            gjithçka tjetër ndodhen në këtë shfletues dhe asgjë prej tyre nuk fshihet nga ky hap.
          </p>
          {!duke && (
            <button
              type="button"
              onClick={pastroDheRingarko}
              style={{
                border: 0,
                borderRadius: 12,
                padding: "0.7rem 1.4rem",
                fontSize: "1rem",
                fontWeight: 600,
                color: "#04121f",
                background: "#2ecc9b",
                cursor: "pointer",
              }}
            >
              Rifresko aplikacionin
            </button>
          )}
        </div>
      </div>
    );
  }
}

export default GabimIPapritur;
