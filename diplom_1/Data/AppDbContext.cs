using diplom_1.Models;
using Microsoft.EntityFrameworkCore;

namespace diplom_1.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Organization> Organizations { get; set; }
        public DbSet<Branch> Branches { get; set; }
        public DbSet<UserBranch> UserBranches { get; set; }
        public DbSet<UserOrganization> UserOrganizations { get; set; }

        public DbSet<Request> Requests { get; set; }
        public DbSet<RequestTopic> RequestTopics { get; set; }
        public DbSet<RequestPriority> RequestPriorities { get; set; }
        public DbSet<RequestStatus> RequestStatuses { get; set; }
        public DbSet<RequestStatusHistory> RequestStatusHistories { get; set; }

        public DbSet<Product> Products { get; set; }

        public DbSet<Computer> Computers { get; set; }
        public DbSet<ComputerLicense> ComputerLicenses { get; set; }
        public DbSet<License> Licenses { get; set; }
        public DbSet<Edition> Editions { get; set; }
        public DbSet<Module> Modules { get; set; }

        public DbSet<Comment> Comments { get; set; }
        public DbSet<Attachment> Attachments { get; set; }

        public DbSet<Permission> Permissions { get; set; }
        public DbSet<UserPermission> UserPermissions { get; set; }

        public DbSet<Role> Roles { get; set; }
        public DbSet<RolePermission> RolePermissions { get; set; }

        public DbSet<OrganizationProduct> OrganizationProducts { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            /* =========================
               USER - ORGANIZATION
            ========================= */

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

            /* =========================
               USER - BRANCH
            ========================= */

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

            /* =========================
               USER PERMISSIONS
            ========================= */

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

            /* =========================
               ROLE PERMISSIONS
            ========================= */

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

            /* =========================
               ORGANIZATION PRODUCTS
            ========================= */

            modelBuilder.Entity<OrganizationProduct>()
                .HasKey(op => new { op.OrganizationId, op.ProductId });

            modelBuilder.Entity<OrganizationProduct>()
                .HasOne(op => op.Organization)
                .WithMany(o => o.OrganizationProducts)
                .HasForeignKey(op => op.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<OrganizationProduct>()
                .HasOne(op => op.Product)
                .WithMany(p => p.OrganizationProducts)
                .HasForeignKey(op => op.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            /* =========================
               REQUEST DICTIONARIES
            ========================= */

            modelBuilder.Entity<RequestTopic>(entity =>
            {
                entity.HasIndex(t => t.Name)
                    .IsUnique();

                entity.HasData(
                    new RequestTopic { Id = 1, Name = "Техническая проблема" },
                    new RequestTopic { Id = 2, Name = "Консультация" },
                    new RequestTopic { Id = 3, Name = "Настройка" },
                    new RequestTopic { Id = 4, Name = "Доработка" },
                    new RequestTopic { Id = 5, Name = "Другое" }
                );
            });

            modelBuilder.Entity<RequestPriority>(entity =>
            {
                entity.HasIndex(p => p.Name)
                    .IsUnique();

                entity.HasData(
                    new RequestPriority { Id = 1, Name = "Низкий" },
                    new RequestPriority { Id = 2, Name = "Средний" },
                    new RequestPriority { Id = 3, Name = "Высокий" },
                    new RequestPriority { Id = 4, Name = "Критический" }
                );
            });

            modelBuilder.Entity<RequestStatus>(entity =>
            {
                entity.HasIndex(s => s.Name)
                    .IsUnique();

                entity.HasData(
                    new RequestStatus { Id = 1, Name = "Создана" },
                    new RequestStatus { Id = 2, Name = "В работе" },
                    new RequestStatus { Id = 3, Name = "Завершена" },
                    new RequestStatus { Id = 4, Name = "Отменена" }
                );
            });

            /* =========================
               REQUEST
            ========================= */

            modelBuilder.Entity<Request>(entity =>
            {
                entity.HasOne(r => r.CreatedBy)
                    .WithMany()
                    .HasForeignKey(r => r.CreatedById)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasOne(r => r.Organization)
                    .WithMany()
                    .HasForeignKey(r => r.OrganizationId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasOne(r => r.Branch)
                    .WithMany()
                    .HasForeignKey(r => r.BranchId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasOne(r => r.Product)
                    .WithMany(p => p.Requests)
                    .HasForeignKey(r => r.ProductId)
                    .OnDelete(DeleteBehavior.SetNull);

                entity.HasOne(r => r.RequestTopic)
                    .WithMany(t => t.Requests)
                    .HasForeignKey(r => r.RequestTopicId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(r => r.RequestPriority)
                    .WithMany(p => p.Requests)
                    .HasForeignKey(r => r.RequestPriorityId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(r => r.RequestStatus)
                    .WithMany(s => s.Requests)
                    .HasForeignKey(r => r.RequestStatusId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            /* =========================
               REQUEST STATUS HISTORY
            ========================= */

            modelBuilder.Entity<RequestStatusHistory>(entity =>
            {
                entity.HasOne(h => h.Request)
                    .WithMany(r => r.StatusHistory)
                    .HasForeignKey(h => h.RequestId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(h => h.RequestStatus)
                    .WithMany(s => s.StatusHistoryItems)
                    .HasForeignKey(h => h.RequestStatusId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(h => h.ChangedBy)
                    .WithMany()
                    .HasForeignKey(h => h.ChangedById)
                    .OnDelete(DeleteBehavior.SetNull);
            });

            /* =========================
               COMMENTS
            ========================= */

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

            /* =========================
               ATTACHMENTS
            ========================= */

            modelBuilder.Entity<Attachment>()
                .HasOne(a => a.Request)
                .WithMany(r => r.Attachments)
                .HasForeignKey(a => a.RequestId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Attachment>()
                .HasOne(a => a.Comment)
                .WithMany(c => c.Attachments)
                .HasForeignKey(a => a.CommentId)
                .OnDelete(DeleteBehavior.Restrict);

            /* =========================
               PRODUCT - MODULE
            ========================= */

            modelBuilder.Entity<Module>()
                .HasOne(m => m.Product)
                .WithMany(p => p.Modules)
                .HasForeignKey(m => m.ProductId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}