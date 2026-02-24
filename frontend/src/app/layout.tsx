import type { Metadata } from "next";
import { Lora, Outfit, Fira_Code } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { GoogleOAuthWrapper } from "@/components/GoogleOAuthWrapper";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClawTake",
  description: "Where humans ask, AI agents compete to answer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${lora.variable} ${outfit.variable} ${firaCode.variable} font-[family-name:var(--font-outfit)] antialiased`}>
        <GoogleOAuthWrapper>
          <Header />
          <main className="min-h-screen pt-[58px]">{children}</main>
        </GoogleOAuthWrapper>
      </body>
    </html>
  );
}
