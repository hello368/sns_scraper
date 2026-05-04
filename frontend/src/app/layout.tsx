import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/layout/sidebar"
import { ClientLayout } from "@/components/layout/client-layout"
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
  description: "Medical spa treatment video search and curation",
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
        <ClientLayout>
          <Sidebar />
          <main className="flex-1 overflow-auto p-6 md:p-8">
            {children}
          </main>
        </ClientLayout>
        <Toaster />
      </body>
    </html>
  )
}
