let filtersVisible = false;

let trendChart = null;
let orgChart = null;
let statusPeriodChart = null;

let estimateTimer = null;
let estimateAbortController = null;

document.addEventListener("DOMContentLoaded", () => {
    initFilterPanel();
    initDropdowns();
    initSearch();
    initRowClicks();
    initAnalyticsToggle();

    initCreateRequestModal();
    initCreateRequestSubmit();
    initCreateOrgBranch();
    initEstimateEvents();
    initCustomSelects();

    initFilterCascading();

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

        row.style.display = visible ? "" : "none";
    });

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
        hours: Number(row.dataset.workHours || 0)
    };
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
        btn.textContent = collapsed ? "Показать аналитику" : "Скрыть аналитику";

        if (!collapsed) {
            setTimeout(updateAllAnalytics, 120);
        }
    });
}

function updateAllAnalytics() {
    const rows = getVisibleRows();

    updateCurrentStats(rows);
    updateTrendChart(rows);
    updateOrgChart(rows);
    updateStatusPeriodChart(rows);
    updateHoursTable(rows);
}

function getVisibleRows() {
    return [...document.querySelectorAll("#requestsTable tbody tr")]
        .filter(row => row.style.display !== "none");
}

function updateCurrentStats(rows) {
    const created = rows.filter(row => getRowData(row).status === "Создана").length;
    const inWork = rows.filter(row => getRowData(row).status === "В работе").length;

    const currentCreated = document.getElementById("currentCreated");
    const currentInWork = document.getElementById("currentInWork");
    const currentActive = document.getElementById("currentActive");

    if (currentCreated) currentCreated.textContent = created;
    if (currentInWork) currentInWork.textContent = inWork;
    if (currentActive) currentActive.textContent = created + inWork;
}

