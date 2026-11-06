import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DataROI México",
  description: "Motor predictivo y radiografía sociológica de carreras profesionales.",
};

// Aquí estaba el error. Lo cambiamos al estándar seguro de React:
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
    >
      <body className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
        {children}
      </body>
    </html>
  );
}