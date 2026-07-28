import { useEffect, useRef, useState } from "react";
import { Button, Alert, ProgressBar } from "react-bootstrap";
import { QrCode, Camera, ChevronLeft, ChevronRight, Play, Pause, X, Link2, Copy, Check, Share2 } from "lucide-react";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { exportAllData, importAllData } from "../lib/db";
import { decodeTransfer, encodeTransfer, encodeTransferLink, parseChunk } from "../lib/transferQr";
import "../Pages/Styles/Dashboard.css";

/**
 * Device-to-device transfer of the whole database by QR: one side plays the codes, the other
 * scans them with its camera. Nothing is uploaded - the data goes across as light.
 *
 * Scanning uses the browser's own BarcodeDetector where it exists (Android Chrome, Edge); where it
 * does not, the JSON backup above does the same job through a file.
 */
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

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Sending: the codes cycle on their own, so the other phone can just be held up to the screen.
  useEffect(() => {
    if (modaliteti !== "dergo" || !luaj || imazhet.length < 2) return undefined;
    const id = setInterval(() => setAktivi((i) => (i + 1) % imazhet.length), 1300);
    return () => clearInterval(id);
  }, [modaliteti, luaj, imazhet.length]);

  const mbyll = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setModaliteti("");
    setKodet([]);
    setImazhet([]);
    setMbledhur([]);
    setGabimi("");
    setAktivi(0);
    setLinku(null);
  };

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

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
          // eslint-disable-next-line no-await-in-loop
          await QRCode.toDataURL(chunk, {
            width: 420,
            margin: 1,
            errorCorrectionLevel: "L",
            color: { dark: "#0d2137", light: "#ffffff" },
          })
        );
      }
      setKodet(chunks);
      setImazhet(imgs);
      setAktivi(0);
      setLuaj(true);
      setModaliteti("dergo");
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
        img = await QRCode.toDataURL(url, {
          width: 420,
          margin: 1,
          errorCorrectionLevel: "L",
          color: { dark: "#0d2137", light: "#ffffff" },
        });
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
      setTimeout(lexo, 220);
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
          <div className="d-flex gap-2 flex-wrap">
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
            <strong>Dërgo me QR</strong> i ndan të dhënat në disa kode dhe lexohet me <strong>Prano me kamerë</strong>
            këtu në aplikacion. <strong>Dërgo me një link</strong> i vendos të gjitha në një link të vetëm, që e kopjoni
            ose e dërgoni te vetja - dhe kur të dhënat janë mjaft të vogla, vjen edhe si një kod i vetëm që hapet me
            kamerën e zakonshme të telefonit.
          </div>
        </>
      )}

      {modaliteti === "dergo" && (
        <div className="fcp-transfer">
          <img src={imazhet[aktivi]} alt={`Kodi ${aktivi + 1} nga ${imazhet.length}`} className="fcp-transfer-qr" />
          <div className="fcp-transfer-side">
            <div className="fcp-row-title mb-1">
              Kodi {aktivi + 1} nga {imazhet.length}
            </div>
            <div className="fcp-row-sub mb-2">
              {imazhet.length > 1
                ? "Kodet ndërrohen vetë - mbajeni kamerën para ekranit derisa pajisja tjetër t'i lexojë të gjitha."
                : "Skanojeni këtë kod me pajisjen tjetër."}
            </div>
            <ProgressBar now={((aktivi + 1) / imazhet.length) * 100} className="mb-3" style={{ height: 6 }} />
            <div className="d-flex gap-2 flex-wrap">
              {imazhet.length > 1 && (
                <>
                  <Button
                    size="sm"
                    variant="outline-light"
                    onClick={() => setAktivi((i) => (i - 1 + imazhet.length) % imazhet.length)}
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <Button size="sm" variant="outline-light" onClick={() => setLuaj((v) => !v)}>
                    {luaj ? <Pause size={14} /> : <Play size={14} />}
                  </Button>
                  <Button size="sm" variant="outline-light" onClick={() => setAktivi((i) => (i + 1) % imazhet.length)}>
                    <ChevronRight size={14} />
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline-light" onClick={mbyll}>
                <X size={14} className="me-1" /> Mbyll
              </Button>
            </div>
            <div className="fcp-row-sub mt-2">{kodet.length} kode gjithsej</div>
          </div>
        </div>
      )}

      {modaliteti === "link" && linku && (
        <div className="fcp-transfer">
          {linku.img ? (
            <img src={linku.img} alt="Kodi QR i transferit" className="fcp-transfer-qr" />
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

      {modaliteti === "prano" && (
        <div className="fcp-transfer">
          <video ref={videoRef} className="fcp-transfer-video" playsInline muted aria-label="Kamera" />
          <div className="fcp-transfer-side">
            <div className="fcp-row-title mb-1">
              {total ? `Lexuar ${mbledhur.length} nga ${total} kode` : "Duke kërkuar kodin..."}
            </div>
            <div className="fcp-row-sub mb-2">
              Mbajeni kamerën para ekranit të pajisjes tjetër. Kodet mund të lexohen në çfarëdo radhe.
            </div>
            {total > 0 && (
              <ProgressBar now={(mbledhur.length / total) * 100} className="mb-3" style={{ height: 6 }} />
            )}
            <Button size="sm" variant="outline-light" onClick={mbyll}>
              <X size={14} className="me-1" /> Ndalo
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default TransferoQr;
