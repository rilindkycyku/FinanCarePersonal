import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useData } from "../Context/DataContext";
import MonedhaTjeter from "./MonedhaTjeter";
import VleraInput from "./VleraInput";
import ZgjedhesiKategorive from "./ZgjedhesiKategorive";
import { makeId, STORES } from "../lib/db";
import { currencySymbol, formatMoney, toNumber, todayISO } from "../lib/format";
import {
  ZHVENDOSJET_E_PERIUDHES, convertedAmount, currencyFields, debtProgress, lastInstallmentDate,
  periudhaEMbuluar,
} from "../lib/finance";
import { FREQUENCIES } from "../lib/options";
import { formatDate } from "../lib/format";
import "./ModalForms.css";
import Zgjedhesi from "./Zgjedhesi";
import { opsionetEThjeshta, opsionetLlogarive } from "../lib/opsionet";

const BLANK = {
  emri: "",
  lloji: "shpenzim",
  vlera: "",
  kategoriaId: "",
  llogariaId: "",
  frekuenca: "mujore",
  periudhaZhvendosje: "",
  dataETjetres: todayISO(),
  dataFundit: "",
  nrKesteve: "",
  automatike: false,
  monedhaOrigjinale: "",
  kursi: "",
  borxhiId: "",
  aktiv: true,
};

/**
 * Add/edit a recurring payment or income (rent, subscriptions, salary…). The schedule itself never
 * changes a balance - `dataETjetres` is the next date it comes due, and the user turns each due
 * occurrence into a real transaction from the "Pagesat e Përsëritura" page (or the dashboard),
 * which is what advances the date.
 */
