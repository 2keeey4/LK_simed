let filtersVisible = false;

let trendChart = null;
let orgChart = null;
let statusPeriodChart = null;

let estimateTimer = null;
let estimateAbortController = null;

let requestsCurrentPage = 1;
let requestsPageSize = 10;

document.addEventListener("DOMContentLoaded", () => {
    initFilterPanel();
    initDropdowns();
    initSearch();
    initRowClicks();
    initAnalyticsToggle();
    initReportExport();

    initCreateRequestModal();
    initCreateRequestSubmit();
    initCreateOrgBranch();
    initEstimateEvents();
    initCustomSelects();

    initFilterCascading();
    initRequestsPagination();

    setTimeout(() => {
        applyFilters(false);
    }, 100);
});

/* =========================
   FILTER PANEL
========================= */

function initFilterPanel() {
    const btn = document.getElementById("toggleFiltersBtn");
    const panel = document.getElementById("filtersPanel");
    const applyBtn = document.getElementById("applyFiltersBtn");
    const clearBtn = document.getElementById("clearFiltersBtn");

    if (!btn || !panel) return;

    btn.addEventListener("click", () => {
        filtersVisible = !filtersVisible;
        panel.classList.toggle("hidden", !filtersVisible);
        btn.textContent = filtersVisible ? "Скрыть фильтры" : "Фильтры";
    });

    applyBtn?.addEventListener("click", () => applyFilters(true));
    clearBtn?.addEventListener("click", clearFilters);
}

/* =========================
   DROPDOWNS
========================= */

function initDropdowns() {
    document.querySelectorAll(".dropdown-toggle").forEach(toggle => {
        toggle.addEventListener("click", e => {
            e.stopPropagation();

            const menu = toggle.nextElementSibling;
            if (!menu) return;

            closeAllDropdowns(menu);
            menu.classList.toggle("hidden");
        });
    });

    document.addEventListener("click", e => {
        if (!e.target.closest(".dropdown")) {
            closeAllDropdowns(null);
        }
    });

    document.querySelectorAll(".dropdown-menu").forEach(menu => {
        bindDropdownMenu(menu);
        updateDropdownLabel(menu);
    });
}

function bindDropdownMenu(menu) {
    const all = menu.querySelector('input[value="all"]');
    const items = menu.querySelectorAll('input:not([value="all"])');

    if (all) {
        all.addEventListener("change", e => {
            e.stopPropagation();

            if (all.checked) {
                items.forEach(item => {
                    if (!item.disabled) {
                        item.checked = false;
                    }
                });
            }

            updateDropdownLabel(menu);
        });
    }

    items.forEach(item => {
        item.addEventListener("change", e => {
            e.stopPropagation();

            if (item.checked && all) {
                all.checked = false;
            }

            const hasChecked = [...items].some(x => x.checked && !x.disabled);

            if (!hasChecked && all) {
                all.checked = true;
            }

            updateDropdownLabel(menu);
        });
    });
}

function closeAllDropdowns(except) {
    document.querySelectorAll(".dropdown-menu").forEach(menu => {
        if (menu !== except) {
            menu.classList.add("hidden");
        }
    });
}

function updateDropdownLabel(menu) {
    const toggle = menu.previousElementSibling;
    if (!toggle) return;

    const all = menu.querySelector('input[value="all"]');
    const checked = [...menu.querySelectorAll('input:not([value="all"]):checked')]
        .filter(x => !x.disabled);

    toggle.classList.toggle("has-filter", checked.length > 0);

    if (all && all.checked) {
        toggle.textContent = getDefaultDropdownText(toggle.id);
        return;
    }

    if (checked.length === 0) {
        toggle.textContent = "Не выбрано";
        return;
    }

    if (checked.length <= 2) {
        toggle.textContent = checked
            .map(cb => cb.parentElement.textContent.trim())
            .join(", ");
        return;
    }

    toggle.textContent = `Выбрано (${checked.length})`;
}

function getDefaultDropdownText(toggleId) {
    if (toggleId.includes("org")) return "Все организации";
    if (toggleId.includes("branch")) return "Все филиалы";
    if (toggleId.includes("product")) return "Все продукты";
    if (toggleId.includes("client")) return "Все клиенты";
    if (toggleId.includes("status")) return "Все статусы";

    return "Все";
}

/* =========================
   FILTER CASCADE
========================= */

function initFilterCascading() {
    document.querySelectorAll(".filter-org").forEach(cb => {
        cb.addEventListener("change", () => {
            updateBranchFilterOptions();
            updateProductFilterOptions();
            updateClientFilterOptions();
        });
    });

    document.querySelectorAll(".filter-branch").forEach(cb => {
        cb.addEventListener("change", () => {
            updateClientFilterOptions();
        });
    });
}

function updateBranchFilterOptions() {
    const selectedOrgs = getCheckedValues(".filter-org").map(Number);
    const menu = document.getElementById("branchFilterMenu");

    if (!menu) return;

    const all = menu.querySelector('input[value="all"]');
    const items = menu.querySelectorAll(".filter-branch");

    if (selectedOrgs.length === 0) {
        items.forEach(item => setFilterOptionAvailable(item, true));
        if (all) all.checked = true;
        updateDropdownLabel(menu);
        return;
    }

    const allowedBranchIds = new Set();

    selectedOrgs.forEach(orgId => {
        (window.allBranches || [])
            .filter(branch => Number(branch.organizationId) === orgId)
            .forEach(branch => allowedBranchIds.add(Number(branch.id)));
    });

    items.forEach(item => {
        const available = allowedBranchIds.has(Number(item.value));
        setFilterOptionAvailable(item, available);
    });

    const hasChecked = [...items].some(item => item.checked && !item.disabled);
    if (all) all.checked = !hasChecked;

    updateDropdownLabel(menu);
}

function updateProductFilterOptions() {
    const selectedOrgs = getCheckedValues(".filter-org").map(Number);
    const menu = document.getElementById("productFilterMenu");

    if (!menu || !window.organizationProducts) return;

    const all = menu.querySelector('input[value="all"]');
    const items = menu.querySelectorAll(".filter-product");

    if (selectedOrgs.length === 0) {
        items.forEach(item => setFilterOptionAvailable(item, true));
        if (all) all.checked = true;
        updateDropdownLabel(menu);
        return;
    }

    const allowedProductIds = new Set();

    selectedOrgs.forEach(orgId => {
        const ids = window.organizationProducts[String(orgId)] || window.organizationProducts[orgId] || [];
        ids.forEach(id => allowedProductIds.add(Number(id)));
    });

    items.forEach(item => {
        const available = allowedProductIds.size === 0 || allowedProductIds.has(Number(item.value));
        setFilterOptionAvailable(item, available);
    });

    const hasChecked = [...items].some(item => item.checked && !item.disabled);
    if (all) all.checked = !hasChecked;

    updateDropdownLabel(menu);
}

function updateClientFilterOptions() {
    const menu = document.getElementById("clientFilterMenu");

    if (!menu) return;

    const selectedOrgs = getCheckedValues(".filter-org").map(Number);
    const selectedBranches = getCheckedValues(".filter-branch").map(Number);

    const all = menu.querySelector('input[value="all"]');
    const items = menu.querySelectorAll(".filter-client");

    if (selectedOrgs.length === 0 && selectedBranches.length === 0) {
        items.forEach(item => setFilterOptionAvailable(item, true));
        if (all) all.checked = true;
        updateDropdownLabel(menu);
        return;
    }

    const branchOrgIds = [];

    selectedBranches.forEach(branchId => {
        const branch = (window.allBranches || []).find(x => Number(x.id) === branchId);
        if (branch?.organizationId) {
            branchOrgIds.push(Number(branch.organizationId));
        }
    });

    const allowedOrgIds = [...new Set([...selectedOrgs, ...branchOrgIds])];

    items.forEach(item => {
        const user = (window.allUsers || []).find(x => x.fullName === item.value);
        let available = false;

        if (user) {
            const userOrgIds = (user.organizations || []).map(Number);
            const userBranchIds = (user.branches || []).map(Number);

            available = allowedOrgIds.some(id => userOrgIds.includes(id));

            if (available && selectedBranches.length > 0) {
                available = selectedBranches.some(id => userBranchIds.includes(id));
            }
        }

        setFilterOptionAvailable(item, available);
    });

    const hasChecked = [...items].some(item => item.checked && !item.disabled);
    if (all) all.checked = !hasChecked;

    updateDropdownLabel(menu);
}

function setFilterOptionAvailable(input, available) {
    input.disabled = !available;

    const label = input.closest("label");
    if (label) {
        label.classList.toggle("disabled", !available);
    }

    if (!available) {
        input.checked = false;
    }
}

/* =========================
   SEARCH + FILTERING
========================= */

function initSearch() {
    const input = document.getElementById("searchInput");

    if (!input) return;

    input.addEventListener("input", () => {
        input.classList.toggle("active", input.value.trim().length > 0);
        applyFilters(false);
    });
}

function applyFilters(showMessage = true) {
    const filters = collectFilters();
    const search = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();

    const orgNames = getSelectedNames(".filter-org");
    const branchNames = getSelectedNames(".filter-branch");
    const productNames = getSelectedNames(".filter-product");

    document.querySelectorAll("#requestsTable tbody tr").forEach(row => {
        const item = getRowData(row);
        let visible = true;

        if (search) {
            const searchArea = `${item.title} ${item.topic} ${item.org} ${item.branch} ${item.product} ${item.client}`.toLowerCase();

            if (!searchArea.includes(search)) {
                visible = false;
            }
        }

        if (visible && filters.orgs.length > 0) {
            visible = filters.orgs.some(id => item.org === orgNames[id]);
        }

        if (visible && filters.branches.length > 0) {
            visible = filters.branches.some(id => item.branch === branchNames[id]);
        }

        if (visible && filters.products.length > 0) {
            visible = filters.products.some(id => item.product === productNames[id]);
        }

        if (visible && filters.statuses.length > 0) {
            visible = filters.statuses.includes(item.status);
        }

        if (visible && filters.clients.length > 0) {
            visible = filters.clients.includes(item.client);
        }

        if (visible && item.date) {
            const currentDate = parseRuDate(item.date);

            if (currentDate) {
                if (filters.startDate) {
                    const start = new Date(filters.startDate);
                    start.setHours(0, 0, 0, 0);

                    if (currentDate < start) {
                        visible = false;
                    }
                }

                if (visible && filters.endDate) {
                    const end = new Date(filters.endDate);
                    end.setHours(23, 59, 59, 999);

                    if (currentDate > end) {
                        visible = false;
                    }
                }
            }
        }

        row.dataset.filteredVisible = visible ? "true" : "false";
    });

    requestsCurrentPage = 1;
    renderRequestsPage();
    updateAllAnalytics();

    if (showMessage) {
        showToast("Фильтры применены");
    }
}

