/**
 * Shared theme types used across frontend and backend
 */

export interface Theme {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  primaryColor: string;
  slateColor: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  shadowIntensity: number;
  customCssVars: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateThemeInput {
  name: string;
  primaryColor?: string;
  slateColor?: string;
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  shadowIntensity?: number;
  customCssVars?: Record<string, string> | null;
}

export interface UpdateThemeInput {
  name?: string;
  primaryColor?: string;
  slateColor?: string;
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  shadowIntensity?: number;
  customCssVars?: Record<string, string> | null;
}
