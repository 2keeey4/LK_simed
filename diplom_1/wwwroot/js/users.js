let dictionaries = { orgs: [], perms: [], roles: [] };
let currentUserId = 0;
let currentOrgId = 0;
let currentBranchId = 0;
let globalSelected = { orgs: [], branches: [] };
let currentPermissions = [];

let userSortAsc = true;
let orgSortAsc = true;
let branchSortAsc = true;
let originalUserOrder = [];
let originalOrgOrder = [];
let originalBranchOrder = [];

let orgCurrentPage = 1;
let orgPageSize = 10;
let orgTotalPages = 1;

let branchCurrentPage = 1;
let branchPageSize = 10;
let branchTotalPages = 1;

let userCurrentPage = 1;
let userPageSize = 10;
let userTotalPages = 1;
let userSelectedOrgs = [];
let userSelectedBranches = [];

document.addEventListener("DOMContentLoaded", async () => {
    await loadDictionaries();
    await loadOrgs();
    await loadBranches();
    await loadDictionaries();
    await loadOrgs();
    await loadBranches();
    await loadUsers();
    initUserFilters();
    initUserFilterDropdowns();

    setTimeout(() => {
        originalUserOrder = Array.from(document.querySelectorAll("#usersTable tbody tr"));
        originalOrgOrder = Array.from(document.querySelectorAll("#orgsBody tr"));
        originalBranchOrder = Array.from(document.querySelectorAll("#branchesBody tr"));
    }, 500);

    setTimeout(() => {
        ["searchUser", "searchOrg", "searchBranch"].forEach(id => {
            const field = document.getElementById(id);
            if (field) field.value = "";
        });
    }, 100);

    initTabs();
    initUserHandlers();
    initOrgHandlers();
    initBranchHandlers();
    initModalHandlers();
    initSearchAndSort();
    initPermissionHandlers();
});

async function loadDictionaries() {
    try {
        const res = await fetch("/Users/Users?handler=Dictionaries");
        dictionaries = await res.json();
        renderOrganizationsTree();
    } catch (error) {
        console.error("Ошибка загрузки справочников:", error);
    }
}

async function loadProductsForOrg(orgId) {
    const container = document.getElementById("orgProductsContainer");
    if (!container) return;

    container.innerHTML = '<div class="loading-products">Загрузка продуктов...</div>';

    try {
        const res = await fetch(`/Users/Users?handler=GetProductsForOrg&orgId=${orgId || 0}`);
        const data = await res.json();

        if (data.allProducts && data.allProducts.length > 0) {
            let html = '';
            data.allProducts.forEach(product => {
                const isChecked = data.selectedProductIds && data.selectedProductIds.includes(product.id);
                html += `
                    <label style="display: block; padding: 4px 0;">
                        <input type="checkbox" class="org-product-checkbox" value="${product.id}" ${isChecked ? 'checked' : ''}>
                        ${product.name}
                    </label>
                `;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = '<div class="text-muted">Нет доступных продуктов</div>';
        }
    } catch (error) {
        console.error("Ошибка загрузки продуктов:", error);
        container.innerHTML = '<div class="text-muted error">Ошибка загрузки продуктов</div>';
    }
}
function renderOrganizationsTree() {
    const container = document.getElementById("organizationsList");
    if (!container) return;

    container.innerHTML = "";
    dictionaries.orgs.forEach(org => {
        const orgDiv = document.createElement("div");
        orgDiv.className = "org-block";
        orgDiv.innerHTML = `
            <div class="org-header" data-org="${org.id}">
                <div style="display: flex; align-items: center; gap: 6px; flex: 1;">
                    <input type="checkbox" class="org-checkbox" value="${org.id}"> 
                    <span class="org-name" style="cursor: pointer;">${org.name}</span>
                </div>
                <span class="toggle-branches" data-org="${org.id}" style="cursor: pointer; padding: 2px 8px;">▾</span>
            </div>
            <div class="branch-sublist" id="branches-of-${org.id}" style="display: block;"></div>
        `;
        container.appendChild(orgDiv);
    });

    // Заполняем филиалы сразу
    dictionaries.orgs.forEach(org => {
        const sublist = document.getElementById(`branches-of-${org.id}`);
        if (sublist && org.branches) {
            org.branches.forEach(b => {
                const el = document.createElement("label");
                el.style.display = "block";
                el.style.padding = "2px 0 2px 32px";
                el.innerHTML = `<input type="checkbox" class="branch-checkbox" data-org="${org.id}" value="${b.id}"> ${b.address}`;
                sublist.appendChild(el);
            });
        }
    });

    document.querySelectorAll(".org-name").forEach(span => {
        span.addEventListener("click", (e) => {
            e.stopPropagation();
            const orgHeader = span.closest(".org-header");
            const checkbox = orgHeader.querySelector(".org-checkbox");
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });
}

function initTabs() {
    document.querySelectorAll(".main-tab").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".main-tab").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-section").forEach(s => s.classList.remove("active"));
            e.target.classList.add("active");
            document.getElementById(e.target.dataset.tab).classList.add("active");
        });
    });
}

function initUserHandlers() {
    document.getElementById("btnAddUser")?.addEventListener("click", openCreateModal);
    document.getElementById("closeModal")?.addEventListener("click", closeModal);
    document.getElementById("cancelUserBtn")?.addEventListener("click", closeModal);
    document.getElementById("nextToPermissions")?.addEventListener("click", () => switchTab("tab-permissions"));
    document.getElementById("backToGeneral")?.addEventListener("click", () => switchTab("tab-general"));
    document.getElementById("saveUserBtn")?.addEventListener("click", saveUser);
    document.getElementById("generatePassword")?.addEventListener("click", () => {
        document.getElementById("password").value = generatePassword();
    });
    document.getElementById("uploadPhotoBtn")?.addEventListener("click", () => {
        document.getElementById("userPhoto").click();
    });
    document.getElementById("userPhoto")?.addEventListener("change", handlePhotoUpload);

    document.addEventListener("click", async (e) => {
        const tr = e.target.closest("tr[data-user-id]");
        if (tr && !e.target.classList.contains("delete-user")) {
            await openEditModal(tr.dataset.userId);
        }
        if (e.target.classList.contains("delete-user")) {
            await deleteUser(tr.dataset.userId, e.target);
        }
    });
}

function initOrgHandlers() {
    document.getElementById("btnAddOrg")?.addEventListener("click", openOrgModal);
    document.getElementById("closeOrgModal")?.addEventListener("click", closeOrgModal);
    document.getElementById("cancelOrgBtn")?.addEventListener("click", closeOrgModal);
    document.getElementById("saveOrgBtn")?.addEventListener("click", saveOrg);
}