function clearFilters() {
    document.querySelectorAll(".dropdown-menu input[type='checkbox']").forEach(cb => {
        cb.disabled = false;

        const label = cb.closest("label");
        if (label) label.classList.remove("disabled");

        if (cb.classList.contains("filter-status")) {
            cb.checked = cb.value === "Создана" || cb.value === "В работе";
        } else if (cb.value === "all") {
            cb.checked = true;
        } else {
            cb.checked = false;
        }
    });

    document.querySelectorAll(".dropdown-menu").forEach(menu => updateDropdownLabel(menu));

    const statusToggle = document.getElementById("statusFilterToggle");

    if (statusToggle) {
        statusToggle.textContent = "Создана, В работе";
        statusToggle.classList.add("has-filter");
    }

    const now = new Date();
    const yearAgo = new Date();
    yearAgo.setFullYear(now.getFullYear() - 1);

    const dateFrom = document.getElementById("dateFrom");
    const dateTo = document.getElementById("dateTo");

    if (dateFrom) dateFrom.value = toInputDate(yearAgo);
    if (dateTo) dateTo.value = toInputDate(now);

    const search = document.getElementById("searchInput");

    if (search) {
        search.value = "";
        search.classList.remove("active");
    }

    updateBranchFilterOptions();
    updateProductFilterOptions();
    updateClientFilterOptions();

    applyFilters(false);
    showToast("Фильтры сброшены");
}

function collectFilters() {
    return {
        orgs: getCheckedValues(".filter-org"),
        branches: getCheckedValues(".filter-branch"),
        products: getCheckedValues(".filter-product"),
        statuses: getCheckedValues(".filter-status"),
        clients: getCheckedValues(".filter-client"),
        startDate: document.getElementById("dateFrom")?.value || "",
        endDate: document.getElementById("dateTo")?.value || ""
    };
}

function getCheckedValues(selector) {
    return [...document.querySelectorAll(`${selector}:checked`)]
        .filter(cb => cb.value !== "all" && !cb.disabled)
        .map(cb => cb.value);
}

function getSelectedNames(selector) {
    const result = {};

    document.querySelectorAll(`${selector}:checked`).forEach(cb => {
        result[cb.value] = cb.parentElement.textContent.trim();
    });

    return result;
}

function getRowData(row) {
    const cells = row.children;
    const hasClientColumn = Boolean(window.canSeeClientColumn);

    return {
        title: cells[1]?.textContent.trim() || "",
        topic: cells[2]?.textContent.trim() || "",
        org: cells[3]?.textContent.trim() || "",
        branch: cells[4]?.textContent.trim() || "",
        product: cells[5]?.textContent.trim() || "",
        priority: cells[6]?.textContent.trim() || "",
        status: cells[7]?.textContent.trim() || "",
        client: row.dataset.client || (hasClientColumn ? cells[cells.length - 2]?.textContent.trim() : ""),
        date: cells[cells.length - 1]?.textContent.trim() || "",
        finishedDate: row.dataset.finishedDate || "",
        cancelledDate: row.dataset.cancelledDate || "",
        hours: Number(row.dataset.workHours || 0)
    };
}

/* =========================
   REQUESTS PAGINATION
========================= */

function initRequestsPagination() {

    const savedSize = localStorage.getItem("requestsPageSize");

    if (savedSize) {
        requestsPageSize = Number(savedSize) || 10;
    }

    document
        .querySelectorAll(".page-size-btn")
        .forEach(button => {

            const size = Number(button.dataset.size);

            if (size === requestsPageSize) {
                button.classList.add("active");
            } else {
                button.classList.remove("active");
            }

            button.addEventListener("click", () => {

                requestsPageSize = size;

                localStorage.setItem(
                    "requestsPageSize",
                    String(size)
                );

                document
                    .querySelectorAll(".page-size-btn")
                    .forEach(btn =>
                        btn.classList.remove("active"));

                button.classList.add("active");

                requestsCurrentPage = 1;

                renderRequestsPage();
            });
        });
}

function getFilteredRequestRows() {
    return [...document.querySelectorAll("#requestsTable tbody tr")]
        .filter(row => row.dataset.filteredVisible !== "false");
}

function renderRequestsPage() {
    const allRows = [...document.querySelectorAll("#requestsTable tbody tr")];
    const filteredRows = getFilteredRequestRows();

    const totalItems = filteredRows.length;
    const totalPages = Math.max(Math.ceil(totalItems / requestsPageSize), 1);

    if (requestsCurrentPage > totalPages) {
        requestsCurrentPage = totalPages;
    }

    if (requestsCurrentPage < 1) {
        requestsCurrentPage = 1;
    }

    const startIndex = (requestsCurrentPage - 1) * requestsPageSize;
    const endIndex = startIndex + requestsPageSize;
    const rowsOnPage = new Set(filteredRows.slice(startIndex, endIndex));

    allRows.forEach(row => {
        row.style.display = rowsOnPage.has(row) ? "" : "none";
    });

    updateRequestsPaginationView(totalItems, totalPages);
}

function updateRequestsPaginationView(totalItems, totalPages) {
    const container = document.getElementById("requestsPagination");
    const info = document.getElementById("requestsPaginationInfo");

    if (!container) {
        return;
    }

    if (info) {
        if (totalItems === 0) {
            info.textContent = "Нет заявок для отображения";
        } else {
            const from = (requestsCurrentPage - 1) * requestsPageSize + 1;
            const to = Math.min(requestsCurrentPage * requestsPageSize, totalItems);
            info.textContent = `Показано ${from}–${to} из ${totalItems}`;
        }
    }

    container.innerHTML = "";

    const prevBtn = createPaginationButton("‹", requestsCurrentPage - 1, requestsCurrentPage === 1);
    container.appendChild(prevBtn);

    buildRequestsPageList(totalPages).forEach(page => {
        if (page === "...") {
            const dots = document.createElement("span");
            dots.className = "pagination-dots";
            dots.textContent = "…";
            container.appendChild(dots);
            return;
        }

        const btn = createPaginationButton(String(page), page, false);
        btn.classList.toggle("active", page === requestsCurrentPage);
        container.appendChild(btn);
    });

    const nextBtn = createPaginationButton("›", requestsCurrentPage + 1, requestsCurrentPage === totalPages);
    container.appendChild(nextBtn);
}

function createPaginationButton(text, page, disabled) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pagination-btn";
    btn.textContent = text;
    btn.disabled = disabled;

    btn.addEventListener("click", () => {
        if (disabled) {
            return;
        }

        requestsCurrentPage = page;
        renderRequestsPage();
    });

    return btn;
}

function buildRequestsPageList(totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = [1];

    if (requestsCurrentPage > 4) {
        pages.push("...");
    }

    const start = Math.max(2, requestsCurrentPage - 1);
    const end = Math.min(totalPages - 1, requestsCurrentPage + 1);

    for (let page = start; page <= end; page++) {
        pages.push(page);
    }

    if (requestsCurrentPage < totalPages - 3) {
        pages.push("...");
    }

    pages.push(totalPages);

    return pages;
}

/* =========================
   ROW CLICKS
========================= */

function initRowClicks() {
    document.querySelectorAll("#requestsTable tbody tr").forEach(row => {
        row.addEventListener("dblclick", () => {
            const id = row.dataset.requestId;
            if (id) {
                location.href = `/Requests/Details/${id}`;
            }
        });
    });
}

/* =========================
   ANALYTICS
========================= */

function initAnalyticsToggle() {
    const btn = document.getElementById("toggleAnalyticsBtn");
    const section = document.getElementById("analyticsSection");

    if (!btn || !section) return;

    btn.addEventListener("click", () => {
        const collapsed = section.classList.toggle("collapsed");
        btn.textContent = collapsed
            ? "Показать сводку по заявкам"
            : "Скрыть сводку по заявкам";

        if (!collapsed) {
            setTimeout(updateAllAnalytics, 120);
        }
    });
}

function updateAllAnalytics() {
    const periodCreatedRows = getRowsByScope({
        useDate: true,
        useStatus: false
    });
    const periodEventRows = getRowsByScope({
        useDate: false,
        useStatus: false
    });
    const currentStatusRows = getRowsByScope({
        useDate: false,
        useStatus: true
    });
    const hoursRows = getRowsByScope({
        useDate: false,
        useStatus: false
    });

    updateCurrentStats(currentStatusRows);
    updateTrendChart(periodEventRows);
    updateOrgChart(periodEventRows);
    updateStatusPeriodChart(currentStatusRows);
    updateHoursTable(hoursRows);
}

function getAllRequestRows() {
    return [...document.querySelectorAll("#requestsTable tbody tr")];
}

function getVisibleRows() {
    return getAllRequestRows()
        .filter(row => row.dataset.filteredVisible !== "false");
}

function getRowsByScope(options = {}) {
    const settings = {
        useDate: options.useDate !== false,
        useStatus: options.useStatus !== false
    };

    return getAllRequestRows()
        .filter(row => rowMatchesFilters(row, settings));
}

