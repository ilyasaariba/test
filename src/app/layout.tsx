import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "M212 Logistics",
  description: "M212 equipment logistics — warehouse to event site.",
};

// Runs before first paint: dark is the default; only an explicitly saved
// "light" preference flips the attribute, so there is no theme flash.
const themeBoot = `try{if(localStorage.getItem("m212-theme")==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="antialiased" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
