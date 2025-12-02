namespace diplom_1.Models
{
    public class UserPermission
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public int PermissionId { get; set; }
        public Permission Permission { get; set; } = null!;

        public int? OrganizationId { get; set; }
        public Organization? Organization { get; set; }

        public int? BranchId { get; set; }
        public Branch? Branch { get; set; }
    }
}
