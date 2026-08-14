// ===== UTILS =====
function el(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }
function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  return Math.floor(s/60) + ':' + String(Math.floor(s%60)).padStart(2, '0');
}
function isMobile() { return window.innerWidth <= 640; }

// ===== STATE =====
let ytPlayer = null;
let currentMode = CONFIG.defaultMode || 'night';
let isRainOn = CONFIG.defaultRain || false;
let currentBgLayer = 'a'; // 'a' or 'b' for crossfading
let playlistItems = [];
let currentIndex = 0;
let isPlaying = false;
let updateTimer = null;
let activePanel = null; // 'songlist', 'lyrics', or null

// ===== INIT =====
function init() {
  // Apply Config Text
  document.title = CONFIG.title + ' — Pyar Bhare Geet';
  qs('meta[name="description"]').content = CONFIG.title + ' सुनो — ' + CONFIG.subtitle;
  qsa('.brand-title').forEach(e => e.innerHTML = CONFIG.title);
  qsa('.brand-sub').forEach(e => e.innerHTML = CONFIG.subtitle);
  el('hero-title').innerHTML = CONFIG.heroTitle;
  qsa('.hero-sub').forEach(e => {
    e.innerHTML = `<span class="hero-line"></span>${CONFIG.heroSub}<span class="hero-line"></span>`;
  });
  el('track-count').innerText = CONFIG.trackLabel;

  // Set initial mode & background
  setMode(currentMode, true);
  if (isRainOn) toggleRain(true);
  
  // Setup Particles
  createPetals();
  setInterval(popHeart, 3000);
  startClock();

  // Load YT API
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  // Setup Event Listeners
  setupEvents();
}

// ===== YOUTUBE API =====
window.onYouTubeIframeAPIReady = function() {
  let pVars = {
    autoplay: 1, controls: 0, disablekb: 1, fs: 0,
    modestbranding: 1, rel: 0, showinfo: 0, iv_load_policy: 3
  };
  
  if (!CONFIG.customSequence || CONFIG.customSequence.length === 0) {
    pVars.listType = 'playlist';
    pVars.list = CONFIG.playlistId;
  }

  ytPlayer = new YT.Player('yt-player', {
    height: '100',
    width: '100',
    playerVars: pVars,
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError
    }
  });
};

function onPlayerReady(event) {
  // Load custom sequence if provided
  if (CONFIG.customSequence && CONFIG.customSequence.length > 0) {
    ytPlayer.loadPlaylist(CONFIG.customSequence);
  }

  // Update UI to show ready state
  el('track-title').innerText = "Ready — Click Play to Start";
  
  // Try to get current video data if available
  let data = ytPlayer.getVideoData();
  if (data && data.title) {
    updateTrackInfo(data.title, data.video_id);
  }

  // Try to start playing (might be blocked by browser autoplay policy)
  event.target.setVolume(50);
  event.target.playVideo();
  
  // Fetch playlist items for the UI
  setTimeout(fetchPlaylist, 1500);
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    el('play-icon').innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    el('play-btn').classList.add('playing');
    el('vinyl').classList.add('spinning');
    
    // Update track info
    let index = ytPlayer.getPlaylistIndex();
    if (index !== currentIndex || !playlistItems.length) {
      currentIndex = index;
      let data = ytPlayer.getVideoData();
      if (data && data.title) {
        updateTrackInfo(data.title, data.video_id);
      }
    }
    
    // Update active state in song list if open
    updateSongListActive();
    
    // Start progress loop
    clearInterval(updateTimer);
    updateTimer = setInterval(updateProgress, 500);
    
  } else {
    isPlaying = false;
    el('play-icon').innerHTML = '<path d="M8 5v14l11-7z"/>';
    el('play-btn').classList.remove('playing');
    el('vinyl').classList.remove('spinning');
    clearInterval(updateTimer);
  }
}

function onPlayerError(e) {
  console.log("YT Error", e.data);
  // Auto-skip unplayable videos
  setTimeout(() => ytPlayer.nextVideo(), 1000);
}

