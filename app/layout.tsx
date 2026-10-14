import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Global Affairs | World politics, clearly explained",
  description:
    "A current-affairs desk and international relations study companion, grounded in real reporting.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}