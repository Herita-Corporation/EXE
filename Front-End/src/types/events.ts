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

export interface EventFormValues {
  title: string;
  description: string;
  tag: string;
  city: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  isActive?: boolean;
  coverImageUri?: string | null; // local file uri from expo-image-picker; only sent when replacing the image
}
