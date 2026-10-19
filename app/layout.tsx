import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '13шка дартс',
  description: '301, 501, крикет, большой раунд и набор очков для 2–4 игроков и команд. Счёт, очередь, закрытия и статистика на одном экране.',
  manifest: '/manifest.webmanifest',
  icons: { icon:'/favicon-coral.png', shortcut:'/favicon-coral.png', apple: [{ url:'/apple-touch-icon-coral.png', sizes:'180x180', type:'image/png' }] },
  appleWebApp: { capable:true, title:'13шка дартс', statusBarStyle:'black' },
};
export const viewport: Viewport = {width:'device-width', initialScale:1, themeColor:'#080808'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>}
