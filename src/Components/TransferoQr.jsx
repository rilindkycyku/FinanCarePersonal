import { useEffect, useRef, useState } from "react";
import { Button, Alert, ProgressBar } from "react-bootstrap";
import { QrCode, Camera, ChevronLeft, ChevronRight, Play, Pause, X } from "lucide-react";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { exportAllData, importAllData } from "../lib/db";
import { decodeTransfer, encodeTransfer, parseChunk } from "../lib/transferQr";
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
  const [duke, setDuke] = useState(false);

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
  };

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const filloDergimin = async () => {
    setDuke(true);
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
      setDuke(false);
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
            <Button variant="outline-light" onClick={filloDergimin} disabled={duke}>
              <QrCode size={16} className="me-1" /> {duke ? "Duke krijuar..." : "Dërgo me QR"}
            </Button>
            <Button variant="outline-light" onClick={filloPranimin}>
              <Camera size={16} className="me-1" /> Prano me kamerë
            </Button>
          </div>
          <div className="fcp-row-sub mt-2">
            Në pajisjen e vjetër shtypni <strong>Dërgo me QR</strong>, në të renë <strong>Prano me kamerë</strong>,
            dhe mbajeni kamerën para ekranit derisa të lexohen të gjitha kodet.
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
