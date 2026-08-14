import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Form, Button, Alert, Table } from "react-bootstrap";
import { FileSpreadsheet, Upload, Check, CircleAlert, Wand2, ArrowRight } from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import PunaNeVazhdim from "../Components/PunaNeVazhdim";
import ZgjedhesiKategorive from "../Components/ZgjedhesiKategorive";
import { Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import Zgjedhesi from "../Components/Zgjedhesi";
import { opsionetLlogarive } from "../lib/opsionet";
import { useDialog } from "../Context/DialogContext";
import { makeId, STORES } from "../lib/db";
import { guessMapping, markDuplicates, parseDelimited, rowsToTransactions } from "../lib/csv";
import { mesoRregullen, sugjeroKategorine } from "../lib/rregullat";
import { formatDate } from "../lib/format";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Dashboard.css";
import "./Styles/Personal.css";

const KOLONAT = [
  { celesi: "data", label: "Data", gjithmone: true },
  { celesi: "pershkrimi", label: "Përshkrimi", gjithmone: true },
  { celesi: "vlera", label: "Vlera (një kolonë me shenjë)", vetemNjeKolone: true },
  { celesi: "dalje", label: "Dalje / Debit", vetemDyKolona: true },
  { celesi: "hyrje", label: "Hyrje / Credit", vetemDyKolona: true },
];

/**
 * Reading a bank or card statement into the ledger.
 *
 * The file is parsed in the browser and nothing is written until the last button - everything up to
 * then is the user checking the app's guesses. That order is the whole point: a statement has
 * hundreds of rows, and an import that writes first and asks later is a mess nobody can unpick.
 *
 * Rows already in the ledger are found and unticked, rows that could not be read are shown with the
 * reason rather than quietly skipped, and categories are proposed from what the user has picked
 * before (rregullat.js) and then learned from whatever they correct here.
 */
function ImportoCsv() {
  const { accounts, categories, transactions, profile, saveProfile, saveMany, reload, loading, money, njeLlogari,
    llogariaKryesore } = useData();
  const dialog = useDialog();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null); // { headers, rows, delimiter }
  const [mapping, setMapping] = useState(null);
  const [opsionet, setOpsionet] = useState({ ditaEPare: true, shenjaPerkundert: false });
  const [llogaria, setLlogaria] = useState("");
  const [zgjedhjet, setZgjedhjet] = useState({}); // celesi -> { perfshij, kategoriaId }
  const [mesazhi, setMesazhi] = useState(null);
  const [duke, setDuke] = useState(false);

  const aktive = useMemo(() => accounts.filter((a) => !a.arkivuar), [accounts]);

  /** Candidates rebuilt whenever the file, the mapping or the reading options change. */
  const rreshtat = useMemo(() => {
    if (!parsed || !mapping) return [];
    return markDuplicates(rowsToTransactions(parsed.rows, mapping, opsionet), transactions);
  }, [parsed, mapping, opsionet, transactions]);

  /** The state of one row: what the user chose, or the default the app worked out for it. */
  const zgjedhja = useCallback(
    (rresht) => {
      const ruajtur = zgjedhjet[rresht.celesi] || {};
      return {
        // A duplicate or an unreadable row starts unticked; everything else starts in.
        perfshij: ruajtur.perfshij ?? (!rresht.gabim && !rresht.dublikat),
        kategoriaId:
          ruajtur.kategoriaId ?? (sugjeroKategorine(rresht.pershkrimi, profile, categories, rresht.lloji) || ""),
        // Only the untouched suggestion is labelled as one.
        sugjeruar: ruajtur.kategoriaId === undefined,
      };
    },
    [zgjedhjet, profile, categories]
  );

  const gjendja = useMemo(() => {
    const perfshira = rreshtat.filter((r) => zgjedhja(r).perfshij);
    return {
      gjithsej: rreshtat.length,
      dublikate: rreshtat.filter((r) => r.dublikat).length,
      gabime: rreshtat.filter((r) => r.gabim).length,
      perfshira: perfshira.length,
      paKategori: perfshira.filter((r) => !zgjedhja(r).kategoriaId).length,
      hyrje: perfshira.filter((r) => r.lloji === "hyrje").reduce((s, r) => s + r.vlera, 0),
      shpenzime: perfshira.filter((r) => r.lloji === "shpenzim").reduce((s, r) => s + r.vlera, 0),
    };
  }, [rreshtat, zgjedhja]);

  const vendos = (celesi, fusha) => setZgjedhjet((prev) => ({ ...prev, [celesi]: { ...prev[celesi], ...fusha } }));

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setMesazhi(null);
    try {
      const text = await f.text();
      const lexuar = parseDelimited(text);
      if (lexuar.rows.length === 0) throw new Error("skedari nuk ka asnjë rresht me të dhëna");
      setFile(f);
      setParsed(lexuar);
      setMapping(guessMapping(lexuar.headers, lexuar.rows));
      setZgjedhjet({});
      setLlogaria(njeLlogari ? llogariaKryesore?.id || "" : aktive[0]?.id || "");
    } catch (err) {
      setMesazhi({ type: "danger", text: `Skedari nuk u lexua: ${err.message}` });
    }
  };

  /** Bulk-assigns a category to every included row that still has none. */
  const plotesoKategorine = (kategoriaId) => {
    if (!kategoriaId) return;
    const kategoria = categories.find((c) => c.id === kategoriaId);
    setZgjedhjet((prev) => {
      const i_ri = { ...prev };
      rreshtat
        .filter((r) => zgjedhja(r).perfshij && !zgjedhja(r).kategoriaId && r.lloji === kategoria?.lloji)
        .forEach((r) => {
          i_ri[r.celesi] = { ...i_ri[r.celesi], kategoriaId };
        });
      return i_ri;
    });
  };

  const zgjidhTeGjitha = (perfshij) =>
    setZgjedhjet((prev) => {
      const i_ri = { ...prev };
      rreshtat.filter((r) => !r.gabim).forEach((r) => {
        i_ri[r.celesi] = { ...i_ri[r.celesi], perfshij };
      });
      return i_ri;
    });

  const importo = async () => {
    const perfshira = rreshtat.filter((r) => zgjedhja(r).perfshij);
    if (perfshira.length === 0) return;
    if (!llogaria) {
      setMesazhi({ type: "danger", text: "Zgjidhni llogarinë ku hyjnë këto lëvizje." });
      return;
    }

    const paKategori = perfshira.filter((r) => !zgjedhja(r).kategoriaId).length;
    const ok = await dialog.confirm(
      `Do të regjistrohen ${perfshira.length} transaksione në llogarinë "${
        accounts.find((a) => a.id === llogaria)?.emri
      }"${paKategori > 0 ? `, nga të cilat ${paKategori} pa kategori` : ""}. Vazhdo?`,
      { title: "Konfirmo Importimin", confirmLabel: "Importo" }
    );
    if (!ok) return;

    setDuke(true);
    try {
      const koha = new Date().toISOString();
      const regjistrat = perfshira.map((r) => {
        const { kategoriaId } = zgjedhja(r);
        return {
          id: makeId("tx"),
          data: r.data,
          lloji: r.lloji,
          vlera: r.vlera,
          llogariaId: llogaria,
          llogariaDestinacionId: null,
          kategoriaId: kategoriaId || null,
          pershkrimi: r.pershkrimi,
          shenim: `Importuar nga "${file?.name || "CSV"}" (rreshti ${r.rreshti}).`,
          qellimiId: null,
          perseritjaId: null,
          borxhiId: null,
          planiId: null,
          krijuar: koha,
          monedhaOrigjinale: null,
          vleraOrigjinale: null,
          kursi: null,
        };
      });

      await saveMany(regjistrat.map((tx) => [STORES.transactions, tx]));

      // Whatever was categorised here teaches the memory, so the next statement arrives mostly
      // filled in. Folded in one pass and saved once.
      const rregullaTeReja = regjistrat
        .filter((tx) => tx.kategoriaId && tx.pershkrimi)
        .reduce(
          (profileNeProces, tx) => ({
            ...profileNeProces,
            rregullatKategorive: mesoRregullen(profileNeProces, {
              pershkrimi: tx.pershkrimi,
              kategoriaId: tx.kategoriaId,
              lloji: tx.lloji,
            }),
          }),
          profile
        ).rregullatKategorive;

      await saveProfile({ ...profile, rregullatKategorive: rregullaTeReja });
      await reload();
      navigate("/transaksionet");
    } catch (err) {
      setMesazhi({ type: "danger", text: `Importimi dështoi: ${err.message}` });
      setDuke(false);
    }
  };

  if (loading) return <PageLoading title="Importo nga CSV" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Importo nga CSV" />
      <NavBar />

      <main className="fcp-main">
        {duke && (
          <PunaNeVazhdim
            titulli="Duke regjistruar transaksionet..."
            ndihma="Çdo rresht i zgjedhur po shkruhet në bazë. Ndërprerja tani do të linte gjysmën e ekstraktit brenda."
          />
        )}

        <Container className="py-4">
          <div className="fcp-page-head">
            <div>
              <h1>Importo nga Ekstrakti (CSV)</h1>
              <p>
                Shkarkoni ekstraktin e bankës ose të kartelës si CSV dhe lexojeni këtu. Skedari nuk dërgohet askund -
                lexohet brenda shfletuesit, si çdo gjë tjetër në këtë aplikacion.
              </p>
            </div>
            <Button className="btn-primary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} className="me-1" /> {file ? "Zgjidh skedar tjetër" : "Zgjidh skedarin"}
            </Button>
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={handleFile} />
          </div>

          {mesazhi && (
            <Alert variant={mesazhi.type} onClose={() => setMesazhi(null)} dismissible>
              {mesazhi.text}
            </Alert>
          )}

          {!parsed ? (
            <Card className="profile-card border-0 p-4">
              <h2 className="fcp-card-title fw-bold mb-2">
                <FileSpreadsheet size={18} className="me-2 text-primary" />
                Si funksionon
              </h2>
              <ol className="text-muted small mb-0 ps-3">
                <li>Zgjidhni skedarin CSV të ekstraktit.</li>
                <li>
                  Aplikacioni gjen vetë ndarësin, kolonat e datës, përshkrimit dhe vlerës - dhe ju i korrigjoni nëse e ka
                  gabim.
                </li>
                <li>
                  Rreshtat që i keni tashmë në regjistër shënohen si dublikatë dhe lihen jashtë; rreshtat që nuk lexohen
                  dot shfaqen me arsyen, jo të fshehur.
                </li>
                <li>Kategoritë propozohen nga zgjedhjet tuaja të mëparshme dhe mësohen nga ato që korrigjoni.</li>
                <li>Asgjë nuk regjistrohet derisa ta shtypni butonin e fundit.</li>
              </ol>
            </Card>
          ) : (
            <>
              <Card className="profile-card border-0 p-4 mb-4">
                <h2 className="fcp-card-title fw-bold mb-3">Kolonat</h2>
                <Row className="g-3">
                  {KOLONAT.filter(
                    (k) =>
                      k.gjithmone || (mapping.dyKolona ? k.vetemDyKolona : k.vetemNjeKolone)
                  ).map((k) => (
                    <Form.Group as={Col} md={4} key={k.celesi} controlId={`kolona-${k.celesi}`}>
                      <Form.Label>{k.label}</Form.Label>
                      <Zgjedhesi
                        value={mapping[k.celesi]}
                        onChange={(v) => setMapping((prev) => ({ ...prev, [k.celesi]: Number(v) }))}
                        opsionet={[
                          { value: -1, label: "- asnjë -" },
                          ...parsed.headers.map((h, i) => ({ value: i, label: h })),
                        ]}
                        titulli={`Kolona për "${k.emri}"`}
                      />
                    </Form.Group>
                  ))}

                  <Col md={4} className="d-flex align-items-end">
                    <Form.Check
                      type="switch"
                      id="dy-kolona"
                      label="Dy kolona (dalje / hyrje)"
                      checked={mapping.dyKolona}
                      onChange={(e) => setMapping((prev) => ({ ...prev, dyKolona: e.target.checked }))}
                    />
                  </Col>

                  <Col md={4} className="d-flex align-items-end">
                    <Form.Check
                      type="switch"
                      id="dita-e-pare"
                      label="Data është ditë/muaj/vit"
                      checked={opsionet.ditaEPare}
                      onChange={(e) => setOpsionet((p) => ({ ...p, ditaEPare: e.target.checked }))}
                    />
                  </Col>

                  <Col md={4} className="d-flex align-items-end">
                    <Form.Check
                      type="switch"
                      id="shenja-perkundert"
                      label="Shenja është e kundërt"
                      checked={opsionet.shenjaPerkundert}
                      onChange={(e) => setOpsionet((p) => ({ ...p, shenjaPerkundert: e.target.checked }))}
                    />
                  </Col>

                  {!njeLlogari && (
                    <Form.Group as={Col} md={4} controlId="llogaria-csv">
                      <Form.Label>
                        Llogaria <span className="text-danger">*</span>
                      </Form.Label>
                      <Zgjedhesi
                        value={llogaria}
                        onChange={setLlogaria}
                        opsionet={opsionetLlogarive(aktive)}
                        placeholder="Zgjidh llogarinë..."
                        titulli="Zgjidh llogarinë"
                      />
                    </Form.Group>
                  )}

                  <Form.Group as={Col} md={4} controlId="kategoria-masive">
                    <Form.Label>Plotëso kategorinë që mungon</Form.Label>
                    {/* Always empty: this picker is an action, not a field - it fills the rows
                        below and goes back to offering the whole list. */}
                    <ZgjedhesiKategorive
                      id="kategoria-masive"
                      categories={categories}
                      value=""
                      onChange={plotesoKategorine}
                      placeholder="Zgjidh një kategori..."
                      title="Plotëso kategorinë që mungon"
                    />
                    <div className="fcp-row-sub mt-1">
                      Vendoset vetëm te rreshtat e përfshirë që s&apos;kanë ende kategori dhe që janë të atij lloji.
                    </div>
                  </Form.Group>
                </Row>

                <div className="fcp-row-sub mt-3">
                  {file?.name} · ndarësi &laquo;{parsed.delimiter === "\t" ? "tab" : parsed.delimiter}&raquo; ·{" "}
                  {gjendja.gjithsej} rreshta: <strong>{gjendja.perfshira}</strong> për t&apos;u regjistruar,{" "}
                  {gjendja.dublikate} dublikatë, {gjendja.gabime} të palexueshëm.
                  {gjendja.paKategori > 0 && ` ${gjendja.paKategori} pa kategori.`}
                </div>
                <div className="fcp-row-sub">
                  Gjithsej: <span className="fcp-pos">+{money(gjendja.hyrje)}</span>{" "}
                  <span className="fcp-neg">-{money(gjendja.shpenzime)}</span>
                </div>
              </Card>

              <div className="d-flex gap-2 flex-wrap mb-3">
                <Button size="sm" variant="outline-light" onClick={() => zgjidhTeGjitha(true)}>
                  Përfshi të gjitha
                </Button>
                <Button size="sm" variant="outline-light" onClick={() => zgjidhTeGjitha(false)}>
                  Hiq të gjitha
                </Button>
                <Button className="btn-primary ms-auto" onClick={importo} disabled={duke || gjendja.perfshira === 0}>
                  <Check size={16} className="me-1" />
                  {duke ? "Duke regjistruar..." : `Regjistro ${gjendja.perfshira} transaksione`}
                </Button>
              </div>

              {rreshtat.length === 0 ? (
                <Empty>Asnjë rresht nuk u lexua nga ky skedar.</Empty>
              ) : (
                <div className="table-responsive">
                  <Table className="fcp-csv-table align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th style={{ width: 44 }} />
                        <th>Data</th>
                        <th>Përshkrimi</th>
                        <th>Kategoria</th>
                        <th className="text-end">Vlera</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rreshtat.map((r) => {
                        const z = zgjedhja(r);
                        return (
                          <tr key={r.celesi} className={r.gabim ? "fcp-csv-gabim" : z.perfshij ? "" : "fcp-csv-jashte"}>
                            <td className="fcp-row-sub">{r.rreshti}</td>
                            <td>
                              <Form.Check
                                type="checkbox"
                                aria-label={`Përfshi rreshtin ${r.rreshti}`}
                                checked={z.perfshij}
                                disabled={Boolean(r.gabim)}
                                onChange={(e) => vendos(r.celesi, { perfshij: e.target.checked })}
                              />
                            </td>
                            <td>{r.data ? formatDate(r.data) : <span className="fcp-neg">-</span>}</td>
                            <td>
                              <div className="fcp-row-title">{r.pershkrimi || "-"}</div>
                              {r.gabim && (
                                <div className="fcp-row-sub fcp-neg">
                                  <CircleAlert size={12} className="me-1" />
                                  {r.gabim}: {r.origjinali.join(" | ")}
                                </div>
                              )}
                              {r.dublikat && (
                                <div className="fcp-row-sub">Ekziston tashmë një lëvizje e njëjtë në këtë datë.</div>
                              )}
                            </td>
                            <td style={{ minWidth: 190 }}>
                              {r.gabim ? (
                                <span className="fcp-row-sub">-</span>
                              ) : (
                                <>
                                  <ZgjedhesiKategorive
                                    size="sm"
                                    categories={categories}
                                    lloji={r.lloji}
                                    value={z.kategoriaId}
                                    onChange={(kategoriaId) => vendos(r.celesi, { kategoriaId })}
                                    placeholder="Pa kategori"
                                    emptyLabel="Pa kategori"
                                  />
                                  {z.sugjeruar && z.kategoriaId && (
                                    <div className="fcp-row-sub">
                                      <Wand2 size={11} className="me-1" />
                                      sugjeruar nga zgjedhjet e mëparshme
                                    </div>
                                  )}
                                </>
                              )}
                            </td>
                            <td className={`text-end ${r.lloji === "hyrje" ? "fcp-pos" : "fcp-neg"}`}>
                              {r.vlera === null ? "-" : money(r.vlera)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}

              <div className="d-flex justify-content-end mt-3">
                <Button className="btn-primary" onClick={importo} disabled={duke || gjendja.perfshira === 0}>
                  {duke ? "Duke regjistruar..." : `Regjistro ${gjendja.perfshira} transaksione`}
                  <ArrowRight size={16} className="ms-1" />
                </Button>
              </div>
            </>
          )}
        </Container>
      </main>

      <Footer />
    </div>
  );
}

export default ImportoCsv;
