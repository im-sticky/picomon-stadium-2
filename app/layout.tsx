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
  description:
    "Pokemon Stadium style drafting and battling imagined in the style of a Game Boy Colour.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={pressStart.variable}>
      <body>{children}</body>
    </html>
  );
}
