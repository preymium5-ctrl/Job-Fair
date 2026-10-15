import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";
import "../styles/typography.css";
import "../styles/job-pay.css";
import "../styles/brand.css";
const thicccboi = localFont({
  src: [
    {
      path: "../public/fonts/thicccboi/THICCCBOI-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/thicccboi/THICCCBOI-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/thicccboi/THICCCBOI-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/thicccboi/THICCCBOI-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/thicccboi/THICCCBOI-ExtraBold.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-thicccboi",
  display: "swap",
});
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "Jobs in Croatia — Your next opportunity starts here",
    template: "%s | Jobs in Croatia",
  },
  description:
    "Explore jobs in Croatia with clear role information, salary details, and simple online applications for skilled professionals.",
  openGraph: {
    title: "Jobs in Croatia — Good work. A better future.",
    siteName: "Jobs in Croatia",
    description: "Find opportunities that match your skills and take the next step in your career.",
    type: "website",
    images: [
      {
        url: "/images/hero.jpg",
        width: 1600,
        height: 1000,
        alt: "Skilled professionals at work",
      },
    ],
  },
  robots:
    process.env.INDEX_SITE === "true"
      ? { index: true, follow: true }
      : { index: false, follow: true },
};
export const viewport: Viewport = { themeColor: "#f7f7f3" };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={thicccboi.variable}
      data-scroll-behavior="smooth"
    >
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Navbar />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
