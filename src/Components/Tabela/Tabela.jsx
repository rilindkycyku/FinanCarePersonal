import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, Col, Form, InputGroup, Pagination, Row, Card } from "react-bootstrap";
import { Plus, Search, Filter, Eraser, Edit3, Trash2, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import EksportoTeDhenat from "./EksportoTeDhenat";
import SortIcon from "./SortIcon";
import useSortableData from "../../Context/useSortableData";
import { cellText, isMarkup } from "../../lib/format";
import "./Tabela.css";

// Cycled across whatever distinct values `filterField` finds, so each one gets a stable,
// visually distinct color - mirrors the colored "Lloji" chip row on FinanCare's own Lista e
// Faturave filter panel.
const PILL_COLORS = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#f43f5e", "#ec4899", "#84cc16", "#3b82f6"];

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
}) {
  // Unique per instance, so the filter labels point at their own controls even if a page ever grows
  // a second table.
  const idBaza = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(mosShfaqPaginimin ? Math.max(data.length, 20) : 20);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterValue, setFilterValue] = useState("");

  // Distinct values of `filterField` present in the data (e.g. every "Lloji" that actually appears
  // in the list), so a pill never offers a choice with zero results. Compared on text content, since
  // that column may render as a coloured pill rather than a bare string.
  const filterOptions = filterField
    ? [...new Set(data.map((d) => cellText(d[filterField])).filter(Boolean))].sort()
    : [];
  const filteredData =
    filterField && filterValue ? data.filter((d) => cellText(d[filterField]) === filterValue) : data;

  const { items, requestSort, sortConfig, currentPage, pageCount, goToPage, total } = useSortableData(
    filteredData,
    null,
    searchQuery,
    mosShfaqPaginimin ? Math.max(data.length, 20) : itemsPerPage,
    dateField,
    startDate ? new Date(startDate) : null,
    endDate ? new Date(endDate) : null
  );

  const headeri = data.length > 0 ? Object.keys(data[0]) : [];
  const filteredHeaders = mosShfaqID ? headeri.filter((header) => header !== "ID") : headeri;

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
  }, [matOverflow, filteredHeaders.length, items.length]);

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
                <p className="text-muted small mb-0">Menaxhoni të dhënat tuaja financiare me saktësi dhe shpejtësi.</p>
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
            <div className="premium-filter-bar mb-3">
              <Row className="g-2 align-items-end">
                <Col md={3} lg={3}>
                  <Form.Label htmlFor={`${idBaza}-kerko`} className="premium-filter-label">
                    <Search size={14} className="me-1" /> Kërko
                  </Form.Label>
                  <InputGroup className="premium-input-group">
                    <Form.Control id={`${idBaza}-kerko`} type="text" placeholder="Filtroni të dhënat..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </InputGroup>
                </Col>

                {dateField && (
                  <Col md={4} lg={4}>
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

                {!mosShfaqPaginimin && (
                  <Col md={2} lg={2}>
                    <Form.Label htmlFor={`${idBaza}-rreshta`} className="premium-filter-label">
                      Rreshta
                    </Form.Label>
                    <Form.Select
                      id={`${idBaza}-rreshta`}
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(parseInt(e.target.value));
                        goToPage(0);
                      }}
                      className="premium-select"
                    >
                      <option value={20}>20 Rreshta</option>
                      <option value={50}>50 Rreshta</option>
                      <option value={100}>100 Rreshta</option>
                    </Form.Select>
                  </Col>
                )}

                <Col md="auto">
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

          <div className="premium-table-scroll-wrap">
            <div ref={scrollRef} className={`premium-table-container ${data.length > 0 ? "" : "d-none"}`}>
              <table className="premium-table mb-0">
                <thead>
                  <tr>
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
                    <tr key={item.ID} className="premium-tr">
                      {filteredHeaders.map((header) => (
                        <td key={`${item.ID}-${header}`} className="premium-td">
                          {header === dateField ? <span className="date-badge">{formatDate(item[header])}</span> : renderCellContent(item[header])}
                        </td>
                      ))}
                      {kaButona && (
                        <td className="text-center premium-td">
                          <div className="d-flex justify-content-center gap-2">
                            {funksionButonShiko && (
                              <button
                                type="button"
                                className="btn-action info"
                                onClick={() => funksionButonShiko(item.ID)}
                                disabled={funksionEshteShikimDisabled?.(item.ID)}
                                title="Shiko"
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
                              >
                                {ikonaButonitExtra2 || <Plus size={16} />}
                              </button>
                            )}
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

export default Tabela;
