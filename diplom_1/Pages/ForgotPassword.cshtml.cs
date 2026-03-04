using diplom_1.Data;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using MimeKit;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using System;

namespace diplom_1.Pages
{
    public class ForgotPasswordModel : PageModel
    {
        private readonly AppDbContext _context;
        private readonly ILogger<ForgotPasswordModel> _logger;

        public ForgotPasswordModel(AppDbContext context, ILogger<ForgotPasswordModel> logger)
        {
            _context = context;
            _logger = logger;
        }

        [BindProperty]
        [Required(ErrorMessage = "Введите email")]
        [EmailAddress(ErrorMessage = "Некорректный email")]
        public string Email { get; set; }

        public string Message { get; set; }

        public async Task<IActionResult> OnPostAsync()
        {
            if (!ModelState.IsValid)
                return Page();

            try
            {
                var user = _context.Users.FirstOrDefault(u => u.Email == Email);

                if (user == null)
                {
                    // Для безопасности не говорим, что пользователь не найден
                    Message = "Если email существует, письмо отправлено.";
                    return Page();
                }

                // Генерируем токен
                var token = GenerateToken();
                user.ResetToken = token;
                await _context.SaveChangesAsync();

                // Создаем ссылку для сброса пароля
                var resetLink = Url.Page(
                    "/ResetPassword",
                    null,
                    new { token = token },
                    Request.Scheme);

                // Отправляем email
                await SendEmailAsync(user.Email, resetLink);

                Message = "Письмо отправлено на вашу почту.";
                _logger.LogInformation("Email успешно отправлен на {Email}", user.Email);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при отправке email на {Email}", Email);
                Message = "Ошибка при отправке письма. Пожалуйста, попробуйте позже или обратитесь в поддержку.";
            }

            return Page();
        }

        private async Task SendEmailAsync(string toEmail, string resetLink)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress("Поддержка сайта", "k2ee4y@yandex.ru"));
            message.To.Add(new MailboxAddress("", toEmail));
            message.Subject = "Восстановление пароля";

            var bodyBuilder = new BodyBuilder();
            bodyBuilder.HtmlBody = $@"
                <html>
                <head>
                    <meta charset='utf-8'>
                    <style>
                        body {{ font-family: Arial, sans-serif; line-height: 1.6; }}
                        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                        .button {{ 
                            display: inline-block; 
                            padding: 10px 20px; 
                            background-color: #007bff; 
                            color: white; 
                            text-decoration: none; 
                            border-radius: 5px;
                            margin: 20px 0;
                        }}
                        .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
                    </style>
                </head>
                <body>
                    <div class='container'>
                        <h2>Восстановление пароля</h2>
                        <p>Здравствуйте!</p>
                        <p>Вы получили это письмо, потому что запросили восстановление пароля на нашем сайте.</p>
                        <p>Для смены пароля нажмите на кнопку ниже:</p>
                        <p>
                            <a href='{resetLink}' class='button'>Сменить пароль</a>
                        </p>
                        <p>Или скопируйте эту ссылку в браузер:</p>
                        <p><a href='{resetLink}'>{resetLink}</a></p>
                        <p>Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.</p>
                        <div class='footer'>
                            <p>С уважением, команда поддержки</p>
                            <p>© 2024 Ваш сайт</p>
                        </div>
                    </div>
                </body>
                </html>
            ";

            bodyBuilder.TextBody = $@"
                Восстановление пароля

                Здравствуйте!

                Вы получили это письмо, потому что запросили восстановление пароля на нашем сайте.

                Для смены пароля перейдите по ссылке:
                {resetLink}

                Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.

                С уважением, команда поддержки
            ";

            message.Body = bodyBuilder.ToMessageBody();

            using (var client = new SmtpClient())
            {
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;
                await client.ConnectAsync("smtp.yandex.ru", 465, SecureSocketOptions.SslOnConnect);
                await client.AuthenticateAsync("k2ee4y@yandex.ru", "jjfjngwoequykjpv");
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
        }

        private string GenerateToken()
        {
            using var rng = RandomNumberGenerator.Create();
            var bytes = new byte[32];
            rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes)
                .Replace("+", "-")
                .Replace("/", "_")
                .Replace("=", "");
        }
    }
}