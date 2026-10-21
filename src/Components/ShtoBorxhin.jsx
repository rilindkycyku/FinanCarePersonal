import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import { toNumber, todayISO } from "../lib/format";
import { DEBT_TYPES, KATEGORIA_SIPAS_LLOJIT_TE_BORXHIT, LLOJET_E_BASHKUARA, debtTypeMeta } from "../lib/options";
import { LLOJET_ME_KESTE_PER_BLERJE, transaksioniIHuas } from "../lib/finance";
import VleraInput from "./VleraInput";
import Ndihme from "./Ndihme";
import ZgjedhesiKategorive from "./ZgjedhesiKategorive";
import { ColorPicker } from "./Pickers";
import "./ModalForms.css";
import Zgjedhesi from "./Zgjedhesi";
import { opsionetEThjeshta, opsionetLlogarive } from "../lib/opsionet";

const BLANK = {
  emri: "",
  lloji: "karte",
  vleraTotale: "",
  limiti: "",
  kreditori: "",
  dataFillimit: todayISO(),
  dataMbarimit: "",
  normaVjetore: "",
  nrKesteve: "",
  kestiMujor: "",
  ditaPageses: "",
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
 *
 * The one exception to "only a note" is money lent out. Handing someone 200 € empties the wallet
 * whether or not a note says so, and a note that left the balance alone kept the daily allowance
 * 200 € too generous - the only way round it was a separate expense typed by hand, which nobody
 * guessed. So a "hua e dhënë" can also book its amount against a real account
 * (`transaksioniIHuas`: a monthly expense, so it shrinks the remaining days rather than blowing
 * today). The note keeps that transaction's id in `transaksioniId`, and editing the note keeps the
 * two in step. A note saved before this, or with the box unticked, stays a plain note: it opens
 * unticked, so editing it can never book a loan someone already recorded by hand.
 */
function ShtoBorxhin({ show, onHide, initial, llojiFillestar }) {
  const { accounts, categories, transactions, save, saveMany, destroyMany, simboli, njeLlogari, llogariaKryesore } =
    useData();
  const [debt, setDebt] = useState(BLANK);
  const [error, setError] = useState("");
  // Booking the loan against an account - see the note above. Kept apart from `debt` because none
  // of it is stored on the note except the resulting transaction's id.
  const [lidh, setLidh] = useState(false);
  const [llogariaId, setLlogariaId] = useState("");
  const [kategoriaHuas, setKategoriaHuas] = useState("");

  const aktive = useMemo(() => accounts.filter((a) => !a.arkivuar), [accounts]);

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
    const lidhur = initial?.transaksioniId ? transactions.find((tx) => tx.id === initial.transaksioniId) : null;
    setLidh(Boolean(lidhur) || (!initial && aktive.length > 0));
    setLlogariaId(
      lidhur?.llogariaId || (njeLlogari ? llogariaKryesore?.id : aktive.length === 1 ? aktive[0].id : "") || ""
    );
    setKategoriaHuas(
      lidhur?.kategoriaId ||
        (categories.some((c) => c.id === "cat_default_hua_dhene" && !c.arkivuar) ? "cat_default_hua_dhene" : "")
    );
    setDebt(
      initial
        ? {
            ...BLANK,
            ...initial,
            // A merged type opens as the one it became, so the picker shows a real row.
            lloji: LLOJET_E_BASHKUARA[initial.lloji] || initial.lloji,
            vleraTotale: String(initial.vleraTotale ?? ""),
            limiti: initial.limiti ? String(initial.limiti) : "",
            dataMbarimit: initial.dataMbarimit || "",
            normaVjetore: initial.normaVjetore ? String(initial.normaVjetore) : "",
            nrKesteve: initial.nrKesteve ? String(initial.nrKesteve) : "",
            kestiMujor: initial.kestiMujor ? String(initial.kestiMujor) : "",
            ditaPageses: initial.ditaPageses ? String(initial.ditaPageses) : "",
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
    // `categories`, `transactions` and the accounts are left out on purpose: a reload while the form
    // is open must not reset what the user has typed. They are only read as they were when it opened.
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
  // With a limit, a card can start at nothing owed - a new card, or one just paid off - because
  // the limit is what the note is about. Without one, an empty card would be a note about nothing.
  const meLimit = kestePerBlerje && toNumber(debt.limiti) > 0;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!debt.emri.trim()) return setError("Emri i borxhit është i detyrueshëm.");
    if (kestePerBlerje && debt.limiti !== "" && !(toNumber(debt.limiti) > 0)) {
      return setError("Limiti i kartelës duhet të jetë më i madh se zero.");
    }
    if (meLimit ? toNumber(debt.vleraTotale) < 0 : !(toNumber(debt.vleraTotale) > 0)) {
      return setError(
        kestePerBlerje
          ? "Shkruani borxhin aktual në kartelë, ose limitin e saj për një kartelë pa borxh."
          : "Vlera duhet të jetë më e madhe se zero."
      );
    }
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
    if (debt.ditaPageses !== "" && !(Number.isInteger(Number(debt.ditaPageses)) && Number(debt.ditaPageses) >= 1 && Number(debt.ditaPageses) <= 31)) {
      return setError("Dita e pagesës duhet të jetë një ditë e muajit, nga 1 deri në 31.");
    }
    const lidhet = kerkese && lidh && aktive.length > 0;
    if (lidhet && !llogariaId) return setError("Zgjidhni llogarinë nga e cila dolën paratë.");
    if (lidhet && !kategoriaHuas) return setError("Zgjidhni kategorinë e shpenzimit.");
    setError("");

    const ekzistues = debt.transaksioniId ? transactions.find((tx) => tx.id === debt.transaksioniId) : null;
    // Unticking the box (or turning the note into another type) takes the transaction it had
    // booked with it - otherwise the account would keep a loan the user just detached from it.
    if (ekzistues && !lidhet) {
      await destroyMany([[STORES.transactions, ekzistues.id]]);
    }
    const transaksioniId = lidhet ? ekzistues?.id || makeId("tx") : null;

    const shenimi = {
      id: debt.id || makeId("debt"),
      emri: debt.emri.trim(),
      lloji: debt.lloji,
      vleraTotale: toNumber(debt.vleraTotale),
      // Same rule as the instalment fields below: a limit only means something on a card.
      limiti: meLimit ? toNumber(debt.limiti) : null,
      kreditori: debt.kreditori.trim(),
      dataFillimit: debt.dataFillimit || todayISO(),
      dataMbarimit: debt.dataMbarimit || null,
      normaVjetore: debt.normaVjetore === "" ? null : toNumber(debt.normaVjetore),
      // Only the field that fits the type is kept: a fixed instalment left behind on a note changed
      // to a card would quietly override its per-purchase schedule.
      nrKesteve: kestePerBlerje && debt.nrKesteve !== "" ? Number(debt.nrKesteve) : null,
      kestiMujor: !kestePerBlerje && debt.kestiMujor !== "" ? toNumber(debt.kestiMujor) : null,
      // A day of the month, not a date: the bill falls due on it every month (finance.js debtDueDate).
      ditaPageses: debt.ditaPageses !== "" ? Number(debt.ditaPageses) : null,
      kategoriaId: debt.kategoriaId || null,
      ngjyra: debt.ngjyra,
      shenim: debt.shenim.trim(),
      arkivuar: Boolean(debt.arkivuar),
      pagesat: Array.isArray(debt.pagesat) ? debt.pagesat : [],
      transaksioniId,
    };

    if (lidhet) {
      // Spread over the old record so what was added to it on the Transaksionet page (tags, a
      // location, a note) survives an edit of the loan.
      const tx = {
        ...ekzistues,
        ...transaksioniIHuas({
          id: transaksioniId,
          borxhi: shenimi,
          vlera: shenimi.vleraTotale,
          data: shenimi.dataFillimit,
          llogariaId: njeLlogari ? llogariaKryesore?.id || llogariaId : llogariaId,
          kategoriaId: kategoriaHuas,
          shenim: ekzistues?.shenim || "",
          krijuar: ekzistues?.krijuar || new Date().toISOString(),
        }),
      };
      await saveMany([
        [STORES.borxhet, shenimi],
        [STORES.transactions, tx],
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
            {kerkese
              ? "Shënimi mban llogari kush ju ka borxh dhe sa ju ka kthyer. Më poshtë mund ta zbritni shumën edhe nga llogaria prej së cilës dolën paratë."
              : "Borxhet mbahen vetëm si shënim - nuk hyjnë në bilancin e llogarive dhe as në hyrjet apo shpenzimet e muajit. Pagesat i zbritni më pas nga vetë borxhi."}
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

            {kestePerBlerje && (
              <Form.Group as={Col} md={6} controlId="debt-limiti">
                <Form.Label>Limiti i kartelës (opsional)</Form.Label>
                <VleraInput
                  value={debt.limiti}
                  onChange={(vlera) => setField("limiti", vlera)}
                  simboli={simboli}
                  titulliKalkulatorit="Limiti i kartelës"
                />
                <Ndihme>
                  Sa ju lejon banka të shpenzoni me kartelë, p.sh. 1000. Me të, faqja tregon sa keni ende në
                  dispozicion për të shpenzuar dhe sa keni për të paguar - dhe kartela mund të nisë pa asnjë
                  borxh.
                </Ndihme>
              </Form.Group>
            )}

            <Form.Group as={Col} md={6} controlId="debt-vleratotale">
              <Form.Label>
                {kestePerBlerje ? "Borxhi aktual në kartelë" : kerkese ? "Shuma e dhënë" : "Shuma e plotë"}{" "}
                {!meLimit && <span className="text-danger">*</span>}
              </Form.Label>
              <VleraInput
                value={debt.vleraTotale}
                onChange={(vlera) => setField("vleraTotale", vlera)}
                simboli={simboli}
                titulliKalkulatorit={kestePerBlerje ? "Borxhi aktual" : kerkese ? "Shuma e dhënë" : "Shuma e plotë"}
                required={!meLimit}
              />
              <div className="fcp-modal-hint">
                {meLimit
                  ? "Sa keni për të paguar sot në kartelë - 0 për një kartelë të re ose të shlyer. Blerjet e reja shtohen më vonë si «Shtesë»."
                  : "Sa ishte borxhi në fillim. Blerjet e reja ose kamatat shtohen më vonë si «Shtesë»."}
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

            {kerkese && aktive.length > 0 && (
              <Col md={12}>
                <Form.Check
                  type="checkbox"
                  id="debt-lidh"
                  checked={lidh}
                  onChange={(e) => setLidh(e.target.checked)}
                  label="Zbrite edhe nga llogaria"
                />
                <Ndihme>
                  {lidh
                    ? "Paratë dalin nga llogaria si shpenzim mujor: nuk hyjnë te «Shpenzuar sot», por limiti ditor zvogëlohet pak për çdo ditë që ka mbetur në muaj. Kur t'ju kthehen, shtoni një «Kthim» dhe ato hyjnë sërish në llogari."
                    : "E lënë e pashënjuar, hua-ja mbetet vetëm shënim - asnjë llogari nuk preket. Shënjojeni nëse paratë i keni dhënë nga një llogari që e ndiqni këtu dhe nuk i keni regjistruar ende si shpenzim."}
                </Ndihme>
              </Col>
            )}

            {kerkese && lidh && aktive.length > 0 && (
              <>
                {!njeLlogari && (
                  <Form.Group as={Col} md={6} controlId="debt-llogariaid">
                    <Form.Label>
                      Nga llogaria <span className="text-danger">*</span>
                    </Form.Label>
                    <Zgjedhesi
                      id="debt-llogariaid"
                      value={llogariaId}
                      onChange={setLlogariaId}
                      opsionet={opsionetLlogarive(aktive)}
                      placeholder="Zgjidh llogarinë..."
                      titulli="Nga llogaria"
                    />
                  </Form.Group>
                )}
                <Form.Group as={Col} md={njeLlogari ? 12 : 6} controlId="debt-kategoriahuas">
                  <Form.Label>
                    Kategoria e shpenzimit <span className="text-danger">*</span>
                  </Form.Label>
                  <ZgjedhesiKategorive
                    id="debt-kategoriahuas"
                    categories={categories}
                    lloji="shpenzim"
                    value={kategoriaHuas}
                    onChange={setKategoriaHuas}
                    required
                  />
                </Form.Group>
              </>
            )}

            <Form.Group as={Col} md={6} controlId="debt-datafillimit">
              <Form.Label>Data e Fillimit</Form.Label>
              <Form.Control
                type="date"
                value={debt.dataFillimit || ""}
                onChange={(e) => setField("dataFillimit", e.target.value)}
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="debt-datambarimit">
              {/* Not the statement's "afati i fundit i pagesës" - that one comes back every month and
                  is the due day further down. On a card this is when the whole of it has to be gone. */}
              <Form.Label>{kestePerBlerje ? "Shlyerja e plotë deri më (opsional)" : "Afati i Fundit (opsional)"}</Form.Label>
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

            <Form.Group as={Col} md={6} controlId="debt-ditapageses">
              <Form.Label>
                {kestePerBlerje
                  ? "Afati i pagesës çdo muaj (opsional)"
                  : kerkese
                    ? "Dita e kthimit çdo muaj (opsional)"
                    : "Dita e pagesës çdo muaj (opsional)"}
              </Form.Label>
              <Form.Control
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                step="1"
                placeholder="p.sh. 15"
                value={debt.ditaPageses}
                onChange={(e) => setField("ditaPageses", e.target.value)}
              />
              <Ndihme>
                {kestePerBlerje
                  ? "Dita e muajit deri kur banka e pret pagesën - te pasqyra e kartelës është «Afati i fundit i pagesës» (p.sh. 15 për 15.10). Faqja ju tregon sa keni për të paguar deri atëherë dhe sa ditë kanë mbetur."
                  : "Dita e muajit kur bie kësti. Faqja ju tregon sa keni për të paguar deri atëherë dhe sa ditë kanë mbetur."}
              </Ndihme>
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
