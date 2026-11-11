import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UniLMS Integration Console",
  description: "External LMS demo cho SecureSign Batch Signing API",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
