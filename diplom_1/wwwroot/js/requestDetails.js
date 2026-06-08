console.log("requestDetails.js loaded");

let activeEdit = null;

document.addEventListener("DOMContentLoaded", () => {
    initPageAlertsAsToasts();
    initFieldEditing();
    initEditModal();
    initCommentFiles();
    initCommentFormAjax();
    initCommentEditing();
    initRequestDelete();
    initKeyboardHandlers();
    initCustomSelectClose();
});

/* =========================
   FIELD EDITING
========================= */

function initFieldEditing() {
    const canEdit = getPageFlag("canEdit");
    const canChangeStatus = getPageFlag("canChangeStatus");

    if (!canEdit && !canChangeStatus) {
        return;
    }

    document.querySelectorAll(".edit-field-btn").forEach(button => {
        button.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();

            const field = button.dataset.field;

            if (!field) {
                return;
            }

            if (field === "status" && !canChangeStatus) {
                showToast("Нет права изменять статус этой заявки");
                return;
            }

            if (field !== "status" && !canEdit) {
                showToast("Нет права редактировать эту заявку");
                return;
            }

            await openEditModal(field);
        });
    });
}

function initEditModal() {
    document.getElementById("closeEditModalBtn")?.addEventListener("click", closeEditModal);
    document.getElementById("cancelEditBtn")?.addEventListener("click", closeEditModal);
    document.getElementById("saveEditBtn")?.addEventListener("click", saveFieldEdit);

    document.querySelector("#editModal .edit-modal-overlay")?.addEventListener("click", closeEditModal);
}

async function openEditModal(field) {
    const display = document.querySelector(`.editable-value[data-field="${field}"]`);

    if (!display) {
        return;
    }

    const modal = document.getElementById("editModal");
    const title = document.getElementById("editModalTitle");
    const body = document.getElementById("editModalBody");
    const saveBtn = document.getElementById("saveEditBtn");

    if (!modal || !title || !body || !saveBtn) {
        return;
    }

    activeEdit = {
        field,
        display,
        currentValue: normalizeEmptyValue(display.dataset.value || display.textContent.trim())
    };

    title.textContent = getFieldTitle(field);
    body.innerHTML = "";

    saveBtn.disabled = false;
    saveBtn.textContent = "Сохранить";

    if (isSelectField(field)) {
        body.innerHTML = `
            <div class="edit-field-group">
                <label>${escapeHtml(getFieldTitle(field))}</label>

                <input type="hidden"
                       id="fieldEditor"
                       value="" />

                <div class="custom-select"
                     id="customSelectBox">
                    <button type="button"
                            class="custom-select-trigger"
                            id="customSelectTrigger">
                        <span id="customSelectValue">Загрузка...</span>
                        <span class="custom-select-arrow" aria-hidden="true"></span>
                    </button>

                    <div class="custom-select-panel"
                         id="customSelectPanel">
                        <div class="custom-select-empty">
                            Загрузка...
                        </div>
                    </div>
                </div>
            </div>
        `;

        openModal(modal);

        const data = await loadFieldData(field);
        renderCustomSelect(data, activeEdit.currentValue, field);

        setTimeout(() => document.getElementById("customSelectTrigger")?.focus(), 80);
        return;
    }

    if (field === "description") {
        body.innerHTML = `
            <div class="edit-field-group">
                <label for="fieldEditor">Описание</label>

                <textarea id="fieldEditor"
                          class="field-editor-control"
                          rows="6"
                          maxlength="2000"
                          placeholder="Введите описание">${escapeHtml(activeEdit.currentValue)}</textarea>
            </div>
        `;

        openModal(modal);

        setTimeout(() => document.getElementById("fieldEditor")?.focus(), 80);
        return;
    }

    body.innerHTML = `
        <div class="edit-field-group">
            <label for="fieldEditor">${escapeHtml(getFieldTitle(field))}</label>

            <input id="fieldEditor"
                   class="field-editor-control"
                   type="text"
                   maxlength="150"
                   value="${escapeHtml(activeEdit.currentValue)}"
                   placeholder="Введите значение" />
        </div>
    `;

    openModal(modal);

    setTimeout(() => {
        const input = document.getElementById("fieldEditor");
        input?.focus();
        input?.select();
    }, 80);
}

