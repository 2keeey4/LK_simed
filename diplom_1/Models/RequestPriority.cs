using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace diplom_1.Models
{
    public class RequestPriority
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(80)]
        public string Name { get; set; } = string.Empty;

        [Range(0.1, 10)]
        public double Coefficient { get; set; } = 1.0;

        public ICollection<Request> Requests { get; set; } = new List<Request>();
    }
}
