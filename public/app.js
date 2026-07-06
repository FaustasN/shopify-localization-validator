const state = {
  rows: [],
  localeOrder: [],
  filters: {
    search: "",
    locale: "",
    severity: "",
    issue: ""
  }
};

const elements = {
  scanButton: document.querySelector("#scanButton"),
  validateButton: document.querySelector("#validateButton"),
  runStatus: document.querySelector("#runStatus"),
  totalIssues: document.querySelector("#totalIssues"),
  highIssues: document.querySelector("#highIssues"),
  mediumIssues: document.querySelector("#mediumIssues"),
  searchInput: document.querySelector("#searchInput"),
  localeFilter: document.querySelector("#localeFilter"),
  severityFilter: document.querySelector("#severityFilter"),
  issueFilter: document.querySelector("#issueFilter"),
  tableHeader: document.querySelector("#tableHeader"),
  issueRows: document.querySelector("#issueRows"),
  emptyState: document.querySelector("#emptyState"),
  detailPanel: document.querySelector("#detailPanel"),
  closeDetail: document.querySelector("#closeDetail"),
  detailIssue: document.querySelector("#detailIssue"),
  detailProduct: document.querySelector("#detailProduct"),
  detailMessage: document.querySelector("#detailMessage"),
  detailField: document.querySelector("#detailField"),
  detailValue: document.querySelector("#detailValue"),
  detailExpected: document.querySelector("#detailExpected"),
  detailLocales: document.querySelector("#detailLocales")
};

function text(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value == null || value === "") {
    return "";
  }

  return String(value);
}

function escapeHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function severityRank(severity) {
  return {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  }[severity] ?? 4;
}

function setBusy(isBusy, label = "Ready") {
  elements.scanButton.disabled = isBusy;
  elements.validateButton.disabled = isBusy;
  elements.runStatus.textContent = label;
}

function populateSelect(select, values) {
  const currentValue = select.value;
  const first = select.querySelector("option")?.outerHTML ?? '<option value="">All</option>';
  select.innerHTML = first + values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  select.value = values.includes(currentValue) ? currentValue : "";
}

function renderHeader() {
  const staticHeaders = ["Severity", "Locale", "Product", "Field", "Issue"];
  elements.tableHeader.innerHTML = [
    ...staticHeaders.map((label) => `<th>${label}</th>`),
    ...state.localeOrder.map((locale) => `<th>${escapeHtml(locale.toUpperCase())}</th>`),
    "<th>Message</th>"
  ].join("");
}

function renderSummary(summary) {
  elements.totalIssues.textContent = summary.total ?? 0;
  elements.highIssues.textContent = summary.bySeverity?.high ?? 0;
  elements.mediumIssues.textContent = summary.bySeverity?.medium ?? 0;
}

function rowSearchText(row) {
  return [
    row.severity,
    row.locale,
    row.productTitle,
    row.field,
    row.issue,
    row.value,
    row.expected,
    row.message,
    ...Object.values(row.comparedValues ?? {})
  ]
    .map(text)
    .join(" ")
    .toLowerCase();
}

function filteredRows() {
  const search = state.filters.search.trim().toLowerCase();

  return state.rows
    .filter((row) => !state.filters.locale || row.locale === state.filters.locale)
    .filter((row) => !state.filters.severity || row.severity === state.filters.severity)
    .filter((row) => !state.filters.issue || row.issue === state.filters.issue)
    .filter((row) => !search || rowSearchText(row).includes(search))
    .sort((a, b) => {
      return severityRank(a.severity) - severityRank(b.severity) || a.productIndex - b.productIndex || a.locale.localeCompare(b.locale);
    });
}

function renderValueCell(value) {
  const displayValue = text(value);

  if (!displayValue) {
    return '<span class="missing">Missing</span>';
  }

  return `<span class="value-text">${escapeHtml(displayValue)}</span>`;
}

