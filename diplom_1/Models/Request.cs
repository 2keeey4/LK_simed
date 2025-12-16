using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace diplom_1.Models
{
    public class Request
    {
        public int Id { get; set; }

        [Required]
        public string Title { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        public string Topic { get; set; } = string.Empty;

        public int? ProductId { get; set; }
        public Product? Product { get; set; }

        public string Priority { get; set; } = "Средний";
        public string Status { get; set; } = "Создана";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int? CreatedById { get; set; }
        public User? CreatedBy { get; set; }

        public int? OrganizationId { get; set; }
        public Organization? Organization { get; set; }

        // ВАЖНО: только одно свойство BranchId
        public int? BranchId { get; set; }
        public Branch? Branch { get; set; }

        // Убедитесь, что НЕТ этих свойств:
        // public int? BranchId1 { get; set; }
        // public Branch? Branch1 { get; set; }

        // Коллекции (могут быть пустыми)
        public ICollection<Comment> Comments { get; set; } = new List<Comment>();
        public ICollection<Attachment> Attachments { get; set; } = new List<Attachment>();
        public ICollection<RequestStatusHistory> StatusHistory { get; set; } = new List<RequestStatusHistory>();

        // Если нужен конструктор
       
    }
}