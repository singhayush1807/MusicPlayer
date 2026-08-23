'use client';
import { useState, useEffect, useRef } from 'react';
import { FiTrash2, FiPlus, FiMusic, FiLoader, FiCheckCircle, FiUploadCloud, FiEdit3, FiX } from 'react-icons/fi';
import Link from 'next/link';

export default function AdminDashboard() {
  const [themes, setThemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [dayDesktop, setDayDesktop] = useState('');
  const [dayMobile, setDayMobile] = useState('');
  const [nightDesktop, setNightDesktop] = useState('');
  const [nightMobile, setNightMobile] = useState('');

  // Upload States
  const [uploadingState, setUploadingState] = useState<{ [key: string]: boolean }>({});
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchThemes();
  }, []);

  const fetchThemes = async () => {
    try {
      const res = await fetch('/api/themes');
      const data = await res.json();
      if (res.ok) {
        setThemes(data);
      } else {
        console.error('Failed to fetch themes:', data);
        alert('Failed to load themes. Database connection error.');
        setThemes([]);
      }
    } catch (e) {
      console.error(e);
      setThemes([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle(''); setSubtitle(''); setPlaylistId('');
    setDayDesktop(''); setDayMobile(''); setNightDesktop(''); setNightMobile('');
  };

  const handleEdit = (theme: any) => {
    setEditingId(theme.id);
    setTitle(theme.title);
    setSubtitle(theme.subtitle);
    setPlaylistId(theme.playlistId);
    setDayDesktop(theme.dayDesktop);
    setDayMobile(theme.dayMobile);
    setNightDesktop(theme.nightDesktop);
    setNightMobile(theme.nightMobile);
    // Scroll to form
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingState(prev => ({ ...prev, [key]: true }));
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.result.secure_url) {
        setter(data.result.secure_url);
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Upload failed. Check your Cloudinary keys in .env');
    } finally {
      setUploadingState(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dayDesktop || !dayMobile || !nightDesktop || !nightMobile) {
      alert('⚠️ Please upload all 4 images before saving the theme.');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingId ? `/api/themes/${editingId}` : '/api/themes';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, subtitle, playlistId,
          dayDesktop, dayMobile, nightDesktop, nightMobile
        })
      });

      if (res.ok) {
        alert(editingId ? '✅ Theme updated successfully!' : '✅ Theme created successfully!');
        resetForm();
        fetchThemes();
      } else {
        const error = await res.json();
        alert('❌ Error: ' + (error.error || 'Failed to save'));
      }
    } catch (error) {
      console.error(error);
      alert('❌ Failed to save theme.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteTheme = async (id: string) => {
    if (!confirm('Are you sure you want to delete this theme?')) return;
    try {
      await fetch(`/api/themes/${id}`, { method: 'DELETE' });
      if (editingId === id) resetForm();
      fetchThemes();
    } catch (error) {
      console.error(error);
    }
  };

  const swapDesktop = () => {
    const temp = dayDesktop;
    setDayDesktop(nightDesktop);
    setNightDesktop(temp);
  };

  const swapMobile = () => {
    const temp = dayMobile;
    setDayMobile(nightMobile);
    setNightMobile(temp);
  };

  const ImageUploader = ({ label, value, setter, stateKey }: { label: string, value: string, setter: any, stateKey: string }) => (
    <div style={{ background: '#1a1a1a', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
      <label style={{ display: 'block', marginBottom: '10px', fontSize: '13px', color: '#aaa', fontWeight: 600 }}>{label}</label>
      {value ? (
        <div style={{ position: 'relative', height: '100px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #444' }}>
          <img src={value} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(0,0,0,0.7)', borderRadius: '50%', padding: '4px' }}>
            <FiCheckCircle color="#4ade80" />
          </div>
          {/* Overlay to allow swapping image */}
          <label style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', color: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            opacity: uploadingState[stateKey] ? 1 : 0, transition: 'opacity 0.2s', cursor: 'pointer',
            fontSize: '12px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => { if(!uploadingState[stateKey]) e.currentTarget.style.opacity = '0'; }}
          >
            {uploadingState[stateKey] ? <div style={{ animation: 'disc-spin 1s linear infinite' }}><FiLoader size={20} /></div> : 'Change Image'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setter, stateKey)} disabled={uploadingState[stateKey]} />
          </label>
        </div>
      ) : (
        <label style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100px', border: '2px dashed #444', borderRadius: '6px', cursor: 'pointer',
          background: '#111', color: '#666', transition: 'border 0.2s'
        }}>
          {uploadingState[stateKey] ? (
            <div style={{ animation: 'disc-spin 1s linear infinite' }}><FiLoader size={24} /></div>
          ) : (
            <>
              <FiUploadCloud size={24} style={{ marginBottom: '8px' }} />
              <span style={{ fontSize: '12px' }}>Click to Upload</span>
            </>
          )}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setter, stateKey)} disabled={uploadingState[stateKey]} />
        </label>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#eee', fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <header style={{ padding: '20px 40px', background: '#111', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <FiMusic size={24} color="#ff80a6" />
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>Theme Admin Panel</h1>
        </div>
        <Link href="/" style={{ color: '#aaa', textDecoration: 'none', fontSize: '14px' }}>&larr; Back to Explore</Link>
      </header>

      <div style={{ display: 'flex', gap: '40px', padding: '40px', maxWidth: '1200px', margin: '0 auto', flexDirection: 'row', flexWrap: 'wrap' }}>
        
        {/* Create / Edit Form */}
        <div ref={formRef} style={{ flex: '1 1 500px', background: '#111', padding: '30px', borderRadius: '16px', border: editingId ? '1px solid #ff80a6' : '1px solid #222', transition: 'border 0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              {editingId ? <FiEdit3 color="#ff80a6" /> : <FiPlus color="#ff80a6" />} 
              {editingId ? 'Edit Theme' : 'Create New Theme'}
            </h2>
            {editingId && (
              <button onClick={resetForm} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <FiX /> Cancel Edit
              </button>
            )}
          </div>
          
          <p style={{ color: '#777', fontSize: '14px', marginBottom: '30px' }}>
            {editingId ? 'Modify your theme details and images.' : 'Fill in the details and upload 4 images to create a new playable vibe.'}
          </p>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#aaa' }}>Title</label>
                <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Lofi Beats" 
                  style={{ width: '100%', padding: '12px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#aaa' }}>Subtitle</label>
                <input required value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="e.g. relax & study" 
                  style={{ width: '100%', padding: '12px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#aaa' }}>YouTube Playlist ID</label>
              <input required value={playlistId} onChange={e => setPlaylistId(e.target.value)} placeholder="e.g. PLRiJDPquklv4" 
                style={{ width: '100%', padding: '12px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '8px', boxSizing: 'border-box' }} />
            </div>

            <div style={{ height: '1px', background: '#333', margin: '10px 0' }}></div>
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Upload Backgrounds</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={swapDesktop} style={{ padding: '4px 10px', fontSize: '12px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Swap Desktop (Day ↔ Night)</button>
                  <button type="button" onClick={swapMobile} style={{ padding: '4px 10px', fontSize: '12px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Swap Mobile (Day ↔ Night)</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <ImageUploader label="Day (Desktop)" value={dayDesktop} setter={setDayDesktop} stateKey="dayD" />
                <ImageUploader label="Day (Mobile)" value={dayMobile} setter={setDayMobile} stateKey="dayM" />
                <ImageUploader label="Night (Desktop)" value={nightDesktop} setter={setNightDesktop} stateKey="nightD" />
                <ImageUploader label="Night (Mobile)" value={nightMobile} setter={setNightMobile} stateKey="nightM" />
              </div>
            </div>

            <button 
              disabled={isSubmitting} 
              type="submit" 
              style={{ 
                marginTop: '10px', padding: '14px', background: editingId ? '#d4af37' : '#ff80a6', color: '#000', 
                border: 'none', borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                fontWeight: 'bold', fontSize: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px'
              }}
            >
              {isSubmitting ? (
                <><div style={{ animation: 'disc-spin 1s linear infinite' }}><FiLoader /></div> Saving...</>
              ) : (
                editingId ? 'Update Theme' : 'Create Theme'
              )}
            </button>
          </form>
        </div>

        {/* List Themes */}
        <div style={{ flex: '1 1 400px' }}>
          <h2 style={{ marginTop: 0 }}>Existing Themes</h2>
          
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#888' }}>
              <div style={{ animation: 'disc-spin 1s linear infinite' }}><FiLoader size={20} /></div> Loading themes...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {themes.length === 0 && <p style={{ color: '#666' }}>No themes found.</p>}
              
              {themes.map(t => (
                <div key={t.id} style={{ 
                  background: editingId === t.id ? '#1a1a1a' : '#111', border: editingId === t.id ? '1px solid #ff80a6' : '1px solid #222', padding: '20px', 
                  borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'border 0.2s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '8px', background: `url('${t.nightDesktop}') center/cover` }}></div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px' }}>{t.title}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#ff80a6' }}>/play/{t.slug}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleEdit(t)} style={{ padding: '8px 12px', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><FiEdit3 size={16} /></button>
                    <a href={`/play/${t.slug}`} target="_blank" style={{ padding: '8px 16px', background: '#222', textDecoration: 'none', color: '#fff', borderRadius: '6px', fontSize: '13px' }}>View</a>
                    <button onClick={() => deleteTheme(t.id)} style={{ padding: '8px 12px', background: 'rgba(255, 77, 77, 0.1)', color: '#ff4d4d', border: '1px solid rgba(255, 77, 77, 0.2)', borderRadius: '6px', cursor: 'pointer' }}><FiTrash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
