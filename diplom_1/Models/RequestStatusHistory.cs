namespace diplom_1.Models
{
    public class RequestStatusHistory
    {
        public int Id { get; set; }

        public int RequestId { get; set; }
        public Request Request { get; set; }

        public string Status { get; set; } = "";
        public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    }
}
