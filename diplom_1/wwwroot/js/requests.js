let filtersVisible = false;
let selectedStartDate = null;
let selectedEndDate = null;

document.addEventListener("DOMContentLoaded", () => {
    initFilterPanel();
    initDropdowns();
    initCalendar();
    initSearch();
    initRowClicks();
    initAnalyticsToggle();
    bindFilterOrgBranch();
    bindCreateOrgBranch();
    initCreateRequestSubmit();
    initModal();
});

/* --------------------- ФИЛЬТР-ПАНЕЛЬ --------------------- */

function initFilterPanel() {
    const btn = document.getElementById("toggleFiltersBtn");
    const panel = document.getElementById("filtersPanel");
    const applyBtn = document.getElementById("applyFiltersBtn");
    const clearBtn = document.getElementById("clearFiltersBtn");

    if (!btn) return;

    btn.addEventListener("click", () => {
        filtersVisible = !filtersVisible;
        panel.classList.toggle("hidden", !filtersVisible);
        btn.textContent = filtersVisible ? "Скрыть фильтры" : "Фильтры";
    });

    applyBtn?.addEventListener("click", applyFilters);
    clearBtn?.addEventListener("click", clearFilters);
}

/* --------------------- DROPDOWNS --------------------- */

function initDropdowns() {
    document.querySelectorAll(".dropdown-toggle").forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            const menu = btn.nextElementSibling;
            closeAllDropdowns(menu);
            menu.classList.toggle("hidden");
        });
    });

    document.addEventListener("click", () =>
        closeAllDropdowns(null)
    );

    document.querySelectorAll(".dropdown-menu input[type=checkbox]").forEach(cb => {
        cb.addEventListener("change", e => {
            updateDropdownLabel(e.target.closest(".dropdown-menu"));
        });
    });
}

function closeAllDropdowns(except) {
    document.querySelectorAll(".dropdown-menu").forEach(m => {
        if (m !== except) m.classList.add("hidden");
    });
}

function updateDropdownLabel(menu) {
    const toggle = menu.previousElementSibling;
    const all = menu.querySelector("input[value='all']");
    const others = [...menu.querySelectorAll("input:not([value='all'])")];
    const checked = [...menu.querySelectorAll("input:checked:not([value='all'])")];

    if (all && all.checked) {
        toggle.textContent = "Все";
        return;
    }

    if (checked.length === 0) {
        toggle.textContent = "Нет выбранных";
        return;
    }

    toggle.textContent = `Выбрано (${checked.length})`;
}

/* --------------------- МОДАЛКА --------------------- */

function initModal() {
    const modal = document.getElementById("createModal");
    const open = document.getElementById("btnCreateRequest");
    const close = document.getElementById("closeModalBtn");
    const cancel = document.getElementById("cancelModalBtn");

    if (!modal) return;

    const closeModal = () => {
        modal.classList.add("hidden");
        document.body.style.overflow = "";
    };

    open?.addEventListener("click", () => {
        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    });

    close?.addEventListener("click", closeModal);
    cancel?.addEventListener("click", closeModal);

    window.addEventListener("click", e => {
        if (e.target.classList.contains("modal-overlay")) closeModal();
    });
}

/* --------------------- ПОИСК --------------------- */

function initSearch() {
    const input = document.getElementById("searchInput");
    if (!input) return;

    input.addEventListener("input", () => {
        const v = input.value.toLowerCase();
        document.querySelectorAll("#requestsTable tbody tr").forEach(row => {
            const text = row.children[0].textContent.toLowerCase();
            row.style.display = text.includes(v) ? "" : "none";
        });
    });
}

/* --------------------- ЗАВИСИМОСТЬ ОРГ → ФИЛИАЛЫ (МОДАЛКА) --------------------- */

function bindCreateOrgBranch() {
    const org = document.getElementById("reqOrganization");
    const branch = document.getElementById("reqBranch");
    const createdBy = document.getElementById("reqCreatedBy");

    if (!org || !branch) return;

    const clearBranches = () => {
        branch.innerHTML = `<option value="">Выберите филиал (необязательно)</option>`;
    };

    const clearUsers = () => {
        if (!createdBy) return;
        createdBy.innerHTML = `<option value="">Выберите пользователя</option>`;
    };

    const loadBranches = async (orgId) => {
        clearBranches();
        const r = await fetch(`/Requests?handler=BranchesByOrgs&orgIds=${orgId}`);
        const data = await r.json();
        data.forEach(b => {
            branch.innerHTML += `<option value="${b.id}">${b.address}</option>`;
        });
    };

    const loadUsers = async () => {
        if (!createdBy || !org.value) return;

        clearUsers();

        const url = `/Requests?handler=UsersByOrgBranch&orgId=${org.value}&branchId=${branch.value || ""}`;
        const r = await fetch(url);
        const data = await r.json();

        data.forEach(u => {
            createdBy.innerHTML += `<option value="${u.id}">${u.fullName}</option>`;
        });
    };

    org.addEventListener("change", async () => {
        clearBranches();
        clearUsers();
        if (!org.value) return;
        await loadBranches(org.value);
        await loadUsers();
    });

    branch.addEventListener("change", loadUsers);
}

