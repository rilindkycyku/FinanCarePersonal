import { useState } from "react";
import { parseISO, isValid, isWithinInterval } from "date-fns";

// Cells may carry markup (the coloured amount/type pills), and money columns must sort by value
// rather than alphabetically — "-45.00" is less than "9.00", which a string compare gets wrong.
const cellText = (value) => String(value ?? "").replace(/<[^>]*>/g, "").trim();

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
 * useSortableData.js — the row-object shape (title-cased Albanian keys) is what Tabela.jsx
 * expects — with a value-aware comparator so numeric columns sort as numbers. */
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

  const sortedData = () => {
    let sortableData = [...items];

    if (dateField && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

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
  };

  const pageCount = Math.ceil(sortedData().length / itemsPerPage);

  const sliceStart = currentPage * itemsPerPage;
  const sliceEnd = sliceStart + itemsPerPage;
  const visibleItems = sortedData().slice(sliceStart, sliceEnd);

  const goToPage = (page) => {
    setCurrentPage(page);
  };

  return {
    items: visibleItems,
    requestSort: sortData,
    sortConfig,
    currentPage,
    pageCount,
    goToPage,
  };
};

export default useSortableData;
