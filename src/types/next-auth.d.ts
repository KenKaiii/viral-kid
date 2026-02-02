import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: "ADMIN" | "USER";
      // Admin impersonation fields
      impersonatingUserId?: string;
      impersonatingUserEmail?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    role: "ADMIN" | "USER";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "USER";
    // Admin impersonation fields
    impersonatingUserId?: string;
    impersonatingUserEmail?: string;
  }
}
