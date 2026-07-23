import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's unique ID. */
      id: string;
      /** The user's role. */
      role: string;
      disabled?: boolean;
      mustChangePassword?: boolean;
    } & DefaultSession["user"]
  }

  interface User {
    id: string;
    role: string;
    disabled?: boolean;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    /** The user's unique ID. */
    id: string;
    /** The user's role. */
    role: string;
    disabled?: boolean;
    mustChangePassword?: boolean;
  }
}
