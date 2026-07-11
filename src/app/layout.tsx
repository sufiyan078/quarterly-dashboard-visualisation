import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { InventoryDataProvider } from "../context/InventoryDataContext";
import { ThemeProvider } from "../context/ThemeContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inventory Analytics & Reporting Portal",
  description: "Zero-cost inventory audit reporting and analytics platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col font-sans"
        style={{ background: 'var(--th-app-bg)', color: 'var(--th-text-body)' }}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <InventoryDataProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </InventoryDataProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
