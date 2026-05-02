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

        public List<RequestDto> Requests { get; set; } = new();
        public List<Organization> Organizations { get; set; } = new();
        public List<Branch> Branches { get; set; } = new();
        public List<Product> Products { get; set; } = new();
        public List<Organization> FilterOrganizations => Organizations;
        public List<Branch> FilterBranches => Branches;
        public List<Organization> CreateOrganizations { get; set; } = new();
        public List<Branch> CreateBranches { get; set; } = new();
        public List<User> AvailableUsers { get; set; } = new();
        public int CurrentUserId { get; set; }
        public List<string> Statuses { get; } = new() { "Создана", "В работе", "Завершена", "Отменена" };
        public List<string> Priorities { get; } = new() { "Низкий", "Средний", "Высокий", "Критический" };
        public int TotalCount { get; set; }
        public int CreatedCount { get; set; }
        public int InWorkCount { get; set; }
        public int DoneCount { get; set; }
        public int CancelledCount { get; set; }
        public bool CanCreate { get; set; }
        public bool CanEdit { get; set; }
        public bool CanDelete { get; set; }
        public bool CanSeeClientColumn { get; set; }
        public bool CanSeeStatistics { get; set; }
        public bool CanSeeAnalytics { get; set; }
        public bool CanCreateForOthers { get; set; }
        public List<int> ViewOrgIds { get; set; } = new();
        public List<int> ViewBranchIds { get; set; } = new();
        public List<int> CreateOrgIds { get; set; } = new();
        public List<int> CreateBranchIds { get; set; } = new();
        public List<OrgHoursDto> OrganizationHours { get; set; } = new();

        public class OrgHoursDto
        {
            public int OrgId { get; set; }
            public string OrgName { get; set; } = "";
            public double LimitHours { get; set; }
            public double SpentHours { get; set; }
            public double RemainingHours => Math.Max(LimitHours - SpentHours, 0);
        }

        public async Task OnGetAsync()
        {
            int userId = HttpContext.Session.GetInt32("UserId") ?? 0;
            CurrentUserId = userId;

            if (userId == 0)
            {
                Requests = new();
                return;
            }

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

            ViewOrgIds = userPermissions
                .Where(p => p.Permission.Action.Contains("Просмотр") && p.OrganizationId != null)
                .Select(p => p.OrganizationId!.Value)
                .Distinct().ToList();

            ViewBranchIds = userPermissions
                .Where(p => p.Permission.Action.Contains("Просмотр") && p.BranchId != null)
                .Select(p => p.BranchId!.Value)
                .Distinct().ToList();

            CreateOrgIds = userPermissions
                .Where(p => p.Permission.Action.Contains("Добавление") && p.OrganizationId != null)
                .Select(p => p.OrganizationId!.Value)
                .Distinct().ToList();

            CreateBranchIds = userPermissions
                .Where(p => p.Permission.Action.Contains("Добавление") && p.BranchId != null)
                .Select(p => p.BranchId!.Value)
                .Distinct().ToList();

            Organizations = await _context.Organizations
                .Where(o => ViewOrgIds.Contains(o.Id))
                .OrderBy(o => o.Name)
                .ToListAsync();

            Branches = await _context.Branches
                .Where(b => ViewBranchIds.Contains(b.Id))
                .Include(b => b.Organization)
                .OrderBy(b => b.Address)
                .ToListAsync();

            Products = await _context.Products.OrderBy(p => p.Name).ToListAsync();

            CreateOrganizations = await _context.Organizations
                .Where(o => CreateOrgIds.Contains(o.Id))
                .ToListAsync();

            CreateBranches = await _context.Branches
                .Where(b => CreateBranchIds.Contains(b.Id))
                .ToListAsync();

            AvailableUsers = await _context.Users
                .Include(u => u.UserOrganizations)
                .Where(u => u.UserOrganizations.Any(uo => CreateOrgIds.Contains(uo.OrganizationId)))
                .OrderBy(u => u.FullName)
                .ToListAsync();

            // Загружаем заявки за последние 12 месяцев (или все, если убрать условие)
            DateTime from = DateTime.UtcNow.AddMonths(-12);
            DateTime to = DateTime.UtcNow;

            var list = await _context.Requests
                .Include(r => r.Organization)
                .Include(r => r.Branch)
                .Include(r => r.Product)
                .Include(r => r.CreatedBy)
                .Where(r =>
                    r.CreatedAt >= from && r.CreatedAt <= to &&
                    (
                        r.CreatedById == userId ||
                        (r.OrganizationId != null && ViewOrgIds.Contains(r.OrganizationId.Value)) ||
                        (r.BranchId != null && ViewBranchIds.Contains(r.BranchId.Value))
                    )
                )
                .ToListAsync();

            TotalCount = list.Count;
            CreatedCount = list.Count(r => r.Status == "Создана");
            InWorkCount = list.Count(r => r.Status == "В работе");
            DoneCount = list.Count(r => r.Status == "Завершена");
            CancelledCount = list.Count(r => r.Status == "Отменена");

            Requests = list
                .Select(r => new RequestDto
                {
                    Id = r.Id,
                    Title = r.Title,
                    Topic = r.Topic ?? "",
                    ProductName = r.Product?.Name ?? "-",
                    OrganizationName = r.Organization?.Name ?? "-",
                    BranchAddress = r.Branch?.Address ?? "-",
                    Priority = r.Priority,
                    Status = r.Status,
                    ClientName = r.CreatedBy?.FullName ?? "-",
                    CreatedAt = r.CreatedAt,
                    WorkHours = CalculateWorkHours(r.Id)
                })
                .OrderByDescending(r => r.CreatedAt)
                .ToList();

            OrganizationHours = Organizations
                .Select(org => new OrgHoursDto
                {
                    OrgId = org.Id,
                    OrgName = org.Name,
                    LimitHours = org.WorkHoursLimit,
                    SpentHours = Requests
                        .Where(r => r.OrganizationName == org.Name)
                        .Sum(r => r.WorkHours)
                })
                .ToList();

            ViewData["AllBranches"] = await _context.Branches
                .Include(b => b.Organization)
                .Select(b => new
                {
                    id = b.Id,
                    address = b.Address,
                    organizationId = b.OrganizationId,
                    organizationName = b.Organization != null ? b.Organization.Name : ""
                })
                .ToListAsync();

            ViewData["AllUsers"] = await _context.Users
                .Include(u => u.UserOrganizations)
                .Include(u => u.UserBranches)
                .Select(u => new
                {
                    id = u.Id,
                    fullName = u.FullName,
                    organizations = u.UserOrganizations.Select(uo => uo.OrganizationId).ToList(),
                    branches = u.UserBranches.Select(ub => ub.BranchId).ToList()
                })
                .ToListAsync();
        }

        private double CalculateWorkHours(int requestId)
        {
            var history = _context.RequestStatusHistories
                .Where(h => h.RequestId == requestId)
                .OrderBy(h => h.ChangedAt)
                .ToList();

            if (history.Count == 0) return 0;

            DateTime? start = null;
            double sum = 0;

            foreach (var h in history)
            {
                if (h.Status == "В работе")
                {
                    start = h.ChangedAt;
                }
                else if ((h.Status == "Завершена" || h.Status == "Отменена") && start != null)
                {
                    sum += (h.ChangedAt - start.Value).TotalHours;
                    start = null;
                }
            }

            return Math.Round(sum, 2);
        }

        public async Task<IActionResult> OnPostCreateAsync()
        {
            try
            {
                Console.WriteLine("=== НАЧАЛО СОЗДАНИЯ ЗАЯВКИ ===");

                int uid = HttpContext.Session.GetInt32("UserId") ?? 0;
                Console.WriteLine($"Текущий пользователь ID: {uid}");

                if (uid == 0)
                {
                    Console.WriteLine("Пользователь не авторизован");
                    return new JsonResult(new { success = false, error = "Пользователь не авторизован" });
                }

                var form = await Request.ReadFormAsync();

                // Логируем все поля
                Console.WriteLine("Все полученные поля:");
                foreach (var key in form.Keys)
                {
                    var value = form[key];
                    Console.WriteLine($"{key}: {value}");
                }

                if (!form.TryGetValue("Title", out var titleValue) || string.IsNullOrEmpty(titleValue))
                {
                    Console.WriteLine("Ошибка: Заголовок не заполнен");
                    return new JsonResult(new { success = false, error = "Заголовок обязателен" });
                }

                if (!form.TryGetValue("OrganizationId", out var orgIdValue) || !int.TryParse(orgIdValue, out int orgId))
                {
                    Console.WriteLine($"Ошибка: Организация не выбрана. Значение: {orgIdValue}");
                    return new JsonResult(new { success = false, error = "Организация обязательна" });
                }

                if (!form.TryGetValue("ProductId", out var productIdValue) || !int.TryParse(productIdValue, out int productId))
                {
                    Console.WriteLine($"Ошибка: Продукт не выбран. Значение: {productIdValue}");
                    return new JsonResult(new { success = false, error = "Продукт обязателен" });
                }

                if (!form.TryGetValue("Priority", out var priorityValue) || string.IsNullOrEmpty(priorityValue))
                {
                    Console.WriteLine("Ошибка: Приоритет не выбран");
                    return new JsonResult(new { success = false, error = "Приоритет обязателен" });
                }

                int? createdById;
                if (form.TryGetValue("CreatedById", out var createdByIdValue) && int.TryParse(createdByIdValue, out int parsedId))
                {
                    createdById = parsedId;
                    Console.WriteLine($"Создание от имени пользователя ID: {createdById}");
                }
                else
                {
                    createdById = uid;
                    Console.WriteLine($"Создание от имени текущего пользователя ID: {createdById}");
                }

                string title = titleValue.ToString();
                string topic = form["Topic"].ToString();

                int? branchId = null;
                if (form.TryGetValue("BranchId", out var branchIdValue) && !string.IsNullOrEmpty(branchIdValue) && int.TryParse(branchIdValue, out int b))
                {
                    branchId = b;
                    Console.WriteLine($"Выбран филиал ID: {branchId}");
                }
                else
                {
                    Console.WriteLine("Филиал не выбран (NULL)");
                }

                string priority = priorityValue.ToString();
                string description = form["Description"].ToString();

                Console.WriteLine($"Собранные данные:");
                Console.WriteLine($"Title: {title}");
                Console.WriteLine($"Topic: {topic}");
                Console.WriteLine($"OrganizationId: {orgId}");
                Console.WriteLine($"BranchId: {branchId}");
                Console.WriteLine($"ProductId: {productId}");
                Console.WriteLine($"Priority: {priority}");
                Console.WriteLine($"CreatedById: {createdById}");

                // Проверяем существование сущностей
                var organizationExists = await _context.Organizations.AnyAsync(o => o.Id == orgId);
                if (!organizationExists)
                {
                    Console.WriteLine($"Ошибка: Организация с ID {orgId} не найдена");
                    return new JsonResult(new { success = false, error = "Организация не найдена" });
                }

                var productExists = await _context.Products.AnyAsync(p => p.Id == productId);
                if (!productExists)
                {
                    Console.WriteLine($"Ошибка: Продукт с ID {productId} не найден");
                    return new JsonResult(new { success = false, error = "Продукт не найден" });
                }

                if (createdById.HasValue)
                {
                    var userExists = await _context.Users.AnyAsync(u => u.Id == createdById.Value);
                    if (!userExists)
                    {
                        Console.WriteLine($"Ошибка: Пользователь с ID {createdById} не найден");
                        return new JsonResult(new { success = false, error = "Пользователь не найден" });
                    }
                }

                if (branchId.HasValue)
                {
                    var branchExists = await _context.Branches.AnyAsync(b => b.Id == branchId.Value);
                    if (!branchExists)
                    {
                        Console.WriteLine($"Ошибка: Филиал с ID {branchId} не найден");
                        return new JsonResult(new { success = false, error = "Филиал не найден" });
                    }
                }

                // СОХРАНЕНИЕ ЧЕРЕЗ ENTITY FRAMEWORK (самый надежный способ)
                var newRequest = new Request
                {
                    Title = title,
                    Topic = topic,
                    OrganizationId = orgId,
                    BranchId = branchId,
                    ProductId = productId,
                    Priority = priority,
                    Status = "Создана",
                    CreatedById = createdById,
                    Description = description,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Requests.Add(newRequest);
                await _context.SaveChangesAsync(); // Сохраняем, чтобы получить Id

                var requestId = newRequest.Id; // Теперь у нас есть реальный ID
                Console.WriteLine($"Заявка создана с ID: {requestId}");

                // Обработка файла
                var file = form.Files.FirstOrDefault();
                if (file != null && file.Length > 0)
                {
                    try
                    {
                        Console.WriteLine($"Обработка файла: {file.FileName}");

                        string folder = Path.Combine("wwwroot", "uploads", "requests", requestId.ToString());
                        Directory.CreateDirectory(folder);

                        string fileName = $"{Guid.NewGuid()}_{file.FileName}";
                        string path = Path.Combine(folder, fileName);

                        using var stream = new FileStream(path, FileMode.Create);
                        await file.CopyToAsync(stream);

                        var attachment = new Attachment
                        {
                            FilePath = $"/uploads/requests/{requestId}/{fileName}",
                            RequestId = requestId
                        };

                        _context.Attachments.Add(attachment);
                        await _context.SaveChangesAsync();

                        Console.WriteLine($"Файл сохранен: {attachment.FilePath}");
                    }
                    catch (Exception fileEx)
                    {
                        Console.WriteLine($"Ошибка при сохранении файла: {fileEx.Message}");
                        // Не прерываем процесс, файл не обязателен
                    }
                }

                Console.WriteLine("=== ЗАЯВКА УСПЕШНО СОЗДАНА ===");

                return new JsonResult(new
                {
                    success = true,
                    id = requestId,
                    message = "Заявка успешно создана"
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ОБЩАЯ ОШИБКА: {ex.Message}");
                Console.WriteLine($"StackTrace: {ex.StackTrace}");
                Console.WriteLine($"Inner Exception: {ex.InnerException?.Message}");

                return new JsonResult(new
                {
                    success = false,
                    error = "Ошибка при создании заявки",
                    details = ex.Message
                });
            }
        }

        public async Task<IActionResult> OnGetApiBranchesAsync(int orgId)
        {
            try
            {
                Console.WriteLine($"Запрос филиалов для организации ID: {orgId}");

                var branches = await _context.Branches
                    .Where(b => b.OrganizationId == orgId)
                    .OrderBy(b => b.Address)
                    .Select(b => new { id = b.Id, address = b.Address })
                    .ToListAsync();

                Console.WriteLine($"Найдено филиалов: {branches.Count}");

                return new JsonResult(new { success = true, data = branches });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка при получении филиалов: {ex.Message}");
                return new JsonResult(new { success = false, error = ex.Message });
            }
        }

        public async Task<IActionResult> OnGetApiUsersAsync(int orgId, int? branchId = null)
        {
            try
            {
                Console.WriteLine($"Запрос пользователей для организации ID: {orgId}, филиал ID: {branchId}");

                var userOrgIds = await _context.UserOrganizations
                    .Where(uo => uo.OrganizationId == orgId)
                    .Select(uo => uo.UserId)
                    .ToListAsync();

                var query = _context.Users
                    .Where(u => userOrgIds.Contains(u.Id));

                if (branchId.HasValue)
                {
                    var userBranchIds = await _context.UserBranches
                        .Where(ub => ub.BranchId == branchId.Value)
                        .Select(ub => ub.UserId)
                        .ToListAsync();

                    query = query.Where(u => userBranchIds.Contains(u.Id));
                }

                var users = await query
                    .OrderBy(u => u.FullName)
                    .Select(u => new { id = u.Id, fullName = u.FullName })
                    .ToListAsync();

                Console.WriteLine($"Найдено пользователей: {users.Count}");

                return new JsonResult(new { success = true, data = users });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка при получении пользователей: {ex.Message}");
                return new JsonResult(new { success = false, error = ex.Message });
            }
        }

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
            public double WorkHours { get; set; }
        }
    }
}