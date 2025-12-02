let filtersVisible = false;
let selectedStartDate = null;
let selectedEndDate = null;

document.addEventListener("DOMContentLoaded", () => {
    const toggleFiltersBtn = document.getElementById("toggleFiltersBtn");
    const filtersPanel = document.getElementById("filtersPanel");
    const applyFiltersBtn = document.getElementById("applyFiltersBtn");
    const clearFiltersBtn = document.getElementById("clearFiltersBtn");

    if (toggleFiltersBtn) {
        toggleFiltersBtn.addEventListener("click", () => {
            filtersVisible = !filtersVisible;
            filtersPanel.classList.toggle("hidden", !filtersVisible);
            toggleFiltersBtn.textContent = filtersVisible ? "Скрыть фильтры" : "Фильтры";
        });
    }

    const modal = document.getElementById("createModal");
    const openBtn = document.getElementById("btnCreateRequest");
    const closeBtn = document.getElementById("closeModalBtn");
    const cancelBtn = document.getElementById("cancelModalBtn");

    if (openBtn) openBtn.onclick = () => { modal.classList.remove("hidden"); document.body.style.overflow = "hidden"; };
    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;
    window.addEventListener("click", e => { if (e.target.classList.contains("modal-overlay")) closeModal(); });

    function closeModal() { modal.classList.add("hidden"); document.body.style.overflow = ""; }

    if (applyFiltersBtn) applyFiltersBtn.addEventListener("click", applyFilters);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener("click", clearFilters);

    initDropdowns();
    initCalendar();
    initRowClicks();
    initSearch();
    bindOrgBranchDependency();
    initAnalyticsToggle();
    bindCreateOrgBranchDependency();
    initCreateRequestSubmit();
});


function initDropdowns() {
    document.querySelectorAll(".dropdown-toggle").forEach(t => {
        t.addEventListener("click", e => {
            e.stopPropagation();
            const m = t.nextElementSibling;
            document.querySelectorAll(".dropdown-menu").forEach(x => { if (x !== m) x.classList.add("hidden"); });
            m.classList.toggle("hidden");
        });
    });

    document.querySelectorAll(".dropdown-menu").forEach(m => m.addEventListener("click", e => e.stopPropagation()));
    document.addEventListener("click", () => document.querySelectorAll(".dropdown-menu").forEach(m => m.classList.add("hidden")));

    document.querySelectorAll(".dropdown-menu input[type=checkbox]").forEach(cb => {
        cb.addEventListener("change", e => {
            const menu = e.target.closest(".dropdown-menu");
            const toggle = menu.previousElementSibling;
            const allCb = menu.querySelector("input[value='all']");
            const others = [...menu.querySelectorAll("input:not([value='all'])")];
            const checked = [...menu.querySelectorAll("input:checked:not([value='all'])")];

            if (allCb && allCb.checked) toggle.textContent = "Все";
            else if (checked.length === 0) toggle.textContent = "Нет выбранных";
            else toggle.textContent = `Выбрано (${checked.length})`;

            if (e.target.value === "all") { if (e.target.checked) others.forEach(x => x.checked = false); }
            else {
                if (checked.length > 0 && allCb) allCb.checked = false;
                if (checked.length === 0 && allCb) allCb.checked = true;
            }
        });
    });
}


function initSearch() {
    const input = document.getElementById("searchInput");
    if (!input) return;
    input.addEventListener("input", () => {
        const v = input.value.toLowerCase();
        document.querySelectorAll("#requestsTable tbody tr").forEach(r => {
            const title = r.children[0].textContent.toLowerCase();
            r.style.display = title.includes(v) ? "" : "none";
        });
    });
}


