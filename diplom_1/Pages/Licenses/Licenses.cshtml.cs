using diplom_1.Data;
using diplom_1.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace diplom_1.Pages.Licenses
{
    public class LicensesModel : PageModel
    {
        private readonly AppDbContext _context;
        public LicensesModel(AppDbContext context) => _context = context;

        public List<ComputerLicense> ComputerLicenses { get; set; } = new();

        [BindProperty]
        public ComputerLicense NewComputerLicense { get; set; } = new();

        // ===== ЗАГРУЗКА ДАННЫХ =====
        public async Task<IActionResult> OnGetAsync()
        {
            ComputerLicenses = await _context.ComputerLicenses
                .Include(cl => cl.License)
                    .ThenInclude(l => l.Product)
                .Include(cl => cl.Computer)
                .Include(cl => cl.Branch)
                    .ThenInclude(b => b.Organization)
                .OrderByDescending(cl => cl.StartDate)
                .ToListAsync();

            // Определяем статусы
            foreach (var cl in ComputerLicenses)
            {
                if (cl.EndDate < DateTime.Now)
                    cl.Status = "Истекла";
                else if ((cl.EndDate - DateTime.Now).TotalDays <= 30)
                    cl.Status = "Скоро истекает";
                else
                    cl.Status = "Активна";
            }

            // Подгружаем справочники для формы
            ViewData["Organizations"] = await _context.Organizations.ToListAsync();
            ViewData["Branches"] = await _context.Branches.Include(b => b.Organization).ToListAsync();
            ViewData["Products"] = await _context.Products.ToListAsync();
            ViewData["Licenses"] = await _context.Licenses.ToListAsync();
            ViewData["Editions"] = await _context.Editions.ToListAsync();
            ViewData["Modules"] = await _context.Modules.ToListAsync();

            return Page();
        }

        // ===== ДОБАВЛЕНИЕ НОВОЙ ЗАПИСИ =====
        public async Task<IActionResult> OnPostAddAsync()
        {
            // Проверяем корректность модели
            if (!ModelState.IsValid)
            {
                TempData["ErrorMessage"] = "Ошибка: заполните все обязательные поля.";
                await OnGetAsync();
                return Page();
            }

            try
            {
                // Проверяем, есть ли уже компьютер
                Computer computer;
                if (!_context.Computers.Any(c => c.Name == NewComputerLicense.ComputerName))
                {
                    computer = new Computer
                    {
                        Name = NewComputerLicense.ComputerName,
                        BranchId = NewComputerLicense.BranchId
                    };
                    _context.Computers.Add(computer);
                    await _context.SaveChangesAsync();
                }
                else
                {
                    computer = await _context.Computers
                        .FirstAsync(c => c.Name == NewComputerLicense.ComputerName);
                }

                // Создаём новую запись о лицензии
                var newRecord = new ComputerLicense
                {
                    ComputerId = computer.Id,
                    BranchId = NewComputerLicense.BranchId,
                    LicenseId = NewComputerLicense.LicenseId,
                    ProductId = NewComputerLicense.ProductId,
                    EditionId = NewComputerLicense.EditionId,
                    ModuleId = NewComputerLicense.ModuleId,
                    StartDate = NewComputerLicense.StartDate,
                    EndDate = NewComputerLicense.EndDate,
                    OrganizationId = NewComputerLicense.OrganizationId, // ✅ добавлено
                    Status = "Активна"
                };

                _context.ComputerLicenses.Add(newRecord);
                await _context.SaveChangesAsync();

                TempData["SuccessMessage"] = "✅ Лицензия успешно добавлена!";
                return RedirectToPage(); // обновляем страницу
            }
            catch (Exception ex)
            {
                TempData["ErrorMessage"] = $"Ошибка при сохранении: {ex.Message}";
                await OnGetAsync();
                return Page();
            }
        }
    }
}