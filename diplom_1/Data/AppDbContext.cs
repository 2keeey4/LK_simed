using diplom_1.Models;
using Microsoft.EntityFrameworkCore;

namespace diplom_1.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // --- Основные сущности ---
        public DbSet<User> Users { get; set; }
        public DbSet<Organization> Organizations { get; set; }
        public DbSet<Branch> Branches { get; set; }
        public DbSet<UserBranch> UserBranches { get; set; }
        public DbSet<UserOrganization> UserOrganizations { get; set; }

        public DbSet<Request> Requests { get; set; }
        public DbSet<Product> Products { get; set; }

        // --- Новые таблицы для лицензий ---
        public DbSet<Computer> Computers { get; set; }
        public DbSet<ComputerLicense> ComputerLicenses { get; set; }
        public DbSet<License> Licenses { get; set; }
        public DbSet<Edition> Editions { get; set; }
        public DbSet<Module> Modules { get; set; }

        // --- Комментарии и вложения ---
        public DbSet<Comment> Comments { get; set; }
        public DbSet<Attachment> Attachments { get; set; }

        // --- Система ролей и прав ---
        public DbSet<Permission> Permissions { get; set; }
        public DbSet<UserPermission> UserPermissions { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<RolePermission> RolePermissions { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // --- UserOrganization ---
            modelBuilder.Entity<UserOrganization>()
                .HasKey(uo => new { uo.UserId, uo.OrganizationId });

            modelBuilder.Entity<UserOrganization>()
                .HasOne(uo => uo.User)
                .WithMany(u => u.UserOrganizations)
                .HasForeignKey(uo => uo.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserOrganization>()
                .HasOne(uo => uo.Organization)
                .WithMany(o => o.UserOrganizations)
                .HasForeignKey(uo => uo.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            // --- UserBranch ---
            modelBuilder.Entity<UserBranch>()
                .HasKey(ub => new { ub.UserId, ub.BranchId });

            modelBuilder.Entity<UserBranch>()
                .HasOne(ub => ub.User)
                .WithMany(u => u.UserBranches)
                .HasForeignKey(ub => ub.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserBranch>()
                .HasOne(ub => ub.Branch)
                .WithMany(b => b.UserBranches)
                .HasForeignKey(ub => ub.BranchId)
                .OnDelete(DeleteBehavior.Cascade);

            // --- UserPermission ---
            modelBuilder.Entity<UserPermission>()
                .HasOne(up => up.User)
                .WithMany(u => u.UserPermissions)
                .HasForeignKey(up => up.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserPermission>()
                .HasOne(up => up.Permission)
                .WithMany(p => p.UserPermissions)
                .HasForeignKey(up => up.PermissionId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserPermission>()
                .HasOne(up => up.Organization)
                .WithMany()
                .HasForeignKey(up => up.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<UserPermission>()
                .HasOne(up => up.Branch)
                .WithMany()
                .HasForeignKey(up => up.BranchId)
                .OnDelete(DeleteBehavior.Restrict);

            // --- RolePermission ---
            modelBuilder.Entity<RolePermission>()
                .HasOne(rp => rp.Role)
                .WithMany(r => r.RolePermissions)
                .HasForeignKey(rp => rp.RoleId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<RolePermission>()
                .HasOne(rp => rp.Permission)
                .WithMany(p => p.RolePermissions)
                .HasForeignKey(rp => rp.PermissionId)
                .OnDelete(DeleteBehavior.Cascade);

            // --- Request ---
            modelBuilder.Entity<Request>()
                .HasOne(r => r.CreatedBy)
                .WithMany()
                .HasForeignKey(r => r.CreatedById)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Request>()
                .HasOne(r => r.Organization)
                .WithMany()
                .HasForeignKey(r => r.OrganizationId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Request>()
                .HasOne(r => r.Branch)
                .WithMany()
                .HasForeignKey(r => r.BranchId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Request>()
                .HasOne(r => r.Product)
                .WithMany(p => p.Requests)
                .HasForeignKey(r => r.ProductId)
                .OnDelete(DeleteBehavior.SetNull);

            // --- Comment ---
            modelBuilder.Entity<Comment>()
                .HasOne(c => c.Request)
                .WithMany(r => r.Comments)
                .HasForeignKey(c => c.RequestId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Comment>()
                .HasOne(c => c.Author)
                .WithMany()
                .HasForeignKey(c => c.AuthorId)
                .OnDelete(DeleteBehavior.SetNull);

            // --- Attachment ---
            modelBuilder.Entity<Attachment>()
                .HasOne(a => a.Request)
                .WithMany(r => r.Attachments)
                .HasForeignKey(a => a.RequestId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Attachment>()
                .HasOne(a => a.Comment)
                .WithMany(c => c.Attachments)
                .HasForeignKey(a => a.CommentId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}