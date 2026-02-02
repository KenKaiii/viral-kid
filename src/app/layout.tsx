import type { Metadata } from "next";
import { Roboto, BBH_Bartle } from "next/font/google";
import "./globals.css";
import { LenisProvider } from "@/components/lenis-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { Providers } from "@/components/providers";
import { ImpersonationBanner } from "@/components/ui/impersonation-banner";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
});

const bbhBartle = BBH_Bartle({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-logo",
});

export const metadata: Metadata = {
  title: "Viral Kid - Social Media Automation",
  description:
    "Automate your social media presence with AI-powered replies on Twitter and YouTube. Track trends, engage with your audience, and grow your following.",
  keywords: [
    "social media automation",
    "twitter bot",
    "youtube automation",
    "AI replies",
    "viral content",
    "social media management",
  ],
  authors: [{ name: "Unstable Mind" }],
  openGraph: {
    title: "Viral Kid - Social Media Automation",
    description:
      "Automate your social media presence with AI-powered replies on Twitter and YouTube.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Viral Kid - Social Media Automation",
    description:
      "Automate your social media presence with AI-powered replies on Twitter and YouTube.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ backgroundColor: "#0a0a0a" }}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.style.backgroundColor='#0a0a0a';document.body&&(document.body.style.backgroundColor='#0a0a0a');`,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `html,body{background-color:#0a0a0a!important}`,
          }}
        />
      </head>
      <body
        className={`${roboto.className} ${bbhBartle.variable}`}
        style={{ backgroundColor: "#0a0a0a" }}
      >
        <ErrorBoundary>
          <Providers>
            <ImpersonationBanner />
            <LenisProvider>{children}</LenisProvider>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