function bindCreateOrgBranchDependency() {
    const org = document.getElementById("reqOrganization");
    const branch = document.getElementById("reqBranch");
    const user = document.getElementById("reqCreatedBy");

    if (!org || !branch) return;

    function clearBranches() { branch.innerHTML = `<option value="">Выберите филиал (необязательно)</option>`; }
    function clearUsers() { if (user) user.innerHTML = `<option value="">Выберите пользователя</option>`; }

    async function loadBranches(id) {
        clearBranches();
        const r = await fetch(`/Requests?handler=BranchesByOrgs&orgIds=${id}`);
        const data = await r.json();
        data.forEach(b => branch.innerHTML += `<option value="${b.id}">${b.address}</option>`);
    }

    async function loadUsers() {
        if (!user) return;
        clearUsers();
        if (!org.value) return;
        const url = `/Requests?handler=UsersByOrgBranch&orgId=${org.value}&branchId=${branch.value || ""}`;
        const r = await fetch(url);
        const data = await r.json();
        data.forEach(u => user.innerHTML += `<option value="${u.id}">${u.fullName}</option>`);
    }

    org.addEventListener("change", async () => {
        clearBranches(); clearUsers();
        if (!org.value) return;
        await loadBranches(org.value);
        await loadUsers();
    });

    branch.addEventListener("change", loadUsers);
}


function initCreateRequestSubmit() {
    const form = document.getElementById("createRequestForm");
    if (!form) return;

    form.addEventListener("submit", async e => {
        e.preventDefault();
        const fd = new FormData();
        const t = document.querySelector("#antiForgeryForm input");
        if (t) fd.append("__RequestVerificationToken", t.value);

        fd.append("Title", document.getElementById("reqTitle")?.value || "");
        fd.append("Topic", document.getElementById("reqTopic")?.value || "");
        fd.append("OrganizationId", document.getElementById("reqOrganization")?.value || "");
        fd.append("BranchId", document.getElementById("reqBranch")?.value || "");
        fd.append("ProductId", document.getElementById("reqProduct")?.value || "");
        fd.append("Priority", document.getElementById("reqPriority")?.value || "");

        const createdBy = document.getElementById("reqCreatedBy");
        fd.append("CreatedById", createdBy ? createdBy.value : "");

        fd.append("Description", document.getElementById("reqDescription")?.value || "");

        const file = document.getElementById("reqFile");
        if (file && file.files.length > 0) fd.append("File", file.files[0]);

        const res = await fetch("/Requests?handler=Create", { method: "POST", body: fd });
        if (!res.ok) { showToast("Ошибка создания заявки"); return; }

        showToast("Заявка успешно создана!");
        setTimeout(() => location.reload(), 800);
    });
}


function bindOrgBranchDependency() {
    const orgCb = document.querySelectorAll(".filter-org");
    const menu = document.getElementById("branchFilterMenu");
    if (!orgCb.length || !menu) return;

    orgCb.forEach(cb => {
        cb.addEventListener("change", async () => {
            const ids = [...orgCb].filter(x => x.checked && x.value !== "all").map(x => x.value);
            const r = await fetch(`/Requests?handler=BranchesByOrgs&orgIds=${ids.join(",")}`);
            const data = await r.json();

            menu.innerHTML = "";
            if (!data.length) { menu.innerHTML = "<label>Нет филиалов</label>"; return; }

            menu.innerHTML = `<label><input type="checkbox" value="all" checked /> Все</label>` +
                data.map(b => `<label><input type="checkbox" class="filter-branch" value="${b.id}" /> ${b.address}</label>`).join("");

            initAllCheckboxBehavior(menu);
        });
    });
}


