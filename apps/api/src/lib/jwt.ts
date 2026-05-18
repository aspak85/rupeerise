import jwt from 'jsonwebtoken';
import { env } from './env';

export type JwtPayload = {
  sub: string;
  role: 'user' | 'admin';
};

export function signJwt(payload: JwtPayload, expiresIn: string = '7d') {
  return (jwt.sign as any)(payload, (env.JWT_SECRET as string) ?? 'dev', { expiresIn }) as string;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return (jwt.verify as any)(token, (env.JWT_SECRET as string) ?? 'dev') as JwtPayload;
  } catch {
    return null;
  }
}
