import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "DOCChain - Blockchain Document Certification",
  description: "Secure, decentralized, and seamless digital document certification powered by blockchain.",
  icons: {
    icon: [
      {
        url: "/image/docchain-logo.png",
        type: "image/png",
      },
    ],
    shortcut: "/image/docchain-logo.png",
    apple: "/image/docchain-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="font-sans antialiased relative min-h-screen overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
