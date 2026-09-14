import type { Metadata } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import './globals.css';

const bodyFont = DM_Sans({
  variable: '--font-body',
  subsets: ['latin'],
});

const headingFont = Bricolage_Grotesque({
  variable: '--font-display',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'halfknown — A little unknown. A lot to discover.',
  description:
    'A personality-first space for dating, friendship, and unexpected conversations. Create your anonymous profile in the Halfknown development preview.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${bodyFont.variable} ${headingFont.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
