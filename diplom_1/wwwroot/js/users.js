//  ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ 
let dictionaries = { orgs: [], perms: [], roles: [] };
let currentUserId = 0;
let currentOrgId = 0;
let currentBranchId = 0;
let globalSelected = { orgs: [], branches: [] };
let currentPermissions = []; // для хранения прав при редактировании
let originalUserOrder = [];  // для сброса сортировки
let originalOrgOrder = [];
let originalBranchOrder = [];

//  ЗАГРУЗКА И ПРЕДПРОСМОТР ФОТО 
document.addEventListener("DOMContentLoaded", () => {
    const uploadBtn = document.getElementById("uploadPhotoBtn");
    const fileInput = document.getElementById("userPhoto");
    const preview = document.getElementById("photoPreview");

    if (uploadBtn && fileInput && preview) {
        // Клик по кнопке "Загрузить фото" открывает выбор файла
        uploadBtn.addEventListener("click", () => fileInput.click());

        // Когда выбрано изображение — показываем превью
        fileInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                preview.src = ev.target.result;
            };
            reader.readAsDataURL(file);

            // --- ЗАГРУЗКА НА СЕРВЕР ---
            const formData = new FormData();
            formData.append("photo", file);

            const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || "";
            const res = await fetch("/Users/Users?handler=UploadPhoto", {
                method: "POST",
                headers: { "RequestVerificationToken": token },
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                // Сохраняем путь в dataset, чтобы потом отправить вместе с пользователем
                preview.dataset.savedpath = data.path;
                showToast("Фото загружено");
            } else {
                showToast("Ошибка при загрузке фото");
            }
        });
    }
});


//  ИНИЦИАЛИЗАЦИЯ 
document.addEventListener("DOMContentLoaded", async () => {
    await loadDictionaries();
    await loadOrgs();
    await loadBranches();
    // 💡 Блокируем автозаполнение Chrome для поля поиска пользователей
    setTimeout(() => {
        const field = document.getElementById("searchUser");
        if (field) {
            // создаём новый элемент и заменяем автозаполненный
            const cleanClone = field.cloneNode(true);
            cleanClone.value = ""; // очищаем любые автоподставленные данные
            field.replaceWith(cleanClone);

            // привязываем события заново
            cleanClone.addEventListener("input", (e) => {
                const term = e.target.value.toLowerCase();
                document.querySelectorAll("#usersTable tbody tr").forEach(tr => {
                    const match = tr.innerText.toLowerCase().includes(term);
                    tr.style.display = match ? "" : "none";
                });
            });
        }
    }, 300);


    // Разрешаем переключение вкладок в модалке редактирования пользователя
    document.querySelectorAll(".tab-button").forEach(btn => {
        btn.addEventListener("click", () => {
            // Разрешаем только если редактируется или создаётся пользователь (т.е. модалка открыта)
            if (document.getElementById("userModal").style.display === "flex") {
                switchTab(btn.dataset.tab);
            }
        });
    });

    //  Главные вкладки 
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("main-tab")) {
            document.querySelectorAll(".main-tab").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-section").forEach(s => s.classList.remove("active"));
            e.target.classList.add("active");
            document.getElementById(e.target.dataset.tab).classList.add("active");
        }
    });

    //  Пользователи 
    document.getElementById("btnAddUser").addEventListener("click", openCreateModal);
    document.getElementById("closeModal").addEventListener("click", closeModal);
    document.getElementById("cancelUserBtn").addEventListener("click", closeModal);
    document.getElementById("nextToPermissions").addEventListener("click", () => switchTab("tab-permissions"));
    document.getElementById("backToGeneral").addEventListener("click", () => switchTab("tab-general"));
    document.getElementById("saveUserBtn").addEventListener("click", saveUser);
    document.getElementById("generatePassword").addEventListener("click", () => {
        const pass = generatePassword();
        document.getElementById("password").value = pass;
        console.log("Сгенерирован пароль:", pass);
    });
    document.getElementById("togglePassword").addEventListener("click", () => {
        const input = document.getElementById("password");
        input.type = input.type === "password" ? "text" : "password";
    });

    //  Права 
    document.getElementById("openGlobalSelector").addEventListener("click", openOrgBranchPopup);
    document.getElementById("closePopup").addEventListener("click", closePopup);
    document.getElementById("popupSave").addEventListener("click", savePopupSelection);
    document.getElementById("applyToAll").addEventListener("click", applyToAllPermissions);
    document.querySelectorAll(".pattern-btn").forEach(btn =>
        btn.addEventListener("click", () => applyRolePattern(btn.dataset.role))
    );

    //  Организации 
    document.getElementById("btnAddOrg").addEventListener("click", openOrgModal);
    document.getElementById("closeOrgModal").addEventListener("click", closeOrgModal);
    document.getElementById("cancelOrgBtn").addEventListener("click", closeOrgModal);
    document.getElementById("saveOrgBtn").addEventListener("click", saveOrg);

    //  Филиалы 
    document.getElementById("btnAddBranch").addEventListener("click", openBranchModal);
    document.getElementById("closeBranchModal").addEventListener("click", closeBranchModal);
    document.getElementById("cancelBranchBtn").addEventListener("click", closeBranchModal);
    document.getElementById("saveBranchBtn").addEventListener("click", saveBranch);

    //  Делегирование пользователей 
    document.addEventListener("click", async (e) => {
        const tr = e.target.closest("tr[data-user-id]");
        if (tr && !e.target.classList.contains("delete-user")) await openEditModal(tr.dataset.userId);
        if (e.target.classList.contains("delete-user")) await deleteUser(tr.dataset.userId, e.target);
    });
    //  Выпадающее меню фильтра организаций у филиалов 
    const filterBtn = document.getElementById("branchOrgFilterBtn");
    const dropdown = document.getElementById("branchOrgFilterDropdown");

    if (filterBtn && dropdown) {
        // открытие/закрытие по клику
        filterBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("hidden");
            // поворот стрелки ▾ → ▴
            filterBtn.textContent = dropdown.classList.contains("hidden")
                ? "Фильтр организаций ▾"
                : "Фильтр организаций ▴";
        });

        // закрытие при клике вне меню
        document.addEventListener("click", (e) => {
            if (!dropdown.contains(e.target) && !filterBtn.contains(e.target)) {
                dropdown.classList.add("hidden");
                filterBtn.textContent = "Фильтр организаций ▾";
            }
        });
    }

});

