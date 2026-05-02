namespace diplom_1.Models
{
    public class Organization
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;

        // Новые поля
        public string INN { get; set; } = string.Empty; // новое поле

        public string KPP { get; set; } = string.Empty;
        public string OGRN { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;

        public ICollection<Branch> Branches { get; set; } = new List<Branch>();
        public ICollection<UserOrganization> UserOrganizations { get; set; } = new List<UserOrganization>();
        public double WorkHoursLimit { get; set; } = 0; // лимит человеко-часов по договору

        public ICollection<OrganizationProduct> OrganizationProducts { get; set; } = new List<OrganizationProduct>();
    }
}
