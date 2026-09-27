using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace IAM.Application.DTOs.Requests;


public class LoginRequest
{
    public string Username { get; set; } = null!;
    public string Password { get; set; } = null!;

    //public string Email { get; set; } = string.Empty!;
}