function updateTrendChart(rows) {
    const canvas = document.getElementById("trendChart");
    if (!canvas || typeof Chart === "undefined") return;

    const months = {};
    const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

    rows.forEach(row => {
        const item = getRowData(row);
        const date = parseRuDate(item.date);

        if (!date) return;

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

        months[key].created++;

        if (item.status === "Завершена") {
            months[key].finished++;
        }

        if (item.status === "Отменена") {
            months[key].cancelled++;
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

    const orgs = {};

    rows.forEach(row => {
        const org = getRowData(row).org;

        if (!org || org === "-") return;

        orgs[org] = (orgs[org] || 0) + 1;
    });

    const data = Object.entries(orgs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    if (orgChart) {
        orgChart.destroy();
    }

    orgChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: data.map(x => x[0]),
            datasets: [
                {
                    label: "Заявок",
                    data: data.map(x => x[1]),
                    backgroundColor: "#8b5cf6",
                    borderRadius: 6,
                    maxBarThickness: 34
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: data.length > 4 ? "y" : "x",
            plugins: {
                legend: {
                    display: false
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

function updateStatusPeriodChart(rows) {
    const canvas = document.getElementById("statusPeriodChart");
    const legend = document.getElementById("statusPeriodLegend");

    if (!canvas || typeof Chart === "undefined") return;

    const data = {
        "Создана": 0,
        "В работе": 0,
        "Завершена": 0,
        "Отменена": 0
    };

    rows.forEach(row => {
        const status = getRowData(row).status;

        if (Object.prototype.hasOwnProperty.call(data, status)) {
            data[status]++;
        }
    });

    const labels = Object.keys(data);
    const values = Object.values(data);

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
                    backgroundColor: ["#60a5fa", "#facc15", "#22c55e", "#ef4444"],
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
        const colors = ["#60a5fa", "#facc15", "#22c55e", "#ef4444"];

        legend.innerHTML = labels.map((label, index) => {
            const value = data[label];
            const percent = total > 0 ? Math.round((value / total) * 100) : 0;

            return `
                <div class="status-legend-item">
                    <span class="status-dot" style="background:${colors[index]}"></span>
                    <span>${escapeHtml(label)}</span>
                    <strong>${value}</strong>
                    <small>${percent}%</small>
                </div>
            `;
        }).join("");
    }
}

function updateHoursTable() {
    const container = document.getElementById("hoursTable");

    if (!container) return;

    const filters = collectFilters();
    const orgNames = getSelectedNames(".filter-org");

    const allRows = [...document.querySelectorAll("#requestsTable tbody tr")];

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

        if (include && item.date) {
            const currentDate = parseRuDate(item.date);

            if (currentDate) {
                if (filters.startDate) {
                    const start = new Date(filters.startDate);
                    start.setHours(0, 0, 0, 0);

                    if (currentDate < start) {
                        include = false;
                    }
                }

                if (include && filters.endDate) {
                    const end = new Date(filters.endDate);
                    end.setHours(23, 59, 59, 999);

                    if (currentDate > end) {
                        include = false;
                    }
                }
            }
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
        container.innerHTML = `<div class="text-muted">Нет данных по лимитам за выбранный период</div>`;
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
        topic,
        organizationId,
        productId,
        priority,
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
    quality.textContent = "Расчёт недоступен";
    details.textContent = message;
}

function renderEstimate(data) {
    const box = document.getElementById("estimateBox");
    const value = document.getElementById("estimateHoursValue");
    const quality = document.getElementById("estimateQuality");
    const details = document.getElementById("estimateDetails");

    if (!box || !value || !quality || !details) return;

    const hours = Number(data.estimatedHours || 0);
    const sampleCount = Number(data.sampleCount || 0);
    const confidence = String(data.confidence || "low").toLowerCase();

    box.className = `estimate-box estimate-${confidence}`;

    value.textContent = `${formatNumber(hours)} ч.`;

    if (confidence === "high") {
        quality.textContent = "Высокая точность";
    } else if (confidence === "medium") {
        quality.textContent = "Средняя точность";
    } else {
        quality.textContent = "Ориентировочный расчёт";
    }

    const parts = [];

    if (sampleCount > 0) {
        parts.push(`Основано на ${sampleCount} похожих заявках.`);
    } else {
        parts.push("Похожих завершённых заявок мало, поэтому используется базовая оценка.");
    }

    if (data.priorityFactor) {
        parts.push(`Коэффициент приоритета: ${formatNumber(data.priorityFactor)}.`);
    }

    if (data.descriptionFactor) {
        parts.push(`Коэффициент описания: ${formatNumber(data.descriptionFactor)}.`);
    }

    details.textContent = parts.join(" ");
}

/* =========================
   CREATE SUBMIT
========================= */

function initCreateRequestSubmit() {
    const form = document.getElementById("createRequestForm");

    if (!form) return;

    form.addEventListener("submit", async e => {
        e.preventDefault();

        const title = document.getElementById("reqTitle")?.value.trim() || "";
        const topic = document.getElementById("reqTopic")?.value || "";
        const organizationId = document.getElementById("reqOrganization")?.value || "";
        const branchId = document.getElementById("reqBranch")?.value || "";
        const productId = document.getElementById("reqProduct")?.value || "";
        const priority = document.getElementById("reqPriority")?.value || "";
        const createdByRaw = document.getElementById("reqCreatedBy")?.value || "";
        const description = document.getElementById("reqDescription")?.value.trim() || "";

        if (!title) return showToastAndFocus("Введите заголовок", "reqTitle");
        if (!topic) return showToastAndFocus("Выберите тему", "reqTopic");
        if (!organizationId) return showToastAndFocus("Выберите организацию", "reqOrganization");
        if (!productId) return showToastAndFocus("Выберите продукт", "reqProduct");
        if (!priority) return showToastAndFocus("Выберите приоритет", "reqPriority");

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
        fd.append("Topic", topic);
        fd.append("OrganizationId", organizationId);
        fd.append("BranchId", branchId);
        fd.append("ProductId", productId);
        fd.append("Priority", priority);
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

async function fetchJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Network error");
    }

    return await response.json();
}

function parseRuDate(value) {
    if (!value) return null;

    const parts = value.split(".");
    if (parts.length !== 3) return null;

    const day = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const year = Number(parts[2]);

    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}

function toInputDate(date) {
    return date.toISOString().split("T")[0];
}

function showToastAndFocus(message, elementId) {
    showToast(message);
    document.getElementById(elementId)?.focus();
}

function showToast(message) {
    document.querySelectorAll(".toast").forEach(toast => toast.remove());

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("visible");
    }, 10);

    setTimeout(() => {
        toast.classList.remove("visible");

        setTimeout(() => {
            toast.remove();
        }, 250);
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

function formatHours(value) {
    const num = Number(value || 0);
    return `${formatNumber(num)} ч.`;
}

function formatNumber(value) {
    const num = Number(value || 0);

    return num
        .toFixed(2)
        .replace(".", ",");
}