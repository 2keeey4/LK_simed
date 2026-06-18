using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace diplom_1.Models
{
    public class RequestTopic
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        [Range(0.1, 120)]
        public double BaseHours { get; set; } = 5;

        public ICollection<Request> Requests { get; set; } = new List<Request>();
    }
}