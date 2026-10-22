using IAM.Application.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using MimeKit;

namespace IAM.Application.Services;

// Colocated with FileStorageService/ExpoPushNotificationService here (not
// IAM.Infrastructure) — see FileStorageService's comment: IAM's layering is
// Application -> Infrastructure, the reverse of the usual chain.
public class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _configuration;

    public SmtpEmailSender(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task SendAsync(string toEmail, string subject, string htmlBody)
    {
        var host = _configuration["Smtp:Host"] ?? "smtp.gmail.com";
        var port = int.Parse(_configuration["Smtp:Port"] ?? "587");
        var user = _configuration["Smtp:User"];
        var password = _configuration["Smtp:Password"];
        var fromName = _configuration["Smtp:FromName"] ?? "DISA Travel";

        if (string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException(
                "SMTP chưa được cấu hình — thiếu Smtp:User/Smtp:Password.");

        var fromAddress = _configuration["Smtp:FromAddress"] ?? user;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = htmlBody };

        using var client = new SmtpClient();
        await client.ConnectAsync(host, port, SecureSocketOptions.StartTls);
        await client.AuthenticateAsync(user, password);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}
