import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import ParticlesBG from "@/components/ParticlesBG";
import { AuthProvider } from "@/lib/auth";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RupeeRise — Invest Smart. Earn Daily.",
  description:
    "Advanced daily reward investment platform for India. Membership plans with daily claims, weekly withdrawals, and viral referral growth.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ParticlesBG />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
