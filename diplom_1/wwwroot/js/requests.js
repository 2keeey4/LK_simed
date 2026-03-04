/* ============================================================
   GLOBAL STATE
============================================================ */

let filtersVisible = false;
let analyticsRendered = false;

/* ============================================================
   INITIALIZATION
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    initFilterPanel();
    initDropdowns();
    initSearch();
    initRowClicks();
    initAnalyticsToggle();
    initCreateRequestModal();
    initCreateRequestSubmit();
    bindFilterOrgBranch();
    bindCreateOrgBranch();
    initFilterCascading();

    // Устанавливаем фильтры по умолчанию
    setTimeout(() => {
        clearFilters();
    }, 100);
});

/* ============================================================
   ФИЛЬТРЫ: ОРГАНИЗАЦИЯ → ФИЛИАЛ → КЛИЕНТ
============================================================ */

function initFilterCascading() {
    const orgFilterMenu = document.getElementById("orgFilterMenu");
    const branchFilterMenu = document.getElementById("branchFilterMenu");
    const clientFilterMenu = document.getElementById("clientFilterMenu");

    if (!orgFilterMenu) return;

    // При изменении организаций
    orgFilterMenu.querySelectorAll(".filter-org").forEach(cb => {
        cb.addEventListener("change", () => {
            updateBranchFilterOptions();
            updateClientFilterOptions();
        });
    });

    // При изменении филиалов
    if (branchFilterMenu) {
        branchFilterMenu.querySelectorAll(".filter-branch").forEach(cb => {
            cb.addEventListener("change", () => {
                updateClientFilterOptions();
            });
        });
    }
}

function updateBranchFilterOptions() {
    const selectedOrgs = [...document.querySelectorAll("#orgFilterMenu .filter-org:checked")]
        .map(cb => cb.value)
        .filter(v => v !== 'all');

    const branchMenu = document.getElementById("branchFilterMenu");
    if (!branchMenu) return;

    const allCheckbox = branchMenu.querySelector('input[value="all"]');
    const branchItems = branchMenu.querySelectorAll(".filter-branch");

    if (selectedOrgs.length === 0) {
        // Показываем все филиалы
        branchItems.forEach(item => {
            item.disabled = false;
            item.parentElement.style.opacity = "1";
        });
        if (allCheckbox) allCheckbox.disabled = false;
        return;
    }

    // Получаем филиалы для выбранных организаций
    const orgBranches = [];
    selectedOrgs.forEach(orgId => {
        const orgBranchesForThisOrg = window.allBranches?.filter(b => b.organizationId == orgId) || [];
        orgBranches.push(...orgBranchesForThisOrg.map(b => b.id));
    });

    // Обновляем доступность филиалов
    branchItems.forEach(item => {
        const branchId = parseInt(item.value);
        const isAvailable = orgBranches.includes(branchId);

        item.disabled = !isAvailable;
        item.parentElement.style.opacity = isAvailable ? "1" : "0.4";

        // Снимаем выбор с недоступных
        if (!isAvailable && item.checked) {
            item.checked = false;
        }
    });

    // Обновляем кнопку "Все"
    const anyBranchChecked = [...branchItems].some(item => item.checked && !item.disabled);
    if (allCheckbox) {
        allCheckbox.disabled = false;
        if (!anyBranchChecked) {
            allCheckbox.checked = true;
        }
    }

    updateDropdownLabel(branchMenu);
}

