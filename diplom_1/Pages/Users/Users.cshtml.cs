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
using System;
using System.Threading;

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

        public int CurrentUserId { get; set; }

        public bool IsSuperAdmin { get; set; }
        public bool CanCreateOrganization { get; set; }
        public bool CanCreateBranch { get; set; }

        public async Task OnGetAsync()
        {
            var currentUserId = HttpContext.Session.GetInt32("UserId");
            CurrentUserId = currentUserId ?? 0;

            IsSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;

            var userOrgsString = HttpContext.Session.GetString("UserOrganizations");
            var userOrgIds = string.IsNullOrEmpty(userOrgsString)
                ? new List<int>()
                : userOrgsString
                    .Split(',')
                    .Where(x => !string.IsNullOrEmpty(x))
                    .Select(int.Parse)
                    .ToList();

            var usersQuery = _context.Users
                .Include(u => u.UserOrganizations)
                    .ThenInclude(uo => uo.Organization)
                .Include(u => u.UserBranches)
                    .ThenInclude(ub => ub.Branch)
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
            var currentUserId = HttpContext.Session.GetInt32("UserId") ?? 0;
            var isCurrentUserSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;

            var user = await _context.Users
                .Include(u => u.UserOrganizations)
                .Include(u => u.UserBranches)
                .Include(u => u.UserPermissions)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null)
            {
                return NotFound();
            }

            if (!isCurrentUserSuperAdmin && user.IsSuperAdmin && user.Id != currentUserId)
            {
                return Forbid();
            }

            return new JsonResult(new
            {
                id = user.Id,
                fullName = user.FullName,
                email = user.Email,
                login = user.Login,
                isSuperAdmin = user.IsSuperAdmin,
                photoPath = string.IsNullOrEmpty(user.PhotoPath)
                    ? "/icons/default-avatar.png"
                    : user.PhotoPath.Replace("~", ""),
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
            {
                return BadRequest("Нет данных.");
            }

            try
            {
                User user;
                bool isNew = data.Id == 0;
                string? generatedPassword = null;

                var currentUserId = HttpContext.Session.GetInt32("UserId");
                var isCurrentUserSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;

                var currentUserOrgs = HttpContext.Session.GetString("UserOrganizations")?
                    .Split(',')
                    .Where(x => !string.IsNullOrEmpty(x))
                    .Select(int.Parse)
                    .ToList() ?? new List<int>();

                data.FullName = data.FullName?.Trim() ?? "";
                data.Email = data.Email?.Trim() ?? "";
                data.Login = data.Login?.Trim() ?? "";
                data.Organizations ??= new List<int>();
                data.Branches ??= new List<int>();
                data.Permissions ??= new List<PermissionDto>();

                var userDataValidation = await ValidateUserSaveDataAsync(
                    data,
                    isNew,
                    currentUserId,
                    isCurrentUserSuperAdmin,
                    currentUserOrgs
                );

                if (!userDataValidation.Success)
                {
                    return new JsonResult(new
                    {
                        success = false,
                        message = userDataValidation.Message
                    });
                }

                var permissionsValidation = ValidateUserPermissions(data.Permissions);

                if (!permissionsValidation.Success)
                {
                    return new JsonResult(new
                    {
                        success = false,
                        message = permissionsValidation.Message
                    });
                }

                if (!isCurrentUserSuperAdmin)
                {
                    var requestedPermissionOrgIds = data.Permissions
                        .SelectMany(p => p.OrganizationIds ?? new List<int>())
                        .Where(id => id > 0)
                        .Distinct()
                        .ToList();

                    if (requestedPermissionOrgIds.Any(orgId => !currentUserOrgs.Contains(orgId)))
                    {
                        return new JsonResult(new
                        {
                            success = false,
                            message = "Вы не можете назначать права для недоступной организации"
                        });
                    }

                    var requestedBranchIds = data.Permissions
                        .SelectMany(p => p.BranchIds ?? new List<int>())
                        .Where(id => id > 0)
                        .Distinct()
                        .ToList();

                    if (requestedBranchIds.Any())
                    {
                        bool hasForbiddenBranches = await _context.Branches
                            .AnyAsync(b =>
                                requestedBranchIds.Contains(b.Id) &&
                                !currentUserOrgs.Contains(b.OrganizationId));

                        if (hasForbiddenBranches)
                        {
                            return new JsonResult(new
                            {
                                success = false,
                                message = "Вы не можете назначать права для филиалов недоступных организаций"
                            });
                        }
                    }
                }

                if (isNew)
                {
                    if (!isCurrentUserSuperAdmin && data.Organizations.Any(orgId => !currentUserOrgs.Contains(orgId)))
                    {
                        return new JsonResult(new
                        {
                            success = false,
                            message = "Вы не можете создать пользователя в этой организации"
                        });
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
                    {
                        return NotFound("Пользователь не найден.");
                    }

                    if (!isCurrentUserSuperAdmin)
                    {
                        var allowedOrgIds = currentUserOrgs;
                        var userOrgIds = user.UserOrganizations.Select(uo => uo.OrganizationId).ToList();

                        if (!userOrgIds.All(orgId => allowedOrgIds.Contains(orgId)))
                        {
                            return new JsonResult(new
                            {
                                success = false,
                                message = "У вас нет прав на редактирование этого пользователя"
                            });
                        }
                    }

                    user.FullName = data.FullName;
                    user.Email = data.Email;
                    user.Login = data.Login;

                    if (!string.IsNullOrWhiteSpace(data.Password))
                    {
                        user.Password = HashPassword(data.Password);
                    }

                    if (!string.IsNullOrWhiteSpace(data.PhotoPath))
                    {
                        user.PhotoPath = data.PhotoPath;
                    }

                    if (isCurrentUserSuperAdmin)
                    {
                        if (currentUserId.HasValue && data.Id == currentUserId.Value)
                        {
                            user.IsSuperAdmin = true;
                        }
                        else
                        {
                            user.IsSuperAdmin = data.IsSuperAdmin;
                        }
                    }

                    _context.UserOrganizations.RemoveRange(user.UserOrganizations);
                    _context.UserBranches.RemoveRange(user.UserBranches);
                    _context.UserPermissions.RemoveRange(user.UserPermissions);

                    await _context.SaveChangesAsync();
                }

                foreach (var orgId in data.Organizations.Distinct())
                {
                    if (!isCurrentUserSuperAdmin && !currentUserOrgs.Contains(orgId))
                    {
                        continue;
                    }

                    _context.UserOrganizations.Add(new UserOrganization
                    {
                        UserId = user.Id,
                        OrganizationId = orgId
                    });
                }

                foreach (var branchId in data.Branches.Distinct())
                {
                    var branch = await _context.Branches
                        .AsNoTracking()
                        .FirstOrDefaultAsync(b => b.Id == branchId);

                    if (branch == null)
                    {
                        continue;
                    }

                    if (!isCurrentUserSuperAdmin && !currentUserOrgs.Contains(branch.OrganizationId))
                    {
                        continue;
                    }

                    _context.UserBranches.Add(new UserBranch
                    {
                        UserId = user.Id,
                        BranchId = branchId
                    });
                }

                foreach (var p in data.Permissions)
                {
                    var organizationIds = p.OrganizationIds?
                        .Where(id => id > 0)
                        .Distinct()
                        .ToList() ?? new List<int>();

                    var branchIds = p.BranchIds?
                        .Where(id => id > 0)
                        .Distinct()
                        .ToList() ?? new List<int>();

                    foreach (var orgId in organizationIds)
                    {
                        if (!isCurrentUserSuperAdmin && !currentUserOrgs.Contains(orgId))
                        {
                            continue;
                        }

                        _context.UserPermissions.Add(new UserPermission
                        {
                            UserId = user.Id,
                            PermissionId = p.PermissionId,
                            OrganizationId = orgId,
                            BranchId = null
                        });
                    }

                    foreach (var branchId in branchIds)
                    {
                        var branch = await _context.Branches
                            .AsNoTracking()
                            .FirstOrDefaultAsync(b => b.Id == branchId);

                        if (branch == null)
                        {
                            continue;
                        }

                        if (!isCurrentUserSuperAdmin && !currentUserOrgs.Contains(branch.OrganizationId))
                        {
                            continue;
                        }

                        _context.UserPermissions.Add(new UserPermission
                        {
                            UserId = user.Id,
                            PermissionId = p.PermissionId,
                            OrganizationId = branch.OrganizationId,
                            BranchId = branchId
                        });
                    }
                }

                await _context.SaveChangesAsync();

                if (data.SendEmail)
                {
                    string? passwordToSend = isNew ? (generatedPassword ?? data.Password) : data.Password;

                    if (!string.IsNullOrEmpty(passwordToSend))
                    {
                        await SendCredentialsEmail(user.Email, user.Login, passwordToSend);
                    }
                }

                if (currentUserId != null && currentUserId == user.Id)
                {
                    HttpContext.Session.SetString("FullName", user.FullName ?? "");

                    var photoPath = string.IsNullOrEmpty(user.PhotoPath)
                        ? "~/icons/default-avatar.png"
                        : user.PhotoPath;

                    HttpContext.Session.SetString("PhotoPath", photoPath);
                    HttpContext.Session.SetInt32("IsSuperAdmin", user.IsSuperAdmin ? 1 : 0);
                }

                return new JsonResult(new
                {
                    success = true,
                    isNew
                });
            }
            catch (Exception ex)
            {
                return new JsonResult(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }

        [ValidateAntiForgeryToken]
        public async Task<IActionResult> OnPostDeleteUserAsync(int id)
        {
            var currentUserId = HttpContext.Session.GetInt32("UserId");
            var isCurrentUserSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;

            if (currentUserId.HasValue && id == currentUserId.Value)
            {
                return new JsonResult(new
                {
                    success = false,
                    message = "Нельзя удалить самого себя"
                });
            }

            var user = await _context.Users
                .Include(u => u.UserOrganizations)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null)
            {
                return new JsonResult(new
                {
                    success = false,
                    message = "Пользователь не найден"
                });
            }

            if (!isCurrentUserSuperAdmin)
            {
                var currentUserOrgs = HttpContext.Session.GetString("UserOrganizations")?
                    .Split(',')
                    .Where(x => !string.IsNullOrEmpty(x))
                    .Select(int.Parse)
                    .ToList() ?? new List<int>();

                if (!user.UserOrganizations.Any(uo => currentUserOrgs.Contains(uo.OrganizationId)))
                {
                    return new JsonResult(new
                    {
                        success = false,
                        message = "У вас нет прав на удаление этого пользователя"
                    });
                }
            }

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return new JsonResult(new
            {
                success = true
            });
        }

        public async Task<IActionResult> OnGetGetUsersAsync(int page = 1, int pageSize = 10, string? orgIds = null, string? branchIds = null)
        {
            var currentUserId = HttpContext.Session.GetInt32("UserId");
            var isSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;

            var userOrgIds = HttpContext.Session.GetString("UserOrganizations")?
                .Split(',')
                .Where(x => !string.IsNullOrEmpty(x))
                .Select(int.Parse)
                .ToList() ?? new List<int>();

            var selectedOrgIds = string.IsNullOrEmpty(orgIds)
                ? new List<int>()
                : orgIds.Split(',').Where(x => !string.IsNullOrEmpty(x)).Select(int.Parse).ToList();

            var selectedBranchIds = string.IsNullOrEmpty(branchIds)
                ? new List<int>()
                : branchIds.Split(',').Where(x => !string.IsNullOrEmpty(x)).Select(int.Parse).ToList();

            var usersQuery = _context.Users
                .Include(u => u.UserOrganizations)
                    .ThenInclude(uo => uo.Organization)
                .Include(u => u.UserBranches)
                    .ThenInclude(ub => ub.Branch)
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
                totalCount,
                page,
                pageSize,
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
                    city = o.City,
                    inn = o.INN,
                    kpp = o.KPP,
                    ogrn = o.OGRN,
                    workHoursLimit = o.WorkHoursLimit,
                    products = o.OrganizationProducts.Select(op => op.Product.Name).ToList(),
                    canEdit = isSuperAdmin || canEditOrgPermissions.Contains(o.Id),
                    canDelete = isSuperAdmin || canDeleteOrgPermissions.Contains(o.Id)
                })
                .ToListAsync();

            return new JsonResult(new
            {
                data = orgs,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }

        [ValidateAntiForgeryToken]
        public async Task<IActionResult> OnPostSaveOrgAsync([FromBody] OrgDto dto)
        {
            if (dto == null)
            {
                return new JsonResult(new
                {
                    success = false,
                    message = "Нет данных организации"
                });
            }

            dto.Name = dto.Name?.Trim() ?? "";
            dto.City = dto.City?.Trim() ?? "";
            dto.Inn = dto.Inn?.Trim() ?? "";
            dto.Kpp = dto.Kpp?.Trim() ?? "";
            dto.Ogrn = dto.Ogrn?.Trim() ?? "";

            var orgValidation = ValidateOrganizationDto(dto);
            if (!orgValidation.Success)
            {
                return new JsonResult(new
                {
                    success = false,
                    message = orgValidation.Message
                });
            }

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
                    return new JsonResult(new
                    {
                        success = false,
                        message = "У вас нет прав на редактирование этой организации"
                    });
                }
            }

            try
            {
                Organization org;

                if (dto.Id == 0)
                {
                    if (!isSuperAdmin)
                    {
                        return new JsonResult(new
                        {
                            success = false,
                            message = "Только супер-администратор может создавать организации"
                        });
                    }

                    org = new Organization
                    {
                        Name = dto.Name,
                        City = dto.City ?? "",
                        INN = dto.Inn ?? "",
                        KPP = dto.Kpp ?? "",
                        OGRN = dto.Ogrn ?? "",
                        WorkHoursLimit = dto.WorkHoursLimit
                    };

                    _context.Organizations.Add(org);
                    await _context.SaveChangesAsync();

                    if (dto.ProductIds != null && dto.ProductIds.Any())
                    {
                        foreach (var productId in dto.ProductIds.Distinct())
                        {
                            _context.OrganizationProducts.Add(new OrganizationProduct
                            {
                                OrganizationId = org.Id,
                                ProductId = productId
                            });
                        }

                        await _context.SaveChangesAsync();
                    }
                }
                else
                {
                    org = await _context.Organizations.FirstOrDefaultAsync(o => o.Id == dto.Id);

                    if (org == null)
                    {
                        return new JsonResult(new
                        {
                            success = false,
                            message = "Организация не найдена"
                        });
                    }

                    org.Name = dto.Name;
                    org.City = dto.City ?? "";
                    org.INN = dto.Inn ?? "";
                    org.KPP = dto.Kpp ?? "";
                    org.OGRN = dto.Ogrn ?? "";
                    org.WorkHoursLimit = dto.WorkHoursLimit;

                    var oldProducts = _context.OrganizationProducts.Where(op => op.OrganizationId == org.Id);
                    _context.OrganizationProducts.RemoveRange(oldProducts);

                    if (dto.ProductIds != null && dto.ProductIds.Any())
                    {
                        foreach (var productId in dto.ProductIds.Distinct())
                        {
                            _context.OrganizationProducts.Add(new OrganizationProduct
                            {
                                OrganizationId = org.Id,
                                ProductId = productId
                            });
                        }
                    }

                    await _context.SaveChangesAsync();
                }

                return new JsonResult(new
                {
                    success = true
                });
            }
            catch (Exception ex)
            {
                return new JsonResult(new
                {
                    success = false,
                    message = ex.Message
                });
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
                    return new JsonResult(new
                    {
                        success = false,
                        message = "У вас нет прав на удаление этой организации"
                    });
                }
            }

            var org = await _context.Organizations
                .Include(o => o.Branches)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (org == null)
            {
                return new JsonResult(new
                {
                    success = false,
                    message = "Организация не найдена"
                });
            }

            var branchIds = org.Branches.Select(b => b.Id).ToList();

            var relatedRequests = await _context.Requests
                .Where(r =>
                    r.OrganizationId == id ||
                    (r.BranchId != null && branchIds.Contains(r.BranchId.Value)))
                .ToListAsync();

            foreach (var request in relatedRequests)
            {
                if (request.OrganizationId == id)
                {
                    request.OrganizationId = null;
                }

                if (request.BranchId != null && branchIds.Contains(request.BranchId.Value))
                {
                    request.BranchId = null;
                }
            }

            var userPermissions = await _context.UserPermissions
                .Where(up =>
                    up.OrganizationId == id ||
                    (up.BranchId != null && branchIds.Contains(up.BranchId.Value)))
                .ToListAsync();
            _context.UserPermissions.RemoveRange(userPermissions);

            var userBranches = await _context.UserBranches
                .Where(ub => branchIds.Contains(ub.BranchId))
                .ToListAsync();
            _context.UserBranches.RemoveRange(userBranches);

            var userOrganizations = await _context.UserOrganizations
                .Where(uo => uo.OrganizationId == id)
                .ToListAsync();
            _context.UserOrganizations.RemoveRange(userOrganizations);

            var organizationProducts = await _context.OrganizationProducts
                .Where(op => op.OrganizationId == id)
                .ToListAsync();
            _context.OrganizationProducts.RemoveRange(organizationProducts);

            _context.Branches.RemoveRange(org.Branches);
            _context.Organizations.Remove(org);

            await _context.SaveChangesAsync();

            return new JsonResult(new
            {
                success = true
            });
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

            var branchesQuery = _context.Branches
                .Include(b => b.Organization)
                .AsQueryable();

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
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }

        [ValidateAntiForgeryToken]
        public async Task<IActionResult> OnPostSaveBranchAsync([FromBody] BranchDto dto)
        {
            if (dto == null)
            {
                return new JsonResult(new
                {
                    success = false,
                    message = "Нет данных филиала"
                });
            }

            dto.Address = dto.Address?.Trim() ?? "";

            if (string.IsNullOrWhiteSpace(dto.Address))
            {
                return new JsonResult(new
                {
                    success = false,
                    message = "Адрес филиала обязателен"
                });
            }

            if (dto.Address.Length < 5)
            {
                return new JsonResult(new
                {
                    success = false,
                    message = "Адрес филиала должен быть подробнее"
                });
            }

            if (dto.OrganizationId <= 0 || !await _context.Organizations.AnyAsync(o => o.Id == dto.OrganizationId))
            {
                return new JsonResult(new
                {
                    success = false,
                    message = "Выберите существующую организацию"
                });
            }

            var isSuperAdmin = HttpContext.Session.GetInt32("IsSuperAdmin") == 1;

            var userOrgIds = HttpContext.Session.GetString("UserOrganizations")?
                .Split(',')
                .Where(x => !string.IsNullOrEmpty(x))
                .Select(int.Parse)
                .ToList() ?? new List<int>();

            if (!isSuperAdmin && !userOrgIds.Contains(dto.OrganizationId))
            {
                return new JsonResult(new
                {
                    success = false,
                    message = "У вас нет прав на создание филиала в этой организации"
                });
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
                    {
                        return new JsonResult(new
                        {
                            success = false,
                            message = "Филиал не найден"
                        });
                    }

                    if (!isSuperAdmin && !userOrgIds.Contains(branch.OrganizationId))
                    {
                        return new JsonResult(new
                        {
                            success = false,
                            message = "У вас нет прав на редактирование этого филиала"
                        });
                    }

                    branch.Address = dto.Address;
                    branch.OrganizationId = dto.OrganizationId;
                }

                await _context.SaveChangesAsync();

                return new JsonResult(new
                {
                    success = true
                });
            }
            catch (Exception ex)
            {
                return new JsonResult(new
                {
                    success = false,
                    message = ex.Message
                });
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
            {
                return new JsonResult(new
                {
                    success = false,
                    message = "Филиал не найден"
                });
            }

            if (!isSuperAdmin && !userOrgIds.Contains(branch.OrganizationId))
            {
                return new JsonResult(new
                {
                    success = false,
                    message = "У вас нет прав на удаление этого филиала"
                });
            }

            var relatedRequests = await _context.Requests
                .Where(r => r.BranchId == id)
                .ToListAsync();

            foreach (var request in relatedRequests)
            {
                request.BranchId = null;
            }

            var userPermissions = await _context.UserPermissions
                .Where(up => up.BranchId == id)
                .ToListAsync();
            _context.UserPermissions.RemoveRange(userPermissions);

            var userBranches = await _context.UserBranches
                .Where(ub => ub.BranchId == id)
                .ToListAsync();
            _context.UserBranches.RemoveRange(userBranches);

            _context.Branches.Remove(branch);
            await _context.SaveChangesAsync();

            return new JsonResult(new
            {
                success = true
            });
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

            var orgsQuery = _context.Organizations
                .Include(o => o.Branches)
                .AsQueryable();

            if (!isSuperAdmin)
            {
                orgsQuery = orgsQuery.Where(o => userOrgIds.Contains(o.Id));
            }

            var orgs = await orgsQuery
                .Select(o => new
                {
                    id = o.Id,
                    name = o.Name,
                    branches = o.Branches.Select(b => new
                    {
                        id = b.Id,
                        address = b.Address
                    })
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

            var roles = Array.Empty<object>();

            return new JsonResult(new
            {
                orgs,
                perms,
                roles
            });
        }

        public async Task<IActionResult> OnGetGetProductsForOrgAsync(int orgId)
        {
            var allProducts = await _context.Products
                .OrderBy(p => p.Name)
                .Select(p => new
                {
                    p.Id,
                    p.Name
                })
                .ToListAsync();

            var selectedProductIds = await _context.OrganizationProducts
                .Where(op => op.OrganizationId == orgId)
                .Select(op => op.ProductId)
                .ToListAsync();

            return new JsonResult(new
            {
                allProducts,
                selectedProductIds
            });
        }

        [ValidateAntiForgeryToken]
        public async Task<IActionResult> OnPostUploadPhotoAsync(IFormFile photo)
        {
            if (photo == null || photo.Length == 0)
            {
                return new JsonResult(new
                {
                    success = false
                });
            }

            try
            {
                var uploadsDir = Path.Combine(
                    Directory.GetCurrentDirectory(),
                    "wwwroot",
                    "uploads",
                    "users"
                );

                if (!Directory.Exists(uploadsDir))
                {
                    Directory.CreateDirectory(uploadsDir);
                }

                var extension = Path.GetExtension(photo.FileName);
                var fileName = $"{Guid.NewGuid()}{extension}";
                var filePath = Path.Combine(uploadsDir, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await photo.CopyToAsync(stream);
                }

                var relativePath = $"~/uploads/users/{fileName}";

                return new JsonResult(new
                {
                    success = true,
                    path = relativePath
                });
            }
            catch
            {
                return new JsonResult(new
                {
                    success = false
                });
            }
        }

        private static ValidationResult ValidateOrganizationDto(OrgDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                return ValidationResult.Fail("Укажите название организации");
            }

            if (string.IsNullOrWhiteSpace(dto.City))
            {
                return ValidationResult.Fail("Укажите город организации");
            }

            if (string.IsNullOrWhiteSpace(dto.Inn))
            {
                return ValidationResult.Fail("Укажите ИНН организации");
            }

            if (dto.Inn.Any(ch => !char.IsDigit(ch)))
            {
                return ValidationResult.Fail("ИНН должен содержать только цифры");
            }

            if (string.IsNullOrWhiteSpace(dto.Kpp))
            {
                return ValidationResult.Fail("Укажите КПП организации");
            }

            if (dto.Kpp.Any(ch => !char.IsDigit(ch)))
            {
                return ValidationResult.Fail("КПП должен содержать только цифры");
            }

            if (string.IsNullOrWhiteSpace(dto.Ogrn))
            {
                return ValidationResult.Fail("Укажите ОГРН организации");
            }

            if (dto.Ogrn.Any(ch => !char.IsDigit(ch)))
            {
                return ValidationResult.Fail("ОГРН должен содержать только цифры");
            }

            if (dto.WorkHoursLimit < 0)
            {
                return ValidationResult.Fail("Лимит часов не может быть отрицательным");
            }

            return ValidationResult.Ok();
        }

        private async Task<ValidationResult> ValidateUserSaveDataAsync(
            UserSaveDto data,
            bool isNew,
            int? currentUserId,
            bool isCurrentUserSuperAdmin,
            List<int> currentUserOrgs)
        {
            if (string.IsNullOrWhiteSpace(data.FullName))
            {
                return ValidationResult.Fail("Укажите ФИО пользователя");
            }

            if (string.IsNullOrWhiteSpace(data.Email))
            {
                return ValidationResult.Fail("Укажите email пользователя");
            }

            try
            {
                _ = new System.Net.Mail.MailAddress(data.Email);
            }
            catch
            {
                return ValidationResult.Fail("Укажите корректный email пользователя");
            }

            if (string.IsNullOrWhiteSpace(data.Login))
            {
                return ValidationResult.Fail("Укажите логин пользователя");
            }

            if (data.Login.Any(char.IsWhiteSpace))
            {
                return ValidationResult.Fail("Логин не должен содержать пробелы");
            }

            var normalizedOrgIds = data.Organizations
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            var normalizedBranchIds = data.Branches
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            data.Organizations = normalizedOrgIds;
            data.Branches = normalizedBranchIds;

            if (!normalizedOrgIds.Any())
            {
                return ValidationResult.Fail("Выберите хотя бы одну организацию пользователя");
            }

            if (!isCurrentUserSuperAdmin && normalizedOrgIds.Any(orgId => !currentUserOrgs.Contains(orgId)))
            {
                return ValidationResult.Fail("Вы не можете назначить пользователю недоступную организацию");
            }

            var userId = isNew ? 0 : data.Id;

            var loginExists = await _context.Users
                .AnyAsync(u => u.Id != userId && u.Login == data.Login);

            if (loginExists)
            {
                return ValidationResult.Fail("Пользователь с таким логином уже существует");
            }

            var emailExists = await _context.Users
                .AnyAsync(u => u.Id != userId && u.Email == data.Email);

            if (emailExists)
            {
                return ValidationResult.Fail("Пользователь с таким email уже существует");
            }

            var existingOrgIds = await _context.Organizations
                .Where(o => normalizedOrgIds.Contains(o.Id))
                .Select(o => o.Id)
                .ToListAsync();

            if (existingOrgIds.Count != normalizedOrgIds.Count)
            {
                return ValidationResult.Fail("Выбрана несуществующая организация");
            }

            if (normalizedBranchIds.Any())
            {
                var branches = await _context.Branches
                    .Where(b => normalizedBranchIds.Contains(b.Id))
                    .Select(b => new { b.Id, b.OrganizationId })
                    .ToListAsync();

                if (branches.Count != normalizedBranchIds.Count)
                {
                    return ValidationResult.Fail("Выбран несуществующий филиал");
                }

                if (branches.Any(b => !normalizedOrgIds.Contains(b.OrganizationId)))
                {
                    return ValidationResult.Fail("Выбранный филиал не относится к выбранной организации пользователя");
                }

                if (!isCurrentUserSuperAdmin && branches.Any(b => !currentUserOrgs.Contains(b.OrganizationId)))
                {
                    return ValidationResult.Fail("Вы не можете назначить пользователю филиал недоступной организации");
                }
            }

            var permissionIds = data.Permissions
                .Select(p => p.PermissionId)
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            if (permissionIds.Any())
            {
                var existingPermissionCount = await _context.Permissions
                    .CountAsync(p => permissionIds.Contains(p.Id));

                if (existingPermissionCount != permissionIds.Count)
                {
                    return ValidationResult.Fail("Выбрано несуществующее право доступа");
                }
            }

            foreach (var permission in data.Permissions)
            {
                var permissionOrgIds = permission.OrganizationIds?
                    .Where(id => id > 0)
                    .Distinct()
                    .ToList() ?? new List<int>();

                var permissionBranchIds = permission.BranchIds?
                    .Where(id => id > 0)
                    .Distinct()
                    .ToList() ?? new List<int>();

                permission.OrganizationIds = permissionOrgIds;
                permission.BranchIds = permissionBranchIds;

                if (permissionOrgIds.Any(orgId => !normalizedOrgIds.Contains(orgId)))
                {
                    return ValidationResult.Fail("Права можно назначать только в рамках организаций пользователя");
                }

                if (permissionBranchIds.Any(branchId => !normalizedBranchIds.Contains(branchId)))
                {
                    return ValidationResult.Fail("Права можно назначать только в рамках филиалов пользователя");
                }
            }

            return ValidationResult.Ok();
        }

        private static ValidationResult ValidateUserPermissions(List<PermissionDto>? permissions)
        {
            if (permissions == null || !permissions.Any())
            {
                return ValidationResult.Ok();
            }

            foreach (var permission in permissions)
            {
                if (permission.PermissionId <= 0)
                {
                    return ValidationResult.Fail("Выбрано некорректное право");
                }

                var hasOrganizations = permission.OrganizationIds != null &&
                                       permission.OrganizationIds.Any(id => id > 0);

                var hasBranches = permission.BranchIds != null &&
                                  permission.BranchIds.Any(id => id > 0);

                if (!hasOrganizations && !hasBranches)
                {
                    return ValidationResult.Fail(
                        "Для каждого выбранного права необходимо указать организацию или филиал"
                    );
                }
            }

            return ValidationResult.Ok();
        }

        private string GeneratePassword(int length = 10)
        {
            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
            var random = new Random();

            return new string(
                Enumerable
                    .Repeat(chars, length)
                    .Select(s => s[random.Next(s.Length)])
                    .ToArray()
            );
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
                _logger.LogInformation("Email получателя: {Email}", email);
                _logger.LogInformation("Логин: {Login}", login);

                var smtpSettings = _smtpSettings.Value;

                _logger.LogInformation(
                    "SMTP Host: {Host}, Port: {Port}",
                    smtpSettings.Host,
                    smtpSettings.Port
                );

                var message = new MimeMessage();

                message.From.Add(new MailboxAddress(smtpSettings.FromName, smtpSettings.FromEmail));
                message.To.Add(new MailboxAddress("", email));
                message.Subject = "Данные для входа в систему";

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
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
</html>"
                };

                message.Body = bodyBuilder.ToMessageBody();

                using var client = new SmtpClient();
                using var smtpTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(8));

                client.Timeout = 8000;
                client.ServerCertificateValidationCallback = (s, c, h, e) => true;

                await client.ConnectAsync(
                    smtpSettings.Host,
                    smtpSettings.Port,
                    SecureSocketOptions.SslOnConnect,
                    smtpTimeout.Token
                );

                await client.AuthenticateAsync(
                    smtpSettings.Username,
                    smtpSettings.Password,
                    smtpTimeout.Token
                );

                await client.SendAsync(message, smtpTimeout.Token);
                await client.DisconnectAsync(true, smtpTimeout.Token);

                _logger.LogInformation("=== ПИСЬМО УСПЕШНО ОТПРАВЛЕНО ===");
            }
            catch (OperationCanceledException ex)
            {
                _logger.LogWarning(
                    ex,
                    "Отправка письма с данными входа прервана по лимиту 8 секунд. Пользователь сохранён без ожидания письма."
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Ошибка отправки письма с данными входа. Пользователь сохранён."
                );
            }
        }


        private class ValidationResult
        {
            public bool Success { get; set; }
            public string Message { get; set; } = "";

            public static ValidationResult Ok()
            {
                return new ValidationResult
                {
                    Success = true
                };
            }

            public static ValidationResult Fail(string message)
            {
                return new ValidationResult
                {
                    Success = false,
                    Message = message
                };
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
            public string? City { get; set; }
            public string? Inn { get; set; }
            public string? Kpp { get; set; }
            public string? Ogrn { get; set; }
            public double WorkHoursLimit { get; set; }
            public List<int>? ProductIds { get; set; }
        }

        public class BranchDto
        {
            public int Id { get; set; }
            public string Address { get; set; } = "";
            public int OrganizationId { get; set; }
        }
    }
}