/* --------------------- CREATE REQUEST --------------------- */

function initCreateRequestSubmit() {
    const form = document.getElementById("createRequestForm");
    if (!form) return;

    form.addEventListener("submit", async e => {
        e.preventDefault();

        const fd = new FormData();
        const token = document.querySelector("#antiForgeryForm input");
        if (token) fd.append("__RequestVerificationToken", token.value);

        [
            "Title", "Topic", "OrganizationId", "BranchId",
            "ProductId", "Priority", "Description", "CreatedById"
        ].forEach(f => {
            const el = document.getElementById("req" + f);
            fd.append(f, el ? el.value : "");
        });

        const file = document.getElementById("reqFile");
        if (file?.files.length > 0) fd.append("File", file.files[0]);

        const res = await fetch("/Requests?handler=Create", { method: "POST", body: fd });

        if (!res.ok) {
            showToast("Ошибка создания заявки");
            return;
        }

        showToast("Заявка успешно создана!");
        setTimeout(() => location.reload(), 700);
    });
}

/* --------------------- ФИЛЬТРЫ: ОРГАНИЗАЦИИ → ФИЛИАЛЫ --------------------- */

function bindFilterOrgBranch() {
    const orgCheckboxes = document.querySelectorAll(".filter-org");
    const branchMenu = document.getElementById("branchFilterMenu");

    if (!orgCheckboxes.length || !branchMenu) return;

    orgCheckboxes.forEach(cb => {
        cb.addEventListener("change", async () => {
            const ids = [...orgCheckboxes]
                .filter(x => x.checked && x.value !== "all")
                .map(x => x.value);

            const orgsForQuery = ids.length === 0 ? "all" : ids.join(",");
            const r = await fetch(`/Requests?handler=BranchesByOrgs&orgIds=${orgsForQuery}`);
            const data = await r.json();

            branchMenu.innerHTML = "";

            branchMenu.innerHTML += `<label><input type="checkbox" value="all" checked /> Все</label>`;

            data.forEach(b => {
                branchMenu.innerHTML +=
                    `<label><input type="checkbox" class="filter-branch" value="${b.id}" /> ${b.address}</label>`;
            });
        });
    });
}

/* --------------------- КАЛЕНДАРЬ --------------------- */

function initCalendar() {
    const c = document.getElementById("calendarContainer");
    if (!c) return;

    const now = new Date();
    let month = now.getMonth();
    let year = now.getFullYear();

    const render = () => {
        c.innerHTML = "";
        const header = document.createElement("div");
        header.className = "calendar-header";

        const prev = document.createElement("button");
        prev.className = "btn small secondary";
        prev.textContent = "‹";
        prev.onclick = () => {
            month = month === 0 ? 11 : month - 1;
            if (month === 11) year--;
            render();
        };

        const next = document.createElement("button");
        next.className = "btn small secondary";
        next.textContent = "›";
        next.onclick = () => {
            month = month === 11 ? 0 : month + 1;
            if (month === 0) year++;
            render();
        };

        const title = document.createElement("div");
        title.textContent =
            `${["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
                "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"][month]} ${year}`;

        header.append(prev, title, next);
        c.append(header);

        const grid = document.createElement("div");
        grid.className = "calendar-grid";

        const first = new Date(year, month, 1).getDay() || 7;
        const total = new Date(year, month + 1, 0).getDate();

        for (let i = 1; i < first; i++)
            grid.append(createCalendarCell("", "empty"));

        for (let d = 1; d <= total; d++) {
            const cell = createCalendarCell(d);
            const dateObj = new Date(year, month, d);

            if (isSameDay(dateObj, new Date())) cell.classList.add("today");
            if (isSameDay(dateObj, selectedStartDate)) cell.classList.add("selected");
            if (isSameDay(dateObj, selectedEndDate)) cell.classList.add("selected");

            cell.onclick = () => selectDate(dateObj);
            grid.append(cell);
        }

        c.append(grid);
    };

    const createCalendarCell = (text, cls) => {
        const div = document.createElement("div");
        div.className = "calendar-cell " + (cls || "");
        div.textContent = text;
        return div;
    };

    const selectDate = d => {
        if (!selectedStartDate || selectedEndDate) {
            selectedStartDate = d;
            selectedEndDate = null;
        } else if (d < selectedStartDate) {
            selectedEndDate = selectedStartDate;
            selectedStartDate = d;
        } else {
            selectedEndDate = d;
        }
        render();
    };

    const isSameDay = (a, b) =>
        b && a.getDate() === b.getDate() &&
        a.getMonth() === b.getMonth() &&
        a.getFullYear() === b.getFullYear();

    render();
}

/* --------------------- ПРИМЕНЕНИЕ ФИЛЬТРОВ --------------------- */

