document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    const toggle = document.getElementById("sidebarToggle");
    const arrow = toggle.querySelector(".arrow-icon");

    toggle.addEventListener("click", () => {
        const collapsed = sidebar.classList.toggle("collapsed");
        toggle.title = collapsed ? "Развернуть меню" : "Свернуть меню";
        arrow.style.transform = collapsed ? "rotate(180deg)" : "rotate(0deg)";
    });
});
