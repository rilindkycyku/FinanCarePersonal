import { useEffect, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import { toNumber, todayISO } from "../lib/format";
import { DEBT_TYPES, debtTypeMeta, eshteHuaPersonale, kategoriaEHuase, llojiITransaksionitTeBorxhit } from "../lib/options";
import VleraInput from "./VleraInput";
import ZgjedhesiKategorive from "./ZgjedhesiKategorive";
import { ColorPicker } from "./Pickers";
import "./ModalForms.css";
import Zgjedhesi from "./Zgjedhesi";
import { opsionetEThjeshta, opsionetLlogarive } from "../lib/opsionet";

const BLANK = {
  emri: "",
  lloji: "karte",
  vleraTotale: "",
  kreditori: "",
  dataFillimit: todayISO(),
  dataMbarimit: "",
  normaVjetore: "",
  kategoriaId: "",
  ngjyra: "#f43f5e",
  shenim: "",
};

/**
 * Add/edit a debt note - a credit card, a loan, an instalment plan, money borrowed from or lent
 * to someone. The note is not an account: it is stored on its own and never reaches the balance
 * maths, so what is written here changes nothing in "Bilanci Total".
 *
 * `vleraTotale` is only the opening figure; everything after it is a line in `pagesat`, which the
 * form carries through untouched on edit so re-saving a note can never lose its history.
 */
function ShtoBorxhin({ show, onHide, initial, llojiFillestar }) {
  const { categories, accounts, save, saveMany, simboli, njeLlogari, llogariaKryesore } = useData();
  const [debt, setDebt] = useState(BLANK);
  const [error, setError] = useState("");
  // The money handed over (or received) when a loan between people starts. Only offered on a new
  // note: lending 200 € from the wallet is 200 € the wallet no longer has, and without this the
  // note was the only record of it, so the cash balance stayed 200 € too high.
  const [fillimi, setFillimi] = useState({ lidh: true, llogariaId: "", kategoriaId: "" });
  const aktive = accounts.filter((a) => !a.arkivuar);

  useEffect(() => {
    if (!show) return;
    setError("");
    setDebt(
      initial
        ? {
            ...BLANK,
            ...initial,
            vleraTotale: String(initial.vleraTotale ?? ""),
            dataMbarimit: initial.dataMbarimit || "",
            normaVjetore: initial.normaVjetore ? String(initial.normaVjetore) : "",
            kategoriaId: initial.kategoriaId || "",
            kreditori: initial.kreditori || "",
            shenim: initial.shenim || "",
          }
        : // The page adds from two separate sections ("what I owe" / "what I am owed"), so the
          // section the user pressed decides which way the new note points.
          { ...BLANK, lloji: llojiFillestar || BLANK.lloji }
    );
    setFillimi({
      lidh: true,
      llogariaId: (njeLlogari ? llogariaKryesore?.id : aktive.length === 1 ? aktive[0].id : "") || "",
      kategoriaId: "",
    });
    // Reset on opening only; the account list changing under an open form must not undo a choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, initial, llojiFillestar]);

  const setField = (name, value) => setDebt((prev) => ({ ...prev, [name]: value }));

  const meta = debtTypeMeta(debt.lloji);
  const kerkese = meta.drejtimi === "kerkese";
  // Lending is money out, borrowing is money in - the same move as a "shtesë" on the note.
  const llojiFillimit = llojiITransaksionitTeBorxhit(debt.lloji, "shtese");
  const ofrohetFillimi = !initial && eshteHuaPersonale(debt.lloji) && aktive.length > 0;
  const lidhFillimin = ofrohetFillimi && fillimi.lidh;
  // What the picker shows until the user picks: "Hua e Dhënë" / "Hua e Marrë" when the ledger
  // still has it open. Worked out on every render, so switching the type swaps it too.
  const kategoriaFillimit = (() => {
    const zgjedhur = categories.find((c) => c.id === fillimi.kategoriaId);
    if (zgjedhur && zgjedhur.lloji === llojiFillimit) return zgjedhur.id;
    const id = kategoriaEHuase(debt.lloji, "shtese");
    const parazgjedhur = categories.find((c) => c.id === id);
    return parazgjedhur && !parazgjedhur.arkivuar && parazgjedhur.lloji === llojiFillimit ? id : "";
  })();

  const handleSave = async (e) => {
    e.preventDefault();
    if (!debt.emri.trim()) return setError("Emri i borxhit është i detyrueshëm.");
    if (!(toNumber(debt.vleraTotale) > 0)) return setError("Vlera duhet të jetë më e madhe se zero.");
    if (debt.dataMbarimit && debt.dataFillimit && debt.dataMbarimit < debt.dataFillimit) {
      return setError("Afati i fundit nuk mund të jetë para datës së fillimit.");
    }
    // Optional, but a typed rate has to be a real one: 150 is a slipped decimal point, and a
    // negative rate is a debt that pays you.
    if (debt.normaVjetore !== "" && !(toNumber(debt.normaVjetore) >= 0 && toNumber(debt.normaVjetore) <= 100)) {
      return setError("Norma vjetore duhet të jetë mes 0 dhe 100 për qind.");
    }
    if (lidhFillimin && !fillimi.llogariaId) return setError("Zgjidhni llogarinë nga e cila lëvizën paratë.");
    if (lidhFillimin && !kategoriaFillimit) return setError("Zgjidhni kategorinë e transaksionit.");
    setError("");

    const id = debt.id || makeId("debt");
    const transaksioniFillestarId = lidhFillimin ? makeId("tx") : debt.transaksioniFillestarId || null;
    const shenimi = {
      id,
      emri: debt.emri.trim(),
      lloji: debt.lloji,
      vleraTotale: toNumber(debt.vleraTotale),
      kreditori: debt.kreditori.trim(),
      dataFillimit: debt.dataFillimit || todayISO(),
      dataMbarimit: debt.dataMbarimit || null,
      normaVjetore: debt.normaVjetore === "" ? null : toNumber(debt.normaVjetore),
      kategoriaId: debt.kategoriaId || null,
      ngjyra: debt.ngjyra,
      shenim: debt.shenim.trim(),
      arkivuar: Boolean(debt.arkivuar),
      pagesat: Array.isArray(debt.pagesat) ? debt.pagesat : [],
      // Kept so deleting the note can say that this transaction stays behind, like the payments'.
      transaksioniFillestarId,
    };

    if (lidhFillimin) {
      await saveMany([
        [STORES.borxhet, shenimi],
        [
          STORES.transactions,
          {
            id: transaksioniFillestarId,
            data: shenimi.dataFillimit,
            lloji: llojiFillimit,
            vlera: shenimi.vleraTotale,
            llogariaId: fillimi.llogariaId,
            llogariaDestinacionId: null,
            kategoriaId: kategoriaFillimit,
            pershkrimi: `${kerkese ? "Hua e dhënë" : "Hua e marrë"}: ${shenimi.kreditori || shenimi.emri}`,
            shenim: "",
            qellimiId: null,
            perseritjaId: null,
            borxhiId: id,
            monedhaOrigjinale: null,
            vleraOrigjinale: null,
            kursi: null,
            krijuar: new Date().toISOString(),
          },
        ],
      ]);
    } else {
      await save(STORES.borxhet, shenimi);
    }

    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>{initial ? "Ndrysho Borxhin" : "Shto Borxh / Kartelë"}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <div className="fcp-modal-hint mb-3">
            Borxhet mbahen vetëm si shënim - nuk hyjnë në bilancin e llogarive dhe as në hyrjet apo
            shpenzimet e muajit. Pagesat i zbritni më pas nga vetë borxhi.
          </div>

          <Row className="g-3">
            <Form.Group as={Col} md={12} controlId="debt-emri">
              <Form.Label>
                Emri <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                placeholder="p.sh. Kartela e kreditit, Borxhi te Arditi"
                value={debt.emri}
                onChange={(e) => setField("emri", e.target.value)}
                autoFocus
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="debt-lloji">
              <Form.Label>Lloji</Form.Label>
              <Zgjedhesi
                id="debt-lloji"
                value={debt.lloji}
                onChange={(v) => setField("lloji", v)}
                opsionet={opsionetEThjeshta(DEBT_TYPES)}
                titulli="Lloji i borxhit"
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="debt-vleratotale">
              <Form.Label>
                {kerkese ? "Shuma e dhënë" : "Shuma e plotë"} <span className="text-danger">*</span>
              </Form.Label>
              <VleraInput
                value={debt.vleraTotale}
                onChange={(vlera) => setField("vleraTotale", vlera)}
                simboli={simboli}
                titulliKalkulatorit={kerkese ? "Shuma e dhënë" : "Shuma e plotë"}
                required
              />
              <div className="fcp-modal-hint">
                Sa ishte borxhi në fillim. Blerjet e reja ose kamatat shtohen më vonë si &quot;Shtesë&quot;.
              </div>
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="debt-kreditori">
              <Form.Label>{kerkese ? "Kush ju ka borxh" : "Kujt i keni borxh"}</Form.Label>
              <Form.Control
                placeholder={kerkese ? "p.sh. Arditi" : "p.sh. ProCredit Bank"}
                value={debt.kreditori}
                onChange={(e) => setField("kreditori", e.target.value)}
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="debt-datafillimit">
              <Form.Label>Data e Fillimit</Form.Label>
              <Form.Control
                type="date"
                value={debt.dataFillimit || ""}
                onChange={(e) => setField("dataFillimit", e.target.value)}
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="debt-datambarimit">
              <Form.Label>Afati i Fundit (opsional)</Form.Label>
              <Form.Control
                type="date"
                value={debt.dataMbarimit || ""}
                onChange={(e) => setField("dataMbarimit", e.target.value)}
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="debt-norma">
              <Form.Label>Norma Vjetore e Kamatës (opsional)</Form.Label>
              <Form.Control
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.01"
                placeholder="p.sh. 18"
                value={debt.normaVjetore}
                onChange={(e) => setField("normaVjetore", e.target.value)}
              />
              <div className="fcp-modal-hint">
                {kerkese
                  ? "Nëse hua-ja juaj ka kamatë. Lëreni bosh kur s'ka."
                  : "Shkruajeni si në kontratë (18 për 18%). Me të, faqja e di sa nga çdo pagesë shkon te kamata dhe sa e zbret vërtet borxhin - pa të, llogaritet sikur borxhi të mos rritet vetë."}
              </div>
            </Form.Group>

            {/* Between people the forms already know the category ("Hua & Borxhe"), so the field
                only stays for a note that was given one before. */}
            {(!eshteHuaPersonale(debt.lloji) || debt.kategoriaId) && (
              <Form.Group as={Col} md={6} controlId="debt-kategoriaid">
                <Form.Label>Kategoria e Parazgjedhur (opsional)</Form.Label>
                <ZgjedhesiKategorive
                  id="debt-kategoriaid"
                  categories={categories}
                  lloji="shpenzim"
                  value={debt.kategoriaId}
                  onChange={(kategoriaId) => setField("kategoriaId", kategoriaId)}
                  placeholder="Pa kategori"
                  emptyLabel="Pa kategori"
                />
                <div className="fcp-modal-hint">
                  Përdoret vetëm kur zgjidhni ta zbrisni një pagesë edhe nga një llogari e vërtetë.
                </div>
              </Form.Group>
            )}

            {ofrohetFillimi && (
              <Col md={12}>
                <Form.Check
                  type="checkbox"
                  id="debt-fillimi-lidh"
                  checked={fillimi.lidh}
                  onChange={(e) => setFillimi((f) => ({ ...f, lidh: e.target.checked }))}
                  label={kerkese ? "Zbrite shumën edhe nga llogaria" : "Shtoje shumën edhe në llogari"}
                />
                <div className="fcp-modal-hint">
                  {fillimi.lidh
                    ? kerkese
                      ? "Paratë që dhatë dalin nga llogaria si «Hua e Dhënë», dhe kur t'ju kthehen, «Kthim» i shton përsëri."
                      : "Paratë që morët hyjnë në llogari si «Hua e Marrë», dhe çdo pagesë që ktheni i zbret përsëri."
                    : "E lënë e pashënjuar, borxhi mbetet vetëm shënim dhe asnjë llogari nuk preket."}
                </div>
              </Col>
            )}

            {lidhFillimin && !njeLlogari && (
              <Form.Group as={Col} md={6} controlId="debt-fillimi-llogaria">
                <Form.Label>
                  Llogaria <span className="text-danger">*</span>
                </Form.Label>
                <Zgjedhesi
                  id="debt-fillimi-llogaria"
                  value={fillimi.llogariaId}
                  onChange={(v) => setFillimi((f) => ({ ...f, llogariaId: v }))}
                  opsionet={opsionetLlogarive(aktive)}
                  placeholder="Zgjidh llogarinë..."
                  titulli="Zgjidh llogarinë"
                />
              </Form.Group>
            )}

            {lidhFillimin && (
              <Form.Group as={Col} md={njeLlogari ? 12 : 6} controlId="debt-fillimi-kategoria">
                <Form.Label>
                  Kategoria e transaksionit <span className="text-danger">*</span>
                </Form.Label>
                <ZgjedhesiKategorive
                  id="debt-fillimi-kategoria"
                  categories={categories}
                  lloji={llojiFillimit}
                  value={kategoriaFillimit}
                  onChange={(kategoriaId) => setFillimi((f) => ({ ...f, kategoriaId }))}
                  required
                />
              </Form.Group>
            )}

            <Col md={12}>
              <ColorPicker value={debt.ngjyra} onChange={(c) => setField("ngjyra", c)} />
            </Col>

            <Form.Group as={Col} md={12} controlId="debt-shenim">
              <Form.Label>Shënim</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="p.sh. kësti minimal 50 € në muaj, dega ku u nënshkrua"
                value={debt.shenim}
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
            {initial ? "Ruaj Ndryshimet" : "Ruaj Borxhin"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoBorxhin;
