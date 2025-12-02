document.addEventListener("DOMContentLoaded", () => {
    const photoInput = document.getElementById("photoInput");
    const changePhotoBtn = document.getElementById("changePhotoBtn");
    const profilePhoto = document.getElementById("profilePhoto");

    changePhotoBtn.addEventListener("click", () => photoInput.click());

    photoInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            profilePhoto.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

    const saveBtn = document.getElementById("saveProfileBtn");
    saveBtn.addEventListener("click", async () => {
        const fullName = document.getElementById("profileFullName").value.trim();
        const email = document.getElementById("profileEmail").value.trim();

        const res = await fetch("/Dashboard/UpdateProfile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName, email })
        });

        if (res.ok) alert("Профиль успешно обновлён!");
        else alert("Ошибка при сохранении профиля");
    });
});