function openModal(modal) {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeEditModal() {
    const modal = document.getElementById("editModal");
    const body = document.getElementById("editModalBody");

    if (!modal) {
        return;
    }

    modal.classList.add("hidden");
    document.body.style.overflow = "";

    if (body) {
        body.innerHTML = "";
    }

    activeEdit = null;
}

async function saveFieldEdit() {
    if (!activeEdit) {
        return;
    }

    const saveBtn = document.getElementById("saveEditBtn");
    const field = activeEdit.field;
    const editor = document.getElementById("fieldEditor");

    if (!editor) {
        return;
    }

    let value = editor.value ?? "";

    if (!isSelectField(field)) {
        value = value.trim();
    }

    if (field === "title" && !value) {
        showToast("Заголовок не может быть пустым");
        return;
    }

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = "Сохранение...";
        }

        const result = await sendFieldUpdate(field, value);

        if (!result.success) {
            showToast(result.error || "Не удалось сохранить изменения");

            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = "Сохранить";
            }

            return;
        }

        updateFieldDisplay(field, result);
        closeEditModal();
        showToast("Изменения сохранены");
    } catch (error) {
        console.error(error);
        showToast("Ошибка соединения при сохранении");

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Сохранить";
        }
    }
}

async function sendFieldUpdate(field, value) {
    const requestId = getRequestId();
    const token = getAntiForgeryToken();

    if (!requestId) {
        return {
            success: false,
            error: "Не найден идентификатор заявки"
        };
    }

    if (!token) {
        return {
            success: false,
            error: "Не найден токен безопасности. Обновите страницу."
        };
    }

    const params = new URLSearchParams();
    params.append("field", field);
    params.append("value", value);

    const response = await fetch(`/Requests/Details/${requestId}?handler=UpdateField&${params.toString()}`, {
        method: "POST",
        headers: {
            "RequestVerificationToken": token
        }
    });

    if (!response.ok) {
        throw new Error("Ошибка сохранения");
    }

    return await response.json();
}

function updateFieldDisplay(field, result) {
    const display = document.querySelector(`.editable-value[data-field="${field}"]`);
    const displayText = result.display ?? "-";
    const rawValue = result.value ?? "";

    if (display) {
        display.dataset.value = String(rawValue || "");

        if (field === "description") {
            if (!displayText || displayText === "-") {
                display.innerHTML = `<span class="empty-text">Описание пока не добавлено</span>`;
            } else {
                display.textContent = displayText;
            }
        } else {
            display.textContent = displayText || "-";
        }

        if (field === "status") {
            const cssClass = result.statusClass || statusClass(displayText);
            display.className = `status-badge status-${cssClass} editable-value`;
        }

        if (field === "priority") {
            const cssClass = result.priorityClass || statusClass(displayText);
            display.className = `priority-badge priority-${cssClass} editable-value`;
        }
    }

    if (field === "organization") {
        setHiddenValue("organizationId", result.organizationId || rawValue);
        setHiddenValue("branchId", "");
        setHiddenValue("clientId", "");

        setFieldByName("branch", "-", "");
        setFieldByName("client", "-", "");

        if (result.productId === null || result.productId === "") {
            setHiddenValue("productId", "");
            setFieldByName("product", "-", "");
        }
    }

    if (field === "branch") {
        setHiddenValue("branchId", result.branchId || rawValue);
        setHiddenValue("clientId", "");

        setFieldByName("client", "-", "");
    }

    if (field === "product") {
        setHiddenValue("productId", result.productId || rawValue);

        const productDisplay = document.querySelector(`.editable-value[data-field="product"]`);

        if (productDisplay) {
            productDisplay.dataset.value = result.productId || rawValue;
        }
    }

    if (field === "client") {
        setHiddenValue("clientId", result.clientId || rawValue);

        const clientDisplay = document.querySelector(`.editable-value[data-field="client"]`);

        if (clientDisplay) {
            clientDisplay.dataset.value = result.clientId || rawValue;
        }
    }

    if (field === "topic") {
        const topicDisplay = document.querySelector(`.editable-value[data-field="topic"]`);

        if (topicDisplay) {
            topicDisplay.dataset.value = rawValue;
            topicDisplay.textContent = displayText || "-";
        }
    }

    if (field === "status") {
        const topBadge = document.getElementById("topStatusBadge");
        const cssClass = result.statusClass || statusClass(displayText);

        if (topBadge) {
            topBadge.className = `status-badge status-${cssClass}`;
            topBadge.textContent = displayText || "-";
        }

        if (result.historyItem) {
            prependStatusHistoryItem(result.historyItem);
        }
    }
}

