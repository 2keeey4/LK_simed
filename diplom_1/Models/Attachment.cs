using System;
using System.ComponentModel.DataAnnotations;

namespace diplom_1.Models
{
    public class Attachment
    {
        public int Id { get; set; }

        [Required]
        public string FilePath { get; set; } = string.Empty;

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        public int? RequestId { get; set; }
        public Request? Request { get; set; }

        public int? CommentId { get; set; }
        public Comment? Comment { get; set; }
    }
}
