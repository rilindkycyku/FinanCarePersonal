import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { TrendingUp, TrendingDown, ArrowRightLeft, Wand2 } from "lucide-react";
import { useData } from "../Context/DataContext";
import MonedhaTjeter from "./MonedhaTjeter";
import VleraInput from "./VleraInput";
import EtiketaFusha from "./EtiketaFusha";
import ZgjedhesiKategorive from "./ZgjedhesiKategorive";
import Zgjedhesi from "./Zgjedhesi";
import { opsionetLlogarive } from "../lib/opsionet";
import FaturaFusha from "./Faturat/FaturaFusha";
import { makeId, sinkronizoFaturat, STORES } from "../lib/db";
import { currencySymbol, formatMoney, toNumber, todayISO } from "../lib/format";
import { etiketatE, pastroEtiketat, perdorimiEtiketave } from "../lib/etiketat";
import { convertedAmount, currencyFields, dailyLimit, goalProgress } from "../lib/finance";
import { njofto, njoftoListen } from "../lib/njoftimet";
import { mesoRregullen, sugjeroKategorine } from "../lib/rregullat";
import { paralajmerimetPasTransaksionit } from "../lib/paralajmerimet";
import { RITMI_DITOR, RITMI_MUJOR, kategoriTeHapura, kategoriteMujore } from "../lib/kategorite";
import "./ModalForms.css";

const TYPE_BUTTONS = [
  { value: "hyrje", label: "Hyrje", icon: TrendingUp },
  { value: "shpenzim", label: "Shpenzim", icon: TrendingDown },
  { value: "transfer", label: "Transfer", icon: ArrowRightLeft },
];

const blank = (lloji = "shpenzim") => ({
  data: todayISO(),
  lloji,
  vlera: "",
  llogariaId: "",
  llogariaDestinacionId: "",
  kategoriaId: "",
  pershkrimi: "",
  shenim: "",
  qellimiId: "",
  etiketat: [],
  monedhaOrigjinale: "",
  kursi: "",
  // null means "whatever the category says"; "ditor" / "mujor" is this record overriding it.
  ritmi: null,
});

/**
 * Add/edit one transaction. A `transfer` moves money between two of the user's own accounts, so
 * it takes a destination account instead of a category and is deliberately excluded from income
 * and expense totals everywhere (see finance.js).
 *
 * `initial` switches the modal to edit mode; `fikseLloji` locks the type and `qellimiFiksuar` /
 * `destinacioniFillestar` preset the goal and target account (used by the savings-goal
 * contribution flow, which always books a transfer into the goal's account).
 */