function rowMatchesFilters(row, options = {}) {
    const settings = {
        useDate: options.useDate !== false,
        useStatus: options.useStatus !== false
    };

    const filters = collectFilters();
    const search = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();

    const orgNames = getSelectedNames(".filter-org");
    const branchNames = getSelectedNames(".filter-branch");
    const productNames = getSelectedNames(".filter-product");

    const item = getRowData(row);

    if (search) {
        const searchArea = `${item.title} ${item.topic} ${item.org} ${item.branch} ${item.product} ${item.client}`.toLowerCase();

        if (!searchArea.includes(search)) {
            return false;
        }
    }

    if (filters.orgs.length > 0 && !filters.orgs.some(id => item.org === orgNames[id])) {
        return false;
    }

    if (filters.branches.length > 0 && !filters.branches.some(id => item.branch === branchNames[id])) {
        return false;
    }

    if (filters.products.length > 0 && !filters.products.some(id => item.product === productNames[id])) {
        return false;
    }

    if (settings.useStatus && filters.statuses.length > 0 && !filters.statuses.includes(item.status)) {
        return false;
    }

    if (filters.clients.length > 0 && !filters.clients.includes(item.client)) {
        return false;
    }

    if (settings.useDate && item.date) {
        const currentDate = parseRuDate(item.date);

        if (currentDate) {
            if (filters.startDate) {
                const start = new Date(filters.startDate);
                start.setHours(0, 0, 0, 0);

                if (currentDate < start) {
                    return false;
                }
            }

            if (filters.endDate) {
                const end = new Date(filters.endDate);
                end.setHours(23, 59, 59, 999);

                if (currentDate > end) {
                    return false;
                }
            }
        }
    }

    return true;
}

function updateCurrentStats(rows) {
    const created = rows.filter(row => getRowData(row).status === "Создана").length;
    const inWork = rows.filter(row => getRowData(row).status === "В работе").length;
    const clarification = rows.filter(row => getRowData(row).status === "Уточнение").length;
    const waiting = rows.filter(row => getRowData(row).status === "Ожидание").length;

    const currentCreated = document.getElementById("currentCreated");
    const currentInWork = document.getElementById("currentInWork");
    const currentActive = document.getElementById("currentActive");

    if (currentCreated) currentCreated.textContent = created;
    if (currentInWork) currentInWork.textContent = inWork;
    if (currentActive) currentActive.textContent = created + inWork + clarification + waiting;
}

