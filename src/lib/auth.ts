import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { cookies } from "next/headers";
import type { Session } from "next-auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "USER";

        // Check for impersonation cookie (only for admins)
        if (token.role === "ADMIN") {
          try {
            const cookieStore = await cookies();
            const impersonationCookie = cookieStore.get("admin_impersonation");
            if (impersonationCookie?.value) {
              const data = JSON.parse(impersonationCookie.value);
              session.user.impersonatingUserId = data.userId;
              session.user.impersonatingUserEmail = data.userEmail;
            }
          } catch {
            // Cookie parsing failed, ignore
          }
        }
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});

/**
 * Get the effective user ID for data queries.
 * Returns impersonated user ID if admin is impersonating, otherwise returns the session user ID.
 */
export function getEffectiveUserId(session: Session | null): string | null {
  if (!session?.user?.id) return null;

  // If admin is impersonating another user, use that user's ID
  if (session.user.role === "ADMIN" && session.user.impersonatingUserId) {
    return session.user.impersonatingUserId;
  }

  return session.user.id;
}