function setFieldByName(field, text, value) {
    const element = document.querySelector(`.editable-value[data-field="${field}"]`);

    if (!element) {
        return;
    }

    element.textContent = text || "-";
    element.dataset.value = value || "";
}

/* =========================
   CUSTOM SELECT
========================= */

function renderCustomSelect(data, currentValue, field) {
    const editor = document.getElementById("fieldEditor");
    const box = document.getElementById("customSelectBox");
    const trigger = document.getElementById("customSelectTrigger");
    const valueText = document.getElementById("customSelectValue");
    const panel = document.getElementById("customSelectPanel");

    if (!editor || !box || !trigger || !valueText || !panel) {
        return;
    }

    const items = Array.isArray(data) ? data : [];
    const allowEmpty = field === "branch" || field === "client";

    const options = [];

    if (allowEmpty) {
        options.push({
            id: "",
            name: "Не выбрано"
        });
    }

    items.forEach(item => {
        options.push({
            id: String(item?.id ?? item?.value ?? ""),
            name: item?.name ?? item?.text ?? item?.fullName ?? String(item ?? "")
        });
    });

    panel.innerHTML = "";

    if (options.length === 0) {
        editor.value = "";
        valueText.textContent = "Нет доступных значений";
        trigger.disabled = true;
        box.classList.add("custom-select-disabled");

        panel.innerHTML = `
            <div class="custom-select-empty">
                Нет доступных значений
            </div>
        `;

        return;
    }

    trigger.disabled = false;
    box.classList.remove("custom-select-disabled");

    let selected = options.find(option =>
        String(option.id) === String(currentValue) ||
        String(option.name).trim() === String(currentValue).trim()
    );

    if (!selected) {
        selected = options[0];
    }

    setCustomSelectValue(selected.id, selected.name);

    options.forEach(option => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "custom-select-option";
        button.dataset.value = option.id;
        button.textContent = option.name || "Без названия";

        if (String(option.id) === String(selected.id)) {
            button.classList.add("selected");
        }

        button.addEventListener("click", () => {
            setCustomSelectValue(option.id, option.name);
            markSelectedCustomOption(option.id);
            closeCustomSelect();
        });

        panel.appendChild(button);
    });

    trigger.onclick = event => {
        event.preventDefault();
        event.stopPropagation();

        box.classList.toggle("open");
    };
}

function setCustomSelectValue(value, text) {
    const editor = document.getElementById("fieldEditor");
    const valueText = document.getElementById("customSelectValue");

    if (editor) {
        editor.value = value ?? "";
    }

    if (valueText) {
        valueText.textContent = text || "Не выбрано";
    }
}

function markSelectedCustomOption(value) {
    document.querySelectorAll(".custom-select-option").forEach(option => {
        option.classList.toggle(
            "selected",
            String(option.dataset.value ?? "") === String(value ?? "")
        );
    });
}

