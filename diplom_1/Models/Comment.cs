using diplom_1.Models;
using System.ComponentModel.DataAnnotations;

public class Comment
{
    public int Id { get; set; }

    [Required]
    public int RequestId { get; set; }
    public Request Request { get; set; } = null!;

    public int? AuthorId { get; set; }
    public User? Author { get; set; }

    [Required]
    public string Content { get; set; } = string.Empty;

    public bool IsInternal { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Attachment> Attachments { get; set; } = new List<Attachment>();
}