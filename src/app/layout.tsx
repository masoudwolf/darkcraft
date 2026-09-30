import type { Metadata, Viewport } from "next";
import { Vazirmatn, Press_Start_2P } from "next/font/google";
import "./globals.css";

const vazir = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic"],
});

const pixel = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mine Souls — سولز مکعبی",
  description:
    "بازی نقش‌آفرینی سولزلایک با تم و استایل ماینکرفت: بجنگ، بمیر، در آتش کمپ بیاسای و دوباره برخیز.",
  keywords: ["Mine Souls", "Dark Souls", "Minecraft", "souls-like", "game"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0e14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${vazir.variable} ${pixel.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
