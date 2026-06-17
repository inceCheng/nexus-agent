import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NexusAgent API",
  description: "NexusAgent backend API.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
