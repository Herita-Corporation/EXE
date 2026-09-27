// IAMService (IAM.Presentation) uses ASP.NET Core's default System.Text.Json
// output (camelCase, no explicit JsonPropertyName overrides) -> camelCase here.

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  phoneNumber: string;
}

export interface RegisterResponse {
  message: string;
  phoneNumber: string;
  // DEV ONLY — no real SMS provider exists; IAMService returns the code
  // directly instead of texting it (see AuthController.Register comment).
  otpCode: string;
}

export interface MeResponse {
  username: string;
  email: string;
  phoneNumber: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  avatarUrl: string | null;
  roles: string[];
}

export interface VerifyPhoneOtpRequest {
  phoneNumber: string;
  code: string;
}

export interface ResendPhoneOtpRequest {
  phoneNumber: string;
}

export interface ResendPhoneOtpResponse {
  message: string;
  otpCode: string; // DEV ONLY — see RegisterResponse
}

export interface SendEmailVerificationResponse {
  message: string;
  email: string;
  verificationToken: string; // DEV ONLY — see RegisterResponse
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ChangePhoneRequest {
  newPhoneNumber: string;
}

export interface ChangePhoneResponse {
  message: string;
  phoneNumber: string;
  otpCode: string; // DEV ONLY — see RegisterResponse
}

export interface ChangeEmailRequest {
  newEmail: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
  resetToken: string;
}

// AuthController.ForgotPassword actually returns a plain string (no
// resetToken) when the email doesn't exist, and the {message, resetToken}
// object only when it does — callers must check `typeof` at runtime.
export type ForgotPasswordResult = ForgotPasswordResponse | string;

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  phoneNumber: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  avatarUrl: string | null;
  roles: string[];
}

export interface UploadAvatarResponse {
  avatarUrl: string;
}

export interface RegisterPushTokenRequest {
  pushToken: string;
}
