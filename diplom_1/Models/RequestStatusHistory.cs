using System;

namespace diplom_1.Models
{
    public class RequestStatusHistory
    {
        public int Id { get; set; }

        public int RequestId { get; set; }
        public Request Request { get; set; } = null!;

        public int RequestStatusId { get; set; }
        public RequestStatus RequestStatus { get; set; } = null!;

        public int? ChangedById { get; set; }
        public User? ChangedBy { get; set; }

        public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    }
}