function initBranchHandlers() {
    document.getElementById("btnAddBranch")?.addEventListener("click", openBranchModal);
    document.getElementById("closeBranchModal")?.addEventListener("click", closeBranchModal);
    document.getElementById("cancelBranchBtn")?.addEventListener("click", closeBranchModal);
    document.getElementById("saveBranchBtn")?.addEventListener("click", saveBranch);

    const filterBtn = document.getElementById("branchOrgFilterBtn");
    const dropdown = document.getElementById("branchOrgFilterDropdown");

    if (filterBtn && dropdown) {
        filterBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("hidden");
            filterBtn.textContent = dropdown.classList.contains("hidden")
                ? "Фильтр организаций ▾"
                : "Фильтр организаций ▴";
        });

        document.addEventListener("click", (e) => {
            if (!dropdown.contains(e.target) && !filterBtn.contains(e.target)) {
                dropdown.classList.add("hidden");
                filterBtn.textContent = "Фильтр организаций ▾";
            }
        });
    }
}

function initPermissionHandlers() {
    document.getElementById("openGlobalSelector")?.addEventListener("click", () => {
        const selectedOrgs = Array.from(document.querySelectorAll(".org-checkbox:checked")).map(cb => parseInt(cb.value));
        const selectedBranches = Array.from(document.querySelectorAll(".branch-checkbox:checked")).map(cb => parseInt(cb.value));
        globalSelected = { orgs: selectedOrgs, branches: selectedBranches };
        openOrgBranchPopup();
    });

    document.getElementById("popupSave")?.addEventListener("click", savePopupSelection);
    document.getElementById("closePopup")?.addEventListener("click", closePopup);
    document.getElementById("applyToAll")?.addEventListener("click", applyToAllPermissions);

    document.querySelectorAll(".pattern-btn").forEach(btn => {
        btn.addEventListener("click", () => applyRolePattern(btn.textContent.trim()));
    });
}

function initModalHandlers() {
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("toggle-branches")) {
            e.stopPropagation();
            const orgId = e.target.dataset.org;
            const sublist = document.getElementById(`branches-of-${orgId}`);
            const org = dictionaries.orgs.find(o => o.id == orgId);

            if (sublist.style.display === "none" || sublist.style.display === "") {
                sublist.innerHTML = "";
                org.branches.forEach(b => {
                    const el = document.createElement("label");
                    el.style.display = "block";
                    el.style.padding = "2px 0 2px 32px";
                    el.innerHTML = `<input type="checkbox" class="branch-checkbox" data-org="${orgId}" value="${b.id}"> ${b.address}`;
                    sublist.appendChild(el);
                });
                sublist.style.display = "block";
                e.target.textContent = "▾";
            } else {
                sublist.style.display = "none";
                e.target.textContent = "▸";
            }
        }
    });

    document.addEventListener("change", (e) => {
        if (e.target.classList.contains("org-checkbox")) {
            const orgId = e.target.value;
            const orgChecked = e.target.checked;
            const branchCheckboxes = document.querySelectorAll(`.branch-checkbox[data-org="${orgId}"]`);

            if (orgChecked) {
                branchCheckboxes.forEach(cb => cb.checked = true);
            } else {
                branchCheckboxes.forEach(cb => cb.checked = false);
            }
        }

        if (e.target.classList.contains("branch-checkbox")) {
            const orgId = e.target.dataset.org;
            const orgCheckbox = document.querySelector(`.org-checkbox[value="${orgId}"]`);
            const branchCheckboxes = document.querySelectorAll(`.branch-checkbox[data-org="${orgId}"]`);
            const anyBranchChecked = Array.from(branchCheckboxes).some(cb => cb.checked);

            if (orgCheckbox) {
                orgCheckbox.checked = anyBranchChecked;
            }
        }
    });
}

async function openEditModal(id) {
    currentUserId = parseInt(id);
    document.getElementById("modalTitle").textContent = "Редактирование пользователя";

    try {
        const res = await fetch(`/Users/Users?handler=UserDetails&id=${id}`);
        const data = await res.json();

        document.getElementById("fullName").value = data.fullName || "";
        document.getElementById("email").value = data.email || "";
        document.getElementById("login").value = data.login || "";
        document.getElementById("password").value = "";

        const isSuperAdminCheckbox = document.getElementById("isSuperAdmin");
        if (isSuperAdminCheckbox) {
            isSuperAdminCheckbox.checked = data.isSuperAdmin || false;
            const currentUserIdFromSession = window.currentUserId || 0;
            if (id == currentUserIdFromSession) {
                isSuperAdminCheckbox.disabled = true;
                isSuperAdminCheckbox.title = "Вы не можете изменить свой статус супер-администратора";
            } else {
                isSuperAdminCheckbox.disabled = false;
            }
        }

        const preview = document.getElementById("photoPreview");
        preview.src = data.photoPath || "/icons/default-avatar.png";
        if (data.photoPath) preview.dataset.savedpath = data.photoPath;

        document.querySelectorAll(".org-checkbox").forEach(cb => {
            const orgId = parseInt(cb.value);
            const orgChecked = data.organizations.includes(orgId);
            cb.checked = orgChecked;

            const sublist = document.getElementById(`branches-of-${orgId}`);
            if (sublist) {
                const org = dictionaries.orgs.find(o => o.id === orgId);
                if (org) {
                    sublist.innerHTML = "";
                    org.branches.forEach(b => {
                        const isChecked = data.branches.includes(b.id);
                        const el = document.createElement("label");
                        el.style.display = "block";
                        el.style.padding = "2px 0 2px 32px";
                        el.innerHTML = `<input type="checkbox" class="branch-checkbox" data-org="${orgId}" value="${b.id}" ${isChecked ? "checked" : ""}> ${b.address}`;
                        sublist.appendChild(el);
                    });

                    if (data.branches.some(bId => org.branches.some(b => b.id === bId))) {
                        sublist.style.display = "block";
                        const toggle = document.querySelector(`.toggle-branches[data-org="${orgId}"]`);
                        if (toggle) toggle.textContent = "▾";
                    }
                }
            }
        });


        currentPermissions = data.permissions || [];
        renderPermissions(currentPermissions);

        document.getElementById("userModal").style.display = "flex";
        switchTab("tab-general");
    } catch (error) {
        console.error("Ошибка загрузки пользователя:", error);
        showToast("Ошибка загрузки данных");
    }
}

