using diplom_1.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace diplom_1.Pages
{
    public class LoginModel : PageModel
    {
        private readonly AppDbContext _context;

        public LoginModel(AppDbContext context)
        {
            _context = context;
        }

        [BindProperty]
        public InputModel Input { get; set; } = new();

        public string? ErrorMessage { get; set; }

        public class InputModel
        {
            [Required(ErrorMessage = "Введите логин")]
            public string Login { get; set; } = string.Empty;

            [Required(ErrorMessage = "Введите пароль")]
            public string Password { get; set; } = string.Empty;
        }

        public IActionResult OnGet()
        {
            if (!string.IsNullOrEmpty(HttpContext.Session.GetString("Login")))
                return RedirectToPage("/Dashboard/Dashboard");

            return Page();
        }

        public async Task<IActionResult> OnPost()
        {
            if (!ModelState.IsValid)
                return Page();

            var passwordHash = ComputeSha256Hash(Input.Password);

            var user = await _context.Users
                .Include(u => u.UserPermissions)
                    .ThenInclude(up => up.Permission)
                .FirstOrDefaultAsync(u => u.Login == Input.Login && u.Password == passwordHash);

            if (user == null)
            {
                ErrorMessage = "Неверный логин или пароль";
                return Page();
            }

            var permissions = user.UserPermissions
                .Select(up => $"{up.Permission.Module}:{up.Permission.Action}")
                .Distinct()
                .ToList();

            var userOrganizations = await _context.UserOrganizations
                .Where(uo => uo.UserId == user.Id)
                .Select(uo => uo.OrganizationId)
                .ToListAsync();

            var userBranches = await _context.UserBranches
                .Where(ub => ub.UserId == user.Id)
                .Select(ub => ub.BranchId)
                .ToListAsync();

            HttpContext.Session.SetInt32("UserId", user.Id);
            HttpContext.Session.SetString("Login", user.Login);
            HttpContext.Session.SetString("FullName", user.FullName);
            HttpContext.Session.SetString("UserPermissions", string.Join(",", permissions));
            HttpContext.Session.SetString("Email", user.Email ?? "");
            HttpContext.Session.SetString("UserOrganizations", string.Join(",", userOrganizations));
            HttpContext.Session.SetString("UserBranches", string.Join(",", userBranches));
            HttpContext.Session.SetInt32("IsSuperAdmin", user.IsSuperAdmin ? 1 : 0);

            var photoPath = string.IsNullOrEmpty(user.PhotoPath)
                ? "/icons/default-avatar.png"
                : user.PhotoPath;

            HttpContext.Session.SetString("PhotoPath", photoPath);

            return RedirectToPage("/Dashboard/Dashboard");
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