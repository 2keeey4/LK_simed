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

        public RequestsModel(AppDbContext context)
        {
            _context = context;
        }

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

        public List<string> Statuses { get; } = new()
        {
            "Создана",
            "В работе",
            "Завершена",
            "Отменена"
        };

        public List<string> Priorities { get; } = new()
        {
            "Низкий",
            "Средний",
            "Высокий",
            "Критический"
        };

        public int TotalCount { get; set; }
        public int CreatedCount { get; set; }
        public int InWorkCount { get; set; }
        public int DoneCount { get; set; }
        public int CancelledCount { get; set; }

        public int CurrentTotalCount { get; set; }
        public int CurrentCreatedCount { get; set; }
        public int CurrentInWorkCount { get; set; }
        public int CurrentDoneCount { get; set; }
        public int CurrentCancelledCount { get; set; }

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
                .Include(up => up.Permission)
                .Where(up => up.UserId == userId)
                .ToListAsync();

            FillPermissions(userPermissions);

            Organizations = await _context.Organizations
                .Where(o => ViewOrgIds.Contains(o.Id))
                .OrderBy(o => o.Name)
                .ToListAsync();

            Branches = await _context.Branches
                .Where(b => ViewBranchIds.Contains(b.Id))
                .Include(b => b.Organization)
                .OrderBy(b => b.Address)
                .ToListAsync();

            Products = await _context.Products
                .OrderBy(p => p.Name)
                .ToListAsync();

            CreateOrganizations = await _context.Organizations
                .Where(o => CreateOrgIds.Contains(o.Id))
                .OrderBy(o => o.Name)
                .ToListAsync();

            CreateBranches = await _context.Branches
                .Where(b => CreateBranchIds.Contains(b.Id))
                .OrderBy(b => b.Address)
                .ToListAsync();

            AvailableUsers = await _context.Users
                .Include(u => u.UserOrganizations)
                .Where(u => u.UserOrganizations.Any(uo => CreateOrgIds.Contains(uo.OrganizationId)))
                .OrderBy(u => u.FullName)
                .ToListAsync();

            var accessibleQuery = _context.Requests
                .Include(r => r.Organization)
                .Include(r => r.Branch)
                .Include(r => r.Product)
                .Include(r => r.CreatedBy)
                .Where(r =>
                    r.CreatedById == userId ||
                    (r.OrganizationId != null && ViewOrgIds.Contains(r.OrganizationId.Value)) ||
                    (r.BranchId != null && ViewBranchIds.Contains(r.BranchId.Value))
                );

            var currentList = await accessibleQuery.ToListAsync();

            CurrentTotalCount = currentList.Count;
            CurrentCreatedCount = currentList.Count(r => r.Status == "Создана");
            CurrentInWorkCount = currentList.Count(r => r.Status == "В работе");
            CurrentDoneCount = currentList.Count(r => r.Status == "Завершена");
            CurrentCancelledCount = currentList.Count(r => r.Status == "Отменена");

            DateTime from = DateTime.UtcNow.AddMonths(-12);
            DateTime to = DateTime.UtcNow;

            var periodList = currentList
                .Where(r => r.CreatedAt >= from && r.CreatedAt <= to)
                .ToList();

            TotalCount = periodList.Count;
            CreatedCount = periodList.Count(r => r.Status == "Создана");
            InWorkCount = periodList.Count(r => r.Status == "В работе");
            DoneCount = periodList.Count(r => r.Status == "Завершена");
            CancelledCount = periodList.Count(r => r.Status == "Отменена");

            Requests = periodList
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

            await FillClientDataAsync();
        }

        private void FillPermissions(List<UserPermission> userPermissions)
        {
            var taskPermissions = userPermissions
                .Where(up => up.Permission.Module == "Задачи")
                .ToList();

            CanCreate = taskPermissions.Any(up => up.Permission.Action.Contains("Добавление"));
            CanEdit = taskPermissions.Any(up => up.Permission.Action.Contains("редактирование"));
            CanDelete = taskPermissions.Any(up => up.Permission.Action.Contains("Удаление"));
            CanSeeClientColumn = taskPermissions.Any(up => up.Permission.Action.Contains("Просмотр столбца"));
            CanSeeStatistics = taskPermissions.Any(up => up.Permission.Action.Contains("Статистика"));
            CanSeeAnalytics = taskPermissions.Any(up => up.Permission.Action.Contains("Аналитика"));
            CanCreateForOthers = taskPermissions.Any(up => up.Permission.Action.Contains("Создать от имени"));

            ViewOrgIds = taskPermissions
                .Where(up =>
                    up.Permission.Action.Contains("Просмотр") &&
                    up.OrganizationId != null)
                .Select(up => up.OrganizationId!.Value)
                .Distinct()
                .ToList();

            ViewBranchIds = taskPermissions
                .Where(up =>
                    up.Permission.Action.Contains("Просмотр") &&
                    up.BranchId != null)
                .Select(up => up.BranchId!.Value)
                .Distinct()
                .ToList();

            CreateOrgIds = taskPermissions
                .Where(up =>
                    up.Permission.Action.Contains("Добавление") &&
                    up.OrganizationId != null)
                .Select(up => up.OrganizationId!.Value)
                .Distinct()
                .ToList();

            CreateBranchIds = taskPermissions
                .Where(up =>
                    up.Permission.Action.Contains("Добавление") &&
                    up.BranchId != null)
                .Select(up => up.BranchId!.Value)
                .Distinct()
                .ToList();
        }

        private async Task FillClientDataAsync()
        {
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

            var organizationProducts = await _context.OrganizationProducts
                .GroupBy(op => op.OrganizationId)
                .Select(g => new
                {
                    organizationId = g.Key,
                    productIds = g.Select(op => op.ProductId).ToList()
                })
                .ToListAsync();

            ViewData["OrganizationProducts"] = organizationProducts
                .ToDictionary(x => x.organizationId, x => x.productIds);
        }

        private double CalculateWorkHours(int requestId)
        {
            var history = _context.RequestStatusHistories
                .Where(h => h.RequestId == requestId)
                .OrderBy(h => h.ChangedAt)
                .ToList();

            if (history.Count == 0)
                return 0;

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
                int uid = HttpContext.Session.GetInt32("UserId") ?? 0;

                if (uid == 0)
                {
                    return new JsonResult(new
                    {
                        success = false,
                        error = "Пользователь не авторизован"
                    });
                }

                var form = await Request.ReadFormAsync();

                var userPermissions = await _context.UserPermissions
                    .Include(up => up.Permission)
                    .Where(up => up.UserId == uid)
                    .ToListAsync();

                FillPermissions(userPermissions);

                if (!CanCreate)
                {
                    return new JsonResult(new
                    {
                        success = false,
                        error = "Нет права на создание заявок"
                    });
                }

                if (!form.TryGetValue("Title", out var titleValue) || string.IsNullOrWhiteSpace(titleValue))
                {
                    return new JsonResult(new { success = false, error = "Заголовок обязателен" });
                }

                if (!form.TryGetValue("OrganizationId", out var orgIdValue) ||
                    !int.TryParse(orgIdValue, out int orgId))
                {
                    return new JsonResult(new { success = false, error = "Организация обязательна" });
                }

                if (!CreateOrgIds.Contains(orgId))
                {
                    return new JsonResult(new
                    {
                        success = false,
                        error = "Нет права создавать заявки для выбранной организации"
                    });
                }

                if (!form.TryGetValue("ProductId", out var productIdValue) ||
                    !int.TryParse(productIdValue, out int productId))
                {
                    return new JsonResult(new { success = false, error = "Продукт обязателен" });
                }

                if (!form.TryGetValue("Priority", out var priorityValue) ||
                    string.IsNullOrWhiteSpace(priorityValue))
                {
                    return new JsonResult(new { success = false, error = "Приоритет обязателен" });
                }

                string priority = priorityValue.ToString();

                if (!Priorities.Contains(priority))
                {
                    return new JsonResult(new { success = false, error = "Некорректный приоритет" });
                }

                string title = titleValue.ToString().Trim();
                string topic = form["Topic"].ToString().Trim();
                string description = form["Description"].ToString().Trim();

                if (string.IsNullOrWhiteSpace(topic))
                {
                    return new JsonResult(new { success = false, error = "Тема обязательна" });
                }

                int? branchId = null;

                if (form.TryGetValue("BranchId", out var branchIdValue) &&
                    !string.IsNullOrWhiteSpace(branchIdValue) &&
                    int.TryParse(branchIdValue, out int parsedBranchId))
                {
                    branchId = parsedBranchId;

                    var branchIsValid = await _context.Branches
                        .AnyAsync(b => b.Id == branchId.Value && b.OrganizationId == orgId);

                    if (!branchIsValid)
                    {
                        return new JsonResult(new
                        {
                            success = false,
                            error = "Выбранный филиал не относится к организации"
                        });
                    }

                    if (CreateBranchIds.Count > 0 && !CreateBranchIds.Contains(branchId.Value))
                    {
                        return new JsonResult(new
                        {
                            success = false,
                            error = "Нет права создавать заявки для выбранного филиала"
                        });
                    }
                }

                var organizationExists = await _context.Organizations.AnyAsync(o => o.Id == orgId);

                if (!organizationExists)
                {
                    return new JsonResult(new { success = false, error = "Организация не найдена" });
                }

                var productExists = await _context.Products.AnyAsync(p => p.Id == productId);

                if (!productExists)
                {
                    return new JsonResult(new { success = false, error = "Продукт не найден" });
                }

                var orgHasProductLinks = await _context.OrganizationProducts
                    .AnyAsync(op => op.OrganizationId == orgId);

                if (orgHasProductLinks)
                {
                    var productAllowed = await _context.OrganizationProducts
                        .AnyAsync(op => op.OrganizationId == orgId && op.ProductId == productId);

                    if (!productAllowed)
                    {
                        return new JsonResult(new
                        {
                            success = false,
                            error = "Выбранный продукт не привязан к организации"
                        });
                    }
                }

                int? createdById = uid;

                if (form.TryGetValue("CreatedById", out var createdByValue) &&
                    int.TryParse(createdByValue, out int parsedCreatedById))
                {
                    if (parsedCreatedById != uid && !CanCreateForOthers)
                    {
                        return new JsonResult(new
                        {
                            success = false,
                            error = "Нет права создавать заявки от имени другого пользователя"
                        });
                    }

                    createdById = parsedCreatedById;
                }

                if (createdById.HasValue)
                {
                    var userExists = await _context.Users.AnyAsync(u => u.Id == createdById.Value);

                    if (!userExists)
                    {
                        return new JsonResult(new { success = false, error = "Пользователь не найден" });
                    }

                    if (CanCreateForOthers)
                    {
                        var userInOrg = await _context.UserOrganizations
                            .AnyAsync(uo => uo.UserId == createdById.Value && uo.OrganizationId == orgId);

                        if (!userInOrg)
                        {
                            return new JsonResult(new
                            {
                                success = false,
                                error = "Выбранный пользователь не относится к организации"
                            });
                        }

                        if (branchId.HasValue)
                        {
                            var userInBranch = await _context.UserBranches
                                .AnyAsync(ub => ub.UserId == createdById.Value && ub.BranchId == branchId.Value);

                            if (!userInBranch)
                            {
                                return new JsonResult(new
                                {
                                    success = false,
                                    error = "Выбранный пользователь не относится к филиалу"
                                });
                            }
                        }
                    }
                }

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
                await _context.SaveChangesAsync();

                var statusHistory = new RequestStatusHistory
                {
                    RequestId = newRequest.Id,
                    Status = "Создана",
                    ChangedAt = DateTime.UtcNow
                };

                _context.RequestStatusHistories.Add(statusHistory);

                await SaveRequestFilesAsync(newRequest.Id, form.Files);

                await _context.SaveChangesAsync();

                return new JsonResult(new
                {
                    success = true,
                    id = newRequest.Id,
                    message = "Заявка успешно создана"
                });
            }
            catch (Exception ex)
            {
                return new JsonResult(new
                {
                    success = false,
                    error = "Ошибка при создании заявки",
                    details = ex.Message
                });
            }
        }

        private async Task SaveRequestFilesAsync(int requestId, IFormFileCollection files)
        {
            if (files == null || files.Count == 0)
                return;

            var allowedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                ".jpg",
                ".jpeg",
                ".png",
                ".pdf",
                ".docx"
            };

            string folder = Path.Combine("wwwroot", "uploads", "requests", requestId.ToString());
            Directory.CreateDirectory(folder);

            foreach (var file in files)
            {
                if (file == null || file.Length == 0)
                    continue;

                var extension = Path.GetExtension(file.FileName);

                if (!allowedExtensions.Contains(extension))
                    continue;

                string safeOriginalName = Path.GetFileName(file.FileName);
                string fileName = $"{Guid.NewGuid()}_{safeOriginalName}";
                string path = Path.Combine(folder, fileName);

                await using var stream = new FileStream(path, FileMode.Create);
                await file.CopyToAsync(stream);

                var attachment = new Attachment
                {
                    FilePath = $"/uploads/requests/{requestId}/{fileName}",
                    RequestId = requestId,
                    UploadedAt = DateTime.UtcNow
                };

                _context.Attachments.Add(attachment);
            }
        }

        public async Task<IActionResult> OnGetApiBranchesAsync(int orgId)
        {
            try
            {
                int uid = HttpContext.Session.GetInt32("UserId") ?? 0;

                if (uid == 0)
                {
                    return new JsonResult(new
                    {
                        success = false,
                        error = "Пользователь не авторизован"
                    });
                }

                var userPermissions = await _context.UserPermissions
                    .Include(up => up.Permission)
                    .Where(up => up.UserId == uid)
                    .ToListAsync();

                FillPermissions(userPermissions);

                var branches = await _context.Branches
                    .Where(b =>
                        b.OrganizationId == orgId &&
                        (
                            CreateBranchIds.Contains(b.Id) ||
                            ViewBranchIds.Contains(b.Id) ||
                            CreateOrgIds.Contains(orgId)
                        ))
                    .OrderBy(b => b.Address)
                    .Select(b => new
                    {
                        id = b.Id,
                        address = b.Address
                    })
                    .ToListAsync();

                return new JsonResult(new
                {
                    success = true,
                    data = branches
                });
            }
            catch (Exception ex)
            {
                return new JsonResult(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }

        public async Task<IActionResult> OnGetApiUsersAsync(int orgId, int? branchId = null)
        {
            try
            {
                int uid = HttpContext.Session.GetInt32("UserId") ?? 0;

                if (uid == 0)
                {
                    return new JsonResult(new
                    {
                        success = false,
                        error = "Пользователь не авторизован"
                    });
                }

                var userPermissions = await _context.UserPermissions
                    .Include(up => up.Permission)
                    .Where(up => up.UserId == uid)
                    .ToListAsync();

                FillPermissions(userPermissions);

                if (!CreateOrgIds.Contains(orgId) && !ViewOrgIds.Contains(orgId))
                {
                    return new JsonResult(new
                    {
                        success = false,
                        error = "Нет доступа к организации"
                    });
                }

                var userIdsInOrg = await _context.UserOrganizations
                    .Where(uo => uo.OrganizationId == orgId)
                    .Select(uo => uo.UserId)
                    .ToListAsync();

                var query = _context.Users
                    .Where(u => userIdsInOrg.Contains(u.Id));

                if (branchId.HasValue)
                {
                    var userIdsInBranch = await _context.UserBranches
                        .Where(ub => ub.BranchId == branchId.Value)
                        .Select(ub => ub.UserId)
                        .ToListAsync();

                    query = query.Where(u => userIdsInBranch.Contains(u.Id));
                }

                var users = await query
                    .OrderBy(u => u.FullName)
                    .Select(u => new
                    {
                        id = u.Id,
                        fullName = u.FullName
                    })
                    .ToListAsync();

                return new JsonResult(new
                {
                    success = true,
                    data = users
                });
            }
            catch (Exception ex)
            {
                return new JsonResult(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }

        public async Task<IActionResult> OnGetApiEstimateHoursAsync(
            string topic,
            int organizationId,
            int productId,
            string priority,
            int? branchId = null,
            string description = "")
        {
            try
            {
                int uid = HttpContext.Session.GetInt32("UserId") ?? 0;

                if (uid == 0)
                {
                    return new JsonResult(new
                    {
                        success = false,
                        error = "Пользователь не авторизован"
                    });
                }

                var userPermissions = await _context.UserPermissions
                    .Include(up => up.Permission)
                    .Where(up => up.UserId == uid)
                    .ToListAsync();

                FillPermissions(userPermissions);

                if (!CanCreate)
                {
                    return new JsonResult(new
                    {
                        success = false,
                        error = "Нет права на создание заявок"
                    });
                }

                if (string.IsNullOrWhiteSpace(topic))
                {
                    return new JsonResult(new
                    {
                        success = false,
                        error = "Не выбрана тема"
                    });
                }

                if (!Priorities.Contains(priority))
                {
                    return new JsonResult(new
                    {
                        success = false,
                        error = "Некорректный приоритет"
                    });
                }

                if (!CreateOrgIds.Contains(organizationId) && !ViewOrgIds.Contains(organizationId))
                {
                    return new JsonResult(new
                    {
                        success = false,
                        error = "Нет доступа к организации"
                    });
                }

                if (branchId.HasValue)
                {
                    var branchIsValid = await _context.Branches
                        .AnyAsync(b => b.Id == branchId.Value && b.OrganizationId == organizationId);

                    if (!branchIsValid)
                    {
                        return new JsonResult(new
                        {
                            success = false,
                            error = "Филиал не относится к выбранной организации"
                        });
                    }

                    if (CreateBranchIds.Count > 0 &&
                        !CreateBranchIds.Contains(branchId.Value) &&
                        !ViewBranchIds.Contains(branchId.Value))
                    {
                        return new JsonResult(new
                        {
                            success = false,
                            error = "Нет доступа к выбранному филиалу"
                        });
                    }
                }

                var productExists = await _context.Products.AnyAsync(p => p.Id == productId);

                if (!productExists)
                {
                    return new JsonResult(new
                    {
                        success = false,
                        error = "Продукт не найден"
                    });
                }

                var orgHasProductLinks = await _context.OrganizationProducts
                    .AnyAsync(op => op.OrganizationId == organizationId);

                if (orgHasProductLinks)
                {
                    var productAllowed = await _context.OrganizationProducts
                        .AnyAsync(op => op.OrganizationId == organizationId && op.ProductId == productId);

                    if (!productAllowed)
                    {
                        return new JsonResult(new
                        {
                            success = false,
                            error = "Продукт не привязан к организации"
                        });
                    }
                }

                var accessibleRequests = await _context.Requests
                    .Include(r => r.Organization)
                    .Include(r => r.Branch)
                    .Include(r => r.Product)
                    .Where(r =>
                        r.Status == "Завершена" ||
                        r.Status == "Отменена")
                    .Where(r =>
                        r.CreatedById == uid ||
                        (r.OrganizationId != null && ViewOrgIds.Contains(r.OrganizationId.Value)) ||
                        (r.BranchId != null && ViewBranchIds.Contains(r.BranchId.Value)))
                    .ToListAsync();

                var samples = accessibleRequests
                    .Select(r => new EstimateSampleDto
                    {
                        RequestId = r.Id,
                        Topic = r.Topic ?? "",
                        OrganizationId = r.OrganizationId,
                        BranchId = r.BranchId,
                        ProductId = r.ProductId,
                        Priority = r.Priority,
                        Hours = CalculateWorkHours(r.Id)
                    })
                    .Where(x => x.Hours > 0)
                    .ToList();

                var exactSamples = samples
                    .Where(x =>
                        x.OrganizationId == organizationId &&
                        x.ProductId == productId &&
                        NormalizeText(x.Topic) == NormalizeText(topic) &&
                        (!branchId.HasValue || x.BranchId == branchId.Value))
                    .ToList();

                var productTopicSamples = samples
                    .Where(x =>
                        x.ProductId == productId &&
                        NormalizeText(x.Topic) == NormalizeText(topic))
                    .ToList();

                var topicSamples = samples
                    .Where(x => NormalizeText(x.Topic) == NormalizeText(topic))
                    .ToList();

                var productSamples = samples
                    .Where(x => x.ProductId == productId)
                    .ToList();

                List<EstimateSampleDto> selectedSamples;
                string source;

                if (exactSamples.Count >= 3)
                {
                    selectedSamples = exactSamples;
                    source = "exact";
                }
                else if (productTopicSamples.Count >= 3)
                {
                    selectedSamples = productTopicSamples;
                    source = "productTopic";
                }
                else if (topicSamples.Count >= 3)
                {
                    selectedSamples = topicSamples;
                    source = "topic";
                }
                else if (productSamples.Count >= 3)
                {
                    selectedSamples = productSamples;
                    source = "product";
                }
                else
                {
                    selectedSamples = samples;
                    source = "common";
                }

                double baseHours = GetBaseHoursByTopic(topic);
                double sampleAverage = selectedSamples.Count > 0
                    ? GetTrimmedAverage(selectedSamples.Select(x => x.Hours).ToList())
                    : baseHours;

                double sampleWeight = GetSampleWeight(selectedSamples.Count, source);
                double baseWeight = 1 - sampleWeight;

                double priorityFactor = GetPriorityFactor(priority);
                double descriptionFactor = GetDescriptionFactor(description);

                double estimatedHours =
                    ((sampleAverage * sampleWeight) + (baseHours * baseWeight))
                    * priorityFactor
                    * descriptionFactor;

                estimatedHours = Math.Clamp(estimatedHours, 0.5, 120);
                estimatedHours = Math.Round(estimatedHours, 2);

                string confidence = GetConfidence(selectedSamples.Count, source);

                return new JsonResult(new
                {
                    success = true,
                    data = new
                    {
                        estimatedHours,
                        sampleCount = selectedSamples.Count,
                        confidence,
                        priorityFactor = Math.Round(priorityFactor, 2),
                        descriptionFactor = Math.Round(descriptionFactor, 2),
                        baseHours = Math.Round(baseHours, 2),
                        sampleAverage = Math.Round(sampleAverage, 2),
                        source
                    }
                });
            }
            catch (Exception ex)
            {
                return new JsonResult(new
                {
                    success = false,
                    error = "Ошибка при расчёте времени",
                    details = ex.Message
                });
            }
        }

        private static string NormalizeText(string value)
        {
            return (value ?? "")
                .Trim()
                .ToLowerInvariant();
        }

        private static double GetBaseHoursByTopic(string topic)
        {
            string normalized = NormalizeText(topic);

            if (normalized.Contains("интерфейс"))
                return 6;

            if (normalized.Contains("ошиб"))
                return 4;

            if (normalized.Contains("аналитик"))
                return 8;

            if (normalized.Contains("отчет") || normalized.Contains("отчёт"))
                return 7;

            if (normalized.Contains("доступ") || normalized.Contains("прав"))
                return 3;

            if (normalized.Contains("интеграц"))
                return 10;

            return 5;
        }

        private static double GetPriorityFactor(string priority)
        {
            return priority switch
            {
                "Низкий" => 0.9,
                "Средний" => 1.0,
                "Высокий" => 1.2,
                "Критический" => 1.45,
                _ => 1.0
            };
        }

        private static double GetDescriptionFactor(string description)
        {
            if (string.IsNullOrWhiteSpace(description))
                return 1.0;

            int length = description.Trim().Length;

            if (length < 80)
                return 1.0;

            if (length < 250)
                return 1.08;

            if (length < 600)
                return 1.18;

            return 1.3;
        }

        private static double GetSampleWeight(int sampleCount, string source)
        {
            if (sampleCount <= 0)
                return 0;

            double countWeight =
                sampleCount >= 10 ? 0.9 :
                sampleCount >= 6 ? 0.8 :
                sampleCount >= 3 ? 0.65 :
                sampleCount >= 1 ? 0.45 :
                0;

            double sourceWeight = source switch
            {
                "exact" => 1.0,
                "productTopic" => 0.9,
                "topic" => 0.75,
                "product" => 0.65,
                "common" => 0.45,
                _ => 0.4
            };

            return Math.Min(countWeight * sourceWeight, 0.9);
        }

        private static string GetConfidence(int sampleCount, string source)
        {
            if (sampleCount >= 6 && (source == "exact" || source == "productTopic"))
                return "high";

            if (sampleCount >= 3 && source != "common")
                return "medium";

            return "low";
        }

        private static double GetTrimmedAverage(List<double> values)
        {
            if (values.Count == 0)
                return 0;

            var ordered = values
                .Where(v => v > 0)
                .OrderBy(v => v)
                .ToList();

            if (ordered.Count == 0)
                return 0;

            if (ordered.Count <= 4)
                return ordered.Average();

            int removeCount = Math.Max(1, (int)Math.Floor(ordered.Count * 0.1));

            var trimmed = ordered
                .Skip(removeCount)
                .Take(ordered.Count - removeCount * 2)
                .ToList();

            if (trimmed.Count == 0)
                return ordered.Average();

            return trimmed.Average();
        }

        private class EstimateSampleDto
        {
            public int RequestId { get; set; }
            public string Topic { get; set; } = "";
            public int? OrganizationId { get; set; }
            public int? BranchId { get; set; }
            public int? ProductId { get; set; }
            public string Priority { get; set; } = "";
            public double Hours { get; set; }
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