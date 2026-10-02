import { useEffect, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import { toNumber, todayISO } from "../lib/format";
import { DEBT_TYPES, KATEGORIA_SIPAS_LLOJIT_TE_BORXHIT, LLOJET_E_BASHKUARA, debtTypeMeta } from "../lib/options";
import { LLOJET_ME_KESTE_PER_BLERJE } from "../lib/finance";
import VleraInput from "./VleraInput";
import Ndihme from "./Ndihme";
import ZgjedhesiKategorive from "./ZgjedhesiKategorive";
import { ColorPicker } from "./Pickers";
import "./ModalForms.css";
import Zgjedhesi from "./Zgjedhesi";
import { opsionetEThjeshta } from "../lib/opsionet";

const BLANK = {
  emri: "",
  lloji: "karte",
  vleraTotale: "",
  kreditori: "",
  dataFillimit: todayISO(),
  dataMbarimit: "",
  normaVjetore: "",
  nrKesteve: "",
  kestiMujor: "",
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
  const { categories, save, simboli } = useData();
  const [debt, setDebt] = useState(BLANK);
  const [error, setError] = useState("");

  // The starter category for a type, but only while it is there to pick: one the user deleted or
  // archived is not brought back through this field.
  const kategoriaESugjeruar = (lloji) => {
    const id = KATEGORIA_SIPAS_LLOJIT_TE_BORXHIT[lloji];
    return categories.some((c) => c.id === id && !c.arkivuar) ? id : "";
  };

  useEffect(() => {
    if (!show) return;
    setError("");
    const lloji = initial ? LLOJET_E_BASHKUARA[initial.lloji] || initial.lloji : llojiFillestar || BLANK.lloji;
    setDebt(
      initial
        ? {
            ...BLANK,
            ...initial,
            // A merged type opens as the one it became, so the picker shows a real row.
            lloji: LLOJET_E_BASHKUARA[initial.lloji] || initial.lloji,
            vleraTotale: String(initial.vleraTotale ?? ""),
            dataMbarimit: initial.dataMbarimit || "",
            normaVjetore: initial.normaVjetore ? String(initial.normaVjetore) : "",
            nrKesteve: initial.nrKesteve ? String(initial.nrKesteve) : "",
            kestiMujor: initial.kestiMujor ? String(initial.kestiMujor) : "",
            // A note saved without one gets its type's suggestion - visible here, so nothing is
            // filled in behind the user's back.
            kategoriaId: initial.kategoriaId || kategoriaESugjeruar(lloji),
            kreditori: initial.kreditori || "",
            shenim: initial.shenim || "",
          }
        : // The page adds from two separate sections ("what I owe" / "what I am owed"), so the
          // section the user pressed decides which way the new note points.
          { ...BLANK, lloji, kategoriaId: kategoriaESugjeruar(lloji) }
    );
    // `categories` is left out on purpose: a reload while the form is open must not reset what the
    // user has typed. The suggestion only needs the list as it was when the form opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, initial, llojiFillestar]);

  const setField = (name, value) => setDebt((prev) => ({ ...prev, [name]: value }));

  // Changing the type moves the category with it - but only while the field still holds what the
  // old type suggested (or nothing): a category the user picked by hand stays, unless it now points
  // the wrong way (an expense category on a loan given out, whose returns are income).
  const setLloji = (lloji) =>
    setDebt((prev) => {
      const drejtimi = debtTypeMeta(lloji).drejtimi === "kerkese" ? "hyrje" : "shpenzim";
      const zgjedhur = categories.find((c) => c.id === prev.kategoriaId);
      const mbetet = zgjedhur && zgjedhur.lloji === drejtimi && prev.kategoriaId !== kategoriaESugjeruar(prev.lloji);
      return { ...prev, lloji, kategoriaId: mbetet ? prev.kategoriaId : kategoriaESugjeruar(lloji) };
    });

  const meta = debtTypeMeta(debt.lloji);
  const kerkese = meta.drejtimi === "kerkese";
  // A card splits each purchase into its own run of instalments, so the note asks only how many
  // the opening amount was split into (the purchases get theirs on their own lines); a loan or a
  // personal debt is repaid at one fixed amount a month instead.
  const kestePerBlerje = LLOJET_ME_KESTE_PER_BLERJE.includes(debt.lloji);

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
    if (kestePerBlerje && debt.nrKesteve !== "" && !(Number.isInteger(Number(debt.nrKesteve)) && Number(debt.nrKesteve) >= 1 && Number(debt.nrKesteve) <= 120)) {
      return setError("Numri i kësteve duhet të jetë një numër i plotë nga 1 deri në 120.");
    }
    if (!kestePerBlerje && debt.kestiMujor !== "" && !(toNumber(debt.kestiMujor) > 0)) {
      return setError("Kësti mujor duhet të jetë më i madh se zero.");
    }
    setError("");

    await save(STORES.borxhet, {
      id: debt.id || makeId("debt"),
      emri: debt.emri.trim(),
      lloji: debt.lloji,
      vleraTotale: toNumber(debt.vleraTotale),
      kreditori: debt.kreditori.trim(),
      dataFillimit: debt.dataFillimit || todayISO(),
      dataMbarimit: debt.dataMbarimit || null,
      normaVjetore: debt.normaVjetore === "" ? null : toNumber(debt.normaVjetore),
      // Only the field that fits the type is kept: a fixed instalment left behind on a note changed
      // to a card would quietly override its per-purchase schedule.
      nrKesteve: kestePerBlerje && debt.nrKesteve !== "" ? Number(debt.nrKesteve) : null,
      kestiMujor: !kestePerBlerje && debt.kestiMujor !== "" ? toNumber(debt.kestiMujor) : null,
      kategoriaId: debt.kategoriaId || null,
      ngjyra: debt.ngjyra,
      shenim: debt.shenim.trim(),
      arkivuar: Boolean(debt.arkivuar),
      pagesat: Array.isArray(debt.pagesat) ? debt.pagesat : [],
    });

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
                placeholder="p.sh. Bonus Kartela, Borxhi te Arditi"
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
                onChange={setLloji}
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

            {kestePerBlerje ? (
              <Form.Group as={Col} md={6} controlId="debt-nrkesteve">
                <Form.Label>Në sa këste (opsional)</Form.Label>
                <Form.Control
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="120"
                  step="1"
                  placeholder="p.sh. 6"
                  value={debt.nrKesteve}
                  onChange={(e) => setField("nrKesteve", e.target.value)}
                />
                <Ndihme>
                  Për shumën fillestare. Çdo blerje e re me kartelë shtohet si &quot;Shtesë&quot; me numrin e
                  vet të kësteve, dhe faqja mbledh sa ju bie për të paguar çdo muaj. Kësti i parë
                  llogaritet muajin pas blerjes.
                </Ndihme>
              </Form.Group>
            ) : (
              <Form.Group as={Col} md={6} controlId="debt-kestimujor">
                <Form.Label>{kerkese ? "Kthimi mujor (opsional)" : "Kësti mujor (opsional)"}</Form.Label>
                <VleraInput
                  value={debt.kestiMujor}
                  onChange={(vlera) => setField("kestiMujor", vlera)}
                  simboli={simboli}
                  titulliKalkulatorit="Kësti mujor"
                />
                <Ndihme>
                  Shuma që paguhet çdo muaj sipas marrëveshjes. Me të, faqja ju tregon kësti i këtij muaji
                  a është paguar dhe kur mbyllet borxhi.
                </Ndihme>
              </Form.Group>
            )}

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

            <Form.Group as={Col} md={6} controlId="debt-kategoriaid">
              <Form.Label>Kategoria e Parazgjedhur (opsional)</Form.Label>
              <ZgjedhesiKategorive
                id="debt-kategoriaid"
                categories={categories}
                lloji={kerkese ? "hyrje" : "shpenzim"}
                value={debt.kategoriaId}
                onChange={(kategoriaId) => setField("kategoriaId", kategoriaId)}
                placeholder="Pa kategori"
                emptyLabel="Pa kategori"
              />
              <div className="fcp-modal-hint">
                Përdoret vetëm kur zgjidhni ta zbrisni një pagesë edhe nga një llogari e vërtetë.
              </div>
            </Form.Group>

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