function updateTrendChart(rows) {
    const canvas = document.getElementById("trendChart");
    if (!canvas || typeof Chart === "undefined") return;

    const months = {};
    const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

    function ensureMonth(date) {
        const monthNumber = String(date.getMonth() + 1).padStart(2, "0");
        const key = `${date.getFullYear()}-${monthNumber}`;

        if (!months[key]) {
            months[key] = {
                label: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
                created: 0,
                finished: 0,
                cancelled: 0
            };
        }

        return months[key];
    }

    rows.forEach(row => {
        const item = getRowData(row);

        const createdDate = parseRuDate(item.date);
        if (createdDate && isDateInSelectedPeriod(createdDate)) {
            ensureMonth(createdDate).created++;
        }

        const finishedDate = parseRuDate(item.finishedDate);
        if (finishedDate && isDateInSelectedPeriod(finishedDate)) {
            ensureMonth(finishedDate).finished++;
        }

        const cancelledDate = parseRuDate(item.cancelledDate);
        if (cancelledDate && isDateInSelectedPeriod(cancelledDate)) {
            ensureMonth(cancelledDate).cancelled++;
        }
    });

    const keys = Object.keys(months).sort();

    if (trendChart) {
        trendChart.destroy();
    }

    trendChart = new Chart(canvas, {
        type: "line",
        data: {
            labels: keys.map(key => months[key].label),
            datasets: [
                {
                    label: "Создано",
                    data: keys.map(key => months[key].created),
                    borderColor: "#3b82f6",
                    backgroundColor: "rgba(59, 130, 246, 0.08)",
                    tension: 0.35,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },
                {
                    label: "Завершено",
                    data: keys.map(key => months[key].finished),
                    borderColor: "#22c55e",
                    backgroundColor: "rgba(34, 197, 94, 0.08)",
                    tension: 0.35,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },
                {
                    label: "Отменено",
                    data: keys.map(key => months[key].cancelled),
                    borderColor: "#ef4444",
                    backgroundColor: "rgba(239, 68, 68, 0.06)",
                    tension: 0.35,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        boxWidth: 10,
                        boxHeight: 10,
                        usePointStyle: true,
                        font: {
                            size: 11
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        precision: 0,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function updateOrgChart(rows) {
    const canvas = document.getElementById("orgChart");
    if (!canvas || typeof Chart === "undefined") return;

    const orgs = buildOrganizationEventStatsFromItems(
        rows.map(row => getRowData(row))
    );

    const data = Object.values(orgs)
        .sort((a, b) => b.created - a.created || b.finished - a.finished || a.org.localeCompare(b.org, "ru"))
        .slice(0, 8);

    if (orgChart) {
        orgChart.destroy();
    }

    orgChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: data.map(x => x.org),
            datasets: [
                {
                    label: "Создано",
                    data: data.map(x => x.created),
                    backgroundColor: "#60a5fa",
                    borderRadius: 6,
                    maxBarThickness: 26
                },
                {
                    label: "Завершено",
                    data: data.map(x => x.finished),
                    backgroundColor: "#22c55e",
                    borderRadius: 6,
                    maxBarThickness: 26
                },
                {
                    label: "Отменено",
                    data: data.map(x => x.cancelled),
                    backgroundColor: "#ef4444",
                    borderRadius: 6,
                    maxBarThickness: 26
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: data.length > 4 ? "y" : "x",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        boxWidth: 10,
                        boxHeight: 10,
                        usePointStyle: true,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        footer: items => {
                            const index = items?.[0]?.dataIndex;
                            if (index === undefined || !data[index]) {
                                return "";
                            }

                            return `Всего событий: ${data[index].created + data[index].finished + data[index].cancelled}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        precision: 0,
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}


function getStatusChartColor(status) {
    const colors = {
        "Создана": "#60a5fa",
        "В работе": "#facc15",
        "Уточнение": "#8b5cf6",
        "Ожидание": "#0ea5e9",
        "Завершена": "#22c55e",
        "Отменена": "#ef4444"
    };

    return colors[status] || "#94a3b8";
}

function buildOrganizationEventStatsFromItems(items) {
    const result = {};

    function ensureOrg(name) {
        if (!name || name === "-") {
            return null;
        }

        if (!result[name]) {
            result[name] = {
                org: name,
                created: 0,
                finished: 0,
                cancelled: 0
            };
        }

        return result[name];
    }

    items.forEach(item => {
        const org = ensureOrg(item.org);

        if (!org) {
            return;
        }

        const createdDate = parseRuDate(item.date);
        if (createdDate && isDateInSelectedPeriod(createdDate)) {
            org.created++;
        }

        const finishedDate = parseRuDate(item.finishedDate);
        if (finishedDate && isDateInSelectedPeriod(finishedDate)) {
            org.finished++;
        }

        const cancelledDate = parseRuDate(item.cancelledDate);
        if (cancelledDate && isDateInSelectedPeriod(cancelledDate)) {
            org.cancelled++;
        }
    });

    return result;
}

function updateStatusPeriodChart(rows) {
    const canvas = document.getElementById("statusPeriodChart");
    const legend = document.getElementById("statusPeriodLegend");

    if (!canvas || typeof Chart === "undefined") return;

    const allStatusNames = [
        "Создана",
        "В работе",
        "Уточнение",
        "Ожидание",
        "Завершена",
        "Отменена"
    ];

    const selectedStatuses = collectFilters().statuses;
    const labels = selectedStatuses.length > 0
        ? allStatusNames.filter(status => selectedStatuses.includes(status))
        : allStatusNames;

    const data = Object.fromEntries(labels.map(status => [status, 0]));

    rows.forEach(row => {
        const status = getRowData(row).status;

        if (Object.prototype.hasOwnProperty.call(data, status)) {
            data[status]++;
        }
    });

    const values = labels.map(label => data[label]);

    if (statusPeriodChart) {
        statusPeriodChart.destroy();
    }

    statusPeriodChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels,
            datasets: [
                {
                    data: values,
                    backgroundColor: labels.map(label => getStatusChartColor(label)),
                    borderWidth: 0,
                    hoverOffset: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "64%",
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: context => {
                            const total = values.reduce((a, b) => a + b, 0);
                            const value = context.raw || 0;
                            const percent = total > 0 ? Math.round((value / total) * 100) : 0;

                            return `${context.label}: ${value} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });

    if (legend) {
        const total = values.reduce((a, b) => a + b, 0);

        legend.innerHTML = labels.map(label => {
            const value = data[label];
            const percent = total > 0 ? Math.round((value / total) * 100) : 0;

            return `
                <div class="status-legend-item">
                    <span class="status-dot" style="background:${getStatusChartColor(label)}"></span>
                    <span>${escapeHtml(label)}</span>
                    <strong>${value}</strong>
                    <small>${percent}%</small>
                </div>
            `;
        }).join("");
    }
}

function updateHoursTable(rows) {
    const container = document.getElementById("hoursTable");

    if (!container) return;

    const filters = collectFilters();
    const orgNames = getSelectedNames(".filter-org");

    const allRows = Array.isArray(rows) ? rows : getVisibleRows();

    const orgStats = {};

    allRows.forEach(row => {
        const item = getRowData(row);
        let include = true;

        if (!item.org || item.org === "-") {
            include = false;
        }

        if (include && filters.orgs.length > 0) {
            include = filters.orgs.some(id => item.org === orgNames[id]);
        }

        if (!include) return;

        if (!orgStats[item.org]) {
            orgStats[item.org] = {
                count: 0,
                spent: 0,
                limit: 0
            };
        }

        orgStats[item.org].count += 1;
        orgStats[item.org].spent += Number(item.hours || 0);
    });

    (window.organizationHours || []).forEach(item => {
        const name = item.orgName ?? item.OrgName;
        const limit = Number(item.limitHours ?? item.LimitHours ?? 0);

        if (!name) return;

        if (filters.orgs.length > 0) {
            const selectedOrgNames = filters.orgs.map(id => orgNames[id]);
            if (!selectedOrgNames.includes(name)) {
                return;
            }
        }

        if (!orgStats[name]) {
            orgStats[name] = {
                count: 0,
                spent: 0,
                limit
            };
        } else {
            orgStats[name].limit = limit;
        }
    });

    const entries = Object.entries(orgStats)
        .sort((a, b) => a[0].localeCompare(b[0], "ru"));

    if (entries.length === 0) {
        container.innerHTML = `<div class="text-muted">Нет данных по лимитам поддержки</div>`;
        return;
    }

    let html = `
        <table class="hours-table">
            <thead>
                <tr>
                    <th>Организация</th>
                    <th>Заявок</th>
                    <th>Лимит</th>
                    <th>Потрачено</th>
                    <th>Остаток</th>
                    <th>Использование</th>
                </tr>
            </thead>
            <tbody>
    `;

    entries.forEach(([org, data]) => {
        const limit = Number(data.limit || 0);
        const spent = Number(data.spent || 0);
        const remaining = Math.max(limit - spent, 0);
        const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

        const progressClass =
            percent >= 90 ? "danger" :
                percent >= 70 ? "warning" :
                    "";

        html += `
            <tr>
                <td>${escapeHtml(org)}</td>
                <td>${data.count}</td>
                <td>${formatHours(limit)}</td>
                <td>${formatHours(spent)}</td>
                <td>${formatHours(remaining)}</td>
                <td>
                    <div class="progress-track">
                        <div class="progress-fill ${progressClass}" style="width:${percent}%"></div>
                    </div>
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}
/* =========================
   REPORT EXPORT
========================= */

function initReportExport() {
    const btn = document.getElementById("exportReportBtn");

    if (!btn) {
        return;
    }

    btn.addEventListener("click", () => {
        const rows = getAllRequestRows();

        if (rows.length === 0) {
            showToast("Нет данных для отчёта");
            return;
        }

        openRequestsReport();
    });
}

function openRequestsReport() {
    try {
        const periodRows = getRowsByScope({
            useDate: true,
            useStatus: false
        });

        const eventRows = getRowsByScope({
            useDate: false,
            useStatus: false
        });

        const currentStatusRows = getRowsByScope({
            useDate: false,
            useStatus: true
        });

        const currentAllRows = getRowsByScope({
            useDate: false,
            useStatus: false
        });

        const hoursRows = getRowsByScope({
            useDate: false,
            useStatus: false
        });

        const reportData = buildRequestsReportData(
            periodRows,
            eventRows,
            currentStatusRows,
            currentAllRows,
            hoursRows
        );

        const reportHtml = buildRequestsReportHtml(reportData);
        const reportWindow = window.open("", "_blank");

        if (!reportWindow) {
            showToast("Браузер заблокировал открытие отчёта");
            return;
        }

        reportWindow.document.open();
        reportWindow.document.write(reportHtml);
        reportWindow.document.close();
        reportWindow.focus();
    } catch (error) {
        console.error(error);
        showToast("Не удалось сформировать отчёт");
    }
}

function buildRequestsReportData(
    periodRows,
    eventRows,
    currentStatusRows,
    currentAllRows,
    hoursRows
) {
    const periodItems = periodRows.map(row => getRowData(row));
    const eventItems = eventRows.map(row => getRowData(row));
    const currentStatusItems = currentStatusRows.map(row => getRowData(row));
    const currentAllItems = currentAllRows.map(row => getRowData(row));
    const hoursItems = hoursRows.map(row => getRowData(row));

    const created = periodItems.length;

    const completed = eventItems.filter(item => {
        const date = parseRuDate(item.finishedDate);
        return date && isDateInSelectedPeriod(date);
    }).length;

    const cancelled = eventItems.filter(item => {
        const date = parseRuDate(item.cancelledDate);
        return date && isDateInSelectedPeriod(date);
    }).length;

    const closed = completed + cancelled;

    const currentStatuses = countBy(currentStatusItems, item => item.status || "Не указан");
    const currentAllStatuses = countBy(currentAllItems, item => item.status || "Не указан");

    const priorities = countBy(periodItems, item => item.priority || "Не указан");
    const topics = countBy(periodItems, item => item.topic || "Не указана");
    const products = countBy(periodItems, item => item.product || "Не указан");

    const organizationEvents = Object.values(
        buildOrganizationEventStatsFromItems(eventItems)
    );

    const currentTotal = currentStatusItems.length;
    const currentCreated = currentStatuses["Создана"] || 0;
    const currentInWork = currentStatuses["В работе"] || 0;
    const currentClarification = currentStatuses["Уточнение"] || 0;
    const currentWaiting = currentStatuses["Ожидание"] || 0;
    const currentCompleted = currentStatuses["Завершена"] || 0;
    const currentCancelled = currentStatuses["Отменена"] || 0;
    const currentActive = currentCreated + currentInWork + currentClarification + currentWaiting;

    const currentAllTotal = currentAllItems.length;
    const currentAllCreated = currentAllStatuses["Создана"] || 0;
    const currentAllProcessed = Math.max(currentAllTotal - currentAllCreated, 0);

    const completionRate = created > 0
        ? Math.round((completed / created) * 100)
        : 0;

    const cancelRate = created > 0
        ? Math.round((cancelled / created) * 100)
        : 0;

    const sliExecution = closed > 0
        ? Math.round((completed / closed) * 100)
        : null;

    const sliProcessing = currentAllTotal > 0
        ? Math.round((currentAllProcessed / currentAllTotal) * 100)
        : null;

    const monthly = buildMonthlyReportStats(eventItems);
    const orgHours = buildOrganizationHoursReportStats(hoursItems);

    const orgsWithLimit = orgHours.filter(item => Number(item.limit || 0) > 0);
    const orgsWithoutLimitExcess = orgsWithLimit.filter(item =>
        Number(item.spent || 0) <= Number(item.limit || 0)
    );

    const sliLimits = orgsWithLimit.length > 0
        ? Math.round((orgsWithoutLimitExcess.length / orgsWithLimit.length) * 100)
        : null;

    return {
        generatedAt: new Date(),
        periodText: getReportPeriodText(),
        commonFiltersText: getReportFiltersText(false),
        statusFiltersText: getReportStatusFiltersText(),

        periodItems,
        eventItems,
        currentStatusItems,
        currentAllItems,
        hoursItems,

        created,
        completed,
        cancelled,
        closed,
        completionRate,
        cancelRate,

        currentTotal,
        currentCreated,
        currentInWork,
        currentClarification,
        currentWaiting,
        currentActive,
        currentCompleted,
        currentCancelled,

        currentAllTotal,
        currentAllCreated,
        currentAllProcessed,

        currentStatuses,
        priorities,
        topics,
        products,
        organizationEvents,
        monthly,
        orgHours,
        orgsWithLimitCount: orgsWithLimit.length,
        orgsWithoutLimitExcessCount: orgsWithoutLimitExcess.length,

        sliExecution,
        sliProcessing,
        sliLimits
    };
}

function buildRequestsReportHtml(data) {
    const topOrganizations = data.organizationEvents
        .slice()
        .sort((a, b) =>
            b.created - a.created ||
            b.finished - a.finished ||
            b.cancelled - a.cancelled ||
            a.org.localeCompare(b.org, "ru")
        )
        .slice(0, 10);

    const topTopics = toSortedEntries(data.topics).slice(0, 8);
    const topProducts = toSortedEntries(data.products).slice(0, 8);
    const priorityEntries = toSortedEntries(data.priorities);
    const statusEntries = orderedStatusEntries(data.currentStatuses);

    return `
<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <title>Статистический отчёт по заявкам</title>

    <style>
        @page {
            size: A4 portrait;
            margin: 14mm;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            background: #ffffff;
            color: #111827;
            font-family: "Times New Roman", Times, serif;
            font-size: 13px;
            line-height: 1.35;
        }

        .report-page {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
        }

        .report-actions {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 14px;
            font-family: "Segoe UI", Arial, sans-serif;
        }

        .report-btn {
            border: 1px solid #111827;
            border-radius: 4px;
            background: #111827;
            color: #ffffff;
            padding: 7px 13px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        }

        .report-header {
            margin-bottom: 15px;
            padding-bottom: 11px;
            border-bottom: 2px solid #111827;
        }

        .report-title {
            margin: 0 0 12px;
            text-align: center;
            font-size: 21px;
            line-height: 1.2;
            font-weight: 700;
        }

        .report-meta {
            width: 100%;
            border-collapse: collapse;
            font-size: 12.5px;
        }

        .report-meta td {
            padding: 3px 0;
            vertical-align: top;
        }

        .report-meta td:first-child {
            width: 44mm;
            font-weight: 700;
            white-space: nowrap;
        }

        .report-note {
            margin-top: 8px;
            padding: 7px 9px;
            border: 1px solid #d1d5db;
            background: #f9fafb;
            color: #374151;
            font-size: 12px;
        }

        .report-section {
            margin-top: 15px;
        }

        .report-section.compact-section,
        .chart-card,
        .kpi-grid,
        .report-table {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .report-section-title {
            margin: 0 0 9px;
            padding-bottom: 5px;
            border-bottom: 1px solid #9ca3af;
            font-size: 16px;
            font-weight: 700;
        }

        .section-subtitle {
            margin: -4px 0 9px;
            color: #4b5563;
            font-size: 12px;
        }

        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 10px;
        }

        .kpi-card {
            min-height: 56px;
            border: 1px solid #d1d5db;
            padding: 8px 9px;
            background: #ffffff;
        }

        .kpi-label {
            margin-bottom: 5px;
            color: #4b5563;
            font-size: 11.5px;
            line-height: 1.25;
        }

        .kpi-value {
            color: #111827;
            font-size: 20px;
            line-height: 1;
            font-weight: 700;
        }

        .summary-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 170px;
            gap: 12px;
            align-items: start;
        }

        .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12.3px;
        }

        .report-table th,
        .report-table td {
            border: 1px solid #d1d5db;
            padding: 5px 7px;
            vertical-align: top;
        }

        .report-table th {
            background: #f3f4f6;
            font-weight: 700;
            text-align: left;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .report-table td.numeric,
        .report-table th.numeric {
            text-align: right;
            white-space: nowrap;
        }

        .summary-table td:first-child {
            width: 72%;
        }

        .summary-table td:last-child {
            width: 28%;
            text-align: right;
            font-weight: 700;
            white-space: nowrap;
        }

        .chart-card {
            border: 1px solid #d1d5db;
            padding: 9px;
        }

        .chart-card-title {
            margin: 0 0 7px;
            font-size: 13px;
            font-weight: 700;
        }

        .charts-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
        }

        .charts-grid .chart-card {
            width: 100%;
        }

        .chart-wide {
            width: 100%;
        }

        .mini-bars {
            display: grid;
            gap: 6px;
        }

        .mini-bar-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 36px 42px;
            gap: 7px;
            align-items: center;
            font-size: 12px;
        }

        .mini-bar-label {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .mini-bar-value,
        .mini-bar-percent {
            text-align: right;
            white-space: nowrap;
        }

        .mini-bar-track {
            grid-column: 1 / 4;
            height: 7px;
            border: 1px solid #9ca3af;
            background: #ffffff;
            border-radius: 999px;
            overflow: hidden;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .mini-bar-fill {
            height: 100%;
            background: #4b5563;
            border-radius: 999px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .donut-layout {
            display: grid;
            gap: 8px;
            justify-items: center;
            align-items: center;
        }

        .donut-svg {
            width: 118px;
            height: 118px;
        }

        .donut-center-text {
            font-family: "Segoe UI", Arial, sans-serif;
            font-size: 10px;
            font-weight: 700;
            fill: #111827;
        }

        .legend-list {
            width: 100%;
            display: grid;
            gap: 5px;
            font-size: 11.5px;
        }

        .legend-item {
            display: grid;
            grid-template-columns: 9px minmax(0, 1fr) auto;
            gap: 6px;
            align-items: center;
        }

        .legend-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #4b5563;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .legend-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .legend-value {
            white-space: nowrap;
            font-weight: 700;
        }

        .svg-chart {
            width: 100%;
            height: auto;
            max-height: 205px;
        }

        .svg-axis-text {
            font-family: "Times New Roman", Times, serif;
            font-size: 10.5px;
            fill: #374151;
        }

        .svg-grid {
            stroke: #e5e7eb;
            stroke-width: 1;
        }

        .svg-bar-created {
            fill: #374151;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .svg-bar-finished {
            fill: #6b7280;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .svg-bar-cancelled {
            fill: #9ca3af;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .chart-legend {
            display: flex;
            gap: 12px;
            align-items: center;
            margin: 5px 0 7px;
            color: #374151;
            font-size: 11.5px;
        }

        .chart-legend-item {
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }

        .legend-square {
            width: 9px;
            height: 9px;
            display: inline-block;
            background: #374151;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .legend-square.finished {
            background: #6b7280;
        }

        .legend-square.cancelled {
            background: #9ca3af;
        }

        .muted {
            color: #4b5563;
        }

        .conclusion-text {
            margin: 0 0 7px;
            text-align: justify;
        }

        .report-footer-note {
            margin-top: 7px;
            color: #4b5563;
            font-size: 12px;
        }

        @media print {
            .report-actions {
                display: none !important;
            }

            .report-page {
                max-width: none;
                margin: 0;
            }

            tr,
            .kpi-card,
            .chart-card {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }
    </style>
</head>

<body>
    <div class="report-page">
        <div class="report-actions">
            <button class="report-btn" onclick="window.print()">Печать / PDF</button>
        </div>

        <header class="report-header">
            <h1 class="report-title">Статистический отчёт по заявкам</h1>

            <table class="report-meta">
                <tbody>
                    <tr>
                        <td>Период событий:</td>
                        <td>${escapeHtml(data.periodText)}</td>
                    </tr>
                    <tr>
                        <td>Основные фильтры:</td>
                        <td>${escapeHtml(data.commonFiltersText)}</td>
                    </tr>
                    <tr>
                        <td>Фильтр статусов:</td>
                        <td>${escapeHtml(data.statusFiltersText)}</td>
                    </tr>
                    <tr>
                        <td>Дата формирования:</td>
                        <td>${escapeHtml(formatDateTime(data.generatedAt))}</td>
                    </tr>
                </tbody>
            </table>

            <div class="report-note">
                Показатели за период рассчитываются по событиям создания, завершения и отмены заявок. Показатели на дату формирования отражают текущее состояние заявок и использование лимитов поддержки.
            </div>
        </header>

        <section class="report-section compact-section">
            <h2 class="report-section-title">1. Ключевые показатели за период</h2>
            ${renderPeriodKpiCards(data)}
            ${renderPeriodSummaryTable(data)}
        </section>

        <section class="report-section compact-section">
            <h2 class="report-section-title">2. Показатели SLI</h2>
            ${renderSliTable(data)}
        </section>

        <section class="report-section compact-section">
            <h2 class="report-section-title">3. Состояние заявок на дату формирования</h2>
            <div class="summary-layout">
                ${renderCurrentStatusTable(data)}

                <div class="chart-card">
                    <h3 class="chart-card-title">Статусы</h3>
                    ${renderStatusDonut(statusEntries, data.currentTotal)}
                </div>
            </div>
        </section>

        <section class="report-section compact-section">
            <h2 class="report-section-title">4. Динамика событий по месяцам</h2>
            ${renderMonthlyChart(data.monthly)}
        </section>

        <section class="report-section">
            <h2 class="report-section-title">5. Структура обращений за период</h2>

            <div class="charts-grid">
                <div class="chart-card">
                    <h3 class="chart-card-title">События по организациям</h3>
                    ${renderOrganizationEventsTable(topOrganizations)}
                </div>

                <div class="chart-card">
                    <h3 class="chart-card-title">Тематики обращений</h3>
                    ${renderCompactBarChart(topTopics, data.created)}
                </div>

                <div class="chart-card">
                    <h3 class="chart-card-title">Приоритеты заявок</h3>
                    ${renderCompactBarChart(priorityEntries, data.created)}
                </div>

                <div class="chart-card">
                    <h3 class="chart-card-title">Программные продукты</h3>
                    ${renderCompactBarChart(topProducts, data.created)}
                </div>
            </div>
        </section>

        <section class="report-section">
            <h2 class="report-section-title">6. Контроль использования лимитов поддержки на дату формирования</h2>
            ${renderOrgHoursTable(data.orgHours)}
        </section>

        <section class="report-section compact-section">
            <h2 class="report-section-title">7. Выводы</h2>
            ${renderInsights(data, topOrganizations, topTopics)}
        </section>
    </div>
</body>
</html>
    `;
}

function renderPeriodKpiCards(data) {
    return `
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Создано</div>
                <div class="kpi-value">${data.created}</div>
            </div>

            <div class="kpi-card">
                <div class="kpi-label">Завершено</div>
                <div class="kpi-value">${data.completed}</div>
            </div>

            <div class="kpi-card">
                <div class="kpi-label">Отменено</div>
                <div class="kpi-value">${data.cancelled}</div>
            </div>

            <div class="kpi-card">
                <div class="kpi-label">Закрыто</div>
                <div class="kpi-value">${data.closed}</div>
            </div>
        </div>
    `;
}

function renderPeriodSummaryTable(data) {
    return `
        <table class="report-table summary-table">
            <tbody>
                <tr>
                    <td>Доля завершённых заявок от количества созданных за период</td>
                    <td>${data.completionRate}%</td>
                </tr>
                <tr>
                    <td>Доля отменённых заявок от количества созданных за период</td>
                    <td>${data.cancelRate}%</td>
                </tr>
                <tr>
                    <td>Количество закрытых заявок за период</td>
                    <td>${data.closed}</td>
                </tr>
            </tbody>
        </table>
    `;
}

function renderSliTable(data) {
    const executionValue = data.sliExecution === null
        ? "—"
        : `${data.sliExecution}%`;

    const processingValue = data.sliProcessing === null
        ? "—"
        : `${data.sliProcessing}%`;

    const limitsValue = data.sliLimits === null
        ? "—"
        : `${data.sliLimits}%`;

    return `
        <table class="report-table">
            <thead>
                <tr>
                    <th>Показатель</th>
                    <th>Период расчёта</th>
                    <th>Назначение</th>
                    <th class="numeric">Значение</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>SLI выполнения заявок</td>
                    <td>За выбранный период</td>
                    <td>Доля заявок, закрытых успешным выполнением</td>
                    <td class="numeric">${executionValue}</td>
                </tr>
                <tr>
                    <td>SLI обработки обращений</td>
                    <td>На дату формирования</td>
                    <td>Доля заявок, которые перешли из первичного статуса в обработку или закрытие</td>
                    <td class="numeric">${processingValue}</td>
                </tr>
                <tr>
                    <td>SLI соблюдения лимитов поддержки</td>
                    <td>На дату формирования</td>
                    <td>Доля организаций без превышения установленного лимита часов</td>
                    <td class="numeric">${limitsValue}</td>
                </tr>
            </tbody>
        </table>

        <div class="report-footer-note">
            SLI отражают фактические количественные показатели качества сервиса. В отчёте отдельно указано, какие показатели рассчитываются за период, а какие — на дату формирования.
        </div>
    `;
}

function renderCurrentStatusTable(data) {
    const statusRows = orderedStatusEntries(data.currentStatuses)
        .map(([status, value]) => `
                <tr>
                    <td>${escapeHtml(status)}</td>
                    <td>${value}</td>
                </tr>
        `)
        .join("");

    return `
        <table class="report-table summary-table">
            <tbody>
                <tr>
                    <td>Всего заявок по выбранным статусам</td>
                    <td>${data.currentTotal}</td>
                </tr>
                <tr>
                    <td>Активные заявки по выбранным статусам</td>
                    <td>${data.currentActive}</td>
                </tr>
                ${statusRows}
            </tbody>
        </table>
    `;
}

function renderCompactBarChart(entries, total) {
    if (!entries.length) {
        return `<div class="muted">Нет данных для отображения</div>`;
    }

    const max = Math.max(...entries.map(x => x[1]), 1);

    return `
        <div class="mini-bars">
            ${entries.map(([label, value]) => {
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;
        const width = Math.round((value / max) * 100);

        return `
                    <div class="mini-bar-row">
                        <div class="mini-bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
                        <div class="mini-bar-value">${value}</div>
                        <div class="mini-bar-percent">${percent}%</div>
                        <div class="mini-bar-track">
                            <div class="mini-bar-fill" style="width:${width}%"></div>
                        </div>
                    </div>
                `;
    }).join("")}
        </div>
    `;
}

function renderStatusDonut(entries, total) {
    if (!entries.length || total === 0) {
        return `<div class="muted">Нет данных для отображения</div>`;
    }

    const colors = ["#4b5563", "#6b7280", "#9ca3af", "#d1d5db", "#e5e7eb", "#f3f4f6"];
    const radius = 40;
    const circumference = 2 * Math.PI * radius;

    let offset = 0;

    const circles = entries.map(([label, value], index) => {
        const part = total > 0 ? value / total : 0;
        const dash = part * circumference;
        const color = colors[index % colors.length];

        const circle = `
            <circle
                cx="60"
                cy="60"
                r="${radius}"
                fill="transparent"
                stroke="${color}"
                stroke-width="16"
                stroke-dasharray="${dash} ${circumference - dash}"
                stroke-dashoffset="${-offset}"
                transform="rotate(-90 60 60)">
            </circle>
        `;

        offset += dash;
        return circle;
    }).join("");

    return `
        <div class="donut-layout">
            <svg class="donut-svg" viewBox="0 0 120 120" role="img" aria-label="Диаграмма статусов">
                <circle cx="60" cy="60" r="${radius}" fill="transparent" stroke="#f3f4f6" stroke-width="16"></circle>
                ${circles}
                <text x="60" y="57" text-anchor="middle" class="donut-center-text">${total}</text>
                <text x="60" y="71" text-anchor="middle" class="donut-center-text">заявок</text>
            </svg>

            <div class="legend-list">
                ${entries.map(([label, value], index) => {
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;
        const color = colors[index % colors.length];

        return `
                        <div class="legend-item">
                            <span class="legend-dot" style="background:${color}"></span>
                            <span class="legend-name" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
                            <span class="legend-value">${value} / ${percent}%</span>
                        </div>
                    `;
    }).join("")}
            </div>
        </div>
    `;
}

function renderMonthlyChart(monthly) {
    if (!monthly.length) {
        return `<div class="muted">Нет данных для построения динамики</div>`;
    }

    const width = 720;
    const height = 200;
    const left = 46;
    const right = 14;
    const top = 16;
    const bottom = 42;

    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;

    const max = Math.max(
        ...monthly.map(item => Math.max(item.created, item.finished, item.cancelled)),
        1
    );

    const groupWidth = chartWidth / monthly.length;
    const barWidth = Math.min(12, Math.max(6, groupWidth * 0.18));
    const groupBarWidth = barWidth * 3 + 4;

    const bars = monthly.map((item, index) => {
        const baseX = left + index * groupWidth + (groupWidth - groupBarWidth) / 2;
        const values = [
            { value: item.created, className: "svg-bar-created" },
            { value: item.finished, className: "svg-bar-finished" },
            { value: item.cancelled, className: "svg-bar-cancelled" }
        ];

        const rects = values.map((entry, entryIndex) => {
            const barHeight = (entry.value / max) * chartHeight;
            const x = baseX + entryIndex * (barWidth + 2);
            const y = top + chartHeight - barHeight;

            return `
                <rect class="${entry.className}" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="2"></rect>
                ${entry.value > 0 ? `<text class="svg-axis-text" x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle">${entry.value}</text>` : ""}
            `;
        }).join("");

        return `
            ${rects}
            <text class="svg-axis-text" x="${baseX + groupBarWidth / 2}" y="${height - 17}" text-anchor="middle">${escapeHtml(item.label)}</text>
        `;
    }).join("");

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(part => {
        const y = top + chartHeight - chartHeight * part;
        const value = Math.round(max * part);

        return `
            <line class="svg-grid" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line>
            <text class="svg-axis-text" x="${left - 7}" y="${y + 4}" text-anchor="end">${value}</text>
        `;
    }).join("");

    return `
        <div class="chart-card chart-wide">
            <h3 class="chart-card-title">Создание, завершение и отмена заявок</h3>

            <div class="chart-legend">
                <span class="chart-legend-item"><span class="legend-square"></span>Создано</span>
                <span class="chart-legend-item"><span class="legend-square finished"></span>Завершено</span>
                <span class="chart-legend-item"><span class="legend-square cancelled"></span>Отменено</span>
            </div>

            <svg class="svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Динамика событий по заявкам">
                ${gridLines}
                ${bars}
            </svg>

            <table class="report-table" style="margin-top:8px;">
                <thead>
                    <tr>
                        <th>Месяц</th>
                        <th class="numeric">Создано</th>
                        <th class="numeric">Завершено</th>
                        <th class="numeric">Отменено</th>
                    </tr>
                </thead>
                <tbody>
                    ${monthly.map(item => `
                        <tr>
                            <td>${escapeHtml(item.label)}</td>
                            <td class="numeric">${item.created}</td>
                            <td class="numeric">${item.finished}</td>
                            <td class="numeric">${item.cancelled}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function renderOrganizationEventsTable(items) {
    if (!items.length) {
        return `<div class="muted">Нет данных для отображения</div>`;
    }

    return `
        <table class="report-table">
            <thead>
                <tr>
                    <th>Организация</th>
                    <th class="numeric">Создано</th>
                    <th class="numeric">Завершено</th>
                    <th class="numeric">Отменено</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr>
                        <td>${escapeHtml(item.org)}</td>
                        <td class="numeric">${item.created}</td>
                        <td class="numeric">${item.finished}</td>
                        <td class="numeric">${item.cancelled}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}

function renderOrgHoursTable(orgHours) {
    if (!orgHours.length) {
        return `<div class="muted">Нет данных по лимитам часов</div>`;
    }

    return `
        <table class="report-table">
            <thead>
                <tr>
                    <th>Организация</th>
                    <th class="numeric">Заявок</th>
                    <th class="numeric">Лимит</th>
                    <th class="numeric">Учтено</th>
                    <th class="numeric">Остаток</th>
                    <th class="numeric">Использование</th>
                </tr>
            </thead>
            <tbody>
                ${orgHours.map(item => {
        const percent = item.limit > 0 ? Math.min(Math.round((item.spent / item.limit) * 100), 100) : 0;
        const remaining = Math.max(item.limit - item.spent, 0);

        return `
                        <tr>
                            <td>${escapeHtml(item.org)}</td>
                            <td class="numeric">${item.count}</td>
                            <td class="numeric">${formatHours(item.limit)}</td>
                            <td class="numeric">${formatHours(item.spent)}</td>
                            <td class="numeric">${formatHours(remaining)}</td>
                            <td class="numeric">${percent}%</td>
                        </tr>
                    `;
    }).join("")}
            </tbody>
        </table>

        <div class="report-footer-note">
            В трудозатраты включаются интервалы, когда заявка находилась в статусе «В работе».
        </div>
    `;
}

function renderInsights(data, topOrganizations, topTopics) {
    const topOrg = topOrganizations[0];
    const topTopic = topTopics[0];

    const sliText = data.sliExecution === null
        ? "не рассчитывается из-за отсутствия закрытых заявок"
        : `${data.sliExecution}%`;

    return `
        <p class="conclusion-text">
            За выбранный период создано <strong>${data.created}</strong> заявок, завершено <strong>${data.completed}</strong>, отменено <strong>${data.cancelled}</strong>.
            SLI выполнения заявок составляет <strong>${sliText}</strong>.
        </p>

        <p class="conclusion-text">
            На дату формирования отчёта в системе учитывается <strong>${data.currentTotal}</strong> заявок с учётом выбранного фильтра статусов.
            Активных заявок: <strong>${data.currentActive}</strong>.
        </p>

        ${topOrg
            ? `<p class="conclusion-text">
                    Наибольшее количество заявок за период поступило от организации <strong>${escapeHtml(topOrg.org)}</strong>: ${topOrg.created}.
               </p>`
            : ""
        }

        ${topTopic
            ? `<p class="conclusion-text">
                    Наиболее распространённая тематика обращений за период — <strong>${escapeHtml(topTopic[0])}</strong>: ${topTopic[1]}.
               </p>`
            : ""
        }

        <p class="conclusion-text">
            Показатели отчёта могут использоваться для оценки интенсивности обращений, текущей загрузки и соблюдения лимитов технической поддержки.
        </p>
    `;
}

function buildMonthlyReportStats(items) {
    const months = {};
    const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

    function ensureMonth(date) {
        const monthNumber = String(date.getMonth() + 1).padStart(2, "0");
        const key = `${date.getFullYear()}-${monthNumber}`;

        if (!months[key]) {
            months[key] = {
                label: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
                created: 0,
                finished: 0,
                cancelled: 0
            };
        }

        return months[key];
    }

    items.forEach(item => {
        const createdDate = parseRuDate(item.date);
        if (createdDate && isDateInSelectedPeriod(createdDate)) {
            ensureMonth(createdDate).created++;
        }

        const finishedDate = parseRuDate(item.finishedDate);
        if (finishedDate && isDateInSelectedPeriod(finishedDate)) {
            ensureMonth(finishedDate).finished++;
        }

        const cancelledDate = parseRuDate(item.cancelledDate);
        if (cancelledDate && isDateInSelectedPeriod(cancelledDate)) {
            ensureMonth(cancelledDate).cancelled++;
        }
    });

    return Object.keys(months)
        .sort()
        .map(key => months[key]);
}

function buildOrganizationHoursReportStats(items) {
    const stats = {};

    items.forEach(item => {
        if (!item.org || item.org === "-") {
            return;
        }

        if (!stats[item.org]) {
            stats[item.org] = {
                org: item.org,
                count: 0,
                spent: 0,
                limit: 0
            };
        }

        stats[item.org].count++;
        stats[item.org].spent += Number(item.hours || 0);
    });

    (window.organizationHours || []).forEach(item => {
        const name = item.orgName ?? item.OrgName;
        const limit = Number(item.limitHours ?? item.LimitHours ?? 0);

        if (!name) {
            return;
        }

        if (!stats[name]) {
            stats[name] = {
                org: name,
                count: 0,
                spent: 0,
                limit
            };
        } else {
            stats[name].limit = limit;
        }
    });

    return Object.values(stats)
        .sort((a, b) => b.spent - a.spent);
}

function isDateInSelectedPeriod(date) {
    if (!date || Number.isNaN(date.getTime())) {
        return false;
    }

    const filters = collectFilters();

    if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);

        if (date < start) {
            return false;
        }
    }

    if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);

        if (date > end) {
            return false;
        }
    }

    return true;
}

function getReportStatusOrder() {
    const allStatuses = [
        "Создана",
        "В работе",
        "Уточнение",
        "Ожидание",
        "Завершена",
        "Отменена"
    ];

    const selectedStatuses = collectFilters().statuses;

    if (selectedStatuses.length > 0) {
        return allStatuses.filter(status => selectedStatuses.includes(status));
    }

    return allStatuses;
}

function orderedStatusEntries(statuses) {
    const order = getReportStatusOrder();
    const result = order.map(status => [status, statuses?.[status] || 0]);

    Object.entries(statuses || {}).forEach(([status, value]) => {
        if (!order.includes(status)) {
            result.push([status, value]);
        }
    });

    return result;
}

function countBy(items, selector) {
    return items.reduce((result, item) => {
        const key = selector(item) || "Не указано";
        result[key] = (result[key] || 0) + 1;
        return result;
    }, {});
}

function toSortedEntries(object) {
    return Object.entries(object || {})
        .sort((a, b) => b[1] - a[1]);
}

function getReportPeriodText() {
    const from = document.getElementById("dateFrom")?.value || "";
    const to = document.getElementById("dateTo")?.value || "";

    if (!from && !to) {
        return "Период не ограничен";
    }

    if (from && to) {
        return `${formatInputDate(from)} — ${formatInputDate(to)}`;
    }

    if (from) {
        return `с ${formatInputDate(from)}`;
    }

    return `по ${formatInputDate(to)}`;
}

function getReportFiltersText(includeStatus = true) {
    const parts = [];

    addReportFilterPart(parts, "Организации", ".filter-org");
    addReportFilterPart(parts, "Филиалы", ".filter-branch");
    addReportFilterPart(parts, "Продукты", ".filter-product");
    addReportFilterPart(parts, "Клиенты", ".filter-client");

    if (includeStatus) {
        addReportFilterPart(parts, "Статусы", ".filter-status");
    }

    const search = document.getElementById("searchInput")?.value?.trim();

    if (search) {
        parts.push(`Поиск: ${search}`);
    }

    return parts.length ? parts.join("; ") : "Без дополнительных фильтров";
}

function getReportStatusFiltersText() {
    const values = [...document.querySelectorAll(".filter-status:checked")]
        .filter(cb => cb.value !== "all" && !cb.disabled)
        .map(cb => cb.parentElement.textContent.trim());

    return values.length ? values.join(", ") : "Все статусы";
}

function addReportFilterPart(parts, label, selector) {
    const values = [...document.querySelectorAll(`${selector}:checked`)]
        .filter(cb => cb.value !== "all" && !cb.disabled)
        .map(cb => cb.parentElement.textContent.trim());

    if (values.length > 0) {
        parts.push(`${label}: ${values.join(", ")}`);
    }
}

function formatInputDate(value) {
    if (!value) {
        return "";
    }

    const parts = value.split("-");

    if (parts.length !== 3) {
        return value;
    }

    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatDateTime(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

/* =========================
   CREATE MODAL
========================= */

function initCreateRequestModal() {
    const modal = document.getElementById("createModal");

    if (!modal) return;

    const open = document.getElementById("btnCreateRequest");
    const close = document.getElementById("closeModalBtn");
    const cancel = document.getElementById("cancelModalBtn");

    open?.addEventListener("click", () => {
        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";

        setTimeout(() => {
            document.getElementById("reqTitle")?.focus();
        }, 80);
    });

    close?.addEventListener("click", closeCreateModal);
    cancel?.addEventListener("click", closeCreateModal);

    modal.addEventListener("click", e => {
        if (e.target.classList.contains("modal-overlay")) {
            closeCreateModal();
        }
    });

    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && !modal.classList.contains("hidden")) {
            closeCreateModal();
        }
    });
}

function closeCreateModal() {
    const modal = document.getElementById("createModal");

    if (!modal) return;

    modal.classList.add("hidden");
    document.body.style.overflow = "";

    const form = document.getElementById("createRequestForm");
    if (form) form.reset();

    resetCreateDependentFields();
    resetEstimateBox();
}

function resetCreateDependentFields() {
    const branch = document.getElementById("reqBranch");
    const product = document.getElementById("reqProduct");
    const createdBy = document.getElementById("reqCreatedBy");

    if (branch) {
        branch.innerHTML = `<option value="">Выберите филиал</option>`;
    }

    if (product) {
        [...product.options].forEach(option => {
            if (option.value) {
                option.hidden = false;
                option.disabled = false;
            }
        });

        product.value = "";
    }

    if (createdBy && window.canCreateForOthers) {
        createdBy.innerHTML = `<option value="">Выберите пользователя</option>`;
    }

    refreshAllCustomSelects();
}

/* =========================
CREATE CASCADE
========================= */

function initCreateOrgBranch() {
    const org = document.getElementById("reqOrganization");
    const branch = document.getElementById("reqBranch");

    if (!org) return;

    org.addEventListener("change", async () => {
        if (!org.value) {
            resetCreateDependentFields();
            scheduleEstimateUpdate();
            return;
        }

        await loadCreateBranches(org.value);
        await loadCreateUsers(org.value, branch?.value || null);
        filterCreateProducts(org.value);

        scheduleEstimateUpdate();
    });

    branch?.addEventListener("change", async () => {
        if (!org.value) {
            showToast("Сначала выберите организацию");
            return;
        }

        await loadCreateUsers(org.value, branch.value || null);
        scheduleEstimateUpdate();
    });
}

async function loadCreateBranches(orgId) {
    const branch = document.getElementById("reqBranch");

    if (!branch) return;

    branch.innerHTML = `<option value="">Загрузка...</option>`;
    branch.disabled = true;

    try {
        const result = await fetchJson(`?handler=ApiBranches&orgId=${encodeURIComponent(orgId)}`);

        branch.innerHTML = `<option value="">Выберите филиал</option>`;

        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
            result.data.forEach(item => {
                branch.add(new Option(item.address, item.id));
            });
        } else {
            const option = new Option("Нет доступных филиалов", "");
            option.disabled = true;
            branch.add(option);
        }
    } catch {
        branch.innerHTML = `<option value="">Ошибка загрузки</option>`;
    } finally {
        branch.disabled = false;
        refreshCustomSelect("reqBranch");
    }
}

async function loadCreateUsers(orgId, branchId = null) {
    const createdBy = document.getElementById("reqCreatedBy");

    if (!createdBy || !window.canCreateForOthers) return;

    createdBy.innerHTML = `<option value="">Загрузка...</option>`;
    createdBy.disabled = true;

    try {
        let url = `?handler=ApiUsers&orgId=${encodeURIComponent(orgId)}`;

        if (branchId) {
            url += `&branchId=${encodeURIComponent(branchId)}`;
        }

        const result = await fetchJson(url);

        createdBy.innerHTML = `<option value="">Выберите пользователя</option>`;

        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
            result.data.forEach(user => {
                createdBy.add(new Option(user.fullName, user.id));
            });
        } else {
            const option = new Option("Нет доступных пользователей", "");
            option.disabled = true;
            createdBy.add(option);
        }
    } catch {
        createdBy.innerHTML = `<option value="">Ошибка загрузки</option>`;
    } finally {
        createdBy.disabled = false;
        refreshCustomSelect("reqCreatedBy");
    }
}

function filterCreateProducts(orgId) {
    const product = document.getElementById("reqProduct");

    if (!product || !window.organizationProducts) return;

    const allowed = window.organizationProducts[String(orgId)] || window.organizationProducts[orgId] || [];
    const allowedIds = new Set(allowed.map(Number));

    let hasAvailable = false;

    [...product.options].forEach(option => {
        if (!option.value) return;

        const available = allowedIds.size === 0 || allowedIds.has(Number(option.value));

        option.hidden = !available;
        option.disabled = !available;

        if (available) {
            hasAvailable = true;
        }
    });

    product.value = "";

    if (!hasAvailable) {
        showToast("Для выбранной организации нет доступных продуктов");
    }

    refreshCustomSelect("reqProduct");
}

/* =========================
   CUSTOM SELECTS IN MODAL
========================= */

const customSelectIds = [
    "reqTopic",
    "reqOrganization",
    "reqBranch",
    "reqProduct",
    "reqPriority",
    "reqCreatedBy"
];

function initCustomSelects() {
    customSelectIds.forEach(id => {
        const select = document.getElementById(id);

        if (!select || select.type === "hidden") return;
        if (select.dataset.customReady === "true") return;

        buildCustomSelect(select);
    });

    document.addEventListener("click", e => {
        if (!e.target.closest(".custom-select")) {
            closeAllCustomSelects();
        }
    });

    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            closeAllCustomSelects();
        }
    });
}

function buildCustomSelect(select) {
    select.dataset.customReady = "true";
    select.classList.add("native-select-hidden");

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";
    wrapper.dataset.selectId = select.id;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "custom-select-toggle";

    const value = document.createElement("span");
    value.className = "custom-select-value";

    const arrow = document.createElement("span");
    arrow.className = "custom-select-arrow";
    arrow.textContent = "▾";

    button.appendChild(value);
    button.appendChild(arrow);

    const menu = document.createElement("div");
    menu.className = "custom-select-menu hidden";

    wrapper.appendChild(button);
    wrapper.appendChild(menu);

    select.insertAdjacentElement("afterend", wrapper);

    button.addEventListener("click", e => {
        e.stopPropagation();

        if (select.disabled) return;

        const isOpen = !menu.classList.contains("hidden");

        closeAllCustomSelects();

        if (!isOpen) {
            menu.classList.remove("hidden");
            wrapper.classList.add("open");
        }
    });

    select.addEventListener("change", () => {
        refreshCustomSelect(select.id);
    });

    refreshCustomSelect(select.id);
}

function refreshCustomSelect(selectId) {
    const select = document.getElementById(selectId);
    const wrapper = document.querySelector(`.custom-select[data-select-id="${selectId}"]`);

    if (!select || !wrapper) return;

    const value = wrapper.querySelector(".custom-select-value");
    const menu = wrapper.querySelector(".custom-select-menu");

    if (!value || !menu) return;

    const selectedOption = select.options[select.selectedIndex];

    value.textContent = selectedOption?.textContent?.trim() || "Выберите значение";
    value.classList.toggle("placeholder", !select.value);

    wrapper.classList.toggle("disabled", select.disabled);

    menu.innerHTML = "";

    [...select.options].forEach(option => {
        if (option.hidden) return;

        const item = document.createElement("button");
        item.type = "button";
        item.className = "custom-select-option";
        item.textContent = option.textContent.trim();
        item.dataset.value = option.value;

        if (!option.value) {
            item.classList.add("placeholder-option");
        }

        if (option.disabled) {
            item.disabled = true;
            item.classList.add("disabled");
        }

        if (option.value === select.value) {
            item.classList.add("selected");
        }

        item.addEventListener("click", e => {
            e.stopPropagation();

            if (item.disabled) return;

            select.value = option.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));

            closeAllCustomSelects();
            refreshCustomSelect(selectId);
        });

        menu.appendChild(item);
    });
}

