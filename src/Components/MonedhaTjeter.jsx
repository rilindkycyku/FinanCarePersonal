import { Form, Col, Row } from "react-bootstrap";
import { useData } from "../Context/DataContext";
import { convertedAmount } from "../lib/finance";
import { currencySymbol, formatMoney, toNumber } from "../lib/format";
import { CURRENCIES } from "../lib/options";
import "./ModalForms.css";

/**
 * Optional "this amount is in another currency" block for the transaction and recurring-payment
 * forms — an Anthropic or Google subscription billed in $ while the profile runs in €.
 *
 * The form keeps entering the amount in the chosen currency; what gets stored is that amount times
 * `kursi`, so every balance and chart stays in the profile currency. The rate is typed by hand
 * (the app has no backend to fetch one) but the last rate per currency is remembered on the
 * profile, so the next month is one glance at the card statement away.
 */
function MonedhaTjeter({ monedhaOrigjinale, kursi, vlera, onChange }) {
  const { monedha, profile } = useData();
  const aktive = Boolean(monedhaOrigjinale);

  const toggle = (on) => {
    if (!on) return onChange({ monedhaOrigjinale: "", kursi: "" });
    // Opens on a currency already used before (with its rate ready), so a monthly $ subscription
    // is two fields away rather than a re-selection every time.
    const kodi =
      Object.keys(profile.kurset || {}).find((c) => c !== monedha) ||
      CURRENCIES.find((c) => c.code !== monedha)?.code ||
      "USD";
    return onChange({ monedhaOrigjinale: kodi, kursi: String(profile.kurset?.[kodi] ?? "") });
  };

  const changeCurrency = (kodi) =>
    onChange({ monedhaOrigjinale: kodi, kursi: String(profile.kurset?.[kodi] ?? kursi ?? "") });

  const baza = convertedAmount(vlera, kursi);

  return (
    <Col md={12}>
      <Form.Check
        type="switch"
        id="fusha-monedha-tjeter"
        label="Vlera është në monedhë tjetër"
        checked={aktive}
        onChange={(e) => toggle(e.target.checked)}
      />

      {aktive && (
        <Row className="g-3 mt-0">
          <Form.Group as={Col} md={6} controlId="fusha-monedha">
            <Form.Label>Monedha e faturës</Form.Label>
            <Form.Select value={monedhaOrigjinale} onChange={(e) => changeCurrency(e.target.value)}>
              {CURRENCIES.filter((c) => c.code !== monedha).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} - {c.symbol}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group as={Col} md={6} controlId="fusha-kursi">
            <Form.Label>
              Kursi (1 {currencySymbol(monedhaOrigjinale)} = ? {currencySymbol(monedha)}){" "}
              <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="number"
              step="0.0001"
              min="0"
              inputMode="decimal"
              placeholder="p.sh. 0.92"
              value={kursi}
              onChange={(e) => onChange({ monedhaOrigjinale, kursi: e.target.value })}
            />
          </Form.Group>

          <Col md={12}>
            <div className="fcp-modal-hint">
              {toNumber(vlera) > 0 && toNumber(kursi) > 0
                ? `${formatMoney(vlera, monedhaOrigjinale)} ruhet si ${formatMoney(baza, monedha)}.`
                : `Shkruani vlerën dhe kursin - ruhet vlera e kthyer në ${currencySymbol(monedha)}.`}{" "}
              Kursi i fundit për këtë monedhë mbahet mend për herën tjetër.
            </div>
          </Col>
        </Row>
      )}
    </Col>
  );
}

export default MonedhaTjeter;
