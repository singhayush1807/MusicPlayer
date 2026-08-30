'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useListenTogether, type SyncAction } from '@/hooks/useListenTogether';

// Global singleton guard — survives React Strict Mode double-mount
let ytPlayerGlobal: any = null;
let ytInitialized = false;

export default function PlayerClient({ theme }: { theme: any }) {
  const [appLoaded, setAppLoaded] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<'night' | 'day'>('night');
  const [rainEnabled, setRainEnabled] = useState(false);
  const [activePanel, setActivePanel] = useState<'none' | 'songlist' | 'lyrics' | 'together'>('none');
  const [clock, setClock] = useState('00:00');
  const [joinCode, setJoinCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const syncLock = useRef(false);
  
  // Track info
  const [title, setTitle] = useState('Loading...');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [thumbnail, setThumbnail] = useState('');
  
  // Playlist & Lyrics
  const [playlistItems, setPlaylistItems] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lyrics, setLyrics] = useState<{ text: string, html: string } | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  // Refs
  const ytPlayer = useRef<any>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const fetchRetries = useRef(0);
  const keepaliveAudio = useRef<HTMLAudioElement | null>(null);
  const keepaliveAudioCtx = useRef<AudioContext | null>(null);
  const userPausedRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const isPlayingRef = useRef(false);
  const wakeLockRef = useRef<any>(null);
  const noSleepVideoRef = useRef<HTMLVideoElement | null>(null);

  // Background state (for crossfade)
  const [bgA, setBgA] = useState(theme.nightDesktop);
  const [bgB, setBgB] = useState('');
  const [activeBg, setActiveBg] = useState<'A' | 'B'>('A');
  const [isMobile, setIsMobile] = useState(false);

  // Petals & Hearts
  const [petals, setPetals] = useState<any[]>([]);
  const [hearts, setHearts] = useState<any[]>([]);

  // Mounted state for animations
  const [mounted, setMounted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);

  useEffect(() => {
    const isMobileView = window.innerWidth <= 768;
    setIsMobile(isMobileView);
    
    // Auto Day/Night Detection
    const h = new Date().getHours();
    const initialMode = (h >= 6 && h < 18) ? 'day' : 'night';
    setMode(initialMode);
    
    // Set immediate background to prevent flash
    setBgA(initialMode === 'day' ? (isMobileView ? theme.dayMobile : theme.dayDesktop) : (isMobileView ? theme.nightMobile : theme.nightDesktop));

    setMounted(true);
    
    // Fade out loading screen after minimum duration (ensures animation is seen)
    const loadStart = Date.now();
    const MIN_LOADING_MS = 1800;
    const finishLoading = () => {
      const elapsed = Date.now() - loadStart;
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
      setTimeout(() => setAppLoaded(true), remaining);
    };
    // Wait for fonts + images to settle, then respect minimum
    if (document.readyState === 'complete') {
      finishLoading();
    } else {
      window.addEventListener('load', finishLoading, { once: true });
      // Fallback in case 'load' already fired
      setTimeout(finishLoading, 3000);
    }
    
    // Init Petals
    const p = [];
    for (let i = 0; i < 20; i++) {
      p.push({
        id: i,
        size: 6 + Math.random() * 8,
        bg: Math.random() > 0.5 ? '#ffd6e6' : '#ffa6c9',
        left: Math.random() * 100,
        dur: 8 + Math.random() * 12,
        del: -(Math.random() * 15),
        drift: (Math.random() - 0.5) * 200
      });
    }
    setPetals(p);

    // Setup YouTube IFrame API — global singleton guard
    if (!ytInitialized) {
      ytInitialized = true;

      // Ensure the yt-player div exists in the DOM
      const ensureContainer = () => {
        if (!document.getElementById('yt-player')) {
          const container = document.getElementById('yt-player-wrapper');
          if (container) {
            const div = document.createElement('div');
            div.id = 'yt-player';
            container.appendChild(div);
          }
        }
      };

      const checkYT = setInterval(() => {
        if ((window as any).YT && (window as any).YT.Player) {
          clearInterval(checkYT);
          ensureContainer();
          initPlayer();
        }
      }, 200);

      if (!(window as any).YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }
    } else if (ytPlayerGlobal) {
      // Strict Mode re-mount: reuse existing global player
      ytPlayer.current = ytPlayerGlobal;
      setPlayerReady(true);
      setTitle("Ready — Click Play to Start");
      startProgressInterval();
      setTimeout(fetchPlaylist, 1500);
    }

    // Keyboard shortcuts — use ytPlayer ref directly to avoid stale closures
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!ytPlayer.current) return;
      
      if (e.code === 'Space') { 
        e.preventDefault();
        e.stopPropagation();
        // Check actual player state, not React state (avoids stale closure)
        if (typeof ytPlayer.current.getPlayerState === 'function') {
          const state = ytPlayer.current.getPlayerState();
          if (state === 1) { // PLAYING
            userPausedRef.current = true;
            ytPlayer.current.pauseVideo();
          } else {
            userPausedRef.current = false;
            ytPlayer.current.playVideo();
          }
        }
      }
      if (e.code === 'KeyN') { ytPlayer.current.nextVideo?.(); }
      if (e.code === 'KeyP') { ytPlayer.current.previousVideo?.(); }
      if (e.code === 'KeyD') { setMode(m => m === 'day' ? 'night' : 'day'); }
      if (e.code === 'KeyR') { setRainEnabled(r => !r); }
    };
    window.addEventListener('keydown', handleKey);

    // Clock
    const tick = () => {
      let d = new Date();
      let hours = d.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const min = String(d.getMinutes()).padStart(2, '0');
      setClock(`${hours}:${min} ${ampm}`);
    };
    tick();
    const clockInt = setInterval(tick, 30000);
    
    // Hearts
    const heartInt = setInterval(() => {
      if (ytPlayer.current && typeof ytPlayer.current.getPlayerState === 'function') {
        if (ytPlayer.current.getPlayerState() === (window as any).YT.PlayerState.PLAYING) {
          setHearts(prev => {
            if (prev.length > 10) return prev;
            return [...prev, {
              id: Date.now(),
              char: Math.random() > 0.5 ? '💖' : '✨',
              left: 40 + Math.random() * 20,
              size: 12 + Math.random() * 10,
              dur: 2 + Math.random() * 2
            }];
          });
        }
      }
    }, 3000);

    const heartCleanup = setInterval(() => {
      setHearts(prev => prev.filter(h => Date.now() - h.id < 4000));
    }, 2000);

    // Setup MediaSession handlers to distinguish user pause from OS auto-pause
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        userPausedRef.current = false;
        if (ytPlayer.current) ytPlayer.current.playVideo();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        userPausedRef.current = true;
        if (ytPlayer.current) ytPlayer.current.pauseVideo();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (ytPlayer.current) ytPlayer.current.nextVideo?.();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (ytPlayer.current) ytPlayer.current.previousVideo?.();
      });
    }

    // === Web Audio API + HTML5 Audio Keepalive for Background Playback ===
    const silenceDataUri = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
    const audio = new Audio(silenceDataUri);
    audio.loop = true;
    audio.volume = 0.01;
    // iOS-specific: allow inline playback
    (audio as any).playsInline = true;
    (audio as any).setAttribute('playsinline', '');
    keepaliveAudio.current = audio;

    if (!keepaliveAudioCtx.current && (window.AudioContext || (window as any).webkitAudioContext)) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        keepaliveAudioCtx.current = new AudioContextClass();
        const oscillator = keepaliveAudioCtx.current.createOscillator();
        const gainNode = keepaliveAudioCtx.current.createGain();
        gainNode.gain.value = 0; // Pure silence
        oscillator.connect(gainNode);
        gainNode.connect(keepaliveAudioCtx.current.destination);
        oscillator.start();
        keepaliveAudioCtx.current.suspend();
      } catch (e) {}
    }

    // === Unlock Audio Context ===
    // Browsers block audio.play() if not triggered by user interaction.
    // We bind a one-time listener to any click/touch to "bless" the audio element.
    const unlockAudio = () => {
      if (keepaliveAudio.current) {
        keepaliveAudio.current.play().then(() => {
          if (!isPlayingRef.current && keepaliveAudio.current) keepaliveAudio.current.pause();
        }).catch(() => {});
      }
      if (keepaliveAudioCtx.current && keepaliveAudioCtx.current.state === 'suspended') {
        keepaliveAudioCtx.current.resume().catch(() => {});
        setTimeout(() => {
          if (!isPlayingRef.current && keepaliveAudioCtx.current) keepaliveAudioCtx.current.suspend().catch(() => {});
        }, 100);
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    // === Visibility Change: auto-resume when returning to app ===
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Page going to background — record if we were playing
        wasPlayingRef.current = isPlayingRef.current;
      } else if (document.visibilityState === 'visible') {
        // Returning from background — resume if we were playing
        if (wasPlayingRef.current && ytPlayer.current) {
          setTimeout(() => {
            if (ytPlayer.current && typeof ytPlayer.current.getPlayerState === 'function') {
              const state = ytPlayer.current.getPlayerState();
              if (state === 2 || state === -1) {
                ytPlayer.current.playVideo();
              }
            }
          }, 300);
        }
        // Re-acquire wake lock (iOS releases it on background)
        if (isPlayingRef.current && 'wakeLock' in navigator) {
          (navigator as any).wakeLock.request('screen').then((wl: any) => {
            wakeLockRef.current = wl;
          }).catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(clockInt);
      clearInterval(heartInt);
      clearInterval(heartCleanup);
      if (progressInterval.current) clearInterval(progressInterval.current);
      if (keepaliveAudio.current) {
        keepaliveAudio.current.pause();
        keepaliveAudio.current = null;
      }
      if (keepaliveAudioCtx.current) {
        keepaliveAudioCtx.current.close().catch(() => {});
        keepaliveAudioCtx.current = null;
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      if (noSleepVideoRef.current) {
        noSleepVideoRef.current.pause();
        noSleepVideoRef.current.remove();
        noSleepVideoRef.current = null;
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Preload alternate backgrounds to prevent black flash
  useEffect(() => {
    const preloadUrls = [
      theme.dayDesktop,
      theme.dayMobile,
      theme.nightDesktop,
      theme.nightMobile
    ].filter(Boolean);
    
    preloadUrls.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }, [theme]);

  // Mode changes
  useEffect(() => {
    const nextSrc = mode === 'day' 
      ? (isMobile ? theme.dayMobile : theme.dayDesktop)
      : (isMobile ? theme.nightMobile : theme.nightDesktop);
      
    if (activeBg === 'A') {
      setBgB(nextSrc);
      setActiveBg('B');
    } else {
      setBgA(nextSrc);
      setActiveBg('A');
    }
  }, [mode, isMobile, theme]);

  const initPlayer = () => {
    // Guard: if already initialized (HMR / Strict Mode), reuse
    if (ytPlayerGlobal) {
      ytPlayer.current = ytPlayerGlobal;
      setPlayerReady(true);
      setTitle("Ready — Click Play to Start");
      startProgressInterval();
      setTimeout(fetchPlaylist, 1500);
      return;
    }

    let customSequence: string[] = [];
    try {
      if (theme.customSequence) customSequence = JSON.parse(theme.customSequence);
    } catch(e){}

    // Match legacy app.js exactly: let playerVars handle playlist loading
    let pVars: any = { 
      autoplay: 1, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, 
      rel: 0, showinfo: 0, iv_load_policy: 3, playsinline: 1
    };

    if (customSequence.length === 0) {
      pVars.listType = 'playlist';
      pVars.list = theme.playlistId || 'PLRiJDPquklv4cT2O5-gD4_C0-8a_R4NfO';
    }
    
    new (window as any).YT.Player('yt-player', {
      height: '200',
      width: '200',
      playerVars: pVars,
      events: {
        onReady: (event: any) => {
          ytPlayer.current = event.target;
          ytPlayerGlobal = event.target;
          setPlayerReady(true);
          setTitle("Ready — Click Play to Start");
          // Only call loadPlaylist for custom sequences (playerVars already handles normal playlists)
          if (customSequence.length > 0) {
            ytPlayer.current.loadPlaylist(customSequence);
          }
          event.target.setVolume(100);
          event.target.playVideo();
          
          // Restore saved state if tab was suspended
          const savedIndex = sessionStorage.getItem('mp_saved_index');
          const savedTime = sessionStorage.getItem('mp_saved_time');
          if (savedIndex) {
            ytPlayer.current.playVideoAt(parseInt(savedIndex));
            if (savedTime) {
              setTimeout(() => {
                if (ytPlayer.current && typeof ytPlayer.current.seekTo === 'function') {
                  ytPlayer.current.seekTo(parseFloat(savedTime), true);
                }
              }, 500);
            }
          }
          
          startProgressInterval();
          setTimeout(fetchPlaylist, 1500);
        },
        onStateChange: (event: any) => {
          ytPlayer.current = event.target;
          const state = event.data;
          const playing = state === (window as any).YT.PlayerState.PLAYING;
          
          if (state === (window as any).YT.PlayerState.PAUSED) {
            // Aggressive Resume: OS might have auto-paused iframe due to screen off/recents
            if (document.visibilityState === 'hidden' && isPlayingRef.current && !userPausedRef.current) {
              ytPlayer.current.playVideo();
              return; // Do not update state to paused
            } else {
              setIsPlaying(false);
              isPlayingRef.current = false;
              if (keepaliveAudio.current) keepaliveAudio.current.pause();
              if (keepaliveAudioCtx.current) keepaliveAudioCtx.current.suspend().catch(() => {});
              if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
              if (wakeLockRef.current) {
                wakeLockRef.current.release().catch(() => {});
                wakeLockRef.current = null;
              }
              if (noSleepVideoRef.current) {
                noSleepVideoRef.current.pause();
              }
            }
          } else if (state === (window as any).YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            isPlayingRef.current = true;
            userPausedRef.current = false; // reset flag
            
            if (keepaliveAudio.current && keepaliveAudio.current.paused) {
              keepaliveAudio.current.play().catch(() => {});
            }
            if (keepaliveAudioCtx.current && keepaliveAudioCtx.current.state === 'suspended') {
              keepaliveAudioCtx.current.resume().catch(() => {});
            }
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
            
            if ('wakeLock' in navigator) {
              (navigator as any).wakeLock.request('screen').then((wl: any) => {
                wakeLockRef.current = wl;
              }).catch(() => {});
            } else {
              if (!noSleepVideoRef.current) {
                const v = document.createElement('video');
                v.setAttribute('playsinline', '');
                v.setAttribute('muted', '');
                v.setAttribute('loop', '');
                v.style.cssText = 'position:fixed;top:-1px;left:-1px;width:1px;height:1px;opacity:0.01;pointer-events:none;';
                v.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0AAAA1m1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAACGdHJhawAAAFx0a2hkAAAAAwAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAACOdWR0YQAAAIZtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyAAAAAAAAAAAAAAAAAAAAZ2lsc3QAAAAvAAAAG2NvbnRlbnRfdHlwZQAAAABpbWFnZS9qcGVn';
                document.body.appendChild(v);
                v.play().catch(() => {});
                noSleepVideoRef.current = v;
              } else {
                noSleepVideoRef.current.play().catch(() => {});
              }
            }
          } else if (state === (window as any).YT.PlayerState.ENDED) {
            setIsPlaying(false);
            isPlayingRef.current = false;
            if (keepaliveAudio.current) keepaliveAudio.current.pause();
            if (keepaliveAudioCtx.current) keepaliveAudioCtx.current.suspend().catch(() => {});
          }
          
          if (
            event.data === (window as any).YT.PlayerState.PLAYING || 
            event.data === (window as any).YT.PlayerState.PAUSED ||
            event.data === 5 /* CUED */ ||
            event.data === -1 /* UNSTARTED */
          ) {
            updateTrackInfo();
            if(typeof ytPlayer.current.getPlaylistIndex === 'function') {
               setCurrentIndex(ytPlayer.current.getPlaylistIndex());
            }
          }
        },
        onError: (event: any) => {
          ytPlayer.current = event.target;
          ytPlayerGlobal = event.target;
          
          if(typeof ytPlayer.current.nextVideo === 'function') {
             setTimeout(() => ytPlayer.current.nextVideo(), 2000);
          }
        }
      }
    });
  };

  const startProgressInterval = () => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    let positionTick = 0;
    progressInterval.current = setInterval(() => {
      if (ytPlayer.current && typeof ytPlayer.current.getCurrentTime === 'function') {
        const ct = ytPlayer.current.getCurrentTime();
        const dur = ytPlayer.current.getDuration();
        setCurrentTime(ct);
        setDuration(dur);
        
        // Save state for auto-resume if tab suspends
        if (typeof ytPlayer.current.getPlaylistIndex === 'function') {
          sessionStorage.setItem('mp_saved_index', ytPlayer.current.getPlaylistIndex().toString());
        }
        if (ct > 0) {
          sessionStorage.setItem('mp_saved_time', ct.toString());
        }
        
        // Sync lock screen seekbar every ~5s
        positionTick++;
        if (positionTick % 10 === 0 && 'mediaSession' in navigator && dur > 0) {
          try {
            navigator.mediaSession.setPositionState({
              duration: dur,
              playbackRate: 1,
              position: Math.min(ct, dur)
            });
          } catch(e) {}
        }
      }
    }, 500);
  };

  const updateTrackInfo = () => {
    if (!ytPlayer.current || typeof ytPlayer.current.getVideoData !== 'function') return;
    const data = ytPlayer.current.getVideoData();
    if (data && data.title) {
      let clean = data.title.replace(/[\(\[].*?(official|video|lyric|audio).*?[\)\]]/gi, '').replace(/\|.*/, '').trim();
      setTitle(clean);
      setThumbnail(`https://img.youtube.com/vi/${data.video_id}/hqdefault.jpg`);
      
      // Setup Media Session API for background playback support
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: clean,
          artist: 'MusicPrime',
          album: theme.title || 'Playlist',
          artwork: [
            { src: `https://img.youtube.com/vi/${data.video_id}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' },
            { src: `https://img.youtube.com/vi/${data.video_id}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }
          ]
        });
        // Update position state for lock screen seekbar
        try {
          const dur = ytPlayer.current?.getDuration?.() || 0;
          const pos = ytPlayer.current?.getCurrentTime?.() || 0;
          if (dur > 0) {
            navigator.mediaSession.setPositionState({
              duration: dur,
              playbackRate: 1,
              position: Math.min(pos, dur)
            });
          }
        } catch(e) {}
      }
      
      setPlaylistItems(prev => {
        const arr = [...prev];
        const idx = typeof ytPlayer.current.getPlaylistIndex === 'function' ? ytPlayer.current.getPlaylistIndex() : 0;
        if (arr[idx]) arr[idx].title = clean;
        return arr;
      });
    }
  };

  const fetchPlaylist = () => {
    if (!ytPlayer.current || typeof ytPlayer.current.getPlaylist !== 'function') return;
    let pl = ytPlayer.current.getPlaylist();
    if (!pl || !pl.length) {
      if (fetchRetries.current < 15) {
        fetchRetries.current++;
        setTimeout(fetchPlaylist, 1000);
      }
      return;
    }
    
    setPlaylistItems(pl.map((id: string, i: number) => ({ id, title: `Loading track...` })));
    
    pl.forEach((id: string, i: number) => {
      fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.title) {
            let clean = data.title.replace(/[\(\[].*?(official|video|lyric|audio).*?[\)\]]/gi, '').replace(/\|.*/, '').trim();
            setPlaylistItems(prev => {
              const arr = [...prev];
              if(arr[i]) arr[i].title = clean;
              return arr;
            });
          }
        }).catch(err => console.log('Failed to fetch title for', id));
    });
  };

  const loadLyrics = (songTitle: string) => {
    setLyricsLoading(true);
    setLyrics(null);
    let artist = "Unknown";
    let t = songTitle;
    if (songTitle.includes('-')) {
      let parts = songTitle.split('-');
      artist = parts[0].trim();
      t = parts[1].trim();
    } else {
      artist = "Arijit Singh"; // Fallback
    }

    fetch(`https://api.lyrics.ovh/v1/${artist}/${t}`)
      .then(res => res.json())
      .then(data => {
        if (data.lyrics) {
          setLyrics({ text: data.lyrics, html: data.lyrics.replace(/\n/g, '<br>') });
        } else {
          setLyrics({ text: '', html: '' });
        }
      })
      .catch(() => setLyrics({ text: '', html: '' }))
      .finally(() => setLyricsLoading(false));
  };

  const togglePanel = (panel: 'none' | 'songlist' | 'lyrics' | 'together') => {
    if (activePanel === panel) {
      setActivePanel('none');
    } else {
      setActivePanel(panel);
      if (panel === 'lyrics' && title !== "Ready — Click Play to Start" && title !== "Loading...") {
        loadLyrics(title);
      }
    }
  };

  // ── Listen Together Sync Callback ──
  const handleSyncAction = useCallback((action: SyncAction) => {
    if (!ytPlayer.current) return;
    syncLock.current = true;
    try {
      switch (action.type) {
        case 'play':
          if (typeof action.trackIndex === 'number' && action.trackIndex !== currentIndex) {
            ytPlayer.current.playVideoAt(action.trackIndex);
          }
          if (typeof action.currentTime === 'number') {
            ytPlayer.current.seekTo(action.currentTime, true);
          }
          ytPlayer.current.playVideo();
          break;
        case 'pause':
          if (typeof action.currentTime === 'number') {
            ytPlayer.current.seekTo(action.currentTime, true);
          }
          ytPlayer.current.pauseVideo();
          break;
        case 'seek':
          if (typeof action.currentTime === 'number') {
            ytPlayer.current.seekTo(action.currentTime, true);
          }
          break;
        case 'next':
          ytPlayer.current.nextVideo();
          break;
        case 'prev':
          ytPlayer.current.previousVideo();
          break;
        case 'heartbeat':
          // Only apply heartbeat if significantly out of sync (>3s)
          if (typeof action.currentTime === 'number' && Math.abs(currentTime - action.currentTime) > 3) {
            ytPlayer.current.seekTo(action.currentTime, true);
          }
          if (typeof action.trackIndex === 'number' && action.trackIndex !== currentIndex) {
            ytPlayer.current.playVideoAt(action.trackIndex);
          }
          if (action.isPlaying && !isPlaying) ytPlayer.current.playVideo();
          if (!action.isPlaying && isPlaying) ytPlayer.current.pauseVideo();
          break;
      }
    } finally {
      setTimeout(() => { syncLock.current = false; }, 500);
    }
  }, [currentIndex, currentTime, isPlaying]);

  const together = useListenTogether(
    handleSyncAction,
    useCallback(() => {
      const ct = ytPlayer.current && typeof ytPlayer.current.getCurrentTime === 'function' ? ytPlayer.current.getCurrentTime() : currentTime;
      return {
        trackIndex: currentIndex,
        currentTime: ct,
        isPlaying
      };
    }, [currentIndex, currentTime, isPlaying])
  );
  const copyRoomCode = () => {
    if (together.roomCode) {
      navigator.clipboard.writeText(together.roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const togglePlay = () => {
    if (!ytPlayer.current) return;
    if (isPlaying && typeof ytPlayer.current.pauseVideo === 'function') {
      userPausedRef.current = true;
      ytPlayer.current.pauseVideo();
      if (together.isInRoom && !syncLock.current) {
        together.broadcastAction({ type: 'pause', currentTime: ytPlayer.current.getCurrentTime?.() || 0 });
      }
    } else if (typeof ytPlayer.current.playVideo === 'function') {
      userPausedRef.current = false;
      ytPlayer.current.playVideo();
      if (together.isInRoom && !syncLock.current) {
        together.broadcastAction({ type: 'play', trackIndex: currentIndex, currentTime: ytPlayer.current.getCurrentTime?.() || 0 });
      }
    }
  };
  const nextTrack = () => {
    ytPlayer.current?.nextVideo && ytPlayer.current.nextVideo();
    if (together.isInRoom && !syncLock.current) {
      together.broadcastAction({ type: 'next' });
    }
  };
  const prevTrack = () => {
    ytPlayer.current?.previousVideo && ytPlayer.current.previousVideo();
    if (together.isInRoom && !syncLock.current) {
      together.broadcastAction({ type: 'prev' });
    }
  };
  
  const toggleShuffle = () => {
    if (!ytPlayer.current || typeof ytPlayer.current.setShuffle !== 'function') return;
    const nextState = !isShuffle;
    ytPlayer.current.setShuffle(nextState);
    setIsShuffle(nextState);
    
    // UI Flash effect
    const btn = document.getElementById('shuffle-btn');
    if (btn) {
      btn.classList.add('flash');
      setTimeout(() => btn.classList.remove('flash'), 300);
    }
  };

  // Register media session action handlers so earphone/lock screen controls work
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        if (ytPlayer.current && typeof ytPlayer.current.playVideo === 'function') {
          ytPlayer.current.playVideo();
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (ytPlayer.current && typeof ytPlayer.current.pauseVideo === 'function') {
          ytPlayer.current.pauseVideo();
        }
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (ytPlayer.current && typeof ytPlayer.current.previousVideo === 'function') {
          ytPlayer.current.previousVideo();
        }
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (ytPlayer.current && typeof ytPlayer.current.nextVideo === 'function') {
          ytPlayer.current.nextVideo();
        }
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null && ytPlayer.current && typeof ytPlayer.current.seekTo === 'function') {
          ytPlayer.current.seekTo(details.seekTime, true);
        }
      });
    }
  }, []);

  const fmtTime = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    let m = Math.floor(s / 60);
    let sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <main suppressHydrationWarning className={`${appLoaded ? 'app-loaded' : ''} ${mode === 'day' ? 'day-mode' : 'night-mode'}`} style={{ height: '100vh', width: '100vw', overflow: 'hidden', position: 'fixed', top: 0, left: 0 }}>
      {/* Scroll Lock for Player Only */}
      <style>{`html, body { overflow: hidden !important; }`}</style>

      {/* Premium Loading Screen */}
      <div className={`loading-screen ${appLoaded ? 'fade-out' : ''}`}>
        <div className="loading-cube-scene">
          <div className="loading-cube">
            <div className="loading-cube-face front">♫</div>
            <div className="loading-cube-face back">♪</div>
            <div className="loading-cube-face right">♩</div>
            <div className="loading-cube-face left">♬</div>
            <div className="loading-cube-face top">❤</div>
            <div className="loading-cube-face bottom">✨</div>
          </div>
        </div>
        <div className="loading-brand">MusicPrime</div>
        <div className="loading-bar-track"><div className="loading-bar-fill"></div></div>
      </div>

      {/* Background Layers */}
      <div suppressHydrationWarning className={`bg-layer ${activeBg === 'A' ? 'visible' : ''}`} style={{ backgroundImage: `url("${bgA}")`, backgroundPosition: bgA?.includes('night') ? 'calc(50% + 28px) center' : 'center' }}></div>
      <div suppressHydrationWarning className={`bg-layer ${activeBg === 'B' ? 'visible' : ''}`} style={{ backgroundImage: `url("${bgB}")`, backgroundPosition: bgB?.includes('night') ? 'calc(50% + 28px) center' : 'center' }}></div>
      
      {/* Rain overlay */}
      <div suppressHydrationWarning id="rain" className={`rain-layer ${rainEnabled ? 'active' : ''}`}>
        {rainEnabled && Array.from({length: 40}).map((_, i) => (
             <div key={i} className="rain-drop" style={{
               left: `${Math.random() * 100}%`,
               height: `${10 + Math.random() * 20}px`,
               background: '#ffffff',
               opacity: 0.2 + Math.random() * 0.4,
               animation: `rain-fall ${0.5 + Math.random() * 0.5}s linear ${Math.random() * 2}s infinite`
             }}></div>
        ))}
      </div>

      {/* Gradient overlay */}
      <div suppressHydrationWarning className="scene-overlay"></div>

      <div suppressHydrationWarning id="particles" className="particle-layer">
        {petals.map(p => (
          <div key={p.id} className="petal" style={{
            width: `${p.size}px`, height: `${p.size}px`, background: p.bg, left: `${p.left}%`,
            '--drift': `${p.drift}px`, animation: `petal-fall ${p.dur}s ease-in-out ${p.del}s infinite`
          } as React.CSSProperties & { [key: string]: any }}></div>
        ))}
      </div>
      <div suppressHydrationWarning id="hearts" className="heart-layer">
        {hearts.map(h => (
          <div key={h.id} className="floating-heart" style={{
            left: `${h.left}%`, bottom: '140px', fontSize: `${h.size}px`,
            animation: `float-heart ${h.dur}s ease-in forwards`
          }}>{h.char}</div>
        ))}
      </div>

      {/* UI wrapper matching index.html */}
      <div id="ui" suppressHydrationWarning>
        <header className="main-header">
          <div className="brand">
            <div className="brand-logo-container" style={{ 
              width: '36px', height: '36px', borderRadius: '10px', 
              background: 'rgba(255, 255, 255, 0.1)', 
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <svg className="brand-logo-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
              </svg>
            </div>
            <div className="brand-text">
              <div className="brand-title brand-title-new" style={{ fontSize: '18px', letterSpacing: '-0.5px' }}>MusicPrime</div>
              <div className="brand-sub">PREMIUM PLAYER</div>
            </div>
          </div>
          
          {/* Middle Icons (Pills) */}
          <div className="header-middle">
            <button className={`mode-btn ${mode === 'day' ? 'active' : ''}`} onClick={() => setMode('day')} title="Day Mode">
              <span className="mode-icon">☀️</span>
            </button>
            <button className={`mode-btn ${mode === 'night' ? 'active' : ''}`} onClick={() => setMode('night')} title="Night Mode">
              <span className="mode-icon">🌙</span>
            </button>
            <button className={`mode-btn ${rainEnabled ? 'active' : ''}`} onClick={() => setRainEnabled(r => !r)} title="Rain">
              <span className="mode-icon">🌧️</span>
            </button>
          </div>

          <div className="header-right">
            <div className="clock" id="clock">{clock}</div>
            <div className="listeners" style={{ justifyContent: 'flex-end' }}>
              <span className="live-dot"></span>
              <span className="jitter-heart">💕</span> Listening
            </div>
          </div>
        </header>

        {/* The Exact Big Hero Typography */}
        <div className="hero">
          <div className="hero-count" id="track-count">NON-STOP · RADIO</div>
          <h1 className="hero-title" id="hero-title">
            {theme.title === 'प्यार भरे गीत' ? (
              <>प्यार भरे<br/>गीत</>
            ) : theme.title}
          </h1>
          <div className="hero-sub">
            <span className="hero-line"></span>
            {theme.subtitle}
            <span className="hero-line"></span>
          </div>
          <div className="hero-quote">
            "Made with a little imagination — you and I, sitting somewhere in the mountains, listening to the songs I handpicked for you."
          </div>
        </div>
        
        <div className="kbd-hints-inline">
          <kbd>Space</kbd> Play/Pause &nbsp;·&nbsp; <kbd>N</kbd> Next &nbsp;·&nbsp; <kbd>D</kbd> Day/Night &nbsp;·&nbsp; <kbd>R</kbd> Rain
        </div>
      </div>

      {/* Panels */}
      <div id="songlist-panel" className={`panel ${activePanel === 'songlist' ? 'open' : ''}`}>
        <div className="panel-header">
          <span className="panel-label">📋 Songlist</span>
          <button className="panel-close" onClick={() => setActivePanel('none')}>✕</button>
        </div>
        <div className="panel-body" id="songlist-body">
          {playlistItems.length === 0 ? <p className="panel-placeholder">Loading playlist…</p> : (
            playlistItems.map((item, i) => (
              <div key={i} className={`song-item ${i === currentIndex ? 'playing' : ''}`} onClick={() => ytPlayer.current.playVideoAt(i)}>
                <div className="song-num">{i === currentIndex ? '🎵' : (i + 1)}</div>
                <div className="song-name">{item.title}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div id="lyrics-panel" className={`panel ${activePanel === 'lyrics' ? 'open' : ''}`}>
        <div className="panel-header">
          <span className="panel-label">🎶 Lyrics</span>
          <button className="panel-close" onClick={() => setActivePanel('none')}>✕</button>
        </div>
        <div className="panel-body" id="lyrics-body">
          {lyricsLoading ? (
            <p className="panel-placeholder">Searching lyrics for<br/><strong>{title}</strong>...</p>
          ) : lyrics?.html ? (
            <div className="lyrics-text" dangerouslySetInnerHTML={{ __html: lyrics.html }}></div>
          ) : (
            <>
              <p className="panel-placeholder" style={{ marginBottom: '20px' }}>
                Couldn't find exact lyrics for<br/><strong>{title}</strong>
              </p>
              <p className="lyrics-text" style={{ opacity: 0.6 }}>
                (Enjoy the music!)<br/><br/>
                🎵 🎵 🎵<br/><br/>
                {theme.title}<br/>
                {theme.subtitle}<br/>
                🎵 🎵 🎵
              </p>
            </>
          )}
        </div>
      </div>

      {/* Listen Together Panel */}
      <div id="together-panel" className={`panel ${activePanel === 'together' ? 'open' : ''}`}>
        <div className="panel-header">
          <span className="panel-label">🔗 Listen Together</span>
          <button className="panel-close" onClick={() => setActivePanel('none')}>✕</button>
        </div>
        <div className="panel-body together-body">
          {!together.isInRoom && !together.isConnected ? (
            <div className="together-menu">
              <p className="together-desc">Listen together in perfect sync.</p>
              <button className="together-btn create" onClick={() => { together.createRoom(); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                Create Room
              </button>
              <div className="together-divider"><span>or</span></div>
              <div className="together-join-row">
                <input
                  type="text"
                  className="together-input"
                  placeholder="CODE"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') together.joinRoom(joinCode); }}
                />
                <button className="together-btn join" onClick={() => together.joinRoom(joinCode)}>
                  Join
                </button>
              </div>
              {together.error && (
                <p className="together-error">{together.error}</p>
              )}
            </div>
          ) : !together.isConnected ? (
            <div className="together-connecting">
              <div className="together-connecting-spinner"></div>
              <span className="together-connecting-text">Connecting...</span>
            </div>
          ) : (
            <div className="together-connected">
              <div className="together-status-badge">
                <span className="together-pulse"></span>
                Connected
              </div>

              <div className="together-code-display">
                <div className="together-code">{together.roomCode}</div>
                <div className="together-code-actions">
                  <button className="together-copy-btn" onClick={copyRoomCode}>
                    {codeCopied ? '✓ Copied!' : 'Copy Code'}
                  </button>
                  <span className="together-members-badge">
                    {together.memberCount} {together.memberCount === 1 ? 'listener' : 'listeners'}
                  </span>
                </div>
              </div>

              <button className="together-btn disconnect" onClick={() => { 
                together.disconnect(); 
                setJoinCode(''); 
                if (ytPlayer.current && typeof ytPlayer.current.pauseVideo === 'function') {
                  ytPlayer.current.pauseVideo();
                }
              }}>
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Player matched exactly to index.html structure */}
      <div id="player">
        <div className="player-content">
          {/* Left: Art */}
          <div className="player-art-wrap">
            <img className="player-art" id="album-art" src={thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect fill='%232a1a3e' width='56' height='56' rx='8'/%3E%3Ctext x='28' y='34' text-anchor='middle' fill='%23ffd6e6' font-size='22'%3E♫%3C/text%3E%3C/svg%3E"} alt="Album" />
            <div className={`player-vinyl ${isPlaying ? 'spinning' : ''}`} id="vinyl"></div>
          </div>

          {/* Center: Info + controls */}
          <div className="player-center">
            <div className="player-track" id="track-title">{title}</div>
            
            {/* Prominent Progress Bar */}
            <div className="player-timeline">
              <span className="player-time" id="time-current">{fmtTime(currentTime)}</span>
              <div 
                className="player-progress" 
                id="progress-bar" 
                onClick={(e) => {
                  if (!ytPlayer.current || typeof ytPlayer.current.seekTo !== 'function') return;
                  const r = e.currentTarget.getBoundingClientRect();
                  let pct = (e.clientX - r.left) / r.width;
                  pct = Math.max(0, Math.min(1, pct));
                  const seekTime = duration * pct;
                  ytPlayer.current.seekTo(seekTime, true);
                  if (together.isInRoom && !syncLock.current) {
                    together.broadcastAction({ type: 'seek', currentTime: seekTime });
                  }
                }}
                onTouchMove={(e) => {
                  if (!ytPlayer.current || typeof ytPlayer.current.seekTo !== 'function') return;
                  const r = e.currentTarget.getBoundingClientRect();
                  let pct = (e.touches[0].clientX - r.left) / r.width;
                  pct = Math.max(0, Math.min(1, pct));
                  const seekTime = duration * pct;
                  ytPlayer.current.seekTo(seekTime, true);
                  if (together.isInRoom && !syncLock.current) {
                    together.broadcastAction({ type: 'seek', currentTime: seekTime });
                  }
                }}
              >
                <div className="player-progress-fill" id="progress-fill" style={{ width: `${progressPct}%` }}></div>
                <div className="player-progress-thumb" id="progress-thumb" style={{ left: `${progressPct}%` }}></div>
              </div>
              <span className="player-time" id="time-total">{fmtTime(duration)}</span>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="player-controls">
            <button className="p-btn" id="prev-btn" onClick={prevTrack}>
              <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button className={`p-btn p-play ${isPlaying ? 'playing' : ''}`} id="play-btn" onClick={togglePlay}>
              <svg viewBox="0 0 24 24" id="play-icon">
                {isPlaying ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/> : <path d="M8 5v14l11-7z"/>}
              </svg>
            </button>
            <button className="p-btn" id="next-btn" onClick={nextTrack}>
              <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>
        </div>

        {/* Bottom row: extra actions */}
        <div className="player-actions">
          <button className={`pa-btn ${isShuffle ? 'active flash' : ''}`} id="shuffle-btn" onClick={toggleShuffle}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
            <span>Shuffle</span>
          </button>
          <button className={`pa-btn ${activePanel === 'songlist' ? 'active' : ''}`} id="songlist-btn" onClick={() => togglePanel('songlist')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
            <span>Songs</span>
          </button>
          <button className={`pa-btn ${activePanel === 'lyrics' ? 'active' : ''}`} id="lyrics-btn" onClick={() => togglePanel('lyrics')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            <span>Lyrics</span>
          </button>
          <button className={`pa-btn ${activePanel === 'together' ? 'active' : ''} ${together.isInRoom ? 'together-active' : ''}`} id="together-btn" onClick={() => togglePanel('together')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <span>{together.isInRoom ? 'Synced' : 'Together'}</span>
          </button>
        </div>
      </div>

      {/* Hidden YouTube — ref-based container so DOM is guaranteed to exist */}
      <div id="yt-player-wrapper" style={{ position: 'fixed', top: 0, left: 0, width: '200px', height: '200px', opacity: 0.01, pointerEvents: 'none', zIndex: -99 }}>
        <div id="yt-player"></div>
      </div>

      <div className="footer-credit">made with <span style={{color: '#ff4d4d'}}>❤️</span> by Ayush Singh</div>
    </main>
  );
}
