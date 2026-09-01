import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Comic Pro",
  description: "AI-driven comic creation workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="font-sans antialiased bg-black text-zinc-100">
        {children}
      </body>
    </html>
  );
}
