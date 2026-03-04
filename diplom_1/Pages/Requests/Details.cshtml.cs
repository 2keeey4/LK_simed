using diplom_1.Data;
using diplom_1.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using System.IO;

namespace diplom_1.Pages.Requests
{
    public class DetailsModel : PageModel
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<DetailsModel> _logger;

        public DetailsModel(AppDbContext context, IWebHostEnvironment env, ILogger<DetailsModel> logger)
        {
            _context = context;
            _env = env;
            _logger = logger;
        }

        public Request Request { get; set; } = null!;
        public List<Comment> Comments { get; set; } = new();
        public List<RequestStatusHistory> StatusHistory { get; set; } = new();
        public bool CanEdit { get; set; } = false;

        [BindProperty]
        public string NewCommentContent { get; set; } = string.Empty;

        [BindProperty]
        public bool IsInternal { get; set; } = false;

        [BindProperty]
        public IFormFile? UploadFile { get; set; }

        public async Task<IActionResult> OnGetAsync(int id)
        {
            var userId = HttpContext.Session.GetInt32("UserId");
            if (userId == null)
            {
                return RedirectToPage("/Login");
            }

            Request = await _context.Requests
                .Include(r => r.Product)
                .Include(r => r.Organization)
                .Include(r => r.Branch)
                .Include(r => r.CreatedBy)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (Request == null)
                return NotFound();

            Comments = await _context.Comments
                .Where(c => c.RequestId == id)
                .Include(c => c.Author)
                .Include(c => c.Attachments)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();

            StatusHistory = await _context.RequestStatusHistories
                .Where(h => h.RequestId == id)
                .OrderByDescending(h => h.ChangedAt)
                .ToListAsync();

            var userPermissions = await _context.UserPermissions
                .Include(p => p.Permission)
                .Where(p => p.UserId == userId)
                .ToListAsync();

            CanEdit = userPermissions.Any(p =>
                p.Permission.Module == "Задачи" &&
                p.Permission.Action.Contains("Добавление/редактирование"));

            return Page();
        }