//  СПРАВОЧНИКИ 
//  СПРАВОЧНИКИ 
async function loadDictionaries() {
    const res = await fetch("/Users/Users?handler=Dictionaries");
    const data = await res.json();
    dictionaries = data;

    const orgContainer = document.getElementById("organizationsList");
    orgContainer.innerHTML = "";

    // 🔹 создаём дерево организаций со стрелкой раскрытия
    data.orgs.forEach(o => {
        const orgDiv = document.createElement("div");
        orgDiv.className = "org-block";
        orgDiv.innerHTML = `
            <div class="org-header">
                <label><input type="checkbox" class="org-checkbox" value="${o.id}"> ${o.name}</label>
                <span class="toggle-branches" data-org="${o.id}">▸</span>
            </div>
            <div class="branch-sublist" id="branches-of-${o.id}" style="display:none;"></div>
        `;
        orgContainer.appendChild(orgDiv);
    });

    // 🔹 обработка чекбоксов организаций
    document.addEventListener("change", e => {
        if (e.target.classList.contains("org-checkbox")) {
            const orgId = parseInt(e.target.value);
            const sublist = document.getElementById(`branches-of-${orgId}`);
            sublist.innerHTML = "";
            const org = data.orgs.find(o => o.id === orgId);

            if (e.target.checked && org) {
                org.branches.forEach(b => {
                    const el = document.createElement("label");
                    el.innerHTML = `<input type="checkbox" class="branch-checkbox" data-org="${orgId}" value="${b.id}"> ${b.address}`;
                    sublist.appendChild(el);
                });
            } else {
                sublist.style.display = "none";
                const toggle = document.querySelector(`.toggle-branches[data-org="${orgId}"]`);
                if (toggle) toggle.textContent = "▸";
            }
        }

        // если отмечен филиал — автоматически ставим галочку на его организацию
        if (e.target.classList.contains("branch-checkbox")) {
            const orgId = parseInt(e.target.dataset.org);
            const orgCb = document.querySelector(`.org-checkbox[value="${orgId}"]`);
            if (orgCb) orgCb.checked = true;
        }
    });

    // 🔹 раскрытие/сворачивание филиалов по стрелке ▸ ▾
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("toggle-branches")) {
            const orgId = parseInt(e.target.dataset.org);
            const sublist = document.getElementById(`branches-of-${orgId}`);
            const org = dictionaries.orgs.find(o => o.id  === orgId);
            if (!org) return;

            // Получаем список филиалов, уже отмеченных у пользователя (если он редактируется)
            const userBranchIds = Array.from(document.querySelectorAll(".branch-checkbox"))
                .filter(cb => cb.checked)
                .map(cb => parseInt(cb.value));

            if (sublist.style.display === "none" || sublist.style.display === "") {
                sublist.innerHTML = "";
                org.branches.forEach(b => {
                    const el = document.createElement("label");
                    const isChecked = userBranchIds.includes(b.id);
                    el.innerHTML = `<input type="checkbox" class="branch-checkbox" data-org="${orgId}" value="${b.id}" ${isChecked ? "checked" : ""}> ${b.address}`;
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
}


//  МОДАЛКА ПОЛЬЗОВАТЕЛЯ 

async function openEditModal(id) {
    currentUserId = parseInt(id);
    document.getElementById("modalTitle").textContent = "Редактирование пользователя";

    const res = await fetch(`/Users/Users?handler=UserDetails&id=${id}`);
    const data = await res.json();
    // --- Фото ---
    const preview = document.getElementById("photoPreview");
    if (preview) {
        if (data.photoPath) {
            preview.src = data.photoPath;
            preview.dataset.savedpath = data.photoPath;
        } else {
            preview.src = "/icons/default-avatar.png";
            delete preview.dataset.savedpath;
        }
    }

    document.getElementById("fullName").value = data.fullName;
    document.getElementById("email").value = data.email;
    document.getElementById("login").value = data.login;

    // 🔹 Ставим галочки у организаций и подготавливаем филиалы (не раскрывая)
    document.querySelectorAll(".org-checkbox").forEach(cb => {
        const orgId = parseInt(cb.value);
        cb.checked = data.organizations.includes(orgId);

        const sublist = document.getElementById(`branches-of-${orgId}`);
        sublist.innerHTML = "";
        const org = dictionaries.orgs.find(o => o.id === orgId);
        if (!org) return;

        org.branches.forEach(b => {
            const el = document.createElement("label");
            const isChecked = data.branches.includes(b.id);
            el.innerHTML = `<input type="checkbox" class="branch-checkbox" data-org="${orgId}" value="${b.id}" ${isChecked ? "checked" : ""}> ${b.address}`;
            sublist.appendChild(el);
        });
        sublist.style.display = "none"; // по умолчанию скрыты
        const toggle = document.querySelector(`.toggle-branches[data-org="${orgId}"]`);
        if (toggle) toggle.textContent = "▸";
    });

    currentPermissions = data.permissions || [];
    renderPermissions(currentPermissions);

    document.getElementById("userModal").style.display = "flex";
    switchTab("tab-general");
}

//  МОДАЛКА ПОЛЬЗОВАТЕЛЯ 
function openCreateModal() {
    currentUserId = 0;
    currentPermissions = [];
    document.getElementById("modalTitle").textContent = "Добавление пользователя";
    clearModalFields();
    document.getElementById("userModal").style.display = "flex";
    switchTab("tab-general");
    const preview = document.getElementById("photoPreview");
    if (preview) {
        preview.src = "/icons/default-avatar.png";
        delete preview.dataset.savedpath;
    }

}



function closeModal() {
    document.getElementById("userModal").style.display = "none";
}

function clearModalFields() {
    ["fullName", "email", "login", "password"].forEach(id => document.getElementById(id).value = "");
    document.querySelectorAll("#organizationsList input[type='checkbox']").forEach(cb => cb.checked = false);
    document.getElementById("permissionsContainer").innerHTML = "";
}

function switchTab(tabId) {
    document.querySelectorAll(".tab-button").forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.toggle("active", t.id === tabId));
    if (tabId === "tab-permissions") renderPermissions(currentPermissions);
}

//  РЕНДЕР ПРАВ 
function renderPermissions(existing = []) {
    const container = document.getElementById("permissionsContainer");
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
            const line = document.createElement("div");
            line.className = "permission-line";
            line.dataset.pid = p.id;

            const related = existing.filter(ep => ep.permissionId === p.id);
            const orgs = [...new Set(related.map(ep => ep.organizationId).filter(x => x))];
            const branches = [...new Set(related.map(ep => ep.branchId).filter(x => x))];

            const btn = document.createElement("button");
            btn.className = "btn small secondary select-orgbranch-btn";
            btn.textContent = `Орг: ${orgs.length} | Фил: ${branches.length}`;
            btn.dataset.orgs = JSON.stringify(orgs);
            btn.dataset.branches = JSON.stringify(branches);
            btn.addEventListener("click", (e) => openInlineSelectorForPermission(e, p.id, btn));

            const isChecked = related.length > 0;
            line.innerHTML = `<label><input type="checkbox" class="perm-check" ${isChecked ? "checked" : ""}> ${p.action}</label>`;
            line.appendChild(btn);
            block.appendChild(line);
        });
        container.appendChild(block);
    }
}

