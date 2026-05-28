import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
import { AuthProvider } from "@/lib/auth";

// Load particles lazily so it never blocks first paint
const ParticlesBG = dynamic(() => import("@/components/ParticlesBG"));

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "600", "700"], // removed 500 - reduces font bundle
  display: "swap", // show text immediately with fallback font
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
