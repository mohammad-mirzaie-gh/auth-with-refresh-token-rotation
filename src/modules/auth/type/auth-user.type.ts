
export interface AuthUser {
  userId: number;
  email: string;
  sessionId: string;
  refreshToken?: string;
}
