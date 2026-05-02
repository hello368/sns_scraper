import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/layout/sidebar"
import { Toaster } from "@/components/ui/sonner"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "MediSpa AI — Content Curator",
  description: "의료 스파 트리트먼트 영상 검색 및 큐레이션",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen flex">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  )
}
