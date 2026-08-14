import Link from 'next/link';
import prisma from '@/lib/db';
import { FiPlay, FiMusic, FiArrowRight } from 'react-icons/line'; // Wait, let's just use regular react-icons/fi
import { FiPlay as FiPlayFill, FiHeadphones, FiArrowUpRight } from 'react-icons/fi';

export default async function ExplorePage() {
  const themes = await prisma.theme.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <main suppressHydrationWarning style={{ 
      minHeight: '100vh', 
      background: '#040405', 
      color: '#fff', 
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      
      {/* High-End Background Image */}
      <div suppressHydrationWarning style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'url("/assets/main_bg.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.6
      }}></div>

      {/* Cinematic Vignette / Gradient Overlay */}
      <div suppressHydrationWarning style={{
        position: 'fixed', inset: 0, zIndex: 1,
        background: 'radial-gradient(circle at 50% 0%, rgba(4,4,5,0.2) 0%, rgba(4,4,5,0.85) 70%, #040405 100%)',
        pointerEvents: 'none'
      }}></div>

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        
        {/* Minimalist Premium Header */}
        <header style={{ 
          padding: '24px 48px', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '36px', height: '36px', borderRadius: '10px', 
              background: 'rgba(255, 255, 255, 0.1)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex', justifyContent: 'center', alignItems: 'center', 
            }}>
              <FiHeadphones size={16} color="#fff" strokeWidth={2.5} />
            </div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', letterSpacing: '-0.3px', color: '#fff' }}>
              MusicPrime
            </h1>
          </div>
          <div style={{ fontSize: '12px', fontWeight: '500', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            Curated Experiences
          </div>
        </header>

        {/* Elegant Hero Section */}
        <section style={{ 
          padding: '40px 48px 30px', 
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
          textAlign: 'left'
        }}>
          <div style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '8px', 
            color: 'rgba(255, 255, 255, 0.6)', 
            fontSize: '11px', 
            fontWeight: '600', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px',
          }}>
            <span style={{ width: '20px', height: '1px', background: 'rgba(255,255,255,0.4)' }}></span>
            Discover the sound
          </div>
          <h2 style={{ 
            fontSize: 'clamp(32px, 5vw, 56px)', margin: '0 0 16px 0', fontWeight: '600',
            lineHeight: '1.05', letterSpacing: '-2px',
            color: '#fff'
          }}>
            Immersive Audio<br />
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Visual Environments.</span>
          </h2>
          <p style={{ 
            color: 'rgba(255,255,255,0.6)', fontSize: '16px', lineHeight: '1.6', 
            fontWeight: '400', maxWidth: '500px', margin: 0
          }}>
            Select a theme below to enter a beautifully crafted space designed for focus, relaxation, and pure aesthetic bliss.
          </p>
        </section>

        {/* Premium Bento Grid */}
        <section style={{ padding: '0 48px 120px', maxWidth: '1200px', margin: '0 auto', width: '100%', flex: 1 }}>
          {themes.length === 0 ? (
            <div style={{ 
              padding: '60px 40px', border: '1px solid rgba(255,255,255,0.05)', 
              borderRadius: '16px', background: 'rgba(255,255,255,0.02)' 
            }}>
              <p style={{ color: 'rgba(255,255,255,0.4)' }}>No themes available yet.</p>
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
              gap: '24px' 
            }}>
              {themes.map(theme => (
                <Link key={theme.id} href={`/play/${theme.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="premium-card" style={{ 
                    position: 'relative',
                    background: 'rgba(10, 10, 12, 0.4)', 
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)'
                  }}>
                    {/* Image Container */}
                    <div style={{ height: '220px', width: '100%', position: 'relative', overflow: 'hidden' }}>
                      <div className="premium-card-img" style={{ 
                        position: 'absolute', inset: 0, 
                        background: `url('${theme.nightDesktop}') center/cover`, 
                        transition: 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1), filter 0.7s',
                        filter: 'grayscale(30%) brightness(0.8)'
                      }}></div>
                      
                      {/* Gradient over image for text readability */}
                      <div style={{ 
                        position: 'absolute', inset: 0, 
                        background: 'linear-gradient(to top, rgba(10,10,12,1) 0%, rgba(10,10,12,0.4) 40%, rgba(10,10,12,0) 100%)' 
                      }}></div>
                      
                      {/* Hover Arrow Icon */}
                      <div className="premium-card-icon" style={{
                        position: 'absolute', top: '24px', right: '24px',
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        opacity: 0, transform: 'translate(-10px, 10px)',
                        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}>
                        <FiArrowUpRight color="#fff" size={18} />
                      </div>

                      {/* Content inside image */}
                      <div style={{ 
                        position: 'absolute', bottom: '0', left: '0', right: '0',
                        padding: '24px' 
                      }}>
                        <div style={{ 
                          display: 'inline-block', padding: '4px 10px', 
                          background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)',
                          borderRadius: '6px', fontSize: '11px', fontWeight: '600', 
                          letterSpacing: '1px', textTransform: 'uppercase', 
                          color: 'rgba(255,255,255,0.8)', marginBottom: '12px',
                          border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                          {theme.subtitle}
                        </div>
                        <h3 style={{ 
                          margin: 0, fontSize: '24px', fontWeight: '600', letterSpacing: '-0.5px' 
                        }}>
                          {theme.title}
                        </h3>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        /* Premium Hover Effects */
        .premium-card:hover { 
          border-color: rgba(255,255,255,0.2) !important;
          background: rgba(20, 20, 24, 0.6) !important;
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
        .premium-card:hover .premium-card-img {
          transform: scale(1.05);
          filter: grayscale(0%) brightness(1) !important;
        }
        .premium-card:hover .premium-card-icon {
          opacity: 1 !important;
          transform: translate(0, 0) !important;
        }

        /* Responsive */
        @media (max-width: 768px) {
          header { padding: 20px 24px !important; }
          section { padding: 60px 24px 60px !important; }
        }
      `}} />
    </main>
  );
}
