import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HIDE PUZZLE",
  description: "置いたピースがグリッドに溶け込む、白黒の記憶型パズルゲーム。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