function openCreateModal() {
    currentUserId = 0;
    currentPermissions = [];
    document.getElementById("modalTitle").textContent = "Добавление пользователя";

    ["fullName", "email", "login", "password"].forEach(id =>
        document.getElementById(id).value = ""
    );

    const isSuperAdminCheckbox = document.getElementById("isSuperAdmin");
    if (isSuperAdminCheckbox) {
        isSuperAdminCheckbox.checked = false;
        isSuperAdminCheckbox.disabled = false;
    }

    document.querySelectorAll(".org-checkbox, .branch-checkbox").forEach(cb => cb.checked = false);
    document.getElementById("photoPreview").src = "/icons/default-avatar.png";
    delete document.getElementById("photoPreview").dataset.savedpath;

    document.querySelectorAll(".branch-sublist").forEach(s => s.style.display = "none");
    document.querySelectorAll(".toggle-branches").forEach(t => t.textContent = "▸");

    document.getElementById("userModal").style.display = "flex";
    switchTab("tab-general");
}

function closeModal() {
    document.getElementById("userModal").style.display = "none";
}

function switchTab(tabId) {
    document.querySelectorAll(".tab-button").forEach(b =>
        b.classList.toggle("active", b.dataset.tab === tabId)
    );
    document.querySelectorAll(".tab-content").forEach(t =>
        t.classList.toggle("active", t.id === tabId)
    );

    if (tabId === "tab-permissions") {
        renderPermissions(currentPermissions);
    }
}

function renderPermissions(existing = []) {
    const container = document.getElementById("permissionsContainer");
    if (!container) return;

    container.innerHTML = "";

    const grouped = dictionaries.perms.reduce((acc, p) => {
        const module = p.module.trim();
        if (!acc[module]) acc[module] = [];
        acc[module].push(p);
        return acc;
    }, {});

    for (const [module, perms] of Object.entries(grouped)) {
        const block = document.createElement("div");
        block.className = "permission-module-block";
        block.innerHTML = `<h4>${module}</h4>`;

        perms.forEach(p => {
            const related = existing.filter(ep => ep.permissionId === p.id);
            const orgs = [...new Set(related.map(ep => ep.organizationId).filter(x => x))];
            const branches = [...new Set(related.map(ep => ep.branchId).filter(x => x))];

            const line = document.createElement("div");
            line.className = "permission-line";
            line.dataset.pid = p.id;

            line.innerHTML = `
                <label>
                    <input type="checkbox" class="perm-check" ${related.length > 0 ? "checked" : ""}> 
                    ${p.action}
                </label>
                <button class="btn small secondary select-orgbranch-btn" 
                    data-orgs='${JSON.stringify(orgs)}' 
                    data-branches='${JSON.stringify(branches)}'>
                    Орг: ${orgs.length} | Фил: ${branches.length}
                </button>
            `;

            const btn = line.querySelector(".select-orgbranch-btn");
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                openPermissionSelector(p.id, btn);
            });

            block.appendChild(line);
        });
        container.appendChild(block);
    }
}

