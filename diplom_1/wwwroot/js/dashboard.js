document.addEventListener("DOMContentLoaded", () => {
    const photoInput = document.getElementById("photoInput");
    const changePhotoBtn = document.getElementById("changePhotoBtn");
    const profilePhoto = document.getElementById("profilePhoto");
    const saveBtn = document.getElementById("saveProfileBtn");
    const profileFullNameInput = document.getElementById("profileFullName");
    const profileEmailInput = document.getElementById("profileEmail");
    const notification = document.getElementById("notification");

    function showNotification(message, isSuccess = true) {
        notification.textContent = message;
        notification.className = `notification ${isSuccess ? 'success' : 'error'}`;
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    function getToken() {
        const tokenInput = document.querySelector('#antiForgeryForm input[name="__RequestVerificationToken"]');
        return tokenInput ? tokenInput.value : "";
    }

    function updateSessionAndDisplay(data) {
        if (data.fullName) {
            profileFullNameInput.value = data.fullName;
            const userNameElement = document.querySelector('.user-name');
            if (userNameElement) {
                userNameElement.textContent = data.fullName;
            }
        }
        if (data.email) {
            profileEmailInput.value = data.email;
        }
        if (data.photoPath) {
            profilePhoto.src = data.photoPath + "?t=" + new Date().getTime();
            const avatarElement = document.querySelector('.avatar');
            if (avatarElement) {
                avatarElement.src = data.photoPath + "?t=" + new Date().getTime();
            }
        }
    }

    function validateFullName(name) {
        if (!name || name.trim().length < 2) {
            return "ФИО должно содержать минимум 2 символа";
        }
        if (name.trim().length > 100) {
            return "ФИО не должно превышать 100 символов";
        }
        const nameRegex = /^[а-яА-Яa-zA-Z\s\-]+$/;
        if (!nameRegex.test(name.trim())) {
            return "ФИО может содержать только буквы, пробелы и дефисы";
        }
        return null;
    }

    function validateEmail(email) {
        if (!email || email.trim().length === 0) {
            return "Email не может быть пустым";
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return "Введите корректный email";
        }
        return null;
    }

    function validatePhotoFile(file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp'];
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            return "Разрешены только изображения (JPG, PNG, GIF, BMP)";
        }
        if (file.size > 5 * 1024 * 1024) {
            return "Размер файла не должен превышать 5 МБ";
        }
        return null;
    }

    changePhotoBtn.addEventListener("click", () => photoInput.click());

    photoInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const validationError = validatePhotoFile(file);
        if (validationError) {
            showNotification(validationError, false);
            photoInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            profilePhoto.src = ev.target.result;
        };
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append("photo", file);

        try {
            const res = await fetch("/Dashboard/Dashboard?handler=UploadPhoto", {
                method: "POST",
                headers: { "RequestVerificationToken": getToken() },
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                showNotification("Фото загружено", true);
                if (data.path) {
                    const timestamp = new Date().getTime();
                    profilePhoto.src = data.path + "?t=" + timestamp;
                    const avatarElement = document.querySelector('.avatar');
                    if (avatarElement) {
                        avatarElement.src = data.path + "?t=" + timestamp;
                    }
                }
            } else {
                showNotification(data.message || "Ошибка загрузки фото", false);
            }
        } catch (error) {
            showNotification("Ошибка загрузки фото", false);
            console.error(error);
        }
    });

    saveBtn.addEventListener("click", async () => {
        const fullName = profileFullNameInput.value;
        const email = profileEmailInput.value;

        const nameError = validateFullName(fullName);
        if (nameError) {
            showNotification(nameError, false);
            profileFullNameInput.focus();
            return;
        }

        const emailError = validateEmail(email);
        if (emailError) {
            showNotification(emailError, false);
            profileEmailInput.focus();
            return;
        }

        const formData = new FormData();
        formData.append("FullName", fullName.trim());
        formData.append("Email", email.trim());

        try {
            const res = await fetch("/Dashboard/Dashboard?handler=UpdateProfile", {
                method: "POST",
                headers: { "RequestVerificationToken": getToken() },
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                showNotification("Профиль успешно обновлён", true);
                updateSessionAndDisplay({
                    fullName: data.fullName,
                    email: data.email,
                    photoPath: data.photoPath
                });
            } else {
                showNotification(data.message || "Ошибка сохранения профиля", false);
            }
        } catch (error) {
            showNotification("Ошибка при сохранении профиля", false);
            console.error(error);
        }
    });

    document.querySelectorAll('.org-header').forEach(header => {
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            const orgId = header.getAttribute('data-org');
            const branchesDiv = document.getElementById(`branches-org-${orgId}`);
            const toggleIcon = header.querySelector('.toggle-icon');

            if (branchesDiv) {
                if (branchesDiv.style.display === 'none') {
                    branchesDiv.style.display = 'block';
                    if (toggleIcon) toggleIcon.textContent = '▲';
                } else {
                    branchesDiv.style.display = 'none';
                    if (toggleIcon) toggleIcon.textContent = '▼';
                }
            }
        });
    });
});