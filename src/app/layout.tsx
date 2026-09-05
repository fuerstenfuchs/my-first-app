import type { Metadata } from "next"
import { Inter, JetBrains_Mono, Urbanist } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { SwRegister } from "@/components/sw-register"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })
// NUR FÜR DIE SEITENLEISTE (PROJ-60). Mark hat Urbanist aus sechs Schriften
// gewählt — für die Leiste, nicht für die ganze App. Der Auftrag lautete
// ausdrücklich „nur die linke Seitenleiste, nur designtechnisch".
const urbanist = Urbanist({ subsets: ["latin"], variable: "--font-leiste" })

export const metadata: Metadata = {
  title: "Prompt Trésor",
  description: "Persönliche KI-Prompt-Verwaltung",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#16a34a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Prompt Trésor" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="icon" type="image/png" href="/logo.png" />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${urbanist.variable} font-sans antialiased`}>
        {children}
        <Toaster />
        <SwRegister />
      </body>
    </html>
  )
}
