import './globals.css';

export const metadata = {
  title: 'MusicPrime | Premium Aesthetic Player',
  description: 'Experience your music in a cinematic, immersive environment.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#070412" />
        {/* iOS PWA support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MusicPrime" />
        <link rel="apple-touch-icon" href="/assets/icon-192.png" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
