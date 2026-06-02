document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    const toggle = document.getElementById("sidebarToggle");
    const arrow = toggle?.querySelector(".arrow-icon");

    if (sidebar && toggle && arrow) {
        toggle.addEventListener("click", () => {
            const collapsed = sidebar.classList.toggle("collapsed");
            toggle.title = collapsed ? "Развернуть меню" : "Свернуть меню";
            arrow.style.transform = collapsed ? "rotate(180deg)" : "rotate(0deg)";
        });
    }
});

window.showAppToast = function (message, type = "success") {
    document.querySelectorAll(".app-toast, .toast").forEach(item => item.remove());

    const normalizedType = ["success", "error", "warning", "info"].includes(type)
        ? type
        : "success";

    const toast = document.createElement("div");
    toast.className = `toast app-toast app-toast-${normalizedType}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("visible");
    });

    clearTimeout(window.__appToastTimer);

    window.__appToastTimer = setTimeout(() => {
        toast.classList.add("fade-out");
        toast.classList.remove("visible");

        setTimeout(() => {
            toast.remove();
        }, 250);
    }, 2600);
};