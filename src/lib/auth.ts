import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() }
        });
        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }

        if (user.disabled) {
          throw new Error("ACCOUNT_DISABLED");
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          const remainingMins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
          throw new Error(`ACCOUNT_LOCKED:${remainingMins}`);
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isCorrectPassword) {
          const newFailed = (user.failedLoginAttempts || 0) + 1;
          let lockDate: Date | null = null;
          if (newFailed >= 5) {
            lockDate = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
          }
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: newFailed,
              lockedUntil: lockDate,
            }
          });

          if (newFailed >= 5) {
            throw new Error("ACCOUNT_LOCKED:15");
          }
          throw new Error("Invalid credentials");
        }

        // On successful authentication, reset lockout counters & update login stats
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLogin: new Date(),
            lastActivity: new Date(),
            loginCount: { increment: 1 }
          }
        });

        return {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          disabled: updatedUser.disabled,
          mustChangePassword: updatedUser.mustChangePassword,
        };
      }
    })
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role || "Staff";
        token.id = user.id;
        token.disabled = (user as any).disabled || false;
        token.mustChangePassword = (user as any).mustChangePassword || false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).disabled = token.disabled;
        (session.user as any).mustChangePassword = token.mustChangePassword;
      }
      return session;
    }
  },
  events: {
    async signIn({ user }) {
      if (user) {
        try {
          const { recordActivity } = await import("@/lib/activityLog");
          await recordActivity({
            userId: user.id,
            userName: user.name || user.email || "Staff",
            role: (user as any).role || "Staff",
            action: "LOGIN",
            entity: "User",
            entityId: user.id
          });
        } catch (e) {
          console.error("Failed to log sign in event", e);
        }
      }
    },
    async signOut({ token }) {
      if (token?.id) {
        try {
          const { recordActivity } = await import("@/lib/activityLog");
          await recordActivity({
            userId: String(token.id),
            userName: String(token.name || token.email || "Staff"),
            role: String(token.role || "Staff"),
            action: "LOGOUT",
            entity: "User",
            entityId: String(token.id)
          });
        } catch (e) {
          console.error("Failed to log sign out event", e);
        }
      }
    }
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_local_dev",
};
