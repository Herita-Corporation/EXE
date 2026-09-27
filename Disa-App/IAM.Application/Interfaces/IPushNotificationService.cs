namespace IAM.Application.Interfaces;

public interface IPushNotificationService
{
    // Fire-and-forget: failures are swallowed (logged) rather than failing
    // the calling request (e.g. event creation) — no user-facing action
    // should ever fail because a push notification couldn't be sent.
    Task SendToAllUsersAsync(string title, string body);
}
