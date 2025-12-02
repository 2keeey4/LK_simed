using diplom_1.Data;
using diplom_1.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace diplom_1.Pages.Users
{
    public class UsersModel : PageModel
    {
        private readonly AppDbContext _context;
        public UsersModel(AppDbContext context)
        {
            _context = context;
        }

        public List<UserDisplayDto> Users { get; set; } = new();

        //  1. СПИСОК ПОЛЬЗОВАТЕЛЕЙ 
        public async Task OnGetAsync()
        {
            var users = await _context.Users
                .Include(u => u.UserOrganizations).ThenInclude(uo => uo.Organization)
                .Include(u => u.UserBranches).ThenInclude(ub => ub.Branch)
                .ToListAsync();

            Users = users.Select(u => new UserDisplayDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Email = u.Email,
                Login = u.Login,
                Organizations = u.UserOrganizations.Select(o => o.Organization.Name).ToList(),
                Branches = u.UserBranches.Select(b => b.Branch.Address).ToList()
            }).ToList();
        }

        //  2. ДЕТАЛИ ПОЛЬЗОВАТЕЛЯ 
        public async Task<IActionResult> OnGetUserDetailsAsync(int id)
        {
            var user = await _context.Users
                .Include(u => u.UserOrganizations)
                .Include(u => u.UserBranches)
                .Include(u => u.UserPermissions)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null)
                return NotFound();

            return new JsonResult(new
            {
                id = user.Id,
                fullName = user.FullName,
                email = user.Email,
                login = user.Login,
                photoPath = string.IsNullOrEmpty(user.PhotoPath)
                    ? "/icons/default-avatar.png"
                    : user.PhotoPath.Replace("~", ""), // ✅ конвертация

                organizations = user.UserOrganizations.Select(o => o.OrganizationId).ToList(),
                branches = user.UserBranches.Select(b => b.BranchId).ToList(),
                permissions = user.UserPermissions.Select(p => new
                {
                    permissionId = p.PermissionId,
                    organizationId = p.OrganizationId,
                    branchId = p.BranchId
                }).ToList()
            });
        }

        //  3. СПРАВОЧНИКИ 
        public async Task<IActionResult> OnGetDictionariesAsync()
        {
            var orgs = await _context.Organizations
                .Include(o => o.Branches)
                .Select(o => new
                {
                    id = o.Id,
                    name = o.Name,
                    branches = o.Branches.Select(b => new { id = b.Id, address = b.Address })
                })
                .ToListAsync();

            var perms = await _context.Permissions
                .Select(p => new
                {
                    id = p.Id,
                    module = p.Module.Trim(),
                    action = p.Action.Trim()
                })
                .OrderBy(p => p.module)
                .ThenBy(p => p.action)
                .ToListAsync();

            var roles = await _context.Roles
                .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
                .Select(r => new
                {
                    id = r.Id,
                    name = r.Name,
                    permissions = r.RolePermissions.Select(rp => rp.PermissionId).ToList()
                })
                .ToListAsync();

            return new JsonResult(new { orgs, perms, roles });
        }

        [ValidateAntiForgeryToken]
        public async Task<IActionResult> OnPostSaveUserAsync([FromBody] UserSaveDto data)
        {
            if (data == null)
                return BadRequest("Нет данных.");

            User user;
            bool isNew = data.Id == 0;

            if (isNew)
            {
                user = new User
                {
                    FullName = data.FullName,
                    Email = data.Email,
                    Login = data.Login,
                    Password = HashPassword(data.Password ?? GeneratePassword()),
                    PhotoPath = string.IsNullOrWhiteSpace(data.PhotoPath)
                        ? "~/icons/default-avatar.png"
                        : data.PhotoPath
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }
            else
            {
                user = await _context.Users
                    .Include(u => u.UserOrganizations)
                    .Include(u => u.UserBranches)
                    .Include(u => u.UserPermissions)
                    .FirstOrDefaultAsync(u => u.Id == data.Id);

                if (user == null)
                    return NotFound("Пользователь не найден.");

                user.FullName = data.FullName;
                user.Email = data.Email;
                user.Login = data.Login;

                if (!string.IsNullOrWhiteSpace(data.Password))
                    user.Password = HashPassword(data.Password);

                if (!string.IsNullOrWhiteSpace(data.PhotoPath))
                    user.PhotoPath = data.PhotoPath;

                _context.UserOrganizations.RemoveRange(user.UserOrganizations);
                _context.UserBranches.RemoveRange(user.UserBranches);
                _context.UserPermissions.RemoveRange(user.UserPermissions);
                await _context.SaveChangesAsync();
            }

            // --- Организации ---
            foreach (var orgId in data.Organizations.Distinct())
            {
                _context.UserOrganizations.Add(new UserOrganization
                {
                    UserId = user.Id,
                    OrganizationId = orgId
                });
            }

            // --- Филиалы ---
            foreach (var branchId in data.Branches.Distinct())
            {
                _context.UserBranches.Add(new UserBranch
                {
                    UserId = user.Id,
                    BranchId = branchId
                });
            }

            // --- Права ---
            foreach (var p in data.Permissions)
            {
                if (p.OrganizationIds == null || p.BranchIds == null)
                    continue;

                foreach (var orgId in p.OrganizationIds)
                {
                    foreach (var brId in p.BranchIds)
                    {
                        _context.UserPermissions.Add(new UserPermission
                        {
                            UserId = user.Id,
                            PermissionId = p.PermissionId,
                            OrganizationId = orgId,
                            BranchId = brId
                        });
                    }
                }
            }

            await _context.SaveChangesAsync();

            // ✅ если редактируется текущий пользователь — обновляем сессию
            var currentId = HttpContext.Session.GetInt32("UserId");
            if (currentId != null && currentId == user.Id)
            {
                HttpContext.Session.SetString("FullName", user.FullName ?? "");

                var photoPath = string.IsNullOrEmpty(user.PhotoPath)
                    ? "~/icons/default-avatar.png"
                    : user.PhotoPath;

                HttpContext.Session.SetString("PhotoPath", photoPath);
            }

            return new JsonResult(new { success = true, isNew });
        }


        //  5. УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ 
        [ValidateAntiForgeryToken] // <— добавлено
        public async Task<IActionResult> OnPostDeleteUserAsync(int id)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
            if (user == null)
                return new JsonResult(new { success = false });

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
            return new JsonResult(new { success = true });
        }

        //  6. CRUD ДЛЯ ОРГАНИЗАЦИЙ 
        public async Task<IActionResult> OnGetGetOrgsAsync()
        {
            var orgs = await _context.Organizations
                .Select(o => new
                {
                    id = o.Id,
                    name = o.Name,
                    inn = o.INN,
                    kpp = o.KPP,
                    ogrn = o.OGRN
                })
                .ToListAsync();

            return new JsonResult(orgs);
        }

        [ValidateAntiForgeryToken] // <— добавлено
        public async Task<IActionResult> OnPostSaveOrgAsync([FromBody] OrgDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
                return new JsonResult(new { success = false });

            Organization org;
            if (dto.Id == 0)
            {
                org = new Organization
                {
                    Name = dto.Name,
                    INN = dto.Inn ?? "",
                    KPP = dto.Kpp ?? "",
                    OGRN = dto.Ogrn ?? "",
                };
                _context.Organizations.Add(org);
            }
            else
            {
                org = await _context.Organizations.FirstOrDefaultAsync(o => o.Id == dto.Id);
                if (org == null)
                    return new JsonResult(new { success = false });

                org.Name = dto.Name;
                org.INN = dto.Inn ?? "";
                org.KPP = dto.Kpp ?? "";
                org.OGRN = dto.Ogrn ?? "";
            }

            await _context.SaveChangesAsync();
            return new JsonResult(new { success = true });
        }

        [ValidateAntiForgeryToken] // <— добавлено
        public async Task<IActionResult> OnPostDeleteOrgAsync(int id)
        {
            var org = await _context.Organizations.FirstOrDefaultAsync(o => o.Id == id);
            if (org == null)
                return new JsonResult(new { success = false });

            _context.Organizations.Remove(org);
            await _context.SaveChangesAsync();
            return new JsonResult(new { success = true });
        }

        //  7. CRUD ДЛЯ ФИЛИАЛОВ 
        public async Task<IActionResult> OnGetGetBranchesAsync()
        {
            var branches = await _context.Branches
                .Include(b => b.Organization)
                .Select(b => new
                {
                    id = b.Id,
                    address = b.Address,
                    organization = b.Organization.Name,
                    organizationId = b.Organization.Id
                })
                .ToListAsync();

            return new JsonResult(branches);
        }

        [ValidateAntiForgeryToken] // <— добавлено
        public async Task<IActionResult> OnPostSaveBranchAsync([FromBody] BranchDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Address))
                return new JsonResult(new { success = false });

            Branch branch;
            if (dto.Id == 0)
            {
                branch = new Branch
                {
                    Address = dto.Address,
                    OrganizationId = dto.OrganizationId
                };
                _context.Branches.Add(branch);
            }
            else
            {
                branch = await _context.Branches.FirstOrDefaultAsync(b => b.Id == dto.Id);
                if (branch == null)
                    return new JsonResult(new { success = false });

                branch.Address = dto.Address;
                branch.OrganizationId = dto.OrganizationId;
            }

            await _context.SaveChangesAsync();
            return new JsonResult(new { success = true });
        }

        [ValidateAntiForgeryToken] // <— добавлено
        public async Task<IActionResult> OnPostDeleteBranchAsync(int id)
        {
            var branch = await _context.Branches.FirstOrDefaultAsync(b => b.Id == id);
            if (branch == null)
                return new JsonResult(new { success = false });

            _context.Branches.Remove(branch);
            await _context.SaveChangesAsync();
            return new JsonResult(new { success = true });
        }

        //  8. ВСПОМОГАТЕЛЬНЫЕ 
        private static string GeneratePassword()
        {
            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
            var rand = new Random();
            return new string(Enumerable.Range(0, 10)
                .Select(_ => chars[rand.Next(chars.Length)]).ToArray());
        }

        private static string HashPassword(string password)
        {
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(password));
            return BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
        }
        //  9. ЗАГРУЗКА ФОТО ПОЛЬЗОВАТЕЛЯ 
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> OnPostUploadPhotoAsync(IFormFile photo)
        {
            if (photo == null || photo.Length == 0)
                return new JsonResult(new { success = false, message = "Файл не получен" });

            // создаём директорию, если её нет
            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "users");
            if (!Directory.Exists(uploadsDir))
                Directory.CreateDirectory(uploadsDir);

            // генерируем уникальное имя
            var fileName = $"{Guid.NewGuid()}{Path.GetExtension(photo.FileName)}";
            var filePath = Path.Combine(uploadsDir, fileName);

            // сохраняем
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await photo.CopyToAsync(stream);
            }

            var relativePath = $"~/uploads/users/{fileName}";
            return new JsonResult(new { success = true, path = relativePath });
        }


        //  DTO 
        public class UserDisplayDto
        {
            public int Id { get; set; }
            public string FullName { get; set; } = "";
            public string Email { get; set; } = "";
            public string Login { get; set; } = "";
            public List<string> Organizations { get; set; } = new();
            public List<string> Branches { get; set; } = new();
        }

        public class UserSaveDto
        {
            public int Id { get; set; }
            public string FullName { get; set; } = "";
            public string Email { get; set; } = "";
            public string Login { get; set; } = "";
            public string? Password { get; set; }
            public string? PhotoPath { get; set; }

            public List<int> Organizations { get; set; } = new();
            public List<int> Branches { get; set; } = new();
            public List<PermissionDto> Permissions { get; set; } = new();
        }

        public class PermissionDto
        {
            public int PermissionId { get; set; }
            public List<int>? OrganizationIds { get; set; }
            public List<int>? BranchIds { get; set; }
        }

        public class OrgDto
        {
            public int Id { get; set; }
            public string Name { get; set; } = "";
            public string? Inn { get; set; }

            public string? Kpp { get; set; }
            public string? Ogrn { get; set; }
        }

        public class BranchDto
        {
            public int Id { get; set; }
            public string Address { get; set; } = "";
            public int OrganizationId { get; set; }
        }
    }
}
