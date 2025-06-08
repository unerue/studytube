import "./globals.css";
import "antd/dist/reset.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/context/AuthContext";
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { LanguageProvider } from "@/lib/context/LanguageContext";
import ConditionalNavbar from "@/components/layout/ConditionalNavbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StudyTube - AI로 배우는 강의의 학습",
  description: "AI와 함께 강의를 효과적인 학습하세요.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
      <AntdRegistry>
        <AuthProvider>
          <LanguageProvider>
            <div className="min-h-screen bg-gray-50">
              <ConditionalNavbar />
              <main>{children}</main>
            </div>
          </LanguageProvider>
        </AuthProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
