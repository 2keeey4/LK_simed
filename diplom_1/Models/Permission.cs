using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace diplom_1.Models
{
    public class Permission
    {
        public int Id { get; set; }

        [Required]
        public string Module { get; set; } = string.Empty; // "Заявки", "Пользователи", "Лицензии"

        [Required]
        public string Action { get; set; } = string.Empty; // "Добавить", "Изменить", "Удалить", "Просмотр"

        public string? Description { get; set; }

        // Навигационные свойства
        public ICollection<UserPermission> UserPermissions { get; set; } = new List<UserPermission>();
        public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
    }
}