function closeCustomSelect() {
    document.getElementById("customSelectBox")?.classList.remove("open");
}

function initCustomSelectClose() {
    document.addEventListener("click", event => {
        const box = document.getElementById("customSelectBox");

        if (!box) {
            return;
        }

        if (!box.contains(event.target)) {
            closeCustomSelect();
        }
    });
}

/* =========================
   FIELD DATA
========================= */

async function loadFieldData(field) {
    const requestId = getRequestId();

    if (!requestId) {
        return [];
    }

    const params = new URLSearchParams();
    params.append("field", field);

    if (field === "branch" || field === "product" || field === "client") {
        const organizationId = document.getElementById("organizationId")?.value || "";

        if (organizationId) {
            params.append("orgId", organizationId);
        }
    }

    if (field === "client") {
        const branchId = document.getElementById("branchId")?.value || "";

        if (branchId) {
            params.append("branchId", branchId);
        }
    }

    try {
        const response = await fetch(`/Requests/Details/${requestId}?handler=FieldData&${params.toString()}`);

        if (!response.ok) {
            throw new Error("Ошибка загрузки данных");
        }

        const result = await response.json();

        if (!result.success) {
            showToast(result.error || "Не удалось загрузить данные");
            return [];
        }

        return result.data || [];
    } catch (error) {
        console.error(error);
        showToast("Ошибка соединения при загрузке данных");
        return [];
    }
}

/* =========================
   COMMENT FILES
========================= */

function initCommentFiles() {
    const input = document.getElementById("commentFiles");
    const names = document.getElementById("commentFileNames");

    if (!input || !names) {
        return;
    }

    input.addEventListener("change", () => {
        names.innerHTML = "";

        if (!input.files || input.files.length === 0) {
            names.textContent = "";
            return;
        }

        [...input.files].forEach(file => {
            const item = document.createElement("span");
            item.className = "selected-file";
            item.textContent = file.name;
            names.appendChild(item);
        });
    });
}

function initCommentFormAjax() {
    const form = document.getElementById("commentForm");

    if (!form) {
        return;
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const textarea = document.getElementById("commentTextarea");
        const fileInput = document.getElementById("commentFiles");
        const fileNames = document.getElementById("commentFileNames");
        const submitButton = form.querySelector(`button[type="submit"]`);

        const text = textarea?.value.trim() || "";
        const filesCount = fileInput?.files?.length || 0;

        if (!text && filesCount === 0) {
            showToast("Введите комментарий или прикрепите файл", "warning");
            textarea?.focus();
            return;
        }

        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Отправка...";
            }

            const result = await sendCommentCreate(form);

            if (!result.success) {
                showToast(result.error || "Не удалось добавить комментарий", "error");
                return;
            }

            appendCommentToList(result.comment);

            if (textarea) {
                textarea.value = "";
            }

            if (fileInput) {
                fileInput.value = "";
            }

            if (fileNames) {
                fileNames.innerHTML = "";
            }

            const internalCheckbox = form.querySelector(`input[name="IsInternal"][type="checkbox"]`);

            if (internalCheckbox) {
                internalCheckbox.checked = false;
            }

            showToast(result.message || "Комментарий добавлен", "success");
        } catch (error) {
            console.error(error);
            showToast("Ошибка соединения при добавлении комментария", "error");
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Отправить";
            }
        }
    });
}

async function sendCommentCreate(form) {
    const requestId = getRequestId();
    const token = getAntiForgeryToken();

    if (!requestId || !token) {
        return {
            success: false,
            error: "Не найден токен безопасности. Обновите страницу."
        };
    }

    const formData = new FormData(form);

    const response = await fetch(`/Requests/Details/${requestId}?handler=AddComment`, {
        method: "POST",
        headers: {
            "RequestVerificationToken": token,
            "X-Requested-With": "XMLHttpRequest"
        },
        body: formData
    });

    if (!response.ok) {
        throw new Error("Ошибка добавления комментария");
    }

    return await response.json();
}

