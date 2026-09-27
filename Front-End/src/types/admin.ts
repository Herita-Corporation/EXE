// IAMService's default System.Text.Json output (camelCase) -> camelCase here,
// same convention as src/types/auth.ts.

export interface Customer {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

export interface UpdateCustomerRequest {
  username: string;
  email: string;
}

export interface CreateManagerRequest {
  username: string;
  email: string;
  password: string;
}

export interface CreateManagerResponse {
  message: string;
  username: string;
  email: string;
}
