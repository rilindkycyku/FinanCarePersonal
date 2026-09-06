import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { TrendingDown, PlusCircle } from "lucide-react";
import { useData } from "../Context/DataContext";
import VleraInput from "./VleraInput";
import ZgjedhesiKategorive from "./ZgjedhesiKategorive";
import { makeId, STORES } from "../lib/db";
import { toNumber, todayISO, formatMoney } from "../lib/format";
import { debtProgress } from "../lib/finance";
import { debtTypeMeta } from "../lib/options";
import { kategoriTeHapura } from "../lib/kategorite";
import "./ModalForms.css";
import Zgjedhesi from "./Zgjedhesi";
import { opsionetLlogarive } from "../lib/opsionet";

const blank = (lloji = "pagese") => ({
  lloji,
  data: todayISO(),
  vlera: "",
  shenim: "",
  llogariaId: "",
  kategoriaId: "",
});

/**
 * One line on a debt note: a payment that brings it down, or a "shtesë" (a new purchase on the
 * card, interest, a fee) that puts it back up. The line is stored inside the note itself, so by
 * default nothing here touches the ledger at all - the debt goes down, the accounts do not move.
 *
 * "Zbrite edhe nga llogaria" is the opt-in for the other half: it additionally books a real
 * transaction on the chosen account, because paying a card off usually *is* money leaving the
 * bank. The line keeps that transaction's id so editing the payment keeps the two in step and
 * deleting it can take the transaction with it. The note stays the source of truth for the debt's
 * progress, so a transaction deleted from the Transaksionet page just leaves the line as a plain
 * note instead of corrupting the balance owed.
 */