function updateClientFilterOptions() {
    const clientMenu = document.getElementById("clientFilterMenu");
    if (!clientMenu) return;

    const selectedOrgs = [...document.querySelectorAll("#orgFilterMenu .filter-org:checked")]
        .map(cb => cb.value)
        .filter(v => v !== 'all');

    const selectedBranches = [...document.querySelectorAll("#branchFilterMenu .filter-branch:checked")]
        .map(cb => cb.value)
        .filter(v => v !== 'all');

    const clientItems = clientMenu.querySelectorAll(".filter-client");
    const allCheckbox = clientMenu.querySelector('input[value="all"]');

    if (selectedOrgs.length === 0 && selectedBranches.length === 0) {
        // Показываем всех клиентов
        clientItems.forEach(item => {
            item.disabled = false;
            item.parentElement.style.opacity = "1";
        });
        if (allCheckbox) allCheckbox.disabled = false;
        return;
    }

    // Получаем организации выбранных филиалов
    const branchOrgIds = [];
    if (selectedBranches.length > 0) {
        selectedBranches.forEach(branchId => {
            const branch = window.allBranches?.find(b => b.id == branchId);
            if (branch?.organizationId) {
                branchOrgIds.push(branch.organizationId);
            }
        });
    }

    const allowedOrgIds = [...selectedOrgs, ...branchOrgIds].map(id => parseInt(id));

    // Фильтруем клиентов
    clientItems.forEach(item => {
        const clientName = item.value;
        const client = window.allUsers?.find(u => u.fullName === clientName);

        let isAvailable = false;

        if (client) {
            // Проверяем принадлежность к организациям
            const clientOrgIds = client.organizations || [];
            isAvailable = allowedOrgIds.some(orgId => clientOrgIds.includes(orgId));

            // Если выбран филиал, проверяем и его
            if (isAvailable && selectedBranches.length > 0) {
                const clientBranchIds = client.branches || [];
                isAvailable = selectedBranches.some(branchId =>
                    clientBranchIds.includes(parseInt(branchId))
                );
            }
        }

        item.disabled = !isAvailable;
        item.parentElement.style.opacity = isAvailable ? "1" : "0.4";

        // Снимаем выбор с недоступных
        if (!isAvailable && item.checked) {
            item.checked = false;
        }
    });

    // Обновляем кнопку "Все"
    const anyClientChecked = [...clientItems].some(item => item.checked && !item.disabled);
    if (allCheckbox) {
        allCheckbox.disabled = false;
        if (!anyClientChecked) {
            allCheckbox.checked = true;
        }
    }

    updateDropdownLabel(clientMenu);
}

/* ============================================================
   FILTER PANEL TOGGLE
============================================================ */

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

/* ============================================================
   DROPDOWNS
============================================================ */

function initDropdowns() {
    document.querySelectorAll(".dropdown-toggle").forEach(toggle => {
        toggle.addEventListener("click", e => {
            e.stopPropagation();
            const menu = toggle.nextElementSibling;

            closeAllDropdowns(menu);
            menu.classList.toggle("hidden");
        });
    });

    document.addEventListener("click", (e) => {
        if (!e.target.closest('.dropdown')) {
            closeAllDropdowns(null);
        }
    });

    document.querySelectorAll(".dropdown-menu").forEach(menu => {
        const all = menu.querySelector("input[value='all']");
        const items = menu.querySelectorAll("input:not([value='all'])");

        if (all) {
            all.addEventListener("change", (e) => {
                e.stopPropagation();
                if (all.checked) {
                    items.forEach(c => (c.checked = false));
                }
                updateDropdownLabel(menu);
            });
        }

        items.forEach(cb => {
            cb.addEventListener("change", (e) => {
                e.stopPropagation();
                if (cb.checked && all) all.checked = false;

                if (![...items].some(x => x.checked) && all) {
                    all.checked = true;
                }

                updateDropdownLabel(menu);
            });
        });
    });
}

function closeAllDropdowns(except) {
    document.querySelectorAll(".dropdown-menu").forEach(menu => {
        if (menu !== except) menu.classList.add("hidden");
    });
}

function updateDropdownLabel(menu) {
    const toggle = menu.previousElementSibling;
    const all = menu.querySelector("input[value='all']");
    const checked = [...menu.querySelectorAll("input:not([value='all']):checked")];

    // Убираем/добавляем класс активного фильтра
    if (checked.length > 0) {
        toggle.classList.add("has-filter");
    } else {
        toggle.classList.remove("has-filter");
    }

    if (all && all.checked) {
        toggle.textContent =
            toggle.id.includes("org") ? "Все организации" :
                toggle.id.includes("branch") ? "Все филиалы" :
                    toggle.id.includes("product") ? "Все продукты" :
                        toggle.id.includes("client") ? "Все клиенты" :
                            toggle.id.includes("status") ? "Все статусы" :
                                "Все";
        return;
    }

    if (checked.length === 0) {
        toggle.textContent = "Нет выбранных";
        return;
    }

    toggle.textContent = `Выбрано (${checked.length})`;
}

