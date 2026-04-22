import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Launched - Portail Immersif",
  description: "Découvrez le hub ultime pour Minecraft avec support multi-launcher et optimisation intelligente du disque.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} font-sans h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <div className="noise-overlay" />
      </body>
    </html>
  );
}