        // ИСПРАВЛЕННЫЙ МЕТОД: Используем DateTime.UtcNow вместо DateTime.Now
        public async Task<IActionResult> OnPostAddCommentAsync(int id)
        {
            try
            {
                _logger.LogInformation("Начало обработки OnPostAddCommentAsync для заявки {RequestId}", id);

                var userId = HttpContext.Session.GetInt32("UserId");
                _logger.LogInformation("UserId из сессии: {UserId}", userId);

                if (userId == null)
                {
                    TempData["ErrorMessage"] = "Вы не авторизованы";
                    _logger.LogWarning("Пользователь не авторизован");
                    return RedirectToPage(new { id });
                }

                // Загружаем заявку для проверки
                var request = await _context.Requests.FirstOrDefaultAsync(r => r.Id == id);
                if (request == null)
                {
                    TempData["ErrorMessage"] = "Заявка не найдена";
                    _logger.LogWarning("Заявка {RequestId} не найдена", id);
                    return RedirectToPage(new { id });
                }

                _logger.LogInformation("Получен контент: {Content}, Файл: {HasFile}, Размер: {FileSize}",
                    NewCommentContent,
                    UploadFile != null,
                    UploadFile?.Length);

                if (string.IsNullOrWhiteSpace(NewCommentContent) && (UploadFile == null || UploadFile.Length == 0))
                {
                    TempData["ErrorMessage"] = "Комментарий или файл обязательны";
                    _logger.LogWarning("Комментарий и файл пусты");
                    return RedirectToPage(new { id });
                }

                // Создаем комментарий с UTC временем
                var comment = new Comment
                {
                    RequestId = id,
                    AuthorId = userId.Value,
                    Content = NewCommentContent?.Trim() ?? string.Empty,
                    IsInternal = IsInternal,
                    CreatedAt = DateTime.UtcNow // ← ИСПРАВЛЕНО: UtcNow вместо Now
                };

                _logger.LogInformation("Создан объект Comment: RequestId={RequestId}, AuthorId={AuthorId}, CreatedAt={CreatedAt}",
                    comment.RequestId, comment.AuthorId, comment.CreatedAt);

                // Если есть файл - добавляем его
                if (UploadFile != null && UploadFile.Length > 0)
                {
                    var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads", "comments");
                    if (!Directory.Exists(uploadsFolder))
                        Directory.CreateDirectory(uploadsFolder);

                    var fileName = $"{Guid.NewGuid()}{Path.GetExtension(UploadFile.FileName)}";
                    var filePath = Path.Combine(uploadsFolder, fileName);

                    _logger.LogInformation("Сохранение файла: {FileName} в {FilePath}", fileName, filePath);

                    using (var stream = new FileStream(filePath, FileMode.Create))
                    {
                        await UploadFile.CopyToAsync(stream);
                    }

                    var attachment = new Attachment
                    {
                        FilePath = $"/uploads/comments/{fileName}",
                        UploadedAt = DateTime.UtcNow // ← ИСПРАВЛЕНО: UtcNow вместо Now
                    };

                    // Инициализируем коллекцию и добавляем вложение
                    comment.Attachments = new List<Attachment>();
                    comment.Attachments.Add(attachment);

                    _logger.LogInformation("Файл сохранен: {FilePath}", attachment.FilePath);
                }

                _context.Comments.Add(comment);
                _logger.LogInformation("Comment добавлен в контекст");

                await _context.SaveChangesAsync();
                _logger.LogInformation("Изменения сохранены в БД. Comment ID: {CommentId}", comment.Id);

                TempData["SuccessMessage"] = "Комментарий добавлен";
                return RedirectToPage(new { id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка в OnPostAddCommentAsync для заявки {RequestId}", id);
                TempData["ErrorMessage"] = $"Ошибка: {ex.Message}";
                return RedirectToPage(new { id });
            }
        }

        // Также исправьте метод OnPostUpdateFieldAsync (если там есть DateTime)
        public async Task<IActionResult> OnPostUpdateFieldAsync(int id, string field, string value)
        {
            try
            {
                var userId = HttpContext.Session.GetInt32("UserId");
                if (userId == null)
                {
                    return new JsonResult(new { success = false, error = "Не авторизован" });
                }

                var request = await _context.Requests.FirstOrDefaultAsync(r => r.Id == id);
                if (request == null)
                    return new JsonResult(new { success = false, error = "Заявка не найдена" });

                string oldStatus = request.Status ?? "";

                switch (field.ToLower())
                {
                    case "title":
                        request.Title = value?.Trim();
                        break;
                    case "topic":
                        request.Topic = value?.Trim();
                        break;
                    case "product":
                        if (int.TryParse(value, out int productId))
                        {
                            request.ProductId = productId;
                        }
                        else if (string.IsNullOrEmpty(value))
                        {
                            request.ProductId = null;
                        }
                        break;
                    case "organization":
                        if (int.TryParse(value, out int orgId))
                        {
                            request.OrganizationId = orgId;
                            request.BranchId = null;
                        }
                        else if (string.IsNullOrEmpty(value))
                        {
                            request.OrganizationId = null;
                            request.BranchId = null;
                        }
                        break;
                    case "branch":
                        if (int.TryParse(value, out int branchId))
                        {
                            request.BranchId = branchId;
                        }
                        else if (string.IsNullOrEmpty(value))
                        {
                            request.BranchId = null;
                        }
                        break;
                    case "priority":
                        request.Priority = value?.Trim();
                        break;
                    case "status":
                        request.Status = value?.Trim();

                        if (oldStatus != request.Status)
                        {
                            _context.RequestStatusHistories.Add(new RequestStatusHistory
                            {
                                RequestId = id,
                                Status = request.Status ?? "",
                                ChangedAt = DateTime.UtcNow // ← ИСПРАВЛЕНО: UtcNow вместо Now
                            });
                        }
                        break;
                    case "client":
                        if (int.TryParse(value, out int clientId))
                        {
                            request.CreatedById = clientId;
                        }
                        break;
                    case "description":
                        request.Description = value?.Trim();
                        break;
                    default:
                        return new JsonResult(new { success = false, error = "Неизвестное поле" });
                }

                await _context.SaveChangesAsync();

                string displayValue = await GetDisplayValue(field, request);

                return new JsonResult(new
                {
                    success = true,
                    display = displayValue,
                    field = field
                });
            }
            catch (Exception ex)
            {
                return new JsonResult(new { success = false, error = ex.Message });
            }
        }

        private async Task<string> GetDisplayValue(string field, Request request)
        {
            switch (field.ToLower())
            {
                case "product":
                    if (request.ProductId.HasValue)
                    {
                        var product = await _context.Products
                            .FirstOrDefaultAsync(p => p.Id == request.ProductId.Value);
                        return product?.Name ?? "-";
                    }
                    return "-";
                case "organization":
                    if (request.OrganizationId.HasValue)
                    {
                        var org = await _context.Organizations
                            .FirstOrDefaultAsync(o => o.Id == request.OrganizationId.Value);
                        return org?.Name ?? "-";
                    }
                    return "-";
                case "branch":
                    if (request.BranchId.HasValue)
                    {
                        var branch = await _context.Branches
                            .FirstOrDefaultAsync(b => b.Id == request.BranchId.Value);
                        return branch?.Address ?? "-";
                    }
                    return "-";
                case "client":
                    if (request.CreatedById.HasValue)
                    {
                        var user = await _context.Users
                            .FirstOrDefaultAsync(u => u.Id == request.CreatedById.Value);
                        return user?.FullName ?? "-";
                    }
                    return "-";
                case "title":
                    return request.Title ?? "-";
                case "topic":
                    return request.Topic ?? "-";
                case "priority":
                    return request.Priority ?? "-";
                case "status":
                    return request.Status ?? "-";
                case "description":
                    return request.Description ?? "-";
                default:
                    return "-";
            }
        }

        public async Task<IActionResult> OnGetFieldDataAsync(string field, int? orgId = null, int? branchId = null)
        {
            try
            {
                object data = field.ToLower() switch
                {
                    "product" => await _context.Products
                        .Select(p => new { id = p.Id, name = p.Name })
                        .OrderBy(p => p.name)
                        .ToListAsync(),
                    "organization" => await _context.Organizations
                        .Select(o => new { id = o.Id, name = o.Name })
                        .OrderBy(o => o.name)
                        .ToListAsync(),
                    "branch" => await GetBranchesDataAsync(orgId),
                    "priority" => new[] { "Низкий", "Средний", "Высокий", "Критический" },
                    "status" => new[] { "Создана", "В работе", "Завершена", "Отменена" },
                    "client" => await GetUsersDataAsync(orgId, branchId),
                    _ => null
                };

                if (data == null)
                    return new JsonResult(new { success = false, error = "Unknown field" });

                return new JsonResult(new { success = true, data });
            }
            catch (Exception ex)
            {
                return new JsonResult(new { success = false, error = ex.Message });
            }
        }

        private async Task<List<object>> GetBranchesDataAsync(int? orgId)
        {
            var query = _context.Branches.AsQueryable();

            if (orgId.HasValue)
            {
                query = query.Where(b => b.OrganizationId == orgId);
            }

            return await query
                .Select(b => new { id = b.Id, name = b.Address })
                .OrderBy(b => b.name)
                .Cast<object>()
                .ToListAsync();
        }

        private async Task<List<object>> GetUsersDataAsync(int? orgId, int? branchId)
        {
            var query = _context.Users.AsQueryable();

            if (branchId.HasValue)
            {
                query = query.Where(u => u.UserBranches.Any(ub => ub.BranchId == branchId));
            }
            else if (orgId.HasValue)
            {
                query = query.Where(u => u.UserOrganizations.Any(uo => uo.OrganizationId == orgId));
            }

            return await query
                .Select(u => new { id = u.Id, name = u.FullName })
                .OrderBy(u => u.name)
                .Cast<object>()
                .ToListAsync();
        }
    }
}