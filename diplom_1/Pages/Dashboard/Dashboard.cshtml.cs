using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using diplom_1.Data;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace diplom_1.Pages.Dashboard
{
    public class DashboardModel : PageModel
    {
        private readonly AppDbContext _context;

        public DashboardModel(AppDbContext context)
        {
            _context = context;
        }

        public List<string> UserModules { get; set; } = new();

        [IgnoreAntiforgeryToken]
        public async Task<IActionResult> OnPostUpdateProfileAsync([FromBody] UserUpdateDto data)
        {
            var userId = HttpContext.Session.GetInt32("UserId");
            if (userId == null) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound();

            user.FullName = data.FullName;
            user.Email = data.Email;

            await _context.SaveChangesAsync();

            HttpContext.Session.SetString("FullName", user.FullName ?? "");
            HttpContext.Session.SetString("Email", user.Email ?? "");

            return new JsonResult(new { success = true });
        }

        public class UserUpdateDto
        {
            public string FullName { get; set; } = "";
            public string Email { get; set; } = "";
        }

        public async Task<IActionResult> OnGetAsync()
        {
            var userId = HttpContext.Session.GetInt32("UserId");
            if (userId == null || userId == 0)
                return RedirectToPage("/Login");


            // Загружаем все модули, где есть хотя бы одно право
            UserModules = await _context.UserPermissions
                .Where(up => up.UserId == userId)
                .Select(up => up.Permission.Module.Trim())
                .Distinct()
                .ToListAsync();

            HttpContext.Session.SetString("UserModules", string.Join(",", UserModules));

            return Page();
        }
    }
}
