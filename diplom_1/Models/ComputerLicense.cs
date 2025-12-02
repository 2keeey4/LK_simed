using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace diplom_1.Models
{
    public class ComputerLicense
    {
        [Key]
        public int Id { get; set; }

        [StringLength(100)]
        public string ComputerName { get; set; } = string.Empty;

        // 🔹 Лицензия, которая установлена
        public int LicenseId { get; set; }
        public License License { get; set; } = null!;

        // 🔹 Компьютер, на котором установлена
        public int ComputerId { get; set; }
        public Computer Computer { get; set; } = null!;

        // 🔹 Филиал (если нужно отслеживать, где установлено)
        public int? BranchId { get; set; }
        public Branch? Branch { get; set; }

        // 🔹 Продукт — нужно добавить для связи с лицензией и UI
        public int? ProductId { get; set; }       // ← вот это новое свойство
        public Product? Product { get; set; }     // ← и его навигационное поле

        public int? EditionId { get; set; }
        public Edition? Edition { get; set; }

        public int? ModuleId { get; set; }
        public Module? Module { get; set; }

        public int? OrganizationId { get; set; }   // 👈 добавь это
        public Organization? Organization { get; set; }  // 👈 и это


        // 🔹 Период действия установки
        [Column(TypeName = "timestamp without time zone")]
        public DateTime StartDate { get; set; } = DateTime.Now;

        [Column(TypeName = "timestamp without time zone")]
        public DateTime EndDate { get; set; } = DateTime.Now.AddYears(1);

        // 🔹 Статус активации
        [Required]
        public string Status { get; set; } = "Активна";

        // 🔹 Вычисляемый флаг
        [NotMapped]
        public bool IsExpired => EndDate < DateTime.Now;
    }
}
