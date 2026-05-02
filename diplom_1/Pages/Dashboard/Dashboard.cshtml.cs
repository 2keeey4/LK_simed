using diplom_1.Data;
using diplom_1.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace diplom_1.Pages.Dashboard
{
    public class DashboardModel : PageModel
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public DashboardModel(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        public List<OrganizationWithBranches> UserOrganizations { get; set; } = new();
        public List<string> UserModules { get; set; } = new();

        public async Task<IActionResult> OnGetAsync()
        {
            var userId = HttpContext.Session.GetInt32("UserId");
            if (userId == null || userId == 0)
                return RedirectToPage("/Login");

            UserModules = await _context.UserPermissions
                .Where(up => up.UserId == userId)
                .Select(up => up.Permission.Module.Trim())
                .Distinct()
                .ToListAsync();

            HttpContext.Session.SetString("UserModules", string.Join(",", UserModules));

            var userOrgIds = await _context.UserOrganizations
                .Where(uo => uo.UserId == userId)
                .Select(uo => uo.OrganizationId)
                .ToListAsync();

            var userBranchIds = await _context.UserBranches
                .Where(ub => ub.UserId == userId)
                .Select(ub => ub.BranchId)
                .ToListAsync();

            var organizations = await _context.Organizations
                .Where(o => userOrgIds.Contains(o.Id))
                .OrderBy(o => o.Name)
                .ToListAsync();

            var allBranches = await _context.Branches
                .Where(b => userBranchIds.Contains(b.Id))
                .Include(b => b.Organization)
                .ToListAsync();

            UserOrganizations = organizations.Select(org => new OrganizationWithBranches
            {
                Id = org.Id,
                Name = org.Name,
                Branches = allBranches.Where(b => b.OrganizationId == org.Id).ToList()
            }).ToList();

            return Page();
        }

        public async Task<IActionResult> OnPostUpdateProfileAsync(string FullName, string Email)
        {
            var userId = HttpContext.Session.GetInt32("UserId");
            if (userId == null) return new JsonResult(new { success = false, message = "Не авторизован" });

            if (string.IsNullOrWhiteSpace(FullName))
                return new JsonResult(new { success = false, message = "ФИО не может быть пустым" });

            if (FullName.Length < 2 || FullName.Length > 100)
                return new JsonResult(new { success = false, message = "ФИО должно быть от 2 до 100 символов" });

            if (!Regex.IsMatch(FullName, @"^[а-яА-Яa-zA-Z\s\-]+$"))
                return new JsonResult(new { success = false, message = "ФИО может содержать только буквы, пробелы и дефисы" });

            if (string.IsNullOrWhiteSpace(Email))
                return new JsonResult(new { success = false, message = "Email не может быть пустым" });

            if (!Regex.IsMatch(Email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
                return new JsonResult(new { success = false, message = "Введите корректный email" });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return new JsonResult(new { success = false, message = "Пользователь не найден" });

            var emailExists = await _context.Users.AnyAsync(u => u.Email == Email && u.Id != userId);
            if (emailExists)
                return new JsonResult(new { success = false, message = "Этот email уже используется другим пользователем" });

            user.FullName = FullName.Trim();
            user.Email = Email.Trim();

            await _context.SaveChangesAsync();

            HttpContext.Session.SetString("FullName", user.FullName ?? "");
            HttpContext.Session.SetString("Email", user.Email ?? "");

            var photoPath = HttpContext.Session.GetString("PhotoPath") ?? "/icons/default-avatar.png";

            return new JsonResult(new { success = true, fullName = user.FullName, email = user.Email, photoPath = photoPath });
        }

        public async Task<IActionResult> OnPostUploadPhotoAsync(IFormFile photo)
        {
            var userId = HttpContext.Session.GetInt32("UserId");
            if (userId == null) return new JsonResult(new { success = false, message = "Не авторизован" });

            if (photo == null || photo.Length == 0)
                return new JsonResult(new { success = false, message = "Файл не выбран" });

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp" };
            var fileExtension = Path.GetExtension(photo.FileName).ToLowerInvariant();

            if (!allowedExtensions.Contains(fileExtension))
                return new JsonResult(new { success = false, message = "Разрешены только изображения (JPG, PNG, GIF, BMP)" });

            if (photo.Length > 5 * 1024 * 1024)
                return new JsonResult(new { success = false, message = "Размер файла не должен превышать 5 МБ" });

            try
            {
                var uploadsDir = Path.Combine(_env.WebRootPath, "uploads", "users");
                if (!Directory.Exists(uploadsDir))
                    Directory.CreateDirectory(uploadsDir);

                var fileName = $"{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(uploadsDir, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await photo.CopyToAsync(stream);
                }

                var relativePath = $"/uploads/users/{fileName}";

                var user = await _context.Users.FindAsync(userId.Value);
                if (user != null)
                {
                    if (!string.IsNullOrEmpty(user.PhotoPath) && user.PhotoPath != "/icons/default-avatar.png")
                    {
                        var oldPath = Path.Combine(_env.WebRootPath, user.PhotoPath.TrimStart('/'));
                        if (System.IO.File.Exists(oldPath))
                            System.IO.File.Delete(oldPath);
                    }

                    user.PhotoPath = relativePath;
                    await _context.SaveChangesAsync();
                    HttpContext.Session.SetString("PhotoPath", relativePath);
                }

                return new JsonResult(new { success = true, path = relativePath });
            }
            catch (Exception ex)
            {
                return new JsonResult(new { success = false, message = ex.Message });
            }
        }
    }

    public class OrganizationWithBranches
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public List<Branch> Branches { get; set; } = new();
    }
}