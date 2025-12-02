using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace diplom_1.Models
{
    public class License
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public string? Article { get; set; }
        public string? PaymentPeriod { get; set; }
        public string? Description { get; set; }

        // 🔹 Продукт — это и есть редакция
        public int? ProductId { get; set; }
        public Product? Product { get; set; }

        // 🔹 Модули, которые входят в лицензию
        public ICollection<Module> Modules { get; set; } = new List<Module>();

        // 🔹 Лицензия может быть установлена на несколько компьютеров
        public ICollection<ComputerLicense> ComputerLicenses { get; set; } = new List<ComputerLicense>();

        // 🔹 Редакция, к которой относится лицензия
        public int? EditionId { get; set; }
        public Edition? Edition { get; set; }


    }
}