/* ============================================================
   SEARCH
============================================================ */

function initSearch() {
    const input = document.getElementById("searchInput");
    if (!input) return;

    input.addEventListener("input", () => {
        const v = input.value.toLowerCase();

        document.querySelectorAll("#requestsTable tbody tr").forEach(row => {
            const title = row.children[1]?.textContent.toLowerCase();
            row.style.display = title.includes(v) ? "" : "none";
        });

        updateStatsByFilters();

        // Обновляем аналитику, если она открыта
        const analyticsSection = document.getElementById("analyticsSection");
        if (analyticsSection && !analyticsSection.classList.contains("collapsed")) {
            renderAnalyticsCharts();
        }
    });
}

/* ============================================================
   CREATE REQUEST MODAL
============================================================ */

function initCreateRequestModal() {
    const modal = document.getElementById("createModal");
    if (!modal) return;

    const open = document.getElementById("btnCreateRequest");
    const close = document.getElementById("closeModalBtn");
    const cancel = document.getElementById("cancelModalBtn");

    const closeModal = () => {
        modal.classList.add("hidden");
        document.body.style.overflow = "";
        // Сбрасываем форму
        const form = document.getElementById("createRequestForm");
        if (form) form.reset();
    };

    open?.addEventListener("click", () => {
        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    });

    close?.addEventListener("click", closeModal);
    cancel?.addEventListener("click", closeModal);

    window.addEventListener("click", e => {
        if (e.target.classList.contains("modal-overlay")) {
            closeModal();
        }
    });
}

/* ============================================================
   CREATE REQUEST SUBMIT
============================================================ */

function initCreateRequestSubmit() {
    const form = document.getElementById("createRequestForm");
    if (!form) return;

    form.addEventListener("submit", async e => {
        e.preventDefault();

        console.log('=== ОТПРАВКА ФОРМЫ СОЗДАНИЯ ЗАЯВКИ ===');

        // Собираем данные
        const formData = {
            title: document.getElementById("reqTitle").value.trim(),
            topic: document.getElementById("reqTopic").value,
            org: document.getElementById("reqOrganization").value,
            branch: document.getElementById("reqBranch").value,
            product: document.getElementById("reqProduct").value,
            priority: document.getElementById("reqPriority").value,
            createdBy: document.getElementById("reqCreatedBy")?.value,
            description: document.getElementById("reqDescription").value.trim()
        };

        console.log('Данные формы:', formData);

        // Проверка обязательных полей
        if (!formData.title) {
            showToast("Введите заголовок заявки");
            document.getElementById("reqTitle").focus();
            return;
        }

        if (!formData.topic) {
            showToast("Выберите тему");
            document.getElementById("reqTopic").focus();
            return;
        }

        if (!formData.org) {
            showToast("Выберите организациию");
            document.getElementById("reqOrganization").focus();
            return;
        }

        if (!formData.product) {
            showToast("Выберите продукт");
            document.getElementById("reqProduct").focus();
            return;
        }

        if (!formData.priority) {
            showToast("Выберите приоритет");
            document.getElementById("reqPriority").focus();
            return;
        }

        const createdBySelect = document.getElementById("reqCreatedBy");
        let createdById;
        if (createdBySelect) {
            if (!formData.createdBy) {
                showToast("Выберите пользователя");
                createdBySelect.focus();
                return;
            }
            createdById = formData.createdBy;
        } else {
            createdById = window.currentUserId || formData.createdBy;
        }

        console.log('Все проверки пройдены. Создаем FormData...');

        const fd = new FormData();

        const token = document.querySelector("#antiForgeryForm input[name='__RequestVerificationToken']");
        if (token) {
            fd.append("__RequestVerificationToken", token.value);
            console.log('Токен добавлен');
        }

        fd.append("Title", formData.title);
        fd.append("Topic", formData.topic);
        fd.append("OrganizationId", formData.org);
        fd.append("BranchId", formData.branch || "");
        fd.append("ProductId", formData.product);
        fd.append("Priority", formData.priority);
        fd.append("CreatedById", createdById);
        fd.append("Description", formData.description);

        console.log('Добавлены поля формы');

        const file = document.getElementById("reqFile");
        if (file?.files[0]) {
            fd.append("File", file.files[0]);
            console.log('Добавлен файл:', file.files[0].name);
        }

        try {
            console.log('Отправка запроса на сервер...');

            const url = "?handler=Create";
            console.log('URL запроса:', url);

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = "Создание...";
            submitBtn.disabled = true;

            const res = await fetch(url, {
                method: "POST",
                body: fd
            });

            console.log('Статус ответа:', res.status, res.statusText);

            submitBtn.textContent = originalText;
            submitBtn.disabled = false;

            const result = await res.json();
            console.log('Ответ сервера:', result);

            if (result.success) {
                showToast("✅ Заявка создана успешно!");

                const modal = document.getElementById("createModal");
                if (modal) {
                    modal.classList.add("hidden");
                    document.body.style.overflow = "";
                    form.reset();
                }

                setTimeout(() => location.reload(), 1000);
            } else {
                const errorMsg = result.error || result.details || "Неизвестная ошибка";
                console.error('Ошибка от сервера:', errorMsg);
                showToast("❌ Ошибка: " + errorMsg);
            }
        } catch (error) {
            console.error('Ошибка при отправке формы:', error);

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = "Сохранить";
                submitBtn.disabled = false;
            }

            showToast("❌ Ошибка соединения: " + error.message);
        }
    });
}