//  РОЛИ (ПАТТЕРНЫ) 
function applyRolePattern(roleId) {
    const role = dictionaries.roles.find(r => r.id == roleId);
    if (!role) return;
    const ids = new Set(role.permissions);

    document.querySelectorAll(".permission-line").forEach(line => {
        const pid = parseInt(line.dataset.pid);
        const cb = line.querySelector(".perm-check");
        const btn = line.querySelector(".select-orgbranch-btn");

        if (ids.has(pid)) {
            cb.checked = true;
            if (globalSelected.orgs.length || globalSelected.branches.length) {
                btn.dataset.orgs = JSON.stringify(globalSelected.orgs);
                btn.dataset.branches = JSON.stringify(globalSelected.branches);
                btn.textContent = `Орг: ${globalSelected.orgs.length} | Фил: ${globalSelected.branches.length}`;
            }
        } else cb.checked = false;
    });
}

//  ВЫБОР ОРГ/ФИЛ ДЛЯ КОНКРЕТНОГО ПРАВА 
async function openInlineSelectorForPermission(e, pid, btn) {
    e.stopPropagation();
    const current = {
        orgs: JSON.parse(btn.dataset.orgs || "[]"),
        branches: JSON.parse(btn.dataset.branches || "[]")
    };
    openOrgBranchPopup();
    renderPopupTree(current);

    document.getElementById("popupSave").onclick = () => {
        const selectedOrgs = Array.from(document.querySelectorAll(".popup-org-check:checked")).map(cb => parseInt(cb.value));
        const selectedBranches = Array.from(document.querySelectorAll(".popup-branch-check:checked")).map(cb => parseInt(cb.value));
        btn.dataset.orgs = JSON.stringify(selectedOrgs);
        btn.dataset.branches = JSON.stringify(selectedBranches);
        btn.textContent = `Орг: ${selectedOrgs.length} | Фил: ${selectedBranches.length}`;
        closePopup();
    };
}

