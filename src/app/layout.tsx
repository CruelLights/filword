import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc-provider";

export const metadata: Metadata = {
  title: "Филворд — Соревновательный режим",
  description: "Найди слова быстрее других игроков!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
