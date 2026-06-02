using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace diplom_1.Models
{
    public class RequestStatus
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(80)]
        public string Name { get; set; } = string.Empty;

        public ICollection<Request> Requests { get; set; } = new List<Request>();

        public ICollection<RequestStatusHistory> StatusHistoryItems { get; set; } = new List<RequestStatusHistory>();
    }
}