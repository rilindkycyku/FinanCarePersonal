import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Container, Row, Button, Alert } from "react-bootstrap";
import {
  Users, Plus, Edit3, Trash2, Archive, ArchiveRestore, ArrowLeft, ArrowRight, HandCoins, Receipt,
  Wallet, Info, CheckCircle2, Scale, Handshake,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import ButoniUdhezimit from "../Components/ButoniUdhezimit";
import PageLoading from "../Components/PageLoading";
import ShtoGrupin from "../Components/ShtoGrupin";
import ShtoShpenzimGrupi from "../Components/ShtoShpenzimGrupi";
import { Kpi, Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { makeId, STORES } from "../lib/db";
import { formatDate, todayISO } from "../lib/format";
import {
  LLOJET_E_NDARJES, UNE, bilanciImMeAnetaret, bilancetETjereve, diferencatPerBorxhe, emriAnetarit,
  permbledhjaEGrupit, pjesetEShpenzimit, planiIKalimitNeBorxhe, shlyerjetMinimale,
} from "../lib/grupet";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

/**
 * Shared expenses - trips, a flat, a dinner club. Who paid what, split how, and who owes whom.
 *
 * The user's own side ends up on the Borxhet page: "Kalo te Borxhet" carries each person's balance
 * with the user into a debt note (lib/grupet.js explains why it is on request and not live). The
 * others' balances among themselves stay here, reduced to the fewest transfers.
 */
function Grupet() {
  const { grupet, borxhet, transactions, saveMany, save, destroy, destroyMany, money, loading } = useData();
  const dialog = useDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showGrupi, setShowGrupi] = useState(false);
  const [editingGrupi, setEditingGrupi] = useState(null);
  const [showShp, setShowShp] = useState(false);
  const [editingShp, setEditingShp] = useState(null);

  const idHapur = searchParams.get("id");
  const grupi = grupet.find((g) => g.id === idHapur) || null;

  const hap = (id) => setSearchParams(id ? { id } : {});

  const renditura = useMemo(
    () =>
      [...grupet]
        .map((g) => ({
          ...g,
          permbledhja: permbledhjaEGrupit(g),
          netoIm: bilanciImMeAnetaret(g).reduce((s, r) => s + r.neto, 0),
          pezull: diferencatPerBorxhe(g).length,
        }))
        .sort((a, b) => String(b.krijuar || "").localeCompare(String(a.krijuar || ""))),
    [grupet]
  );

  const openNewGroup = () => {
    setEditingGrupi(null);
    setShowGrupi(true);
  };

  const fshiGrupin = async (g) => {
    const ok = await dialog.confirm(
      `Ta fshij grupin "${g.emri}" me ${g.shpenzimet?.length || 0} shpenzime? Transaksionet që janë regjistruar ` +
        "në llogari dhe borxhet e krijuara prej tij mbeten - ato janë para të vërteta.",
      { title: "Fshi Grupin", requireText: g.emri }
    );
    if (!ok) return;
    hap(null);
    await destroy(STORES.grupet, g.id);
  };

  const arkivo = async (g) => {
    await save(STORES.grupet, { ...g, arkivuar: !g.arkivuar });
  };

  if (loading) return <PageLoading title="Grupet" />;

  return (
    <div className="fcp-page">
      <PageTitle title={grupi ? grupi.emri : "Grupet"} />
      <NavBar />

      <main className="fcp-main">
        <Container className="pt-4">
          {grupi ? (
            <DetajetEGrupit
              grupi={grupi}
              borxhet={borxhet}
              transactions={transactions}
              money={money}
              dialog={dialog}
              saveMany={saveMany}
              save={save}
              destroyMany={destroyMany}
              onKthehu={() => hap(null)}
              onEdit={() => {
                setEditingGrupi(grupi);
                setShowGrupi(true);
              }}
              onArkivo={() => arkivo(grupi)}
              onFshi={() => fshiGrupin(grupi)}
              onShtoShpenzim={(shp = null) => {
                setEditingShp(shp);
                setShowShp(true);
              }}
            />
          ) : (
            <>
              <div className="fcp-page-head">
                <div>
                  <h1>Grupet</h1>
                  <p>Udhëtime, banesa e përbashkët, darka me shokët - kush pagoi çfarë dhe kush kujt i ka borxh.</p>
                  <ButoniUdhezimit className="mt-2" />
                </div>
                <Button className="btn-primary" onClick={openNewGroup}>
                  <Plus size={16} className="me-1" /> Grup i Ri
                </Button>
              </div>

              <Alert variant="info" className="d-flex align-items-start gap-2">
                <Info size={16} className="flex-shrink-0 mt-1" />
                <span>
                  Grupi mbahet vetëm te ju - të tjerët nuk e shohin. Kur të doni, <strong>«Kalo te Borxhet»</strong> e
                  shndërron atë që secili ju ka borxh (ose ju i keni) në një shënim te <Link to="/borxhet">Borxhet</Link>,
                  ku kthimet regjistrohen si zakonisht.
                </span>
              </Alert>

              {renditura.length === 0 ? (
                <Empty>
                  Ende asnjë grup. Krijoni një për udhëtimin e radhës, shtoni shokët, dhe regjistroni kush pagoi çdo
                  faturë - aplikacioni llogarit kush kujt i ka borxh.
                </Empty>
              ) : (
                <>
                  {[false, true].map((arkivuar) => {
                    const lista = renditura.filter((g) => Boolean(g.arkivuar) === arkivuar);
                    if (lista.length === 0) return null;
                    return (
                      <section className="mb-4" key={String(arkivuar)}>
                        <h2 className="fcp-section-title">
                          {arkivuar ? <Archive size={20} className="text-primary" /> : <Users size={20} className="text-primary" />}
                          {arkivuar ? "Të Arkivuara" : "Grupet e Mia"}
                        </h2>
                        {lista.map((g) => (
                          <button
                            type="button"
                            className={`fcp-tracked fcp-grupi-karta w-100 text-start${g.arkivuar ? " fcp-debt-archived" : ""}`}
                            key={g.id}
                            onClick={() => hap(g.id)}
                          >
                            <div className="fcp-tracked-head">
                              <div className="fcp-row-icon" style={{ color: g.ngjyra }}>
                                <Users size={16} />
                              </div>
                              <div className="fcp-row-main">
                                <div className="fcp-row-title">{g.emri}</div>
                                <div className="fcp-row-sub">
                                  {1 + (g.anetaret?.length || 0)} persona · {g.permbledhja.nrShpenzimeve} shpenzime ·{" "}
                                  {money(g.permbledhja.totali)} gjithsej
                                  {g.pezull > 0 && ` · ${g.pezull} pa kaluar te borxhet`}
                                </div>
                              </div>
                              <div className={`fcp-row-value ${g.netoIm > 0 ? "fcp-pos" : g.netoIm < 0 ? "fcp-neg" : ""}`}>
                                {g.netoIm > 0 ? `+${money(g.netoIm)}` : g.netoIm < 0 ? `−${money(-g.netoIm)}` : "Kuit"}
                              </div>
                              <ArrowRight size={16} className="ms-2 text-muted" />
                            </div>
                          </button>
                        ))}
                      </section>
                    );
                  })}
                </>
              )}
            </>
          )}
        </Container>

        <ShtoGrupin
          show={showGrupi}
          onHide={() => {
            setShowGrupi(false);
            setEditingGrupi(null);
          }}
          initial={editingGrupi}
          onRuajtur={(g) => {
            if (!editingGrupi) hap(g.id);
          }}
        />

        <ShtoShpenzimGrupi
          show={showShp && Boolean(grupi)}
          onHide={() => {
            setShowShp(false);
            setEditingShp(null);
          }}
          grupi={grupi}
          initial={editingShp}
        />
      </main>

      <Footer />
    </div>
  );
}

function DetajetEGrupit({
  grupi, borxhet, transactions, money, dialog, saveMany, save, destroyMany, onKthehu, onEdit, onArkivo, onFshi,
  onShtoShpenzim,
}) {
  const permbledhja = useMemo(() => permbledhjaEGrupit(grupi), [grupi]);
  const meMua = useMemo(() => bilanciImMeAnetaret(grupi), [grupi]);
  const diferencat = useMemo(() => diferencatPerBorxhe(grupi), [grupi]);
  const mesTeTjereve = useMemo(() => shlyerjetMinimale(bilancetETjereve(grupi)), [grupi]);
  const shenimet = borxhet.filter((d) => d.grupiId === grupi.id);
  const shpenzimet = [...(grupi.shpenzimet ?? [])].sort(
    (a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : String(b.krijuar || "").localeCompare(String(a.krijuar || "")))
  );
  const shlyerjet = [...(grupi.shlyerjet ?? [])].sort((a, b) => (a.data < b.data ? 1 : -1));
  const emri = (id) => emriAnetarit(grupi, id);

  const kaloTeBorxhet = async () => {
    const rreshtat = diferencat
      .map((r) =>
        r.diferenca > 0
          ? `${r.emri}: +${money(r.diferenca)} që ju ka borxh`
          : `${r.emri}: ${money(-r.diferenca)} që i keni borxh`
      )
      .join("; ");
    const ok = await dialog.confirm(
      `Këto shkojnë te Borxhet si shënim (pa prekur asnjë llogari): ${rreshtat}. ` +
        "Kthimet pastaj i regjistroni te borxhi, ku mund t'i shtoni edhe në llogari.",
      { title: "Kalo te Borxhet" }
    );
    if (!ok) return;
    const plani = planiIKalimitNeBorxhe(grupi, borxhet, { makeId, sot: todayISO() });
    await saveMany([...plani.borxhet.map((d) => [STORES.borxhet, d]), [STORES.grupet, plani.grupi]]);
  };

  const fshiShpenzimin = async (shp) => {
    const tx = shp.transaksioniId ? transactions.find((t) => t.id === shp.transaksioniId) : null;
    const ok = await dialog.confirm(
      tx
        ? `Ta fshij "${shp.pershkrimi || "shpenzimin"}"? Fshihet edhe transaksioni i lidhur prej ${money(tx.vlera)}, pra llogaria rritet përsëri.`
        : `Ta fshij "${shp.pershkrimi || "shpenzimin"}"?`,
      { title: "Fshi Shpenzimin" }
    );
    if (!ok) return;
    if (tx) await destroyMany([[STORES.transactions, tx.id]]);
    await save(STORES.grupet, { ...grupi, shpenzimet: (grupi.shpenzimet ?? []).filter((s) => s.id !== shp.id) });
  };

  const shenoShlyerjen = async (t) => {
    const ok = await dialog.confirm(
      `${emri(t.nga)} i ktheu ${emri(t.te)} ${money(t.vlera)}? Shënohet vetëm te grupi - nuk prek asnjë llogari tuajën.`,
      { title: "Shëno Shlyerjen" }
    );
    if (!ok) return;
    await save(STORES.grupet, {
      ...grupi,
      shlyerjet: [...(grupi.shlyerjet ?? []), { id: makeId("gshl"), data: todayISO(), nga: t.nga, te: t.te, vlera: t.vlera }],
    });
  };

  const fshiShlyerjen = async (sh) => {
    const ok = await dialog.confirm(`Ta heq shlyerjen ${emri(sh.nga)} → ${emri(sh.te)} prej ${money(sh.vlera)}?`, {
      title: "Hiq Shlyerjen",
    });
    if (!ok) return;
    await save(STORES.grupet, { ...grupi, shlyerjet: (grupi.shlyerjet ?? []).filter((s) => s.id !== sh.id) });
  };

  const pershkrimiIBilancit = (neto) =>
    neto > 0 ? `ju ka borxh ${money(neto)}` : neto < 0 ? `i keni borxh ${money(-neto)}` : "jeni kuit";

  return (
    <>
      <div className="fcp-page-head">
        <div>
          <button type="button" className="btn btn-link p-0 mb-2" onClick={onKthehu}>
            <ArrowLeft size={14} className="me-1" /> Të gjitha grupet
          </button>
          <h1 style={{ color: grupi.ngjyra }}>{grupi.emri}</h1>
          <p>
            Ju, {(grupi.anetaret ?? []).map((a) => a.emri).join(", ")}
            {grupi.shenim && ` · ${grupi.shenim}`}
          </p>
          <ButoniUdhezimit className="mt-2" />
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button className="btn-primary" onClick={() => onShtoShpenzim(null)}>
            <Plus size={16} className="me-1" /> Shto Shpenzim
          </Button>
          <button type="button" className="fcp-icon-action edit" title="Ndrysho grupin" onClick={onEdit}>
            <Edit3 size={14} />
          </button>
          <button type="button" className="fcp-icon-action" title={grupi.arkivuar ? "Kthe nga arkiva" : "Arkivo"} onClick={onArkivo}>
            {grupi.arkivuar ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          </button>
          <button type="button" className="fcp-icon-action delete" title="Fshij grupin" onClick={onFshi}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <Row className="g-2 g-md-4">
        <Kpi label="Totali i Grupit" value={money(permbledhja.totali)} sub={`${permbledhja.nrShpenzimeve} shpenzime`} icon={Receipt} color="violet" />
        <Kpi label="Pjesa Juaj" value={money(permbledhja.pjesaIme)} sub="sa ju takon të paguani" icon={Scale} color="cyan" />
        <Kpi label="Paguat Ju" value={money(permbledhja.paguarNgaUne)} sub="nga xhepi juaj" icon={Wallet} color="danger" />
        <Kpi
          label="Bilanci Juaj"
          value={(() => {
            const n = meMua.reduce((s, r) => s + r.neto, 0);
            return n > 0 ? `+${money(n)}` : n < 0 ? `−${money(-n)}` : money(0);
          })()}
          sub="+ ju kanë borxh · − u keni borxh"
          icon={HandCoins}
          color="emerald"
        />
      </Row>

      <section className="mb-4">
        <div className="fcp-section-head">
          <h2 className="fcp-section-title mb-0">
            <HandCoins size={20} className="text-primary" />
            Ju dhe të Tjerët
          </h2>
          {diferencat.length > 0 && (
            <Button size="sm" className="btn-primary" onClick={kaloTeBorxhet}>
              <ArrowRight size={14} className="me-1" /> Kalo te Borxhet
            </Button>
          )}
        </div>
        <p className="fcp-row-sub mb-3">
          Sa ju ka borxh secili (ose sa i keni ju), nga të gjitha shpenzimet e grupit. Kthimet regjistrohen te{" "}
          <Link to="/borxhet">Borxhet</Link>, pasi ta kaloni bilancin atje.
        </p>
        <div className="fcp-panel">
          {meMua.map((r) => {
            const dif = diferencat.find((d) => d.anetariId === r.anetariId);
            const shenimi = shenimet.filter((d) => d.anetariId === r.anetariId);
            return (
              <div className="fcp-row" key={r.anetariId}>
                <div className="fcp-row-icon">
                  {r.neto === 0 ? <CheckCircle2 size={16} className="text-success" /> : <Users size={16} />}
                </div>
                <div className="fcp-row-main">
                  <div className="fcp-row-title">
                    {r.emri} {pershkrimiIBilancit(r.neto)}
                  </div>
                  <div className="fcp-row-sub">
                    {dif
                      ? `${dif.diferenca > 0 ? "+" : "−"}${money(Math.abs(dif.diferenca))} pa kaluar ende te borxhet`
                      : shenimi.length > 0
                        ? "Kaluar te borxhet"
                        : r.neto === 0
                          ? "Asgjë për të kaluar"
                          : ""}
                    {shenimi.length > 0 && (
                      <>
                        {" · "}
                        <Link to="/borxhet">shiko shënimin</Link>
                      </>
                    )}
                  </div>
                </div>
                <div className={`fcp-row-value ${r.neto > 0 ? "fcp-pos" : r.neto < 0 ? "fcp-neg" : ""}`}>
                  {r.neto > 0 ? `+${money(r.neto)}` : r.neto < 0 ? `−${money(-r.neto)}` : money(0)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {(mesTeTjereve.length > 0 || shlyerjet.length > 0) && (
        <section className="mb-4">
          <h2 className="fcp-section-title">
            <Handshake size={20} className="text-primary" />
            Mes të Tjerëve
          </h2>
          <p className="fcp-row-sub mb-3">
            Borxhet mes të tjerëve, të përmbledhura në sa më pak pagesa. Nuk janë paratë tuaja - shënohen këtu vetëm që
            grupi të dijë kush ka mbetur.
          </p>
          {mesTeTjereve.length > 0 && (
            <div className="fcp-panel mb-3">
              {mesTeTjereve.map((t) => (
                <div className="fcp-row" key={`${t.nga}-${t.te}`}>
                  <div className="fcp-row-main">
                    <div className="fcp-row-title">
                      {emri(t.nga)} → {emri(t.te)}
                    </div>
                  </div>
                  <div className="fcp-row-value me-2">{money(t.vlera)}</div>
                  <Button size="sm" variant="outline-light" onClick={() => shenoShlyerjen(t)}>
                    Shëno të shlyer
                  </Button>
                </div>
              ))}
            </div>
          )}
          {shlyerjet.length > 0 && (
            <div className="fcp-panel">
              {shlyerjet.map((sh) => (
                <div className="fcp-row" key={sh.id}>
                  <div className="fcp-row-icon text-success">
                    <CheckCircle2 size={14} />
                  </div>
                  <div className="fcp-row-main">
                    <div className="fcp-row-title">
                      {emri(sh.nga)} i ktheu {emri(sh.te)}
                    </div>
                    <div className="fcp-row-sub">{formatDate(sh.data)}</div>
                  </div>
                  <div className="fcp-row-value">{money(sh.vlera)}</div>
                  <div className="fcp-debt-entry-actions">
                    <button type="button" className="fcp-icon-action delete" title="Hiq" onClick={() => fshiShlyerjen(sh)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mb-4">
        <h2 className="fcp-section-title">
          <Receipt size={20} className="text-primary" />
          Shpenzimet
        </h2>
        {shpenzimet.length === 0 ? (
          <Empty>Ende asnjë shpenzim. Shtoni faturën e parë - kush pagoi dhe mes kujt ndahet.</Empty>
        ) : (
          <div className="fcp-panel">
            {shpenzimet.map((shp) => {
              const pjeset = pjesetEShpenzimit(shp);
              const ndarja = LLOJET_E_NDARJES.find((l) => l.value === shp.ndarja)?.short || "";
              const lidhur = shp.transaksioniId && transactions.some((t) => t.id === shp.transaksioniId);
              return (
                <div className="fcp-row" key={shp.id}>
                  <div className="fcp-row-main">
                    <div className="fcp-row-title">{shp.pershkrimi || "Pa përshkrim"}</div>
                    <div className="fcp-row-sub">
                      {formatDate(shp.data)} · pagoi {emri(shp.paguesi)} · {ndarja} mes {pjeset.size}
                      {pjeset.has(UNE) ? ` · pjesa juaj ${money(pjeset.get(UNE))}` : " · pa pjesë tuajën"}
                      {lidhur && " · në llogari"}
                    </div>
                  </div>
                  <div className="fcp-row-value">{money(shp.vlera)}</div>
                  <div className="fcp-debt-entry-actions">
                    <button type="button" className="fcp-icon-action edit" title="Ndrysho" onClick={() => onShtoShpenzim(shp)}>
                      <Edit3 size={13} />
                    </button>
                    <button type="button" className="fcp-icon-action delete" title="Fshij" onClick={() => fshiShpenzimin(shp)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {permbledhja.njerezit.length > 0 && permbledhja.totali > 0 && (
        <section className="mb-4">
          <h2 className="fcp-section-title">
            <Users size={20} className="text-primary" />
            Kush Sa
          </h2>
          <div className="fcp-panel">
            {permbledhja.njerezit.map((p) => (
              <div className="fcp-row" key={p.id}>
                <div className="fcp-row-main">
                  <div className="fcp-row-title">{p.emri}</div>
                  <div className="fcp-row-sub">
                    pagoi {money(p.paguar)} · pjesa {money(p.pjesa)}
                  </div>
                </div>
                <div className={`fcp-row-value ${p.paguar - p.pjesa > 0.004 ? "fcp-pos" : p.paguar - p.pjesa < -0.004 ? "fcp-neg" : ""}`}>
                  {p.paguar - p.pjesa >= 0 ? "+" : "−"}
                  {money(Math.abs(p.paguar - p.pjesa))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default Grupet;
