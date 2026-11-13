
using IAMService.DTOs;
using IAMService.Services;
using IAM.Infrastructure.Data.Entities;
using IAM.Infrastructure.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using Twilio.Exceptions;

namespace IAMService.Controllers;

[ApiController]
[Route("api/auth/phone")]
[EnableRateLimiting("phone-otp")]
public class PhoneRegistrationController : ControllerBase
{
    private readonly IAMDbContext _db;
    private readonly TwilioOtpService _otp;
    private readonly BCryptPassworkHasher _hasher;
    private readonly ILogger<PhoneRegistrationController> _logger;

    public PhoneRegistrationController(
        IAMDbContext db,
        TwilioOtpService otp,
        BCryptPassworkHasher hasher,
        ILogger<PhoneRegistrationController> logger)
    {
        _db = db;
        _otp = otp;
        _hasher = hasher;
        _logger = logger;
    }

    private static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return null;

        phone = Regex.Replace(phone, @"[\s-]", "");

        if (Regex.IsMatch(phone, @"^0[35789]\d{8}$"))
            return "+84" + phone[1..];

        if (Regex.IsMatch(phone, @"^\+84[35789]\d{8}$"))
            return phone;

        return null;
    }

    // ============================================
    // STEP 1: REGISTER ACCOUNT AND SEND SMS OTP
    // POST /api/auth/phone/register
    // ============================================

    [HttpPost("register")]
    public async Task<IActionResult> Register(
        [FromBody] RegisterPhoneRequest request)
    {
        var phone = NormalizePhone(request.PhoneNumber);

        if (phone == null)
        {
            return BadRequest(new
            {
                message = "Invalid phone number"
            });
        }

        var exists = await _db.Users.AnyAsync(x =>
            x.Username == request.Username ||
            x.Email == request.Email ||
            x.PhoneNumber == phone);

        if (exists)
        {
            return Conflict(new
            {
                message = "Account information already exists"
            });
        }

        var pending = await _db.PendingPhoneRegistrations
            .FirstOrDefaultAsync(x => x.PhoneNumber == phone);

        if (pending != null &&
            pending.ExpiresAt > DateTime.UtcNow)
        {
            return Conflict(new
            {
                message = "Registration already pending",
                expiresAt = pending.ExpiresAt
            });
        }

        if (pending != null)
        {
            _db.PendingPhoneRegistrations.Remove(pending);
        }

        var registration = new PendingPhoneRegistration
        {
            Id = Guid.NewGuid(),
            Username = request.Username.Trim(),
            Email = request.Email.Trim(),
            PhoneNumber = phone,
            PasswordHash = _hasher.Hash(request.Password),
            OtpHash = "",
            OtpAttempts = 0,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5)
        };

        _db.PendingPhoneRegistrations.Add(registration);

        await _db.SaveChangesAsync();

        try
        {
            await _otp.SendOtpAsync(phone);
        }
        catch (ApiException ex)
        {
            _logger.LogError(
                ex,
                "Twilio SMS failed for registration {RegistrationId}",
                registration.Id);

            return StatusCode(502, new
            {
                message = "Unable to send SMS OTP. Check Twilio sender and SMS permissions."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Unexpected OTP error for registration {RegistrationId}",
                registration.Id);

            return StatusCode(500, new
            {
                message = "An error occurred while sending OTP"
            });
        }

        return Ok(new
        {
            message = "OTP requested",
            phoneNumber = phone,
            expiresInSeconds = 300
        });
    }

    // ============================================
    // STEP 2: VERIFY OTP AND CREATE USER
    // POST /api/auth/phone/verify
    // ============================================

    [HttpPost("verify")]
    public async Task<IActionResult> Verify(
        [FromBody] VerifyPhoneRequest request)
    {
        var phone = NormalizePhone(request.PhoneNumber);

        if (phone == null)
        {
            return BadRequest(new
            {
                message = "Invalid phone number"
            });
        }

        if (!Regex.IsMatch(request.Otp ?? "", @"^\d{6}$"))
        {
            return BadRequest(new
            {
                message = "OTP must contain exactly 6 digits"
            });
        }

        var pending = await _db.PendingPhoneRegistrations
            .FirstOrDefaultAsync(x => x.PhoneNumber == phone);

        if (pending == null)
        {
            return BadRequest(new
            {
                message = "Pending registration not found"
            });
        }

        if (pending.ExpiresAt <= DateTime.UtcNow)
        {
            return BadRequest(new
            {
                message = "OTP expired"
            });
        }

        bool verified;

        try
        {
            verified = await _otp.VerifyOtpAsync(
                phone,
                request.Otp);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "OTP verification failed for registration {RegistrationId}",
                pending.Id);

            return StatusCode(500, new
            {
                message = "OTP verification error"
            });
        }

        if (!verified)
        {
            return BadRequest(new
            {
                message = "Invalid or expired OTP"
            });
        }

        await using var transaction =
            await _db.Database.BeginTransactionAsync();

        try
        {
            var exists = await _db.Users.AnyAsync(x =>
                x.Username == pending.Username ||
                x.Email == pending.Email ||
                x.PhoneNumber == phone);

            if (exists)
            {
                return Conflict(new
                {
                    message = "Account already exists"
                });
            }

            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = pending.Username,
                Email = pending.Email,
                PhoneNumber = pending.PhoneNumber,
                PasswordHash = pending.PasswordHash,
                IsPhoneVerified = true,
                IsEmailVerified = false,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            var role = await _db.Roles
                .FirstOrDefaultAsync(x => x.Name == "Customer");

            if (role != null)
            {
                user.Roles.Add(role);
            }

            _db.Users.Add(user);
            _db.PendingPhoneRegistrations.Remove(pending);

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                message = "Phone verified and account created successfully",
                userId = user.Id,
                username = user.Username,
                phoneNumber = user.PhoneNumber,
                isPhoneVerified = true
            });
        }
        catch (DbUpdateException ex)
        {
            await transaction.RollbackAsync();

            _logger.LogError(
                ex,
                "Database error while creating phone account");

            return Conflict(new
            {
                message = "Unable to create account. Account data may already exist."
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();

            _logger.LogError(
                ex,
                "Unexpected error while creating phone account");

            return StatusCode(500, new
            {
                message = "Account creation failed"
            });
        }
    }
}