function refreshAllCustomSelects() {
    customSelectIds.forEach(id => refreshCustomSelect(id));
}

function closeAllCustomSelects() {
    document.querySelectorAll(".custom-select").forEach(wrapper => {
        wrapper.classList.remove("open");
    });

    document.querySelectorAll(".custom-select-menu").forEach(menu => {
        menu.classList.add("hidden");
    });
}

/* =========================
   ESTIMATE MODEL IN MODAL
========================= */

function initEstimateEvents() {
    const ids = [
        "reqTopic",
        "reqOrganization",
        "reqBranch",
        "reqProduct",
        "reqPriority",
        "reqDescription"
    ];

    ids.forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;

        const eventName = element.tagName === "TEXTAREA" ? "input" : "change";
        element.addEventListener(eventName, scheduleEstimateUpdate);
    });
}

function scheduleEstimateUpdate() {
    clearTimeout(estimateTimer);

    estimateTimer = setTimeout(() => {
        updateEstimate();
    }, 350);
}

async function updateEstimate() {
    const topic = document.getElementById("reqTopic")?.value || "";
    const organizationId = document.getElementById("reqOrganization")?.value || "";
    const branchId = document.getElementById("reqBranch")?.value || "";
    const productId = document.getElementById("reqProduct")?.value || "";
    const priority = document.getElementById("reqPriority")?.value || "";
    const description = document.getElementById("reqDescription")?.value || "";

    const hasRequired = topic && organizationId && productId && priority;

    if (!hasRequired) {
        resetEstimateBox();
        return;
    }

    setEstimateLoading();

    if (estimateAbortController) {
        estimateAbortController.abort();
    }

    estimateAbortController = new AbortController();

    const params = new URLSearchParams({
        requestTopicId: topic,
        organizationId,
        productId,
        requestPriorityId: priority,
        description
    });

    if (branchId) {
        params.append("branchId", branchId);
    }

    try {
        const response = await fetch(`?handler=ApiEstimateHours&${params.toString()}`, {
            method: "GET",
            signal: estimateAbortController.signal
        });

        const result = await response.json();

        if (!result.success) {
            setEstimateError(result.error || "Не удалось рассчитать время");
            return;
        }

        renderEstimate(result.data);
    } catch (error) {
        if (error.name === "AbortError") return;

        setEstimateError("Ошибка расчёта времени");
    }
}

