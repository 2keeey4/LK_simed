using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace diplom_1.Models
{
    public class Edition
    {
        public int Id { get; set; }

        [Required]
        [StringLength(150)]
        public string Name { get; set; } = string.Empty;

        // 🔹 Связь с продуктом (1 продукт — много редакций)
        public int ProductId { get; set; }
        public Product Product { get; set; } = null!;

        // 🔹 Лицензии, относящиеся к этой редакции
        public ICollection<License> Licenses { get; set; } = new List<License>();
    }
}
