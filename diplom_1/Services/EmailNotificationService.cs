using diplom_1.Data;
using diplom_1.Models;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MimeKit;

namespace diplom_1.Services
{
    public class EmailNotificationService
    {
        private readonly AppDbContext _context;
        private readonly SmtpSettings _smtpSettings;
        private readonly ILogger<EmailNotificationService> _logger;

        public EmailNotificationService(
            AppDbContext context,
            IOptions<SmtpSettings> smtpOptions,
            ILogger<EmailNotificationService> logger)
        {
            _context = context;
            _smtpSettings = smtpOptions.Value;
            _logger = logger;
        }

        public async Task<List<int>> GetRequestRecipientIdsAsync(
            int requestId,
            int? actorUserId = null,
            bool includeCreator = true,
            bool includeViewers = true,
            bool includeCommentAuthors = true,
            bool includeInternalCommentViewers = false)
        {
            var request = await _context.Requests
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == requestId);

            if (request == null)
            {
                _logger.LogWarning(
                    "Заявка {RequestId} не найдена при поиске получателей",
                    requestId
                );

                return new List<int>();
            }

            var recipientIds = new HashSet<int>();

            if (includeCreator && request.CreatedById.HasValue && request.CreatedById.Value > 0)
            {
                recipientIds.Add(request.CreatedById.Value);
            }

            if (includeViewers)
            {
                var viewerIds = await GetUsersWithPermissionAsync(
                    request,
                    "Просмотр"
                );

                foreach (var userId in viewerIds)
                {
                    if (userId > 0)
                    {
                        recipientIds.Add(userId);
                    }
                }
            }

            if (includeCommentAuthors)
            {
                var commentAuthorIds = await _context.Comments
                    .AsNoTracking()
                    .Where(c => c.RequestId == requestId)
                    .Where(c => c.AuthorId.HasValue && c.AuthorId.Value > 0)
                    .Select(c => c.AuthorId!.Value)
                    .Distinct()
                    .ToListAsync();

                foreach (var userId in commentAuthorIds)
                {
                    if (userId > 0)
                    {
                        recipientIds.Add(userId);
                    }
                }
            }

            if (includeInternalCommentViewers)
            {
                var internalViewerIds = await GetUsersWithPermissionAsync(
                    request,
                    "Просмотр внутренних комментариев"
                );

                foreach (var userId in internalViewerIds)
                {
                    if (userId > 0)
                    {
                        recipientIds.Add(userId);
                    }
                }
            }

            /*
             * Старую логику не меняем:
             * actorUserId пока НЕ удаляется из получателей.
             */
            // if (actorUserId.HasValue) recipientIds.Remove(actorUserId.Value);

            var result = recipientIds
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            _logger.LogInformation(
                "Получатели уведомления по заявке {RequestId}: {Recipients}",
                requestId,
                result.Count == 0 ? "нет" : string.Join(", ", result)
            );

            return result;
        }

        public async Task NotifyRequestCreatedAsync(int requestId, int? actorUserId = null)
        {
            _logger.LogInformation(
                "Старт NotifyRequestCreatedAsync для заявки {RequestId}",
                requestId
            );

            var request = await LoadRequestForNotificationAsync(requestId);

            if (request == null)
            {
                _logger.LogWarning(
                    "Заявка {RequestId} не найдена для уведомления о создании",
                    requestId
                );

                return;
            }

            var recipients = await GetRequestRecipientIdsAsync(
                requestId,
                actorUserId,
                includeCreator: true,
                includeViewers: true,
                includeCommentAuthors: false,
                includeInternalCommentViewers: false
            );

            string subject = $"Создана новая заявка #{request.Id}";

            string body =
                $"Создана новая заявка.\n\n" +
                $"Заявка: #{request.Id}\n" +
                $"Название: {request.Title}\n" +
                $"Тема: {request.RequestTopic?.Name ?? "-"}\n" +
                $"Приоритет: {request.RequestPriority?.Name ?? "-"}\n" +
                $"Статус: {request.RequestStatus?.Name ?? "-"}\n" +
                $"Организация: {request.Organization?.Name ?? "-"}\n" +
                $"Филиал: {request.Branch?.Address ?? "-"}\n" +
                $"Продукт: {request.Product?.Name ?? "-"}\n" +
                $"Клиент: {request.CreatedBy?.FullName ?? "-"}\n\n" +
                $"Описание:\n{request.Description}";

            await SendRequestNotificationAsync(
                requestId,
                subject,
                body,
                recipients,
                actorUserId
            );
        }