function renderRows() {
  const rows = filteredRows();

  elements.emptyState.hidden = rows.length > 0;
  elements.issueRows.innerHTML = rows
    .map((row, index) => {
      const localeCells = state.localeOrder
        .map((locale) => `<td class="value-cell">${renderValueCell(row.comparedValues?.[locale])}</td>`)
        .join("");

      return `
        <tr data-row-index="${index}">
          <td><span class="badge ${escapeHtml(row.severity)}">${escapeHtml(row.severity)}</span></td>
          <td>${escapeHtml(row.locale.toUpperCase())}</td>
          <td class="product-cell">${escapeHtml(row.productTitle)}</td>
          <td class="field-cell">${escapeHtml(row.field)}</td>
          <td class="issue-cell">${escapeHtml(row.issue)}</td>
          ${localeCells}
          <td>${escapeHtml(row.message)}</td>
        </tr>
      `;
    })
    .join("");

  [...elements.issueRows.querySelectorAll("tr")].forEach((rowElement) => {
    rowElement.addEventListener("click", () => {
      openDetail(rows[Number(rowElement.dataset.rowIndex)]);
    });
  });
}

function renderFilters() {
  populateSelect(elements.localeFilter, [...new Set(state.rows.map((row) => row.locale))].sort());
  populateSelect(elements.severityFilter, [...new Set(state.rows.map((row) => row.severity))].sort((a, b) => severityRank(a) - severityRank(b)));
  populateSelect(elements.issueFilter, [...new Set(state.rows.map((row) => row.issue))].sort());
}

function openDetail(row) {
  elements.detailIssue.textContent = `${row.severity} · ${row.issue}`;
  elements.detailProduct.textContent = row.productTitle;
  elements.detailMessage.textContent = row.message;
  elements.detailField.textContent = row.field;
  elements.detailValue.textContent = text(row.value) || "Missing";
  elements.detailExpected.textContent = text(row.expected) || "Review the populated locale values";
  elements.detailLocales.innerHTML = state.localeOrder
    .map((locale) => {
      const url = row.productUrls?.[locale];
      const title = row.productTitles?.[locale] || locale.toUpperCase();
      const value = row.comparedValues?.[locale];

      return `
        <article class="locale-card">
          <header>
            <strong>${escapeHtml(locale.toUpperCase())}</strong>
            ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open product</a>` : ""}
          </header>
          <p class="eyebrow">${escapeHtml(title)}</p>
          <div>${renderValueCell(value)}</div>
        </article>
      `;
    })
    .join("");
  elements.detailPanel.hidden = false;
}

function closeDetail() {
  elements.detailPanel.hidden = true;
}

function render(statePayload) {
  state.rows = statePayload.rows ?? [];
  state.localeOrder = statePayload.localeOrder ?? [];
  renderHeader();
  renderSummary(statePayload.summary ?? {});
  renderFilters();
  renderRows();
}

async function loadState() {
  const response = await fetch("/api/state");
  const payload = await response.json();

  if (!payload.ok) {
    throw new Error(payload.error ?? "Failed to load state");
  }

  render(payload.state);
}

async function runAction(action) {
  setBusy(true, action === "scan" ? "Scanning..." : "Validating...");

  try {
    const response = await fetch(`/api/${action}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: "{}"
    });
    const payload = await response.json();

    if (!payload.ok) {
      throw new Error(payload.output || payload.error || `${action} failed`);
    }

    render(payload.state);
    setBusy(false, action === "scan" ? "Scan complete" : "Validation complete");
  } catch (error) {
    setBusy(false, error.message);
  }
}

elements.scanButton.addEventListener("click", () => runAction("scan"));
elements.validateButton.addEventListener("click", () => runAction("validate"));
elements.closeDetail.addEventListener("click", closeDetail);
elements.searchInput.addEventListener("input", (event) => {
  state.filters.search = event.target.value;
  renderRows();
});
elements.localeFilter.addEventListener("change", (event) => {
  state.filters.locale = event.target.value;
  renderRows();
});
elements.severityFilter.addEventListener("change", (event) => {
  state.filters.severity = event.target.value;
  renderRows();
});
elements.issueFilter.addEventListener("change", (event) => {
  state.filters.issue = event.target.value;
  renderRows();
});

loadState().catch((error) => {
  elements.runStatus.textContent = error.message;
});
