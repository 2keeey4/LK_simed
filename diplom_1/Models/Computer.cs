using System.ComponentModel.DataAnnotations;

namespace diplom_1.Models
{
    public class Computer
    {
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty; // Имя ПК, например ПК-1

        // --- Привязка к филиалу ---
        public int? BranchId { get; set; }
        public Branch? Branch { get; set; }


        // --- Один ПК имеет одну лицензию ---
        public int? LicenseId { get; set; }
        public License? License { get; set; }

        // --- Привязка к организации ---
        public int? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
    }
}