        public async Task NotifyRequestChangedAsync(
            int requestId,
            string changeText,
            int? actorUserId = null)
        {
            _logger.LogInformation(
                "Старт NotifyRequestChangedAsync для заявки {RequestId}",
                requestId
            );

            var request = await LoadRequestForNotificationAsync(requestId);

            if (request == null)
            {
                _logger.LogWarning(
                    "Заявка {RequestId} не найдена для уведомления об изменении",
                    requestId
                );

                return;
            }

            var recipients = await GetRequestRecipientIdsAsync(
                requestId,
                actorUserId,
                includeCreator: true,
                includeViewers: true,
                includeCommentAuthors: true,
                includeInternalCommentViewers: false
            );

            string subject = $"Изменена заявка #{request.Id}";

            string body =
                $"Заявка была изменена.\n\n" +
                $"Заявка: #{request.Id}\n" +
                $"Название: {request.Title}\n" +
                $"Тема: {request.RequestTopic?.Name ?? "-"}\n" +
                $"Приоритет: {request.RequestPriority?.Name ?? "-"}\n" +
                $"Статус: {request.RequestStatus?.Name ?? "-"}\n" +
                $"Организация: {request.Organization?.Name ?? "-"}\n" +
                $"Филиал: {request.Branch?.Address ?? "-"}\n" +
                $"Продукт: {request.Product?.Name ?? "-"}\n" +
                $"Клиент: {request.CreatedBy?.FullName ?? "-"}\n\n" +
                $"Изменения:\n{changeText}";

            await SendRequestNotificationAsync(
                requestId,
                subject,
                body,
                recipients,
                actorUserId
            );
        }

        public async Task NotifyCommentAddedAsync(
            int requestId,
            int commentId,
            int? actorUserId = null)
        {
            _logger.LogInformation(
                "Старт NotifyCommentAddedAsync для заявки {RequestId}, комментарий {CommentId}",
                requestId,
                commentId
            );

            var request = await LoadRequestForNotificationAsync(requestId);

            if (request == null)
            {
                _logger.LogWarning(
                    "Заявка {RequestId} не найдена для уведомления о комментарии",
                    requestId
                );

                return;
            }

            var comment = await _context.Comments
                .AsNoTracking()
                .Include(c => c.Author)
                .FirstOrDefaultAsync(c => c.Id == commentId);

            if (comment == null)
            {
                _logger.LogWarning(
                    "Комментарий {CommentId} не найден для уведомления",
                    commentId
                );

                return;
            }

            var recipients = await GetRequestRecipientIdsAsync(
                requestId,
                actorUserId,
                includeCreator: true,
                includeViewers: true,
                includeCommentAuthors: true,
                includeInternalCommentViewers: comment.IsInternal
            );

            string subject = $"Новый комментарий к заявке #{request.Id}";

            string body =
                $"Добавлен новый комментарий к заявке.\n\n" +
                $"Заявка: #{request.Id}\n" +
                $"Название: {request.Title}\n" +
                $"Тема: {request.RequestTopic?.Name ?? "-"}\n" +
                $"Статус: {request.RequestStatus?.Name ?? "-"}\n" +
                $"Организация: {request.Organization?.Name ?? "-"}\n" +
                $"Филиал: {request.Branch?.Address ?? "-"}\n" +
                $"Автор комментария: {comment.Author?.FullName ?? "-"}\n" +
                $"Тип комментария: {(comment.IsInternal ? "Внутренний" : "Обычный")}\n\n" +
                $"Комментарий:\n{comment.Content}";

            await SendRequestNotificationAsync(
                requestId,
                subject,
                body,
                recipients,
                actorUserId
            );
        }