function resetEstimateBox() {
    const box = document.getElementById("estimateBox");
    const value = document.getElementById("estimateHoursValue");
    const quality = document.getElementById("estimateQuality");
    const details = document.getElementById("estimateDetails");

    if (!box || !value || !quality || !details) return;

    box.className = "estimate-box estimate-empty";
    value.textContent = "—";
    quality.textContent = "Заполните тему, организацию, продукт и приоритет";
    details.textContent = "Расчёт появится после выбора основных параметров заявки.";
}

function setEstimateLoading() {
    const box = document.getElementById("estimateBox");
    const value = document.getElementById("estimateHoursValue");
    const quality = document.getElementById("estimateQuality");
    const details = document.getElementById("estimateDetails");

    if (!box || !value || !quality || !details) return;

    box.className = "estimate-box estimate-loading";
    value.textContent = "…";
    quality.textContent = "Идёт расчёт";
    details.textContent = "Сравниваю заявку с предыдущими обращениями.";
}
function setEstimateError(message) {
    const box = document.getElementById("estimateBox");
    const value = document.getElementById("estimateHoursValue");
    const quality = document.getElementById("estimateQuality");
    const details = document.getElementById("estimateDetails");

    if (!box || !value || !quality || !details) return;

    box.className = "estimate-box estimate-error";
    value.textContent = "—";
    quality.textContent = "Ошибка расчёта";
    details.textContent = message || "Не удалось рассчитать прогнозное время.";
}