function appendCommentToList(comment) {
    if (!comment) {
        return;
    }

    const commentsList = document.querySelector(".comments-list");

    if (!commentsList) {
        return;
    }

    const emptyState = commentsList.querySelector(".empty-state");

    if (emptyState) {
        emptyState.remove();
    }

    const article = document.createElement("article");
    article.className = `comment-card ${comment.isInternal ? "comment-internal" : ""}`;
    article.dataset.commentId = comment.id;

    const authorName = comment.authorName || "Пользователь";
    const initials = authorName.trim().charAt(0).toUpperCase() || "?";
    const content = comment.content || "";
    const createdAt = comment.createdAt || "";
    const attachments = Array.isArray(comment.attachments) ? comment.attachments : [];

    article.innerHTML = `
        <div class="comment-avatar">
            ${escapeHtml(initials)}
        </div>

        <div class="comment-body">
            <div class="comment-header">
                <div>
                    <div class="comment-author">
                        ${escapeHtml(authorName)}
                    </div>

                    <div class="comment-date">
                        ${escapeHtml(createdAt)}
                    </div>
                </div>

                <div class="comment-header-actions">
                    ${comment.isInternal
            ? `<span class="internal-badge">Внутренний</span>`
            : ""
        }

                    ${canEditAddedComment(comment)
            ? `
                                <button type="button"
                                        class="comment-action edit-comment-btn"
                                        data-comment-id="${escapeHtml(comment.id)}"
                                        title="Редактировать комментарий">
                                    ✎
                                </button>
                            `
            : ""
        }

                    ${canDeleteAddedComment(comment)
            ? `
                                <button type="button"
                                        class="comment-action delete-comment-btn"
                                        data-comment-id="${escapeHtml(comment.id)}"
                                        title="Удалить комментарий">
                                    ×
                                </button>
                            `
            : ""
        }
                </div>
            </div>

            ${content
            ? `
                        <div class="comment-text"
                             data-comment-content="${escapeHtml(comment.id)}">
                            ${escapeHtml(content)}
                        </div>
                    `
            : `
                        <div class="comment-text empty-text"
                             data-comment-content="${escapeHtml(comment.id)}">
                            Без текста
                        </div>
                    `
        }

            ${attachments.length > 0
            ? `
                        <div class="comment-files">
                            ${attachments.map(file => `
                                <a href="${escapeHtml(file.filePath)}"
                                   target="_blank"
                                   class="file-link">
                                    ${escapeHtml(file.fileName || "Файл")}
                                </a>
                            `).join("")}
                        </div>
                    `
            : ""
        }
        </div>
    `;

    commentsList.prepend(article);
    bindCommentCardActions(article);
}

function bindCommentCardActions(card) {
    card.querySelector(".edit-comment-btn")?.addEventListener("click", event => {
        event.preventDefault();
        openCommentEditModal(event.currentTarget.dataset.commentId);
    });

    card.querySelector(".delete-comment-btn")?.addEventListener("click", event => {
        event.preventDefault();
        deleteComment(event.currentTarget.dataset.commentId);
    });
}

function canEditAddedComment(comment) {
    if (!comment) {
        return false;
    }

    if (comment.isInternal) {
        return getPageFlag("canViewInternalComments") && getPageFlag("canEditInternalComments");
    }

    return getPageFlag("canEditComments");
}

function canDeleteAddedComment(comment) {
    if (!comment) {
        return false;
    }

    if (comment.isInternal) {
        return getPageFlag("canViewInternalComments") && getPageFlag("canDeleteInternalComments");
    }

    return getPageFlag("canDeleteComments");
}
/* =========================
   COMMENT EDITING
========================= */

