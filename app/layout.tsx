import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.scss";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

export const metadata: Metadata = {
  title: "Picomon Stadium",
  description: "Room join proof of concept",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={pressStart.variable}>
      <body>{children}</body>
    </html>
  );
}
