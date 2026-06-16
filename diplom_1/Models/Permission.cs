using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace diplom_1.Models
{
    public class Permission
    {
        public int Id { get; set; }

        [Required]
        public string Module { get; set; } = string.Empty; 

        [Required]
        public string Action { get; set; } = string.Empty; 

        public string? Description { get; set; }


        public ICollection<UserPermission> UserPermissions { get; set; } = new List<UserPermission>();
    }
}