function initCalendar() {
    const c = document.getElementById("calendarContainer");
    if (!c) return;

    const now = new Date();
    let m = now.getMonth();
    let y = now.getFullYear();

    render(m, y);

    function render(month, year) {
        c.innerHTML = "";
        const header = document.createElement("div");
        header.className = "calendar-header";

        const prev = document.createElement("button");
        prev.textContent = "‹";
        prev.className = "btn small secondary";
        prev.onclick = () => { if (month === 0) { month = 11; year--; } else month--; render(month, year); };

        const next = document.createElement("button");
        next.textContent = "›";
        next.className = "btn small secondary";
        next.onclick = () => { if (month === 11) { month = 0; year++; } else month++; render(month, year); };

        const title = document.createElement("div");
        title.textContent = `${["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"][month]} ${year}`;

        header.append(prev, title, next);
        c.append(header);

        const grid = document.createElement("div");
        grid.className = "calendar-grid";

        const first = new Date(year, month, 1).getDay() || 7;
        const total = new Date(year, month + 1, 0).getDate();

        for (let i = 1; i < first; i++) grid.append(Object.assign(document.createElement("div"), { className: "calendar-cell empty" }));

        for (let d = 1; d <= total; d++) {
            const date = new Date(year, month, d);
            const cell = document.createElement("div");
            cell.className = "calendar-cell";
            cell.textContent = d;

            const today = new Date();
            if (date.toDateString() === today.toDateString()) cell.classList.add("today");

            if (selectedStartDate && same(date, selectedStartDate)) cell.classList.add("selected");
            if (selectedEndDate && same(date, selectedEndDate)) cell.classList.add("selected");

            cell.onclick = () => select(date);
            grid.append(cell);
        }
        c.append(grid);
    }

    function select(d) {
        if (!selectedStartDate || selectedEndDate) { selectedStartDate = d; selectedEndDate = null; }
        else if (d < selectedStartDate) { selectedEndDate = selectedStartDate; selectedStartDate = d; }
        else selectedEndDate = d;
        render(m, y);
    }

    function same(a, b) {
        return a.getFullYear() === b.getFullYear() &&
               a.getMonth() === b.getMonth() &&
               a.getDate() === b.getDate();
    }
}


function applyFilters() {
    const f = collectFilters();
    document.querySelectorAll("#requestsTable tbody tr").forEach(r => {
        const c = r.children;
        const org = c[2].textContent.toLowerCase();
        const branch = c[3].textContent.toLowerCase();
        const product = c[4].textContent.toLowerCase();
        const priority = c[5].textContent.toLowerCase();
        const status = c[6].textContent.toLowerCase();
        const client = r.querySelector("td:nth-last-child(2)")?.textContent?.toLowerCase() || "";
        const d = r.querySelector("td:last-child")?.textContent || "";

        let v = true;
        if (f.orgs.length && !f.orgs.includes("all")) v = v && f.orgs.some(x => org.includes(x.toLowerCase()));
        if (f.branches.length && !f.branches.includes("all")) v = v && f.branches.some(x => branch.includes(x.toLowerCase()));
        if (f.products.length && !f.products.includes("all")) v = v && f.products.some(x => product.includes(x.toLowerCase()));
        if (f.statuses.length && !f.statuses.includes("all")) v = v && f.statuses.some(x => status.includes(x.toLowerCase()));
        if (f.priorities.length && !f.priorities.includes("all")) v = v && f.priorities.some(x => priority.includes(x.toLowerCase()));
        if (f.clients.length && !f.clients.includes("all")) v = v && f.clients.some(x => client.includes(x.toLowerCase()));

        if (f.startDate || f.endDate) {
            const [dd, mm, yy] = d.split(".");
            const dt = new Date(`${yy}-${mm}-${dd}`);
            if (f.startDate && dt < new Date(f.startDate)) v = false;
            if (f.endDate && dt > new Date(f.endDate)) v = false;
        }

        r.style.display = v ? "" : "none";
        r.classList.toggle("filtered", v);
    });

    showToast("Фильтры применены");
}


function clearFilters() {
    document.querySelectorAll(".dropdown-menu input[type=checkbox]").forEach(cb => cb.checked = true);
    document.querySelectorAll(".dropdown-toggle").forEach(b => b.textContent = "Все");
    selectedStartDate = null;
    selectedEndDate = null;
    const c = document.getElementById("calendarContainer");
    if (c) { c.innerHTML = ""; initCalendar(); }
    showToast("Фильтры сброшены");
}