//  МОДАЛКА ДРЕВА ОРГ/ФИЛ 
function openOrgBranchPopup() {
    document.getElementById("orgBranchPopup").classList.remove("hidden");
    renderPopupTree();
}
function closePopup() {
    document.getElementById("orgBranchPopup").classList.add("hidden");
}
function renderPopupTree(preselect = { orgs: [], branches: [] }) {
    const container = document.getElementById("popupOrgBranchTree");
    container.innerHTML = "";
    const selectedOrgs = Array.from(document.querySelectorAll(".org-checkbox:checked")).map(cb => parseInt(cb.value));
    const selectedBranches = Array.from(document.querySelectorAll(".branch-checkbox:checked")).map(cb => parseInt(cb.value));

    dictionaries.orgs
        .filter(o => selectedOrgs.includes(o.id))
        .forEach(o => {
            const orgDiv = document.createElement("div");
            orgDiv.className = "popup-org";
            const orgChecked = preselect.orgs.includes(o.id) ? "checked" : "";
            orgDiv.innerHTML = `<label><input type="checkbox" class="popup-org-check" value="${o.id}" ${orgChecked}> ${o.name}</label>`;
            const branchList = document.createElement("div");
            branchList.className = "popup-branches";
            o.branches.filter(b => selectedBranches.includes(b.id)).forEach(b => {
                const bChecked = preselect.branches.includes(b.id) ? "checked" : "";
                const el = document.createElement("label");
                el.innerHTML = `<input type="checkbox" class="popup-branch-check" data-org="${o.id}" value="${b.id}" ${bChecked}> ${b.address}`;
                branchList.appendChild(el);
            });
            orgDiv.appendChild(branchList);
            container.appendChild(orgDiv);
        });
}
function savePopupSelection() {
    const selectedOrgs = Array.from(document.querySelectorAll(".popup-org-check:checked")).map(cb => parseInt(cb.value));
    const selectedBranches = Array.from(document.querySelectorAll(".popup-branch-check:checked")).map(cb => parseInt(cb.value));
    globalSelected = { orgs: selectedOrgs, branches: selectedBranches };
    closePopup();

    // обновляем текст у глобальной кнопки
    const openBtn = document.getElementById("openGlobalSelector");
    if (selectedOrgs.length || selectedBranches.length)
        openBtn.textContent = `Организации: ${selectedOrgs.length} | Филиалы: ${selectedBranches.length}`;
    else
        openBtn.textContent = "Выбрать организации и филиалы";
}

