using System.ComponentModel.DataAnnotations;

namespace diplom_1.Models
{
    public class Module
    {
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [StringLength(50)]
        public string? Article { get; set; }

        [StringLength(50)]
        public string? PaymentPeriod { get; set; }

        public string? Description { get; set; }

        // ✅ Правильная связь: модуль принадлежит продукту
        public int? ProductId { get; set; }
        public Product? Product { get; set; }
    }
}
