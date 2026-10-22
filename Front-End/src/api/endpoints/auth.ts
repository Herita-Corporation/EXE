import { request } from "@/api/http";
import type {
  ChangeEmailRequest,
  ChangePasswordRequest,
  ChangePhoneRequest,
  ChangePhoneResponse,
  ForgotPasswordRequest,
  ForgotPasswordResult,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  MeResponse,
  RegisterPushTokenRequest,
  RegisterRequest,
  RegisterResponse,
  ResendEmailVerificationRequest,
  ResendEmailVerificationResponse,
  ResetPasswordRequest,
  SendEmailVerificationResponse,
  UploadAvatarResponse,
  VerifyEmailRequest,
} from "@/types/auth";

// Base: <EXPO_PUBLIC_IAM_API_URL>/api/auth  (IAMService/Controllers/AuthController.cs)

export function login(payload: LoginRequest) {
  return request<LoginResponse>("iam", "/api/auth/login", {
    method: "POST",
    data: payload,
    auth: false,
  });
}

export function register(payload: RegisterRequest) {
  return request<RegisterResponse>("iam", "/api/auth/register", {
    method: "POST",
    data: payload,
    auth: false,
  });
}

export function me() {
  return request<MeResponse>("iam", "/api/auth/me");
}

export function changePassword(payload: ChangePasswordRequest) {
  return request<string>("iam", "/api/auth/change-password", {
    method: "POST",
    data: payload,
  });
}

export function forgotPassword(payload: ForgotPasswordRequest) {
  return request<ForgotPasswordResult>("iam", "/api/auth/forgot-password", {
    method: "POST",
    data: payload,
    auth: false,
  });
}

export function resetPassword(payload: ResetPasswordRequest) {
  return request<string>("iam", "/api/auth/reset-password", {
    method: "POST",
    data: payload,
    auth: false,
  });
}

export function logout(payload: LogoutRequest) {
  return request<string>("iam", "/api/auth/logout", {
    method: "POST",
    data: payload,
  });
}

export function sendEmailVerification() {
  return request<SendEmailVerificationResponse>("iam", "/api/auth/send-email-verification", {
    method: "POST",
  });
}

export function verifyEmail(payload: VerifyEmailRequest) {
  return request<string>("iam", "/api/auth/verify-email", {
    method: "POST",
    data: payload,
    auth: false,
  });
}

export function resendEmailVerification(payload: ResendEmailVerificationRequest) {
  return request<ResendEmailVerificationResponse>("iam", "/api/auth/resend-email-verification", {
    method: "POST",
    data: payload,
    auth: false,
  });
}

export function changePhone(payload: ChangePhoneRequest) {
  return request<ChangePhoneResponse>("iam", "/api/auth/change-phone", {
    method: "POST",
    data: payload,
  });
}

export function changeEmail(payload: ChangeEmailRequest) {
  return request<string>("iam", "/api/auth/change-email", {
    method: "POST",
    data: payload,
  });
}

export function registerPushToken(payload: RegisterPushTokenRequest) {
  return request<string>("iam", "/api/auth/push-token", {
    method: "POST",
    data: payload,
  });
}

export function uploadAvatar(imageUri: string) {
  const fileName = imageUri.split("/").pop() ?? "avatar.jpg";
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mime = ext === "png" ? "image/png" : "image/jpeg";
  const form = new FormData();
  form.append("avatar", {
    uri: imageUri,
    name: fileName,
    type: mime,
  } as unknown as Blob);

  return request<UploadAvatarResponse>("iam", "/api/auth/avatar", {
    method: "POST",
    data: form,
    headers: { "Content-Type": "multipart/form-data" },
  });
}
