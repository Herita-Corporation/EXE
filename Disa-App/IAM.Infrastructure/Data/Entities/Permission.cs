using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace IAM.Infrastructure.Data.Entities
{
    public class Permission
    {
        public Guid Id { get; set; }
        public string Code { get; set; }
        public string? Description { get; set; }

        public ICollection<Role> Roles { get; set; } = new List<Role>();
    }
}
