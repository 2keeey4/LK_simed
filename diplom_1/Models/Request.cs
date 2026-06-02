using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace diplom_1.Models
{
    public class Request
    {
        public int Id { get; set; }

        [Required]
        public string Title { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        public int RequestTopicId { get; set; }
        public RequestTopic? RequestTopic { get; set; }

        public int? ProductId { get; set; }
        public Product? Product { get; set; }

        public int RequestPriorityId { get; set; }
        public RequestPriority? RequestPriority { get; set; }

        public int RequestStatusId { get; set; }
        public RequestStatus? RequestStatus { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int? CreatedById { get; set; }
        public User? CreatedBy { get; set; }

        public int? OrganizationId { get; set; }
        public Organization? Organization { get; set; }

        public int? BranchId { get; set; }
        public Branch? Branch { get; set; }

        public ICollection<Comment> Comments { get; set; } = new List<Comment>();
        public ICollection<Attachment> Attachments { get; set; } = new List<Attachment>();
        public ICollection<RequestStatusHistory> StatusHistory { get; set; } = new List<RequestStatusHistory>();
    }
}