        public async Task SendRequestNotificationAsync(
            int requestId,
            string subject,
            string message,
            IEnumerable<int?> userIds,
            int? actorUserId = null)
        {
            var ids = userIds?
                .Where(id => id.HasValue && id.Value > 0)
                .Select(id => id!.Value)
                .Distinct()
                .ToList() ?? new List<int>();

            await SendRequestNotificationAsync(
                requestId,
                subject,
                message,
                ids,
                actorUserId
            );
        }

        public async Task SendRequestNotificationAsync(
            int requestId,
            string subject,
            string message,
            IEnumerable<int> userIds,
            int? actorUserId = null)
        {
            var recipientIds = userIds?
                .Where(id => id > 0)
                .Distinct()
                .ToList() ?? new List<int>();

            /*
             * Старую логику не меняем:
             * actorUserId пока НЕ удаляется из получателей.
             */
            // if (actorUserId.HasValue) recipientIds.Remove(actorUserId.Value);

            _logger.LogInformation(
                "Подготовка отправки уведомления по заявке {RequestId}. ID получателей: {Recipients}",
                requestId,
                recipientIds.Count == 0 ? "нет" : string.Join(", ", recipientIds)
            );

            if (!recipientIds.Any())
            {
                _logger.LogWarning(
                    "Нет получателей уведомления по заявке {RequestId}",
                    requestId
                );

                return;
            }

            var users = await _context.Users
                .AsNoTracking()
                .Where(u => recipientIds.Contains(u.Id))
                .Where(u => !string.IsNullOrWhiteSpace(u.Email))
                .Select(u => new
                {
                    u.Id,
                    u.Email,
                    u.FullName
                })
                .ToListAsync();

            if (!users.Any())
            {
                _logger.LogWarning(
                    "Получатели по заявке {RequestId} найдены, но email пустые",
                    requestId
                );

                return;
            }

            _logger.LogInformation(
                "Будет отправлено {Count} email-уведомлений по заявке {RequestId}",
                users.Count,
                requestId
            );

            foreach (var user in users)
            {
                try
                {
                    await SendEmailAsync(
                        user.Email!,
                        subject,
                        message
                    );

                    _logger.LogInformation(
                        "Уведомление по заявке {RequestId} отправлено на {Email}",
                        requestId,
                        user.Email
                    );
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "Ошибка отправки уведомления по заявке {RequestId} на {Email}",
                        requestId,
                        user.Email
                    );
                }
            }
        }

        private async Task<Request?> LoadRequestForNotificationAsync(int requestId)
        {
            return await _context.Requests
                .AsNoTracking()
                .Include(r => r.Organization)
                .Include(r => r.Branch)
                .Include(r => r.Product)
                .Include(r => r.RequestTopic)
                .Include(r => r.RequestPriority)
                .Include(r => r.RequestStatus)
                .Include(r => r.CreatedBy)
                .FirstOrDefaultAsync(r => r.Id == requestId);
        }

        private async Task<List<int>> GetUsersWithPermissionAsync(
            Request request,
            string action)
        {
            string normalizedAction = action.Trim().ToLower();

            var query = _context.UserPermissions
                .AsNoTracking()
                .Include(up => up.Permission)
                .Where(up =>
                    up.UserId > 0 &&
                    up.Permission != null &&
                    up.Permission.Module != null &&
                    up.Permission.Action != null &&
                    up.Permission.Module.Trim().ToLower() == "задачи" &&
                    up.Permission.Action.Trim().ToLower() == normalizedAction);

            if (request.OrganizationId.HasValue || request.BranchId.HasValue)
            {
                query = query.Where(up =>
                    (request.OrganizationId.HasValue &&
                     up.OrganizationId == request.OrganizationId.Value) ||
                    (request.BranchId.HasValue &&
                     up.BranchId == request.BranchId.Value)
                );
            }

            var userIds = await query
                .Select(up => up.UserId)
                .Distinct()
                .ToListAsync();

            return userIds
                .Where(id => id > 0)
                .Distinct()
                .ToList();
        }

        private async Task SendEmailAsync(string toEmail, string subject, string body)
        {
            if (string.IsNullOrWhiteSpace(_smtpSettings.Host))
            {
                throw new InvalidOperationException("SMTP Host не заполнен");
            }

            if (string.IsNullOrWhiteSpace(_smtpSettings.Username))
            {
                throw new InvalidOperationException("SMTP Username не заполнен");
            }

            if (string.IsNullOrWhiteSpace(_smtpSettings.Password))
            {
                throw new InvalidOperationException("SMTP Password не заполнен");
            }

            string fromEmail = string.IsNullOrWhiteSpace(_smtpSettings.FromEmail)
                ? _smtpSettings.Username
                : _smtpSettings.FromEmail;

            string fromName = string.IsNullOrWhiteSpace(_smtpSettings.FromName)
                ? "Поддержка сайта"
                : _smtpSettings.FromName;

            var message = new MimeMessage();

            message.From.Add(new MailboxAddress(fromName, fromEmail));
            message.To.Add(new MailboxAddress("", toEmail));
            message.Subject = subject ?? "";

            string safeSubject = System.Net.WebUtility.HtmlEncode(subject ?? "");
            string safeBody = System.Net.WebUtility.HtmlEncode(body ?? "");

            var bodyBuilder = new BodyBuilder
            {
                TextBody = body ?? "",
                HtmlBody = $@"
<html>
<head>
    <meta charset='utf-8'>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6;'>
    <div style='max-width: 700px; margin: 0 auto; padding: 20px;'>
        <h2>{safeSubject}</h2>
        <pre style='font-family: Arial, sans-serif; white-space: pre-wrap;'>{safeBody}</pre>
    </div>
</body>
</html>"
            };

            message.Body = bodyBuilder.ToMessageBody();

            var attempts = new List<(int Port, SecureSocketOptions Options)>
            {
                (_smtpSettings.Port, _smtpSettings.Port == 587 ? SecureSocketOptions.StartTls : SecureSocketOptions.SslOnConnect),
                (465, SecureSocketOptions.SslOnConnect),
                (587, SecureSocketOptions.StartTls)
            }
            .Distinct()
            .ToList();

            Exception? lastException = null;

            foreach (var attempt in attempts)
            {
                try
                {
                    using var client = new SmtpClient();

                    client.Timeout = 60000;
                    client.ServerCertificateValidationCallback = (s, c, h, e) => true;
                    client.AuthenticationMechanisms.Remove("XOAUTH2");

                    _logger.LogInformation(
                        "SMTP попытка подключения: {Host}:{Port}, режим: {Mode}, пользователь: {Username}",
                        _smtpSettings.Host,
                        attempt.Port,
                        attempt.Options,
                        _smtpSettings.Username
                    );

                    await client.ConnectAsync(
                        _smtpSettings.Host,
                        attempt.Port,
                        attempt.Options
                    );

                    _logger.LogInformation(
                        "SMTP подключение успешно: {Host}:{Port}",
                        _smtpSettings.Host,
                        attempt.Port
                    );

                    await client.AuthenticateAsync(
                        _smtpSettings.Username,
                        _smtpSettings.Password
                    );

                    _logger.LogInformation(
                        "SMTP авторизация успешна для {Username}",
                        _smtpSettings.Username
                    );

                    await client.SendAsync(message);

                    _logger.LogInformation(
                        "SMTP письмо успешно отправлено на {Email}",
                        toEmail
                    );

                    await client.DisconnectAsync(true);

                    return;
                }
                catch (Exception ex)
                {
                    lastException = ex;

                    _logger.LogError(
                        ex,
                        "SMTP ошибка при отправке на {Email} через {Host}:{Port}, режим: {Mode}",
                        toEmail,
                        _smtpSettings.Host,
                        attempt.Port,
                        attempt.Options
                    );
                }
            }

            throw new InvalidOperationException(
                $"Не удалось отправить письмо на {toEmail}. Все SMTP-попытки завершились ошибкой.",
                lastException
            );
        }
    }
}