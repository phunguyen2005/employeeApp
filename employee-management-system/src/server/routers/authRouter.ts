import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import jwt from 'jsonwebtoken';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

export const authRouter = router({
  // Protected procedure to return active session data
  session: protectedProcedure.query(({ ctx }) => {
    return ctx.user; 
  }),

  // Login dynamically mocks a user mapping to a role from the UI to ease SQL server migrations locally
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const dbUser = await ctx.prisma.employee.findUnique({
         where: { email: input.email }
      });

      if (!dbUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password'
        });
      }

      const isValid = await bcrypt.compare(input.password, dbUser.password);
      if (!isValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password'
        });
      }

      const { password, ...user } = dbUser;

      // 7 days token expiration represents standard SaaS defaults
      const token = jwt.sign(
        { id: user.id, role: user.role, departmentId: user.departmentId, fullName: user.fullName },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // We push the secure HttpOnly cookie directly into the Express response object
      ctx.res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, 
      });

      return { success: true, user };
    }),

  // Logout clears the secure HttpOnly cookie
  logout: protectedProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie('token');
    return { success: true };
  }),
});
