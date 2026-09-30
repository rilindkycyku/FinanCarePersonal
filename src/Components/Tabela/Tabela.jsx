import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, Col, Form, InputGroup, Pagination, Row, Card } from "react-bootstrap";
import {
  Plus, Search, Filter, Eraser, Edit3, Trash2, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown,
  SlidersHorizontal, ArrowDownWideNarrow, ArrowUpNarrowWide,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import EksportoTeDhenat from "./EksportoTeDhenat";
import SortIcon from "./SortIcon";
import useSortableData from "../../Context/useSortableData";
import { cellText, isMarkup } from "../../lib/format";
import { emriIDites, grupetSipasDates, planiIKartes, rreshtiNeKarte } from "../../lib/tabela";
import { JAVOR, MUJOR, TREMUJOR, VJETOR, celesiPeriudhes, kufijtePeriudhes, periudhaParaardhese } from "../../lib/periudhat";
import "./Tabela.css";
import Zgjedhesi from "../Zgjedhesi";

/** Quick date-range presets for the "Filtrimi sipas Datës" fields, so "this month" or "last week"
 * is one click instead of typing both ends by hand. Bounds come from `periudhat.js` (the same
 * month/week/quarter/year math the reports use) so "Ky Muaj" here and "Muaji" in a report always
 * agree on where a month starts and ends. Not a controlled value - picking one just writes the two
 * date inputs and the dropdown itself resets, so editing a date by hand afterwards does not fight
 * a stale selection. */
const PERIUDHAT_E_SHPEJTA = [
  // `format(new Date(), ...)`, not `new Date().toISOString()`: the latter converts to UTC, so
  // anyone east of UTC (or travelling further east, e.g. Kosovo to Istanbul) sees "Sot" still
  // pointing at yesterday for the first few hours after local midnight.
  { value: "sot", label: "Sot", gjej: () => { const s = format(new Date(), "yyyy-MM-dd"); return { start: s, end: s }; } },
  { value: "java", label: "Kjo Javë", gjej: () => kufijtePeriudhes(JAVOR, celesiPeriudhes(JAVOR)) },
  { value: "muaji", label: "Ky Muaj", gjej: () => kufijtePeriudhes(MUJOR, celesiPeriudhes(MUJOR)) },
  {
    value: "muaji-kaluar",
    label: "Muaji i Kaluar",
    gjej: () => kufijtePeriudhes(MUJOR, periudhaParaardhese(MUJOR, celesiPeriudhes(MUJOR))),
  },
  { value: "tremujori", label: "Ky Tremujor", gjej: () => kufijtePeriudhes(TREMUJOR, celesiPeriudhes(TREMUJOR)) },
  { value: "viti", label: "Ky Vit", gjej: () => kufijtePeriudhes(VJETOR, celesiPeriudhes(VJETOR)) },
];

// Cycled across whatever distinct values `filterField` finds, so each one gets a stable,
// visually distinct color - mirrors the colored "Lloji" chip row on FinanCare's own Lista e
// Faturave filter panel.
const PILL_COLORS = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#f43f5e", "#ec4899", "#84cc16", "#3b82f6"];

/** The same breakpoint the CSS below 576px uses. Read once on the first render rather than after
 * it, so a phone never draws the wide table for a frame before switching to the cards. */
const TELEFONI = "(max-width: 575.98px)";

function useEshteTelefon() {
  const [eshte, setEshte] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.(TELEFONI)?.matches));
  useEffect(() => {
    const mq = window.matchMedia?.(TELEFONI);
    if (!mq) return undefined;
    const ndrysho = () => setEshte(mq.matches);
    ndrysho();
    mq.addEventListener?.("change", ndrysho);
    return () => mq.removeEventListener?.("change", ndrysho);
  }, []);
  return eshte;
}

