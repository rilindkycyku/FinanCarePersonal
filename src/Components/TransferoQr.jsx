import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Alert, ProgressBar } from "react-bootstrap";
import { QrCode, Camera, ChevronLeft, ChevronRight, Play, Pause, X, Link2, Copy, Check, Share2, Gauge } from "lucide-react";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { exportAllData, importAllData } from "../lib/db";
import { decodeTransfer, encodeTransfer, encodeTransferLink, parseChunk } from "../lib/transferQr";
import "../Pages/Styles/Dashboard.css";

/**
 * Device-to-device transfer of the whole database by QR: one side plays the codes, the other
 * scans them with its camera. Nothing is uploaded - the data goes across as light.
 *
 * Both halves take over the screen while they run. A code shown in a 220 px box on a phone is a
 * grid of modules barely a pixel wide, which is why sweeping the other phone across it used to miss
 * most of them; full screen, the same code is several pixels per module and reads at arm's length.
 *
 * Scanning uses the browser's own BarcodeDetector where it exists (Android Chrome, Edge); where it
 * does not, the JSON backup above does the same job through a file.
 */

/** How long each code stays up. Slower is easier to catch; faster gets through a long set sooner. */
const SHPEJTESITE = [
  { ms: 1900, emri: "Ngadalë" },
  { ms: 1300, emri: "Normal" },
  { ms: 850, emri: "Shpejt" },
];

/** An SVG code stays sharp at any size - a bitmap blown up to fill the screen does not, and a
 * blurred module edge is exactly what a camera cannot resolve. */
const svgUrl = (svg) => `data:image/svg+xml;base64,${btoa(svg)}`;

