namespace diplom_1.Models
{
    public class UserOrganization
    {
        public int UserId { get; set; }
        public User User { get; set; } = null!; // обязательно инициализируем

        public int OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!; // обязательно инициализируем

    }
}