function collectFilters() {
    return {
        orgs: getValues(".filter-org"),
        branches: getValues(".filter-branch"),
        products: getValues(".filter-product"),
        statuses: getValues(".filter-status"),
        priorities: getValues(".filter-priority"),
        clients: getValues(".filter-client"),
        startDate: selectedStartDate ? selectedStartDate.toISOString().split("T")[0] : null,
        endDate: selectedEndDate ? selectedEndDate.toISOString().split("T")[0] : null
    };
}

function getValues(s) { return [...document.querySelectorAll(s + ":checked")].map(x => x.value); }

function initRowClicks() {
    document.querySelectorAll("#requestsTable tbody tr").forEach(r => {
        r.addEventListener("dblclick", () => {
            const id = r.dataset.requestId;
            window.location.href = `/Requests/Details/${id}`;
        });
    });
}

function showToast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.append(t);
    setTimeout(() => t.classList.add("fade-out"), 2000);
    setTimeout(() => t.remove(), 2500);
}

function initAnalyticsToggle() {
    const btn = document.getElementById("toggleAnalyticsBtn");
    const sec = document.getElementById("analyticsSection");
    if (!btn || !sec) return;

    let rendered = false;
    btn.addEventListener("click", () => {
        const c = sec.classList.toggle("collapsed");
        btn.textContent = c ? "Показать аналитику" : "Скрыть аналитику";
        if (!c && !rendered) { renderAnalyticsCharts(); rendered = true; }
    });
}

function renderAnalyticsCharts() {
    const rows = document.querySelectorAll("#requestsTable tbody tr");
    if (!rows.length) return;

    const st = {}, dt = {};

    rows.forEach(r => {
        const c = r.children;
        const status = c[6]?.textContent?.trim() || "-";
        const d = c[c.length - 1]?.textContent?.trim() || "";
        const [dd, mm, yy] = d.split(".");
        const key = `${yy}-${mm}-${dd}`;

        st[status] = (st[status] || 0) + 1;
        dt[key] = (dt[key] || 0) + 1;
    });

    const dates = Object.keys(dt).sort((a, b) => new Date(a) - new Date(b));
    const values = dates.map(d => dt[d]);

    const colors = {
        created: "#60a5fa",
        inwork: "#facc15",
        done: "#22c55e",
        cancelled: "#ef4444",
        gradientTop: "rgba(59,130,246,0.35)",
        gradientBottom: "rgba(59,130,246,0.05)",
        default: "#94a3b8"
    };

    const map = {
        "Создана": colors.created,
        "В работе": colors.inwork,
        "Завершена": colors.done,
        "Отменена": colors.cancelled
    };

    new Chart(document.getElementById("chartStatus"), {
        type: "doughnut",
        data: {
            labels: Object.keys(st),
            datasets: [{
                data: Object.values(st),
                backgroundColor: Object.keys(st).map(s => map[s] || colors.default),
                borderWidth: 0
            }]
        },
        options: {
            cutout: "70%",
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom", labels: { color: "#475569", boxWidth: 10, font: { size: 12 } } } },
            animation: { duration: 900, easing: "easeOutQuart" }
        }
    });

    const ctx = document.getElementById("chartDates").getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, colors.gradientTop);
    grad.addColorStop(1, colors.gradientBottom);

    new Chart(ctx, {
        type: "line",
        data: {
            labels: dates.map(x => x.split("-").reverse().join(".")),
            datasets: [{
                label: "Количество заявок",
                data: values,
                borderColor: "#3b82f6",
                backgroundColor: grad,
                tension: 0.35,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: "#2563eb",
                pointHoverRadius: 6,
                pointHoverBackgroundColor: "#1d4ed8"
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#475569", font: { size: 11 } }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: "#64748b", stepSize: 1 }, grid: { color: "#f1f5f9" } }
            },
            animation: { duration: 900, easing: "easeOutQuart" }
        }
    });
}