function initCommentEditing() {
    document.querySelectorAll(".edit-comment-btn").forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            openCommentEditModal(button.dataset.commentId);
        });
    });

    document.querySelectorAll(".delete-comment-btn").forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            deleteComment(button.dataset.commentId);
        });
    });

    document.getElementById("closeCommentEditModalBtn")?.addEventListener("click", closeCommentEditModal);
    document.getElementById("cancelCommentEditBtn")?.addEventListener("click", closeCommentEditModal);
    document.getElementById("saveCommentEditBtn")?.addEventListener("click", saveCommentEdit);

    document.querySelector("#commentEditModal .edit-modal-overlay")?.addEventListener("click", closeCommentEditModal);
}

function openCommentEditModal(commentId) {
    if (!commentId) {
        return;
    }

    const modal = document.getElementById("commentEditModal");
    const hiddenId = document.getElementById("editCommentId");
    const textArea = document.getElementById("editCommentText");
    const internalInput = document.getElementById("editCommentInternal");

    const card = document.querySelector(`.comment-card[data-comment-id="${commentId}"]`);
    const text = document.querySelector(`[data-comment-content="${commentId}"]`)?.textContent?.trim() || "";

    if (!modal || !hiddenId || !textArea || !internalInput || !card) {
        return;
    }

    hiddenId.value = commentId;
    textArea.value = text === "Без текста" ? "" : text;

    if (internalInput.type === "checkbox") {
        internalInput.checked = card.classList.contains("comment-internal");
    } else {
        internalInput.value = card.classList.contains("comment-internal") ? "true" : "false";
    }

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    setTimeout(() => textArea.focus(), 80);
}

function closeCommentEditModal() {
    const modal = document.getElementById("commentEditModal");

    if (!modal) {
        return;
    }

    modal.classList.add("hidden");
    document.body.style.overflow = "";

    const hiddenId = document.getElementById("editCommentId");
    const textArea = document.getElementById("editCommentText");
    const internalInput = document.getElementById("editCommentInternal");

    if (hiddenId) {
        hiddenId.value = "";
    }

    if (textArea) {
        textArea.value = "";
    }

    if (internalInput) {
        if (internalInput.type === "checkbox") {
            internalInput.checked = false;
        } else {
            internalInput.value = "false";
        }
    }
}

async function saveCommentEdit() {
    const commentId = document.getElementById("editCommentId")?.value || "";
    const content = document.getElementById("editCommentText")?.value.trim() || "";
    const saveBtn = document.getElementById("saveCommentEditBtn");

    if (!commentId) {
        return;
    }

    if (!content) {
        showToast("Комментарий не может быть пустым");
        return;
    }

    const internalInput = document.getElementById("editCommentInternal");
    const isInternal = getBooleanInputValue(internalInput);

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = "Сохранение...";
        }

        const result = await sendCommentUpdate(commentId, content, isInternal);

        if (!result.success) {
            showToast(result.error || "Не удалось сохранить комментарий");
            return;
        }

        const textNode = document.querySelector(`[data-comment-content="${commentId}"]`);
        const card = document.querySelector(`.comment-card[data-comment-id="${commentId}"]`);

        if (textNode) {
            textNode.textContent = result.content || content;
            textNode.classList.remove("empty-text");
        }

        if (card) {
            card.classList.toggle("comment-internal", Boolean(result.isInternal));
            updateInternalBadge(card, Boolean(result.isInternal));
        }

        closeCommentEditModal();
        showToast("Комментарий обновлён");
    } catch (error) {
        console.error(error);
        showToast("Ошибка соединения");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Сохранить";
        }
    }
}

