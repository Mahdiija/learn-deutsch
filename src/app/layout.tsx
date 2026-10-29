import type { Metadata } from "next";
import { Source_Sans_3, Vazirmatn } from "next/font/google";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arbeitsbuch Wörter | تمرین واژه‌های آلمانی",
  description: "تمرین واژگان آلمانی–فارسی با جلسهٔ تصادفی و گزینه‌ها",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
