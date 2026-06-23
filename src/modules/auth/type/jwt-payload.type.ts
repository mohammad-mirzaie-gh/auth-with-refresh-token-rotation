export interface JwtPayload {
  sub: number;
  email: string;
  sessionId: string;
}
export interface RefreshJwtPayload {
  sub: number;
  email: string;
  sessionId: string;
  refreshToken: string;
}
