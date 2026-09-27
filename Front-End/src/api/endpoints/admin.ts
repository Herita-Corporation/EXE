import { request } from "@/api/http";
import type {
  Customer,
  CreateManagerRequest,
  CreateManagerResponse,
  UpdateCustomerRequest,
} from "@/types/admin";

// Base: <EXPO_PUBLIC_IAM_API_URL>/api/manager (Manager role) and /api/admin
// (Admin role) — IAMService/Controllers/ManagerController.cs, AdminController.cs

export function listCustomers() {
  return request<Customer[]>("iam", "/api/manager/customers");
}

export function getCustomer(id: string) {
  return request<Customer>("iam", `/api/manager/customers/${id}`);
}

export function updateCustomer(id: string, payload: UpdateCustomerRequest) {
  return request<string>("iam", `/api/manager/customers/${id}`, {
    method: "PUT",
    data: payload,
  });
}

export function disableCustomer(id: string) {
  return request<string>("iam", `/api/manager/customers/${id}/disable`, {
    method: "PATCH",
  });
}

export function enableCustomer(id: string) {
  return request<string>("iam", `/api/manager/customers/${id}/enable`, {
    method: "PATCH",
  });
}

export function deleteCustomer(id: string) {
  return request<string>("iam", `/api/manager/customers/${id}`, {
    method: "DELETE",
  });
}

export function createManager(payload: CreateManagerRequest) {
  return request<CreateManagerResponse>("iam", "/api/admin/create-manager", {
    method: "POST",
    data: payload,
  });
}
