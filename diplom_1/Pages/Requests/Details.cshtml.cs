using diplom_1.Data;
using diplom_1.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace diplom_1.Pages.Requests
{
    public class DetailsModel : PageModel
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public DetailsModel(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        public Request Request { get; set; } = null!;
        public List<Comment> Comments { get; set; } = new();

        public bool CanEdit { get; set; } = false;

        [BindProperty]
        public string NewCommentContent { get; set; } = string.Empty;

        [BindProperty]
        public bool IsInternal { get; set; } = false;

        [BindProperty]
        public IFormFile? UploadFile { get; set; }

        
        // GET: Загрузка страницы
        
        public async Task<IActionResult> OnGetAsync(int id)
        {
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

            // Проверка прав пользователя на редактирование
            var userIdStr = HttpContext.Session.GetString("UserId");
            if (!string.IsNullOrEmpty(userIdStr) && int.TryParse(userIdStr, out var userId))
            {
                var userPermissions = await _context.UserPermissions
                    .Include(p => p.Permission)
                    .Where(p => p.UserId == userId)
                    .ToListAsync();

                CanEdit = userPermissions.Any(p =>
                    p.Permission.Module == "Задачи" &&
                    p.Permission.Action.Contains("Добавление/редактирование"));
            }

            return Page();
        }

        
        // POST: Добавление комментария
        
        public async Task<IActionResult> OnPostAddCommentAsync(int id)
        {
            if (string.IsNullOrWhiteSpace(NewCommentContent) && UploadFile == null)
                return RedirectToPage(new { id });

            var userId = HttpContext.Session.GetInt32("UserId");
            if (userId == null)
                return RedirectToPage("/Login");

            var comment = new Comment
            {
                RequestId = id,
                AuthorId = userId.Value,
                Content = NewCommentContent.Trim(),
                IsInternal = IsInternal,
                CreatedAt = DateTime.Now
            };

            //  Сохранение вложения
            if (UploadFile != null)
            {
                var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads");
                Directory.CreateDirectory(uploadsFolder);

                var fileName = $"{Guid.NewGuid()}{Path.GetExtension(UploadFile.FileName)}";
                var filePath = Path.Combine(uploadsFolder, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await UploadFile.CopyToAsync(stream);
                }

                comment.Attachments.Add(new Attachment
                {
                    FilePath = $"/uploads/{fileName}"
                });
            }

            _context.Comments.Add(comment);
            await _context.SaveChangesAsync();

            return RedirectToPage(new { id });
        }

        
        // POST: Обновление полей (тема/статус)
        
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> OnPostUpdateFieldAsync(int id, [FromBody] FieldUpdateDto data)
        {
            var userIdStr = HttpContext.Session.GetString("UserId");
            if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
                return new JsonResult(new { success = false, error = "Not authorized" });

            var hasEditPermission = await _context.UserPermissions
                .Include(p => p.Permission)
                .AnyAsync(p => p.UserId == userId &&
                               p.Permission.Module == "Задачи" &&
                               p.Permission.Action.Contains("Добавление/редактирование"));

            if (!hasEditPermission)
                return new JsonResult(new { success = false, error = "Forbidden" });

            var request = await _context.Requests.FirstOrDefaultAsync(r => r.Id == id);
            if (request == null)
                return new JsonResult(new { success = false, error = "Not found" });

            if (data.Field == "topic")
                request.Topic = data.Value;
            else if (data.Field == "status")
                request.Status = data.Value;

            await _context.SaveChangesAsync();

            return new JsonResult(new { success = true });
        }

        public class FieldUpdateDto
        {
            public string Field { get; set; } = "";
            public string Value { get; set; } = "";
        }
    }
}
