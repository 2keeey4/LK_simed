using System.Collections.Generic;

namespace diplom_1.Models
{
    public class Product
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;

        public ICollection<Request> Requests { get; set; } = new List<Request>();
        public ICollection<Module>? Modules { get; set; }
        public ICollection<Edition> Editions { get; set; } = new List<Edition>();
        public ICollection<License> Licenses { get; set; } = new List<License>();
    }
}