function openOrgBranchPopup(preselect = null) {
    const popup = document.getElementById("orgBranchPopup");
    const container = document.getElementById("popupOrgBranchTree");
    const selected = preselect || globalSelected;
    const mainSelectedOrgs = Array.from(document.querySelectorAll(".org-checkbox:checked")).map(cb => parseInt(cb.value));

    if (mainSelectedOrgs.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">Сначала выберите организации на вкладке "Основное"</p>';
        popup.classList.remove("hidden");
        return;
    }

    const filteredOrgs = dictionaries.orgs.filter(o => mainSelectedOrgs.includes(o.id));
    container.innerHTML = "";

    filteredOrgs.forEach(org => {
        const orgDiv = document.createElement("div");
        orgDiv.className = "popup-org";
        const orgChecked = selected.orgs.includes(org.id);

        orgDiv.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 500; flex: 1;">
                    <input type="checkbox" class="popup-org-check" value="${org.id}" ${orgChecked ? "checked" : ""}> 
                    <span class="popup-org-name" style="cursor: pointer;">${org.name}</span>
                </div>
                ${org.branches && org.branches.length > 0 ?
                `<span class="popup-toggle-branches" data-org="${org.id}" style="cursor: pointer; padding: 2px 8px;">▸</span>`
                : ''}
            </div>
            <div class="popup-branches" id="popup-branches-${org.id}" style="display: none;"></div>
        `;

        container.appendChild(orgDiv);
    });

    document.querySelectorAll(".popup-org-name").forEach(span => {
        span.addEventListener("click", (e) => {
            e.stopPropagation();
            const popupOrg = span.closest("div");
            const checkbox = popupOrg.querySelector(".popup-org-check");
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });

    filteredOrgs.forEach(org => {
        const branchDiv = document.getElementById(`popup-branches-${org.id}`);
        if (branchDiv && org.branches && org.branches.length > 0) {
            org.branches.forEach(b => {
                const branchChecked = selected.branches.includes(b.id);
                const el = document.createElement("label");
                el.style.display = "block";
                el.style.padding = "4px 0 4px 32px";
                el.innerHTML = `
                    <input type="checkbox" class="popup-branch-check" data-org="${org.id}" value="${b.id}" ${branchChecked ? "checked" : ""}> 
                    ${b.address}
                `;
                branchDiv.appendChild(el);
            });
        }
    });

    document.querySelectorAll(".popup-toggle-branches").forEach(toggle => {
        toggle.addEventListener("click", (e) => {
            e.stopPropagation();
            const orgId = toggle.dataset.org;
            const branchDiv = document.getElementById(`popup-branches-${orgId}`);

            if (branchDiv.style.display === "none" || branchDiv.style.display === "") {
                branchDiv.style.display = "block";
                toggle.textContent = "▾";
            } else {
                branchDiv.style.display = "none";
                toggle.textContent = "▸";
            }
        });
    });

    addPopupCheckboxLogic();
    popup.classList.remove("hidden");
}

function addPopupCheckboxLogic() {
    document.querySelectorAll(".popup-org-check").forEach(cb => {
        cb.addEventListener("change", (e) => {
            const orgId = e.target.value;
            const branchCheckboxes = document.querySelectorAll(`.popup-branch-check[data-org="${orgId}"]`);

            branchCheckboxes.forEach(b => {
                b.checked = e.target.checked;
            });
        });
    });

    document.querySelectorAll(".popup-branch-check").forEach(cb => {
        cb.addEventListener("change", (e) => {
            const orgId = e.target.dataset.org;
            const orgCheckbox = document.querySelector(`.popup-org-check[value="${orgId}"]`);
            const branchCheckboxes = document.querySelectorAll(`.popup-branch-check[data-org="${orgId}"]`);
            const anyChecked = Array.from(branchCheckboxes).some(b => b.checked);

            if (orgCheckbox) {
                orgCheckbox.checked = anyChecked;
            }
        });
    });
}

function openPermissionSelector(permissionId, button) {
    const currentOrgs = JSON.parse(button.dataset.orgs || "[]");
    const currentBranches = JSON.parse(button.dataset.branches || "[]");

    openOrgBranchPopup({ orgs: currentOrgs, branches: currentBranches });

    document.getElementById("popupSave").onclick = () => {
        const selectedOrgs = Array.from(document.querySelectorAll(".popup-org-check:checked")).map(cb => parseInt(cb.value));
        const selectedBranches = Array.from(document.querySelectorAll(".popup-branch-check:checked")).map(cb => parseInt(cb.value));

        button.dataset.orgs = JSON.stringify(selectedOrgs);
        button.dataset.branches = JSON.stringify(selectedBranches);
        button.textContent = `Орг: ${selectedOrgs.length} | Фил: ${selectedBranches.length}`;

        closePopup();
    };
}

function savePopupSelection() {
    const selectedOrgs = Array.from(document.querySelectorAll(".popup-org-check:checked")).map(cb => parseInt(cb.value));
    const selectedBranches = Array.from(document.querySelectorAll(".popup-branch-check:checked")).map(cb => parseInt(cb.value));

    globalSelected = { orgs: selectedOrgs, branches: selectedBranches };

    const openBtn = document.getElementById("openGlobalSelector");
    if (selectedOrgs.length || selectedBranches.length) {
        openBtn.textContent = `Орг: ${selectedOrgs.length} | Фил: ${selectedBranches.length}`;
    } else {
        openBtn.textContent = "Выбрать организации и филиалы";
    }

    closePopup();
}

function closePopup() {
    document.getElementById("orgBranchPopup").classList.add("hidden");
}

function applyToAllPermissions() {
    if (!globalSelected.orgs.length && !globalSelected.branches.length) {
        showToast("Сначала выберите организации и филиалы");
        return;
    }

    document.querySelectorAll(".select-orgbranch-btn").forEach(btn => {
        btn.dataset.orgs = JSON.stringify(globalSelected.orgs);
        btn.dataset.branches = JSON.stringify(globalSelected.branches);
        btn.textContent = `Орг: ${globalSelected.orgs.length} | Фил: ${globalSelected.branches.length}`;
    });

    showToast("Применено ко всем правам");
}

function applyRolePattern(roleName) {
    const rolePatterns = {
        'Администратор': [
            'Добавление/редактирование', 'Просмотр', 'Удаление',
            'Просмотр внешних комментариев', 'Добавление/редактирование внешних комментариев',
            'Удаление внешних комментариев', 'Добавление/редактирование внутренних комментариев',
            'Просмотр внутренних комментариев', 'Удаление внутренних комментариев',
            'Аналитика', 'Статистика', 'Создать от имени другого пользователя',
            'Просмотр столбца клиент'
        ],
        'Директор': [
            'Просмотр',
            'Просмотр внешних комментариев', 'Просмотр внутренних комментариев',
            'Аналитика', 'Статистика'
        ],
        'Врач': [
            'Добавление/редактирование', 'Просмотр',
            'Добавление/редактирование внешних комментариев', 'Просмотр внешних комментариев',
            'Добавление/редактирование внутренних комментариев', 'Просмотр внутренних комментариев',
            'Статистика'
        ],
        'Менеджер': [
            'Добавление/редактирование', 'Просмотр',
            'Добавление/редактирование внешних комментариев', 'Просмотр внешних комментариев',
            'Просмотр столбца клиент'
        ],
        'Программист': [
            'Просмотр', 'Аналитика', 'Статистика',
            'Просмотр внутренних комментариев'
        ],
        'Техподдержка': [
            'Просмотр', 'Просмотр внешних комментариев',
            'Добавление/редактирование внешних комментариев',
            'Просмотр столбца клиент'
        ],
        'Бухгалтер': [
            'Просмотр', 'Аналитика', 'Статистика'
        ]
    };

    const pattern = rolePatterns[roleName];
    if (!pattern) return;

    const permissionIds = new Set();

    dictionaries.perms.forEach(p => {
        const action = p.action.trim();
        if (pattern.includes(action)) {
            permissionIds.add(p.id);
        }
    });

    document.querySelectorAll(".permission-line").forEach(line => {
        const pid = parseInt(line.dataset.pid);
        const checkbox = line.querySelector(".perm-check");
        const btn = line.querySelector(".select-orgbranch-btn");

        if (permissionIds.has(pid)) {
            checkbox.checked = true;
            if (globalSelected.orgs.length || globalSelected.branches.length) {
                btn.dataset.orgs = JSON.stringify(globalSelected.orgs);
                btn.dataset.branches = JSON.stringify(globalSelected.branches);
                btn.textContent = `Орг: ${globalSelected.orgs.length} | Фил: ${globalSelected.branches.length}`;
            }
        } else {
            checkbox.checked = false;
        }
    });
}

async function saveUser() {
    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const login = document.getElementById("login").value.trim();
    const password = document.getElementById("password").value.trim();
    const sendEmail = document.getElementById("sendEmail")?.checked || false;
    const isSuperAdmin = document.getElementById("isSuperAdmin")?.checked || false;

    if (!fullName || !email || !login) {
        showToast("Заполните обязательные поля");
        return;
    }

    const orgs = Array.from(document.querySelectorAll(".org-checkbox:checked")).map(cb => parseInt(cb.value));
    const branches = Array.from(document.querySelectorAll(".branch-checkbox:checked")).map(cb => parseInt(cb.value));

    const permissions = Array.from(document.querySelectorAll(".permission-line"))
        .filter(p => p.querySelector(".perm-check").checked)
        .map(p => {
            const btn = p.querySelector(".select-orgbranch-btn");
            return {
                permissionId: parseInt(p.dataset.pid),
                organizationIds: JSON.parse(btn.dataset.orgs || "[]"),
                branchIds: JSON.parse(btn.dataset.branches || "[]")
            };
        });

    const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || "";
    const photoPath = document.getElementById("photoPreview")?.dataset.savedpath || null;

    const payload = {
        id: currentUserId,
        fullName,
        email,
        login,
        password: password || null,
        photoPath,
        sendEmail,
        isSuperAdmin,
        organizations: orgs,
        branches,
        permissions
    };

    try {
        const res = await fetch("/Users/Users?handler=SaveUser", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": token
            },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (result.success) {
            closeModal();
            showToast("Пользователь сохранён");
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast(result.message || "Ошибка сохранения");
        }
    } catch (error) {
        console.error("Ошибка:", error);
        showToast("Ошибка сервера");
    }
}

async function deleteUser(id, btn) {
    if (!confirm("Удалить пользователя?")) return;

    const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || "";

    try {
        const res = await fetch(`/Users/Users?handler=DeleteUser&id=${id}`, {
            method: "POST",
            headers: { "RequestVerificationToken": token }
        });

        const result = await res.json();
        if (result.success) {
            btn.closest("tr").remove();
            showToast("Пользователь удалён");
        }
    } catch (error) {
        console.error("Ошибка:", error);
    }
}

async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        document.getElementById("photoPreview").src = ev.target.result;
    };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append("photo", file);

    const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || "";

    try {
        const res = await fetch("/Users/Users?handler=UploadPhoto", {
            method: "POST",
            headers: { "RequestVerificationToken": token },
            body: formData
        });

        const data = await res.json();
        if (data.success) {
            document.getElementById("photoPreview").dataset.savedpath = data.path;
            showToast("Фото загружено");
        }
    } catch (error) {
        console.error("Ошибка загрузки фото:", error);
    }
}

async function loadOrgs(page = 1) {
    try {
        orgCurrentPage = page;
        const res = await fetch(`/Users/Users?handler=GetOrgs&page=${page}&pageSize=${orgPageSize}`);
        const result = await res.json();

        const tbody = document.getElementById("orgsBody");
        tbody.innerHTML = "";

        result.data.forEach(org => {
            const tr = document.createElement("tr");
            tr.dataset.id = org.id;
            tr.dataset.canEdit = org.canEdit;
            tr.dataset.canDelete = org.canDelete;
            tr.className = "org-row";

            const productsList = org.products || [];
            const productsDisplay = productsList.length > 0
                ? (productsList.slice(0, 3).join(', ') + (productsList.length > 3 ? ` +${productsList.length - 3}` : ''))
                : '-';

            tr.innerHTML = `
                <td>${org.name}</td>
                <td>${org.inn || ""}</td>
                <td>${org.kpp || ""}</td>
                <td>${org.ogrn || ""}</td>
                <td>${org.workHoursLimit || 0} ч.</td>
                <td><span title="${productsList.join(', ')}">${productsDisplay}</span></td>
                <td>${org.canDelete ? '<button class="btn small danger delete-org">Удалить</button>' : ''}</td>
            `;
            tbody.appendChild(tr);
        });

        orgTotalPages = result.totalPages;
        renderOrgPagination();

        document.querySelectorAll(".org-row").forEach(tr => {
            const canDelete = tr.dataset.canDelete === 'true';
            tr.addEventListener("click", async (e) => {
                if (e.target.classList.contains("delete-org")) {
                    if (canDelete) {
                        await deleteOrg(tr.dataset.id);
                    } else {
                        showToast("У вас нет прав на удаление этой организации");
                    }
                } else if (!e.target.closest('td:nth-child(6)')) {
                    await editOrg(tr.dataset.id);
                }
            });
        });
    } catch (error) {
        console.error("Ошибка загрузки организаций:", error);
    }
}
function renderOrgPagination() {
    const container = document.getElementById("orgsPagination");
    if (!container) return;

    if (orgTotalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    let html = '<div class="pagination">';
    for (let i = 1; i <= orgTotalPages; i++) {
        html += `<button class="btn small ${i === orgCurrentPage ? 'primary' : 'secondary'}" data-page="${i}">${i}</button>`;
    }
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll("[data-page]").forEach(btn => {
        btn.addEventListener("click", () => {
            loadOrgs(parseInt(btn.dataset.page));
        });
    });
}

function openOrgModal() {
    currentOrgId = 0;
    document.getElementById("orgModalTitle").textContent = "Добавить организацию";
    ["orgName", "orgInn", "orgKpp", "orgOgrn"].forEach(id =>
        document.getElementById(id).value = ""
    );
    document.getElementById("orgWorkHoursLimit").value = 0;
    loadProductsForOrg(0);  // ← ДОБАВИТЬ
    document.getElementById("orgModal").style.display = "flex";
}

function closeOrgModal() {
    document.getElementById("orgModal").style.display = "none";
}

async function editOrg(id) {
    try {
        const res = await fetch(`/Users/Users?handler=GetOrgs&page=1&pageSize=1000`);
        const result = await res.json();
        const org = result.data?.find(o => o.id == id);

        if (org) {
            currentOrgId = id;
            const canEdit = org.canEdit;

            document.getElementById("orgName").value = org.name;
            document.getElementById("orgInn").value = org.inn || "";
            document.getElementById("orgKpp").value = org.kpp || "";
            document.getElementById("orgOgrn").value = org.ogrn || "";
            document.getElementById("orgWorkHoursLimit").value = org.workHoursLimit || 0;

            await loadProductsForOrg(id);  // ← ДОБАВИТЬ

            document.getElementById("orgModalTitle").textContent = canEdit ? "Редактировать организацию" : "Просмотр организации";

            const inputs = ["orgName", "orgInn", "orgKpp", "orgOgrn", "orgWorkHoursLimit"];
            inputs.forEach(inputId => {
                const input = document.getElementById(inputId);
                if (input) input.disabled = !canEdit;
            });

            const productCheckboxes = document.querySelectorAll('.org-product-checkbox');
            productCheckboxes.forEach(cb => cb.disabled = !canEdit);  // ← ДОБАВИТЬ

            const saveBtn = document.getElementById("saveOrgBtn");
            if (saveBtn) saveBtn.style.display = canEdit ? "block" : "none";

            document.getElementById("orgModal").style.display = "flex";
        } else {
            showToast("Организация не найдена");
        }
    } catch (error) {
        console.error("Ошибка:", error);
        showToast("Ошибка загрузки организации");
    }
}

async function editBranch(id) {
    try {
        const res = await fetch(`/Users/Users?handler=GetBranches&page=1&pageSize=1000`);
        const result = await res.json();
        const branch = result.data?.find(b => b.id == id);

        if (branch) {
            currentBranchId = id;
            const canEdit = branch.canEdit;

            document.getElementById("branchAddress").value = branch.address;
            await populateBranchSelect(branch.organizationId);

            document.getElementById("branchModalTitle").textContent = canEdit ? "Редактировать филиал" : "Просмотр филиала";

            const addressInput = document.getElementById("branchAddress");
            if (addressInput) addressInput.disabled = !canEdit;

            const orgSelect = document.getElementById("branchOrgSelect");
            if (orgSelect) {
                const selectDiv = orgSelect.querySelector(".select-selected");
                if (selectDiv) {
                    selectDiv.style.pointerEvents = canEdit ? "auto" : "none";
                    selectDiv.style.opacity = canEdit ? "1" : "0.6";
                }
            }

            const saveBtn = document.getElementById("saveBranchBtn");
            if (saveBtn) saveBtn.style.display = canEdit ? "block" : "none";

            document.getElementById("branchModal").style.display = "flex";
        } else {
            showToast("Филиал не найден");
        }
    } catch (error) {
        console.error("Ошибка:", error);
        showToast("Ошибка загрузки филиала");
    }
}

async function saveOrg() {
    const name = document.getElementById("orgName").value.trim();
    if (!name) {
        showToast("Введите название организации");
        return;
    }

    const productIds = Array.from(document.querySelectorAll('.org-product-checkbox:checked'))
        .map(cb => parseInt(cb.value));  // ← ДОБАВИТЬ

    const payload = {
        id: currentOrgId,
        name,
        inn: document.getElementById("orgInn").value.trim(),
        kpp: document.getElementById("orgKpp").value.trim(),
        ogrn: document.getElementById("orgOgrn").value.trim(),
        workHoursLimit: parseFloat(document.getElementById("orgWorkHoursLimit").value) || 0,
        productIds: productIds  // ← ДОБАВИТЬ
    };

    const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || "";

    try {
        const res = await fetch("/Users/Users?handler=SaveOrg", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": token
            },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (result.success) {
            closeOrgModal();
            await loadOrgs();
            await loadDictionaries();
            showToast("Организация сохранена");
        } else {
            showToast(result.message || "Ошибка сохранения");
        }
    } catch (error) {
        console.error("Ошибка:", error);
        showToast("Ошибка сервера");
    }
}

async function deleteOrg(id) {
    if (!confirm("Удалить организацию?")) return;

    const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || "";

    try {
        const res = await fetch(`/Users/Users?handler=DeleteOrg&id=${id}`, {
            method: "POST",
            headers: { "RequestVerificationToken": token }
        });

        const result = await res.json();
        if (result.success) {
            await loadOrgs();
            await loadDictionaries();
            showToast("Организация удалена");
        } else {
            showToast(result.message || "Ошибка удаления");
        }
    } catch (error) {
        console.error("Ошибка:", error);
    }
}

async function loadBranches(page = 1) {
    try {
        branchCurrentPage = page;
        const res = await fetch(`/Users/Users?handler=GetBranches&page=${page}&pageSize=${branchPageSize}`);
        const result = await res.json();

        const tbody = document.getElementById("branchesBody");
        tbody.innerHTML = "";

        result.data.forEach(b => {
            const tr = document.createElement("tr");
            tr.dataset.id = b.id;
            tr.dataset.orgid = b.organizationId;
            tr.dataset.canEdit = b.canEdit;
            tr.dataset.canDelete = b.canDelete;
            tr.className = "branch-row";
            tr.innerHTML = `
                <td>${b.address}</td>
                <td>${b.organization}</td>
                <td>${b.canDelete ? '<button class="btn small danger delete-branch">Удалить</button>' : ''}</td>
            `;
            tbody.appendChild(tr);
        });

        branchTotalPages = result.totalPages;
        renderBranchPagination();
        updateBranchFilter();

        document.querySelectorAll(".branch-row").forEach(tr => {
            const canDelete = tr.dataset.canDelete === 'true';
            tr.addEventListener("click", async (e) => {
                if (e.target.classList.contains("delete-branch")) {
                    if (canDelete) {
                        await deleteBranch(tr.dataset.id);
                    } else {
                        showToast("У вас нет прав на удаление этого филиала");
                    }
                } else {
                    await editBranch(tr.dataset.id);
                }
            });
        });
    } catch (error) {
        console.error("Ошибка загрузки филиалов:", error);
    }
}

function renderBranchPagination() {
    const container = document.getElementById("branchesPagination");
    if (!container) return;

    if (branchTotalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    let html = '<div class="pagination">';
    for (let i = 1; i <= branchTotalPages; i++) {
        html += `<button class="btn small ${i === branchCurrentPage ? 'primary' : 'secondary'}" data-page="${i}">${i}</button>`;
    }
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll("[data-page]").forEach(btn => {
        btn.addEventListener("click", () => {
            loadBranches(parseInt(btn.dataset.page));
        });
    });
}

async function loadUsers(page = 1) {
    try {
        userCurrentPage = page;
        let url = `/Users/Users?handler=GetUsers&page=${page}&pageSize=${userPageSize}`;

        if (userSelectedOrgs.length > 0) {
            url += `&orgIds=${userSelectedOrgs.join(',')}`;
        }
        if (userSelectedBranches.length > 0) {
            url += `&branchIds=${userSelectedBranches.join(',')}`;
        }

        const res = await fetch(url);
        const result = await res.json();

        const tbody = document.querySelector("#usersTable tbody");
        tbody.innerHTML = "";

        result.data.forEach(user => {
            const tr = document.createElement("tr");
            tr.dataset.userId = user.id;
            tr.innerHTML = `
                <td>${user.fullName}</td>
                <td>${user.login}</td>
                <td>${user.email}</td>
                <td>${user.organizations.join(', ')}<\/td>
                <td>${user.branches.join(', ')}<\/td>
                <td><button class="btn small danger delete-user">Удалить<\/button><\/td>
            `;
            tbody.appendChild(tr);
        });

        userTotalPages = result.totalPages;
        renderUserPagination();

        document.querySelectorAll("#usersTable tbody tr").forEach(tr => {
            tr.addEventListener("click", async (e) => {
                if (!e.target.classList.contains("delete-user")) {
                    await openEditModal(tr.dataset.userId);
                }
            });
        });
    } catch (error) {
        console.error("Ошибка загрузки пользователей:", error);
    }
}

function initUserFilters() {
    const orgFilterDropdown = document.getElementById("userOrgFilterDropdown");
    const branchFilterDropdown = document.getElementById("userBranchFilterDropdown");

    if (!orgFilterDropdown) return;

    // Заполняем фильтр организаций
    orgFilterDropdown.innerHTML = '<label><input type="checkbox" value="all" checked> Все организации</label>';
    dictionaries.orgs.forEach(org => {
        const label = document.createElement("label");
        label.style.display = "block";
        label.style.margin = "5px 0";
        label.innerHTML = `<input type="checkbox" class="user-org-filter" value="${org.id}"> ${org.name}`;
        orgFilterDropdown.appendChild(label);
    });

    // Обработчик для фильтра организаций
    const orgChangeHandler = (e) => {
        const allCheckbox = orgFilterDropdown.querySelector('input[value="all"]');
        const checkboxes = Array.from(orgFilterDropdown.querySelectorAll('.user-org-filter'));

        // Если кликнули на "Все организации"
        if (e && e.target && e.target.value === "all") {
            // Снимаем все остальные галочки
            checkboxes.forEach(cb => cb.checked = false);
            userSelectedOrgs = [];
            if (allCheckbox) allCheckbox.checked = true;
        }
        // Если кликнули на обычную организацию
        else {
            if (allCheckbox) allCheckbox.checked = false;
            userSelectedOrgs = checkboxes.filter(cb => cb.checked).map(cb => parseInt(cb.value));

            // Если ничего не выбрано, то выбираем "Все организации"
            if (userSelectedOrgs.length === 0 && allCheckbox) {
                allCheckbox.checked = true;
            }
        }

        // Обновляем список филиалов и перезагружаем пользователей
        updateUserBranchFilter();
        loadUsers(1);
    };

    // Удаляем старый обработчик и добавляем новый
    if (orgFilterDropdown._orgHandler) {
        orgFilterDropdown.removeEventListener("change", orgFilterDropdown._orgHandler);
    }
    orgFilterDropdown.addEventListener("change", orgChangeHandler);
    orgFilterDropdown._orgHandler = orgChangeHandler;

    // Заполняем фильтр филиалов
    updateUserBranchFilter();
}

function updateUserBranchFilter() {
    const branchFilterDropdown = document.getElementById("userBranchFilterDropdown");
    if (!branchFilterDropdown) return;

    let availableBranches = [];
    if (userSelectedOrgs.length === 0) {
        availableBranches = dictionaries.orgs.flatMap(org => org.branches || []);
    } else {
        availableBranches = dictionaries.orgs
            .filter(org => userSelectedOrgs.includes(org.id))
            .flatMap(org => org.branches || []);
    }

    branchFilterDropdown.innerHTML = '<label><input type="checkbox" value="all" checked> Все филиалы</label>';
    availableBranches.forEach(branch => {
        const label = document.createElement("label");
        label.style.display = "block";
        label.style.margin = "5px 0";
        label.innerHTML = `<input type="checkbox" class="user-branch-filter" value="${branch.id}"> ${branch.address}`;
        branchFilterDropdown.appendChild(label);
    });

    const branchChangeHandler = (e) => {
        const allCheckbox = branchFilterDropdown.querySelector('input[value="all"]');
        const checkboxes = Array.from(branchFilterDropdown.querySelectorAll('.user-branch-filter'));

        // Если кликнули на "Все филиалы"
        if (e && e.target && e.target.value === "all") {
            checkboxes.forEach(cb => cb.checked = false);
            userSelectedBranches = [];
            if (allCheckbox) allCheckbox.checked = true;
        }
        // Если кликнули на обычный филиал
        else {
            if (allCheckbox) allCheckbox.checked = false;
            userSelectedBranches = checkboxes.filter(cb => cb.checked).map(cb => parseInt(cb.value));

            // Если ничего не выбрано, то выбираем "Все филиалы"
            if (userSelectedBranches.length === 0 && allCheckbox) {
                allCheckbox.checked = true;
            }
        }

        loadUsers(1);
    };

    if (branchFilterDropdown._branchHandler) {
        branchFilterDropdown.removeEventListener("change", branchFilterDropdown._branchHandler);
    }
    branchFilterDropdown.addEventListener("change", branchChangeHandler);
    branchFilterDropdown._branchHandler = branchChangeHandler;
}

function renderUserPagination() {
    const container = document.getElementById("usersPagination");
    if (!container) return;

    if (userTotalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    let html = '<div class="pagination">';
    for (let i = 1; i <= userTotalPages; i++) {
        html += `<button class="btn small ${i === userCurrentPage ? 'primary' : 'secondary'}" data-page="${i}">${i}</button>`;
    }
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll("[data-page]").forEach(btn => {
        btn.addEventListener("click", () => {
            loadUsers(parseInt(btn.dataset.page));
        });
    });
}

async function openBranchModal() {
    currentBranchId = 0;
    document.getElementById("branchModalTitle").textContent = "Добавить филиал";
    document.getElementById("branchAddress").value = "";
    await populateBranchSelect();
    document.getElementById("branchModal").style.display = "flex";
}
function initUserFilterDropdowns() {
    const userOrgFilterBtn = document.getElementById("userOrgFilterBtn");
    const userOrgFilterDropdown = document.getElementById("userOrgFilterDropdown");
    const userBranchFilterBtn = document.getElementById("userBranchFilterBtn");
    const userBranchFilterDropdown = document.getElementById("userBranchFilterDropdown");

    if (userOrgFilterBtn && userOrgFilterDropdown) {
        userOrgFilterBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            userOrgFilterDropdown.classList.toggle("hidden");
        });
    }

    if (userBranchFilterBtn && userBranchFilterDropdown) {
        userBranchFilterBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            userBranchFilterDropdown.classList.toggle("hidden");
        });
    }

    document.addEventListener("click", (e) => {
        if (!e.target.closest("#userOrgFilterBtn") && userOrgFilterDropdown) {
            userOrgFilterDropdown.classList.add("hidden");
        }
        if (!e.target.closest("#userBranchFilterBtn") && userBranchFilterDropdown) {
            userBranchFilterDropdown.classList.add("hidden");
        }
    });
}
async function populateBranchSelect(selectedId = null) {
    const container = document.getElementById("branchOrgSelect");
    if (!container) return;

    container.innerHTML = "";

    const res = await fetch("/Users/Users?handler=GetOrgs");
    const orgs = await res.json();

    const customSelect = document.createElement("div");
    customSelect.className = "custom-select";

    const selectedDiv = document.createElement("div");
    selectedDiv.className = "select-selected";

    const selectedOrg = orgs.find(o => o.id == selectedId);
    selectedDiv.innerHTML = `
        <span>${selectedOrg ? selectedOrg.name : "Выберите организацию"}</span>
        <span class="select-arrow">▼</span>
    `;
    customSelect.appendChild(selectedDiv);

    const itemsDiv = document.createElement("div");
    itemsDiv.className = "select-items";

    orgs.forEach(org => {
        const item = document.createElement("div");
        item.className = `select-item ${org.id == selectedId ? 'selected' : ''}`;
        item.dataset.value = org.id;
        item.dataset.name = org.name;
        item.textContent = org.name;
        itemsDiv.appendChild(item);
    });

    customSelect.appendChild(itemsDiv);
    container.appendChild(customSelect);

    if (selectedId) {
        container.dataset.selectedValue = selectedId;
    }

    selectedDiv.addEventListener("click", (e) => {
        e.stopPropagation();

        document.querySelectorAll(".select-items.show").forEach(el => {
            if (el !== itemsDiv) el.classList.remove("show");
        });
        document.querySelectorAll(".select-selected.active").forEach(el => {
            if (el !== selectedDiv) el.classList.remove("active");
        });

        itemsDiv.classList.toggle("show");
        selectedDiv.classList.toggle("active");

        const arrow = selectedDiv.querySelector(".select-arrow");
        arrow.classList.toggle("open");
    });

    itemsDiv.querySelectorAll(".select-item").forEach(item => {
        item.addEventListener("click", (e) => {
            e.stopPropagation();

            itemsDiv.querySelectorAll(".select-item").forEach(i => i.classList.remove("selected"));

            item.classList.add("selected");

            const value = item.dataset.value;
            const name = item.dataset.name;
            selectedDiv.querySelector("span:first-child").textContent = name;

            itemsDiv.classList.remove("show");
            selectedDiv.classList.remove("active");

            const arrow = selectedDiv.querySelector(".select-arrow");
            arrow.classList.remove("open");

            container.dataset.selectedValue = value;
        });
    });

    document.addEventListener("click", (e) => {
        if (!customSelect.contains(e.target)) {
            itemsDiv.classList.remove("show");
            selectedDiv.classList.remove("active");
            const arrow = selectedDiv.querySelector(".select-arrow");
            if (arrow) arrow.classList.remove("open");
        }
    });
}

function closeBranchModal() {
    document.getElementById("branchModal").style.display = "none";
}


async function saveBranch() {
    const address = document.getElementById("branchAddress").value.trim();
    const selectContainer = document.getElementById("branchOrgSelect");
    const orgId = parseInt(selectContainer.dataset.selectedValue);

    if (!address) {
        showToast("Введите адрес филиала");
        return;
    }

    if (!orgId) {
        showToast("Выберите организацию");
        return;
    }

    const payload = {
        id: currentBranchId,
        address,
        organizationId: orgId
    };

    const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || "";

    try {
        const res = await fetch("/Users/Users?handler=SaveBranch", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": token
            },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (result.success) {
            closeBranchModal();
            await loadBranches();
            showToast("Филиал сохранён");
        } else {
            showToast(result.message || "Ошибка сохранения");
        }
    } catch (error) {
        console.error("Ошибка:", error);
    }
}

async function deleteBranch(id) {
    if (!confirm("Удалить филиал?")) return;

    const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || "";

    try {
        const res = await fetch(`/Users/Users?handler=DeleteBranch&id=${id}`, {
            method: "POST",
            headers: { "RequestVerificationToken": token }
        });

        const result = await res.json();
        if (result.success) {
            await loadBranches();
            showToast("Филиал удалён");
        }
    } catch (error) {
        console.error("Ошибка:", error);
    }
}

function updateBranchFilter() {
    const dropdown = document.getElementById("branchOrgFilterDropdown");
    if (!dropdown) return;

    // Получаем организации пользователя
    const userOrgIds = dictionaries.orgs.map(org => org.id);

    // Если организация только одна, скрываем весь фильтр
    const filterBtn = document.getElementById("branchOrgFilterBtn");
    if (userOrgIds.length <= 1) {
        if (filterBtn) {
            filterBtn.style.display = "none";
        }
        return;
    } else {
        if (filterBtn) {
            filterBtn.style.display = "inline-block";
        }
    }

    // Очищаем dropdown, оставляя только заголовок "Все организации"
    dropdown.innerHTML = '<label><input type="checkbox" value="all" checked> Все организации</label>';

    // Добавляем каждую организацию с новой строки
    dictionaries.orgs.forEach(org => {
        const label = document.createElement("label");
        label.style.display = "block";
        label.style.margin = "5px 0";
        label.innerHTML = `<input type="checkbox" class="org-filter-checkbox" value="${org.id}"> ${org.name}`;
        dropdown.appendChild(label);
    });

    // Обработчики событий
    dropdown.addEventListener("change", (e) => {
        const checkboxes = Array.from(dropdown.querySelectorAll(".org-filter-checkbox"));
        const allCheckbox = dropdown.querySelector('input[value="all"]');

        if (e.target.value === "all") {
            checkboxes.forEach(cb => cb.checked = false);
        } else {
            if (allCheckbox) allCheckbox.checked = false;
        }

        const selectedIds = checkboxes
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        const showAll = selectedIds.length === 0 || (allCheckbox && allCheckbox.checked);

        document.querySelectorAll("#branchesBody tr").forEach(tr => {
            tr.style.display = showAll || selectedIds.includes(tr.dataset.orgid) ? "" : "none";
        });
    });
}

function initSearchAndSort() {
    ["searchUser", "searchOrg", "searchBranch"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            const target = id === "searchUser" ? "#usersTable tbody tr"
                : id === "searchOrg" ? "#orgsBody tr"
                    : "#branchesBody tr";

            document.querySelectorAll(target).forEach(tr => {
                const match = tr.innerText.toLowerCase().includes(term);
                tr.style.display = match ? "" : "none";
            });
        });
    });

    document.getElementById("sortUsers")?.addEventListener("click", (e) => sortTable(e.target, "#usersTable tbody", 0, 'user'));
    document.getElementById("sortOrgs")?.addEventListener("click", (e) => sortTable(e.target, "#orgsBody", 0, 'org'));
    document.getElementById("sortBranches")?.addEventListener("click", (e) => sortTable(e.target, "#branchesBody", 0, 'branch'));
}

function sortTable(btn, selector, colIndex, type) {
    const tbody = document.querySelector(selector);
    const rows = Array.from(tbody.children);

    let sortAsc;
    let originalOrder;

    if (type === 'user') {
        sortAsc = userSortAsc;
        originalOrder = originalUserOrder;
    } else if (type === 'org') {
        sortAsc = orgSortAsc;
        originalOrder = originalOrgOrder;
    } else {
        sortAsc = branchSortAsc;
        originalOrder = originalBranchOrder;
    }

    if (sortAsc === true) {
        const sorted = rows.sort((a, b) => {
            return a.cells[colIndex].textContent.localeCompare(b.cells[colIndex].textContent, 'ru');
        });
        tbody.innerHTML = "";
        sorted.forEach(row => tbody.appendChild(row));

        if (type === 'user') userSortAsc = false;
        else if (type === 'org') orgSortAsc = false;
        else branchSortAsc = false;

        btn.textContent = "Сортировать Я–А";
    }
    else if (sortAsc === false) {
        const sorted = rows.sort((a, b) => {
            return b.cells[colIndex].textContent.localeCompare(a.cells[colIndex].textContent, 'ru');
        });
        tbody.innerHTML = "";
        sorted.forEach(row => tbody.appendChild(row));

        if (type === 'user') userSortAsc = null;
        else if (type === 'org') orgSortAsc = null;
        else branchSortAsc = null;

        btn.textContent = "Сбросить сортировку";
    }
    else {
        tbody.innerHTML = "";
        originalOrder.forEach(row => tbody.appendChild(row));

        if (type === 'user') userSortAsc = true;
        else if (type === 'org') orgSortAsc = true;
        else branchSortAsc = true;

        btn.textContent = "Сортировать A–Я";
    }
}

function generatePassword(length = 10) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
}

function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}