function TransferoQr() {
  const { reload } = useData();
  const dialog = useDialog();

  const [modaliteti, setModaliteti] = useState(""); // "" | "dergo" | "prano"
  const [kodet, setKodet] = useState([]);
  const [imazhet, setImazhet] = useState([]);
  const [aktivi, setAktivi] = useState(0);
  const [luaj, setLuaj] = useState(true);
  const [mbledhur, setMbledhur] = useState([]);
  const [gabimi, setGabimi] = useState("");
  const [duke, setDuke] = useState("");
  const [linku, setLinku] = useState(null);
  const [kopjuar, setKopjuar] = useState(false);
  const [shpejtesia, setShpejtesia] = useState(1);
  const [linkuPlote, setLinkuPlote] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const wakeRef = useRef(null);

  // Sending: the codes cycle on their own, so the other phone can just be held up to the screen.
  useEffect(() => {
    if (modaliteti !== "dergo" || !luaj || imazhet.length < 2) return undefined;
    const id = setInterval(() => setAktivi((i) => (i + 1) % imazhet.length), SHPEJTESITE[shpejtesia].ms);
    return () => clearInterval(id);
  }, [modaliteti, luaj, imazhet.length, shpejtesia]);

  /** A transfer takes minutes of the screen just sitting there; without this the phone dims halfway
   * through and the other camera loses the code. */
  const mbajEkranin = async () => {
    try {
      wakeRef.current = await navigator.wakeLock?.request("screen");
    } catch {
      /* unsupported or refused - the transfer still works, the screen just sleeps on its own */
    }
  };

  const leshoEkranin = () => {
    wakeRef.current?.release?.().catch(() => undefined);
    wakeRef.current = null;
  };

  const mbyll = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    leshoEkranin();
    setModaliteti("");
    setKodet([]);
    setImazhet([]);
    setMbledhur([]);
    setGabimi("");
    setAktivi(0);
    setLinku(null);
    setLinkuPlote(false);
  };

  /** The single link code, blown up to the screen and back. The other phone reads it with its own
   * camera app, so the same rule applies as to the played codes: small on screen is unreadable. */
  const hapLinkunPlote = () => {
    setLinkuPlote(true);
    mbajEkranin();
  };

  const mbyllLinkunPlote = () => {
    setLinkuPlote(false);
    leshoEkranin();
  };

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      wakeRef.current?.release?.().catch(() => undefined);
    },
    []
  );

  // Escape closes the full-screen halves, the way any other overlay in the app behaves, and the
  // page underneath stays put instead of scrolling away behind them.
  useEffect(() => {
    if (modaliteti !== "dergo" && modaliteti !== "prano" && !linkuPlote) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (linkuPlote) mbyllLinkunPlote();
      else mbyll();
    };
    const meParë = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = meParë;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modaliteti, linkuPlote]);

  const filloDergimin = async () => {
    setDuke("qr");
    setGabimi("");
    try {
      const data = await exportAllData();
      const chunks = await encodeTransfer(data);
      const QRCode = await import("qrcode").then((m) => m.default || m);
      const imgs = [];
      for (const chunk of chunks) {
        imgs.push(
          svgUrl(
            await QRCode.toString(chunk, {
              type: "svg",
              margin: 2,
              // A code read off a lit screen picks up glare and moiré; the middle level recovers
              // from both, and at this chunk size it costs no extra code.
              errorCorrectionLevel: "M",
              color: { dark: "#000000", light: "#ffffff" },
            })
          )
        );
      }
      setKodet(chunks);
      setImazhet(imgs);
      setAktivi(0);
      setLuaj(true);
      setModaliteti("dergo");
      mbajEkranin();
    } catch (err) {
      setGabimi(`Kodet nuk u krijuan: ${err.message}`);
    } finally {
      setDuke("");
    }
  };

  /**
   * The same data as one link. A QR only holds so much, but the link itself has no such limit -
   * past what a code can carry it is still perfectly good to copy or send, so the link is always
   * produced and only the QR beside it disappears.
   */
  const krijoLinkun = async () => {
    setDuke("link");
    setGabimi("");
    try {
      const data = await exportAllData();
      const { url, mundet } = await encodeTransferLink(data);
      let img = null;
      if (mundet) {
        const QRCode = await import("qrcode").then((m) => m.default || m);
        img = svgUrl(
          await QRCode.toString(url, {
            type: "svg",
            margin: 2,
            errorCorrectionLevel: "L",
            color: { dark: "#000000", light: "#ffffff" },
          })
        );
      }
      setLinku({ url, img, mundet });
      setModaliteti("link");
    } catch (err) {
      setGabimi(`Linku nuk u krijua: ${err.message}`);
    } finally {
      setDuke("");
    }
  };

  const ndajLinkun = async () => {
    if (!navigator.share) return kopjoLinkun();
    try {
      await navigator.share({ title: "Transfer - FinanCarePersonal", url: linku.url });
    } catch {
      /* dismissed by the user */
    }
  };

  const kopjoLinkun = async () => {
    try {
      await navigator.clipboard.writeText(linku.url);
      setKopjuar(true);
      setTimeout(() => setKopjuar(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const filloPranimin = async () => {
    setGabimi("");
    if (!("BarcodeDetector" in window)) {
      setGabimi(
        "Ky shfletues nuk di të lexojë kode QR. Përdorni skedarin JSON: eksportojeni në pajisjen tjetër dhe importojeni këtu."
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setMbledhur([]);
      setModaliteti("prano");
      mbajEkranin();
      // The element only exists once the mode is set, so the stream is attached on the next frame.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch (err) {
      setGabimi(`Kamera nuk u hap: ${err.message}`);
    }
  };

  // Receiving: every frame is checked, and each code is kept once until the set is complete.
  useEffect(() => {
    if (modaliteti !== "prano") return undefined;
    let stop = false;
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });

    const lexo = async () => {
      if (stop) return;
      const video = videoRef.current;
      if (video?.readyState === 4) {
        try {
          const codes = await detector.detect(video);
          codes.forEach(({ rawValue }) => {
            const chunk = parseChunk(rawValue);
            if (!chunk) return;
            setMbledhur((prev) =>
              prev.some((c) => c.index === chunk.index && c.total === chunk.total) ? prev : [...prev, chunk]
            );
          });
        } catch {
          /* a frame that could not be read is simply skipped */
        }
      }
      // Often enough that even the fastest cycle gets several looks at every code.
      setTimeout(lexo, 140);
    };

    lexo();
    return () => {
      stop = true;
    };
  }, [modaliteti]);

  // Complete set: confirm, then replace everything with what came across.
  useEffect(() => {
    const total = mbledhur[0]?.total;
    if (!total || mbledhur.length !== total) return;

    (async () => {
      try {
        const data = await decodeTransfer(mbledhur);
        const nrTx = data?.transactions?.length ?? 0;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const ok = await dialog.confirm(
          `U lexuan të gjitha kodet: ${nrTx} transaksione, ${data?.accounts?.length ?? 0} llogari dhe ${
            data?.categories?.length ?? 0
          } kategori. Kjo zëvendëson të dhënat aktuale të kësaj pajisjeje. Vazhdo?`,
          { title: "Transferi u lexua", confirmLabel: "Zëvendëso" }
        );
        if (ok) {
          await importAllData(data);
          await reload();
        }
        mbyll();
      } catch (err) {
        setGabimi(err.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mbledhur]);

  const total = mbledhur[0]?.total ?? 0;

  return (
    <>
      <div className="fcp-row-sub mb-2">Transfero gjithçka në një pajisje tjetër</div>

      {gabimi && (
        <Alert variant="warning" className="py-2 small" onClose={() => setGabimi("")} dismissible>
          {gabimi}
        </Alert>
      )}

      {modaliteti === "" && (
        <>
          <div className="fcp-share-actions">
            <Button variant="outline-light" onClick={filloDergimin} disabled={Boolean(duke)}>
              <QrCode size={16} className="me-1" /> {duke === "qr" ? "Duke krijuar..." : "Dërgo me QR"}
            </Button>
            <Button variant="outline-light" onClick={krijoLinkun} disabled={Boolean(duke)}>
              <Link2 size={16} className="me-1" /> {duke === "link" ? "Duke krijuar..." : "Dërgo me një link"}
            </Button>
            <Button variant="outline-light" onClick={filloPranimin}>
              <Camera size={16} className="me-1" /> Prano me kamerë
            </Button>
          </div>
          <div className="fcp-row-sub mt-2">
            <strong>Dërgo me QR</strong> i ndan të dhënat në disa kode dhe lexohet me{" "}
            <strong>Prano me kamerë</strong> këtu në aplikacion. <strong>Dërgo me një link</strong> i vendos të gjitha në një link të vetëm, që e kopjoni
            ose e dërgoni te vetja - dhe kur të dhënat janë mjaft të vogla, vjen edhe si një kod i vetëm që hapet me
            kamerën e zakonshme të telefonit.
          </div>
        </>
      )}

      {modaliteti === "dergo" &&
        createPortal(
          <div className="fcp-qr-plote" role="dialog" aria-modal="true" aria-label="Dërgo me QR">
            <div className="fcp-qr-plote-koka">
              <div>
                <strong>
                  Kodi {aktivi + 1} / {imazhet.length}
                </strong>
                <span>
                  {imazhet.length > 1
                    ? "Kodet ndërrohen vetë - mbajeni kamerën e pajisjes tjetër para ekranit derisa t'i lexojë të gjitha."
                    : "Skanojeni këtë kod me pajisjen tjetër."}
                </span>
              </div>
              <button type="button" onClick={mbyll} aria-label="Mbyll">
                <X size={20} />
              </button>
            </div>

            <div className="fcp-qr-plote-kodi">
              <img src={imazhet[aktivi]} alt={`Kodi ${aktivi + 1} nga ${imazhet.length}`} />
            </div>

            <div className="fcp-qr-plote-fundi">
              <ProgressBar now={((aktivi + 1) / imazhet.length) * 100} style={{ height: 6 }} />
              <div className="fcp-qr-plote-butonat">
                {imazhet.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setAktivi((i) => (i - 1 + imazhet.length) % imazhet.length)}
                      aria-label="Kodi i mëparshëm"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLuaj((v) => !v)}
                      aria-label={luaj ? "Ndalo ndërrimin" : "Vazhdo ndërrimin"}
                    >
                      {luaj ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAktivi((i) => (i + 1) % imazhet.length)}
                      aria-label="Kodi tjetër"
                    >
                      <ChevronRight size={18} />
                    </button>
                    {/* A set that will not read is usually going past too quickly - and a short set
                        is quicker to get through when it is not. */}
                    <button
                      type="button"
                      className="fcp-qr-plote-shpejtesia"
                      onClick={() => setShpejtesia((i) => (i + 1) % SHPEJTESITE.length)}
                    >
                      <Gauge size={16} /> {SHPEJTESITE[shpejtesia].emri}
                    </button>
                  </>
                )}
              </div>
              <span className="fcp-qr-plote-fusnote">{kodet.length} kode gjithsej · Esc për ta mbyllur</span>
            </div>
          </div>,
          document.body
        )}

      {modaliteti === "link" && linku && (
        <div className="fcp-transfer">
          {linku.img ? (
            <button type="button" className="fcp-transfer-qr-buton" onClick={hapLinkunPlote}>
              <img src={linku.img} alt="Kodi QR i transferit" className="fcp-transfer-qr" />
              <span>Prekni për ekran të plotë</span>
            </button>
          ) : (
            <div className="fcp-transfer-qr fcp-transfer-gjate">
              <Link2 size={28} />
              <span>{Math.round(linku.url.length / 1024)} kB</span>
              <small>shumë i gjatë për një kod QR</small>
            </div>
          )}
          <div className="fcp-transfer-side">
            <div className="fcp-row-title mb-1">
              {linku.img ? "Një kod, të gjitha të dhënat" : "Një link, të gjitha të dhënat"}
            </div>
            <div className="fcp-row-sub mb-2">
              {linku.img
                ? "Skanojeni me kamerën e zakonshme të pajisjes tjetër - hapet aplikacioni dhe ju pyet para se të zëvendësojë çka ka."
                : "Të dhënat nuk hyjnë në një kod QR, por linku punon njësoj: dërgojeni te vetja (WhatsApp, email, shënime) dhe hapeni në pajisjen tjetër - nuk ju duhet të skanoni disa kode."}{" "}
              Linku i mban të dhënat pas <code>#</code>, pra nuk kalon kurrë te ndonjë server.
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <Button size="sm" variant="outline-light" onClick={kopjoLinkun}>
                {kopjuar ? <Check size={14} className="me-1" /> : <Copy size={14} className="me-1" />}
                {kopjuar ? "U kopjua" : "Kopjo linkun"}
              </Button>
              <Button size="sm" variant="outline-light" onClick={ndajLinkun}>
                <Share2 size={14} className="me-1" /> Ndaje linkun
              </Button>
              <Button size="sm" variant="outline-light" onClick={mbyll}>
                <X size={14} className="me-1" /> Mbyll
              </Button>
            </div>
            <div className="fcp-row-sub mt-2">
              {Math.round(linku.url.length / 1024)} kB
              {!linku.img &&
                " - disa aplikacione bisede e presin një link kaq të gjatë; nëse nuk hapet, përdorni kopjen JSON ose Dërgo me QR."}
            </div>
          </div>
        </div>
      )}

      {linkuPlote &&
        linku?.img &&
        createPortal(
          <div className="fcp-qr-plote" role="dialog" aria-modal="true" aria-label="Kodi i transferit">
            <div className="fcp-qr-plote-koka">
              <div>
                <strong>Një kod, të gjitha të dhënat</strong>
                <span>Skanojeni me kamerën e zakonshme të pajisjes tjetër.</span>
              </div>
              <button type="button" onClick={mbyllLinkunPlote} aria-label="Mbyll">
                <X size={20} />
              </button>
            </div>
            <div className="fcp-qr-plote-kodi">
              <img src={linku.img} alt="Kodi QR i transferit" />
            </div>
            <div className="fcp-qr-plote-fundi">
              <span className="fcp-qr-plote-fusnote">
                {Math.round(linku.url.length / 1024)} kB · Esc për ta mbyllur
              </span>
            </div>
          </div>,
          document.body
        )}

      {modaliteti === "prano" &&
        createPortal(
          <div className="fcp-qr-plote errej" role="dialog" aria-modal="true" aria-label="Prano me kamerë">
            <div className="fcp-qr-plote-koka">
              <div>
                <strong>{total ? `Lexuar ${mbledhur.length} / ${total} kode` : "Duke kërkuar kodin..."}</strong>
                <span>Mbajeni kamerën para ekranit të pajisjes tjetër. Kodet lexohen në çfarëdo radhe.</span>
              </div>
              <button type="button" onClick={mbyll} aria-label="Ndalo">
                <X size={20} />
              </button>
            </div>

            <div className="fcp-qr-plote-kodi">
              <video ref={videoRef} playsInline muted aria-label="Kamera" />
            </div>

            <div className="fcp-qr-plote-fundi">
              {total > 0 && (
                <>
                  <ProgressBar now={(mbledhur.length / total) * 100} style={{ height: 6 }} />
                  {/* Which ones are still missing: the sender cycles endlessly, so seeing four gaps
                      left is the difference between waiting one more sweep and giving up. */}
                  <div className="fcp-qr-plote-pikat">
                    {Array.from({ length: total }, (_, i) => (
                      <span key={i} className={mbledhur.some((c) => c.index === i + 1) ? "ka" : ""} />
                    ))}
                  </div>
                </>
              )}
              <span className="fcp-qr-plote-fusnote">Esc për ta ndalur</span>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default TransferoQr;
