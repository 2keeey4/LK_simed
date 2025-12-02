using System;
using System.ComponentModel.DataAnnotations;

namespace diplom_1.Models
{
    public class Request
    {
        public int Id { get; set; }

        [Required]
        public string Title { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        [Required]
        public string? Topic { get; set; }

        // Продукт через связь
        public int? ProductId { get; set; }
        public Product? Product { get; set; }

        public string Priority { get; set; } = "Средний";
        public string Status { get; set; } = "Создана";

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public int? CreatedById { get; set; }
        public User? CreatedBy { get; set; } = null!;

        public int? OrganizationId { get; set; }
        public Organization? Organization { get; set; } = null!;

        public int? BranchId { get; set; }
        public Branch? Branch { get; set; }

        public ICollection<Comment> Comments { get; set; } = new List<Comment>();
        public ICollection<Attachment> Attachments { get; set; } = new List<Attachment>();

    }
}
