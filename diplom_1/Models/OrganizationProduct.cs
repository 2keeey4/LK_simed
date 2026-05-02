namespace diplom_1.Models
{
    public class OrganizationProduct
    {
        public int OrganizationId { get; set; }
        public Organization? Organization { get; set; }

        public int ProductId { get; set; }
        public Product? Product { get; set; }
    }
}