import { useMemo, useState } from "react";
import { parseISO, isValid, isWithinInterval } from "date-fns";
import { cellText } from "../lib/format";

// Money columns must sort by value rather than alphabetically - "-45.00" is less than "9.00", which
// a string compare gets wrong. `cellText` reads the plain text a `markup()` cell carries, so the
// coloured amounts sort on the number they show rather than on the span around it.
const cellNumber = (value) => {
  const text = cellText(value);
  if (text === "") return null;
  const n = Number(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const compareCells = (a, b) => {
  const na = cellNumber(a);
  const nb = cellNumber(b);
  if (na !== null && nb !== null) return na - nb;
  return cellText(a).localeCompare(cellText(b), "sq");
};

/** Search/sort/paginate/date-filter a flat array of display-row objects. Ported from FinanCare's
 * useSortableData.js - the row-object shape (title-cased Albanian keys) is what Tabela.jsx
 * expects - with a value-aware comparator so numeric columns sort as numbers. */
const useSortableData = (items, config = null, search = "", itemsPerPage = 10, dateField = null, startDate = null, endDate = null) => {
  const [sortConfig, setSortConfig] = useState(config);
  const [currentPage, setCurrentPage] = useState(0);

  const sortData = (key) => {
    let direction = "ascending";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  /**
   * The full result set, worked out once per change rather than once per read. Both the page count
   * and the visible slice come off this; they used to call the pipeline separately, which meant
   * every keystroke in the search box re-ran the date parsing, the sort and the markup-stripping
   * twice over the whole list.
   */
  const processed = useMemo(() => {
    let sortableData = [...items];

    if (dateField && startDate && endDate) {
      // `parseISO` on both ends, not `new Date()` on the range: a bare "YYYY-MM-DD" is parsed as
      // *local* midnight by `parseISO` but as *UTC* midnight by `new Date()`. East of UTC that put
      // the start boundary a few hours after local midnight, so a transaction dated exactly on the
      // start day fell just outside the interval and only appeared once the range was widened by a
      // day.
      const start = parseISO(startDate);
      const end = parseISO(endDate);

      sortableData = sortableData.filter((item) => {
        const itemDate = parseISO(item[dateField]);
        return isValid(itemDate) && isValid(start) && isValid(end) && isWithinInterval(itemDate, { start, end });
      });
    }

    if (sortConfig !== null && sortConfig.key) {
      sortableData.sort((a, b) => {
        const result = compareCells(a[sortConfig.key], b[sortConfig.key]);
        return sortConfig.direction === "ascending" ? result : -result;
      });
    }

    if (search) {
      const query = search.toLowerCase();
      sortableData = sortableData.filter((item) =>
        Object.values(item).some((value) => cellText(value).toLowerCase().includes(query))
      );
    }

    return sortableData;
  }, [items, sortConfig, search, dateField, startDate, endDate]);

  const pageCount = Math.ceil(processed.length / itemsPerPage);

  // Searching or filtering can leave fewer pages than the one being read. Clamping here (rather
  // than resetting on every keystroke) keeps the view on the last page that still has rows instead
  // of rendering a slice past the end of the results - an empty table with a full pager under it.
  const page = Math.min(currentPage, Math.max(pageCount - 1, 0));
  const sliceStart = page * itemsPerPage;
  const visibleItems = processed.slice(sliceStart, sliceStart + itemsPerPage);

  const goToPage = (target) => {
    setCurrentPage(target);
  };

  return {
    items: visibleItems,
    requestSort: sortData,
    sortConfig,
    currentPage: page,
    pageCount,
    goToPage,
    // How many rows survived the search/filter - what the "nga N rezultate" line has to count.
    total: processed.length,
    // Every row that survived, not just the page being shown. Only "select all" needs it: ticking
    // the header box has to mean every row the filters left, or splitting a month across two
    // accounts turns into twenty rows at a time.
    allItems: processed,
  };
};

export default useSortableData;