function applyFilters() {
    const f = collectFilters();

    document.querySelectorAll("#requestsTable tbody tr").forEach(row => {
        const cols = row.children;

        const vOrg = cols[2].textContent.toLowerCase();
        const vBranch = cols[3].textContent.toLowerCase();
        const vProd = cols[4].textContent.toLowerCase();
        const vPri = cols[5].textContent.toLowerCase();
        const vStatus = cols[6].textContent.toLowerCase();
        const vClient = row.querySelector("td:nth-last-child(2)")?.textContent.toLowerCase() || "";
        const vDate = cols[cols.length - 1].textContent;

        let visible = true;

        if (!f.orgs.includes("all") && f.orgs.length)
            visible = visible && f.orgs.some(x => vOrg.includes(x.toLowerCase()));

        if (!f.branches.includes("all") && f.branches.length)
            visible = visible && f.branches.some(x => vBranch.includes(x.toLowerCase()));

        if (!f.products.includes("all") && f.products.length)
            visible = visible && f.products.some(x => vProd.includes(x.toLowerCase()));

        if (!f.statuses.includes("all") && f.statuses.length)
            visible = visible && f.statuses.some(x => vStatus.includes(x.toLowerCase()));

        if (!f.clients.includes("all") && f.clients.length)
            visible = visible && f.clients.some(x => vClient.includes(x.toLowerCase()));

        if (f.startDate || f.endDate) {
            const [dd, mm, yy] = vDate.split(".");
            const dt = new Date(`${yy}-${mm}-${dd}`);

            if (f.startDate && dt < new Date(f.startDate)) visible = false;
            if (f.endDate && dt > new Date(f.endDate)) visible = false;
        }

        row.style.display = visible ? "" : "none";
    });

    showToast("Фильтры применены");
}

function clearFilters() {
    document.querySelectorAll(".dropdown-menu input[type=checkbox]").forEach(cb => cb.checked = true);
    document.querySelectorAll(".dropdown-toggle").forEach(t => t.textContent = "Все");
    selectedStartDate = null;
    selectedEndDate = null;
    showToast("Фильтры сброшены");
}

function collectFilters() {
    return {
        orgs: getChecked(".filter-org"),
        branches: getChecked(".filter-branch"),
        products: getChecked(".filter-product"),
        statuses: getChecked(".filter-status"),
        priorities: getChecked(".filter-priority"),
        clients: getChecked(".filter-client"),
        startDate: selectedStartDate ? selectedStartDate.toISOString().split("T")[0] : null,
        endDate: selectedEndDate ? selectedEndDate.toISOString().split("T")[0] : null
    };
}

function getChecked(selector) {
    return [...document.querySelectorAll(selector + ":checked")].map(cb => cb.value);
}

/* --------------------- РЯДЫ ТАБЛИЦЫ --------------------- */

function initRowClicks() {
    document.querySelectorAll("#requestsTable tbody tr").forEach(r => {
        r.addEventListener("dblclick", () => {
            window.location.href = `/Requests/Details/${r.dataset.requestId}`;
        });
    });
}

/* --------------------- ТОСТЫ --------------------- */

function showToast(msg) {
    const div = document.createElement("div");
    div.className = "toast";
    div.textContent = msg;
    document.body.append(div);
    setTimeout(() => div.classList.add("fade-out"), 2000);
    setTimeout(() => div.remove(), 2500);
}

/* --------------------- АНАЛИТИКА --------------------- */

function initAnalyticsToggle() {
    const btn = document.getElementById("toggleAnalyticsBtn");
    const sec = document.getElementById("analyticsSection");
    if (!btn || !sec) return;

    let rendered = false;

    btn.addEventListener("click", () => {
        const collapsed = sec.classList.toggle("collapsed");
        btn.textContent = collapsed ? "Показать аналитику" : "Скрыть аналитику";

        if (!collapsed && !rendered) {
            renderAnalyticsCharts();
            rendered = true;
        }
    });
}

function renderAnalyticsCharts() {
    const rows = document.querySelectorAll("#requestsTable tbody tr");
    if (!rows.length) return;

    const statusData = {};
    const dateData = {};

    rows.forEach(r => {
        const cols = r.children;
        const status = cols[6].textContent.trim();
        const date = cols[cols.length - 1].textContent.trim();

        statusData[status] = (statusData[status] || 0) + 1;

        const key = date.split(".").reverse().join("-");
        dateData[key] = (dateData[key] || 0) + 1;
    });

    const ctxStatus = document.getElementById("chartStatus");
    const ctxDates = document.getElementById("chartDates");

    const statuses = Object.keys(statusData);
    const statusValues = Object.values(statusData);

    new Chart(ctxStatus, {
        type: "doughnut",
        data: {
            labels: statuses,
            datasets: [{
                data: statusValues,
                backgroundColor: ["#60a5fa", "#facc15", "#22c55e", "#ef4444"]
            }]
        },
        options: { cutout: "70%" }
    });

    const sortedDates = Object.keys(dateData).sort();
    const dateValues = sortedDates.map(d => dateData[d]);

    new Chart(ctxDates, {
        type: "line",
        data: {
            labels: sortedDates.map(d => d.split("-").reverse().join(".")),
            datasets: [{
                label: "Количество заявок",
                data: dateValues,
                borderColor: "#3b82f6",
                tension: 0.3,
                fill: true
            }]
        },
        options: { responsive: true }
    });
}