async function sendCommentUpdate(commentId, content, isInternal) {
    const requestId = getRequestId();
    const token = getAntiForgeryToken();

    if (!requestId || !token) {
        return {
            success: false,
            error: "Не найден токен безопасности. Обновите страницу."
        };
    }

    const params = new URLSearchParams();
    params.append("commentId", commentId);
    params.append("content", content);
    params.append("isInternal", String(isInternal));

    const response = await fetch(`/Requests/Details/${requestId}?handler=UpdateComment`, {
        method: "POST",
        headers: {
            "RequestVerificationToken": token,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
    });

    if (!response.ok) {
        throw new Error("Ошибка сохранения комментария");
    }

    return await response.json();
}

async function deleteComment(commentId) {
    if (!commentId) {
        return;
    }

    const confirmed = confirm("Удалить комментарий?");

    if (!confirmed) {
        return;
    }

    try {
        const result = await sendCommentDelete(commentId);

        if (!result.success) {
            showToast(result.error || "Не удалось удалить комментарий");
            return;
        }

        document.querySelector(`.comment-card[data-comment-id="${commentId}"]`)?.remove();
        showToast("Комментарий удалён");

        const commentsList = document.querySelector(".comments-list");

        if (commentsList && !commentsList.querySelector(".comment-card")) {
            commentsList.innerHTML = `<div class="empty-state">Комментариев пока нет</div>`;
        }
    } catch (error) {
        console.error(error);
        showToast("Ошибка соединения");
    }
}

async function sendCommentDelete(commentId) {
    const requestId = getRequestId();
    const token = getAntiForgeryToken();

    if (!requestId || !token) {
        return {
            success: false,
            error: "Не найден токен безопасности. Обновите страницу."
        };
    }

    const params = new URLSearchParams();
    params.append("commentId", commentId);

    const response = await fetch(`/Requests/Details/${requestId}?handler=DeleteComment`, {
        method: "POST",
        headers: {
            "RequestVerificationToken": token,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
    });

    if (!response.ok) {
        throw new Error("Ошибка удаления комментария");
    }

    return await response.json();
}

function updateInternalBadge(card, isInternal) {
    const actions = card.querySelector(".comment-header-actions");

    if (!actions) {
        return;
    }

    let badge = actions.querySelector(".internal-badge");

    if (isInternal && !badge) {
        badge = document.createElement("span");
        badge.className = "internal-badge";
        badge.textContent = "Внутренний";
        actions.prepend(badge);
    }

    if (!isInternal && badge) {
        badge.remove();
    }
}

/* =========================
   STATUS HISTORY
========================= */

function prependStatusHistoryItem(historyItem) {
    if (!historyItem) {
        return;
    }

    const historyList = document.getElementById("statusHistoryList")
        || document.querySelector(".history-list");

    if (!historyList) {
        return;
    }

    const emptyState = historyList.querySelector(".empty-state");

    if (emptyState) {
        emptyState.remove();
    }

    const status = historyItem.status || "-";
    const cssClass = historyItem.statusClass || statusClass(status);
    const changedAt = historyItem.changedAt || "";
    const changedBy = historyItem.changedBy || "";

    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `
        <div class="history-dot status-dot-${escapeHtml(cssClass)}"></div>

        <div class="history-content">
            <div class="history-status">
                ${escapeHtml(status)}
            </div>

            <div class="history-date">
                ${escapeHtml(changedAt)}
            </div>

            ${changedBy
            ? `<div class="history-date">Изменил: ${escapeHtml(changedBy)}</div>`
            : ""
        }
        </div>
    `;

    historyList.prepend(item);
}

/* =========================
   REQUEST DELETE
========================= */

function initRequestDelete() {
    const button = document.getElementById("deleteRequestBtn");

    if (!button || !getPageFlag("canDelete")) {
        return;
    }

    button.addEventListener("click", async () => {
        const confirmed = confirm("Удалить заявку? Это действие нельзя отменить.");

        if (!confirmed) {
            return;
        }

        try {
            button.disabled = true;
            button.textContent = "Удаление...";

            const result = await sendRequestDelete();

            if (!result.success) {
                showToast(result.error || "Не удалось удалить заявку");
                button.disabled = false;
                button.textContent = "Удалить";
                return;
            }

            showToast("Заявка удалена");

            setTimeout(() => {
                window.location.href = result.redirectUrl || "/Requests/Requests";
            }, 500);
        } catch (error) {
            console.error(error);
            showToast("Ошибка соединения");
            button.disabled = false;
            button.textContent = "Удалить";
        }
    });
}

async function sendRequestDelete() {
    const requestId = getRequestId();
    const token = getAntiForgeryToken();

    if (!requestId || !token) {
        return {
            success: false,
            error: "Не найден токен безопасности. Обновите страницу."
        };
    }

    const response = await fetch(`/Requests/Details/${requestId}?handler=DeleteRequest`, {
        method: "POST",
        headers: {
            "RequestVerificationToken": token
        }
    });

    if (!response.ok) {
        throw new Error("Ошибка удаления заявки");
    }

    return await response.json();
}

/* =========================
   KEYBOARD
========================= */

function initKeyboardHandlers() {
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            if (document.getElementById("customSelectBox")?.classList.contains("open")) {
                closeCustomSelect();
                return;
            }

            if (!document.getElementById("editModal")?.classList.contains("hidden")) {
                closeEditModal();
                return;
            }

            if (!document.getElementById("commentEditModal")?.classList.contains("hidden")) {
                closeCommentEditModal();
                return;
            }
        }

        if (event.key === "Enter" && event.ctrlKey) {
            if (!document.getElementById("commentEditModal")?.classList.contains("hidden")) {
                saveCommentEdit();
                return;
            }

            if (!document.getElementById("editModal")?.classList.contains("hidden")) {
                saveFieldEdit();
            }
        }
    });
}

