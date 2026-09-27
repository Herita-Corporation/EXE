using IAM.Application.DTOs.Requests;
using IAM.Application.Interfaces;
using IAM.Infrastructure.Data.Entities;
using IAM.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;

namespace IAMService.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAMDbContext _context;
    private readonly JwtTokenGenerator _jwt;
    private readonly BCryptPassworkHasher _hasher;
    private readonly IFileStorageService _fileStorageService;

    public AuthController(
        IAMDbContext context,
        JwtTokenGenerator jwt,
        BCryptPassworkHasher hasher,
        IFileStorageService fileStorageService)
    {
        _context = context;
        _jwt = jwt;
        _hasher = hasher;
        _fileStorageService = fileStorageService;
    }

    // CUSTOMER REGISTER

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var emailExists = await _context.Users
            .AnyAsync(x => x.Email == request.Email);

        if (emailExists)
            return BadRequest("Email đã tồn tại");

        var usernameExists = await _context.Users
            .AnyAsync(x => x.Username == request.Username);

        if (usernameExists)
            return BadRequest("Tên đăng nhập đã tồn tại");

        if (string.IsNullOrWhiteSpace(request.PhoneNumber))
            return BadRequest("Số điện thoại là bắt buộc");

        var customerRole = await _context.Roles
            .FirstOrDefaultAsync(x => x.Name == "Customer");

        if (customerRole == null)
            return BadRequest("Không tìm thấy vai trò Customer");

        var user = new User
        {
            Username = request.Username,
            Email = request.Email,
            PasswordHash = _hasher.Hash(request.Password),
            PhoneNumber = request.PhoneNumber,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        user.Roles.Add(customerRole);

        _context.Users.Add(user);

        await _context.SaveChangesAsync();

        var otp = await IssueVerificationCodeAsync(user.Id, "PhoneOtp", request.PhoneNumber);

        return Ok(new
        {
            Message = "Đăng ký tài khoản thành công",
            PhoneNumber = request.PhoneNumber,
            // DEV ONLY — no real SMS provider is wired up (same gap as
            // ForgotPassword's ResetToken below). The code is returned here
            // instead of actually being texted, so the OTP flow is still
            // fully testable end-to-end without a paid SMS gateway.
            OtpCode = otp.Code
        });
    }

    // LOGIN
    
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var user = await _context.Users
            .Include(x => x.Roles)
            .FirstOrDefaultAsync(x => x.Username == request.Username);

        if (user == null)
            return Unauthorized("Sai tên đăng nhập hoặc mật khẩu");

        if (!_hasher.Verify(request.Password, user.PasswordHash))
            return Unauthorized("Sai tên đăng nhập hoặc mật khẩu");

        var accessToken = _jwt.Generate(user);

        var refreshToken = Guid.NewGuid().ToString();

        _context.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            Token = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        });

        await _context.SaveChangesAsync();

        return Ok(new
        {
            Message = "Đăng nhập thành công",
            AccessToken = accessToken,
            RefreshToken = refreshToken
        });
    }

    // REFRESH TOKEN
    [HttpPost("refresh-token")]
    public async Task<IActionResult> RefreshToken(
        RefreshTokenRequest request)
    {
        var refresh = await _context.RefreshTokens
            .Include(x => x.User)
            .ThenInclude(u => u.Roles)
            .FirstOrDefaultAsync(x => x.Token == request.RefreshToken);

        if (refresh == null)
            return Unauthorized("Refresh Token không hợp lệ");

        if (refresh.ExpiresAt < DateTime.UtcNow)
            return Unauthorized("Refresh Token đã hết hạn");

        if (refresh.RevokedAt != null)
            return Unauthorized("Refresh Token đã bị thu hồi");

        var newAccessToken = _jwt.Generate(refresh.User);

        return Ok(new
        {
            Message = "Làm mới Access Token thành công",
            AccessToken = newAccessToken
        });
    }

    // THÔNG TIN TÀI KHOẢN

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == userId);
        if (user == null) return NotFound("Không tìm thấy người dùng");

        return Ok(new
        {
            Username = user.Username,
            Email = user.Email,
            PhoneNumber = user.PhoneNumber,
            IsEmailVerified = user.IsEmailVerified,
            IsPhoneVerified = user.IsPhoneVerified,
            AvatarUrl = user.AvatarUrl,

            Roles = User.Claims
                .Where(x => x.Type == ClaimTypes.Role)
                .Select(x => x.Value)
        });
    }

    // ĐĂNG KÝ PUSH TOKEN (Expo push notifications)

    [Authorize]
    [HttpPost("push-token")]
    public async Task<IActionResult> RegisterPushToken(RegisterPushTokenRequest request)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == userId);
        if (user == null) return NotFound("Không tìm thấy người dùng");

        user.PushToken = request.PushToken;
        await _context.SaveChangesAsync();

        return Ok("Đăng ký nhận thông báo thành công");
    }

    // ĐỔI ẢNH ĐẠI DIỆN

    [Authorize]
    [HttpPost("avatar")]
    public async Task<IActionResult> UpdateAvatar(IFormFile avatar)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == userId);
        if (user == null) return NotFound("Không tìm thấy người dùng");

        user.AvatarUrl = await _fileStorageService.UploadImageAsync(avatar);
        await _context.SaveChangesAsync();

        return Ok(new { AvatarUrl = user.AvatarUrl });
    }

    // ĐỔI MẬT KHẨU
    
    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(
        ChangePasswordRequest request)
    {
        var userId = Guid.Parse(
            User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var user = await _context.Users
            .FirstOrDefaultAsync(x => x.Id == userId);

        if (user == null)
            return NotFound("Không tìm thấy người dùng");

        if (!_hasher.Verify(
            request.OldPassword,
            user.PasswordHash))
        {
            return BadRequest("Mật khẩu cũ không chính xác");
        }

        user.PasswordHash =
            _hasher.Hash(request.NewPassword);

        await _context.SaveChangesAsync();

        return Ok("Đổi mật khẩu thành công");
    }

    
    // QUÊN MẬT KHẨU
    
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(
        ForgotPasswordRequest request)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(x => x.Email == request.Email);

        if (user == null)
        {
            return Ok(
                "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi");
        }

        var token = Guid.NewGuid().ToString();

        _context.RefreshTokens.Add(
            new RefreshToken
            {
                UserId = user.Id,
                Token = token,
                ExpiresAt = DateTime.UtcNow.AddMinutes(15)
            });

        await _context.SaveChangesAsync();

        return Ok(new
        {
            Message = "Tạo mã đặt lại mật khẩu thành công",
            ResetToken = token
        });
    }

    // ĐẶT LẠI MẬT KHẨU
    
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(
        ResetPasswordRequest request)
    {
        var reset = await _context.RefreshTokens
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.Token == request.Token);

        if (reset == null)
            return BadRequest("Token không hợp lệ");

        if (reset.User == null)
            return BadRequest("Không tìm thấy người dùng");

        if (reset.ExpiresAt < DateTime.UtcNow)
            return BadRequest("Token đã hết hạn");

        if (reset.RevokedAt != null)
            return BadRequest("Token đã được sử dụng");

        reset.User.PasswordHash =
            _hasher.Hash(request.NewPassword);

        reset.RevokedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok("Đặt lại mật khẩu thành công");
    }

    // ĐĂNG XUẤT
    
    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(
        LogoutRequest request)
    {
        var refresh = await _context.RefreshTokens
            .FirstOrDefaultAsync(x =>
                x.Token == request.RefreshToken);

        if (refresh == null)
            return NotFound("Không tìm thấy Refresh Token");

        refresh.RevokedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok("Đăng xuất thành công");
    }

    // ── XÁC THỰC SỐ ĐIỆN THOẠI (OTP) ──────────────────────────────────────

    [HttpPost("verify-phone-otp")]
    public async Task<IActionResult> VerifyPhoneOtp(VerifyPhoneOtpRequest request)
    {
        var code = await _context.VerificationCodes
            .Where(x => x.Type == "PhoneOtp"
                && x.Target == request.PhoneNumber
                && x.Code == request.Code
                && x.ConsumedAt == null)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();

        if (code == null)
            return BadRequest("Mã OTP không đúng");

        if (code.ExpiresAt < DateTime.UtcNow)
            return BadRequest("Mã OTP đã hết hạn");

        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == code.UserId);
        if (user == null)
            return NotFound("Không tìm thấy người dùng");

        code.ConsumedAt = DateTime.UtcNow;
        user.IsPhoneVerified = true;

        await _context.SaveChangesAsync();

        return Ok("Xác thực số điện thoại thành công");
    }

    [HttpPost("resend-phone-otp")]
    public async Task<IActionResult> ResendPhoneOtp(ResendPhoneOtpRequest request)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(x => x.PhoneNumber == request.PhoneNumber);

        if (user == null)
            return NotFound("Không tìm thấy tài khoản với số điện thoại này");

        var otp = await IssueVerificationCodeAsync(user.Id, "PhoneOtp", request.PhoneNumber);

        return Ok(new
        {
            Message = "Đã gửi lại mã OTP",
            OtpCode = otp.Code // DEV ONLY — see comment in Register()
        });
    }

    // ── XÁC THỰC EMAIL ─────────────────────────────────────────────────────

    [Authorize]
    [HttpPost("send-email-verification")]
    public async Task<IActionResult> SendEmailVerification()
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == userId);
        if (user == null) return NotFound("Không tìm thấy người dùng");

        var token = await IssueVerificationCodeAsync(user.Id, "EmailToken", user.Email);

        return Ok(new
        {
            Message = "Đã gửi email xác nhận",
            Email = user.Email,
            // DEV ONLY — no real email provider is wired up (same gap as
            // ForgotPassword's ResetToken). Returned directly instead of
            // being emailed as a clickable link.
            VerificationToken = token.Code
        });
    }

    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail(VerifyEmailRequest request)
    {
        var code = await _context.VerificationCodes
            .FirstOrDefaultAsync(x => x.Type == "EmailToken"
                && x.Code == request.Token
                && x.ConsumedAt == null);

        if (code == null)
            return BadRequest("Token xác thực không đúng");

        if (code.ExpiresAt < DateTime.UtcNow)
            return BadRequest("Token xác thực đã hết hạn");

        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == code.UserId);
        if (user == null)
            return NotFound("Không tìm thấy người dùng");

        code.ConsumedAt = DateTime.UtcNow;
        user.IsEmailVerified = true;

        await _context.SaveChangesAsync();

        return Ok("Xác thực email thành công");
    }

    // ── ĐỔI SỐ ĐIỆN THOẠI / EMAIL ─────────────────────────────────────────

    [Authorize]
    [HttpPost("change-phone")]
    public async Task<IActionResult> ChangePhone(ChangePhoneRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPhoneNumber))
            return BadRequest("Số điện thoại không hợp lệ");

        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == userId);
        if (user == null) return NotFound("Không tìm thấy người dùng");

        user.PhoneNumber = request.NewPhoneNumber;
        user.IsPhoneVerified = false;

        await _context.SaveChangesAsync();

        var otp = await IssueVerificationCodeAsync(user.Id, "PhoneOtp", request.NewPhoneNumber);

        return Ok(new
        {
            Message = "Đã cập nhật số điện thoại, vui lòng xác thực",
            PhoneNumber = request.NewPhoneNumber,
            OtpCode = otp.Code // DEV ONLY — see comment in Register()
        });
    }

    [Authorize]
    [HttpPost("change-email")]
    public async Task<IActionResult> ChangeEmail(ChangeEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewEmail))
            return BadRequest("Email không hợp lệ");

        var emailExists = await _context.Users
            .AnyAsync(x => x.Email == request.NewEmail);
        if (emailExists)
            return BadRequest("Email đã tồn tại");

        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == userId);
        if (user == null) return NotFound("Không tìm thấy người dùng");

        user.Email = request.NewEmail;
        user.IsEmailVerified = false;

        await _context.SaveChangesAsync();

        return Ok("Đã cập nhật email, vui lòng xác thực lại");
    }

    // ── Helper ─────────────────────────────────────────────────────────────

    private async Task<VerificationCode> IssueVerificationCodeAsync(Guid userId, string type, string target)
    {
        // Invalidate any still-outstanding code of the same type/target first —
        // otherwise an older resent/leaked code would stay valid indefinitely
        // alongside the new one (both share the same 5-min/24-hour expiry).
        var outstanding = await _context.VerificationCodes
            .Where(x => x.UserId == userId
                && x.Type == type
                && x.Target == target
                && x.ConsumedAt == null)
            .ToListAsync();
        foreach (var old in outstanding)
            old.ConsumedAt = DateTime.UtcNow;

        var code = type == "PhoneOtp"
            ? RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6")
            : Guid.NewGuid().ToString("N");

        var verification = new VerificationCode
        {
            UserId = userId,
            Type = type,
            Code = code,
            Target = target,
            ExpiresAt = DateTime.UtcNow.Add(type == "PhoneOtp" ? TimeSpan.FromMinutes(5) : TimeSpan.FromHours(24)),
            CreatedAt = DateTime.UtcNow
        };

        _context.VerificationCodes.Add(verification);
        await _context.SaveChangesAsync();

        return verification;
    }
}