function formatDate(dateStr) {
  try {
    if (!dateStr) return "---";
    return format(parseISO(dateStr), "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

/** Ported from FinanCare's Tabela.jsx (search + sort + optional date range + pagination +
 * Excel export + row actions), trimmed to what FinanCarePersonal's list pages need, with a plain
 * date-range input instead of CustomDatePicker so react-datepicker isn't pulled in. `data` is an
 * array of display-row objects - plain objects whose keys are the column headers shown, each with
 * an `ID` field used for row keys and the action callbacks. Cell values may contain markup (the
 * coloured amount/type pills), which the Excel export strips back to plain text. */
function Tabela({
  data,
  tableName,
  kaButona,
  funksionButonShto,
  etiketaButonitShto,
  funksionButonShiko,
  funksionButonEdit,
  funksionButonFshij,
  funksionButonExtra,
  ikonaButonitExtra,
  titulliButonitExtra,
  funksionButonExtra2,
  ikonaButonitExtra2,
  titulliButonitExtra2,
  funksionButonExtra3,
  ikonaButonitExtra3,
  titulliButonitExtra3,
  funksionEshteEditimDisabled,
  funksionEshteShikimDisabled,
  funksionEshteFshirjeDisabled,
  dateField,
  filterField,
  mosShfaqID,
  mosShfaqKerkimin,
  mosShfaqTitullin,
  mosShfaqPaginimin,
  shfaqEksporto,
  kaZgjedhje,
  zgjedhjet,
  funksionZgjedhjes,
  veprimetEZgjedhura,
  kartela,
}) {
  // Unique per instance, so the filter labels point at their own controls even if a page ever grows
  // a second table.
  const idBaza = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(mosShfaqPaginimin ? Math.max(data.length, 20) : 20);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const eshteTelefon = useEshteTelefon();
  // On a phone the filters beyond the search fold away: open, they pushed the first row a full
  // screen down on every visit, to serve the one visit in ten that filters by date.
  const [filtratHapur, setFiltratHapur] = useState(false);
  // One card open at a time, so opening the next one does not leave the list growing behind it.
  const [kartaHapur, setKartaHapur] = useState(null);

  // Distinct values of `filterField` present in the data (e.g. every "Lloji" that actually appears
  // in the list), so a pill never offers a choice with zero results. Compared on text content, since
  // that column may render as a coloured pill rather than a bare string.
  const filterOptions = filterField
    ? [...new Set(data.map((d) => cellText(d[filterField])).filter(Boolean))].sort()
    : [];
  const filteredData =
    filterField && filterValue ? data.filter((d) => cellText(d[filterField]) === filterValue) : data;

  const { items, allItems, requestSort, sortConfig, currentPage, pageCount, goToPage, total } = useSortableData(
    filteredData,
    null,
    searchQuery,
    mosShfaqPaginimin ? Math.max(data.length, 20) : itemsPerPage,
    dateField,
    // Passed as the raw "YYYY-MM-DD" strings, not `new Date(...)`: useSortableData parses them with
    // `parseISO` (local midnight), the same way it parses each row's date field. Wrapping them in
    // `new Date()` here parsed them as UTC midnight instead, which east of UTC put the start boundary
    // a couple of hours after local midnight and silently dropped transactions dated exactly on the
    // start day from the range.
    startDate || null,
    endDate || null
  );

  // What the folded «Filtrat» button counts: whatever is hidden behind it and still narrowing or
  // reordering the list, so a filter left on from last time cannot pass for an empty month.
  const filtraAktive = (startDate || endDate ? 1 : 0) + (sortConfig?.key ? 1 : 0);

  const headeri = data.length > 0 ? Object.keys(data[0]) : [];
  const filteredHeaders = mosShfaqID ? headeri.filter((header) => header !== "ID") : headeri;
  const planiBaze = planiIKartes(headeri, { kartela, dateField });
  // Days only make sense while the list runs in date order; sorted by amount, a heading per row
  // would be all the list was.
  const planiKartes = {
    ...planiBaze,
    grupoSipasDates: planiBaze.grupoSipasDates && (!sortConfig?.key || sortConfig.key === dateField),
  };

  // ── Row selection ─────────────────────────────────────────────────────────
  // The page owns the list of ticked ids; this only reports what was ticked. Keeping it here would
  // mean the actions built on top of it (which live on the page) could not see the selection, and
  // a selection that survives a delete or a filter change would go on naming rows that are gone.
  const teZgjedhurat = new Set(kaZgjedhje ? zgjedhjet || [] : []);
  // "All" means every row the search, the date range and the pills left standing - not just the
  // twenty on screen. Splitting a month across two accounts is the case this is for, and a page at
  // a time would defeat it.
  const idetENjohura = kaZgjedhje ? allItems.map((item) => item.ID) : [];
  const nrTeZgjedhuraNeListe = idetENjohura.filter((id) => teZgjedhurat.has(id)).length;
  const teGjithaZgjedhura = idetENjohura.length > 0 && nrTeZgjedhuraNeListe === idetENjohura.length;
  const disaZgjedhura = nrTeZgjedhuraNeListe > 0 && !teGjithaZgjedhura;

  const kutiaEGjithcka = useRef(null);
  useEffect(() => {
    if (kutiaEGjithcka.current) kutiaEGjithcka.current.indeterminate = disaZgjedhura;
  }, [disaZgjedhura]);

  const ndrysho = (ids) => funksionZgjedhjes?.(ids);

  const kthejeRreshtin = (id) => {
    const tani = new Set(teZgjedhurat);
    if (tani.has(id)) tani.delete(id);
    else tani.add(id);
    ndrysho([...tani]);
  };

  /** Ticks or clears every matching row at once, leaving anything picked under other filters be. */
  const kthejiTeGjitha = () => {
    const tani = new Set(teZgjedhurat);
    if (teGjithaZgjedhura) idetENjohura.forEach((id) => tani.delete(id));
    else idetENjohura.forEach((id) => tani.add(id));
    ndrysho([...tani]);
  };

  // Only what a page deliberately wrapped in `markup()` is HTML; the rest is the text the user
  // typed and is rendered as such, so a name with an "&" or a "<" in it survives the trip.
  const renderCellContent = (content) =>
    isMarkup(content) ? <div dangerouslySetInnerHTML={{ __html: content.html }} /> : <div>{cellText(content)}</div>;

  // The horizontal scrollbar sits under every table, so the "swipe sideways" hint below it is only
  // honest when there is in fact something out of view. Re-measured on resize and whenever the
  // columns or the row count change - hiding a column or filtering down to short rows can take a
  // table that overflowed and make it fit.
  const scrollRef = useRef(null);
  const [teketOverflow, setTeketOverflow] = useState(false);

  const matOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (el) setTeketOverflow(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useEffect(() => {
    matOverflow();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", matOverflow);
      return () => window.removeEventListener("resize", matOverflow);
    }
    const observer = new ResizeObserver(matOverflow);
    if (scrollRef.current) observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, [matOverflow, filteredHeaders.length, items.length, eshteTelefon]);

  /** The row's buttons, shared by the table's last column and an opened card. */
  const renderVeprimet = (item) => (
    <>
      {funksionButonShiko && (
        <button
          type="button"
          className="btn-action info"
          onClick={() => funksionButonShiko(item.ID)}
          disabled={funksionEshteShikimDisabled?.(item.ID)}
          title="Shiko"
          aria-label="Shiko"
        >
          <Eye size={16} />
        </button>
      )}
      {funksionButonEdit && (
        <button
          type="button"
          className="btn-action edit"
          onClick={() => funksionButonEdit(item.ID)}
          disabled={funksionEshteEditimDisabled?.(item.ID)}
          title="Ndrysho"
          aria-label="Ndrysho"
        >
          <Edit3 size={16} />
        </button>
      )}
      {funksionButonFshij && (
        <button
          type="button"
          className="btn-action delete"
          onClick={() => funksionButonFshij(item.ID)}
          disabled={funksionEshteFshirjeDisabled?.(item.ID)}
          title="Fshij"
          aria-label="Fshij"
        >
          <Trash2 size={16} />
        </button>
      )}
      {funksionButonExtra && (
        <button
          type="button"
          className="btn-action status"
          onClick={() => funksionButonExtra(item.ID)}
          title={titulliButonitExtra || "Veprim"}
          aria-label={titulliButonitExtra || "Veprim"}
        >
          {ikonaButonitExtra || <Plus size={16} />}
        </button>
      )}
      {/* A second slot, because a row can have two actions that are neither
          editing nor deleting - Transaksionet wants both "repeat this one"
          and "its invoice photos". */}
      {funksionButonExtra2 && (
        <button
          type="button"
          className="btn-action info"
          onClick={() => funksionButonExtra2(item.ID)}
          title={titulliButonitExtra2 || "Veprim"}
          aria-label={titulliButonitExtra2 || "Veprim"}
        >
          {ikonaButonitExtra2 || <Plus size={16} />}
        </button>
      )}
      {/* A third slot, for an action that is a *toggle*: its icon and its
          title are read per row, and a row the action does not apply to
          returns nothing and gets no button. */}
      {funksionButonExtra3 &&
        (() => {
          const ikona =
            typeof ikonaButonitExtra3 === "function"
              ? ikonaButonitExtra3(item.ID)
              : ikonaButonitExtra3;
          if (!ikona) return null;
          const titulli =
            typeof titulliButonitExtra3 === "function"
              ? titulliButonitExtra3(item.ID)
              : titulliButonitExtra3;
          return (
            <button
              type="button"
              className="btn-action status"
              onClick={() => funksionButonExtra3(item.ID)}
              title={titulli || "Veprim"}
              aria-label={titulli || "Veprim"}
            >
              {ikona}
            </button>
          );
        })()}
    </>
  );

  /** A header cell doubles as the sort control, so it answers the keyboard as a button would. */
  const onHeaderKeyDown = (header) => (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      requestSort(header);
    }
  };

  return (
    <div className="tabela-premium-wrapper p-2">
      <Card className="premium-main-card">
        <Card.Body className="p-3">
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            {!mosShfaqTitullin && (
              <div>
                <h2 className="premium-table-title mb-1">{tableName}</h2>
                <p className="text-muted small mb-0 d-none d-sm-block">Menaxhoni të dhënat tuaja financiare me saktësi dhe shpejtësi.</p>
              </div>
            )}

            <div className="d-flex align-items-center gap-2 flex-wrap ms-auto">
              {funksionButonShto && (
                <Button variant="primary" className="btn-premium-shto" onClick={() => funksionButonShto()}>
                  <Plus size={18} className="me-2" />
                  {etiketaButonitShto || "Shto të Re"}
                </Button>
              )}

              {shfaqEksporto !== false && data.length > 0 && <EksportoTeDhenat teDhenatJSON={data} emriDokumentit={tableName} />}
            </div>
          </div>

          {!mosShfaqKerkimin && (
            <div className={`premium-filter-bar mb-3${filtratHapur ? " hapur" : ""}`}>
              <Row className="g-2 align-items-end">
                <Col md={3} lg={3}>
                  <Form.Label htmlFor={`${idBaza}-kerko`} className="premium-filter-label">
                    <Search size={14} className="me-1" /> Kërko
                  </Form.Label>
                  <div className="d-flex gap-2">
                    <InputGroup className="premium-input-group">
                      <Form.Control id={`${idBaza}-kerko`} type="text" placeholder="Filtroni të dhënat..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </InputGroup>
                    {/* Phones only - wider screens have the room to leave every filter out. */}
                    <button
                      type="button"
                      className={`premium-filter-toggle d-sm-none${filtratHapur ? " hapur" : ""}`}
                      onClick={() => setFiltratHapur((h) => !h)}
                      aria-expanded={filtratHapur}
                      aria-controls={`${idBaza}-filtrat`}
                    >
                      <SlidersHorizontal size={15} />
                      <span>Filtrat</span>
                      {filtraAktive > 0 && <span className="premium-filter-toggle-nr">{filtraAktive}</span>}
                    </button>
                  </div>
                </Col>

                {eshteTelefon && (
                  <Col xs={12} className="premium-filter-shtese" id={`${idBaza}-filtrat`}>
                    <Form.Label htmlFor={`${idBaza}-renditja`} className="premium-filter-label">
                      Renditja
                    </Form.Label>
                    {/* The column headers are the sort control on the table; the cards have none, so
                        the same choice lives here. */}
                    <div className="d-flex gap-2">
                      <div className="flex-grow-1">
                        <Zgjedhesi
                          id={`${idBaza}-renditja`}
                          value={sortConfig?.key || ""}
                          onChange={(v) => {
                            requestSort(v || null, v ? sortConfig?.direction || "descending" : undefined);
                            goToPage(0);
                          }}
                          opsionet={filteredHeaders.map((h) => ({ value: h, label: h }))}
                          emptyLabel="Si janë"
                          placeholder="Si janë"
                          titulli="Rendit sipas"
                        />
                      </div>
                      {sortConfig?.key && (
                        <button
                          type="button"
                          className="premium-filter-toggle"
                          onClick={() =>
                            requestSort(sortConfig.key, sortConfig.direction === "ascending" ? "descending" : "ascending")
                          }
                          aria-label={sortConfig.direction === "ascending" ? "Rritës - kthe në zbritës" : "Zbritës - kthe në rritës"}
                          title={sortConfig.direction === "ascending" ? "Nga më i vogli" : "Nga më i madhi"}
                        >
                          {sortConfig.direction === "ascending" ? <ArrowUpNarrowWide size={16} /> : <ArrowDownWideNarrow size={16} />}
                        </button>
                      )}
                    </div>
                  </Col>
                )}

                {dateField && (
                  <Col md={4} lg={4} className="premium-filter-shtese">
                    {/* One heading over two inputs, so the heading cannot be the label for either of
                        them - each says which end of the range it is on its own. */}
                    <Form.Label as="div" className="premium-filter-label">
                      <Filter size={14} className="me-1" /> Filtrimi sipas Datës
                    </Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Control aria-label="Data nga" className="premium-select" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                      <Form.Control aria-label="Data deri" className="premium-select" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </Col>
                )}

                {dateField && (
                  <Col md={2} lg={2} className="premium-filter-shtese">
                    <Form.Label htmlFor={`${idBaza}-periudha`} className="premium-filter-label">
                      Periudha
                    </Form.Label>
                    <Zgjedhesi
                      id={`${idBaza}-periudha`}
                      value=""
                      onChange={(v) => {
                        const preset = PERIUDHAT_E_SHPEJTA.find((p) => p.value === v);
                        if (!preset) return;
                        const { start, end } = preset.gjej();
                        setStartDate(start);
                        setEndDate(end);
                        goToPage(0);
                      }}
                      opsionet={PERIUDHAT_E_SHPEJTA}
                      placeholder="Zgjidh periudhën..."
                      titulli="Zgjidh periudhën"
                    />
                  </Col>
                )}

                {!mosShfaqPaginimin && (
                  <Col md={2} lg={2} className="premium-filter-shtese">
                    <Form.Label htmlFor={`${idBaza}-rreshta`} className="premium-filter-label">
                      Rreshta
                    </Form.Label>
                    <Zgjedhesi
                      id={`${idBaza}-rreshta`}
                      value={itemsPerPage}
                      onChange={(v) => {
                        setItemsPerPage(parseInt(v, 10));
                        goToPage(0);
                      }}
                      opsionet={[20, 50, 100].map((n) => ({ value: n, label: `${n} Rreshta` }))}
                      titulli="Sa rreshta për faqe"
                    />
                  </Col>
                )}

                <Col md="auto" className="premium-filter-shtese">
                  <Button
                    variant="light"
                    className="btn-premium-pastro"
                    onClick={() => {
                      setSearchQuery("");
                      requestSort(null);
                      goToPage(0);
                      setStartDate("");
                      setEndDate("");
                      setFilterValue("");
                    }}
                  >
                    <Eraser size={16} className="me-2" /> Pastro Filtrat
                  </Button>
                </Col>
              </Row>

              {filterField && filterOptions.length > 0 && (
                <div className="premium-filter-pills-wrap">
                  <Form.Label className="premium-filter-label d-block mb-2">{filterField}:</Form.Label>
                  <div className="premium-filter-pills">
                    <button
                      type="button"
                      className={`premium-filter-pill${filterValue === "" ? " active" : ""}`}
                      style={{ "--pill-color": "var(--sp-emerald)" }}
                      onClick={() => {
                        setFilterValue("");
                        goToPage(0);
                      }}
                    >
                      Të gjitha
                    </button>
                    {filterOptions.map((opt, i) => (
                      <button
                        key={opt}
                        type="button"
                        className={`premium-filter-pill${filterValue === opt ? " active" : ""}`}
                        style={{ "--pill-color": PILL_COLORS[i % PILL_COLORS.length] }}
                        onClick={() => {
                          setFilterValue(opt);
                          goToPage(0);
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {kaZgjedhje && teZgjedhurat.size > 0 && (
            <div className="premium-selection-bar mb-3">
              <span className="premium-selection-count">
                {teZgjedhurat.size} {teZgjedhurat.size === 1 ? "i zgjedhur" : "të zgjedhur"}
              </span>
              {veprimetEZgjedhura}
              <Button variant="link" size="sm" className="premium-selection-clear" onClick={() => ndrysho([])}>
                Hiq zgjedhjen
              </Button>
            </div>
          )}

          {eshteTelefon ? (
            total > 0 && (
              <ListaEKartave
                items={items}
                plani={planiKartes}
                kartela={kartela}
                kaButona={kaButona}
                renderVeprimet={renderVeprimet}
                kaZgjedhje={kaZgjedhje}
                teZgjedhurat={teZgjedhurat}
                kthejeRreshtin={kthejeRreshtin}
                kthejiTeGjitha={kthejiTeGjitha}
                teGjithaZgjedhura={teGjithaZgjedhura}
                disaZgjedhura={disaZgjedhura}
                nrNeListe={idetENjohura.length}
                kartaHapur={kartaHapur}
                setKartaHapur={setKartaHapur}
              />
            )
          ) : (
            <div className="premium-table-scroll-wrap">
              <div ref={scrollRef} className={`premium-table-container ${data.length > 0 ? "" : "d-none"}`}>
                <table className="premium-table mb-0">
                  <thead>
                    <tr>
                      {kaZgjedhje && (
                        <th className="premium-th premium-th-zgjedhje">
                          <input
                            ref={kutiaEGjithcka}
                            type="checkbox"
                            className="form-check-input"
                            checked={teGjithaZgjedhura}
                            onChange={kthejiTeGjitha}
                            disabled={idetENjohura.length === 0}
                            aria-label="Zgjidh të gjitha rreshtat e filtruar"
                            title="Zgjidh të gjitha rreshtat që lanë filtrat"
                          />
                        </th>
                      )}
                      {filteredHeaders.map((header) => (
                        <th
                          key={header}
                          onClick={() => requestSort(header)}
                          onKeyDown={onHeaderKeyDown(header)}
                          className="premium-th"
                          tabIndex={0}
                          aria-sort={
                            sortConfig?.key === header
                              ? sortConfig.direction === "ascending"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                          title={`Rendit sipas "${header}"`}
                        >
                          <div className="d-flex align-items-center justify-content-between">
                            <span>{header}</span>
                            <span className="th-sort-icon">
                              {sortConfig?.key === header ? <SortIcon direction={sortConfig.direction} type="text" /> : <SortIcon />}
                            </span>
                          </div>
                        </th>
                      ))}
                      {kaButona && <th className="premium-th text-center">Veprime</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.ID} className={`premium-tr${teZgjedhurat.has(item.ID) ? " e-zgjedhur" : ""}`}>
                        {kaZgjedhje && (
                          <td className="premium-td premium-td-zgjedhje">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={teZgjedhurat.has(item.ID)}
                              onChange={() => kthejeRreshtin(item.ID)}
                              aria-label="Zgjidh këtë rresht"
                            />
                          </td>
                        )}
                        {filteredHeaders.map((header) => (
                          <td key={`${item.ID}-${header}`} className="premium-td">
                            {header === dateField ? <span className="date-badge">{formatDate(item[header])}</span> : renderCellContent(item[header])}
                          </td>
                        ))}
                        {kaButona && (
                          <td className="text-center premium-td">
                            <div className="d-flex justify-content-center gap-2">
                              {renderVeprimet(item)}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {teketOverflow && <div className="premium-scroll-hint">← Rrëshqit për të parë më shumë →</div>}
            </div>
          )}

          {/* `total` and not `data.length`: a search that matches nothing still leaves rows in
              `data`, and without this the table showed an empty grid with no explanation. */}
          {total === 0 && (
            <div className="premium-empty-state">
              <div className="empty-icon-wrapper">
                <Search size={48} />
              </div>
              <h3 className="fcp-card-title">Nuk u gjet asnjë të dhënë</h3>
              <p>Provoni të ndryshoni filtrat ose të shtoni të dhëna të reja.</p>
            </div>
          )}

          {total > 0 && !mosShfaqPaginimin && (
            <div className="premium-pagination-wrapper mt-4">
              <div className="pagination-info">
                Duke shfaqur <strong>{currentPage * itemsPerPage + 1}</strong> deri <strong>{Math.min((currentPage + 1) * itemsPerPage, total)}</strong> nga {total} rezultate
              </div>
              {pageCount > 1 && (
                <Pagination className="premium-pagination">
                  <Pagination.First onClick={() => goToPage(0)} disabled={currentPage === 0}>
                    <ChevronsLeft size={16} />
                  </Pagination.First>
                  <Pagination.Prev onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0}>
                    <ChevronLeft size={16} />
                  </Pagination.Prev>

                  {Array.from({ length: pageCount }, (_, i) => i).reduce((elements, pageNum) => {
                    const isCurrentPage = pageNum === currentPage;
                    if (pageNum === 0 || pageNum === pageCount - 1 || Math.abs(pageNum - currentPage) <= 1) {
                      elements.push(
                        <Pagination.Item key={pageNum} active={isCurrentPage} onClick={() => goToPage(pageNum)}>
                          {pageNum + 1}
                        </Pagination.Item>
                      );
                    } else if (elements.length > 0 && elements[elements.length - 1].type !== Pagination.Ellipsis) {
                      elements.push(<Pagination.Ellipsis key={`el-${pageNum}`} disabled />);
                    }
                    return elements;
                  }, [])}

                  <Pagination.Next onClick={() => goToPage(currentPage + 1)} disabled={currentPage === pageCount - 1}>
                    <ChevronRight size={16} />
                  </Pagination.Next>
                  <Pagination.Last onClick={() => goToPage(pageCount - 1)} disabled={currentPage === pageCount - 1}>
                    <ChevronsRight size={16} />
                  </Pagination.Last>
                </Pagination>
              )}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

/** A cell drawn inline: a page's `markup()` as HTML, anything else as the text the user typed. */
function Qeliza({ vlera, className }) {
  return isMarkup(vlera) ? (
    <span className={className} dangerouslySetInnerHTML={{ __html: vlera.html }} />
  ) : (
    <span className={className}>{cellText(vlera)}</span>
  );
}

/**
 * The list as cards, below 576px. Same rows, same page, same order as the table - only drawn so
 * that the name and the amount of a row sit on one line and nothing hides off to the right. A
 * date-sorted list (`kartela.grupoSipasDates`) is cut into days under a heading, which on its own
 * takes a column's width off every card; each day is one box with a hairline between its rows, so
 * a busy day costs a line per purchase and not a card's margins per purchase.
 */
function ListaEKartave({
  items, plani, kartela, kaButona, renderVeprimet, kaZgjedhje, teZgjedhurat, kthejeRreshtin, kthejiTeGjitha,
  teGjithaZgjedhura, disaZgjedhura, nrNeListe, kartaHapur, setKartaHapur,
}) {
  const kutia = useRef(null);
  useEffect(() => {
    if (kutia.current) kutia.current.indeterminate = disaZgjedhura;
  }, [disaZgjedhura]);

  const sot = format(new Date(), "yyyy-MM-dd");
  const grupet = plani.grupoSipasDates ? grupetSipasDates(items, plani.dateField) : [{ data: "", rreshtat: items }];

  return (
    <div className="premium-kartat">
      {kaZgjedhje && (
        <label className="premium-kartat-te-gjitha">
          <input
            ref={kutia}
            type="checkbox"
            className="form-check-input"
            checked={teGjithaZgjedhura}
            onChange={kthejiTeGjitha}
            disabled={nrNeListe === 0}
          />
          Zgjidh të gjitha ({nrNeListe})
        </label>
      )}
      {grupet.map((g, i) => (
        <section className="premium-kartat-grupi" key={`${g.data}-${i}`}>
          {plani.grupoSipasDates && <h3 className="premium-kartat-dita">{emriIDites(g.data, sot)}</h3>}
          <div className="premium-kartat-kuti">
            {g.rreshtat.map((item) => (
              <Karta
                key={item.ID}
                item={item}
                plani={plani}
                shenjat={kartela?.shenjat?.(item)}
                veprimet={kaButona ? renderVeprimet(item) : null}
                kaZgjedhje={kaZgjedhje}
                zgjedhur={teZgjedhurat.has(item.ID)}
                onZgjidh={() => kthejeRreshtin(item.ID)}
                hapur={kartaHapur === item.ID}
                onKthe={() => setKartaHapur((h) => (h === item.ID ? null : item.ID))}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Karta({ item, plani, shenjat, veprimet, kaZgjedhje, zgjedhur, onZgjidh, hapur, onKthe }) {
  const r = rreshtiNeKarte(item, plani);
  const hapet = r.detajet.length > 0 || Boolean(veprimet);
  // A div standing in for a button rather than a <button>: the cells are the pages' markup, and a
  // place pin is a link, which a button is not allowed to hold.
  const shtypja = hapet
    ? {
        role: "button",
        tabIndex: 0,
        "aria-expanded": hapur,
        onClick: (e) => {
          if (e.target.closest("a")) return;
          onKthe();
        },
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onKthe();
          }
        },
      }
    : {};

  return (
    <div className={`premium-karta${hapur ? " hapur" : ""}${zgjedhur ? " e-zgjedhur" : ""}`}>
      <div className="premium-karta-koka">
        {kaZgjedhje && (
          <input
            type="checkbox"
            className="form-check-input premium-karta-kutia"
            checked={zgjedhur}
            onChange={onZgjidh}
            aria-label="Zgjidh këtë rresht"
          />
        )}
        <div className={`premium-karta-trupi${hapet ? " hapet" : ""}`} {...shtypja}>
          <div className="premium-karta-rreshti">
            <Qeliza vlera={item[r.titulliKolona]} className="premium-karta-titulli" />
            {plani.vlera && <Qeliza vlera={item[plani.vlera]} className="premium-karta-vlera" />}
            {hapet && <ChevronDown size={15} className="premium-karta-shigjeta" aria-hidden="true" />}
          </div>
          {(r.dataNeRresht || shenjat || r.nentitulli.length > 0) && (
            <div className="premium-karta-meta">
              {r.dataNeRresht && <span className="date-badge">{formatDate(item[plani.dateField])}</span>}
              {shenjat}
              {r.nentitulli.map((h) => (
                <Qeliza key={h} vlera={item[h]} className="premium-karta-meta-pjesa" />
              ))}
            </div>
          )}
        </div>
      </div>
      {hapur && (
        <div className="premium-karta-detajet">
          {r.detajet.length > 0 && (
            <dl>
              {r.detajet.map((h) => (
                <div key={h}>
                  <dt>{h}</dt>
                  <dd>
                    <Qeliza vlera={item[h]} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {veprimet && <div className="premium-karta-veprimet">{veprimet}</div>}
        </div>
      )}
    </div>
  );
}

export default Tabela;