/* ============================================================
   FILTER → ORG → BRANCH
============================================================ */

function bindFilterOrgBranch() {
    const orgCheckboxes = document.querySelectorAll(".filter-org");
    const branchMenu = document.getElementById("branchFilterMenu");

    if (!orgCheckboxes.length || !branchMenu) return;

    orgCheckboxes.forEach(cb => {
        cb.addEventListener("change", async () => {
            const ids = [...orgCheckboxes]
                .filter(x => x.checked && x.value !== "all")
                .map(x => x.value);

            if (ids.length === 0) {
                const allBranches = window.allBranches || [];
                updateBranchFilterMenu(allBranches);
                return;
            }

            const firstOrgId = ids[0];
            try {
                const allBranches = window.allBranches || [];
                const filteredBranches = allBranches.filter(b => b.organizationId == firstOrgId);
                updateBranchFilterMenu(filteredBranches);
            } catch (error) {
                console.error('Ошибка загрузки филиалов:', error);
            }
        });
    });
}

function updateBranchFilterMenu(branches) {
    const branchMenu = document.getElementById("branchFilterMenu");
    if (!branchMenu) return;

    branchMenu.innerHTML = `
        <label><input type="checkbox" value="all" checked /> Все</label>
    `;

    branches.forEach(b => {
        branchMenu.innerHTML += `
            <label>
                <input type="checkbox" class="filter-branch" value="${b.id}"/>
                ${b.address}
            </label>`;
    });
}

/* ============================================================
   CREATE MODAL ORG → BRANCH → USER
============================================================ */