function renderEstimate(data) {
    const box = document.getElementById("estimateBox");
    const value = document.getElementById("estimateHoursValue");
    const quality = document.getElementById("estimateQuality");
    const details = document.getElementById("estimateDetails");

    if (!box || !value || !quality || !details) return;

    const hours = Number(data.estimatedHours || 0);
    const sampleCount = Number(data.sampleCount || 0);
    const confidence = data.confidence || "low";

    let className = "estimate-box estimate-low";
    let qualityText = "Низкая точность";

    if (confidence === "high") {
        className = "estimate-box estimate-high";
        qualityText = "Высокая точность";
    } else if (confidence === "medium") {
        className = "estimate-box estimate-medium";
        qualityText = "Средняя точность";
    }

    box.className = className;
    value.textContent = `${formatHours(hours)}`;
    quality.textContent = qualityText;

    if (sampleCount > 0) {
        details.textContent = `Расчёт выполнен на основе ${sampleCount} похожих завершённых заявок.`;
    } else {
        details.textContent = "Расчёт выполнен по базовой оценке темы и приоритета.";
    }
}

/* =========================
   CREATE REQUEST SUBMIT
========================= */

function initCreateRequestSubmit() {
    const form = document.getElementById("createRequestForm");

    if (!form) return;

    form.addEventListener("submit", async e => {
        e.preventDefault();

        const title = document.getElementById("reqTitle")?.value.trim() || "";

        const topicId = document.getElementById("reqTopic")?.value || "";

        const organizationId = document.getElementById("reqOrganization")?.value || "";
        const branchId = document.getElementById("reqBranch")?.value || "";
        const productId = document.getElementById("reqProduct")?.value || "";

        const priorityId = document.getElementById("reqPriority")?.value || "";
        const createdByRaw = document.getElementById("reqCreatedBy")?.value || "";
        const description = document.getElementById("reqDescription")?.value.trim() || "";

        if (!title) {
            return showToastAndFocus("Введите заголовок", "reqTitle");
        }

        if (!topicId) {
            return showToastAndFocus("Выберите тему", "reqTopic");
        }

        if (!organizationId) {
            return showToastAndFocus("Выберите организацию", "reqOrganization");
        }

        if (!productId) {
            return showToastAndFocus("Выберите продукт", "reqProduct");
        }

        if (!priorityId) {
            return showToastAndFocus("Выберите приоритет", "reqPriority");
        }

        let createdById = createdByRaw;

        if (window.canCreateForOthers) {
            if (!createdById) {
                return showToastAndFocus("Выберите пользователя", "reqCreatedBy");
            }
        } else {
            createdById = window.currentUserId;
        }

        const fd = new FormData();

        const token = document.querySelector("#antiForgeryForm input[name='__RequestVerificationToken']");

        if (token) {
            fd.append("__RequestVerificationToken", token.value);
        }

        fd.append("Title", title);
        fd.append("RequestTopicId", topicId);
        fd.append("OrganizationId", organizationId);
        fd.append("BranchId", branchId);
        fd.append("ProductId", productId);
        fd.append("RequestPriorityId", priorityId);
        fd.append("CreatedById", createdById);
        fd.append("Description", description);

        const fileInput = document.getElementById("reqFile");

        if (fileInput?.files?.length) {
            [...fileInput.files].forEach(file => {
                fd.append("Files", file);
            });
        }

        const submitBtn = document.getElementById("createSubmitBtn") || form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent || "Сохранить";

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Сохранение...";
            }

            const response = await fetch("?handler=Create", {
                method: "POST",
                body: fd
            });

            const result = await response.json();

            if (result.success) {
                showToast("Заявка создана");
                closeCreateModal();

                setTimeout(() => {
                    location.reload();
                }, 700);
            } else {
                showToast(result.error || result.details || "Ошибка создания заявки");
            }
        } catch (error) {
            showToast("Ошибка соединения");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    });
}