function applyToAllPermissions() {
    document.querySelectorAll(".select-orgbranch-btn").forEach(btn => {
        btn.dataset.orgs = JSON.stringify(globalSelected.orgs);
        btn.dataset.branches = JSON.stringify(globalSelected.branches);
        btn.textContent = `Орг: ${globalSelected.orgs.length} | Фил: ${globalSelected.branches.length}`;
    });
}
//  СОХРАНЕНИЕ ПОЛЬЗОВАТЕЛЯ 
async function saveUser() {
    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const login = document.getElementById("login").value.trim();
    const password = document.getElementById("password").value.trim();
    const sendEmail = document.getElementById("sendEmail")?.checked || false; 

    if (!validateUserForm()) {
        showToast("Проверьте правильность заполнения данных пользователя");
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
        password,
        photoPath,
        organizations: orgs,
        branches,
        permissions
    };


    const res = await fetch("/Users/Users?handler=SaveUser", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "RequestVerificationToken": token
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        alert("Ошибка при сохранении: " + res.statusText);
        return;
    }

    const result = await res.json();
    if (result.success) {
        //  имитация отправки email пользователю
        if (sendEmail) {
            console.log(`📨 Письмо отправлено на ${email} с логином и паролем.`);
            showToast(`Письмо отправлено на ${email}`);
        }

        closeModal();
        showToast("Пользователь сохранён!");
        setTimeout(() => location.reload(), 1200);
    } else {
        alert("Ошибка при сохранении пользователя!");
    }
}


//  ЖИВАЯ ВАЛИДАЦИЯ ВСЕХ ФОРМ 

//  Универсальная функция 
function validateField(input, extra = {}) {
    const value = input.value.trim();
    const forbiddenPattern = /[<>\/]/;
    let isValid = true;
    let message = "";

    // Пустое поле
    if (!value) {
        isValid = false;
        message = "Поле не может быть пустым";
    }
    // Недопустимые символы
    else if (forbiddenPattern.test(value)) {
        isValid = false;
        message = "Недопустимые символы";
    }
    // Проверка email
    else if (input.id === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        isValid = false;
        message = "Некорректный email";
    }

    // Проверка длины (если задана)
    if (extra.min && value.length < extra.min) {
        isValid = false;
        message = `Минимум ${extra.min} символов`;
    }
    if (extra.max && value.length > extra.max) {
        isValid = false;
        message = `Максимум ${extra.max} символов`;
    }

    // Применяем оформление
    if (!isValid) {
        input.classList.add("invalid");
        input.title = message;
    } else {
        input.classList.remove("invalid");
        input.title = "";
    }

    return isValid;
}

