import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NavbarGlobal from "@/components/NavbarGlobal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DataROI México — Retorno de Inversión y Empleabilidad Universitaria",
  description: "Sistema de apoyo a la decisión vocacional y auditoría salarial con microdatos ENOE INEGI y ANUIES.",
};

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
      <body className="min-h-screen bg-[#EEF2F6] bg-[radial-gradient(ellipse_80%_50%_at_50%_-15%,rgba(37,99,235,0.08),transparent)] text-slate-900 flex flex-col">
        <NavbarGlobal />
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}