import * as trpcExpress from '@trpc/server/adapters/express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { Role } from '../types';

export const prisma = new PrismaClient();

// In Phase 5, this will be generated on login
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

export interface UserContext {
  id: string;
  fullName: string;
  role: Role;
  departmentId: string | null;
}

export const createContext = async ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  let user: UserContext | null = null;
  
  // Extract token from cookie or Auth header
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as UserContext;
      user = decoded;
    } catch (err) {
      console.error('Invalid token', err);
    }
  }


  return {
    req,
    res,
    user,
    prisma
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
