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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
