import type { Metadata } from 'next';
import { Fraunces, Nunito_Sans } from 'next/font/google';
import './globals.css';
import './social.css';

const bodyFont = Nunito_Sans({ variable: '--font-body', subsets: ['latin'] });
const headingFont = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Halfknown — Come curious. Leave connected.',
  description:
    'Discover people, share what makes you interesting, and build connections that go beyond the first hello.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${headingFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