function ShtoTePerseritur({ show, onHide, initial }) {
  const { accounts, categories, borxhet, save, saveProfile, profile, monedha, simboli, njeLlogari, llogariaKryesore } =
    useData();
  const [rec, setRec] = useState(BLANK);
  const [error, setError] = useState("");

  // What the next occurrence's description will actually say - see the hint under the picker.
  const periudhaEPare = periudhaEMbuluar(rec.dataETjetres, rec.periudhaZhvendosje);

  useEffect(() => {
    if (!show) return;
    setError("");
    if (initial) {
      // The picker is hidden in single-account mode, so a schedule pointing at a deleted account
      // is repaired here rather than failing validation on a field the user cannot see.
      const gjendet = accounts.some((a) => a.id === initial.llogariaId);
      setRec({
        ...BLANK,
        ...initial,
        llogariaId: njeLlogari && !gjendet ? llogariaKryesore?.id || "" : initial.llogariaId,
        vlera: String((initial.monedhaOrigjinale ? initial.vleraOrigjinale : initial.vlera) ?? ""),
        monedhaOrigjinale: initial.monedhaOrigjinale || "",
        kursi: initial.kursi ? String(initial.kursi) : "",
        dataFundit: initial.dataFundit || "",
        nrKesteve: initial.nrKesteve ? String(initial.nrKesteve) : "",
        borxhiId: initial.borxhiId || "",
      });
      return;
    }
    const aktive = accounts.filter((a) => !a.arkivuar);
    // A single active account is not a choice, so it is still filled in; with more than one the field is left empty and asked for, the same way the transaction form does.
    setRec({
      ...BLANK,
      llogariaId: (njeLlogari ? llogariaKryesore?.id : aktive.length === 1 ? aktive[0].id : "") || "",
    });
  }, [show, initial, accounts, njeLlogari, llogariaKryesore]);

  const kesteFundi = lastInstallmentDate(rec.dataETjetres, rec.frekuenca, rec.nrKesteve);

  /**
   * Notes this schedule could pay down, matched to its direction: an expense settles something you
   * owe, an income is someone repaying you. A note already paid off stays out of the list unless
   * this schedule is the one attached to it, so reopening an old schedule cannot silently lose the
   * link.
   */
  const borxhetERelevante = useMemo(
    () =>
      borxhet
        .map((d) => debtProgress(d))
        .filter((d) => (rec.lloji === "hyrje" ? d.drejtimi === "kerkese" : d.drejtimi === "detyrim"))
        .filter((d) => (!d.arkivuar && !d.perfunduar) || d.id === rec.borxhiId)
        .sort((a, b) => a.emri.localeCompare(b.emri)),
    [borxhet, rec.lloji, rec.borxhiId]
  );

  /** With an instalment count the end date is derived, so a card purchase split over N months
   * stops on its own - the user never has to remember to switch it off. */
  const setField = (name, value) =>
    setRec((prev) => {
      const next = { ...prev, [name]: value };
      if (["nrKesteve", "frekuenca", "dataETjetres"].includes(name)) {
        const fundi = lastInstallmentDate(next.dataETjetres, next.frekuenca, next.nrKesteve);
        next.dataFundit = fundi || (name === "nrKesteve" ? "" : next.dataFundit);
      }
      return next;
    });

  const changeType = (lloji) =>
    setRec((prev) => {
      const keepCategory = categories.find((c) => c.id === prev.kategoriaId)?.lloji === lloji;
      // A debt points one way only, so a link made while this was an expense is meaningless once
      // it becomes an income (and the other way round) - dropped rather than left dangling.
      const borxhi = borxhet.find((d) => d.id === prev.borxhiId);
      const keepDebt =
        borxhi && debtProgress(borxhi).drejtimi === (lloji === "hyrje" ? "kerkese" : "detyrim");
      return {
        ...prev,
        lloji,
        kategoriaId: keepCategory ? prev.kategoriaId : "",
        borxhiId: keepDebt ? prev.borxhiId : "",
      };
    });

  const handleSave = async (e) => {
    e.preventDefault();
    // The form's `vlera` field holds the amount as billed, which is what gets kept as the original.
    const monedhat = currencyFields({ ...rec, vleraOrigjinale: rec.vlera }, monedha);
    const vlera = monedhat.monedhaOrigjinale ? convertedAmount(rec.vlera, rec.kursi) : toNumber(rec.vlera);

    if (!rec.emri.trim()) return setError("Emri është i detyrueshëm.");
    if (monedhat.monedhaOrigjinale && !(toNumber(rec.kursi) > 0)) {
      return setError("Shkruani kursin e këmbimit për monedhën e zgjedhur.");
    }
    if (!(vlera > 0)) return setError("Vlera duhet të jetë një numër më i madh se zero.");
    if (!rec.llogariaId) return setError("Zgjidhni llogarinë.");
    if (!rec.kategoriaId) return setError("Zgjidhni kategorinë.");
    if (!rec.dataETjetres) return setError("Data e radhës është e detyrueshme.");
    if (rec.dataFundit && rec.dataFundit < rec.dataETjetres) {
      return setError("Data e përfundimit nuk mund të jetë para datës së radhës.");
    }
    setError("");

    await save(STORES.recurring, {
      id: rec.id || makeId("rec"),
      emri: rec.emri.trim(),
      lloji: rec.lloji,
      vlera,
      ...monedhat,
      kategoriaId: rec.kategoriaId,
      llogariaId: rec.llogariaId,
      frekuenca: rec.frekuenca,
      // Kept as a string in the form and stored as a number, or null when the schedule is not
      // labelled at all - see `periudhaEMbuluar` in finance.js.
      periudhaZhvendosje: rec.periudhaZhvendosje === "" ? null : Number(rec.periudhaZhvendosje),
      dataETjetres: rec.dataETjetres,
      dataFundit: rec.dataFundit || null,
      nrKesteve: Math.floor(toNumber(rec.nrKesteve)) || null,
      dataEFundit: rec.dataEFundit || null,
      borxhiId: rec.borxhiId || null,
      aktiv: Boolean(rec.aktiv),
      automatike: Boolean(rec.automatike),
    });

    if (monedhat.monedhaOrigjinale) {
      await saveProfile({
        ...profile,
        kurset: { ...(profile.kurset || {}), [monedhat.monedhaOrigjinale]: monedhat.kursi },
      });
    }

    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg" className="sp-modal">
      <Modal.Header closeButton>
        {/* `initial` without an id is a prefilled *new* schedule - what the detected-subscription
            card hands over - so the title follows the id rather than the presence of values. */}
        <Modal.Title>{initial?.id ? "Ndrysho Pagesën e Përsëritur" : "Shto Pagesë të Përsëritur"}</Modal.Title>
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
              className={`fcp-type-btn shpenzim${rec.lloji === "shpenzim" ? " active" : ""}`}
              onClick={() => changeType("shpenzim")}
            >
              <TrendingDown size={15} /> Shpenzim
            </button>
            <button
              type="button"
              className={`fcp-type-btn hyrje${rec.lloji === "hyrje" ? " active" : ""}`}
              onClick={() => changeType("hyrje")}
            >
              <TrendingUp size={15} /> Hyrje
            </button>
          </div>

          <Row className="g-3">
            <Form.Group as={Col} md={12} controlId="rec-emri">
              <Form.Label>
                Emri <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                placeholder="p.sh. Qira, Netflix, Rroga"
                value={rec.emri}
                onChange={(e) => setField("emri", e.target.value)}
                autoFocus
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="rec-vlera">
              <Form.Label>
                Vlera <span className="text-danger">*</span>
              </Form.Label>
              <VleraInput
                value={rec.vlera}
                onChange={(vlera) => setField("vlera", vlera)}
                simboli={rec.monedhaOrigjinale ? currencySymbol(rec.monedhaOrigjinale) : simboli}
                titulliKalkulatorit="Vlera e pagesës"
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="rec-frekuenca">
              <Form.Label>Frekuenca</Form.Label>
              <Zgjedhesi
                id="rec-frekuenca"
                value={rec.frekuenca}
                onChange={(v) => setField("frekuenca", v)}
                opsionet={opsionetEThjeshta(FREQUENCIES)}
                titulli="Sa shpesh"
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="rec-periudha">
              <Form.Label>Për cilin muaj është</Form.Label>
              <Zgjedhesi
                id="rec-periudha"
                value={rec.periudhaZhvendosje ?? ""}
                onChange={(v) => setField("periudhaZhvendosje", v)}
                opsionet={opsionetEThjeshta(ZHVENDOSJET_E_PERIUDHES)}
                titulli="Për cilin muaj është pagesa"
              />
              <div className="fcp-modal-hint">
                Paratë rrallë lëvizin në muajin që u takojnë: qiraja merret një muaj përpara, rroga
                vjen në fillim të muajit pasardhës për punën e muajit që shkoi. Muaji numërohet nga
                <em> data e vetë pagesës në skedulë</em>, jo nga dita kur i jepni paratë - pra një
                qira me datë 1 shtator, që mbulon shtatorin, është «Muajin e vetë datës» edhe kur ju
                e merrni javën e fundit të gushtit.
                {/* Shown rather than described: the offset is easy to pick one step off, and the
                    mistake is invisible until it has already been written into a transaction. */}
                {rec.dataETjetres && (
                  <div className="mt-1">
                    Pagesa e <strong>{formatDate(rec.dataETjetres)}</strong>{" "}
                    {periudhaEPare
                      ? (
                        <>
                          do të shënohet{" "}
                          <em>
                            {(rec.emri || "Pagesa").trim()} · {periudhaEPare.etiketa}
                          </em>
                          .
                        </>
                      )
                      : "nuk do të mbajë shënim muaji."}
                  </div>
                )}
              </div>
            </Form.Group>

            <MonedhaTjeter
              monedhaOrigjinale={rec.monedhaOrigjinale}
              kursi={rec.kursi}
              vlera={rec.vlera}
              onChange={(fusha) => setRec((prev) => ({ ...prev, ...fusha }))}
            />

            {!njeLlogari && (
              <Form.Group as={Col} md={6} controlId="rec-llogariaid">
                <Form.Label>
                  Llogaria <span className="text-danger">*</span>
                </Form.Label>
                <Zgjedhesi
                  id="rec-llogariaid"
                  value={rec.llogariaId}
                  onChange={(v) => setField("llogariaId", v)}
                  opsionet={opsionetLlogarive(accounts.filter((a) => !a.arkivuar))}
                  placeholder="Zgjidh llogarinë..."
                  titulli="Zgjidh llogarinë"
                  required
                />
              </Form.Group>
            )}

            <Form.Group as={Col} md={6} controlId="rec-kategoriaid">
              <Form.Label>
                Kategoria <span className="text-danger">*</span>
              </Form.Label>
              <ZgjedhesiKategorive
                id="rec-kategoriaid"
                categories={categories}
                lloji={rec.lloji}
                value={rec.kategoriaId}
                onChange={(kategoriaId) => setField("kategoriaId", kategoriaId)}
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="rec-dataetjetres">
              <Form.Label>
                Data e Radhës <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="date"
                value={rec.dataETjetres}
                onChange={(e) => setField("dataETjetres", e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="rec-nrkesteve">
              <Form.Label>Numri i Kësteve (opsional)</Form.Label>
              <Form.Control
                type="number"
                min="1"
                step="1"
                placeholder="p.sh. 6"
                value={rec.nrKesteve}
                onChange={(e) => setField("nrKesteve", e.target.value)}
              />
              <div className="fcp-modal-hint">
                Për një blerje me këste (p.sh. me Bonus Card): shkruani sa këste janë dhe data e përfundimit
                llogaritet vetë - pagesa ndalet pas kësti të fundit.
              </div>
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="rec-datafundit">
              <Form.Label>Përfundon më (opsional)</Form.Label>
              <Form.Control
                type="date"
                value={rec.dataFundit}
                disabled={Boolean(kesteFundi)}
                onChange={(e) => setField("dataFundit", e.target.value)}
              />
              {kesteFundi && (
                <div className="fcp-modal-hint">Kësti i fundit: {formatDate(kesteFundi)}.</div>
              )}
            </Form.Group>

            <Form.Group as={Col} md={12} controlId="rec-borxhiid">
              <Form.Label>
                {rec.lloji === "hyrje" ? "Kthim borxhi (opsional)" : "Zbrit nga një borxh (opsional)"}
              </Form.Label>
              <Zgjedhesi
                id="rec-borxhiid"
                value={rec.borxhiId}
                onChange={(v) => setField("borxhiId", v)}
                opsionet={borxhetERelevante.map((d) => ({
                  value: d.id,
                  label: d.emri,
                  nen: `mbeten ${formatMoney(d.mbetur, monedha)}`,
                }))}
                emptyLabel="Pa lidhje me borxh"
                placeholder="Pa lidhje me borxh"
                titulli="Lidhe me një borxh"
              />
              <div className="fcp-modal-hint">
                {borxhetERelevante.length === 0
                  ? rec.lloji === "hyrje"
                    ? "Nuk ka hua të dhëna të hapura - shtoni një te faqja Borxhet & Kartelat."
                    : "Nuk ka borxhe të hapura - shtoni një kartelë ose kredi te faqja Borxhet & Kartelat."
                  : `Kur ta konfirmoni pagesën, ky borxh zbritet vetë me të njëjtën vlerë - p.sh. kësti mujor i një kartele bonus e ul borxhin pa e shënuar dy herë. ${
                      rec.nrKesteve ? "Këstet ndalen vetë pas të fundit." : ""
                    }`}
              </div>
            </Form.Group>

            <Col md={12}>
              <Form.Check
                type="switch"
                id="rec-aktiv"
                label="Aktiv"
                checked={Boolean(rec.aktiv)}
                onChange={(e) => setField("aktiv", e.target.checked)}
              />
              <Form.Check
                type="switch"
                id="rec-automatike"
                className="mt-2"
                label="Regjistroje vetë kur vjen data"
                checked={Boolean(rec.automatike)}
                onChange={(e) => setField("automatike", e.target.checked)}
              />
              <div className="fcp-modal-hint">
                Pa këtë, pagesa pret konfirmimin tuaj dhe vlera mund të rregullohet para se të regjistrohet. Me të,
                transaksioni krijohet vetë me vlerën e planifikuar sapo hapet aplikacioni pas datës - i përshtatshëm
                për qira ose abonime me vlerë fikse.
              </div>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Anulo
          </Button>
          <Button type="submit" className="btn-primary">
            {initial ? "Ruaj Ndryshimet" : "Ruaj Pagesën"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoTePerseritur;
