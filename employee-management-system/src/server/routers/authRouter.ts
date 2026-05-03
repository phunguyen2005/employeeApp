import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import jwt from 'jsonwebtoken';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { getRequestIp, getUserContextById, hashToken } from '../context';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type AuthenticateResult = {
  userId: string | null;
  passwordHash: string | null;
  authStatus: 'USER_NOT_FOUND' | 'ACCOUNT_DISABLED' | 'ACCOUNT_LOCKED' | 'PENDING_VERIFY';
  failedAttempts: number | null;
};

const invalidLoginError = () =>
  new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'Invalid email or password',
  });

export const authRouter = router({
  session: protectedProcedure.query(({ ctx }) => {
    return ctx.user;
  }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const ipAddress = getRequestIp(ctx.req);
      const userAgentHeader = ctx.req.headers['user-agent'];
      const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader.join(', ') : userAgentHeader ?? null;
      const [auth] = await ctx.prisma.$queryRaw<AuthenticateResult[]>`
        EXEC [dbo].[sp_Authenticate]
          @Email = ${input.email},
          @IPAddress = ${ipAddress},
          @UserAgent = ${userAgent}
      `;

      if (!auth || auth.authStatus === 'USER_NOT_FOUND') {
        throw invalidLoginError();
      }

      if (auth.authStatus === 'ACCOUNT_DISABLED') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'This account has been disabled.' });
      }

      if (auth.authStatus === 'ACCOUNT_LOCKED') {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'This account is temporarily locked.' });
      }

      if (!auth.userId || !auth.passwordHash) {
        throw invalidLoginError();
      }

      const isValid = await bcrypt.compare(input.password, auth.passwordHash);
      if (!isValid) {
        await ctx.prisma.$executeRaw`
          EXEC [dbo].[sp_RecordLoginFailure]
            @UserId = ${auth.userId},
            @IPAddress = ${ipAddress},
            @UserAgent = ${userAgent}
        `;
        throw invalidLoginError();
      }

      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      const token = jwt.sign({ userId: auth.userId }, JWT_SECRET, { expiresIn: '7d' });
      const tokenHash = hashToken(token);

      await ctx.prisma.$executeRaw`
        EXEC [dbo].[sp_RecordLoginSuccess]
          @UserId = ${auth.userId},
          @TokenHash = ${tokenHash},
          @ExpiresAt = ${expiresAt},
          @IPAddress = ${ipAddress},
          @UserAgent = ${userAgent}
      `;

      const user = await getUserContextById(auth.userId);
      if (!user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Unable to establish a user session.' });
      }

      ctx.res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_TTL_MS,
      });

      return { success: true, user };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.tokenHash) {
      await ctx.prisma.userSession.updateMany({
        where: {
          tokenHash: ctx.tokenHash,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    ctx.res.clearCookie('token');
    return { success: true };
  }),
});
