using diplom_1.Data;
using diplom_1.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace diplom_1.Pages.Requests
{
    public class RequestsModel : PageModel
    {
        private readonly AppDbContext _context;
        public RequestsModel(AppDbContext context) => _context = context;

        // ====================== ДАННЫЕ ДЛЯ UI ======================
        public List<RequestDto> Requests { get; set; } = new();
        public List<Organization> Organizations { get; set; } = new();
        public List<Branch> Branches { get; set; } = new();
        public List<Product> Products { get; set; } = new();
        public List<User> AvailableUsers { get; set; } = new();

        public List<Organization> FilterOrganizations => Organizations;
        public List<Branch> FilterBranches => Branches;

        public List<Organization> CreateOrganizations { get; set; } = new();
        public List<Branch> CreateBranches { get; set; } = new();

        public int CurrentUserId { get; set; }

        // ====================== КОНСТАНТЫ ======================
        public List<string> Statuses { get; set; } = new() { "Создана", "В работе", "Завершена", "Отменена" };
        public List<string> Priorities { get; set; } = new() { "Низкий", "Средний", "Высокий", "Критический" };

        // ====================== СТАТИСТИКА ======================
        public int TotalCount { get; set; }
        public int CreatedCount { get; set; }
        public int InWorkCount { get; set; }
        public int DoneCount { get; set; }
        public int CancelledCount { get; set; }

        // ====================== ПРАВА ======================
        public bool CanCreate { get; set; }
        public bool CanEdit { get; set; }
        public bool CanDelete { get; set; }
        public bool CanSeeClientColumn { get; set; }
        public bool CanSeeStatistics { get; set; }
        public bool CanSeeAnalytics { get; set; }
        public bool CanCreateForOthers { get; set; }

        // ====================== ДОСТУПЫ ПО ОРГ/ФИЛ ======================
        public List<int> ViewOrgIds { get; set; } = new();
        public List<int> ViewBranchIds { get; set; } = new();
        public List<int> CreateOrgIds { get; set; } = new();
        public List<int> CreateBranchIds { get; set; } = new();

        // =====================================================================
        // ==============================   GET   ===============================
        // =====================================================================
        public async Task OnGetAsync()
        {
            int userId = HttpContext.Session.GetInt32("UserId") ?? 0;
            CurrentUserId = userId;

            if (userId == 0)
            {
                Requests = new();
                return;
            }

            // ---- 1. Права ----
            var userPermissions = await _context.UserPermissions
                .Include(p => p.Permission)
                .Where(p => p.UserId == userId)
                .ToListAsync();

            var perms = userPermissions.Select(p => p.Permission).ToList();

            CanCreate = perms.Any(p => p.Module == "Задачи" && p.Action.Contains("Добавление"));
            CanEdit = perms.Any(p => p.Module == "Задачи" && p.Action.Contains("редактирование"));
            CanDelete = perms.Any(p => p.Module == "Задачи" && p.Action.Contains("Удаление"));
            CanSeeClientColumn = perms.Any(p => p.Action.Contains("Просмотр столбца"));
            CanSeeStatistics = perms.Any(p => p.Action.Contains("Статистика"));
            CanSeeAnalytics = perms.Any(p => p.Action.Contains("Аналитика"));
            CanCreateForOthers = perms.Any(p => p.Action.Contains("Создать от имени"));

            // ---- 2. Доступы ----
            ViewOrgIds = userPermissions
                .Where(up => up.Permission.Module == "Задачи" &&
                             up.Permission.Action.Contains("Просмотр") &&
                             up.OrganizationId != null)
                .Select(up => up.OrganizationId!.Value)
                .Distinct()
                .ToList();

            ViewBranchIds = userPermissions
                .Where(up => up.Permission.Module == "Задачи" &&
                             up.Permission.Action.Contains("Просмотр") &&
                             up.BranchId != null)
                .Select(up => up.BranchId!.Value)
                .Distinct()
                .ToList();

            CreateOrgIds = userPermissions
                .Where(up => up.Permission.Module == "Задачи" &&
                             up.Permission.Action.Contains("Добавление") &&
                             up.OrganizationId != null)
                .Select(up => up.OrganizationId!.Value)
                .Distinct()
                .ToList();

            CreateBranchIds = userPermissions
                .Where(up => up.Permission.Module == "Задачи" &&
                             up.Permission.Action.Contains("Добавление") &&
                             up.BranchId != null)
                .Select(up => up.BranchId!.Value)
                .Distinct()
                .ToList();

            // ---- 3. UI списки ----
            Organizations = await _context.Organizations
                .Where(o => ViewOrgIds.Contains(o.Id))
                .OrderBy(o => o.Name)
                .ToListAsync();

            Branches = await _context.Branches
                .Where(b => ViewBranchIds.Contains(b.Id))
                .OrderBy(b => b.Address)
                .ToListAsync();

            Products = await _context.Products
                .OrderBy(p => p.Name)
                .ToListAsync();

            // ---- 4. Для создания заявки ----
            CreateOrganizations = await _context.Organizations
                .Where(o => CreateOrgIds.Contains(o.Id))
                .OrderBy(o => o.Name)
                .ToListAsync();

            CreateBranches = await _context.Branches
                .Where(b => CreateBranchIds.Contains(b.Id))
                .OrderBy(b => b.Address)
                .ToListAsync();

            // ---- 5. Доступные пользователи для "создать от имени"
            if (CanCreateForOthers)
            {
                AvailableUsers = await _context.Users
                    .Include(u => u.UserOrganizations)
                    .Include(u => u.UserBranches)
                    .Where(u =>
                        u.Id == userId ||
                        u.UserOrganizations.Any(o => CreateOrgIds.Contains(o.OrganizationId)) ||
                        u.UserBranches.Any(b => CreateBranchIds.Contains(b.BranchId)))
                    .OrderBy(u => u.FullName)
                    .ToListAsync();
            }

            // ---- 6. Заявки ----
            var list = await _context.Requests
                .Include(r => r.Organization)
                .Include(r => r.Branch)
                .Include(r => r.Product)
                .Include(r => r.CreatedBy)
                .Where(r =>
                    r.CreatedById == userId ||
                    (r.OrganizationId != null && ViewOrgIds.Contains(r.OrganizationId.Value)) ||
                    (r.BranchId != null && ViewBranchIds.Contains(r.BranchId.Value)))
                .Distinct()
                .ToListAsync();

            // ---- 7. Статистика ----
            TotalCount = list.Count;
            CreatedCount = list.Count(r => r.Status == "Создана");
            InWorkCount = list.Count(r => r.Status == "В работе");
            DoneCount = list.Count(r => r.Status == "Завершена");
            CancelledCount = list.Count(r => r.Status == "Отменена");

            // ---- 8. DTO ----
            Requests = list
                .Select(r => new RequestDto
                {
                    Id = r.Id,
                    Title = r.Title ?? "(Без заголовка)",
                    Topic = r.Topic ?? "(Без темы)",
                    ProductName = r.Product?.Name ?? "-",
                    OrganizationName = r.Organization?.Name ?? "-",
                    BranchAddress = r.Branch?.Address ?? "-",
                    Priority = r.Priority,
                    Status = r.Status,
                    ClientName = r.CreatedBy?.FullName ?? "(неизвестно)",
                    CreatedAt = r.CreatedAt
                })
                .OrderByDescending(r => r.CreatedAt)
                .ToList();
        }

        // =====================================================================
        // ============================ CREATE ================================
        // =====================================================================
        public async Task<IActionResult> OnPostCreateAsync()
        {
            int userId = HttpContext.Session.GetInt32("UserId") ?? 0;

            if (userId == 0)
                return new JsonResult(new { error = "Не авторизован" }) { StatusCode = 401 };

            // ---- Повторная загрузка прав ----
            var userPermissions = await _context.UserPermissions
                .Include(p => p.Permission)
                .Where(p => p.UserId == userId)
                .ToListAsync();

            var perms = userPermissions.Select(p => p.Permission).ToList();

            CanCreate = perms.Any(p => p.Module == "Задачи" && p.Action.Contains("Добавление"));
            CanCreateForOthers = perms.Any(p => p.Action.Contains("Создать от имени"));

            CreateOrgIds = userPermissions
                .Where(up => up.Permission.Module == "Задачи" &&
                             up.Permission.Action.Contains("Добавление") &&
                             up.OrganizationId != null)
                .Select(up => up.OrganizationId!.Value)
                .Distinct()
                .ToList();

            CreateBranchIds = userPermissions
                .Where(up => up.Permission.Module == "Задачи" &&
                             up.Permission.Action.Contains("Добавление") &&
                             up.BranchId != null)
                .Select(up => up.BranchId!.Value)
                .Distinct()
                .ToList();

            if (CanCreateForOthers)
            {
                AvailableUsers = await _context.Users
                    .Include(u => u.UserOrganizations)
                    .Include(u => u.UserBranches)
                    .Where(u =>
                        u.Id == userId ||
                        u.UserOrganizations.Any(o => CreateOrgIds.Contains(o.OrganizationId)) ||
                        u.UserBranches.Any(b => CreateBranchIds.Contains(b.BranchId)))
                    .OrderBy(u => u.FullName)
                    .ToListAsync();
            }

            if (!CanCreate)
                return Forbid();

            // ---- Чтение данных формы ----
            string title = Request.Form["Title"];
            string topic = Request.Form["Topic"];
            int organizationId = int.Parse(Request.Form["OrganizationId"]);

            // Филиал может быть пустым
            int branchIdParsed = 0;
            int? branchId = null;
            if (int.TryParse(Request.Form["BranchId"], out branchIdParsed))
                branchId = branchIdParsed;

            int productId = int.Parse(Request.Form["ProductId"]);
            string priority = Request.Form["Priority"];
            int createdBy = int.Parse(Request.Form["CreatedById"]);
            string? description = Request.Form["Description"];

            // ---- Проверки ----
            if (!CanCreateForOthers && createdBy != userId)
                return Forbid();

            if (CanCreateForOthers &&
                !AvailableUsers.Any(u => u.Id == createdBy))
                return Forbid();

            if (!CreateOrgIds.Contains(organizationId))
                return Forbid();

            if (branchId != null && !CreateBranchIds.Contains(branchId.Value))
                return Forbid();

            // ---- Создание заявки ----
            var req = new Request
            {
                Title = title,
                Topic = topic,
                OrganizationId = organizationId,
                BranchId = branchId,
                ProductId = productId,
                Priority = priority,
                Status = "Создана",
                CreatedById = createdBy,
                Description = description,
                CreatedAt = DateTime.Now
            };

            _context.Requests.Add(req);
            await _context.SaveChangesAsync();

            int requestId = req.Id;

            // ---- Сохранение вложения ----
            var file = Request.Form.Files.FirstOrDefault();
            if (file != null && file.Length > 0)
            {
                string folder = Path.Combine("wwwroot", "uploads", "requests", requestId.ToString());
                if (!Directory.Exists(folder))
                    Directory.CreateDirectory(folder);

                string fileName = $"{Guid.NewGuid()}_{file.FileName}";
                string filePath = Path.Combine(folder, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                    await file.CopyToAsync(stream);

                var attachment = new Attachment
                {
                    FilePath = $"/uploads/requests/{requestId}/{fileName}",
                    RequestId = requestId,
                    UploadedAt = DateTime.UtcNow
                };

                _context.Attachments.Add(attachment);
                await _context.SaveChangesAsync();
            }

            return new JsonResult(new { success = true, id = req.Id });
        }

        // =====================================================================
        // ========================== BranchesByOrgs ===========================
        // =====================================================================
        public async Task<IActionResult> OnGetBranchesByOrgsAsync(string orgIds)
        {
            int userId = HttpContext.Session.GetInt32("UserId") ?? 0;

            // Загружаем права (важно!)
            var permissions = await _context.UserPermissions
                .Include(p => p.Permission)
                .Where(p => p.UserId == userId)
                .ToListAsync();

            CreateBranchIds = permissions
                .Where(p => p.Permission.Module == "Задачи" &&
                            p.Permission.Action.Contains("Добавление") &&
                            p.BranchId != null)
                .Select(p => p.BranchId!.Value)
                .Distinct()
                .ToList();

            if (string.IsNullOrWhiteSpace(orgIds))
                return new JsonResult(new List<object>());

            var ids = orgIds.Split(',')
                .Where(x => int.TryParse(x, out _))
                .Select(int.Parse)
                .ToList();

            var branches = await _context.Branches
                .Where(b =>
                    ids.Contains(b.OrganizationId) &&
                    CreateBranchIds.Contains(b.Id))
                .OrderBy(b => b.Address)
                .Select(b => new { id = b.Id, address = b.Address })
                .ToListAsync();

            return new JsonResult(branches);
        }

        // =====================================================================
        // ======================== UsersByOrgBranch ============================
        // =====================================================================
        public async Task<IActionResult> OnGetUsersByOrgBranchAsync(int orgId, int? branchId)
        {
            int userId = HttpContext.Session.GetInt32("UserId") ?? 0;

            // 🔥 Загружаем права!
            var permissions = await _context.UserPermissions
                .Include(p => p.Permission)
                .Where(p => p.UserId == userId)
                .ToListAsync();

            CanCreateForOthers = permissions.Any(p => p.Permission.Action.Contains("Создать от имени"));

            if (!CanCreateForOthers)
                return new JsonResult(new List<object>());

            CreateOrgIds = permissions
                .Where(p => p.Permission.Module == "Задачи" &&
                            p.Permission.Action.Contains("Добавление") &&
                            p.OrganizationId != null)
                .Select(p => p.OrganizationId!.Value)
                .Distinct()
                .ToList();

            CreateBranchIds = permissions
                .Where(p => p.Permission.Module == "Задачи" &&
                            p.Permission.Action.Contains("Добавление") &&
                            p.BranchId != null)
                .Select(p => p.BranchId!.Value)
                .Distinct()
                .ToList();

            if (!CreateOrgIds.Contains(orgId))
                return new JsonResult(new List<object>());

            IQueryable<User> query = _context.Users
                .Include(u => u.UserOrganizations)
                .Include(u => u.UserBranches);

            if (branchId != null)
            {
                if (!CreateBranchIds.Contains(branchId.Value))
                    return new JsonResult(new List<object>());

                query = query.Where(u =>
                    u.UserBranches.Any(b => b.BranchId == branchId.Value));
            }
            else
            {
                query = query.Where(u =>
                    u.UserOrganizations.Any(o => o.OrganizationId == orgId));
            }

            var users = await query
                .OrderBy(u => u.FullName)
                .Select(u => new { id = u.Id, fullName = u.FullName })
                .ToListAsync();

            return new JsonResult(users);
        }

        // ====================== DTO ======================
        public class RequestDto
        {
            public int Id { get; set; }
            public string Title { get; set; } = "";
            public string Topic { get; set; } = "";
            public string ProductName { get; set; } = "";
            public string OrganizationName { get; set; } = "";
            public string BranchAddress { get; set; } = "";
            public string Priority { get; set; } = "";
            public string Status { get; set; } = "";
            public string ClientName { get; set; } = "";
            public DateTime CreatedAt { get; set; }
        }
    }
}
