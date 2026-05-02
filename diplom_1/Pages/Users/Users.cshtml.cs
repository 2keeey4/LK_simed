using diplom_1.Data;
using diplom_1.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace diplom_1.Pages.Users
{
    public class UsersModel : PageModel
    {
        private readonly IOptions<SmtpSettings> _smtpSettings;
        private readonly AppDbContext _context;
        private readonly ILogger<UsersModel> _logger;

        public UsersModel(AppDbContext context, IOptions<SmtpSettings> smtpSettings, ILogger<UsersModel> logger)
        {
            _context = context;
            _smtpSettings = smtpSettings;
            _logger = logger;
        }

        public List<UserDisplayDto> Users { get; set; } = new();
        public bool IsSuperAdmin { get; set; }
        public bool CanCreateOrganization { get; set; }
        public bool CanCreateBranch { get; set; }

        public async Task OnGetAsync()
        {
            var currentUserId = HttpContext.Session.GetInt32("UserId");
            IsSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;

            var userOrgsString = HttpContext.Session.GetString("UserOrganizations");
            var userOrgIds = string.IsNullOrEmpty(userOrgsString)
                ? new List<int>()
                : userOrgsString.Split(',').Where(x => !string.IsNullOrEmpty(x)).Select(int.Parse).ToList();

            var usersQuery = _context.Users
                .Include(u => u.UserOrganizations).ThenInclude(uo => uo.Organization)
                .Include(u => u.UserBranches).ThenInclude(ub => ub.Branch)
                .Where(u => u.UserOrganizations.Any(uo => userOrgIds.Contains(uo.OrganizationId)))
                .AsQueryable();

            if (!IsSuperAdmin)
            {
                usersQuery = usersQuery.Where(u => !u.IsSuperAdmin || u.Id == currentUserId);
            }

            var filteredUsers = await usersQuery.ToListAsync();

            Users = filteredUsers.Select(u => new UserDisplayDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Email = u.Email,
                Login = u.Login,
                Organizations = u.UserOrganizations.Select(o => o.Organization.Name).ToList(),
                Branches = u.UserBranches.Select(b => b.Branch.Address).ToList()
            }).ToList();

            CanCreateOrganization = IsSuperAdmin || await _context.UserPermissions
                .AnyAsync(up => up.UserId == currentUserId
                    && up.Permission.Module == "Организации"
                    && up.Permission.Action == "Добавление/редактирование");

            CanCreateBranch = IsSuperAdmin || await _context.UserPermissions
                .AnyAsync(up => up.UserId == currentUserId
                    && up.Permission.Module == "Филиалы"
                    && up.Permission.Action == "Добавление/редактирование");
        }

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
                isSuperAdmin = user.IsSuperAdmin,
                photoPath = string.IsNullOrEmpty(user.PhotoPath) ? "/icons/default-avatar.png" : user.PhotoPath.Replace("~", ""),
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

        [ValidateAntiForgeryToken]
        public async Task<IActionResult> OnPostSaveUserAsync([FromBody] UserSaveDto data)
        {
            if (data == null)
                return BadRequest("Нет данных.");

            try
            {
                User user;
                bool isNew = data.Id == 0;
                string generatedPassword = null;

                var currentUserId = HttpContext.Session.GetInt32("UserId");
                var isCurrentUserSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;
                var currentUserOrgs = HttpContext.Session.GetString("UserOrganizations")?
                    .Split(',')
                    .Where(x => !string.IsNullOrEmpty(x))
                    .Select(int.Parse)
                    .ToList() ?? new List<int>();

                if (isNew)
                {
                    if (!isCurrentUserSuperAdmin && data.Organizations.Any(orgId => !currentUserOrgs.Contains(orgId)))
                    {
                        return new JsonResult(new { success = false, message = "Вы не можете создать пользователя в этой организации" });
                    }

                    generatedPassword = GeneratePassword();
                    user = new User
                    {
                        FullName = data.FullName,
                        Email = data.Email,
                        Login = data.Login,
                        Password = HashPassword(string.IsNullOrEmpty(data.Password) ? generatedPassword : data.Password),
                        PhotoPath = string.IsNullOrWhiteSpace(data.PhotoPath) ? "~/icons/default-avatar.png" : data.PhotoPath,
                        IsSuperAdmin = isCurrentUserSuperAdmin && data.IsSuperAdmin
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

                    if (!isCurrentUserSuperAdmin)
                    {
                        var allowedOrgIds = currentUserOrgs;
                        var userOrgIds = user.UserOrganizations.Select(uo => uo.OrganizationId).ToList();
                        if (!userOrgIds.All(orgId => allowedOrgIds.Contains(orgId)))
                        {
                            return new JsonResult(new { success = false, message = "У вас нет прав на редактирование этого пользователя" });
                        }
                    }

                    user.FullName = data.FullName;
                    user.Email = data.Email;
                    user.Login = data.Login;

                    if (!string.IsNullOrWhiteSpace(data.Password))
                        user.Password = HashPassword(data.Password);

                    if (!string.IsNullOrWhiteSpace(data.PhotoPath))
                        user.PhotoPath = data.PhotoPath;

                    if (isCurrentUserSuperAdmin && data.Id != currentUserId)
                    {
                        user.IsSuperAdmin = data.IsSuperAdmin;
                    }

                    _context.UserOrganizations.RemoveRange(user.UserOrganizations);
                    _context.UserBranches.RemoveRange(user.UserBranches);
                    _context.UserPermissions.RemoveRange(user.UserPermissions);
                    await _context.SaveChangesAsync();
                }

                foreach (var orgId in data.Organizations.Distinct())
                {
                    if (!isCurrentUserSuperAdmin && !currentUserOrgs.Contains(orgId))
                        continue;

                    _context.UserOrganizations.Add(new UserOrganization
                    {
                        UserId = user.Id,
                        OrganizationId = orgId
                    });
                }

                foreach (var branchId in data.Branches.Distinct())
                {
                    _context.UserBranches.Add(new UserBranch
                    {
                        UserId = user.Id,
                        BranchId = branchId
                    });
                }

                foreach (var p in data.Permissions)
                {
                    if (p.OrganizationIds == null || p.BranchIds == null)
                        continue;

                    foreach (var orgId in p.OrganizationIds)
                    {
                        if (!isCurrentUserSuperAdmin && !currentUserOrgs.Contains(orgId))
                            continue;

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

                if (data.SendEmail)
                {
                    string passwordToSend = isNew ? (generatedPassword ?? data.Password) : data.Password;
                    if (!string.IsNullOrEmpty(passwordToSend))
                    {
                        await SendCredentialsEmail(user.Email, user.Login, passwordToSend);
                    }
                }

                if (currentUserId != null && currentUserId == user.Id)
                {
                    HttpContext.Session.SetString("FullName", user.FullName ?? "");
                    var photoPath = string.IsNullOrEmpty(user.PhotoPath) ? "~/icons/default-avatar.png" : user.PhotoPath;
                    HttpContext.Session.SetString("PhotoPath", photoPath);
                }

                return new JsonResult(new { success = true, isNew });
            }
            catch (Exception ex)
            {
                return new JsonResult(new { success = false, message = ex.Message });
            }
        }

        [ValidateAntiForgeryToken]
        public async Task<IActionResult> OnPostDeleteUserAsync(int id)
        {
            var currentUserId = HttpContext.Session.GetInt32("UserId");
            var isCurrentUserSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;

            var user = await _context.Users
                .Include(u => u.UserOrganizations)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null)
                return new JsonResult(new { success = false });

            if (!isCurrentUserSuperAdmin)
            {
                var currentUserOrgs = HttpContext.Session.GetString("UserOrganizations")?
                    .Split(',')
                    .Where(x => !string.IsNullOrEmpty(x))
                    .Select(int.Parse)
                    .ToList() ?? new List<int>();

                if (!user.UserOrganizations.Any(uo => currentUserOrgs.Contains(uo.OrganizationId)))
                {
                    return new JsonResult(new { success = false, message = "У вас нет прав на удаление этого пользователя" });
                }
            }

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
            return new JsonResult(new { success = true });
        }

        public async Task<IActionResult> OnGetGetUsersAsync(int page = 1, int pageSize = 10, string orgIds = null, string branchIds = null)
        {
            var currentUserId = HttpContext.Session.GetInt32("UserId");
            var isSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;

            var userOrgIds = HttpContext.Session.GetString("UserOrganizations")?
                .Split(',')
                .Where(x => !string.IsNullOrEmpty(x))
                .Select(int.Parse)
                .ToList() ?? new List<int>();

            var selectedOrgIds = string.IsNullOrEmpty(orgIds) ? new List<int>() : orgIds.Split(',').Select(int.Parse).ToList();
            var selectedBranchIds = string.IsNullOrEmpty(branchIds) ? new List<int>() : branchIds.Split(',').Select(int.Parse).ToList();

            var usersQuery = _context.Users
                .Include(u => u.UserOrganizations).ThenInclude(uo => uo.Organization)
                .Include(u => u.UserBranches).ThenInclude(ub => ub.Branch)
                .Where(u => u.UserOrganizations.Any(uo => userOrgIds.Contains(uo.OrganizationId)))
                .AsQueryable();

            if (!isSuperAdmin)
            {
                usersQuery = usersQuery.Where(u => !u.IsSuperAdmin || u.Id == currentUserId);
            }

            if (selectedOrgIds.Any())
            {
                usersQuery = usersQuery.Where(u => u.UserOrganizations.Any(uo => selectedOrgIds.Contains(uo.OrganizationId)));
            }

            if (selectedBranchIds.Any())
            {
                usersQuery = usersQuery.Where(u => u.UserBranches.Any(ub => selectedBranchIds.Contains(ub.BranchId)));
            }

            var totalCount = await usersQuery.CountAsync();

            var users = await usersQuery
                .OrderBy(u => u.FullName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(u => new
                {
                    id = u.Id,
                    fullName = u.FullName,
                    login = u.Login,
                    email = u.Email,
                    organizations = u.UserOrganizations.Select(o => o.Organization.Name).ToList(),
                    branches = u.UserBranches.Select(b => b.Branch.Address).ToList()
                })
                .ToListAsync();

            return new JsonResult(new
            {
                data = users,
                totalCount = totalCount,
                page = page,
                pageSize = pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }

        public async Task<IActionResult> OnGetGetOrgsAsync(int page = 1, int pageSize = 10)
        {
            var currentUserId = HttpContext.Session.GetInt32("UserId");
            var isSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;

            var userOrgIds = HttpContext.Session.GetString("UserOrganizations")?
                .Split(',')
                .Where(x => !string.IsNullOrEmpty(x))
                .Select(int.Parse)
                .ToList() ?? new List<int>();

            var canEditOrgPermissions = await _context.UserPermissions
                .Where(up => up.UserId == currentUserId
                    && up.Permission.Module == "Организации"
                    && up.Permission.Action == "Добавление/редактирование")
                .Select(up => up.OrganizationId)
                .ToListAsync();

            var canDeleteOrgPermissions = await _context.UserPermissions
                .Where(up => up.UserId == currentUserId
                    && up.Permission.Module == "Организации"
                    && up.Permission.Action == "Удаление")
                .Select(up => up.OrganizationId)
                .ToListAsync();

            var orgsQuery = _context.Organizations.AsQueryable();

            if (!isSuperAdmin)
            {
                orgsQuery = orgsQuery.Where(o => userOrgIds.Contains(o.Id));
            }

            var totalCount = await orgsQuery.CountAsync();

            var orgs = await orgsQuery
                .OrderBy(o => o.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(o => new
                {
                    id = o.Id,
                    name = o.Name,
                    inn = o.INN,
                    kpp = o.KPP,
                    ogrn = o.OGRN,
                    workHoursLimit = o.WorkHoursLimit,
                    canEdit = isSuperAdmin || canEditOrgPermissions.Contains(o.Id),
                    canDelete = isSuperAdmin || canDeleteOrgPermissions.Contains(o.Id)
                })
                .ToListAsync();

            return new JsonResult(new
            {
                data = orgs,
                totalCount = totalCount,
                page = page,
                pageSize = pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }

        [ValidateAntiForgeryToken]
        public async Task<IActionResult> OnPostSaveOrgAsync([FromBody] OrgDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
                return new JsonResult(new { success = false, message = "Название организации обязательно" });

            var isSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;

            if (!isSuperAdmin && dto.Id != 0)
            {
                var userOrgIds = HttpContext.Session.GetString("UserOrganizations")?
                    .Split(',')
                    .Where(x => !string.IsNullOrEmpty(x))
                    .Select(int.Parse)
                    .ToList() ?? new List<int>();

                if (!userOrgIds.Contains(dto.Id))
                {
                    return new JsonResult(new { success = false, message = "У вас нет прав на редактирование этой организации" });
                }
            }

            try
            {
                Organization org;
                if (dto.Id == 0)
                {
                    if (!isSuperAdmin)
                        return new JsonResult(new { success = false, message = "Только супер-администратор может создавать организации" });

                    org = new Organization
                    {
                        Name = dto.Name,
                        INN = dto.Inn ?? "",
                        KPP = dto.Kpp ?? "",
                        OGRN = dto.Ogrn ?? "",
                        WorkHoursLimit = dto.WorkHoursLimit
                    };
                    _context.Organizations.Add(org);
                }
                else
                {
                    org = await _context.Organizations.FirstOrDefaultAsync(o => o.Id == dto.Id);
                    if (org == null)
                        return new JsonResult(new { success = false, message = "Организация не найдена" });

                    org.Name = dto.Name;
                    org.INN = dto.Inn ?? "";
                    org.KPP = dto.Kpp ?? "";
                    org.OGRN = dto.Ogrn ?? "";
                    org.WorkHoursLimit = dto.WorkHoursLimit;
                }

                await _context.SaveChangesAsync();
                return new JsonResult(new { success = true });
            }
            catch (Exception ex)
            {
                return new JsonResult(new { success = false, message = ex.Message });
            }
        }

        [ValidateAntiForgeryToken]
        public async Task<IActionResult> OnPostDeleteOrgAsync(int id)
        {
            var isSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;

            if (!isSuperAdmin)
            {
                var userOrgIds = HttpContext.Session.GetString("UserOrganizations")?
                    .Split(',')
                    .Where(x => !string.IsNullOrEmpty(x))
                    .Select(int.Parse)
                    .ToList() ?? new List<int>();

                if (!userOrgIds.Contains(id))
                {
                    return new JsonResult(new { success = false, message = "У вас нет прав на удаление этой организации" });
                }
            }

            var org = await _context.Organizations
                .Include(o => o.Branches)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (org == null)
                return new JsonResult(new { success = false });

            if (org.Branches.Any())
                return new JsonResult(new { success = false, message = "Сначала удалите филиалы" });

            _context.Organizations.Remove(org);
            await _context.SaveChangesAsync();
            return new JsonResult(new { success = true });
        }

        public async Task<IActionResult> OnGetGetBranchesAsync(int page = 1, int pageSize = 10)
        {
            var currentUserId = HttpContext.Session.GetInt32("UserId");
            var isSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;

            var userOrgIds = HttpContext.Session.GetString("UserOrganizations")?
                .Split(',')
                .Where(x => !string.IsNullOrEmpty(x))
                .Select(int.Parse)
                .ToList() ?? new List<int>();

            var canEditBranchPermissions = await _context.UserPermissions
                .Where(up => up.UserId == currentUserId
                    && up.Permission.Module == "Филиалы"
                    && up.Permission.Action == "Добавление/редактирование")
                .Select(up => up.OrganizationId)
                .ToListAsync();

            var canDeleteBranchPermissions = await _context.UserPermissions
                .Where(up => up.UserId == currentUserId
                    && up.Permission.Module == "Филиалы"
                    && up.Permission.Action == "Удаление")
                .Select(up => up.OrganizationId)
                .ToListAsync();

            var branchesQuery = _context.Branches.Include(b => b.Organization).AsQueryable();

            if (!isSuperAdmin)
            {
                branchesQuery = branchesQuery.Where(b => userOrgIds.Contains(b.OrganizationId));
            }

            var totalCount = await branchesQuery.CountAsync();

            var branches = await branchesQuery
                .OrderBy(b => b.Address)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(b => new
                {
                    id = b.Id,
                    address = b.Address,
                    organization = b.Organization.Name,
                    organizationId = b.Organization.Id,
                    canEdit = isSuperAdmin || canEditBranchPermissions.Contains(b.OrganizationId),
                    canDelete = isSuperAdmin || canDeleteBranchPermissions.Contains(b.OrganizationId)
                })
                .ToListAsync();

            return new JsonResult(new
            {
                data = branches,
                totalCount = totalCount,
                page = page,
                pageSize = pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }

        [ValidateAntiForgeryToken]
        public async Task<IActionResult> OnPostSaveBranchAsync([FromBody] BranchDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Address))
                return new JsonResult(new { success = false, message = "Адрес филиала обязателен" });

            var isSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;
            var userOrgIds = HttpContext.Session.GetString("UserOrganizations")?
                .Split(',')
                .Where(x => !string.IsNullOrEmpty(x))
                .Select(int.Parse)
                .ToList() ?? new List<int>();

            if (!isSuperAdmin && !userOrgIds.Contains(dto.OrganizationId))
            {
                return new JsonResult(new { success = false, message = "У вас нет прав на создание филиала в этой организации" });
            }

            try
            {
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
                        return new JsonResult(new { success = false, message = "Филиал не найден" });

                    if (!isSuperAdmin && !userOrgIds.Contains(branch.OrganizationId))
                    {
                        return new JsonResult(new { success = false, message = "У вас нет прав на редактирование этого филиала" });
                    }

                    branch.Address = dto.Address;
                    branch.OrganizationId = dto.OrganizationId;
                }

                await _context.SaveChangesAsync();
                return new JsonResult(new { success = true });
            }
            catch (Exception ex)
            {
                return new JsonResult(new { success = false, message = ex.Message });
            }
        }

        [ValidateAntiForgeryToken]
        public async Task<IActionResult> OnPostDeleteBranchAsync(int id)
        {
            var isSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;
            var userOrgIds = HttpContext.Session.GetString("UserOrganizations")?
                .Split(',')
                .Where(x => !string.IsNullOrEmpty(x))
                .Select(int.Parse)
                .ToList() ?? new List<int>();

            var branch = await _context.Branches.FirstOrDefaultAsync(b => b.Id == id);
            if (branch == null)
                return new JsonResult(new { success = false });

            if (!isSuperAdmin && !userOrgIds.Contains(branch.OrganizationId))
            {
                return new JsonResult(new { success = false, message = "У вас нет прав на удаление этого филиала" });
            }

            _context.Branches.Remove(branch);
            await _context.SaveChangesAsync();
            return new JsonResult(new { success = true });
        }

        public async Task<IActionResult> OnGetDictionariesAsync()
        {
            var currentUserId = HttpContext.Session.GetInt32("UserId");
            var isSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;

            var userOrgIds = HttpContext.Session.GetString("UserOrganizations")?
                .Split(',')
                .Where(x => !string.IsNullOrEmpty(x))
                .Select(int.Parse)
                .ToList() ?? new List<int>();

            var orgsQuery = _context.Organizations.Include(o => o.Branches).AsQueryable();

            if (!isSuperAdmin)
            {
                orgsQuery = orgsQuery.Where(o => userOrgIds.Contains(o.Id));
            }

            var orgs = await orgsQuery
                .Select(o => new
                {
                    id = o.Id,
                    name = o.Name,
                    branches = o.Branches.Select(b => new { id = b.Id, address = b.Address })
                })
                .ToListAsync();

            List<dynamic> perms;

            if (isSuperAdmin)
            {
                perms = await _context.Permissions
                    .Select(p => new
                    {
                        id = p.Id,
                        module = p.Module.Trim(),
                        action = p.Action.Trim()
                    })
                    .OrderBy(p => p.module)
                    .ThenBy(p => p.action)
                    .ToListAsync<dynamic>();
            }
            else
            {
                var userPermissionIds = await _context.UserPermissions
                    .Where(up => up.UserId == currentUserId)
                    .Select(up => up.PermissionId)
                    .Distinct()
                    .ToListAsync();

                perms = await _context.Permissions
                    .Where(p => userPermissionIds.Contains(p.Id))
                    .Select(p => new
                    {
                        id = p.Id,
                        module = p.Module.Trim(),
                        action = p.Action.Trim()
                    })
                    .OrderBy(p => p.module)
                    .ThenBy(p => p.action)
                    .ToListAsync<dynamic>();
            }

            object roles = null;
            if (isSuperAdmin)
            {
                roles = await _context.Roles
                    .Include(r => r.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
                    .Select(r => new
                    {
                        id = r.Id,
                        name = r.Name,
                        permissions = r.RolePermissions.Select(rp => rp.PermissionId).ToList()
                    })
                    .ToListAsync();
            }

            return new JsonResult(new { orgs, perms, roles });
        }

        [ValidateAntiForgeryToken]
        public async Task<IActionResult> OnPostUploadPhotoAsync(IFormFile photo)
        {
            if (photo == null || photo.Length == 0)
                return new JsonResult(new { success = false });

            try
            {
                var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "users");
                if (!Directory.Exists(uploadsDir))
                    Directory.CreateDirectory(uploadsDir);

                var fileName = $"{Guid.NewGuid()}{Path.GetExtension(photo.FileName)}";
                var filePath = Path.Combine(uploadsDir, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await photo.CopyToAsync(stream);
                }

                var relativePath = $"~/uploads/users/{fileName}";
                return new JsonResult(new { success = true, path = relativePath });
            }
            catch
            {
                return new JsonResult(new { success = false });
            }
        }

        private string GeneratePassword(int length = 10)
        {
            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
            var random = new Random();
            return new string(Enumerable.Repeat(chars, length).Select(s => s[random.Next(s.Length)]).ToArray());
        }

        private string HashPassword(string password)
        {
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(password));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }

        private async Task SendCredentialsEmail(string email, string login, string password)
        {
            try
            {
                _logger.LogInformation("=== НАЧАЛО ОТПРАВКИ EMAIL ===");
                _logger.LogInformation($"Email получателя: {email}");
                _logger.LogInformation($"Логин: {login}");

                var smtpSettings = _smtpSettings.Value;
                _logger.LogInformation($"SMTP Host: {smtpSettings.Host}, Port: {smtpSettings.Port}");

                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(smtpSettings.FromName, smtpSettings.FromEmail));
                message.To.Add(new MailboxAddress("", email));
                message.Subject = "Данные для входа в систему";

                var bodyBuilder = new BodyBuilder();
                bodyBuilder.HtmlBody = $@"
<html>
<body>
    <h3>Здравствуйте!</h3>
    <p>Для вас была создана/обновлена учетная запись в системе.</p>
    <p><strong>Логин:</strong> {login}</p>
    <p><strong>Пароль:</strong> {password}</p>
    <p>Рекомендуем сменить пароль после первого входа.</p>
    <hr/>
    <small>Это письмо сгенерировано автоматически.</small>
</body>
</html>";

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;
                await client.ConnectAsync(smtpSettings.Host, smtpSettings.Port, SecureSocketOptions.SslOnConnect);
                await client.AuthenticateAsync(smtpSettings.Username, smtpSettings.Password);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);

                _logger.LogInformation("=== ПИСЬМО УСПЕШНО ОТПРАВЛЕНО ===");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка отправки email: {ex.Message}");
            }
        }

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
            public bool SendEmail { get; set; }
            public bool IsSuperAdmin { get; set; }
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
            public double WorkHoursLimit { get; set; }
        }

        public class BranchDto
        {
            public int Id { get; set; }
            public string Address { get; set; } = "";
            public int OrganizationId { get; set; }
        }
    }
}