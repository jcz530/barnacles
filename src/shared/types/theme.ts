/**
 * Shared theme types used across frontend and backend
 */

export interface Theme {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  slateColor: string;
  successColor: string;
  dangerColor: string;
  fontUi: string | null;
  fontHeading: string | null;
  fontCode: string | null;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  customCssVars: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateThemeInput {
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
  slateColor?: string;
  successColor?: string;
  dangerColor?: string;
  fontUi?: string | null;
  fontHeading?: string | null;
  fontCode?: string | null;
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  customCssVars?: Record<string, string> | null;
}

export interface UpdateThemeInput {
  name?: string;
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
  slateColor?: string;
  successColor?: string;
  dangerColor?: string;
  fontUi?: string | null;
  fontHeading?: string | null;
  fontCode?: string | null;
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  customCssVars?: Record<string, string> | null;
}
