document.addEventListener("DOMContentLoaded", function () {
    console.log('Details page loaded');
    initFieldEditing(); // ТОЛЬКО редактирование полей заявки
});

/* ================= РЕДАКТИРОВАНИЕ ПОЛЕЙ ЗАЯВКИ ================= */
function initFieldEditing() {
    const canEdit = document.getElementById('canEdit')?.value === 'true';
    if (!canEdit) {
        console.log('Editing disabled');
        return;
    }

    document.addEventListener("click", async function (e) {
        const editBtn = e.target.closest('.edit-btn');
        if (!editBtn) return;

        const field = editBtn.dataset.field;
        const displayElement = document.getElementById(`${field}Display`);

        if (!displayElement) {
            console.error('Display element not found:', field);
            return;
        }

        // Получаем текущее значение
        let currentValue = displayElement.textContent.trim();
        if (currentValue === '-' || currentValue === '—') {
            currentValue = '';
        }

        // Загружаем данные для выпадающего списка
        let fieldData = null;
        let isSelectField = false;

        if (['product', 'organization', 'branch', 'client', 'priority', 'status'].includes(field)) {
            fieldData = await loadFieldData(field);
            isSelectField = fieldData && fieldData.length > 0;
        }

        // Скрываем текущий текст
        displayElement.style.display = 'none';

        // Создаем поле для редактирования
        let inputElement;
        const parent = displayElement.parentElement;

        if (isSelectField && fieldData) {
            // Выпадающий список
            inputElement = document.createElement('select');
            inputElement.className = 'field-edit';

            // Добавляем пустую опцию
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = 'Выберите...';
            inputElement.appendChild(emptyOption);

            // Добавляем опции
            fieldData.forEach(item => {
                const option = document.createElement('option');

                if (typeof item === 'object') {
                    // Объект с id и name
                    option.value = item.id;
                    option.textContent = item.name;
                } else {
                    // Простая строка
                    option.value = item;
                    option.textContent = item;
                }

                // Выбираем текущее значение
                if (option.value == currentValue || option.textContent === currentValue) {
                    option.selected = true;
                }

                inputElement.appendChild(option);
            });
        } else if (field === 'description') {
            // Текстовое поле для описания
            inputElement = document.createElement('textarea');
            inputElement.className = 'field-edit';
            inputElement.value = currentValue;
            inputElement.rows = 4;
        } else {
            // Простое текстовое поле
            inputElement = document.createElement('input');
            inputElement.type = 'text';
            inputElement.className = 'field-edit';
            inputElement.value = currentValue;
        }

        // Создаем кнопки (серые, без ярких цветов)
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'edit-buttons';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'save-btn';
        saveBtn.innerHTML = '<img src="/icons/check.svg" width="14" height="14" alt="✓" /> Сохранить';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'cancel-btn';
        cancelBtn.innerHTML = '<img src="/icons/x.svg" width="14" height="14" alt="✕" /> Отмена';

        buttonsDiv.appendChild(saveBtn);
        buttonsDiv.appendChild(cancelBtn);

        // Добавляем элементы на страницу
        parent.appendChild(inputElement);
        parent.appendChild(buttonsDiv);

        // Фокус на поле ввода
        inputElement.focus();
        if (inputElement.select) inputElement.select();

        // Обработчики
        saveBtn.addEventListener('click', async () => {
            const value = inputElement.value;
            await saveField(field, value, displayElement, parent, inputElement, buttonsDiv);
        });

        cancelBtn.addEventListener('click', () => {
            cancelEdit(displayElement, parent, inputElement, buttonsDiv);
        });

        // Сохранение по Enter (для текстовых полей)
        if (inputElement.tagName === 'INPUT' || inputElement.tagName === 'TEXTAREA') {
            inputElement.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    await saveField(field, inputElement.value, displayElement, parent, inputElement, buttonsDiv);
                }
            });
        }

        // Отмена по Escape
        inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cancelEdit(displayElement, parent, inputElement, buttonsDiv);
            }
        });
    });
}

// Загрузка данных для выпадающих списков
async function loadFieldData(field) {
    try {
        const requestId = document.getElementById('requestId').value;
        let url = `/Requests/Details/${requestId}?handler=FieldData&field=${field}`;

        // Добавляем параметры фильтрации
        if (field === 'branch') {
            const orgId = document.getElementById('organizationId').value;
            if (orgId) {
                url += `&orgId=${orgId}`;
            }
        } else if (field === 'client') {
            const orgId = document.getElementById('organizationId').value;
            const branchId = document.getElementById('branchId').value;

            if (orgId) url += `&orgId=${orgId}`;
            if (branchId) url += `&branchId=${branchId}`;
        }

        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            return result.data;
        }
        return null;
    } catch (error) {
        console.error('Error loading field data:', error);
        return null;
    }
}

// Сохранение поля
async function saveField(field, value, displayElement, parent, inputElement, buttonsDiv) {
    try {
        const requestId = document.getElementById('requestId').value;
        const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value;

        console.log('Saving field:', field, 'value:', value);

        if (!token) {
            console.error('CSRF token not found');
            alert('Ошибка безопасности. Обновите страницу.');
            return;
        }

        const response = await fetch(`/Requests/Details/${requestId}?handler=UpdateField&field=${field}&value=${encodeURIComponent(value)}`, {
            method: 'POST',
            headers: {
                'RequestVerificationToken': token
            }
        });

        const result = await response.json();
        console.log('Save result:', result);

        if (result.success) {
            // Обновляем отображаемое значение
            displayElement.textContent = result.display || value || '-';
            displayElement.style.display = 'block';

            // Удаляем элементы редактирования
            parent.removeChild(inputElement);
            parent.removeChild(buttonsDiv);

            // Обновляем скрытые поля для зависимых полей
            if (field === 'organization') {
                document.getElementById('organizationId').value = value || '';
                // Сбрасываем филиал и клиента
                document.getElementById('branchId').value = '';
                document.getElementById('branchDisplay').textContent = '-';
                document.getElementById('clientDisplay').textContent = '-';
            } else if (field === 'branch') {
                document.getElementById('branchId').value = value || '';
                // Сбрасываем клиента
                document.getElementById('clientDisplay').textContent = '-';
            }

            alert('✅ Изменения сохранены');
        } else {
            alert(`❌ ${result.error || 'Ошибка сохранения'}`);
            cancelEdit(displayElement, parent, inputElement, buttonsDiv);
        }
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('❌ Ошибка соединения с сервером');
        cancelEdit(displayElement, parent, inputElement, buttonsDiv);
    }
}

function cancelEdit(displayElement, parent, inputElement, buttonsDiv) {
    displayElement.style.display = 'block';
    if (parent.contains(inputElement)) parent.removeChild(inputElement);
    if (parent.contains(buttonsDiv)) parent.removeChild(buttonsDiv);
}