//  Проверка всех полей пользователя 
function validateUserForm() {
    const inputs = document.querySelectorAll("#fullName, #email, #login, #password");
    let valid = true;
    inputs.forEach(inp => {
        const req = inp.id === "password" && currentUserId ? {} : { min: 3 };
        if (!validateField(inp, req)) valid = false;
    });
    return valid;
}

//  Проверка всех полей организации 
function validateOrgForm() {
    const name = document.getElementById("orgName");
    return validateField(name, { min: 2 });
}

//  Проверка всех полей филиала 
function validateBranchForm() {
    const address = document.getElementById("branchAddress");
    const orgSelect = document.getElementById("branchOrgSelect");
    let valid = true;

    if (!validateField(address, { min: 3 })) valid = false;

    if (!orgSelect.value || orgSelect.value === "0") {
        orgSelect.classList.add("invalid");
        valid = false;
    } else orgSelect.classList.remove("invalid");

    return valid;
}

//  Инициализация живой проверки при вводе 
function initLiveValidation() {
    const selectors = [
        "#fullName", "#email", "#login", "#password",
        "#orgName", "#branchAddress"
    ];
    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(input => {
            input.addEventListener("input", () => validateField(input));
            input.addEventListener("blur", () => validateField(input));
        });
    });
}

//  Подключаем при загрузке 
document.addEventListener("DOMContentLoaded", initLiveValidation);

//  ОРГАНИЗАЦИИ 
async function loadOrgs() {
    const res = await fetch("/Users/Users?handler=GetOrgs");
    const data = await res.json();
    const body = document.getElementById("orgsBody");
    body.innerHTML = "";
    data.forEach(o => {
        const tr = document.createElement("tr");
        tr.dataset.id = o.id;
        tr.classList.add("org-row");
        tr.innerHTML = `
            <td>${o.name}</td>
            <td>${o.inn}</td>
            <td>${o.kpp}</td>
            <td>${o.ogrn}</td>
            <td><button class='btn small danger delete-org' data-id='${o.id}'>Удалить</button></td>
        `;
        body.appendChild(tr);
    });
    originalOrgOrder = Array.from(body.children);
    body.querySelectorAll("tr.org-row").forEach(tr => {
        tr.addEventListener("click", async (e) => {
            if (e.target.classList.contains("delete-org")) {
                await deleteOrg(tr.dataset.id);
            } else {
                await editOrg(tr.dataset.id);
            }
        });
    });
}

function openOrgModal() {
    currentOrgId = 0;
    document.getElementById("orgModalTitle").textContent = "Добавить организацию";
    ["orgName", "orgInn", "orgKpp", "orgOgrn"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("orgModal").style.display = "flex";
}
function closeOrgModal() { document.getElementById("orgModal").style.display = "none"; }

async function editOrg(id) {
    const res = await fetch("/Users/Users?handler=GetOrgs");
    const data = await res.json();
    const org = data.find(o => o.id == id);
    if (!org) return;
    currentOrgId = id;
    document.getElementById("orgName").value = org.name;
    document.getElementById("orgInn").value = org.inn;
    document.getElementById("orgKpp").value = org.kpp;
    document.getElementById("orgOgrn").value = org.ogrn;
    document.getElementById("orgModalTitle").textContent = "Редактировать организацию";
    document.getElementById("orgModal").style.display = "flex";
}

async function saveOrg() {
    if (!validateOrgForm()) {
        showToast("Проверьте правильность названия организации");
        return;
    }

    const payload = {
        id: currentOrgId,
        name: document.getElementById("orgName").value.trim(),
        inn: document.getElementById("orgInn").value.trim(),
        kpp: document.getElementById("orgKpp").value.trim(),
        ogrn: document.getElementById("orgOgrn").value.trim()
    };
    const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || "";
    const res = await fetch("/Users/Users?handler=SaveOrg", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "RequestVerificationToken": token
        },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) { alert("Организация сохранена"); closeOrgModal(); await loadOrgs(); }
    else alert("Ошибка при сохранении организации");
}
async function deleteOrg(id) {
    if (!confirm("Удалить организацию?")) return;
    const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || "";
    const res = await fetch(`/Users/Users?handler=DeleteOrg&id=${id}`, {
        method: "POST",
        headers: { "RequestVerificationToken": token }
    });
    const data = await res.json();
    if (data.success) await loadOrgs();
}

