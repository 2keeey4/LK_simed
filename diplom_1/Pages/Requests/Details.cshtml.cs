using diplom_1.Data;
using diplom_1.Models;
using diplom_1.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace diplom_1.Pages.Requests
{
    public class DetailsModel : PageModel
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _environment;
        private readonly EmailNotificationService _emailNotificationService;
        private readonly IServiceScopeFactory _scopeFactory;

        public DetailsModel(
            AppDbContext context,
            IWebHostEnvironment environment,
            EmailNotificationService emailNotificationService,
            IServiceScopeFactory scopeFactory)
        {
            _context = context;
            _environment = environment;
            _emailNotificationService = emailNotificationService;
            _scopeFactory = scopeFactory;
        }

        public new Request Request { get; set; } = null!;
        public List<Comment> Comments { get; set; } = new();
        public List<RequestStatusHistory> StatusHistory { get; set; } = new();

        public int CurrentUserId { get; set; }

        public bool CanEdit { get; set; }
        public bool CanDelete { get; set; }
        public bool CanChangeStatus { get; set; }

        public bool CanCreate { get; set; }
        public bool CanReopenStatus { get; set; }

        public bool CanAddComments { get; set; }
        public bool CanEditComments { get; set; }
        public bool CanDeleteComments { get; set; }

        public bool CanViewInternalComments { get; set; }
        public bool CanAddInternalComments { get; set; }
        public bool CanEditInternalComments { get; set; }
        public bool CanDeleteInternalComments { get; set; }

        public bool CanManageComments =>
            CanAddComments ||
            CanEditComments ||
            CanDeleteComments ||
            CanViewInternalComments ||
            CanAddInternalComments ||
            CanEditInternalComments ||
            CanDeleteInternalComments;

        public List<int> ViewOrgIds { get; set; } = new();
        public List<int> ViewBranchIds { get; set; } = new();

        public List<int> EditOrgIds { get; set; } = new();
        public List<int> EditBranchIds { get; set; } = new();

        public List<int> DeleteOrgIds { get; set; } = new();
        public List<int> DeleteBranchIds { get; set; } = new();

        public List<int> ChangeStatusOrgIds { get; set; } = new();
        public List<int> ChangeStatusBranchIds { get; set; } = new();
        public List<int> CreateOrgIds { get; set; } = new();
        public List<int> CreateBranchIds { get; set; } = new();

        public List<int> AddCommentOrgIds { get; set; } = new();

        public List<int> AddCommentBranchIds { get; set; } = new();

        public List<int> EditCommentOrgIds { get; set; } = new();
        public List<int> EditCommentBranchIds { get; set; } = new();

        public List<int> DeleteCommentOrgIds { get; set; } = new();
        public List<int> DeleteCommentBranchIds { get; set; } = new();

        public List<int> ViewInternalCommentOrgIds { get; set; } = new();
        public List<int> ViewInternalCommentBranchIds { get; set; } = new();

        public List<int> AddInternalCommentOrgIds { get; set; } = new();
        public List<int> AddInternalCommentBranchIds { get; set; } = new();

        public List<int> EditInternalCommentOrgIds { get; set; } = new();
        public List<int> EditInternalCommentBranchIds { get; set; } = new();

        public List<int> DeleteInternalCommentOrgIds { get; set; } = new();
        public List<int> DeleteInternalCommentBranchIds { get; set; } = new();

        [BindProperty]
        public string NewCommentContent { get; set; } = "";

        [BindProperty]
        public bool IsInternal { get; set; }

        [BindProperty]
        public List<IFormFile> UploadFiles { get; set; } = new();

        public async Task<IActionResult> OnGetAsync(int id)
        {
            int userId = HttpContext.Session.GetInt32("UserId") ?? 0;
            CurrentUserId = userId;

            if (userId == 0)
            {
                return RedirectToPage("/Login");
            }

            await LoadPermissionsAsync(userId);

            var request = await GetRequestQuery()
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
            {
                return NotFound();
            }

            FillPageFlags(request);

            if (!CanViewRequest(request, userId))
            {
                return Forbid();
            }

            Request = request;

            await LoadDetailsListsAsync(id);

            return Page();
        }

        public async Task<IActionResult> OnPostAddCommentAsync(int id)
        {
            int userId = HttpContext.Session.GetInt32("UserId") ?? 0;
            CurrentUserId = userId;

            if (userId == 0)
            {
                if (IsAjaxRequest())
                {
                    return JsonFail("Пользователь не авторизован");
                }

                TempData["ErrorMessage"] = "Пользователь не авторизован";
                return RedirectToPage(new { id });
            }

            await LoadPermissionsAsync(userId);

            var request = await _context.Requests
                .Include(r => r.RequestTopic)
                .Include(r => r.RequestPriority)
                .Include(r => r.RequestStatus)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
            {
                if (IsAjaxRequest())
                {
                    return JsonFail("Заявка не найдена");
                }

                TempData["ErrorMessage"] = "Заявка не найдена";
                return RedirectToPage("/Requests/Requests");
            }

            FillPageFlags(request);

            if (!CanViewRequest(request, userId))
            {
                if (IsAjaxRequest())
                {
                    return JsonFail("Нет доступа к заявке");
                }

                TempData["ErrorMessage"] = "Нет доступа к заявке";
                return RedirectToPage("/Requests/Requests");
            }

            if (IsInternal)
            {
                if (!CanAddInternalComments)
                {
                    if (IsAjaxRequest())
                    {
                        return JsonFail("Нет права добавлять внутренние комментарии");
                    }

                    TempData["ErrorMessage"] = "Нет права добавлять внутренние комментарии";
                    return RedirectToPage(new { id });
                }
            }
            else
            {
                if (!CanAddComments)
                {
                    if (IsAjaxRequest())
                    {
                        return JsonFail("Нет права добавлять комментарии к этой заявке");
                    }

                    TempData["ErrorMessage"] = "Нет права добавлять комментарии к этой заявке";
                    return RedirectToPage(new { id });
                }
            }

            bool hasText = !string.IsNullOrWhiteSpace(NewCommentContent);
            bool hasFiles = UploadFiles != null && UploadFiles.Any(f => f != null && f.Length > 0);

            if (!hasText && !hasFiles)
            {
                if (IsAjaxRequest())
                {
                    return JsonFail("Введите комментарий или прикрепите файл");
                }

                TempData["ErrorMessage"] = "Введите комментарий или прикрепите файл";
                return RedirectToPage(new { id });
            }

            var comment = new Comment
            {
                RequestId = id,
                AuthorId = userId,
                Content = NewCommentContent?.Trim() ?? "",
                IsInternal = IsInternal,
                CreatedAt = DateTime.UtcNow
            };

            _context.Comments.Add(comment);
            await _context.SaveChangesAsync();

            if (hasFiles)
            {
                await SaveCommentFilesAsync(comment.Id, UploadFiles ?? new List<IFormFile>());
                await _context.SaveChangesAsync();
            }

            var savedComment = await _context.Comments
                .AsNoTracking()
                .Include(c => c.Author)
                .Include(c => c.Attachments)
                .FirstOrDefaultAsync(c => c.Id == comment.Id);

            try
            {
                await _emailNotificationService.NotifyCommentAddedAsync(
                    request.Id,
                    comment.Id,
                    null
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка отправки уведомления о комментарии: {ex.Message}");
            }

            if (IsAjaxRequest())
            {
                return new JsonResult(new
                {
                    success = true,
                    message = "Комментарий добавлен",
                    comment = new
                    {
                        id = savedComment?.Id ?? comment.Id,
                        content = savedComment?.Content ?? comment.Content,
                        isInternal = savedComment?.IsInternal ?? comment.IsInternal,
                        authorId = savedComment?.AuthorId ?? userId,
                        authorName = savedComment?.Author?.FullName ?? "Пользователь",
                        createdAt = (savedComment?.CreatedAt ?? comment.CreatedAt)
                            .ToLocalTime()
                            .ToString("dd.MM.yyyy HH:mm"),
                        attachments = savedComment?.Attachments?
                            .Select(a => new
                            {
                                id = a.Id,
                                filePath = a.FilePath,
                                fileName = Path.GetFileName(a.FilePath)
                            })
                            .ToList()
                    }
                });
            }

            TempData["SuccessMessage"] = "Комментарий добавлен";
            return RedirectToPage(new { id });
        }

        public async Task<IActionResult> OnPostUpdateCommentAsync(int id, int commentId, string content, bool isInternal)
        {
            int userId = HttpContext.Session.GetInt32("UserId") ?? 0;
            CurrentUserId = userId;

            if (userId == 0)
            {
                return JsonFail("Пользователь не авторизован");
            }

            await LoadPermissionsAsync(userId);

            var request = await _context.Requests
                .Include(r => r.RequestTopic)
                .Include(r => r.RequestPriority)
                .Include(r => r.RequestStatus)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
            {
                return JsonFail("Заявка не найдена");
            }

            FillPageFlags(request);

            if (!CanViewRequest(request, userId))
            {
                return JsonFail("Нет доступа к заявке");
            }

            var comment = await _context.Comments
                .FirstOrDefaultAsync(c => c.Id == commentId && c.RequestId == id);

            if (comment == null)
            {
                return JsonFail("Комментарий не найден");
            }

            if (comment.AuthorId != userId)
            {
                return JsonFail("Можно редактировать только свои комментарии");
            }

            if (comment.IsInternal && !CanViewInternalComments)
            {
                return JsonFail("Нет доступа к внутреннему комментарию");
            }

            if (comment.IsInternal)
            {
                if (!CanEditInternalComments)
                {
                    return JsonFail("Нет права редактировать внутренние комментарии");
                }
            }
            else
            {
                if (!CanEditComments)
                {
                    return JsonFail("Нет права редактировать комментарии");
                }
            }

            if (isInternal && !comment.IsInternal && !CanAddInternalComments)
            {
                return JsonFail("Нет права делать комментарий внутренним");
            }

            if (!isInternal && comment.IsInternal && !CanEditInternalComments)
            {
                return JsonFail("Нет права изменять внутренний комментарий");
            }

            string oldContent = comment.Content ?? "";
            bool oldIsInternal = comment.IsInternal;
            string newContent = content?.Trim() ?? "";

            if (string.IsNullOrWhiteSpace(newContent))
            {
                return JsonFail("Комментарий не может быть пустым");
            }

            if (newContent.Length > 2000)
            {
                return JsonFail("Комментарий слишком длинный");
            }

            comment.Content = newContent;
            comment.IsInternal = isInternal;

            await _context.SaveChangesAsync();

            int?[] recipients = Array.Empty<int?>();

            try
            {
                recipients = await GetNotificationRecipientIdsAsync(
                    request.Id,
                    includeInternalCommentViewers: comment.IsInternal || oldIsInternal,
                    request.CreatedById
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка подготовки получателей уведомления об изменении комментария: {ex.Message}");
            }

            SendRequestNotificationInBackground(
                request.Id,
                $"Комментарий изменён в заявке #{request.Id}",
                $"В заявке «{request.Title}» был изменён комментарий.\n\n" +
                $"Было:\n{oldContent}\n\n" +
                $"Стало:\n{comment.Content}",
                recipients,
                userId
            );

            return new JsonResult(new
            {
                success = true,
                content = comment.Content,
                isInternal = comment.IsInternal
            });
        }

        public async Task<IActionResult> OnPostDeleteCommentAsync(int id, int commentId)
        {
            int userId = HttpContext.Session.GetInt32("UserId") ?? 0;
            CurrentUserId = userId;

            if (userId == 0)
            {
                return JsonFail("Пользователь не авторизован");
            }

            await LoadPermissionsAsync(userId);

            var request = await _context.Requests
                .Include(r => r.RequestTopic)
                .Include(r => r.RequestPriority)
                .Include(r => r.RequestStatus)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
            {
                return JsonFail("Заявка не найдена");
            }

            FillPageFlags(request);

            if (!CanViewRequest(request, userId))
            {
                return JsonFail("Нет доступа к заявке");
            }

            var comment = await _context.Comments
                .Include(c => c.Attachments)
                .FirstOrDefaultAsync(c => c.Id == commentId && c.RequestId == id);

            if (comment == null)
            {
                return JsonFail("Комментарий не найден");
            }

            if (comment.AuthorId != userId)
            {
                return JsonFail("Можно удалять только свои комментарии");
            }

            if (comment.IsInternal)
            {
                if (!CanViewInternalComments)
                {
                    return JsonFail("Нет доступа к внутреннему комментарию");
                }

                if (!CanDeleteInternalComments)
                {
                    return JsonFail("Нет права удалять внутренние комментарии");
                }
            }
            else
            {
                if (!CanDeleteComments)
                {
                    return JsonFail("Нет права удалять комментарии");
                }
            }

            string deletedCommentText = comment.Content ?? "";
            bool deletedCommentWasInternal = comment.IsInternal;

            if (comment.Attachments != null && comment.Attachments.Any())
            {
                foreach (var attachment in comment.Attachments)
                {
                    DeletePhysicalFile(attachment.FilePath);
                }

                _context.Attachments.RemoveRange(comment.Attachments);
            }

            _context.Comments.Remove(comment);
            await _context.SaveChangesAsync();

            int?[] recipients = Array.Empty<int?>();

            try
            {
                recipients = await GetNotificationRecipientIdsAsync(
                    request.Id,
                    includeInternalCommentViewers: deletedCommentWasInternal,
                    request.CreatedById
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка подготовки получателей уведомления об удалении комментария: {ex.Message}");
            }

            SendRequestNotificationInBackground(
                request.Id,
                $"Комментарий удалён из заявки #{request.Id}",
                $"Из заявки «{request.Title}» был удалён комментарий.\n\n" +
                $"Удалённый комментарий:\n{deletedCommentText}",
                recipients,
                userId
            );

            return new JsonResult(new
            {
                success = true
            });
        }

        public async Task<IActionResult> OnPostDeleteRequestAsync(int id)
        {
            int userId = HttpContext.Session.GetInt32("UserId") ?? 0;
            CurrentUserId = userId;

            if (userId == 0)
            {
                return JsonFail("Пользователь не авторизован");
            }

            await LoadPermissionsAsync(userId);

            var request = await _context.Requests
                .Include(r => r.RequestTopic)
                .Include(r => r.RequestPriority)
                .Include(r => r.RequestStatus)
                .Include(r => r.Attachments)
                .Include(r => r.Comments)
                    .ThenInclude(c => c.Attachments)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
            {
                return JsonFail("Заявка не найдена");
            }

            FillPageFlags(request);

            if (!CanViewRequest(request, userId))
            {
                return JsonFail("Нет доступа к заявке");
            }

            if (!CanDelete)
            {
                return JsonFail("Нет права удалить эту заявку");
            }

            int deletedRequestId = request.Id;
            string deletedRequestTitle = request.Title ?? "";
            int? requestCreatorId = request.CreatedById;

            int?[] notificationRecipients = Array.Empty<int?>();

            try
            {
                notificationRecipients = await GetNotificationRecipientIdsAsync(
                    deletedRequestId,
                    includeInternalCommentViewers: false,
                    requestCreatorId
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка подготовки получателей уведомления об удалении заявки: {ex.Message}");
            }

            var requestAttachments = request.Attachments?.ToList() ?? new List<Attachment>();
            var comments = request.Comments?.ToList() ?? new List<Comment>();
            var commentAttachments = comments
                .Where(c => c.Attachments != null)
                .SelectMany(c => c.Attachments!)
                .ToList();

            foreach (var attachment in requestAttachments.Concat(commentAttachments))
            {
                DeletePhysicalFile(attachment.FilePath);
            }

            var history = await _context.RequestStatusHistories
                .Where(h => h.RequestId == id)
                .ToListAsync();

            if (history.Any())
            {
                _context.RequestStatusHistories.RemoveRange(history);
            }

            if (commentAttachments.Any())
            {
                _context.Attachments.RemoveRange(commentAttachments);
            }

            if (requestAttachments.Any())
            {
                _context.Attachments.RemoveRange(requestAttachments);
            }

            if (comments.Any())
            {
                _context.Comments.RemoveRange(comments);
            }

            _context.Requests.Remove(request);
            await _context.SaveChangesAsync();

            SendRequestNotificationInBackground(
                deletedRequestId,
                $"Заявка #{deletedRequestId} удалена",
                $"Заявка «{deletedRequestTitle}» была удалена.",
                notificationRecipients,
                userId
            );

            return new JsonResult(new
            {
                success = true,
                redirectUrl = "/Requests/Requests"
            });
        }
        public async Task<IActionResult> OnPostUpdateFieldAsync(int id, string field, string value)
        {
            int userId = HttpContext.Session.GetInt32("UserId") ?? 0;
            CurrentUserId = userId;

            if (userId == 0)
            {
                return JsonFail("Пользователь не авторизован");
            }

            await LoadPermissionsAsync(userId);

            var request = await GetRequestQuery()
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
            {
                return JsonFail("Заявка не найдена");
            }

            FillPageFlags(request);

            if (!CanViewRequest(request, userId))
            {
                return JsonFail("Нет доступа к заявке");
            }

            string normalizedField = (field ?? "").Trim().ToLowerInvariant();
            string newValue = value?.Trim() ?? "";

            if (normalizedField == "status")
            {
                if (!CanChangeStatus && !CanReopenStatus)
                {
                    return JsonFail("Нет права изменять статус этой заявки");
                }
            }
            else
            {
                if (!CanEdit)
                {
                    return JsonFail("Нет права редактировать эту заявку");
                }
            }

            int oldStatusId = request.RequestStatusId;
            string oldDisplayValue = await GetDisplayValueAsync(request, normalizedField);

            var updateResult = await ApplyFieldUpdateAsync(request, normalizedField, newValue);

            if (!updateResult.Success)
            {
                return JsonFail(updateResult.Error);
            }

            bool statusChanged =
                normalizedField == "status" &&
                oldStatusId != request.RequestStatusId;

            RequestStatusHistory? newHistoryItem = null;

            if (statusChanged)
            {
                newHistoryItem = new RequestStatusHistory
                {
                    RequestId = request.Id,
                    RequestStatusId = request.RequestStatusId,
                    ChangedById = userId,
                    ChangedAt = DateTime.UtcNow
                };

                _context.RequestStatusHistories.Add(newHistoryItem);
            }

            await _context.SaveChangesAsync();

            request = await GetRequestQuery()
                .FirstAsync(r => r.Id == id);

            string newDisplayValue = await GetDisplayValueAsync(request, normalizedField);

            if (oldDisplayValue != newDisplayValue)
            {
                string fieldName = normalizedField switch
                {
                    "title" => "Название",
                    "description" => "Описание",
                    "topic" => "Тема",
                    "priority" => "Приоритет",
                    "status" => "Статус",
                    "organization" => "Организация",
                    "branch" => "Филиал",
                    "product" => "Продукт",
                    "client" => "Клиент",
                    _ => normalizedField
                };

                string changeText =
                    $"Изменено поле: {fieldName}\n\n" +
                    $"Было: {oldDisplayValue}\n" +
                    $"Стало: {newDisplayValue}";

                try
                {
                    await _emailNotificationService.NotifyRequestChangedAsync(
                        request.Id,
                        changeText,
                        null
                    );
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Ошибка отправки уведомления об изменении заявки: {ex.Message}");
                }
            }

            string displayValue = await GetDisplayValueAsync(request, normalizedField);

            string statusName = request.RequestStatus?.Name ?? "";
            string priorityName = request.RequestPriority?.Name ?? "";

            return new JsonResult(new
            {
                success = true,
                field = normalizedField,
                value = GetStoredValue(request, normalizedField),
                display = displayValue,
                organizationId = request.OrganizationId,
                branchId = request.BranchId,
                productId = request.ProductId,
                clientId = request.CreatedById,
                statusClass = ToCssPart(statusName),
                priorityClass = ToCssPart(priorityName),
                historyItem = newHistoryItem == null
                    ? null
                    : new
                    {
                        status = statusName,
                        statusClass = ToCssPart(statusName),
                        changedBy = "Вы",
                        changedAt = newHistoryItem.ChangedAt.ToLocalTime().ToString("dd.MM.yyyy HH:mm")
                    }
            });
        }

        public async Task<IActionResult> OnGetFieldDataAsync(int id, string field, int? orgId = null, int? branchId = null)
        {
            int userId = HttpContext.Session.GetInt32("UserId") ?? 0;
            CurrentUserId = userId;

            if (userId == 0)
            {
                return JsonFail("Пользователь не авторизован");
            }

            await LoadPermissionsAsync(userId);

            var request = await GetRequestQuery()
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
            {
                return JsonFail("Заявка не найдена");
            }

            FillPageFlags(request);

            if (!CanViewRequest(request, userId))
            {
                return JsonFail("Нет доступа к заявке");
            }

            string normalizedField = (field ?? "").Trim().ToLowerInvariant();

            if (normalizedField == "status")
            {
                if (!CanChangeStatus && !CanReopenStatus)
                {
                    return JsonFail("Нет права изменять статус этой заявки");
                }
            }
            else
            {
                if (!CanEdit)
                {
                    return JsonFail("Нет права редактировать эту заявку");
                }
            }

            object data;

            switch (normalizedField)
            {
                case "topic":
                    data = await _context.RequestTopics
                        .OrderBy(t => t.Name)
                        .Select(t => new
                        {
                            id = t.Id,
                            name = t.Name
                        })
                        .ToListAsync();
                    break;

                case "priority":
                    data = await _context.RequestPriorities
                        .OrderBy(p => p.Id)
                        .Select(p => new
                        {
                            id = p.Id,
                            name = p.Name
                        })
                        .ToListAsync();
                    break;

                case "status":
                    var allowedStatusNames = GetAllowedStatuses(
    request.RequestStatus?.Name,
    CanChangeStatus,
    CanReopenStatus
);

                    data = await _context.RequestStatuses
                        .Where(s => allowedStatusNames.Contains(s.Name))
                        .OrderBy(s => s.Id)
                        .Select(s => new
                        {
                            id = s.Id,
                            name = s.Name
                        })
                        .ToListAsync();
                    break;

                case "organization":
                    data = await GetOrganizationsForEditAsync();
                    break;

                case "branch":
                    data = await GetBranchesForEditAsync(orgId ?? request.OrganizationId);
                    break;

                case "product":
                    data = await GetProductsForEditAsync(orgId ?? request.OrganizationId);
                    break;

                case "client":
                    data = await GetUsersForEditAsync(
                        orgId ?? request.OrganizationId,
                        branchId ?? request.BranchId
                    );
                    break;

                default:
                    return JsonFail("Неизвестное поле");
            }

            return new JsonResult(new
            {
                success = true,
                data
            });
        }

        private async Task<int?[]> GetNotificationRecipientIdsAsync(
            int requestId,
            bool includeInternalCommentViewers,
            params int?[] extraUserIds)
        {
            var recipients = await _emailNotificationService.GetRequestRecipientIdsAsync(
                requestId,
                actorUserId: null,
                includeCreator: true,
                includeViewers: true,
                includeCommentAuthors: true,
                includeInternalCommentViewers: includeInternalCommentViewers
            );

            return recipients
                .Select(id => (int?)id)
                .Concat(extraUserIds ?? Array.Empty<int?>())
                .Where(id => id.HasValue && id.Value > 0)
                .Distinct()
                .ToArray();
        }

        private void SendRequestNotificationInBackground(
            int requestId,
            string subject,
            string message,
            IEnumerable<int?> userIds,
            int? actorUserId)
        {
            var recipientIds = userIds?
                .Where(id => id.HasValue && id.Value > 0)
                .Select(id => id!.Value)
                .Distinct()
                .ToList() ?? new List<int>();

            if (!recipientIds.Any())
            {
                return;
            }

            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();

                    var notificationService = scope.ServiceProvider
                        .GetRequiredService<EmailNotificationService>();

                    await notificationService.SendRequestNotificationAsync(
                        requestId,
                        subject,
                        message,
                        recipientIds,
                        actorUserId
                    );
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Ошибка фоновой отправки уведомления: {ex.Message}");
                }
            });
        }

        private void FillPageFlags(Request request)
        {
            CanEdit = CanEditRequestInScope(request);
            CanDelete = CanDeleteRequestInScope(request);
            CanChangeStatus = CanChangeStatusInScope(request);

            CanCreate = CanCreateRequestInScope(request);

            var currentStatus = request.RequestStatus?.Name ?? "";
            CanReopenStatus =
                CanCreate &&
                (currentStatus == "Завершена" || currentStatus == "Отменена");

            CanAddComments = CanAddCommentsInScope(request);
            CanEditComments = CanEditCommentsInScope(request);
            CanDeleteComments = CanDeleteCommentsInScope(request);

            CanViewInternalComments = CanViewInternalCommentsInScope(request);
            CanAddInternalComments = CanAddInternalCommentsInScope(request);
            CanEditInternalComments = CanEditInternalCommentsInScope(request);
            CanDeleteInternalComments = CanDeleteInternalCommentsInScope(request);
        }

        private async Task LoadDetailsListsAsync(int id)
        {
            var query = _context.Comments
                .Include(c => c.Author)
                .Include(c => c.Attachments)
                .Where(c => c.RequestId == id);

            if (!CanViewInternalComments)
            {
                query = query.Where(c => !c.IsInternal || c.AuthorId == CurrentUserId);
            }

            Comments = await query
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();

            StatusHistory = await _context.RequestStatusHistories
                .Include(h => h.RequestStatus)
                .Include(h => h.ChangedBy)
                .Where(h => h.RequestId == id)
                .OrderByDescending(h => h.ChangedAt)
                .ToListAsync();
        }

        private async Task LoadPermissionsAsync(int userId)
        {
            var userPermissions = await _context.UserPermissions
                .Include(up => up.Permission)
                .Where(up => up.UserId == userId)
                .ToListAsync();

            var taskPermissions = userPermissions
                .Where(up => ActionIsModule(up, "Задачи"))
                .ToList();

            ViewOrgIds = GetOrgIds(taskPermissions, IsViewRequestPermission);
            ViewBranchIds = GetBranchIds(taskPermissions, IsViewRequestPermission);

            EditOrgIds = GetOrgIds(taskPermissions, IsEditRequestPermission);
            EditBranchIds = GetBranchIds(taskPermissions, IsEditRequestPermission);

            DeleteOrgIds = GetOrgIds(taskPermissions, IsDeleteRequestPermission);
            DeleteBranchIds = GetBranchIds(taskPermissions, IsDeleteRequestPermission);

            ChangeStatusOrgIds = GetOrgIds(taskPermissions, IsChangeStatusPermission);
            ChangeStatusBranchIds = GetBranchIds(taskPermissions, IsChangeStatusPermission);

            CreateOrgIds = GetOrgIds(taskPermissions, IsCreateRequestPermission);
            CreateBranchIds = GetBranchIds(taskPermissions, IsCreateRequestPermission);

            AddCommentOrgIds = GetOrgIds(taskPermissions, IsAddCommentPermission);
            AddCommentBranchIds = GetBranchIds(taskPermissions, IsAddCommentPermission);

            EditCommentOrgIds = GetOrgIds(taskPermissions, IsEditCommentPermission);
            EditCommentBranchIds = GetBranchIds(taskPermissions, IsEditCommentPermission);

            DeleteCommentOrgIds = GetOrgIds(taskPermissions, IsDeleteCommentPermission);
            DeleteCommentBranchIds = GetBranchIds(taskPermissions, IsDeleteCommentPermission);

            ViewInternalCommentOrgIds = GetOrgIds(taskPermissions, IsViewInternalCommentPermission);
            ViewInternalCommentBranchIds = GetBranchIds(taskPermissions, IsViewInternalCommentPermission);

            AddInternalCommentOrgIds = GetOrgIds(taskPermissions, IsAddInternalCommentPermission);
            AddInternalCommentBranchIds = GetBranchIds(taskPermissions, IsAddInternalCommentPermission);

            EditInternalCommentOrgIds = GetOrgIds(taskPermissions, IsEditInternalCommentPermission);
            EditInternalCommentBranchIds = GetBranchIds(taskPermissions, IsEditInternalCommentPermission);

            DeleteInternalCommentOrgIds = GetOrgIds(taskPermissions, IsDeleteInternalCommentPermission);
            DeleteInternalCommentBranchIds = GetBranchIds(taskPermissions, IsDeleteInternalCommentPermission);
        }

        private static List<int> GetOrgIds(List<UserPermission> permissions, Func<UserPermission, bool> predicate)
        {
            return permissions
                .Where(up => predicate(up) && up.OrganizationId != null)
                .Select(up => up.OrganizationId!.Value)
                .Distinct()
                .ToList();
        }

        private static List<int> GetBranchIds(List<UserPermission> permissions, Func<UserPermission, bool> predicate)
        {
            return permissions
                .Where(up => predicate(up) && up.BranchId != null)
                .Select(up => up.BranchId!.Value)
                .Distinct()
                .ToList();
        }

        private static bool ActionIsModule(UserPermission up, string module)
        {
            return string.Equals(
                up.Permission.Module?.Trim(),
                module,
                StringComparison.OrdinalIgnoreCase
            );
        }

        private static bool ActionIs(UserPermission up, string action)
        {
            return string.Equals(
                up.Permission.Action?.Trim(),
                action,
                StringComparison.OrdinalIgnoreCase
            );
        }
        private static bool ActionContains(UserPermission up, string actionPart)
        {
            return (up.Permission.Action ?? "")
                .Contains(actionPart, StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsViewRequestPermission(UserPermission up) => ActionIs(up, "Просмотр");
        private static bool IsEditRequestPermission(UserPermission up) => ActionIs(up, "Редактирование");
        private static bool IsDeleteRequestPermission(UserPermission up) => ActionIs(up, "Удаление");
        private static bool IsChangeStatusPermission(UserPermission up) => ActionIs(up, "Изменение статуса");
        private static bool IsCreateRequestPermission(UserPermission up) => ActionContains(up, "Добавление");

        private static bool IsAddCommentPermission(UserPermission up) => ActionIs(up, "Добавление внешних комментариев");
        private static bool IsEditCommentPermission(UserPermission up) => ActionIs(up, "Редактирование внешних комментариев");
        private static bool IsDeleteCommentPermission(UserPermission up) => ActionIs(up, "Удаление внешних комментариев");

        private static bool IsViewInternalCommentPermission(UserPermission up) => ActionIs(up, "Просмотр внутренних комментариев");
        private static bool IsAddInternalCommentPermission(UserPermission up) => ActionIs(up, "Добавление внутренних комментариев");
        private static bool IsEditInternalCommentPermission(UserPermission up) => ActionIs(up, "Редактирование внутренних комментариев");
        private static bool IsDeleteInternalCommentPermission(UserPermission up) => ActionIs(up, "Удаление внутренних комментариев");

        private IQueryable<Request> GetRequestQuery()
        {
            return _context.Requests
                .Include(r => r.Product)
                .Include(r => r.Organization)
                .Include(r => r.Branch)
                .Include(r => r.CreatedBy)
                .Include(r => r.Attachments)
                .Include(r => r.RequestTopic)
                .Include(r => r.RequestPriority)
                .Include(r => r.RequestStatus);
        }

        private bool CanViewRequest(Request request, int userId)
        {
            if (request.CreatedById == userId)
            {
                return true;
            }

            return IsInScope(request, ViewOrgIds, ViewBranchIds);
        }

        private bool CanEditRequestInScope(Request request) => IsInScope(request, EditOrgIds, EditBranchIds);
        private bool CanDeleteRequestInScope(Request request) => IsInScope(request, DeleteOrgIds, DeleteBranchIds);
        private bool CanChangeStatusInScope(Request request) => IsInScope(request, ChangeStatusOrgIds, ChangeStatusBranchIds);
        private bool CanCreateRequestInScope(Request request) => IsInScope(request, CreateOrgIds, CreateBranchIds);

        private bool CanAddCommentsInScope(Request request) => IsInScope(request, AddCommentOrgIds, AddCommentBranchIds);
        private bool CanEditCommentsInScope(Request request) => IsInScope(request, EditCommentOrgIds, EditCommentBranchIds);
        private bool CanDeleteCommentsInScope(Request request) => IsInScope(request, DeleteCommentOrgIds, DeleteCommentBranchIds);

        private bool CanViewInternalCommentsInScope(Request request) => IsInScope(request, ViewInternalCommentOrgIds, ViewInternalCommentBranchIds);
        private bool CanAddInternalCommentsInScope(Request request) => IsInScope(request, AddInternalCommentOrgIds, AddInternalCommentBranchIds);
        private bool CanEditInternalCommentsInScope(Request request) => IsInScope(request, EditInternalCommentOrgIds, EditInternalCommentBranchIds);
        private bool CanDeleteInternalCommentsInScope(Request request) => IsInScope(request, DeleteInternalCommentOrgIds, DeleteInternalCommentBranchIds);

        private static bool IsInScope(Request request, List<int> orgIds, List<int> branchIds)
        {
            if (request.OrganizationId.HasValue && orgIds.Contains(request.OrganizationId.Value))
            {
                return true;
            }

            if (request.BranchId.HasValue && branchIds.Contains(request.BranchId.Value))
            {
                return true;
            }

            return false;
        }
                private async Task<FieldUpdateResult> ApplyFieldUpdateAsync(Request request, string field, string value)
        {
            switch (field)
            {
                case "title":
                    if (string.IsNullOrWhiteSpace(value))
                    {
                        return FieldUpdateResult.Fail("Заголовок не может быть пустым");
                    }

                    if (value.Length > 150)
                    {
                        return FieldUpdateResult.Fail("Заголовок слишком длинный");
                    }

                    request.Title = value;
                    return FieldUpdateResult.Ok();

                case "description":
                    if (value.Length > 2000)
                    {
                        return FieldUpdateResult.Fail("Описание слишком длинное");
                    }

                    request.Description = value;
                    return FieldUpdateResult.Ok();

                case "topic":
                    return await UpdateTopicAsync(request, value);

                case "priority":
                    return await UpdatePriorityAsync(request, value);

                case "status":
                    return await UpdateStatusAsync(request, value);

                case "organization":
                    return await UpdateOrganizationAsync(request, value);

                case "branch":
                    return await UpdateBranchAsync(request, value);

                case "product":
                    return await UpdateProductAsync(request, value);

                case "client":
                    return await UpdateClientAsync(request, value);

                default:
                    return FieldUpdateResult.Fail("Неизвестное поле");
            }
        }

        private async Task<FieldUpdateResult> UpdateTopicAsync(Request request, string value)
        {
            if (!int.TryParse(value, out int topicId))
            {
                return FieldUpdateResult.Fail("Некорректная тема");
            }

            var topic = await _context.RequestTopics
                .FirstOrDefaultAsync(t => t.Id == topicId);

            if (topic == null)
            {
                return FieldUpdateResult.Fail("Тема не найдена");
            }

            request.RequestTopicId = topicId;
            request.RequestTopic = topic;

            return FieldUpdateResult.Ok();
        }

        private async Task<FieldUpdateResult> UpdatePriorityAsync(Request request, string value)
        {
            if (!int.TryParse(value, out int priorityId))
            {
                return FieldUpdateResult.Fail("Некорректный приоритет");
            }

            var priority = await _context.RequestPriorities
                .FirstOrDefaultAsync(p => p.Id == priorityId);

            if (priority == null)
            {
                return FieldUpdateResult.Fail("Приоритет не найден");
            }

            request.RequestPriorityId = priorityId;
            request.RequestPriority = priority;

            return FieldUpdateResult.Ok();
        }

        private async Task<FieldUpdateResult> UpdateStatusAsync(Request request, string value)
        {
            if (!int.TryParse(value, out int statusId))
            {
                return FieldUpdateResult.Fail("Некорректный статус");
            }

            var newStatus = await _context.RequestStatuses
                .FirstOrDefaultAsync(s => s.Id == statusId);

            if (newStatus == null)
            {
                return FieldUpdateResult.Fail("Статус не найден");
            }

            string currentStatus = request.RequestStatus?.Name ?? "";

            if (request.RequestStatusId == statusId)
            {
                return FieldUpdateResult.Ok();
            }

            var allowedStatuses = GetAllowedStatuses(
    currentStatus,
    CanChangeStatus,
    CanReopenStatus
);

            if (!allowedStatuses.Contains(newStatus.Name))
            {
                return FieldUpdateResult.Fail($"Нельзя изменить статус с «{currentStatus}» на «{newStatus.Name}»");
            }

            request.RequestStatusId = statusId;
            request.RequestStatus = newStatus;

            return FieldUpdateResult.Ok();
        }

        private List<string> GetAllowedStatuses(
    string? currentStatus,
    bool canChangeStatus,
    bool canReopenStatus)
        {
            string status = currentStatus ?? "";

            if (canChangeStatus)
            {
                return status switch
                {
                    "Создана" => new List<string>
            {
                "Создана",
                "В работе",
                "Отменена"
            },

                    "В работе" => new List<string>
            {
                "В работе",
                "Уточнение",
                "Ожидание",
                "Завершена",
                "Отменена"
            },

                    "Уточнение" => new List<string>
            {
                "Уточнение",
                "В работе",
                "Ожидание",
                "Отменена"
            },

                    "Ожидание" => new List<string>
            {
                "Ожидание",
                "В работе",
                "Уточнение",
                "Отменена"
            },

                    "Завершена" => new List<string>
            {
                "Завершена",
                "Создана"
            },

                    "Отменена" => new List<string>
            {
                "Отменена",
                "Создана"
            },

                    _ => new List<string>
            {
                status
            }
                };
            }

            if (canReopenStatus)
            {
                return status switch
                {
                    "Завершена" => new List<string>
            {
                "Завершена",
                "Создана"
            },

                    "Отменена" => new List<string>
            {
                "Отменена",
                "Создана"
            },

                    _ => new List<string>
            {
                status
            }
                };
            }

            return new List<string>
    {
        status
    };
        }

        private async Task<FieldUpdateResult> UpdateOrganizationAsync(Request request, string value)
        {
            if (!int.TryParse(value, out int organizationId))
            {
                return FieldUpdateResult.Fail("Выберите организацию");
            }

            var organizationExists = await _context.Organizations
                .AnyAsync(o => o.Id == organizationId);

            if (!organizationExists)
            {
                return FieldUpdateResult.Fail("Организация не найдена");
            }

            if (!EditOrgIds.Contains(organizationId))
            {
                return FieldUpdateResult.Fail("Нет права выбрать эту организацию");
            }

            request.OrganizationId = organizationId;
            request.BranchId = null;
            request.CreatedById = null;

            if (request.ProductId.HasValue)
            {
                bool orgHasProducts = await _context.OrganizationProducts
                    .AnyAsync(op => op.OrganizationId == organizationId);

                if (orgHasProducts)
                {
                    bool productAllowed = await _context.OrganizationProducts
                        .AnyAsync(op =>
                            op.OrganizationId == organizationId &&
                            op.ProductId == request.ProductId.Value);

                    if (!productAllowed)
                    {
                        request.ProductId = null;
                    }
                }
            }

            return FieldUpdateResult.Ok();
        }

        private async Task<FieldUpdateResult> UpdateBranchAsync(Request request, string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                request.BranchId = null;
                request.CreatedById = null;
                return FieldUpdateResult.Ok();
            }

            if (!int.TryParse(value, out int branchId))
            {
                return FieldUpdateResult.Fail("Некорректный филиал");
            }

            var branch = await _context.Branches
                .FirstOrDefaultAsync(b => b.Id == branchId);

            if (branch == null)
            {
                return FieldUpdateResult.Fail("Филиал не найден");
            }

            if (request.OrganizationId.HasValue && branch.OrganizationId != request.OrganizationId.Value)
            {
                return FieldUpdateResult.Fail("Филиал не относится к выбранной организации");
            }

            bool canSelectBranch =
                EditBranchIds.Contains(branchId) ||
                EditOrgIds.Contains(branch.OrganizationId);

            if (!canSelectBranch)
            {
                return FieldUpdateResult.Fail("Нет права выбрать этот филиал");
            }

            request.BranchId = branchId;
            request.CreatedById = null;

            return FieldUpdateResult.Ok();
        }

        private async Task<FieldUpdateResult> UpdateProductAsync(Request request, string value)
        {
            if (!int.TryParse(value, out int productId))
            {
                return FieldUpdateResult.Fail("Выберите продукт");
            }

            var productExists = await _context.Products
                .AnyAsync(p => p.Id == productId);

            if (!productExists)
            {
                return FieldUpdateResult.Fail("Продукт не найден");
            }

            if (request.OrganizationId.HasValue)
            {
                bool orgHasProducts = await _context.OrganizationProducts
                    .AnyAsync(op => op.OrganizationId == request.OrganizationId.Value);

                if (orgHasProducts)
                {
                    bool productAllowed = await _context.OrganizationProducts
                        .AnyAsync(op =>
                            op.OrganizationId == request.OrganizationId.Value &&
                            op.ProductId == productId);

                    if (!productAllowed)
                    {
                        return FieldUpdateResult.Fail("Продукт не привязан к выбранной организации");
                    }
                }
            }

            request.ProductId = productId;
            return FieldUpdateResult.Ok();
        }

        private async Task<FieldUpdateResult> UpdateClientAsync(Request request, string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                request.CreatedById = null;
                return FieldUpdateResult.Ok();
            }

            if (!int.TryParse(value, out int userId))
            {
                return FieldUpdateResult.Fail("Некорректный клиент");
            }

            var userExists = await _context.Users
                .AnyAsync(u => u.Id == userId);

            if (!userExists)
            {
                return FieldUpdateResult.Fail("Пользователь не найден");
            }

            if (request.OrganizationId.HasValue)
            {
                bool userInOrg = await _context.UserOrganizations
                    .AnyAsync(uo =>
                        uo.UserId == userId &&
                        uo.OrganizationId == request.OrganizationId.Value);

                if (!userInOrg)
                {
                    return FieldUpdateResult.Fail("Пользователь не относится к выбранной организации");
                }
            }

            if (request.BranchId.HasValue)
            {
                bool userInBranch = await _context.UserBranches
                    .AnyAsync(ub =>
                        ub.UserId == userId &&
                        ub.BranchId == request.BranchId.Value);

                if (!userInBranch)
                {
                    return FieldUpdateResult.Fail("Пользователь не относится к выбранному филиалу");
                }
            }

            request.CreatedById = userId;
            return FieldUpdateResult.Ok();
        }

        private async Task<string> GetDisplayValueAsync(Request request, string field)
        {
            switch (field)
            {
                case "title":
                    return Display(request.Title);

                case "description":
                    return Display(request.Description);

                case "topic":
                    if (request.RequestTopic != null)
                    {
                        return Display(request.RequestTopic.Name);
                    }

                    return await _context.RequestTopics
                        .Where(t => t.Id == request.RequestTopicId)
                        .Select(t => t.Name)
                        .FirstOrDefaultAsync() ?? "-";

                case "priority":
                    if (request.RequestPriority != null)
                    {
                        return Display(request.RequestPriority.Name);
                    }

                    return await _context.RequestPriorities
                        .Where(p => p.Id == request.RequestPriorityId)
                        .Select(p => p.Name)
                        .FirstOrDefaultAsync() ?? "-";

                case "status":
                    if (request.RequestStatus != null)
                    {
                        return Display(request.RequestStatus.Name);
                    }

                    return await _context.RequestStatuses
                        .Where(s => s.Id == request.RequestStatusId)
                        .Select(s => s.Name)
                        .FirstOrDefaultAsync() ?? "-";

                case "organization":
                    if (!request.OrganizationId.HasValue)
                    {
                        return "-";
                    }

                    return await _context.Organizations
                        .Where(o => o.Id == request.OrganizationId.Value)
                        .Select(o => o.Name)
                        .FirstOrDefaultAsync() ?? "-";

                case "branch":
                    if (!request.BranchId.HasValue)
                    {
                        return "-";
                    }

                    return await _context.Branches
                        .Where(b => b.Id == request.BranchId.Value)
                        .Select(b => b.Address)
                        .FirstOrDefaultAsync() ?? "-";

                case "product":
                    if (!request.ProductId.HasValue)
                    {
                        return "-";
                    }

                    return await _context.Products
                        .Where(p => p.Id == request.ProductId.Value)
                        .Select(p => p.Name)
                        .FirstOrDefaultAsync() ?? "-";

                case "client":
                    if (!request.CreatedById.HasValue)
                    {
                        return "-";
                    }

                    return await _context.Users
                        .Where(u => u.Id == request.CreatedById.Value)
                        .Select(u => u.FullName)
                        .FirstOrDefaultAsync() ?? "-";

                default:
                    return "-";
            }
        }

        private static object GetStoredValue(Request request, string field)
        {
            return field switch
            {
                "title" => request.Title ?? "",
                "description" => request.Description ?? "",
                "topic" => request.RequestTopicId.ToString(),
                "priority" => request.RequestPriorityId.ToString(),
                "status" => request.RequestStatusId.ToString(),
                "organization" => request.OrganizationId?.ToString() ?? "",
                "branch" => request.BranchId?.ToString() ?? "",
                "product" => request.ProductId?.ToString() ?? "",
                "client" => request.CreatedById?.ToString() ?? "",
                _ => ""
            };
        }

        private async Task<List<object>> GetOrganizationsForEditAsync()
        {
            return await _context.Organizations
                .Where(o => EditOrgIds.Contains(o.Id))
                .OrderBy(o => o.Name)
                .Select(o => new
                {
                    id = o.Id,
                    name = o.Name
                })
                .Cast<object>()
                .ToListAsync();
        }

        private async Task<List<object>> GetBranchesForEditAsync(int? orgId)
        {
            var query = _context.Branches.AsQueryable();

            if (orgId.HasValue)
            {
                query = query.Where(b => b.OrganizationId == orgId.Value);
            }

            query = query.Where(b =>
                EditBranchIds.Contains(b.Id) ||
                EditOrgIds.Contains(b.OrganizationId)
            );

            return await query
                .OrderBy(b => b.Address)
                .Select(b => new
                {
                    id = b.Id,
                    name = b.Address
                })
                .Cast<object>()
                .ToListAsync();
        }

        private async Task<List<object>> GetProductsForEditAsync(int? orgId)
        {
            if (orgId.HasValue)
            {
                bool orgHasProducts = await _context.OrganizationProducts
                    .AnyAsync(op => op.OrganizationId == orgId.Value);

                if (orgHasProducts)
                {
                    return await _context.OrganizationProducts
                        .Where(op => op.OrganizationId == orgId.Value)
                        .Select(op => op.Product)
                        .Where(p => p != null)
                        .OrderBy(p => p!.Name)
                        .Select(p => new
                        {
                            id = p!.Id,
                            name = p.Name
                        })
                        .Cast<object>()
                        .ToListAsync();
                }
            }

            return await _context.Products
                .OrderBy(p => p.Name)
                .Select(p => new
                {
                    id = p.Id,
                    name = p.Name
                })
                .Cast<object>()
                .ToListAsync();
        }

        private async Task<List<object>> GetUsersForEditAsync(int? orgId, int? branchId)
        {
            var query = _context.Users.AsQueryable();

            if (orgId.HasValue)
            {
                query = query.Where(u =>
                    u.UserOrganizations.Any(uo => uo.OrganizationId == orgId.Value));
            }

            if (branchId.HasValue)
            {
                query = query.Where(u =>
                    u.UserBranches.Any(ub => ub.BranchId == branchId.Value));
            }

            return await query
                .OrderBy(u => u.FullName)
                .Select(u => new
                {
                    id = u.Id,
                    name = u.FullName
                })
                .Cast<object>()
                .ToListAsync();
        }

        private async Task SaveCommentFilesAsync(int commentId, IEnumerable<IFormFile> files)
        {
            var allowedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                ".jpg",
                ".jpeg",
                ".png",
                ".pdf",
                ".docx"
            };

            foreach (var file in files)
            {
                if (file == null || file.Length == 0)
                {
                    continue;
                }

                string extension = Path.GetExtension(file.FileName);

                if (!allowedExtensions.Contains(extension))
                {
                    continue;
                }

                string root = _environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");

                string folder = Path.Combine(
                    root,
                    "uploads",
                    "comments",
                    commentId.ToString()
                );

                Directory.CreateDirectory(folder);

                string safeOriginalName = Path.GetFileName(file.FileName);
                string fileName = $"{Guid.NewGuid()}_{safeOriginalName}";
                string fullPath = Path.Combine(folder, fileName);

                await using var stream = new FileStream(fullPath, FileMode.Create);
                await file.CopyToAsync(stream);

                var attachment = new Attachment
                {
                    CommentId = commentId,
                    FilePath = $"/uploads/comments/{commentId}/{fileName}",
                    UploadedAt = DateTime.UtcNow
                };

                _context.Attachments.Add(attachment);
            }
        }

        private void DeletePhysicalFile(string? filePath)
        {
            if (string.IsNullOrWhiteSpace(filePath))
            {
                return;
            }

            string root = _environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");

            string normalizedPath = filePath
                .TrimStart('/')
                .Replace("/", Path.DirectorySeparatorChar.ToString());

            string fullPath = Path.Combine(root, normalizedPath);

            if (System.IO.File.Exists(fullPath))
            {
                System.IO.File.Delete(fullPath);
            }
        }

        private bool IsAjaxRequest()
        {
            return string.Equals(
                HttpContext.Request.Headers["X-Requested-With"],
                "XMLHttpRequest",
                StringComparison.OrdinalIgnoreCase
            );
        }

        private static JsonResult JsonFail(string error)
        {
            return new JsonResult(new
            {
                success = false,
                error
            });
        }

        private static string Display(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? "-" : value;
        }

        public static string ToCssPart(string? value)
        {
            return (value ?? "")
                .Trim()
                .ToLowerInvariant()
                .Replace(" ", "-");
        }

        private class FieldUpdateResult
        {
            public bool Success { get; set; }
            public string Error { get; set; } = "";

            public static FieldUpdateResult Ok()
            {
                return new FieldUpdateResult
                {
                    Success = true
                };
            }

            public static FieldUpdateResult Fail(string error)
            {
                return new FieldUpdateResult
                {
                    Success = false,
                    Error = error
                };
            }
        }
    }
}