function ShtoTransaksionin({
  show,
  onHide,
  initial,
  llojiFillestar = "shpenzim",
  fikseLloji,
  qellimiFiksuar,
  destinacioniFillestar,
}) {
  const { accounts, categories, goals, budgets, transactions, planet, recurring, faturat, save, saveProfile,
    reload, profile, monedha, simboli, njeLlogari, llogariaKryesore } = useData();
  const [tx, setTx] = useState(blank(llojiFillestar));
  // Invoice photos are staged here and only written once the transaction itself is saved, so a
  // cancelled form leaves nothing behind (see sinkronizoFaturat).
  const [faturaLista, setFaturaLista] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setError("");
    setFaturaLista(initial ? faturat.filter((f) => f.transaksioniId === initial.id) : []);
    if (initial) {
      // In single-account mode the pickers are hidden, so an id pointing at an account that no
      // longer exists could never be corrected by hand - it falls back to the main account.
      const exists = (id) => accounts.some((a) => a.id === id);
      const fixed = (id) => (njeLlogari && id && !exists(id) ? llogariaKryesore?.id || "" : id);
      setTx({
        ...blank(initial.lloji),
        ...initial,
        // A record billed in another currency is edited in that currency, not in the stored one.
        vlera: String((initial.monedhaOrigjinale ? initial.vleraOrigjinale : initial.vlera) ?? ""),
        monedhaOrigjinale: initial.monedhaOrigjinale || "",
        kursi: initial.kursi ? String(initial.kursi) : "",
        llogariaId: fixed(initial.llogariaId),
        llogariaDestinacionId: fixed(initial.llogariaDestinacionId || ""),
        kategoriaId: initial.kategoriaId || "",
        qellimiId: initial.qellimiId || "",
        pershkrimi: initial.pershkrimi || "",
        shenim: initial.shenim || "",
        // Cleaned on the way in as well as on the way out, so a record that predates tags (or one
        // restored from a hand-edited backup) opens as untagged instead of breaking the field.
        etiketat: etiketatE(initial),
        ritmi:
          initial.ritmi ||
          // The name this shipped under for one release.
          (typeof initial.jashteLimitit === "boolean"
            ? initial.jashteLimitit
              ? RITMI_MUJOR
              : RITMI_DITOR
            : null),
      });
      return;
    }
    // New transaction: preselect the first usable account (and the goal, when contributing) so
    // the common case is one amount away from being saved.
    const aktive = accounts.filter((a) => !a.arkivuar);
    if (njeLlogari) {
      // One account holds everything, so a contribution to a savings goal stays inside it: the
      // transfer is booked with the same account on both ends and moves no money (finance.js).
      const kryesore = llogariaKryesore?.id || "";
      setTx({
        ...blank(llojiFillestar),
        llogariaId: kryesore,
        llogariaDestinacionId: llojiFillestar === "transfer" ? kryesore : "",
        qellimiId: qellimiFiksuar || "",
      });
      return;
    }
    const destinacioni =
      llojiFillestar === "transfer"
        ? destinacioniFillestar || aktive.find((a) => a.id !== aktive[0]?.id)?.id || ""
        : "";
    setTx({
      ...blank(llojiFillestar),
      // When the destination is fixed (a goal's savings account), the source must not be the same
      // account, or the transfer would be a no-op the form then rejects.
      llogariaId: (destinacioni ? aktive.find((a) => a.id !== destinacioni) : aktive[0])?.id || "",
      llogariaDestinacionId: destinacioni,
      qellimiId: qellimiFiksuar || "",
    });
  }, [show, initial, llojiFillestar, qellimiFiksuar, destinacioniFillestar, accounts, faturat, njeLlogari, llogariaKryesore]);

  const aktive = useMemo(() => accounts.filter((a) => !a.arkivuar), [accounts]);

  // Only for the hint under the field ("there are none for this direction"), so it counts what the
  // picker would actually offer rather than what the store holds.
  const kategoriteERelevante = useMemo(
    () => kategoriTeHapura(categories).filter((c) => c.lloji === tx.lloji),
    [categories, tx.lloji]
  );

  // Completed goals are dropped from the picker, except the one already attached to the
  // transaction being edited - otherwise reopening an old contribution would silently lose its tag.
  const qellimetAktive = useMemo(
    () =>
      goals
        .map((g) => goalProgress(g, transactions))
        .filter((g) => !g.perfunduar || g.id === tx.qellimiId),
    [goals, transactions, tx.qellimiId]
  );

  // Every tag already in use, most used first. There is no store of tags to read: the ones offered
  // under the field are simply the ones other transactions carry (etiketat.js).
  const etiketatEPerdorura = useMemo(() => perdorimiEtiketave(transactions), [transactions]);

  const isTransfer = tx.lloji === "transfer";

  // With a single account there is nowhere to transfer to, so the type is dropped from the toggle
  // (the savings-goal contribution still opens as a transfer, with the type locked).
  const llojet = useMemo(
    () => (njeLlogari ? TYPE_BUTTONS.filter((t) => t.value !== "transfer") : TYPE_BUTTONS),
    [njeLlogari]
  );

  const setField = (name, value) => setTx((prev) => ({ ...prev, [name]: value }));

  const kategoriaRef = useRef(null);

  /**
   * Whether this expense belongs to the month rather than to today.
   *
   * The category is the rule of thumb and the box is the exception, so the record only stores an
   * answer where it *disagrees* with its category - tick it back to what the category says and the
   * override is dropped, which keeps a later change to the category flowing through to it.
   */
  const kategoriaMujore = useMemo(
    () => kategoriteMujore(categories).has(tx.kategoriaId),
    [categories, tx.kategoriaId]
  );
  const mujorTani = tx.ritmi ? tx.ritmi === RITMI_MUJOR : kategoriaMujore;
  const ndryshoRitmin = (mujor) =>
    setField("ritmi", mujor === kategoriaMujore ? null : mujor ? RITMI_MUJOR : RITMI_DITOR);

  /**
   * Enter on the amount walks to the category instead of saving. The amount is where the form
   * opens and the category is the other thing it cannot be saved without, so Enter there was only
   * ever bouncing off the "zgjidh një kategori" error - on a phone the key is right under the
   * keypad that was just used. With nothing chosen yet the picker opens outright; where a category
   * is already in place the field only takes focus, so a second Enter still opens it and the
   * choice is never reopened over the user's head.
   */
  const enterTeKategoria = (e) => {
    if (e.key !== "Enter" || isTransfer) return;
    e.preventDefault();
    if (tx.kategoriaId) kategoriaRef.current?.focus();
    else kategoriaRef.current?.hap();
  };

  /**
   * Typing a description fills the category in from what was picked for that shop last time - but
   * only while the field is still empty, so a suggestion can never overwrite a deliberate choice.
   * `sugjeruar` is what tells the hint below the field to appear, and it goes as soon as the user
   * picks anything themselves.
   */
  const ndryshoPershkrimin = (value) => {
    setTx((prev) => {
      if (prev.kategoriaId && !prev.sugjeruar) return { ...prev, pershkrimi: value };
      const propozimi = sugjeroKategorine(value, profile, categories, prev.lloji);
      return {
        ...prev,
        pershkrimi: value,
        kategoriaId: propozimi || (prev.sugjeruar ? "" : prev.kategoriaId),
        sugjeruar: Boolean(propozimi),
      };
    });
  };

  const changeType = (lloji) => {
    setTx((prev) => {
      // Categories belong to exactly one direction, so a category picked for the previous type
      // would be invalid - clear it unless it happens to fit the new one.
      const keepCategory = categories.find((c) => c.id === prev.kategoriaId)?.lloji === lloji;
      return {
        ...prev,
        lloji,
        kategoriaId: keepCategory ? prev.kategoriaId : "",
        llogariaDestinacionId:
          lloji === "transfer"
            ? prev.llogariaDestinacionId || aktive.find((a) => a.id !== prev.llogariaId)?.id || ""
            : "",
        qellimiId: lloji === "hyrje" ? "" : prev.qellimiId,
      };
    });
    setError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    // The form's `vlera` field holds the amount as billed, which is what gets kept as the original.
    const monedhat = currencyFields({ ...tx, vleraOrigjinale: tx.vlera }, monedha);
    // What the user typed is in the billing currency; what gets stored is the converted amount.
    const vlera = monedhat.monedhaOrigjinale ? convertedAmount(tx.vlera, tx.kursi) : toNumber(tx.vlera);

    if (!tx.data) return setError("Data është e detyrueshme.");
    if (monedhat.monedhaOrigjinale && !(toNumber(tx.kursi) > 0)) {
      return setError("Shkruani kursin e këmbimit për monedhën e zgjedhur.");
    }
    if (!(vlera > 0)) return setError("Vlera duhet të jetë një numër më i madh se zero.");
    if (!tx.llogariaId) return setError(isTransfer ? "Zgjidhni llogarinë burim." : "Zgjidhni llogarinë.");
    if (isTransfer && !tx.llogariaDestinacionId) return setError("Zgjidhni llogarinë e destinacionit.");
    // Same account on both ends is a no-op transfer - rejected, except in single-account mode where
    // it is exactly how a goal contribution is earmarked without the money leaving the account.
    if (isTransfer && !njeLlogari && tx.llogariaDestinacionId === tx.llogariaId) {
      return setError("Llogaria e destinacionit duhet të jetë e ndryshme nga burimi.");
    }
    if (!isTransfer && !tx.kategoriaId) return setError("Zgjidhni kategorinë.");

    setError("");

    const rekordi = {
      // Fixed before the write so the pictures can be attached to it right after.
      id: tx.id || makeId("tx"),
      data: tx.data,
      lloji: tx.lloji,
      vlera,
      llogariaId: tx.llogariaId,
      llogariaDestinacionId: isTransfer ? tx.llogariaDestinacionId : null,
      kategoriaId: isTransfer ? null : tx.kategoriaId,
      pershkrimi: tx.pershkrimi.trim(),
      shenim: tx.shenim.trim(),
      qellimiId: tx.qellimiId || null,
      // Cleaned rather than trusted: the field commits whatever was still half-typed when the form
      // was submitted, and that is exactly where a duplicate or an empty tag would come from.
      etiketat: pastroEtiketat(tx.etiketat),
      perseritjaId: tx.perseritjaId || null,
      // Carried through explicitly: without it, editing a payment booked against a debt note from
      // the Transaksionet page silently unlinked the two and the note stopped counting it paid.
      borxhiId: tx.borxhiId || null,
      // Same for a planned purchase, which additionally reads its real price back off this record.
      planiId: tx.planiId || null,
      // Only ever set once: two transactions on the same date are ordered by when they were
      // entered (finance.js), so re-stamping this on an edit would move an old row to the top.
      krijuar: tx.krijuar || new Date().toISOString(),
      // Null unless this record disagrees with its category, so marking "Karburant" as monthly
      // later still reaches the fuel already recorded.
      ritmi: tx.ritmi || null,
      ...monedhat,
    };

    await save(STORES.transactions, rekordi);

    // Only when *this* entry is what crossed the line: comparing the day before and after it keeps
    // the app from notifying again on every expense that follows an already-blown limit.
    if (profile.njoftimeLimiti) {
      const sot = todayISO();
      const tjeret = transactions.filter((t) => t.id !== rekordi.id);
      const bazat = {
        accounts, plans: planet, recurring, categories, today: sot, limitiManual: profile.limitiDitor,
      };
      const para = dailyLimit({ ...bazat, transactions: tjeret });
      const pas = dailyLimit({ ...bazat, transactions: [...tjeret, rekordi] });
      if (!para.tejkaluar && pas.tejkaluar) {
        njofto(
          "Limiti ditor u tejkalua",
          `Sot keni shpenzuar ${formatMoney(pas.shpenzuarSot, monedha)} nga ${formatMoney(pas.limiti, monedha)}.`
        );
      }
    }

    // The rest of the crossings this record may have caused - a budget three quarters gone, a
    // savings goal reached. Same rule as the limit above: the ledger before and after are compared,
    // so nothing announces a state that was already true.
    njoftoListen(
      paralajmerimetPasTransaksionit({
        profile, categories, budgets, goals, transactions, rekordi, monedha,
      })
    );

    // Two things the profile remembers from a saved transaction: the exchange rate, so the next
    // $ subscription starts from the one used last time, and the description → category pairing,
    // so the next "Spar" fills itself in (and so does a whole imported statement). Both in one
    // write, because two `saveProfile` calls would each reload the database.
    const rregullaTeReja = mesoRregullen(profile, rekordi);
    const kursetENdryshuara = monedhat.monedhaOrigjinale
      ? { ...(profile.kurset || {}), [monedhat.monedhaOrigjinale]: monedhat.kursi }
      : profile.kurset;

    if (rregullaTeReja !== profile.rregullatKategorive || kursetENdryshuara !== profile.kurset) {
      await saveProfile({ ...profile, kurset: kursetENdryshuara, rregullatKategorive: rregullaTeReja });
    }

    // The transaction is already safe at this point, so a failure here (a full storage quota, in
    // practice) costs the photos and says so, rather than the record the user came to write.
    const kaFatura = faturaLista.length > 0 || faturat.some((f) => f.transaksioniId === rekordi.id);
    if (kaFatura) {
      try {
        await sinkronizoFaturat(rekordi.id, faturaLista);
      } catch (err) {
        return setError(
          `Transaksioni u ruajt, por fotot e faturës jo: ${err?.message || "hapësira e shfletuesit mund të jetë plot"}.`
        );
      } finally {
        await reload();
      }
    }

    onHide();
  };

  if (aktive.length === 0) {
    return (
      <Modal show={show} onHide={onHide} centered className="sp-modal">
        <Modal.Header closeButton>
          <Modal.Title>Nuk ka llogari</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0 text-muted">
            Për të regjistruar një transaksion duhet të kemi së paku një llogari aktive. Shtoni një llogari te
            faqja <strong>Llogaritë</strong>.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Mbyll
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  return (
    <Modal show={show} onHide={onHide} centered size="lg" className="sp-modal">
      <Modal.Header closeButton>
        {/* Keyed on the id rather than on `initial`: repeating a transaction opens the form
            pre-filled from an old one but saves a new record, so it is not an edit. */}
        <Modal.Title>{initial?.id ? "Ndrysho Transaksionin" : "Transaksion i Ri"}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          {!fikseLloji && (
            <div
              className="fcp-type-toggle"
              style={llojet.length < TYPE_BUTTONS.length ? { gridTemplateColumns: `repeat(${llojet.length}, 1fr)` } : undefined}
            >
              {llojet.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    className={`fcp-type-btn ${t.value}${tx.lloji === t.value ? " active" : ""}`}
                    onClick={() => changeType(t.value)}
                  >
                    <Icon size={15} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}

          <Row className="g-3">
            <Form.Group as={Col} md={6} controlId="tx-vlera">
              <Form.Label>
                Vlera <span className="text-danger">*</span>
              </Form.Label>
              <VleraInput
                value={tx.vlera}
                onChange={(vlera) => setField("vlera", vlera)}
                simboli={tx.monedhaOrigjinale ? currencySymbol(tx.monedhaOrigjinale) : simboli}
                titulliKalkulatorit="Vlera e transaksionit"
                onKeyDown={enterTeKategoria}
                autoFocus
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="tx-data">
              <Form.Label>
                Data <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control type="date" value={tx.data} onChange={(e) => setField("data", e.target.value)} required />
            </Form.Group>

            <MonedhaTjeter
              monedhaOrigjinale={tx.monedhaOrigjinale}
              kursi={tx.kursi}
              vlera={tx.vlera}
              onChange={(fusha) => setTx((prev) => ({ ...prev, ...fusha }))}
            />

            {/* Single-account mode books everything into the main account, so the pickers are
                replaced by a plain line telling the user where the money is going. */}
            {njeLlogari ? (
              <Col md={12}>
                <div className="fcp-modal-hint">
                  Llogaria: <strong>{llogariaKryesore?.emri || "Llogaria kryesore"}</strong>
                  {isTransfer && " - kontributi mbetet brenda saj, bilanci nuk ndryshon."}
                </div>
              </Col>
            ) : (
              <Form.Group as={Col} md={6} controlId="tx-llogariaid">
                <Form.Label>
                  {isTransfer ? "Nga llogaria" : "Llogaria"} <span className="text-danger">*</span>
                </Form.Label>
                <Zgjedhesi
                  id="tx-llogariaid"
                  value={tx.llogariaId}
                  onChange={(v) => setField("llogariaId", v)}
                  opsionet={opsionetLlogarive(aktive)}
                  placeholder="Zgjidh llogarinë..."
                  titulli={isTransfer ? "Nga llogaria" : "Zgjidh llogarinë"}
                  required
                />
              </Form.Group>
            )}

            {isTransfer ? (
              !njeLlogari && (
                <Form.Group as={Col} md={6} controlId="tx-llogariadestinacionid">
                  <Form.Label>
                    Në llogarinë <span className="text-danger">*</span>
                  </Form.Label>
                  <Zgjedhesi
                    id="tx-llogariadestinacionid"
                    value={tx.llogariaDestinacionId}
                    onChange={(v) => setField("llogariaDestinacionId", v)}
                    opsionet={opsionetLlogarive(aktive.filter((a) => a.id !== tx.llogariaId))}
                    placeholder="Zgjidh llogarinë..."
                    titulli="Në llogarinë"
                    required
                  />
                </Form.Group>
              )
            ) : (
              <Form.Group as={Col} md={njeLlogari ? 12 : 6} controlId="tx-kategoriaid">
                <Form.Label>
                  Kategoria <span className="text-danger">*</span>
                </Form.Label>
                <ZgjedhesiKategorive
                  ref={kategoriaRef}
                  id="tx-kategoriaid"
                  categories={categories}
                  lloji={tx.lloji}
                  value={tx.kategoriaId}
                  onChange={(kategoriaId) => setTx((prev) => ({ ...prev, kategoriaId, sugjeruar: false }))}
                  required
                />
                {tx.sugjeruar && tx.kategoriaId && (
                  <div className="fcp-modal-hint">
                    <Wand2 size={12} className="me-1" />
                    Sugjeruar nga përshkrimi, sipas zgjedhjeve tuaja të mëparshme - ndryshojeni lirisht.
                  </div>
                )}
                {kategoriteERelevante.length === 0 && (
                  <div className="fcp-modal-hint">
                    Nuk ka kategori për këtë lloj - shtoni një te faqja Kategoritë.
                  </div>
                )}
                {tx.lloji === "shpenzim" && (
                  <>
                    <Form.Check
                      type="checkbox"
                      id="tx-ritmi"
                      className="mt-2"
                      label="Shpenzim mujor - ndahet mbi muajin, jo mbi ditën e sotme"
                      checked={mujorTani}
                      onChange={(e) => ndryshoRitmin(e.target.checked)}
                    />
                    <div className="fcp-modal-hint">
                      {kategoriaMujore && mujorTani
                        ? "Vjen nga kategoria, e cila është mujore. Hiqeni shenjën po ta doni këtë shpenzim të numëruar te dita e sotme."
                        : "Lëreni bosh për shpenzimet e zakonshme të ditës. Shënojeni për blerjet që mbajnë gjatë - një depo karburant, një sigurim, një palë këpucë."}
                    </div>
                  </>
                )}
              </Form.Group>
            )}

            <Form.Group as={Col} md={12} controlId="tx-pershkrimi">
              <Form.Label>Përshkrimi</Form.Label>
              <Form.Control
                placeholder={isTransfer ? "p.sh. Kursim mujor" : "p.sh. Blerje në supermarket"}
                value={tx.pershkrimi}
                onChange={(e) => ndryshoPershkrimin(e.target.value)}
              />
            </Form.Group>

            <Col md={12}>
              <Form.Label>Etiketat</Form.Label>
              <EtiketaFusha
                etiketat={tx.etiketat}
                sugjerime={etiketatEPerdorura}
                onChange={(etiketat) => setField("etiketat", etiketat)}
              />
            </Col>

            {tx.lloji !== "hyrje" && qellimetAktive.length > 0 && (
              <Form.Group as={Col} md={12} controlId="tx-qellimiid">
                <Form.Label>Qëllimi i Kursimit (opsional)</Form.Label>
                <Zgjedhesi
                  id="tx-qellimiid"
                  value={tx.qellimiId}
                  onChange={(v) => setField("qellimiId", v)}
                  opsionet={qellimetAktive.map((g) => ({ value: g.id, label: g.emri }))}
                  emptyLabel="Pa qëllim"
                  placeholder="Pa qëllim"
                  titulli="Qëllimi i kursimit"
                  disabled={Boolean(qellimiFiksuar)}
                />
                <div className="fcp-modal-hint">
                  Kur zgjidhet, vlera e këtij transaksioni llogaritet si kontribut në ecurinë e qëllimit.
                </div>
              </Form.Group>
            )}

            <Form.Group as={Col} md={12} controlId="tx-shenim">
              <Form.Label>Shënim</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={tx.shenim}
                onChange={(e) => setField("shenim", e.target.value)}
              />
            </Form.Group>

            <Col md={12}>
              <Form.Label>Faturat (foto)</Form.Label>
              <FaturaFusha faturat={faturaLista} onChange={setFaturaLista} />
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Anulo
          </Button>
          <Button type="submit" className="btn-primary">
            {initial?.id ? "Ruaj Ndryshimet" : "Ruaj Transaksionin"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoTransaksionin;
