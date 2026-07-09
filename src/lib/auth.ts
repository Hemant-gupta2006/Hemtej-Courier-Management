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
          where: { email: credentials.email }
        });
        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }
        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          user.password
        );
        if (!isCorrectPassword) {
          throw new Error("Invalid credentials");
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
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
    async jwt({ token, user, account }) {
      if (user) {
        token.role = (user as any).role || "Staff";
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
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