function updateTrackInfo(fullTitle, videoId) {
  // Clean up title (remove common tags)
  let clean = fullTitle.replace(/[\(\[].*?(official|video|lyric|audio).*?[\)\]]/gi, '')
                       .replace(/\|.*/, '')
                       .trim();
  el('track-title').innerText = clean;
  
  // Update album art
  if (videoId) {
    el('album-art').src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }
  
  // Update lyrics if panel is open
  if (activePanel === 'lyrics') {
    fetchLyrics(clean);
  } else {
    el('lyrics-body').innerHTML = `<p class="panel-placeholder">Loading lyrics for "${clean}"…</p>`;
  }
}

function updateProgress() {
  if (!ytPlayer || !isPlaying) return;
  
  let curr = ytPlayer.getCurrentTime();
  let total = ytPlayer.getDuration();
  if (total > 0) {
    el('time-current').innerText = fmtTime(curr);
    el('time-total').innerText = fmtTime(total);
    let pct = (curr / total) * 100;
    el('progress-fill').style.width = pct + '%';
    el('progress-thumb').style.left = pct + '%';
  }
}

function fetchPlaylist() {
  let pl = ytPlayer.getPlaylist(); // array of video IDs
  if (!pl || !pl.length) return;
  
  if (playlistItems.length !== pl.length) {
    playlistItems = pl.map((id, i) => ({ id, title: `Loading track...` }));
    renderSongList();
    
    // Fetch real titles using noembed
    pl.forEach((id, i) => {
      fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.title) {
            let clean = data.title.replace(/[\(\[].*?(official|video|lyric|audio).*?[\)\]]/gi, '').replace(/\|.*/, '').trim();
            playlistItems[i].title = clean;
            if (activePanel === 'songlist') renderSongList();
          }
        })
        .catch(err => console.log('Failed to fetch title for', id));
    });
  }
}

function renderSongList() {
  const container = el('songlist-body');
  if (!playlistItems.length) {
    container.innerHTML = '<p class="panel-placeholder">Playlist is empty</p>';
    return;
  }
  
  let html = '';
  playlistItems.forEach((item, i) => {
    let active = i === currentIndex ? 'playing' : '';
    let icon = i === currentIndex ? '🎵' : (i + 1);
    html += `
      <div class="song-item ${active}" data-index="${i}">
        <div class="song-num">${icon}</div>
        <div class="song-name">${item.title}</div>
      </div>
    `;
  });
  container.innerHTML = html;
  
  // Add click events
  qsa('.song-item').forEach(el => {
    el.addEventListener('click', (e) => {
      let idx = parseInt(e.currentTarget.getAttribute('data-index'));
      ytPlayer.playVideoAt(idx);
      closePanel();
    });
  });
}

function updateSongListActive() {
  // Since we don't have titles upfront, update them as they play
  if (playlistItems.length > currentIndex) {
    let data = ytPlayer.getVideoData();
    if (data && data.title) {
       playlistItems[currentIndex].title = data.title.replace(/[\(\[].*?[\)\]]/g, '').trim();
       renderSongList();
    }
  }
}

