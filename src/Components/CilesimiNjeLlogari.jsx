import { useState } from "react";
import { Card, Form, Button, Alert } from "react-bootstrap";
import { Wallet, Merge } from "lucide-react";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { makeId, STORES } from "../lib/db";
import { consolidateAccounts } from "../lib/finance";
import { MAIN_ACCOUNT_DEFAULT } from "../lib/options";
// The card styling lives with the settings page, and this block is rendered on Llogaritë too.
import "../Pages/Styles/Dashboard.css";
import "../Pages/Styles/Personal.css";

/**
 * The "one account for everything" switch, shared by Cilësimet and the Llogaritë page.
 *
 * With the mode on, every form books into a single main account and stops asking which one, so
 * cash, bank and card are no longer tracked apart. Turning it on offers to merge whatever accounts
 * already exist into the main one — otherwise their balances and transactions would be stranded on
 * accounts nothing points at any more.
 */
function CilesimiNjeLlogari({ onMessage }) {
  const {
    profile, accounts, transactions, recurring, goals,
    njeLlogari, llogariaKryesore, save, saveMany, destroyMany, saveProfile, money,
  } = useData();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);

  const tjera = accounts.filter((a) => a.id !== llogariaKryesore?.id);

  const planFor = (targetId) =>
    consolidateAccounts({ accounts, transactions, recurring, goals, targetId, lloji: "kryesore" });

  /** Writes a consolidation plan: the merged account first, then the accounts it replaced. */
  const applyPlan = async (plan) => {
    await saveMany([
      [STORES.accounts, plan.account],
      ...plan.transactions.map((tx) => [STORES.transactions, tx]),
      ...plan.recurring.map((r) => [STORES.recurring, r]),
      ...plan.goals.map((g) => [STORES.goals, g]),
    ]);
    if (plan.removeIds.length > 0) {
      await destroyMany(plan.removeIds.map((id) => [STORES.accounts, id]));
    }
  };

  const confirmMerge = async (target) => {
    const plan = planFor(target.id);
    if (!plan) return false;

    const nrTjera = plan.removeIds.length;
    const ok = await dialog.confirm(
      [
        `Çdo gjë kalon te llogaria "${target.emri}".`,
        nrTjera > 0
          ? `${nrTjera} ${nrTjera === 1 ? "llogari tjetër fshihet" : "llogari të tjera fshihen"} dhe bilancet e tyre fillestare mblidhen në një të vetëm (${money(plan.account.bilanciFillestar)}).`
          : "",
        plan.transactions.length > 0
          ? `${plan.transactions.length} ${plan.transactions.length === 1 ? "transaksion kalon" : "transaksione kalojnë"} te kjo llogari — bilanci total mbetet i njëjti.`
          : "",
        plan.nrTransfereve > 0
          ? `${plan.nrTransfereve} ${plan.nrTransfereve === 1 ? "transfer mes llogarive tuaja mbetet" : "transfere mes llogarive tuaja mbeten"} në historik, por nuk e ndryshojnë më bilancin sepse paratë nuk dalin nga llogaria.`
          : "",
        "Ky veprim nuk kthehet mbrapa — ruani një kopje JSON te faqja Eksporto / Importo para se të vazhdoni.",
      ]
        .filter(Boolean)
        .join(" "),
      { title: "Bashko Llogaritë", confirmLabel: "Bashko gjithçka" }
    );
    if (!ok) return false;

    await applyPlan(plan);
    return true;
  };

  const enable = async () => {
    let target = llogariaKryesore;
    if (!target) {
      target = { id: makeId("acc"), ...MAIN_ACCOUNT_DEFAULT };
      await save(STORES.accounts, target);
    } else if (accounts.length > 1 && !(await confirmMerge(target))) {
      return;
    }
    await saveProfile({ ...profile, njeLlogari: true, llogariaKryesoreId: target.id });
    onMessage?.(`Modaliteti me një llogari u aktivizua — gjithçka regjistrohet te "${target.emri}".`);
  };

  const disable = async () => {
    await saveProfile({ ...profile, njeLlogari: false });
    onMessage?.("Modaliteti me një llogari u çaktivizua — mund të shtoni sërish llogari të veçanta.");
  };

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const mergeNow = () =>
    run(async () => {
      if (!llogariaKryesore) return;
      if (await confirmMerge(llogariaKryesore)) {
        onMessage?.(`Llogaritë u bashkuan te "${llogariaKryesore.emri}".`);
      }
    });

  const changeMain = (id) => run(() => saveProfile({ ...profile, llogariaKryesoreId: id }));

  return (
    <Card className="profile-card fcp-settings-card border-0 p-4 mb-4">
      <h5 className="fw-bold mb-3">
        <Wallet size={18} className="me-2 text-primary" />
        Llogaritë
      </h5>

      <Form.Check
        type="switch"
        id="cilesimi-nje-llogari"
        label="Përdor vetëm një llogari kryesore"
        checked={njeLlogari}
        disabled={busy}
        onChange={(e) => run(e.target.checked ? enable : disable)}
      />
      <div className="fcp-row-sub mt-1 mb-3">
        Kesh, bankë dhe kartelë nuk ndahen — çdo transaksion, pagesë e përsëritur dhe kontribut shkon te një
        llogari e vetme dhe formularët nuk pyesin më për llogarinë.
      </div>

      {accounts.length > 1 && (
        <Form.Group controlId="cilesimi-llogaria-kryesore" className="mb-3">
          <Form.Label>Llogaria kryesore</Form.Label>
          <Form.Select
            value={llogariaKryesore?.id || ""}
            disabled={busy}
            onChange={(e) => changeMain(e.target.value)}
            style={{ maxWidth: 320 }}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.emri}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      )}

      {njeLlogari && tjera.length > 0 && (
        <Alert variant="warning" className="mb-0">
          <div className="mb-2">
            Ka edhe {tjera.length} {tjera.length === 1 ? "llogari tjetër" : "llogari të tjera"} me bilanc dhe
            transaksione veçmas. Bashkojini te &quot;{llogariaKryesore?.emri}&quot; që gjithçka të llogaritet në një
            vend.
          </div>
          <Button size="sm" variant="warning" disabled={busy} onClick={mergeNow}>
            <Merge size={14} className="me-1" /> Bashko gjithçka te llogaria kryesore
          </Button>
        </Alert>
      )}
    </Card>
  );
}

export default CilesimiNjeLlogari;