/* =========================
   HELPERS
========================= */

function getSelectedOptionDataId(selectId) {
    const select = document.getElementById(selectId);

    if (!select) {
        return "";
    }

    const option = select.options[select.selectedIndex];

    return option?.dataset?.id || "";
}

async function fetchJson(url) {
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Accept": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
}

function parseRuDate(value) {
    if (!value) return null;

    const parts = value.split(".");

    if (parts.length !== 3) {
        return null;
    }

    const day = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const year = Number(parts[2]);

    if (!day || month < 0 || !year) {
        return null;
    }

    const date = new Date(year, month, day);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}

function toInputDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatHours(value) {
    const number = Number(value || 0);

    if (number === 0) {
        return "0 ч";
    }

    if (number < 1) {
        return `${Math.round(number * 60)} мин`;
    }

    return `${number.toFixed(1).replace(".", ",")} ч`;
}

function showToastAndFocus(message, elementId) {
    showToast(message);

    const element = document.getElementById(elementId);

    if (element) {
        element.focus();

        const wrapper = document.querySelector(`.custom-select[data-select-id="${elementId}"]`);

        if (wrapper) {
            wrapper.classList.add("open");

            const menu = wrapper.querySelector(".custom-select-menu");
            if (menu) {
                menu.classList.remove("hidden");
            }
        }
    }
}

function showToast(message) {
    let toast = document.getElementById("toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.remove("fade-out");
    toast.classList.add("visible");

    clearTimeout(toast._timer);

    toast._timer = setTimeout(() => {
        toast.classList.add("fade-out");
        toast.classList.remove("visible");
    }, 2600);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}