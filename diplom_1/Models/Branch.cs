namespace diplom_1.Models
{
    public class Branch
    {
        public int Id { get; set; }
        public string Address { get; set; } = string.Empty; // переименовано из Name


        public int OrganizationId { get; set; }
        public Organization? Organization { get; set; }


        public ICollection<UserBranch> UserBranches { get; set; } = new List<UserBranch>();

        public ICollection<Request> Requests { get; set; } = new List<Request>();
    }
}