function ShtoPagesenBorxhit({ show, onHide, borxhi, initial }) {
  const { accounts, categories, transactions, recurring, saveMany, destroyMany, simboli, monedha, njeLlogari, llogariaKryesore } =
    useData();
  const [entry, setEntry] = useState(blank());
  const [lidh, setLidh] = useState(false);
  const [error, setError] = useState("");

  const meta = debtTypeMeta(borxhi?.lloji);
  const kerkese = meta.drejtimi === "kerkese";
  // Getting money back from someone you lent to is income; every other payment is an expense.
  const txLloji = kerkese ? "hyrje" : "shpenzim";

  const aktive = useMemo(() => accounts.filter((a) => !a.arkivuar), [accounts]);

  // Only for the hint under the field, so it counts what the picker would offer - archived ones
  // are not among them.
  const kategoriteERelevante = useMemo(
    () => kategoriTeHapura(categories).filter((c) => c.lloji === txLloji),
    [categories, txLloji]
  );

  useEffect(() => {
    if (!show) return;
    setError("");
    const lidhur = initial?.transaksioniId
      ? transactions.find((tx) => tx.id === initial.transaksioniId)
      : null;
    // A new line defaults to "pagesë"/"kthim" (never "shtesë" - `blank()` opens on it), and that
    // kind of line is real money moving to or from an account, so it starts ticked rather than
    // making the user opt in every time. Editing an existing line still follows what it actually
    // has: a line saved as note-only stays that way until someone deliberately ticks the box.
    setLidh(Boolean(lidhur) || (!initial && aktive.length > 0));
    // The note's category describes the *debt*, and money coming back from a loan is income: on a
    // "hua e dhënë" that prefill was an expense category landing on an `hyrje`, which the picker
    // below cannot even show (it lists income categories only) and which files the return under a
    // spending category. Anything that does not fit the transaction is dropped, so the field is
    // empty and has to be answered - the save already refuses to go through without it.
    const kategoriaQePershtatet = (id) => {
      const kategoria = categories.find((c) => c.id === id);
      return kategoria?.lloji === txLloji ? id : "";
    };
    setEntry(
      initial
        ? {
            ...blank(initial.lloji || "pagese"),
            ...initial,
            vlera: String(initial.vlera ?? ""),
            shenim: initial.shenim || "",
            // Falls back to the same preselection a new payment gets, so ticking the box on a line
            // that was note-only until now does not leave the account picker empty.
            llogariaId: lidhur?.llogariaId || (njeLlogari ? llogariaKryesore?.id : aktive[0]?.id) || "",
            kategoriaId:
              kategoriaQePershtatet(lidhur?.kategoriaId) || kategoriaQePershtatet(borxhi?.kategoriaId),
          }
        : {
            ...blank(),
            llogariaId: (njeLlogari ? llogariaKryesore?.id : aktive[0]?.id) || "",
            kategoriaId: kategoriaQePershtatet(borxhi?.kategoriaId),
          }
    );
  }, [show, initial, borxhi, transactions, categories, txLloji, aktive, njeLlogari, llogariaKryesore]);

  const setField = (name, value) => setEntry((prev) => ({ ...prev, [name]: value }));

  const isShtese = entry.lloji === "shtese";
  // A new charge on a card never leaves a bank account, so there is nothing to book against one.
  const mundLidhet = !isShtese && aktive.length > 0;

  // Quick-amount chips for debt lines: repeating instalments from past payments, any recurring
  // payment linked to this debt note (e.g. fixed card/loan instalment), and the remaining balance.
  const shumatEShpeshta = useMemo(() => {
    if (!borxhi) return [];
    const lista = [];

    // 1. Remaining balance if paying down the debt
    if (entry.lloji === "pagese") {
      const ecuria = debtProgress(borxhi);
      const mbetur = Math.round(ecuria.mbetur * 100) / 100;
      if (mbetur > 0) {
        lista.push({
          vlera: mbetur,
          arsyeja: "mbetja",
          label: `Mbetja: ${formatMoney(mbetur, monedha)}`,
        });
      }
    }

    // 2. Any recurring payment tied to this debt note (e.g. card/loan instalment)
    const perseritje = (recurring || []).find((r) => r.borxhiId === borxhi.id && r.vlera > 0);
    if (perseritje) {
      const kesti = Math.round(perseritje.vlera * 100) / 100;
      lista.push({
        vlera: kesti,
        arsyeja: "kesti",
        label: `Kësti: ${formatMoney(kesti, monedha)}`,
      });
    }

    // 3. Past lines of the same direction on this debt
    const pagesat = (Array.isArray(borxhi.pagesat) ? borxhi.pagesat : [])
      .filter((p) => p.id !== initial?.id && p.lloji === entry.lloji && p.vlera > 0)
      .map((p) => Math.round(p.vlera * 100) / 100);

    const numerimi = new Map();
    pagesat.forEach((v) => numerimi.set(v, (numerimi.get(v) || 0) + 1));
    const teShpeshta = [...numerimi.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .map(([v]) => v);

    teShpeshta.forEach((v) =>
      lista.push({
        vlera: v,
        arsyeja: "historik",
        label: formatMoney(v, monedha),
      })
    );

    // Deduplicate by vlera while keeping order, cap at 4 chips
    const unike = [];
    const pare = new Set();
    for (const item of lista) {
      if (!pare.has(item.vlera)) {
        pare.add(item.vlera);
        unike.push(item);
      }
      if (unike.length >= 4) break;
    }

    return unike;
  }, [borxhi, entry.lloji, initial?.id, recurring, monedha]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!borxhi) return;
    const vlera = toNumber(entry.vlera);
    if (!entry.data) return setError("Data është e detyrueshme.");
    if (!(vlera > 0)) return setError("Vlera duhet të jetë një numër më i madh se zero.");

    const lidhet = mundLidhet && lidh;
    if (lidhet && !entry.llogariaId) return setError("Zgjidhni llogarinë nga e cila zbritet pagesa.");
    if (lidhet && !entry.kategoriaId) return setError("Zgjidhni kategorinë e transaksionit.");
    setError("");

    const vjeterTxId = initial?.transaksioniId || null;
    // Unlinking (or switching the line to a "shtesë") takes the transaction it had created with it,
    // otherwise the account would keep an expense the user just detached from the debt.
    if (vjeterTxId && !lidhet) {
      await destroyMany([[STORES.transactions, vjeterTxId]]);
    }

    const transaksioniId = lidhet ? vjeterTxId || makeId("tx") : null;
    // Kept from the original line when editing: `krijuar` is what orders two rows booked on the
    // same date (finance.js), and re-stamping it here would jump an old line to the top.
    const rreshti = {
      id: initial?.id || makeId("dpay"),
      data: entry.data,
      lloji: isShtese ? "shtese" : "pagese",
      vlera,
      shenim: entry.shenim.trim(),
      llogariaId: lidhet ? entry.llogariaId : null,
      transaksioniId,
      krijuar: initial?.krijuar || new Date().toISOString(),
    };

    const pagesat = Array.isArray(borxhi.pagesat) ? borxhi.pagesat : [];
    const records = [
      [
        STORES.borxhet,
        {
          ...borxhi,
          pagesat: initial
            ? pagesat.map((p) => (p.id === rreshti.id ? rreshti : p))
            : [...pagesat, rreshti],
        },
      ],
    ];

    if (lidhet) {
      records.push([
        STORES.transactions,
        {
          id: transaksioniId,
          data: entry.data,
          lloji: txLloji,
          vlera,
          llogariaId: entry.llogariaId,
          llogariaDestinacionId: null,
          kategoriaId: entry.kategoriaId,
          pershkrimi: `${kerkese ? "Kthim borxhi" : "Pagesë borxhi"}: ${borxhi.emri}`,
          shenim: entry.shenim.trim(),
          qellimiId: null,
          perseritjaId: null,
          borxhiId: borxhi.id,
          monedhaOrigjinale: null,
          vleraOrigjinale: null,
          kursi: null,
          krijuar: transactions.find((t) => t.id === transaksioniId)?.krijuar || rreshti.krijuar,
        },
      ]);
    }

    await saveMany(records);
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>{initial ? "Ndrysho Rreshtin" : `Shto te "${borxhi?.emri || "borxhi"}"`}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <div className="fcp-type-toggle" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <button
              type="button"
              className={`fcp-type-btn hyrje${!isShtese ? " active" : ""}`}
              onClick={() => setField("lloji", "pagese")}
            >
              <TrendingDown size={15} />
              {kerkese ? "Kthim" : "Pagesë"}
            </button>
            <button
              type="button"
              className={`fcp-type-btn shpenzim${isShtese ? " active" : ""}`}
              onClick={() => setField("lloji", "shtese")}
            >
              <PlusCircle size={15} />
              Shtesë
            </button>
          </div>

          <Row className="g-3">
            <Form.Group as={Col} md={6} controlId="dpay-vlera">
              <Form.Label>
                Vlera <span className="text-danger">*</span>
              </Form.Label>
              <VleraInput
                value={entry.vlera}
                onChange={(vlera) => setField("vlera", vlera)}
                simboli={simboli}
                titulliKalkulatorit="Vlera e pagesës"
                autoFocus
                required
              />
              {shumatEShpeshta.length > 0 && (
                <div className="d-flex align-items-center flex-wrap gap-2 mt-2">
                  {shumatEShpeshta.map((item) => (
                    <button
                      key={`${item.arsyeja}-${item.vlera}`}
                      type="button"
                      className="fcp-shuma-shpejte"
                      onClick={() => setField("vlera", String(item.vlera))}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="dpay-data">
              <Form.Label>
                Data <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="date"
                value={entry.data}
                onChange={(e) => setField("data", e.target.value)}
                required
              />
            </Form.Group>

            <Col md={12}>
              {isShtese ? (
                <div className="fcp-modal-hint">
                  Një shtesë e rrit borxhin - blerje e re me kartelë, kamatë ose tarifë. Mbetet vetëm
                  shënim, nuk prek asnjë llogari.
                </div>
              ) : mundLidhet ? (
                <>
                  <Form.Check
                    type="checkbox"
                    id="dpay-lidh"
                    checked={lidh}
                    onChange={(e) => setLidh(e.target.checked)}
                    label={
                      kerkese
                        ? "Shtoja edhe si hyrje në një llogari të vërtetë"
                        : "Zbrite edhe nga një llogari e vërtetë"
                    }
                  />
                  <div className="fcp-modal-hint">
                    {lidh
                      ? "Krijohet edhe një transaksion i vërtetë, pra bilanci i llogarisë ndryshon. Borxhi zbritet gjithsesi."
                      : "E lënë e pashënjuar, pagesa zbret vetëm borxhin - asnjë llogari nuk preket."}
                  </div>
                </>
              ) : (
                <div className="fcp-modal-hint">
                  Pagesa zbret vetëm borxhin - asnjë llogari nuk preket.
                </div>
              )}
            </Col>

            {lidh && mundLidhet && (
              <>
                {njeLlogari ? (
                  <Col md={12}>
                    <div className="fcp-modal-hint">
                      Llogaria: <strong>{llogariaKryesore?.emri || "Llogaria kryesore"}</strong>
                    </div>
                  </Col>
                ) : (
                  <Form.Group as={Col} md={6} controlId="dpay-llogariaid">
                    <Form.Label>
                      Llogaria <span className="text-danger">*</span>
                    </Form.Label>
                    <Zgjedhesi
                      id="dpay-llogariaid"
                      value={entry.llogariaId}
                      onChange={(v) => setField("llogariaId", v)}
                      opsionet={opsionetLlogarive(aktive)}
                      placeholder="Zgjidh llogarinë..."
                      titulli="Zgjidh llogarinë"
                    />
                  </Form.Group>
                )}

                <Form.Group as={Col} md={njeLlogari ? 12 : 6} controlId="dpay-kategoriaid">
                  <Form.Label>
                    Kategoria <span className="text-danger">*</span>
                  </Form.Label>
                  <ZgjedhesiKategorive
                    id="dpay-kategoriaid"
                    categories={categories}
                    lloji={txLloji}
                    value={entry.kategoriaId}
                    onChange={(kategoriaId) => setField("kategoriaId", kategoriaId)}
                    required
                  />
                  {kategoriteERelevante.length === 0 && (
                    <div className="fcp-modal-hint">
                      Nuk ka kategori për këtë lloj - shtoni një te faqja Kategoritë.
                    </div>
                  )}
                </Form.Group>
              </>
            )}

            <Form.Group as={Col} md={12} controlId="dpay-shenim">
              <Form.Label>Shënim</Form.Label>
              <Form.Control
                placeholder={isShtese ? "p.sh. blerje online" : "p.sh. kësti i marsit"}
                value={entry.shenim}
                onChange={(e) => setField("shenim", e.target.value)}
              />
            </Form.Group>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Anulo
          </Button>
          <Button type="submit" className="btn-primary">
            {initial ? "Ruaj Ndryshimet" : "Ruaj"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoPagesenBorxhit;
