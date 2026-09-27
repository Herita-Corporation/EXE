using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using IAM.Infrastructure.Data.Entities;


namespace IAM.Application.Interfaces
{
    public interface IUserRepository
    {
        Task<User?> GetByEmailAsync(string email);
        Task<User?> GetByIdAsync(Guid id);
            Task AddAsync(User user);
            Task SaveChangesAsync();
    }
}