//  УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ 
async function deleteUser(id, btn) {
    if (!confirm("Удалить пользователя?")) return;
    const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || "";
    const res = await fetch(`/Users/Users?handler=DeleteUser&id=${id}`, {
        method: "POST",
        headers: { "RequestVerificationToken": token }
    });
    const data = await res.json();
    if (data.success) btn.closest("tr").remove();
}

//  ФИЛИАЛЫ 
async function loadBranches() {
    const res = await fetch("/Users/Users?handler=GetBranches");
    const data = await res.json();
    const body = document.getElementById("branchesBody");
    body.innerHTML = "";

    data.forEach(b => {
        const tr = document.createElement("tr");
        tr.dataset.id = b.id;
        tr.dataset.org = b.organization;           
        tr.dataset.orgid = b.organizationId || ""; 
        tr.classList.add("branch-row");
        tr.innerHTML = `
            <td>${b.address}</td>
            <td>${b.organization}</td>
            <td><button class='btn small danger delete-branch' data-id='${b.id}'>Удалить</button></td>
        `;
        body.appendChild(tr);
    });

    originalBranchOrder = Array.from(body.children);

    const dropdown = document.getElementById("branchOrgFilterDropdown");
    if (!dropdown) return;

    dropdown.querySelectorAll("label:not(:first-child)").forEach(l => l.remove());
    dictionaries.orgs.forEach(o => {
        const lbl = document.createElement("label");
        lbl.innerHTML = `<input type="checkbox" class="org-filter-checkbox" value="${o.id}"> ${o.name}`;
        dropdown.appendChild(lbl);
    });

    const newDropdown = dropdown.cloneNode(true);
    dropdown.parentNode.replaceChild(newDropdown, dropdown);

    newDropdown.addEventListener("change", (e) => {
        const checkboxes = Array.from(newDropdown.querySelectorAll(".org-filter-checkbox"));
        const allCheckbox = newDropdown.querySelector('input[value="all"]');

        if (e.target.value === "all") {
            checkboxes.forEach(cb => { if (cb.value !== "all") cb.checked = false; });
        } else {
            if (allCheckbox) allCheckbox.checked = false;
        }

        const selectedIds = checkboxes
            .filter(cb => cb.checked && cb.value !== "all")
            .map(cb => cb.value);

        const showAll = (selectedIds.length === 0) || (allCheckbox && allCheckbox.checked);

        document.querySelectorAll("#branchesBody tr").forEach(tr => {
            tr.style.display = showAll || selectedIds.includes(tr.dataset.orgid) ? "" : "none";
        });
    });

    body.querySelectorAll("tr.branch-row").forEach(tr => {
        tr.addEventListener("click", async (e) => {
            if (e.target.classList.contains("delete-branch")) {
                await deleteBranch(tr.dataset.id);
            } else {
                await editBranch(tr.dataset.id);
            }
        });
    });
}

async function openBranchModal() {
    currentBranchId = 0;
    document.getElementById("branchModalTitle").textContent = "Добавить филиал";
    document.getElementById("branchAddress").value = "";
    await populateBranchOrgSelect(); 
    document.getElementById("branchModal").style.display = "flex";
}
async function populateBranchOrgSelect(selectedId = null) {
    const res = await fetch("/Users/Users?handler=GetOrgs");
    const data = await res.json();
    const select = document.getElementById("branchOrgSelect");
    select.innerHTML = "";
    data.forEach(o => {
        const opt = document.createElement("option");
        opt.value = o.id;
        opt.textContent = o.name;
        if (selectedId && selectedId == o.id) opt.selected = true;
        select.appendChild(opt);
    });
}

function closeBranchModal() { document.getElementById("branchModal").style.display = "none"; }

async function editBranch(id) {
    const res = await fetch("/Users/Users?handler=GetBranches");
    const data = await res.json();
    const b = data.find(x => x.id == id);
    if (!b) return;
    currentBranchId = id;
    document.getElementById("branchAddress").value = b.address;
    await populateBranchOrgSelect(b.organizationId); 
    document.getElementById("branchModalTitle").textContent = "Редактировать филиал";
    document.getElementById("branchModal").style.display = "flex";
}

