
using Microsoft.Extensions.Configuration;
using Twilio;
using Twilio.Rest.Verify.V2.Service;

namespace IAMService.Services;

public class TwilioOtpService
{
    private readonly string _serviceSid;

    public TwilioOtpService(IConfiguration config)
    {
        var accountSid = config["Twilio:AccountSid"]
            ?? throw new InvalidOperationException(
                "Missing Twilio Account SID");

        var authToken = config["Twilio:AuthToken"]
            ?? throw new InvalidOperationException(
                "Missing Twilio Auth Token");

        _serviceSid = config["Twilio:VerifyServiceSid"]
            ?? throw new InvalidOperationException(
                "Missing Verify Service SID");

        TwilioClient.Init(accountSid, authToken);
    }

    public async Task SendOtpAsync(string phone)
    {
        var result = await VerificationResource.CreateAsync(
            to: phone,
            channel: "sms",
            pathServiceSid: _serviceSid
        );

        if (result.Status != "pending")
        {
            throw new InvalidOperationException(
                "Could not start OTP verification");
        }
    }

    public async Task<bool> VerifyOtpAsync(
        string phone,
        string otp)
    {
        var result = await VerificationCheckResource.CreateAsync(
            to: phone,
            code: otp,
            pathServiceSid: _serviceSid
        );

        return result.Status == "approved";
    }
}
