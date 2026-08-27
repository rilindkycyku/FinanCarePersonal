import { useMemo } from "react";
import {
  ArrowRightLeft, Coins, LayoutList, LineChart, Scale, Tag, Tags, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import { Panel, ProgressBar, Empty } from "../Ui";
import GrafikuBilancit from "../GrafikuBilancit";
import ModaliDetajeve from "./ModaliDetajeve";
import ListaEDiteve from "./ListaEDiteve";
import { useData } from "../../Context/DataContext";
import {
  accountStatement, amountBuckets, balanceHistory, filterByRange, totalsByCategory,
} from "../../lib/finance";
import { totalsByTag } from "../../lib/etiketat";
import { emriIPlote } from "../../lib/kategorite";
import { accountTypeMeta } from "../../lib/options";
import { formatDate, formatPercent } from "../../lib/format";
import { getIcon } from "../../lib/icons";
import "../../Pages/Styles/Personal.css";

/**
 * One account, opened up - and deliberately not the same thing as a category opened up.
 *
 * A category is a question about spending: one direction, one total, and "where did it go" is
 * answered by breaking it down further. An account is not. Money comes in, goes out, and moves to
 * and from the user's own other accounts, and the figure that matters at the close of each day is
 * the balance - the number the bank app would show. So this is a statement: opening balance, what
 * moved, closing balance, with every day openable down to the rows that moved it, signed.
 *
 * The breakdowns underneath answer the question an account *can* be asked - "what did I use this
 * one for" - and the last tab is the only one a category has no equivalent of: where the balance
 * has been.
 *
 * Transfers are counted here in full. They are neither income nor expense for the ledger as a
 * whole, which is why every other figure in the app leaves them out, but they are exactly what
 * moved this account and a statement that hid them would not reconcile with the balance beside it.
 */
const PAMJET = [
  { celesi: "ditet", etiketa: "Ditët", ikona: LayoutList },
  { celesi: "ndarja", etiketa: "Ndarja", ikona: Tags },
  { celesi: "ecuria", etiketa: "Ecuria", ikona: LineChart },
];

function DetajetELlogarise({ show, onHide, zeri, kufijte, titulliPeriudhes }) {
  const { accounts, categories, transactions, money, signedMoney } = useData();

  const aktiv = show && Boolean(zeri);
  const llogaria = useMemo(
    () => (aktiv ? accounts.find((a) => a.id === zeri.id) || null : null),
    [aktiv, accounts, zeri]
  );

  /** Names indexed once per opening: a statement of thirty rows was rebuilding the category index
   * thirty times through `emriIPlote`. */
  const emrat = useMemo(() => {
    if (!aktiv) return { kategorite: new Map(), llogarite: new Map() };
    return {
      kategorite: new Map(categories.map((c) => [c.id, emriIPlote(categories, c.id) || c.emri])),
      llogarite: new Map(accounts.map((a) => [a.id, a.emri])),
    };
  }, [aktiv, categories, accounts]);

  const pasqyra = useMemo(
    () => accountStatement(llogaria, transactions, kufijte.start, kufijte.end),
    [llogaria, transactions, kufijte.start, kufijte.end]
  );

  const ndarjet = useMemo(() => {
    if (!aktiv || !llogaria) return null;
    // Only what this account paid for, by date - a breakdown is about what the money bought, and a
    // transfer bought nothing.
    const brenda = filterByRange(
      transactions.filter((tx) => tx.llogariaId === llogaria.id),
      kufijte.start,
      kufijte.end
    );
    return {
      shpenzimet: totalsByCategory(brenda, categories, "shpenzim"),
      hyrjet: totalsByCategory(brenda, categories, "hyrje"),
      etiketat: totalsByTag(brenda, "shpenzim"),
      kosha: amountBuckets(brenda, "shpenzim"),
      transferet: pasqyra.ditet
        .flatMap((d) => d.transaksionet)
        .filter((tx) => tx.lloji === "transfer"),
    };
  }, [aktiv, llogaria, transactions, categories, kufijte, pasqyra]);

  /**
   * Where the balance has been - the same six-month curve the summary page draws, for this one
   * account rather than for all of them together.
   *
   * The archive flag is cleared on the way in. `balanceHistory` drops archived accounts because it
   * is normally asked "how much do I have", and a closed account is not part of that answer; asked
   * about one account by name it is, and leaving the flag on would draw a flat zero line for an
   * account whose history is exactly what somebody opened it to see.
   */
  const historiku = useMemo(
    () => (aktiv && llogaria ? balanceHistory([{ ...llogaria, arkivuar: false }], transactions, 6) : []),
    [aktiv, llogaria, transactions]
  );

  if (!zeri) return null;

  if (aktiv && !llogaria) {
    return (
      <ModaliDetajeve
        show={show}
        onHide={onHide}
        zeri={zeri}
        nenTitulli={titulliPeriudhes}
        bosh
        boshTeksti="Kjo llogari nuk gjendet më."
      >
        {() => null}
      </ModaliDetajeve>
    );
  }

  const meta = accountTypeMeta(llogaria?.lloji);
  const maxShpenzim = ndarjet?.shpenzimet[0]?.vlera || 1;
  const maxHyrje = ndarjet?.hyrjet[0]?.vlera || 1;
  const maxEtiketa = ndarjet?.etiketat[0]?.vlera || 1;
  const maxKoshi = Math.max(...(ndarjet?.kosha.map((k) => k.vlera) || [0]), 1);

  const kutite = [
    {
      label: "Bilanci",
      value: money(pasqyra.mbyllja),
      sub: `Hapja ${money(pasqyra.hapja)}`,
      icon: Wallet,
      color: pasqyra.mbyllja >= 0 ? "emerald" : "danger",
    },
    {
      label: "Hyrjet",
      value: money(pasqyra.hyrjet),
      sub: `${pasqyra.numri} lëvizje`,
      icon: TrendingUp,
      color: "emerald",
    },
    { label: "Daljet", value: money(pasqyra.daljet), icon: TrendingDown, color: "danger" },
    {
      label: "Ndryshimi",
      value: signedMoney(pasqyra.neto),
      sub: `${pasqyra.ditet.length} ditë me lëvizje`,
      icon: Scale,
      color: pasqyra.neto >= 0 ? "cyan" : "danger",
    },
  ];

  /**
   * What a row is, on a statement. A transfer says which account it came from or went to, because
   * on this side of it "Transfer · 200 €" alone is the one row a reader cannot place.
   */
  const pershkrimiRreshtit = (tx) => {
    if (tx.lloji === "transfer") {
      const tjetra =
        tx.llogariaId === llogaria.id
          ? emrat.llogarite.get(tx.llogariaDestinacionId)
          : emrat.llogarite.get(tx.llogariaId);
      return tx.pershkrimi || `Transfer ${tx.shenja > 0 ? "nga" : "te"} ${tjetra || "llogari e fshirë"}`;
    }
    return tx.pershkrimi || emrat.kategorite.get(tx.kategoriaId) || (tx.shenja > 0 ? "Hyrje" : "Dalje");
  };

  const nenTitulliRreshtit = (tx) =>
    [
      tx.lloji === "transfer" ? "Transfer" : emrat.kategorite.get(tx.kategoriaId),
      (tx.etiketat || []).filter(Boolean).join(", ") || null,
    ]
      .filter(Boolean)
      .join(" · ");

  const rreshtiKategorise = (list, max, klasa) =>
    list.length === 0 ? (
      <Empty>Asgjë në këtë periudhë.</Empty>
    ) : (
      list.map((k) => {
        const KIkona = getIcon(k.ikona);
        return (
          <div className="fcp-row" key={k.id}>
            <div className="fcp-row-icon" style={{ color: k.ngjyra }}>
              <KIkona size={16} />
            </div>
            <div className="fcp-row-main">
              <div className="fcp-row-title">{k.emri}</div>
              <div className="fcp-row-sub">
                {k.numri} × · {formatPercent(k.perqindja, 1)}
              </div>
            </div>
            <div className="fcp-row-bar">
              <ProgressBar value={(k.vlera / max) * 100} color={k.ngjyra} small />
            </div>
            <div className={`fcp-row-value ${klasa}`}>{money(k.vlera)}</div>
          </div>
        );
      })
    );

  return (
    <ModaliDetajeve
      show={show}
      onHide={onHide}
      zeri={zeri}
      nenTitulli={`${meta.label || "Llogari"} · ${titulliPeriudhes}`}
      kutite={kutite}
      pamjet={PAMJET}
      veprimi={{
        to: `/transaksionet?llogaria=${encodeURIComponent(zeri.id)}`,
        etiketa: "Hapi te transaksionet",
      }}
      bosh={pasqyra.numri === 0}
      boshTeksti="Asnjë lëvizje në këtë llogari për këtë periudhë."
    >
      {(pamja) => (
        <>
          {pamja === "ditet" && (
            <Panel title="Ditë pas Dite" icon={LayoutList}>
              <ListaEDiteve
                ditet={pasqyra.ditet}
                ngjyra={zeri.ngjyra}
                celesiResetimit={`llogari:${zeri.id}:${kufijte.start}`}
                vleraEDites={(d) => (
                  <div className="fcp-row-value-wrap">
                    <div className={`fcp-row-value ${d.neto >= 0 ? "fcp-pos" : "fcp-neg"}`}>
                      {signedMoney(d.neto)}
                    </div>
                    {/* The balance the day closed at - the number a statement exists to show, and
                        the one that says whether a heavy day actually mattered. */}
                    <div className="fcp-row-perdite">bilanci {money(d.bilanci)}</div>
                  </div>
                )}
                rreshtiTx={(tx) => (
                  <div className="fcp-detaje-tx-rresht" key={tx.id}>
                    <div className="fcp-detaje-tx-main">
                      <div className="fcp-detaje-tx-emri">{pershkrimiRreshtit(tx)}</div>
                      {nenTitulliRreshtit(tx) && (
                        <div className="fcp-row-sub">{nenTitulliRreshtit(tx)}</div>
                      )}
                      {tx.shenim && <div className="fcp-row-sub fcp-detaje-tx-shenim">{tx.shenim}</div>}
                    </div>
                    <div className={`fcp-nen-vlera ${tx.shenja > 0 ? "fcp-pos" : "fcp-neg"}`}>
                      {signedMoney(tx.efekti)}
                    </div>
                  </div>
                )}
              />
            </Panel>
          )}

          {pamja === "ndarja" && (
            <>
              <Panel title="Paguar nga Kjo Llogari" icon={Tags}>
                {rreshtiKategorise(ndarjet.shpenzimet, maxShpenzim, "fcp-neg")}
                {/* Transfers move money without buying anything, so they are left out of the split
                    above - said here, where somebody would otherwise look for them in it. */}
                <div className="fcp-row-sub mt-2">
                  Transferet mes llogarive tuaja nuk numërohen këtu: ato lëvizin para, nuk blejnë
                  asgjë. I gjeni më poshtë.
                </div>
              </Panel>

              {ndarjet.hyrjet.length > 0 && (
                <div className="mt-3">
                  <Panel title="Hyrjet në Këtë Llogari" icon={TrendingUp}>
                    {rreshtiKategorise(ndarjet.hyrjet, maxHyrje, "fcp-pos")}
                  </Panel>
                </div>
              )}

              {ndarjet.etiketat.length > 0 && (
                <div className="mt-3">
                  <Panel title="Etiketat e Përdorura" icon={Tag}>
                    {ndarjet.etiketat.map((et) => (
                      <div className="fcp-row" key={et.celesi}>
                        <div className="fcp-row-icon" style={{ color: et.ngjyra }}>
                          <Tag size={16} />
                        </div>
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">{et.emri}</div>
                          <div className="fcp-row-sub">
                            {et.numri} × · {formatPercent(et.perqindja, 1)}
                          </div>
                        </div>
                        <div className="fcp-row-bar">
                          <ProgressBar value={(et.vlera / maxEtiketa) * 100} color={et.ngjyra} small />
                        </div>
                        <div className="fcp-row-value fcp-neg">{money(et.vlera)}</div>
                      </div>
                    ))}
                  </Panel>
                </div>
              )}

              {ndarjet.transferet.length > 0 && (
                <div className="mt-3">
                  <Panel title="Transferet" icon={ArrowRightLeft}>
                    {ndarjet.transferet.map((tx) => (
                      <div className="fcp-row" key={tx.id}>
                        <div className="fcp-row-icon" style={{ color: "var(--sp-cyan)" }}>
                          <ArrowRightLeft size={16} />
                        </div>
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">{pershkrimiRreshtit(tx)}</div>
                          <div className="fcp-row-sub">{formatDate(tx.data)}</div>
                        </div>
                        <div className={`fcp-row-value ${tx.shenja > 0 ? "fcp-pos" : "fcp-neg"}`}>
                          {signedMoney(tx.efekti)}
                        </div>
                      </div>
                    ))}
                  </Panel>
                </div>
              )}

              <div className="mt-3">
                <Panel title="Sipas Madhësisë" icon={Coins}>
                  {ndarjet.kosha
                    .filter((k) => k.numri > 0)
                    .map((k) => (
                      <div className="fcp-row" key={k.emri}>
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">{k.emri}</div>
                          <div className="fcp-row-sub">
                            {k.numri} × · {formatPercent(k.perqindjaNumri)} e herëve
                          </div>
                        </div>
                        <div className="fcp-row-bar">
                          <ProgressBar value={(k.vlera / maxKoshi) * 100} color="#f59e0b" small />
                        </div>
                        <div className="fcp-row-value-wrap">
                          <div className="fcp-row-value fcp-neg">{money(k.vlera)}</div>
                          <div className="fcp-row-perdite">{formatPercent(k.perqindja)} e parave</div>
                        </div>
                      </div>
                    ))}
                </Panel>
              </div>
            </>
          )}

          {pamja === "ecuria" && (
            <Panel title="Bilanci Ndër Muaj" icon={LineChart}>
              {/* The one tab that ignores the period selector, for the same reason the category's
                  six-month panel does: a period cannot say whether it was ordinary. */}
              <GrafikuBilancit pikat={historiku.map((m) => ({ ...m, parashikim: false }))} money={money} />
              <div className="fcp-rreshtat-grup mt-2">
                {historiku
                  .slice()
                  .reverse()
                  .map((m) => (
                    <div className="fcp-row" key={m.key}>
                      <div className="fcp-row-main">
                        <div className="fcp-row-title">
                          {m.label} {m.viti}
                        </div>
                      </div>
                      <div className={`fcp-row-value ${m.bilanci >= 0 ? "" : "fcp-neg"}`}>
                        {money(m.bilanci)}
                      </div>
                    </div>
                  ))}
              </div>
              <div className="fcp-row-sub mt-2">
                Mbyllja e çdo muaji për këtë llogari - bilanci fillestar plus çdo lëvizje deri atë
                ditë, njësoj si çdo bilanc tjetër në aplikacion.
              </div>
            </Panel>
          )}
        </>
      )}
    </ModaliDetajeve>
  );
}

export default DetajetELlogarise;