function bindCreateOrgBranch() {
    const org = document.getElementById("reqOrganization");
    const branch = document.getElementById("reqBranch");
    const createdBy = document.getElementById("reqCreatedBy");

    if (!org) return;

    // Функция для загрузки филиалов
    async function loadBranches(orgId) {
        if (!branch) return;

        console.log('Загрузка филиалов для организации:', orgId);
        const currentBranchId = branch.value;
        branch.innerHTML = `<option value="">Выберите филиал</option>`;

        try {
            const url = `?handler=ApiBranches&orgId=${orgId}`;
            const r = await fetch(url);

            if (!r.ok) {
                const allBranches = window.allBranches || [];
                const filteredBranches = allBranches.filter(b => b.organizationId == orgId);
                populateBranchDropdown(filteredBranches, currentBranchId);
                return;
            }

            const result = await r.json();
            if (result.success && result.data && result.data.length > 0) {
                populateBranchDropdown(result.data, currentBranchId);
            } else {
                branch.innerHTML += `<option value="" disabled>Нет филиалов</option>`;
            }
        } catch (error) {
            const allBranches = window.allBranches || [];
            const filteredBranches = allBranches.filter(b => b.organizationId == orgId);
            populateBranchDropdown(filteredBranches, currentBranchId);
        }
    }

    function populateBranchDropdown(branches, currentBranchId) {
        branch.innerHTML = `<option value="">Выберите филиал</option>`;

        if (branches && branches.length > 0) {
            branches.forEach(b => {
                const option = new Option(b.address, b.id);
                if (b.id == currentBranchId) option.selected = true;
                branch.add(option);
            });
        }
    }

    // Функция для загрузки пользователей
    async function loadUsers(orgId, branchId = null) {
        if (!createdBy) return;

        console.log('Загрузка пользователей для организации:', orgId, 'филиал:', branchId);
        const currentUserId = createdBy.value;
        createdBy.innerHTML = `<option value="">Выберите пользователя</option>`;

        try {
            let url = `?handler=ApiUsers&orgId=${orgId}`;
            if (branchId) url += `&branchId=${branchId}`;

            const r = await fetch(url);

            if (!r.ok) {
                const allUsers = window.allUsers || [];
                const filteredUsers = allUsers.filter(u =>
                    u.organizations && u.organizations.includes(parseInt(orgId))
                );
                populateUserDropdown(filteredUsers, currentUserId);
                return;
            }

            const result = await r.json();
            if (result.success && result.data && result.data.length > 0) {
                populateUserDropdown(result.data, currentUserId);
            }
        } catch (error) {
            const allUsers = window.allUsers || [];
            const filteredUsers = allUsers.filter(u =>
                u.organizations && u.organizations.includes(parseInt(orgId))
            );
            populateUserDropdown(filteredUsers, currentUserId);
        }
    }

    function populateUserDropdown(users, currentUserId) {
        createdBy.innerHTML = `<option value="">Выберите пользователя</option>`;

        if (users && users.length > 0) {
            users.forEach(u => {
                const option = new Option(u.fullName, u.id);
                if (u.id == currentUserId) option.selected = true;
                createdBy.add(option);
            });
        }
    }

    // Загружаем данные при изменении организации
    org.addEventListener("change", async () => {
        console.log('Изменена организация:', org.value);

        if (!org.value) {
            if (branch) branch.innerHTML = `<option value="">Выберите филиал</option>`;
            if (createdBy) createdBy.innerHTML = `<option value="">Выберите пользователя</option>`;
            return;
        }

        await loadBranches(org.value);
        const branchId = branch?.value || null;
        await loadUsers(org.value, branchId);
    });

    // Загружаем пользователей при изменении филиала
    branch?.addEventListener("change", async () => {
        console.log('Изменен филиал:', branch?.value);

        if (!org.value) {
            showToast("Сначала выберите организацию");
            return;
        }

        const branchId = branch.value || null;
        await loadUsers(org.value, branchId);
    });

    // Инициализация при открытии модалки
    const modalOpenBtn = document.getElementById("btnCreateRequest");
    if (modalOpenBtn) {
        modalOpenBtn.addEventListener("click", () => {
            setTimeout(() => {
                if (org.value) {
                    loadBranches(org.value);
                    loadUsers(org.value, branch?.value || null);
                }
            }, 100);
        });
    }
}

/* ============================================================
   APPLY FILTERS
============================================================ */

