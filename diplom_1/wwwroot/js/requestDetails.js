document.addEventListener("DOMContentLoaded", function () {
    const modal = document.getElementById("commentModal");
    const openBtn = document.getElementById("openCommentModal");
    const closeBtn = document.getElementById("closeCommentModal");
    const cancelBtn = document.getElementById("cancelComment");

    if (!modal || !openBtn) {
        console.error("❌ Modal or open button not found");
        return;
    }

    function openModal() {
        modal.classList.remove("hidden");
    }

    function closeModal() {
        modal.classList.add("hidden");
    }

    openBtn.addEventListener("click", openModal);
    closeBtn?.addEventListener("click", closeModal);
    cancelBtn?.addEventListener("click", closeModal);

    window.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });
});

//  Инлайн-редактирование темы и статуса 
document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("edit-btn")) return;

    const field = e.target.dataset.field;
    let newValue;

    if (field === "topic") {
        newValue = prompt("Введите новую тему:");
        if (!newValue) return;
    }

    if (field === "status") {
        const options = ["Создана", "В работе", "Завершена", "Отменена"];
        newValue = prompt(`Введите новый статус:\n${options.join(", ")}`);
        if (!newValue) return;
        if (!options.includes(newValue)) {
            alert("Недопустимое значение статуса!");
            return;
        }
    }

    const requestId = window.location.pathname.split("/").pop();
    const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value;

    const res = await fetch(`/Requests/Details?id=${requestId}&handler=UpdateField`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "RequestVerificationToken": token
        },
        body: JSON.stringify({ field, value: newValue })
    });

    if (res.ok) {
        if (field === "topic") document.getElementById("topicDisplay").textContent = newValue;
        if (field === "status") document.getElementById("statusDisplay").textContent = newValue;
    } else {
        alert("Ошибка при обновлении поля.");
    }
});
