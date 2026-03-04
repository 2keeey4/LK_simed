using diplom_1.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace diplom_1.Pages
{
    public class ResetPasswordModel : PageModel
    {
        private readonly AppDbContext _context;

        public ResetPasswordModel(AppDbContext context)
        {
            _context = context;
        }

        [BindProperty(SupportsGet = true)]
        public string Token { get; set; }

        [BindProperty]
        [Required(ErrorMessage = "Введите новый пароль")]
        [MinLength(6, ErrorMessage = "Пароль должен быть не менее 6 символов")]
        public string NewPassword { get; set; }

        [BindProperty]
        [Required(ErrorMessage = "Подтвердите пароль")]
        [Compare("NewPassword", ErrorMessage = "Пароли не совпадают")]
        public string ConfirmPassword { get; set; }

        public string Message { get; set; }
        public bool IsSuccess { get; set; }

        public IActionResult OnGet()
        {
            if (string.IsNullOrEmpty(Token))
            {
                Message = "Недействительная ссылка для восстановления пароля.";
                return Page();
            }

            return Page();
        }

        public IActionResult OnPost()
        {
            if (!ModelState.IsValid)
                return Page();

            // Ищем пользователя по токену
            var user = _context.Users.FirstOrDefault(u => u.ResetToken == Token);

            if (user == null)
            {
                Message = "Ссылка для восстановления пароля устарела или недействительна.";
                return Page();
            }

            // Обновляем пароль
            user.Password = ComputeSha256Hash(NewPassword);
            user.ResetToken = null; // Удаляем токен после использования

            _context.SaveChanges();

            Message = "Пароль успешно изменён!";
            IsSuccess = true;

            return Page();
        }

        private static string ComputeSha256Hash(string rawData)
        {
            using var sha256 = SHA256.Create();
            var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(rawData));
            var builder = new StringBuilder();
            foreach (var b in bytes)
                builder.Append(b.ToString("x2"));
            return builder.ToString();
        }
    }
}