import { useEffect, useState } from "react";
import { Card, Button, Form, InputGroup, Alert } from "react-bootstrap";
import { QrCode, Copy, Check, Share2, FileText, Sheet, DatabaseBackup, MessageSquare } from "lucide-react";
import { saveAs } from "file-saver";
import { useData } from "../Context/DataContext";
import { exportAllData, shenoKopjen } from "../lib/db";
import { exportStatementPdf } from "../lib/exportPdf";
import { exportStatementExcel } from "../lib/exportExcel";
import TransferoQr from "./TransferoQr";
import { cashflow, filterByRange, monthBounds, totalBalance } from "../lib/finance";
import { formatMoney, monthKey, monthLabel, todayISO } from "../lib/format";
import "../Pages/Styles/Dashboard.css";

const ADRESA = "https://personal.financare.rilindkycyku.dev";

/**
 * Two kinds of sharing, kept apart on purpose.
 *
 * The app: a QR and a link, which carry nothing of yours. The data: this month's statement, the
 * workbook, a short summary, or the whole backup - handed to the phone's share sheet as a file
 * where that exists, and downloaded where it does not. Nothing is uploaded anywhere either way;
 * the file is built in the browser and passed straight to whichever app you pick.
 */
function Ndaje() {
  const { profile, accounts, categories, transactions, recurring, reload } = useData();
  const [qr, setQr] = useState(null);
  const [kopjuar, setKopjuar] = useState(false);
  const [duke, setDuke] = useState("");
  const [mesazhi, setMesazhi] = useState(null);

  useEffect(() => {
    let anuluar = false;
    // Loaded on demand: the generator is only needed by this one card.
    import("qrcode")
      .then((QRCode) =>
        (QRCode.default || QRCode).toDataURL(ADRESA, {
          width: 320,
          margin: 1,
          color: { dark: "#0d2137", light: "#ffffff" },
        })
      )
      .then((url) => !anuluar && setQr(url))
      .catch(() => undefined);
    return () => {
      anuluar = true;
    };
  }, []);

  const kopjo = async (tekst = ADRESA) => {
    try {
      await navigator.clipboard.writeText(tekst);
      setKopjuar(true);
      setTimeout(() => setKopjuar(false), 2000);
      return true;
    } catch {
      return false;
    }
  };

  const ndajLinkun = async () => {
    if (!navigator.share) return kopjo();
    try {
      await navigator.share({
        title: "FinanCarePersonal",
        text: "Ndjekës i financave personale që i ruan të dhënat vetëm në shfletuesin tënd.",
        url: ADRESA,
      });
    } catch {
      /* dismissed by the user */
    }
  };

  /** Hands a generated file to the share sheet, or downloads it where sharing files is not
   * supported (most desktop browsers). */
  const ndajSkedarin = async ({ blob, filename }, titulli) => {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: titulli, text: titulli });
        return "shared";
      } catch {
        return "cancelled";
      }
    }
    saveAs(blob, filename);
    return "downloaded";
  };

  const puno = async (celesi, fn) => {
    if (duke) return;
    setDuke(celesi);
    setMesazhi(null);
    try {
      const rezultat = await fn();
      if (rezultat === "downloaded") {
        setMesazhi({
          type: "info",
          text: "Shfletuesi juaj nuk mbështet ndarjen e skedarëve, prandaj skedari u shkarkua - dërgojeni si bashkëngjitje.",
        });
      }
    } catch (err) {
      setMesazhi({ type: "danger", text: `Nuk u nda: ${err.message}` });
    } finally {
      setDuke("");
    }
  };

  const { start, end } = monthBounds();
  const muaji = monthLabel(monthKey());

  const ndajPdf = () =>
    puno("pdf", async () => {
      const file = await exportStatementPdf({
        profile, accounts, categories, transactions, recurring, start, end, kthejBlob: true,
      });
      return ndajSkedarin(file, `Pasqyra - ${muaji}`);
    });

  const ndajExcel = () =>
    puno("excel", async () => {
      const file = await exportStatementExcel({
        profile, accounts, categories, transactions, recurring, start, end, kthejBlob: true,
      });
      return ndajSkedarin(file, `Pasqyra - ${muaji}`);
    });

  const ndajKopjen = () =>
    puno("json", async () => {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const rezultat = await ndajSkedarin(
        { blob, filename: `financarepersonal-backup-${todayISO()}.json` },
        "Kopja e të dhënave - FinanCarePersonal"
      );
      // A copy the user cancelled out of the share sheet never left the device, so it is not one.
      if (rezultat !== "cancelled") {
        await shenoKopjen(data.exportedAt);
        await reload();
      }
      return rezultat;
    });

  /** A month in one line, for pasting into a chat. */
  const ndajPermbledhjen = () =>
    puno("tekst", async () => {
      const flows = cashflow(filterByRange(transactions, start, end));
      const monedha = profile.monedha;
      const tekst = [
        `${muaji} - FinanCarePersonal`,
        `Hyrjet: ${formatMoney(flows.hyrjet, monedha)}`,
        `Shpenzimet: ${formatMoney(flows.shpenzimet, monedha)}`,
        `Kursimi: ${formatMoney(flows.neto, monedha)}`,
        `Bilanci: ${formatMoney(totalBalance(accounts, transactions), monedha)}`,
      ].join("\n");

      if (navigator.share) {
        try {
          await navigator.share({ title: `Përmbledhja - ${muaji}`, text: tekst });
          return "shared";
        } catch {
          return "cancelled";
        }
      }
      const ok = await kopjo(tekst);
      setMesazhi({
        type: ok ? "success" : "danger",
        text: ok ? "Përmbledhja u kopjua - ngjiteni ku doni." : "Kopjimi u bllokua nga shfletuesi.",
      });
      return "copied";
    });

  /**
   * The label, and the short form phones use. Four of these sit two-up on a phone, where the long
   * names wrap to three ragged lines in a half-width button; the group above them already says
   * these are this month's data.
   */
  const etiketa = (celesi, tekst, shkurt) =>
    duke === celesi ? (
      "Duke përgatitur..."
    ) : (
      <>
        <span className="d-none d-sm-inline">{tekst}</span>
        <span className="d-sm-none">{shkurt}</span>
      </>
    );

  return (
    <Card className="profile-card border-0 p-4 mb-4">
      <h2 className="fcp-card-title fw-bold mb-2">
        <Share2 size={18} className="me-2 text-primary" />
        Ndaje
      </h2>
      <p className="text-muted small">
        Ndani aplikacionin me dikë, ose dërgoni pasqyrën tuaj. Skedarët krijohen këtu në shfletues dhe i kalojnë
        drejt aplikacionit që zgjidhni - asgjë nuk ngarkohet në ndonjë server.
      </p>

      {mesazhi && (
        <Alert variant={mesazhi.type} onClose={() => setMesazhi(null)} dismissible className="py-2 small">
          {mesazhi.text}
        </Alert>
      )}

      <div className="fcp-share">
        {qr ? (
          <img src={qr} alt={`Kodi QR për ${ADRESA}`} className="fcp-share-qr" />
        ) : (
          <div className="fcp-share-qr fcp-share-qr-bosh" aria-hidden="true" />
        )}

        <div className="fcp-share-main">
          <InputGroup>
            <Form.Control value={ADRESA} readOnly onFocus={(e) => e.target.select()} aria-label="Linku i aplikacionit" />
            <Button variant="outline-light" onClick={() => kopjo()}>
              {kopjuar ? <Check size={16} /> : <Copy size={16} />}
              <span className="ms-1">{kopjuar ? "U kopjua" : "Kopjo"}</span>
            </Button>
          </InputGroup>

          <Button className="btn-primary mt-3" onClick={ndajLinkun}>
            <Share2 size={16} className="me-1" /> Ndaje aplikacionin
          </Button>
        </div>
      </div>

      <hr className="my-4" />

      <div className="fcp-row-sub mb-2">Ndaj të dhënat e mia - {muaji}</div>
      <div className="fcp-share-actions">
        <Button variant="outline-light" onClick={ndajPdf} disabled={Boolean(duke)}>
          <FileText size={16} className="me-1" /> {etiketa("pdf", "Pasqyra (PDF)", "Pasqyra PDF")}
        </Button>
        <Button variant="outline-light" onClick={ndajExcel} disabled={Boolean(duke)}>
          <Sheet size={16} className="me-1" /> {etiketa("excel", "Pasqyra (Excel)", "Pasqyra Excel")}
        </Button>
        <Button variant="outline-light" onClick={ndajPermbledhjen} disabled={Boolean(duke)}>
          <MessageSquare size={16} className="me-1" /> {etiketa("tekst", "Përmbledhja si tekst", "Përmbledhja")}
        </Button>
        <Button variant="outline-light" onClick={ndajKopjen} disabled={Boolean(duke)}>
          <DatabaseBackup size={16} className="me-1" /> {etiketa("json", "Kopja e plotë (JSON)", "Kopja JSON")}
        </Button>
      </div>
      <div className="fcp-row-sub mt-2">
        Kopja e plotë përmban çdo transaksion, llogari dhe buxhet - dërgojeni vetëm te vetja, p.sh. për ta hapur
        në një pajisje tjetër me <strong>Importo JSON</strong>.
      </div>

      <hr className="my-4" />

      <TransferoQr />
    </Card>
  );
}

export default Ndaje;
