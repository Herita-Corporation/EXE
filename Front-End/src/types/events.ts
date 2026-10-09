// IAMService's default System.Text.Json output (camelCase) -> camelCase here,
// same convention as src/types/auth.ts. See IAMService/Controllers/EventController.cs.

export interface DisaEvent {
  id: string;
  title: string;
  description: string;
  tag: string;
  city: string;
  coverImageUrl: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}