function applyFilters() {
    const f = collectFilters();
    const orgNames = {};

    document.querySelectorAll("#orgFilterMenu .filter-org:checked").forEach(cb => {
        const orgId = cb.value;
        const orgName = cb.nextSibling?.textContent?.trim();
        if (orgName) orgNames[orgId] = orgName;
    });

    // Собираем данные из таблицы
    const tableData = [];
    document.querySelectorAll("#requestsTable tbody tr").forEach(row => {
        const cells = row.children;
        tableData.push({
            row: row,
            orgName: cells[3]?.textContent.trim() || '',
            branch: cells[4]?.textContent.trim() || '',
            product: cells[5]?.textContent.trim() || '',
            status: cells[7]?.textContent.trim() || '',
            date: cells[cells.length - 1]?.textContent.trim() || ''
        });
    });

    // Применяем фильтры
    tableData.forEach(item => {
        let visible = true;

        // Фильтр по организации
        if (f.orgs.length > 0 && !f.orgs.includes('all')) {
            const orgMatch = f.orgs.some(orgId => {
                const orgNameFromTable = item.orgName;
                const orgNameFromFilter = orgNames[orgId];
                return orgNameFromTable === orgNameFromFilter;
            });
            if (!orgMatch) visible = false;
        }

        // Фильтр по филиалу
        if (f.branches.length > 0 && !f.branches.includes('all')) {
            const branchMatch = f.branches.some(branchId => {
                const branchCheckbox = document.querySelector(`.filter-branch[value="${branchId}"]:checked`);
                const branchName = branchCheckbox?.nextSibling?.textContent?.trim();
                return branchName && item.branch.includes(branchName);
            });
            if (!branchMatch) visible = false;
        }

        // Фильтр по продукту
        if (f.products.length > 0 && !f.products.includes('all')) {
            const productMatch = f.products.some(productId => {
                const productCheckbox = document.querySelector(`.filter-product[value="${productId}"]:checked`);
                const productName = productCheckbox?.nextSibling?.textContent?.trim();
                return productName && item.product.includes(productName);
            });
            if (!productMatch) visible = false;
        }

        // Фильтр по статусу
        if (f.statuses.length > 0 && !f.statuses.includes('all')) {
            const statusMatch = f.statuses.some(status => {
                return item.status.toLowerCase().includes(status.toLowerCase());
            });
            if (!statusMatch) visible = false;
        }

        // Фильтр по дате
        if (item.date) {
            const [dd, mm, yy] = item.date.split(".");
            const dt = new Date(`${yy}-${mm}-${dd}`);

            if (f.startDate) {
                const start = new Date(f.startDate);
                start.setHours(0, 0, 0, 0);
                if (dt < start) visible = false;
            }

            if (f.endDate) {
                const end = new Date(f.endDate);
                end.setHours(23, 59, 59, 999);
                if (dt > end) visible = false;
            }
        }

        item.row.style.display = visible ? "" : "none";
    });

    updateStatsByFilters();

    // 🔹 ОБНОВЛЯЕМ АНАЛИТИКУ, если она видима
    const analyticsSection = document.getElementById("analyticsSection");
    if (analyticsSection && !analyticsSection.classList.contains("collapsed")) {
        renderAnalyticsCharts();
    }

    showToast("Фильтры применены");
}

function clearFilters() {
    document.querySelectorAll(".dropdown-menu input[type=checkbox]").forEach(cb => {
        if (cb.classList.contains('filter-status')) {
            cb.checked = (cb.value === 'Создана' || cb.value === 'В работе');
        } else if (cb.value === 'all') {
            cb.checked = true;
        } else {
            cb.checked = false;
        }
    });

    document.querySelectorAll(".dropdown-toggle").forEach(t => {
        if (t.id.includes("org")) t.textContent = "Все организации";
        else if (t.id.includes("branch")) t.textContent = "Все филиалы";
        else if (t.id.includes("product")) t.textContent = "Все продукты";
        else if (t.id.includes("client")) t.textContent = "Все клиенты";
        else if (t.id.includes("status")) t.textContent = "Создана, В работе";
        else t.textContent = "Все";

        t.classList.remove("has-filter");
    });

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    document.getElementById("dateFrom").value = startOfYear.toISOString().split("T")[0];
    document.getElementById("dateTo").value = now.toISOString().split("T")[0];

    applyFilters();

    // 🔹 ОБНОВЛЯЕМ АНАЛИТИКУ
    const analyticsSection = document.getElementById("analyticsSection");
    if (analyticsSection && !analyticsSection.classList.contains("collapsed")) {
        renderAnalyticsCharts();
    }

    showToast("Фильтры сброшены");
}

function collectFilters() {
    return {
        orgs: checked(".filter-org"),
        branches: checked(".filter-branch"),
        products: checked(".filter-product"),
        statuses: checked(".filter-status"),
        startDate: document.getElementById("dateFrom").value,
        endDate: document.getElementById("dateTo").value
    };
}

function checked(selector) {
    return [...document.querySelectorAll(selector + ":checked")].map(c => c.value);
}

/* ============================================================
   STATS UPDATE AFTER FILTERS
============================================================ */

