export interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Client {
  id: number;
  client_id: string;
  client_secret: string;
  name: string;
  redirect_uri: string;
  backchannel_logout_uri?: string;
  app_icon: string;
  app_description?: string;
  app_color_theme: string;
  is_visible_on_portal: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  username?: string;
  action: string;
  details: string;
  ip_address?: string;
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: string;
  description: string;
  category: string;
}
