import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { MailWarning } from "lucide-react";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { useSync } from "../Context/SyncContext";
import { dergoRaportin, lexoShenjat, marresiIRaportit, raportetNePritje, shenoDerguar } from "../lib/raporti";
import { LLOJET_RAPORTIT } from "../lib/raportet";
import { etiketaPeriudhes } from "../lib/periudhat";
import { dataEParaERegjistruar } from "../lib/finance";

/**
 * A line on the dashboard when a report that is owed has failed to go out, with the reason and a
 * button that sends it there and then.
 *
 * The failure used to be written only on the reports card in Cilësimet, which is a page nobody opens
 * to check on an email - so a weekly report could fail on Monday and keep failing quietly until
 * someone wondered on Sunday where it was. The dashboard is the page that is opened every day.
 *
 * Only failures: a report that is simply waiting for the app to reach the network, or that another
 * device is sending right now, is not something to act on. The markers are read once per opening
 * (one request), and again after a send.
 */
function RaportiNukUDergua() {
  const data = useData();
  const { profile, transactions } = data;
  const { lidhur } = useSync();
  const dialog = useDialog();
  const [shenjat, setShenjat] = useState([]);
  const [duke, setDuke] = useState("");

  const aktiv = LLOJET_RAPORTIT.some((r) => profile?.[r.fusha]);
  const fillimi = useMemo(() => dataEParaERegjistruar(transactions), [transactions]);

  const lexo = useCallback(async () => {
    if (!lidhur || !aktiv) return setShenjat([]);
    try {
      setShenjat(await lexoShenjat());
    } catch {
      // Offline or the session needs renewing: the sync indicator already says so.
      setShenjat([]);
    }
  }, [lidhur, aktiv]);

  useEffect(() => {
    lexo();
  }, [lexo]);

  const deshtuar = raportetNePritje({ profile, shenjat, fillimi }).filter((r) => r.gjendja === "deshtoi");
  if (!deshtuar.length) return null;

  const provo = async (r) => {
    const marresi = marresiIRaportit(profile);
    if (!marresi) {
      dialog.alert("Nuk ka adresë ku ta dërgojmë - shkruajeni te Cilësimet → Raportet.", { title: "Pa marrës" });
      return;
    }
    setDuke(r.lloji);
    try {
      const { id } = await dergoRaportin({
        lloji: r.lloji,
        periudha: r.periudha,
        marresi,
        profile,
        accounts: data.accounts,
        categories: data.categories,
        transactions,
        recurring: data.recurring,
        budgets: data.budgets,
        goals: data.goals,
        borxhet: data.borxhet,
        udhetimet: data.udhetimet,
      });
      // The period is closed (that is what made it owed), so it is recorded as sent and the
      // automatic path will not send it a second time.
      await shenoDerguar(r.lloji, r.periudha, { marresi, id });
      await lexo();
    } catch (err) {
      dialog.alert(err?.message || "Dërgimi dështoi.", { title: "Nuk u dërgua", variant: "danger" });
    } finally {
      setDuke("");
    }
  };

  return deshtuar.map((r) => (
    <Alert key={r.lloji} variant="warning" className="d-flex align-items-center justify-content-between flex-wrap gap-2">
      <span>
        <MailWarning size={16} className="me-2" />
        Raporti i <strong>{etiketaPeriudhes(r.lloji, r.periudha)}</strong> nuk u dërgua: {r.gabimi || "arsye e panjohur"}.{" "}
        <Link to="/cilesimet">Cilësimet e raporteve</Link>
      </span>
      <Button size="sm" variant="warning" onClick={() => provo(r)} disabled={Boolean(duke)}>
        {duke === r.lloji ? <Spinner size="sm" animation="border" /> : "Provo sërish"}
      </Button>
    </Alert>
  ));
}

export default RaportiNukUDergua;