function updateStatsByFilters() {
    const rows = [...document.querySelectorAll("#requestsTable tbody tr")].filter(
        r => r.style.display !== "none"
    );

    const total = document.getElementById("statTotal");
    const created = document.getElementById("statCreated");
    const inWork = document.getElementById("statInWork");
    const done = document.getElementById("statDone");
    const cancelled = document.getElementById("statCancelled");

    if (total) total.textContent = rows.length;
    if (created) created.textContent = rows.filter(r =>
        r.children[7].textContent.includes("Создана")
    ).length;
    if (inWork) inWork.textContent = rows.filter(r =>
        r.children[7].textContent.includes("В работе")
    ).length;
    if (done) done.textContent = rows.filter(r =>
        r.children[7].textContent.includes("Завершена")
    ).length;
    if (cancelled) cancelled.textContent = rows.filter(r =>
        r.children[7].textContent.includes("Отменена")
    ).length;
}

/* ============================================================
   ROW DOUBLE CLICK
============================================================ */

function initRowClicks() {
    document.querySelectorAll("#requestsTable tbody tr").forEach(row => {
        row.addEventListener("dblclick", () => {
            const id = row.dataset.requestId;
            if (id) window.location.href = `/Requests/Details/${id}`;
        });
    });
}

/* ============================================================
   ANALYTICS
============================================================ */

function initAnalyticsToggle() {
    const btn = document.getElementById("toggleAnalyticsBtn");
    const sec = document.getElementById("analyticsSection");

    if (!btn || !sec) return;

    btn.addEventListener("click", () => {
        const collapsed = sec.classList.toggle("collapsed");
        btn.textContent = collapsed ? "Показать аналитику" : "Скрыть аналитику";

        if (!collapsed && !analyticsRendered) {
            renderAnalyticsCharts();
            analyticsRendered = true;
        } else if (!collapsed) {
            renderAnalyticsCharts();
        }
    });
}

function renderAnalyticsCharts() {
    const rows = [...document.querySelectorAll("#requestsTable tbody tr")]
        .filter(r => r.style.display !== "none");

    const statuses = {
        Создана: 0,
        "В работе": 0,
        Завершена: 0,
        Отменена: 0
    };

    const dates = {};

    rows.forEach(r => {
        const s = r.children[7].textContent.trim();
        if (statuses.hasOwnProperty(s)) {
            statuses[s]++;
        }
        const d = r.children[r.children.length - 1].textContent.trim();
        dates[d] = (dates[d] || 0) + 1;
    });

    // Удаляем старые графики
    const statusChartCtx = document.getElementById("chartStatus");
    const datesChartCtx = document.getElementById("chartDates");

    if (window.statusChartInstance) {
        window.statusChartInstance.destroy();
    }
    if (window.datesChartInstance) {
        window.datesChartInstance.destroy();
    }

    // Круговая диаграмма статусов
    if (statusChartCtx) {
        window.statusChartInstance = new Chart(statusChartCtx, {
            type: "doughnut",
            data: {
                labels: Object.keys(statuses),
                datasets: [{
                    data: Object.values(statuses),
                    backgroundColor: ['#60a5fa', '#facc15', '#22c55e', '#ef4444']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // Гистограмма по датам
    if (datesChartCtx) {
        window.datesChartInstance = new Chart(datesChartCtx, {
            type: "bar",
            data: {
                labels: Object.keys(dates),
                datasets: [{
                    label: "Количество заявок",
                    data: Object.values(dates),
                    backgroundColor: '#3b82f6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0
                        }
                    }
                }
            }
        });
    }
}

/* ============================================================
   TOAST
============================================================ */

function showToast(msg) {
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const div = document.createElement("div");
    div.className = "toast";
    div.textContent = msg;
    document.body.append(div);

    setTimeout(() => {
        div.style.opacity = "1";
        div.style.transform = "translateY(0)";
    }, 10);

    setTimeout(() => {
        div.style.opacity = "0";
        div.style.transform = "translateY(20px)";
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

// Добавляем стили для анимации тоста
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    .toast {
        position: fixed;
        bottom: 25px;
        right: 25px;
        background: #2563eb;
        color: white;
        padding: 12px 18px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.3s, transform 0.3s;
        font-size: 14px;
        z-index: 10000;
        max-width: 300px;
        word-wrap: break-word;
    }
`;
document.head.appendChild(toastStyles);