/* =========================
   HELPERS
========================= */
function getRequestId() {
    const hiddenInput = document.getElementById("requestId");

    if (hiddenInput?.value) {
        return hiddenInput.value;
    }

    const page = document.querySelector(".request-details-page");

    return page?.dataset?.requestId || "";
}
function getCurrentUserId() {
    const page = document.querySelector(".request-details-page");
    const value = page?.dataset?.currentUserId;

    if (value) {
        return value;
    }

    return "";
}
function initPageAlertsAsToasts() {
    document.querySelectorAll(".page-alert").forEach(alert => {
        const message = alert.textContent.trim();

        if (!message) {
            alert.remove();
            return;
        }

        const type = alert.classList.contains("page-alert-error")
            ? "error"
            : "success";

        showToast(message, type);
        alert.remove();
    });
}
function getAntiForgeryToken() {
    return document.querySelector("#antiForgeryForm input[name='__RequestVerificationToken']")?.value || "";
}

function getPageFlag(name) {
    const page = document.querySelector(".request-details-page");
    const value = page?.dataset?.[name];

    return value === "true";
}

function setHiddenValue(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.value = value || "";
    }
}

function getBooleanInputValue(input) {
    if (!input) {
        return false;
    }

    if (input.type === "checkbox") {
        return Boolean(input.checked);
    }

    return String(input.value || "").toLowerCase() === "true";
}

function normalizeEmptyValue(value) {
    if (!value) {
        return "";
    }

    if (value === "-") {
        return "";
    }

    if (value === "—") {
        return "";
    }

    if (value === "Описание пока не добавлено") {
        return "";
    }

    if (value === "Без текста") {
        return "";
    }

    return value;
}

function isSelectField(field) {
    return [
        "topic",
        "product",
        "organization",
        "branch",
        "priority",
        "status",
        "client"
    ].includes(field);
}

function getFieldTitle(field) {
    const names = {
        title: "Заголовок",
        description: "Описание",
        topic: "Тема",
        product: "Продукт",
        organization: "Организация",
        branch: "Филиал",
        client: "Клиент",
        status: "Статус",
        priority: "Приоритет"
    };

    return names[field] || "Поле";
}

function statusClass(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showToast(message, type = "success") {
    if (window.showAppToast) {
        window.showAppToast(message, type);
        return;
    }

    alert(message);
}