function fetchLyrics(songTitle) {
  const container = el('lyrics-body');
  container.innerHTML = `<p class="panel-placeholder">Searching lyrics for<br><strong>${songTitle}</strong>...</p>`;
  
  // Simple artist/song split logic based on common formatting (Artist - Song)
  let artist = "Unknown";
  let title = songTitle;
  if (songTitle.includes('-')) {
    let parts = songTitle.split('-');
    artist = parts[0].trim();
    title = parts[1].trim();
  } else {
    // If no hyphen, we just try to fetch without artist, though lyrics.ovh requires artist.
    // For Hindi songs on YouTube, it's very hard to parse Artist/Title reliably.
    artist = "Arijit Singh"; // fallback guess for romantic hindi songs just for demo purposes
  }

  fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`)
    .then(res => res.json())
    .then(data => {
      if (data.lyrics) {
        container.innerHTML = `<div class="lyrics-text">${data.lyrics.replace(/\n/g, '<br>')}</div>`;
      } else {
        showFallbackLyrics(songTitle);
      }
    })
    .catch(() => showFallbackLyrics(songTitle));
}

function showFallbackLyrics(songTitle) {
  const container = el('lyrics-body');
  container.innerHTML = `
    <p class="panel-placeholder" style="margin-bottom:20px;">
      Couldn't find exact lyrics for<br><strong>${songTitle}</strong>
    </p>
    <p class="lyrics-text" style="opacity:0.6;">
      (Enjoy the music!)<br><br>
      🎵 🎵 🎵<br><br>
      प्यार भरे गीत<br>
      दो दिल, एक रात<br>
      🎵 🎵 🎵
    </p>
  `;
}

// ===== BACKGROUND & MODES =====
function setMode(mode, initial = false) {
  currentMode = mode;
  
  // Update Buttons
  qsa('.mode-btn').forEach(b => {
    if (b.dataset.mode) {
      if (b.dataset.mode === mode) b.classList.add('active');
      else b.classList.remove('active');
    }
  });

  // Pick correct image based on mode and device
  let src = '';
  if (mode === 'day') {
    src = isMobile() ? CONFIG.backgrounds.day.mobile : CONFIG.backgrounds.day.desktop;
    document.body.style.background = '#e6d5c3'; // lighter base for day fallback
  } else {
    src = isMobile() ? CONFIG.backgrounds.night.mobile : CONFIG.backgrounds.night.desktop;
    document.body.style.background = '#070412';
  }

  // Handle crossfade
  let nextLayer = currentBgLayer === 'a' ? 'b' : 'a';
  let nextEl = el('bg-layer-' + nextLayer);
  let currEl = el('bg-layer-' + currentBgLayer);

  nextEl.style.backgroundImage = `url("${src}")`;
  
  if (initial) {
    nextEl.classList.add('visible');
    currentBgLayer = nextLayer;
  } else {
    // wait for image to load to avoid flashing
    let img = new Image();
    img.src = src;
    img.onload = () => {
      nextEl.classList.add('visible');
      currEl.classList.remove('visible');
      currentBgLayer = nextLayer;
    };
  }

  // Adjust SVGs
  // (Removed since we use full background images now)
}

function toggleRain(force = null) {
  isRainOn = force !== null ? force : !isRainOn;
  
  const btn = el('rain-btn');
  const layer = el('rain');
  
  if (isRainOn) {
    btn.classList.add('active');
    layer.classList.add('active');
    if (!layer.innerHTML) createRain();
  } else {
    btn.classList.remove('active');
    layer.classList.remove('active');
  }
}

// ===== PANELS =====
function togglePanel(panelName) {
  if (activePanel === panelName) {
    closePanel();
  } else {
    if (activePanel) closePanel();
    
    setTimeout(() => {
      activePanel = panelName;
      el(panelName + '-panel').classList.add('open');
      if (panelName === 'lyrics') {
        el('lyrics-btn').classList.add('active');
        fetchLyrics(el('track-title').innerText);
      } else if (panelName === 'songlist') {
        el('songlist-btn').classList.add('active');
        renderSongList(); // ensure active state is correct
      }
    }, activePanel ? 400 : 0); // delay if another was open
  }
}

function closePanel() {
  if (!activePanel) return;
  el(activePanel + '-panel').classList.remove('open');
  el('lyrics-btn').classList.remove('active');
  el('songlist-btn').classList.remove('active');
  activePanel = null;
}

// ===== EVENTS =====
function setupEvents() {
  // Player Controls
  el('play-btn').onclick = () => {
    if (!ytPlayer) return;
    if (isPlaying) ytPlayer.pauseVideo();
    else ytPlayer.playVideo();
  };
  
  el('prev-btn').onclick = () => ytPlayer && ytPlayer.previousVideo();
  el('next-btn').onclick = () => ytPlayer && ytPlayer.nextVideo();
  
  el('shuffle-btn').onclick = () => {
    if (!ytPlayer) return;
    ytPlayer.setShuffle(true);
    ytPlayer.nextVideo(); // play a random one
    
    let btn = el('shuffle-btn');
    btn.classList.add('flash');
    setTimeout(() => btn.classList.remove('flash'), 300);
  };
  
  // Progress Bar click
  el('progress-bar').onclick = (e) => {
    if (!ytPlayer || !isPlaying) return;
    let rect = e.currentTarget.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let pct = x / rect.width;
    let total = ytPlayer.getDuration();
    if (total) {
      ytPlayer.seekTo(total * pct, true);
    }
  };

  // Modes
  el('day-btn').onclick = () => setMode('day');
  el('night-btn').onclick = () => setMode('night');
  el('rain-btn').onclick = () => toggleRain();
  
  // Panels
  el('songlist-btn').onclick = () => togglePanel('songlist');
  el('songlist-close').onclick = () => closePanel();
  
  el('lyrics-btn').onclick = () => togglePanel('lyrics');
  el('lyrics-close').onclick = () => closePanel();
  
  // Resize
  window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
      setMode(currentMode); // re-trigger to grab correct mobile/desktop img
    }, 200);
  });
  
  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch(e.code) {
      case 'Space': 
        e.preventDefault(); 
        if(isPlaying) ytPlayer.pauseVideo(); else ytPlayer.playVideo(); 
        break;
      case 'KeyN': ytPlayer.nextVideo(); break;
      case 'KeyP': ytPlayer.previousVideo(); break;
      case 'KeyR': toggleRain(); break;
      case 'KeyD': setMode(currentMode === 'day' ? 'night' : 'day'); break;
    }
  });
}

// ===== EFFECTS (Particles & Rain) =====
function createRain() {
  const layer = el('rain');
  let html = '';
  let count = CONFIG.rainDropCount || 100;
  for (let i = 0; i < count; i++) {
    let left = Math.random() * 100;
    let dur = 0.5 + Math.random() * 0.5;
    let del = Math.random() * 2;
    let ht = 10 + Math.random() * 20;
    let op = 0.2 + Math.random() * 0.4;
    html += `<div class="rain-drop" style="left:${left}%; height:${ht}px; background:#ffffff; opacity:${op}; animation: rain-fall ${dur}s linear ${del}s infinite"></div>`;
  }
  layer.innerHTML = html;
}

function createPetals() {
  const layer = el('particles');
  let count = CONFIG.petalCount || 20;
  for (let i = 0; i < count; i++) {
    let p = document.createElement('div');
    p.className = 'petal';
    let size = 6 + Math.random() * 8;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.background = Math.random() > 0.5 ? '#ffd6e6' : '#ffa6c9';
    p.style.left = (Math.random() * 100) + '%';
    
    let dur = 8 + Math.random() * 12;
    let del = -(Math.random() * 15);
    let drift = (Math.random() - 0.5) * 200 + 'px';
    p.style.setProperty('--drift', drift);
    p.style.animation = `petal-fall ${dur}s ease-in-out ${del}s infinite`;
    layer.appendChild(p);
  }
}

function popHeart() {
  if (!isPlaying) return;
  const layer = el('hearts');
  let count = layer.childElementCount;
  if (count > (CONFIG.heartCount || 10)) return; // limit
  
  let h = document.createElement('div');
  h.className = 'floating-heart';
  h.innerText = Math.random() > 0.5 ? '💖' : '✨';
  h.style.left = (40 + Math.random() * 20) + '%';
  h.style.bottom = '140px';
  h.style.fontSize = (12 + Math.random() * 10) + 'px';
  h.style.animation = `float-heart ${2 + Math.random()*2}s ease-in forwards`;
  
  layer.appendChild(h);
  setTimeout(() => { if (h.parentNode) h.parentNode.removeChild(h); }, 4000);
}

// ===== CLOCK =====
function startClock() {
  const cd = el('clock');
  const tick = () => {
    let d = new Date();
    cd.innerText = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  };
  tick();
  setInterval(tick, 30000);
}

// Start
init();
