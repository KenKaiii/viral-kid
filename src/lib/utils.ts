import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the base URL dynamically from request headers or environment variables.
 * Works on any port in development and production.
 */
export function getBaseUrl(request?: Request): string {
  // If we have a request, extract URL from headers
  if (request) {
    const host = request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    if (host) {
      return `${protocol}://${host}`;
    }
  }

  // Vercel deployment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Explicit configuration
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  // Fallback for development
  return "http://localhost:3000";
}