async function saveBranch() {
    if (!validateBranchForm()) {
        showToast("Проверьте правильность данных филиала");
        return;
    }

    const payload = {
        id: currentBranchId,
        address: document.getElementById("branchAddress").value.trim(),
        organizationId: parseInt(document.getElementById("branchOrgSelect").value)
    };
    const token = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]')?.value || "";
    const res = await fetch("/Users/Users?handler=SaveBranch", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "RequestVerificationToken": token
        },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) { alert("Филиал сохранён"); closeBranchModal(); await loadBranches(); }
    else alert("Ошибка при сохранении филиала");
}
async function deleteBranch(id) {
    if (!confirm("Удалить филиал?")) return;
    const token = document.querySelector('#antiForgeryForm input[address="__RequestVerificationToken"]')?.value || "";
    const res = await fetch(`/Users/Users?handler=DeleteBranch&id=${id}`, {
        method: "POST",
        headers: { "RequestVerificationToken": token }
    });
    const data = await res.json();
    if (data.success) await loadBranches();
}

//  СОРТИРОВКИ И ПОИСК 

//  подсветка совпадений 
function highlightSearch(text, term) {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, "gi");
    return text.replace(regex, "<span class='highlight'>$1</span>");
}

//  поиск по таблицам 
document.addEventListener("input", e => {
    const term = e.target.value.toLowerCase();
    if (["searchUser", "searchOrg", "searchBranch"].includes(e.target.id)) {
        const target = e.target.id === "searchUser" ? "#usersTable tbody tr"
            : e.target.id === "searchOrg" ? "#orgsBody tr" : "#branchesBody tr";
        document.querySelectorAll(target).forEach(tr => {
            const match = tr.innerText.toLowerCase().includes(term);
            tr.style.display = match ? "" : "none";
            tr.querySelectorAll("td").forEach(td => td.innerHTML =
                match && term ? highlightSearch(td.textContent, term) : td.textContent);
        });
    }
});

//  универсальная функция сортировки с подсветкой и сбросом 
function applySort(btn, rows, index, body, originalOrder) {
    const active = btn.classList.toggle("active-sort");
    if (!active) {
        body.innerHTML = "";
        originalOrder.forEach(r => body.appendChild(r));
        return;
    }
    const sorted = [...rows].sort((a, b) =>
        a.cells[index].textContent.localeCompare(b.cells[index].textContent, "ru"));
    body.innerHTML = "";
    sorted.forEach(r => body.appendChild(r));
}

//  пользователи 
document.getElementById("sortUsers")?.addEventListener("click", (e) => {
    const body = document.querySelector("#usersTable tbody");
    const rows = Array.from(body.children);
    if (originalUserOrder.length  === 0) originalUserOrder = rows;
    applySort(e.target, rows, 0, body, originalUserOrder);
});

//  организации 
document.getElementById("sortOrgs")?.addEventListener("click", (e) => {
    const body = document.getElementById("orgsBody");
    const rows = Array.from(body.children);
    applySort(e.target, rows, 0, body, originalOrgOrder);
});

//  филиалы 
document.getElementById("sortBranches")?.addEventListener("click", (e) => {
    const body = document.getElementById("branchesBody");
    const rows = Array.from(body.children);
    applySort(e.target, rows, 0, body, originalBranchOrder);
});

//  ВСПЛЫВАЮЩИЕ УВЕДОМЛЕНИЯ 
function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}

//  ГЕНЕРАЦИЯ ПАРОЛЯ 
function generatePassword(length = 10) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let pass = "";
    for (let i = 0; i < length; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
}

// Перехватываем нажатие кнопки "Сгенерировать"
document.addEventListener("DOMContentLoaded", () => {
    const genBtn = document.getElementById("generatePassword");
    if (genBtn) {
        genBtn.addEventListener("click", () => {
            const pass = generatePassword();
            const input = document.getElementById("password");
            input.value = pass;

            // Покажем всплывающее уведомление
            showToast(`Сгенерирован пароль: ${pass}`);
            console.log("Сгенерирован пароль:", pass);
        });
    }
});

