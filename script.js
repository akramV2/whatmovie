const API_KEY = '61cce23d544a028a9ee01690d3455337';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Éléments du DOM
const movieCard = document.getElementById('movie-card');
const posterImg = document.getElementById('movie-poster');
const movieTitle = document.getElementById('movie-title');
const movieSynopsis = document.getElementById('movie-synopsis');
const movieGenres = document.getElementById('movie-genres');
const movieProviders = document.getElementById('movie-providers');
const movieRating = document.getElementById('movie-rating');
const movieDirector = document.getElementById('movie-director');
const movieCast = document.getElementById('movie-cast');
const dynamicBg = document.getElementById('dynamic-bg');
const spinner = document.getElementById('spinner');

const genreSelect = document.getElementById('genre-select');
const eraSelect = document.getElementById('era-select');
const durationSelect = document.getElementById('duration-select');
const providerSelect = document.getElementById('provider-select');
const proposeBtn = document.getElementById('propose-btn');
const nextBtn = document.getElementById('next-btn');

const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchDropdown = document.getElementById('search-results-dropdown');

const favBtn = document.getElementById('fav-btn');
const favoritesGrid = document.getElementById('favorites-grid');
const favCountTitle = document.getElementById('fav-count-title');

const themeToggle = document.getElementById('theme-toggle');
const settingsBtn = document.getElementById('settings-btn');
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modal-close');
const modalContainer = document.getElementById('modal-content-container');
const posterContainer = document.getElementById('poster-container');
const trailerBtn = document.getElementById('trailer-btn');

// Boutons profil & sauvegarde
const exportJsonBtn = document.getElementById('export-json-btn');
const importJsonBtn = document.getElementById('import-json-btn');
const importFileInput = document.getElementById('import-file-input');
const generateProfileCardBtn = document.getElementById('generate-profile-card-btn');
const openSettingsFromProfileBtn = document.getElementById('open-settings-from-profile-btn');
const logoutBtn = document.getElementById('logout-btn');

// État de l'application
let currentMovie = null;
let favorites = JSON.parse(localStorage.getItem('whatmovie_favs')) || [];
let watchedMovies = JSON.parse(localStorage.getItem('whatmovie_watched')) || [];
let selectedProviders = [];
let seenMovies = new Set();
let searchDebounceTimer = null;

// Espace Admin — seul ce compte (identifié par son e-mail, insensible à la casse)
// débloque l'onglet, quel que soit l'appareil utilisé pour se connecter.
const ADMIN_EMAIL = 'breyneraphael02@gmail.com';
const adminNavBtn = document.getElementById('admin-nav-btn');
const adminRefreshBtn = document.getElementById('admin-refresh-btn');

// État d'authentification et Profil
// isLoggedIn / userProfile ne représentent plus une simple préférence locale :
// ils reflètent une vraie session Supabase Auth (compte email + mot de passe).
// Par défaut on démarre "non connecté" tant que la session n'a pas été vérifiée
// auprès de Supabase (voir initAuth()) — l'app reste utilisable en mode invité
// (favoris/vus stockés localement) tant qu'aucun compte n'est connecté.
let isLoggedIn = false;
let currentUserId = null; // id Supabase (auth.users.id) du compte connecté
let userProfile = JSON.parse(localStorage.getItem('whatmovie_user_profile')) || {
  pseudo: 'Cinéphile',
  email: '',
  avatar: '',
  top4: [null, null, null, null]
};
// Le mode d'affichage de la modale de connexion : 'login' ou 'signup'
let authModalMode = 'login';

// État du Quiz
let quizScore = 0;
let quizQuestionsCount = 0;
let currentQuizMovie = null;

// Badges & Succès
const badges = [
  { 
    id: 'first_step', 
    title: 'Premier Pas', 
    icon: 'fa-film', 
    desc: 'Regarder 1 film',
    condition: (watched, favs) => watched.length >= 1 
  },
  { 
    id: 'movie_buff', 
    title: 'Cinéphile Assidu', 
    icon: 'fa-clapperboard', 
    desc: 'Regarder 10 films',
    condition: (watched, favs) => watched.length >= 10 
  },
  { 
    id: 'marathon', 
    title: 'Marathonien', 
    icon: 'fa-stopwatch', 
    desc: 'Cumuler 20h de visionnage',
    condition: (watched, favs) => {
      const totalMinutes = watched.reduce((acc, m) => acc + (m.runtime || 0), 0);
      return totalMinutes >= 1200;
    } 
  },
  { 
    id: 'classic', 
    title: 'Cinéphile Classique', 
    icon: 'fa-building-columns', 
    desc: "Regarder 5 films d'avant 2000",
    condition: (watched, favs) => {
      const classics = watched.filter(m => m.release_date && parseInt(m.release_date.split('-')[0]) < 2000);
      return classics.length >= 5;
    }
  },
  { 
    id: 'explorer', 
    title: 'Explorateur', 
    icon: 'fa-globe', 
    desc: 'Découvrir 5 genres différents',
    condition: (watched, favs) => {
      const genresSet = new Set();
      watched.forEach(m => (m.genres || []).forEach(g => genresSet.add(g.name || g)));
      return genresSet.size >= 5;
    }
  },
  { 
    id: 'collector', 
    title: 'Collectionneur', 
    icon: 'fa-star', 
    desc: 'Enregistrer 10 favoris',
    condition: (watched, favs) => favs.length >= 10 
  }
];

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('fade-out');
    }, 1800);
  }

  initTheme();
  fetchGenres();
  renderFavorites();
  updateStats();
  checkBadges();
  setupKeyboardShortcuts();
  setupProviderButtons();
  setupExportImport();
  setupQuizListeners();
  setupSettingsAndAuth();
  setupAdminPanel();
  initAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const movieId = urlParams.get('id');
  if (movieId) {
    fetchMovieDetails(movieId);
  } else {
    loadRandomMovie();
  }
});

// 1. Thème et LocalStorage
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    if (themeToggle) themeToggle.textContent = 'Mode Sombre';
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (themeToggle) themeToggle.textContent = 'Mode Clair';
  }
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      themeToggle.textContent = 'Mode Clair';
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      themeToggle.textContent = 'Mode Sombre';
      localStorage.setItem('theme', 'light');
    }
  });
}

// 2. Raccourcis Clavier
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.code === 'Space' || e.code === 'ArrowRight') {
      e.preventDefault();
      triggerSwipeNext();
    }
  });
}

// 3. Notifications Toast
function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

// 4. Charger les Genres
async function fetchGenres() {
  try {
    const res = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=fr-FR`);
    const data = await res.json();
    if (genreSelect && data.genres) {
      data.genres.forEach(g => {
        const option = document.createElement('option');
        option.value = g.id;
        option.textContent = g.name;
        genreSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Erreur genres:', err);
  }
}

// 5. Gestion des Boutons Filtres Streaming
function setupProviderButtons() {
  const pBtns = document.querySelectorAll('.provider-btn');
  pBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pId = btn.getAttribute('data-provider');
      if (selectedProviders.includes(pId)) {
        selectedProviders = selectedProviders.filter(id => id !== pId);
        btn.classList.remove('active');
      } else {
        selectedProviders.push(pId);
        btn.classList.add('active');
      }
      loadRandomMovie();
    });
  });
}

// 6. Charger un Film Aléatoire avec Filtres
async function loadRandomMovie() {
  if (spinner) spinner.style.display = 'block';
  
  try {
    const genre = genreSelect ? genreSelect.value : '';
    const era = eraSelect ? eraSelect.value : '';
    const duration = durationSelect ? durationSelect.value : '';

    let url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=fr-FR&sort_by=popularity.desc&include_adult=false&page=${Math.floor(Math.random() * 5) + 1}`;

    if (genre) url += `&with_genres=${genre}`;
    
    const activeProviders = selectedProviders.length > 0 ? selectedProviders.join('|') : (providerSelect ? providerSelect.value : '');
    if (activeProviders) {
      url += `&with_watch_providers=${activeProviders}&watch_region=FR`;
    }

    if (era) {
      const [start, end] = era.split('-');
      if (start && end) {
        url += `&primary_release_date.gte=${start}-01-01&primary_release_date.lte=${end}-12-31`;
      }
    }

    if (duration === 'short') {
      url += `&with_runtime.lte=90`;
    } else if (duration === 'medium') {
      url += `&with_runtime.gte=90&with_runtime.lte=120`;
    } else if (duration === 'long') {
      url += `&with_runtime.gte=120`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const unseen = data.results.filter(m => !seenMovies.has(m.id));
      const pool = unseen.length > 0 ? unseen : data.results;
      const movie = pool[Math.floor(Math.random() * pool.length)];
      
      seenMovies.add(movie.id);
      await fetchMovieDetails(movie.id);
    } else {
      showToast("Aucun film trouvé avec ces filtres.");
    }
  } catch (err) {
    showToast("Erreur lors de la récupération des films.");
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

// 7. Recherche Dynamique
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchDebounceTimer);

    if (query.length < 2) {
      if (searchDropdown) {
        searchDropdown.classList.remove('active');
        searchDropdown.innerHTML = '';
      }
      return;
    }

    searchDebounceTimer = setTimeout(() => {
      fetchSearchSuggestions(query);
    }, 400);
  });
}

async function fetchSearchSuggestions(query) {
  if (!searchDropdown) return;
  try {
    const res = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}&page=1`);
    const data = await res.json();

    searchDropdown.innerHTML = '';

    if (data.results && data.results.length > 0) {
      data.results.slice(0, 6).forEach(movie => {
        const item = document.createElement('div');
        item.className = 'search-item';
        
        const poster = movie.poster_path 
          ? `${IMAGE_BASE_URL}${movie.poster_path}` 
          : 'https://via.placeholder.com/36x52?text=?';
          
        const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';

        item.innerHTML = `
          <img src="${poster}" alt="${movie.title}">
          <div class="search-item-info">
            <span class="search-item-title">${movie.title}</span>
            <span class="search-item-date">${releaseYear}</span>
          </div>
        `;

        item.addEventListener('click', () => {
          seenMovies.add(movie.id);
          fetchMovieDetails(movie.id);
          searchDropdown.classList.remove('active');
          if (searchInput) searchInput.value = '';
        });

        searchDropdown.appendChild(item);
      });
      searchDropdown.classList.add('active');
    } else {
      searchDropdown.innerHTML = '<div class="search-no-result" style="padding:10px; font-size:0.8rem; color:var(--text-secondary);">Aucun film trouvé</div>';
      searchDropdown.classList.add('active');
    }
  } catch (err) {
    console.error('Erreur recherche dynamique:', err);
  }
}

document.addEventListener('click', (e) => {
  if (searchDropdown && !e.target.closest('.search-input-wrapper')) {
    searchDropdown.classList.remove('active');
  }
});

// 8. Récupération & Affichage d'un Film
async function fetchMovieDetails(movieId) {
  try {
    const [detailsRes, creditsRes, providersRes, videosRes] = await Promise.all([
      fetch(`${BASE_URL}/movie/${movieId}?api_key=${API_KEY}&language=fr-FR`),
      fetch(`${BASE_URL}/movie/${movieId}/credits?api_key=${API_KEY}&language=fr-FR`),
      fetch(`${BASE_URL}/movie/${movieId}/watch/providers?api_key=${API_KEY}`),
      fetch(`${BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}&language=fr-FR`)
    ]);

    const movie = await detailsRes.json();
    const credits = await creditsRes.json();
    const providers = await providersRes.json();
    const videos = await videosRes.json();

    currentMovie = { ...movie, credits, providers: providers.results?.FR, videos: videos.results };
    displayMovie(currentMovie);
  } catch (err) {
    console.error('Erreur détails film:', err);
  }
}

function displayMovie(m) {
  if (!movieCard) return;
  movieCard.classList.remove('swipe-out');
  movieCard.classList.remove('fade-in');
  void movieCard.offsetWidth;
  movieCard.classList.add('fade-in');

  if (movieTitle) movieTitle.textContent = m.title;
  if (movieSynopsis) movieSynopsis.textContent = m.overview || "Aucun synopsis disponible.";
  if (movieRating) movieRating.textContent = `${m.vote_average ? m.vote_average.toFixed(1) : 'N/A'} / 10`;

  if (posterImg) {
    if (m.poster_path) {
      posterImg.src = `${IMAGE_BASE_URL}${m.poster_path}`;
      if (dynamicBg) dynamicBg.style.backgroundImage = `url(${IMAGE_BASE_URL}${m.poster_path})`;
    } else {
      posterImg.src = 'https://via.placeholder.com/300x450?text=Pas+d%27image';
    }
  }

  if (movieGenres) {
    movieGenres.innerHTML = '';
    if (m.genres) {
      m.genres.forEach(g => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = g.name;
        movieGenres.appendChild(span);
      });
    }

    if (m.runtime) {
      const spanRuntime = document.createElement('span');
      spanRuntime.className = 'tag';
      spanRuntime.textContent = `${m.runtime} min`;
      movieGenres.appendChild(spanRuntime);
    }
  }

  const director = m.credits?.crew?.find(c => c.job === 'Director');
  if (movieDirector) movieDirector.textContent = director ? `Réalisé par : ${director.name}` : '';

  if (movieCast) {
    movieCast.innerHTML = '';
    if (m.credits?.cast) {
      m.credits.cast.slice(0, 5).forEach(actor => {
        const item = document.createElement('div');
        item.className = 'cast-item';
        const photo = actor.profile_path ? `${IMAGE_BASE_URL}${actor.profile_path}` : 'https://via.placeholder.com/45';
        item.innerHTML = `
          <img src="${photo}" alt="${actor.name}" class="cast-avatar">
          <span class="cast-name">${actor.name}</span>
        `;
        movieCast.appendChild(item);
      });
    }
  }

  if (movieProviders) {
    movieProviders.innerHTML = '';
    const flatrate = m.providers?.flatrate;
    if (flatrate && flatrate.length > 0) {
      flatrate.forEach(p => {
        const link = document.createElement('a');
        link.href = `https://www.google.com/search?q=${encodeURIComponent(m.title + ' streaming ' + p.provider_name)}`;
        link.target = '_blank';
        link.title = `Regarder sur ${p.provider_name}`;

        const img = document.createElement('img');
        img.src = `${IMAGE_BASE_URL}${p.logo_path}`;
        img.alt = p.provider_name;
        img.className = 'provider-logo';

        link.appendChild(img);
        movieProviders.appendChild(link);
      });
    } else {
      movieProviders.textContent = 'Non disponible en streaming FR';
    }
  }

  updateFavButtonState();
}

function triggerSwipeNext() {
  if (currentMovie) {
    markAsWatched(currentMovie);
  }
  if (movieCard) movieCard.classList.add('swipe-out');
  setTimeout(() => {
    loadRandomMovie();
  }, 300);
}

// 9. Favoris
function toggleFavorite() {
  if (!currentMovie) return;
  const index = favorites.findIndex(f => f.id === currentMovie.id);
  if (index >= 0) {
    favorites.splice(index, 1);
    showToast("Retiré des favoris.");
  } else {
    favorites.push({
      id: currentMovie.id,
      title: currentMovie.title,
      poster_path: currentMovie.poster_path
    });
    showToast("Ajouté aux favoris.");
  }
  pushProfileUpdate({ favorites });
  updateFavButtonState();
  renderFavorites();
  checkBadges();
}

function updateFavButtonState() {
  if (!currentMovie || !favBtn) return;
  const isFav = favorites.some(f => f.id === currentMovie.id);
  favBtn.innerHTML = isFav 
    ? '<i class="fa-solid fa-heart" style="color: #ef4444;"></i> Dans vos favoris' 
    : '<i class="fa-regular fa-heart"></i> Ajouter aux favoris';
}

function renderFavorites() {
  if (!favoritesGrid) return;
  favoritesGrid.innerHTML = '';
  if (favCountTitle) favCountTitle.textContent = `Mes Favoris (${favorites.length})`;

  if (favorites.length === 0) {
    favoritesGrid.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1;">Aucun film enregistré pour le moment.</p>';
    return;
  }

  favorites.forEach(f => {
    const card = document.createElement('div');
    card.className = 'fav-card';
    card.innerHTML = `
      <img src="${f.poster_path ? IMAGE_BASE_URL + f.poster_path : 'https://via.placeholder.com/150'}" alt="${f.title}">
      <p>${f.title}</p>
      <button title="Supprimer">&times;</button>
    `;

    card.querySelector('img').addEventListener('click', () => {
      fetchMovieDetails(f.id);
      switchTab('tab-discover');
    });
    card.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      favorites = favorites.filter(fav => fav.id !== f.id);
      pushProfileUpdate({ favorites });
      renderFavorites();
      updateFavButtonState();
      checkBadges();
      showToast("Favori supprimé.");
    });

    favoritesGrid.appendChild(card);
  });
}

// 10. Historique & Stats
function markAsWatched(m) {
  if (!watchedMovies.some(w => w.id === m.id)) {
    watchedMovies.push({
      id: m.id,
      title: m.title,
      poster_path: m.poster_path,
      runtime: m.runtime || 110,
      genres: m.genres || [],
      release_date: m.release_date || ''
    });
    pushProfileUpdate({ watched: watchedMovies });
    updateStats();
    checkBadges();
  }
}

function updateStats() {
  const countElem = document.getElementById('stat-count');
  if (countElem) countElem.textContent = watchedMovies.length;

  const totalMinutes = watchedMovies.reduce((acc, m) => acc + (m.runtime || 0), 0);
  const hours = Math.floor(totalMinutes / 60);
  const timeElem = document.getElementById('stat-time');
  if (timeElem) timeElem.textContent = `${hours}h`;

  const genreCounts = {};
  watchedMovies.forEach(m => {
    (m.genres || []).forEach(g => {
      const name = g.name || g;
      genreCounts[name] = (genreCounts[name] || 0) + 1;
    });
  });

  const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxCount = sortedGenres[0] ? sortedGenres[0][1] : 1;
  const genreContainer = document.getElementById('genre-stats');

  if (genreContainer) {
    genreContainer.innerHTML = sortedGenres.map(([genre, count]) => {
      const percent = Math.round((count / maxCount) * 100);
      return `
        <div class="genre-bar-item">
          <span class="genre-name">${genre}</span>
          <div class="genre-bar-bg">
            <div class="genre-bar-fill" style="width: ${percent}%;"></div>
          </div>
          <span>${count}</span>
        </div>
      `;
    }).join('');
  }

  const historyGrid = document.getElementById('history-grid');
  if (historyGrid) {
    historyGrid.innerHTML = watchedMovies.map(m => `
      <div class="fav-card" onclick="fetchMovieDetails(${m.id}); switchTab('tab-discover');">
        <img src="${m.poster_path ? IMAGE_BASE_URL + m.poster_path : 'https://via.placeholder.com/150'}" alt="${m.title}">
        <p>${m.title}</p>
      </div>
    `).join('');
  }
}

// 11. GESTION DES PARAMÈTRES VIA L'ENGRENAGE ET AUTHENTIFICATION
function setupSettingsAndAuth() {
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettingsModal);
  }

  if (openSettingsFromProfileBtn) {
    openSettingsFromProfileBtn.addEventListener('click', openSettingsModal);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  if (generateProfileCardBtn) {
    generateProfileCardBtn.addEventListener('click', generateProfileCard);
  }
}

function openSettingsModal() {
  if (!modal || !modalContainer) return;
  authModalMode = 'login';
  if (!isLoggedIn) {
    renderLoginModalContent();
  } else {
    renderEditProfileModalContent();
  }
  modal.style.display = 'flex';
}

// ------------------------------------------------------------------
// AUTHENTIFICATION RÉELLE (Supabase Auth) — comptes uniques par e-mail,
// pseudo unique, données personnelles synchronisées sur le serveur.
// Cela permet notamment de retrouver son compte admin depuis n'importe
// quel appareil (téléphone, PC…) puisque l'accès admin est basé sur
// l'e-mail du compte connecté et non plus sur une valeur stockée
// localement dans le navigateur.
// ------------------------------------------------------------------

// Vérifie au chargement si une session Supabase existe déjà (par ex. si
// l'utilisateur s'est déjà connecté sur cet appareil) et charge son profil.
async function initAuth() {
  if (typeof supabaseClient === 'undefined') {
    loadUserProfile();
    logVisite();
    return;
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
      await applySessionAndLoadProfile(session);
    } else {
      isLoggedIn = false;
      currentUserId = null;
    }
  } catch (err) {
    console.warn('Impossible de vérifier la session existante :', err);
  }

  loadUserProfile();
  renderFavorites();
  updateStats();
  checkBadges();
  logVisite();

  // Garde l'app synchronisée si la session change dans un autre onglet.
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      isLoggedIn = false;
      currentUserId = null;
      loadUserProfile();
    }
  });
}

// À partir d'une session valide, récupère (ou crée si absente) la ligne
// "profiles" de l'utilisateur et remplit l'état de l'app avec ses données.
async function applySessionAndLoadProfile(session) {
  currentUserId = session.user.id;
  isLoggedIn = true;

  try {
    const { data: profileRow, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', currentUserId)
      .maybeSingle();

    if (error) throw error;

    if (profileRow) {
      userProfile = {
        pseudo: profileRow.pseudo || session.user.email.split('@')[0],
        email: profileRow.email || session.user.email,
        avatar: profileRow.avatar || '',
        top4: Array.isArray(profileRow.top4) && profileRow.top4.length === 4 ? profileRow.top4 : [null, null, null, null]
      };
      favorites = Array.isArray(profileRow.favorites) ? profileRow.favorites : [];
      watchedMovies = Array.isArray(profileRow.watched) ? profileRow.watched : [];
    } else {
      // Session valide mais pas encore de ligne de profil (cas rare) : on la crée.
      userProfile = {
        pseudo: session.user.email.split('@')[0],
        email: session.user.email,
        avatar: '',
        top4: [null, null, null, null]
      };
      favorites = [];
      watchedMovies = [];
      await supabaseClient.from('profiles').insert([{
        id: currentUserId,
        pseudo: userProfile.pseudo,
        email: userProfile.email,
        top4: userProfile.top4,
        favorites: [],
        watched: []
      }]);
    }

    persistLocalCache();
  } catch (err) {
    console.warn('Impossible de charger le profil distant :', err);
  }
}

// Sauvegarde locale (cache hors-ligne) de l'état courant.
function persistLocalCache() {
  localStorage.setItem('whatmovie_user_profile', JSON.stringify(userProfile));
  localStorage.setItem('whatmovie_favs', JSON.stringify(favorites));
  localStorage.setItem('whatmovie_watched', JSON.stringify(watchedMovies));
}

// Répercute une mise à jour partielle du profil vers Supabase, uniquement
// si un compte est réellement connecté. Échoue silencieusement hors-ligne.
async function pushProfileUpdate(partialFields) {
  persistLocalCache();
  if (!isLoggedIn || !currentUserId || typeof supabaseClient === 'undefined') return;
  try {
    const { error } = await supabaseClient.from('profiles').update(partialFields).eq('id', currentUserId);
    if (error) throw error;
  } catch (err) {
    console.warn('Synchronisation du profil impossible (hors-ligne ?) :', err);
  }
}

// Vérifie si un pseudo est déjà pris par un autre compte (insensible à la casse).
// excludeUserId permet d'ignorer le compte courant lors d'une modification.
// Passe par la vue publique "pseudos_publics" (id + pseudo uniquement) car les
// policies RLS de la table "profiles" empêchent de lire les profils des autres.
async function isPseudoTaken(pseudoClean, excludeUserId = null) {
  if (typeof supabaseClient === 'undefined') return false;
  try {
    const { data, error } = await supabaseClient
      .from('pseudos_publics')
      .select('id, pseudo')
      .ilike('pseudo', pseudoClean);
    if (error) throw error;
    if (!data) return false;
    return data.some(row => row.id !== excludeUserId);
  } catch (err) {
    console.warn('Vérification du pseudo impossible :', err);
    return false;
  }
}

function renderEditProfileModalContent() {
  modalContainer.innerHTML = `
    <div class="modal-profile-form">
      <h2><i class="fa-solid fa-gear"></i> Paramètres du Compte</h2>
      <p style="font-size:0.85rem; color:var(--text-secondary); text-align:center; margin-bottom:12px;">Modifiez vos informations personnelles ci-dessous.</p>
      
      <div class="modal-avatar-preview-wrapper">
        <img id="modal-avatar-preview" src="${userProfile.avatar || 'https://via.placeholder.com/100?text=Avatar'}" alt="Avatar">
        <label for="modal-pic-input" class="avatar-upload-btn" title="Changer l'image">
          <i class="fa-solid fa-camera"></i>
        </label>
        <input type="file" id="modal-pic-input" accept="image/jpeg, image/png, image/jpg" style="display:none;">
      </div>

      <div class="form-group">
        <label><i class="fa-solid fa-user"></i> Pseudo :</label>
        <input type="text" id="modal-pseudo" value="${userProfile.pseudo || ''}">
      </div>

      <div class="form-group">
        <label><i class="fa-solid fa-envelope"></i> Adresse e-mail :</label>
        <input type="email" id="modal-email" value="${userProfile.email || ''}">
      </div>

      <div class="form-group">
        <label><i class="fa-solid fa-lock"></i> Nouveau mot de passe :</label>
        <input type="password" id="modal-password" placeholder="Laisser vide pour ne pas changer">
      </div>
      <p id="modal-profile-error" class="auth-error" style="display:none;"></p>

      <button class="btn-primary" id="save-modal-profile-btn" style="margin-top:10px; justify-content:center;">
        <i class="fa-solid fa-floppy-disk"></i> Enregistrer les modifications
      </button>

      <button class="btn-danger" id="modal-logout-btn" style="margin-top:6px; justify-content:center;">
        <i class="fa-solid fa-right-from-bracket"></i> Se déconnecter
      </button>
    </div>
  `;

  const picInput = document.getElementById('modal-pic-input');
  if (picInput) {
    picInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast("Veuillez choisir un fichier image (.jpg/.png).");
        return;
      }
      const reader = new FileReader();
      reader.onload = function(event) {
        userProfile.avatar = event.target.result;
        const prevImg = document.getElementById('modal-avatar-preview');
        if (prevImg) prevImg.src = userProfile.avatar;
        pushProfileUpdate({ avatar: userProfile.avatar });
      };
      reader.readAsDataURL(file);
    });
  }

  const saveBtn = document.getElementById('save-modal-profile-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const errorEl = document.getElementById('modal-profile-error');
      const showError = (msg) => { if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; } };
      if (errorEl) errorEl.style.display = 'none';

      const newPseudo = (document.getElementById('modal-pseudo').value || '').trim();
      const newEmail = (document.getElementById('modal-email').value || '').trim();
      const newPassword = (document.getElementById('modal-password').value || '').trim();

      if (!newPseudo || !newEmail) {
        showError("Le pseudo et l'e-mail sont obligatoires.");
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...';

      try {
        // Pseudo unique : on ne vérifie que s'il a changé.
        if (newPseudo.toLowerCase() !== (userProfile.pseudo || '').toLowerCase()) {
          const taken = await isPseudoTaken(newPseudo.toLowerCase(), currentUserId);
          if (taken) {
            showError("Ce pseudo est déjà pris par un autre compte.");
            return;
          }
        }

        // Changement d'e-mail / mot de passe géré par Supabase Auth.
        const authUpdates = {};
        if (newEmail.toLowerCase() !== (userProfile.email || '').toLowerCase()) authUpdates.email = newEmail;
        if (newPassword) authUpdates.password = newPassword;

        if (Object.keys(authUpdates).length > 0 && typeof supabaseClient !== 'undefined') {
          const { error: authError } = await supabaseClient.auth.updateUser(authUpdates);
          if (authError) {
            showError(authError.message || "Impossible de mettre à jour l'e-mail/le mot de passe.");
            return;
          }
        }

        userProfile.pseudo = newPseudo;
        userProfile.email = newEmail;

        await pushProfileUpdate({ pseudo: newPseudo, email: newEmail, avatar: userProfile.avatar });
        loadUserProfile();
        closeModal();
        if (authUpdates.email) {
          showToast("Informations mises à jour. Vérifiez votre boîte mail pour confirmer le nouvel e-mail.");
        } else {
          showToast("Informations personnelles mises à jour !");
        }
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Enregistrer les modifications';
      }
    });
  }

  const modalLogoutBtn = document.getElementById('modal-logout-btn');
  if (modalLogoutBtn) {
    modalLogoutBtn.addEventListener('click', () => {
      closeModal();
      handleLogout();
    });
  }
}

// Modale de connexion / création de compte (deux vues, un seul conteneur).
function renderLoginModalContent() {
  if (authModalMode === 'signup') {
    renderSignupModalContent();
    return;
  }

  modalContainer.innerHTML = `
    <div class="modal-profile-form">
      <h2><i class="fa-solid fa-user-lock"></i> Connexion à mon compte</h2>
      <p style="font-size:0.85rem; color:var(--text-secondary); text-align:center; margin-bottom:12px;">Connecte-toi pour retrouver ton profil, tes favoris et tes films vus sur n'importe quel appareil.</p>

      <div class="form-group">
        <label><i class="fa-solid fa-envelope"></i> Adresse e-mail :</label>
        <input type="email" id="login-email" placeholder="votre.email@exemple.com">
      </div>

      <div class="form-group">
        <label><i class="fa-solid fa-lock"></i> Mot de passe :</label>
        <input type="password" id="login-password" placeholder="Mot de passe">
      </div>
      <p id="login-error" class="auth-error" style="display:none;"></p>

      <button class="btn-primary" id="login-submit-btn" style="margin-top:10px; justify-content:center;">
        <i class="fa-solid fa-right-to-bracket"></i> Se connecter
      </button>

      <button type="button" class="btn-link-auth" id="go-to-signup-btn">
        Pas encore de compte ? <strong>Créer un compte</strong>
      </button>
    </div>
  `;

  const loginBtn = document.getElementById('login-submit-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const errorEl = document.getElementById('login-error');
      const showError = (msg) => { if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; } };
      if (errorEl) errorEl.style.display = 'none';

      const inputEmail = document.getElementById('login-email').value.trim();
      const inputPassword = document.getElementById('login-password').value.trim();

      if (!inputEmail || !inputPassword) {
        showError("Veuillez remplir tous les champs.");
        return;
      }
      if (typeof supabaseClient === 'undefined') {
        showError("Connexion au serveur indisponible pour le moment.");
        return;
      }

      loginBtn.disabled = true;
      loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connexion...';

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: inputEmail,
          password: inputPassword
        });

        if (error) {
          showError(error.message === 'Invalid login credentials'
            ? "E-mail ou mot de passe incorrect."
            : (error.message || "Connexion impossible."));
          return;
        }

        await applySessionAndLoadProfile(data.session);
        loadUserProfile();
        renderFavorites();
        updateStats();
        checkBadges();
        closeModal();
        showToast(`Connecté en tant que ${userProfile.pseudo} !`);
      } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Se connecter';
      }
    });
  }

  const goSignupBtn = document.getElementById('go-to-signup-btn');
  if (goSignupBtn) {
    goSignupBtn.addEventListener('click', () => {
      authModalMode = 'signup';
      renderSignupModalContent();
    });
  }
}

function renderSignupModalContent() {
  modalContainer.innerHTML = `
    <div class="modal-profile-form">
      <h2><i class="fa-solid fa-user-plus"></i> Créer mon compte</h2>
      <p style="font-size:0.85rem; color:var(--text-secondary); text-align:center; margin-bottom:12px;">Chaque compte a un pseudo unique et ses propres données personnelles, sauvegardées et accessibles depuis n'importe quel appareil.</p>

      <div class="form-group">
        <label><i class="fa-solid fa-user"></i> Pseudo (unique) :</label>
        <input type="text" id="signup-pseudo" placeholder="MonPseudo">
      </div>

      <div class="form-group">
        <label><i class="fa-solid fa-envelope"></i> Adresse e-mail :</label>
        <input type="email" id="signup-email" placeholder="votre.email@exemple.com">
      </div>

      <div class="form-group">
        <label><i class="fa-solid fa-lock"></i> Mot de passe :</label>
        <input type="password" id="signup-password" placeholder="6 caractères minimum">
      </div>

      <div class="form-group">
        <label><i class="fa-solid fa-lock"></i> Confirmer le mot de passe :</label>
        <input type="password" id="signup-password-confirm" placeholder="Retapez le mot de passe">
      </div>
      <p id="signup-error" class="auth-error" style="display:none;"></p>

      <button class="btn-primary" id="signup-submit-btn" style="margin-top:10px; justify-content:center;">
        <i class="fa-solid fa-user-plus"></i> Créer mon compte
      </button>

      <button type="button" class="btn-link-auth" id="go-to-login-btn">
        Déjà un compte ? <strong>Se connecter</strong>
      </button>
    </div>
  `;

  const signupBtn = document.getElementById('signup-submit-btn');
  if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
      const errorEl = document.getElementById('signup-error');
      const showError = (msg) => { if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; } };
      if (errorEl) errorEl.style.display = 'none';

      const pseudo = document.getElementById('signup-pseudo').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value.trim();
      const passwordConfirm = document.getElementById('signup-password-confirm').value.trim();

      if (!pseudo || !email || !password || !passwordConfirm) {
        showError("Veuillez remplir tous les champs.");
        return;
      }
      if (pseudo.length < 3) {
        showError("Le pseudo doit contenir au moins 3 caractères.");
        return;
      }
      if (password.length < 6) {
        showError("Le mot de passe doit contenir au moins 6 caractères.");
        return;
      }
      if (password !== passwordConfirm) {
        showError("Les mots de passe ne correspondent pas.");
        return;
      }
      if (typeof supabaseClient === 'undefined') {
        showError("Connexion au serveur indisponible pour le moment.");
        return;
      }

      signupBtn.disabled = true;
      signupBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Création...';

      try {
        const pseudoClean = pseudo.toLowerCase();
        const taken = await isPseudoTaken(pseudoClean);
        if (taken) {
          showError("Ce pseudo est déjà utilisé, choisis-en un autre.");
          return;
        }

        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) {
          showError(error.message || "Impossible de créer le compte.");
          return;
        }

        const newUserId = data.user ? data.user.id : null;
        if (newUserId) {
          const { error: insertError } = await supabaseClient.from('profiles').insert([{
            id: newUserId,
            pseudo: pseudo,
            email: email,
            top4: [null, null, null, null],
            favorites: [],
            watched: []
          }]);
          if (insertError) {
            const msg = insertError.code === '23505'
              ? "Ce pseudo est déjà utilisé, choisis-en un autre."
              : ("Compte créé mais profil non enregistré : " + insertError.message);
            showError(msg);
            return;
          }
        }

        if (data.session) {
          // Confirmation par e-mail désactivée : la session est immédiate.
          await applySessionAndLoadProfile(data.session);
          loadUserProfile();
          renderFavorites();
          updateStats();
          checkBadges();
          closeModal();
          showToast(`Bienvenue ${pseudo} ! Ton compte est créé.`);
        } else {
          // Confirmation par e-mail activée côté Supabase : pas de session tout de suite.
          authModalMode = 'login';
          renderLoginModalContent();
          showToast("Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.");
        }
      } finally {
        signupBtn.disabled = false;
        signupBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Créer mon compte';
      }
    });
  }

  const goLoginBtn = document.getElementById('go-to-login-btn');
  if (goLoginBtn) {
    goLoginBtn.addEventListener('click', () => {
      authModalMode = 'login';
      renderLoginModalContent();
    });
  }
}

async function handleLogout() {
  if (typeof supabaseClient !== 'undefined') {
    try {
      await supabaseClient.auth.signOut();
    } catch (err) {
      console.warn('Erreur lors de la déconnexion :', err);
    }
  }

  isLoggedIn = false;
  currentUserId = null;
  // On repart de zéro localement pour ne pas mélanger les données d'un
  // compte avec celles d'un autre utilisateur sur le même appareil.
  userProfile = { pseudo: 'Cinéphile', email: '', avatar: '', top4: [null, null, null, null] };
  favorites = [];
  watchedMovies = [];
  persistLocalCache();

  loadUserProfile();
  renderFavorites();
  updateStats();
  checkBadges();
  showToast("Vous vous êtes déconnecté.");
}

function loadUserProfile() {
  const displayPseudo = document.getElementById('profile-display-pseudo');
  const displayEmail = document.getElementById('profile-display-email');
  const displayAvatar = document.getElementById('profile-avatar-display');

  if (isLoggedIn) {
    if (displayPseudo) displayPseudo.textContent = userProfile.pseudo || 'Cinéphile';
    if (displayEmail) displayEmail.textContent = userProfile.email || 'utilisateur@whatmovie.fr';
    if (displayAvatar) displayAvatar.src = userProfile.avatar || 'https://via.placeholder.com/120?text=Avatar';
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
  } else {
    if (displayPseudo) displayPseudo.textContent = 'Non connecté';
    if (displayEmail) displayEmail.textContent = 'Connectez-vous via l\'engrenage en haut à gauche pour éditer votre profil.';
    if (displayAvatar) displayAvatar.src = 'https://via.placeholder.com/120?text=Déconnecté';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }

  renderTop4();
  checkAdminAccess();
}

function renderTop4() {
  const top4Grid = document.getElementById('top4-grid');
  if (!top4Grid) return;

  if (!userProfile.top4 || !Array.isArray(userProfile.top4)) {
    userProfile.top4 = [null, null, null, null];
  }

  top4Grid.innerHTML = '';

  for (let i = 0; i < 4; i++) {
    const movie = userProfile.top4[i];
    const slot = document.createElement('div');
    slot.className = `top4-slot ${movie ? 'filled' : ''}`;

    if (movie) {
      slot.innerHTML = `
        <button class="remove-top4-btn" title="Retirer">&times;</button>
        <img src="${movie.poster_path ? IMAGE_BASE_URL + movie.poster_path : 'https://via.placeholder.com/150'}" alt="${movie.title}">
        <div class="top4-title-overlay">${movie.title}</div>
      `;
      slot.querySelector('.remove-top4-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isLoggedIn) {
          showToast("Veuillez vous connecter pour modifier votre Top 4.");
          return;
        }
        userProfile.top4[i] = null;
        pushProfileUpdate({ top4: userProfile.top4 });
        renderTop4();
        showToast("Film retiré du Top 4.");
      });
    } else {
      slot.innerHTML = `
        <div class="slot-placeholder">
          <i class="fa-solid fa-plus-circle"></i>
          <span>Emplacement ${i + 1}</span>
        </div>
      `;
      slot.addEventListener('click', () => {
        if (!isLoggedIn) {
          showToast("Veuillez vous connecter pour modifier votre Top 4.");
          return;
        }
        openTop4Picker(i);
      });
    }

    top4Grid.appendChild(slot);
  }
}

function openTop4Picker(slotIndex) {
  if (!modal || !modalContainer) return;

  const pool = [...favorites, ...watchedMovies];
  const uniquePool = Array.from(new Map(pool.map(m => [m.id, m])).values());

  if (uniquePool.length === 0) {
    showToast("Ajoutez d'abord des films à vos favoris ou vus pour garnir votre Top 4.");
    return;
  }

  modalContainer.innerHTML = `
    <div style="width:100%; max-height:75vh; overflow-y:auto; padding:10px;">
      <h3 style="margin-bottom:16px; text-align:center;">Choisir un film pour l'emplacement ${slotIndex + 1}</h3>
      <div class="favorites-grid" id="top4-picker-grid"></div>
    </div>
  `;

  const pickerGrid = document.getElementById('top4-picker-grid');
  uniquePool.forEach(m => {
    const card = document.createElement('div');
    card.className = 'fav-card';
    card.innerHTML = `
      <img src="${m.poster_path ? IMAGE_BASE_URL + m.poster_path : 'https://via.placeholder.com/150'}" alt="${m.title}">
      <p>${m.title}</p>
    `;
    card.addEventListener('click', () => {
      userProfile.top4[slotIndex] = {
        id: m.id,
        title: m.title,
        poster_path: m.poster_path
      };
      pushProfileUpdate({ top4: userProfile.top4 });
      renderTop4();
      closeModal();
      showToast(`"${m.title}" ajouté au Top 4 !`);
    });
    pickerGrid.appendChild(card);
  });

  modal.style.display = 'flex';
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Génération de la Carte Profil Image
async function generateProfileCard() {
  if (!isLoggedIn) {
    showToast("Veuillez vous connecter pour générer votre carte profil.");
    return;
  }

  showToast("Création de votre carte profil...");

  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 560;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 900, 560);
  grad.addColorStop(0, '#0a0a0c');
  grad.addColorStop(1, '#181820');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 900, 560);

  ctx.strokeStyle = '#ff5e1e';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 880, 540);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 32px sans-serif';
  ctx.fillText('whatmovie', 40, 55);
  ctx.fillStyle = '#ff5e1e';
  ctx.fillText('.', 198, 55);

  ctx.fillStyle = '#8e8e93';
  ctx.font = '600 13px sans-serif';
  ctx.fillText('CARTE CINÉPHILE OFFICIELLE', 660, 50);

  const avatarImg = await loadImage(userProfile.avatar || 'https://via.placeholder.com/120');
  ctx.save();
  ctx.beginPath();
  ctx.arc(90, 135, 45, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, 45, 90, 90, 90);
  } else {
    ctx.fillStyle = '#232329';
    ctx.fillRect(45, 90, 90, 90);
  }
  ctx.restore();

  ctx.strokeStyle = '#ff5e1e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(90, 135, 45, 0, Math.PI * 2, true);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(userProfile.pseudo || 'Cinéphile', 155, 125);

  ctx.fillStyle = '#8e8e93';
  ctx.font = '15px sans-serif';
  ctx.fillText(userProfile.email || 'Membre WhatMovie', 155, 150);

  const totalMinutes = watchedMovies.reduce((acc, m) => acc + (m.runtime || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);

  const genreCounts = {};
  watchedMovies.forEach(m => {
    (m.genres || []).forEach(g => {
      const name = g.name || g;
      genreCounts[name] = (genreCounts[name] || 0) + 1;
    });
  });
  const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Aucun';

  const drawMetric = (x, y, w, h, val, label) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#ff5e1e';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(val, x + 15, y + 32);

    ctx.fillStyle = '#8e8e93';
    ctx.font = '12px sans-serif';
    ctx.fillText(label, x + 15, y + 54);
  };

  drawMetric(40, 195, 190, 65, `${watchedMovies.length}`, 'FILMS VUS');
  drawMetric(245, 195, 190, 65, `${totalHours}h`, 'VISIONNAGE');
  drawMetric(450, 195, 190, 65, `${favorites.length}`, 'FAVORIS');
  drawMetric(655, 195, 205, 65, `${topGenre}`, 'GENRE PRÉFÉRÉ');

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('TOP 4 FILMS FAVORIS', 40, 300);

  const top4List = userProfile.top4 || [];
  const posterWidth = 180;
  const posterHeight = 200;
  const gap = 25;

  for (let i = 0; i < 4; i++) {
    const x = 40 + i * (posterWidth + gap);
    const y = 315;

    const movie = top4List[i];
    if (movie && movie.poster_path) {
      const posterUrl = `${IMAGE_BASE_URL}${movie.poster_path}`;
      const img = await loadImage(posterUrl);
      if (img) {
        ctx.drawImage(img, x, y, posterWidth, posterHeight);
      } else {
        ctx.fillStyle = '#232329';
        ctx.fillRect(x, y, posterWidth, posterHeight);
      }
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(x, y, posterWidth, posterHeight);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeRect(x, y, posterWidth, posterHeight);

      ctx.fillStyle = '#8e8e93';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`#${i + 1}`, x + 75, y + 105);
    }

    if (movie && movie.title) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(x, y + posterHeight - 30, posterWidth, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.fillText(movie.title.length > 20 ? movie.title.substring(0, 18) + '...' : movie.title, x + 8, y + posterHeight - 10);
    }
  }

  const link = document.createElement('a');
  link.download = `profil-whatmovie-${userProfile.pseudo || 'user'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast("Carte profil téléchargée avec succès !");
}

// 12. Sauvegarde & Import JSON
function setupExportImport() {
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const data = {
        profile: userProfile,
        favorites: favorites,
        watchedMovies: watchedMovies,
        exportDate: new Date().toISOString()
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `whatmovie_backup_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("Sauvegarde exportée avec succès !");
    });
  }

  if (importJsonBtn && importFileInput) {
    importJsonBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(event) {
        try {
          const parsed = JSON.parse(event.target.result);
          if (Array.isArray(parsed.favorites) && Array.isArray(parsed.watchedMovies)) {
            favorites = parsed.favorites;
            watchedMovies = parsed.watchedMovies;
            // Le pseudo/avatar/top4 peuvent être repris de la sauvegarde, mais
            // l'e-mail et le compte connecté ne sont plus modifiés par un simple
            // import local : la connexion se fait uniquement via Se connecter.
            if (parsed.profile) {
              userProfile.pseudo = parsed.profile.pseudo || userProfile.pseudo;
              userProfile.avatar = parsed.profile.avatar || userProfile.avatar;
              userProfile.top4 = Array.isArray(parsed.profile.top4) ? parsed.profile.top4 : userProfile.top4;
            }
            if (isLoggedIn) {
              pushProfileUpdate({
                pseudo: userProfile.pseudo,
                avatar: userProfile.avatar,
                top4: userProfile.top4,
                favorites,
                watched: watchedMovies
              });
            } else {
              persistLocalCache();
            }
            renderFavorites();
            updateStats();
            loadUserProfile();
            checkBadges();
            showToast(isLoggedIn ? "Données importées et synchronisées avec votre compte !" : "Données importées localement. Connectez-vous pour les synchroniser.");
          } else {
            showToast("Fichier de sauvegarde invalide.");
          }
        } catch (err) {
          showToast("Erreur lors de la lecture du fichier.");
        }
      };
      reader.readAsText(file);
    });
  }
}

// 13. Quiz « Devine le Film »
function setupQuizListeners() {
  const quizNextBtn = document.getElementById('quiz-next-btn');
  if (quizNextBtn) {
    quizNextBtn.addEventListener('click', loadQuizQuestion);
  }
}

async function loadQuizQuestion() {
  const quizPoster = document.getElementById('quiz-poster');
  const quizOptions = document.getElementById('quiz-options');
  const quizFeedback = document.getElementById('quiz-feedback');
  const quizNextBtn = document.getElementById('quiz-next-btn');

  if (!quizPoster || !quizOptions) return;

  quizPoster.classList.remove('revealed');
  quizPoster.src = '';
  if (quizFeedback) quizFeedback.textContent = '';
  if (quizNextBtn) quizNextBtn.style.display = 'none';
  quizOptions.innerHTML = '<p style="grid-column:1/-1; color:var(--text-secondary);">Chargement de la question...</p>';

  try {
    const randomPage = Math.floor(Math.random() * 10) + 1;
    const res = await fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}&language=fr-FR&page=${randomPage}`);
    const data = await res.json();

    if (!data.results || data.results.length < 4) return;

    const validMovies = data.results.filter(m => m.poster_path && m.title);
    const shuffled = validMovies.sort(() => 0.5 - Math.random());
    currentQuizMovie = shuffled[0];

    const choices = [currentQuizMovie.title];
    for (let i = 1; choices.length < 4 && i < shuffled.length; i++) {
      choices.push(shuffled[i].title);
    }

    choices.sort(() => 0.5 - Math.random());

    quizPoster.src = `${IMAGE_BASE_URL}${currentQuizMovie.poster_path}`;

    quizOptions.innerHTML = '';
    choices.forEach(title => {
      const btn = document.createElement('button');
      btn.className = 'quiz-btn';
      btn.textContent = title;
      btn.addEventListener('click', () => handleQuizAnswer(btn, title));
      quizOptions.appendChild(btn);
    });
  } catch (err) {
    quizOptions.innerHTML = '<p style="grid-column:1/-1; color:var(--text-secondary);">Erreur de chargement du quiz.</p>';
  }
}

function handleQuizAnswer(selectedBtn, chosenTitle) {
  const quizPoster = document.getElementById('quiz-poster');
  const quizFeedback = document.getElementById('quiz-feedback');
  const quizNextBtn = document.getElementById('quiz-next-btn');
  const allBtns = document.querySelectorAll('.quiz-btn');

  allBtns.forEach(btn => btn.disabled = true);
  if (quizPoster) quizPoster.classList.add('revealed');

  quizQuestionsCount++;

  if (chosenTitle === currentQuizMovie.title) {
    selectedBtn.classList.add('correct');
    quizScore++;
    if (quizFeedback) {
      quizFeedback.textContent = 'Bravo ! C\'est la bonne réponse !';
      quizFeedback.style.color = '#10b981';
    }
  } else {
    selectedBtn.classList.add('wrong');
    allBtns.forEach(btn => {
      if (btn.textContent === currentQuizMovie.title) {
        btn.classList.add('correct');
      }
    });
    if (quizFeedback) {
      quizFeedback.textContent = `Dommage ! Il s'agissait de "${currentQuizMovie.title}".`;
      quizFeedback.style.color = '#ef4444';
    }
  }

  const scoreElem = document.getElementById('quiz-score');
  if (scoreElem) scoreElem.textContent = `Score : ${quizScore} / ${quizQuestionsCount}`;

  if (quizNextBtn) quizNextBtn.style.display = 'inline-block';
}

// 14. Badges & Succès
function checkBadges() {
  const badgesGrid = document.getElementById('badges-grid');
  if (!badgesGrid) return;

  badgesGrid.innerHTML = '';
  badges.forEach(badge => {
    const isUnlocked = badge.condition ? badge.condition(watchedMovies, favorites) : false;
    const card = document.createElement('div');
    card.className = `badge-card ${isUnlocked ? 'unlocked' : 'locked'}`;
    card.innerHTML = `
      <i class="fa-solid ${badge.icon} badge-icon"></i>
      <div class="badge-title">${badge.title}</div>
      <div class="badge-desc">${badge.desc}</div>
      <div class="badge-status">${isUnlocked ? 'Débloqué' : 'Verrouillé'}</div>
    `;
    badgesGrid.appendChild(card);
  });
}

// 15. Modales (Trailer / Photo)
if (trailerBtn) {
  trailerBtn.addEventListener('click', () => {
    if (!currentMovie || !currentMovie.videos) return;
    const trailer = currentMovie.videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || currentMovie.videos[0];
    
    if (trailer && modal && modalContainer) {
      modalContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${trailer.key}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
      modal.style.display = 'flex';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      showToast("Aucune bande-annonce disponible.");
    }
  });
}

if (posterContainer) {
  posterContainer.addEventListener('click', () => {
    if (posterImg && posterImg.src && modal && modalContainer) {
      modalContainer.innerHTML = `<img src="${posterImg.src}" alt="Affiche grand format">`;
      modal.style.display = 'flex';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

function closeModal() {
  if (modal) {
    modal.style.display = 'none';
    if (modalContainer) modalContainer.innerHTML = '';
  }
}

if (modalClose) modalClose.addEventListener('click', closeModal);
window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// 16. Événements Boutons
if (proposeBtn) proposeBtn.addEventListener('click', loadRandomMovie);
if (nextBtn) nextBtn.addEventListener('click', triggerSwipeNext);
if (favBtn) favBtn.addEventListener('click', toggleFavorite);

async function searchMovie(query) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return;

  try {
    const res = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&language=fr-FR&query=${encodeURIComponent(cleanQuery)}&page=1`);
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const movie = data.results[0];
      seenMovies.add(movie.id);
      await fetchMovieDetails(movie.id);
      if (searchDropdown) searchDropdown.classList.remove('active');
    } else {
      showToast("Aucun film trouvé pour cette recherche.");
    }
  } catch (err) {
    showToast("Erreur lors de la recherche du film.");
  }
}

if (searchBtn) {
  searchBtn.addEventListener('click', () => {
    if (searchInput) {
      const query = searchInput.value.trim();
      if (query) searchMovie(query);
    }
  });
}

if (searchInput) {
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) searchMovie(query);
    }
  });
}

// 17. Onglets & Changements de Vues
const navButtons = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

function switchTab(targetId) {
  navButtons.forEach(b => b.classList.remove('active'));
  tabContents.forEach(c => c.classList.remove('active'));

  const activeBtn = document.querySelector(`[data-target="${targetId}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  
  const targetTab = document.getElementById(targetId);
  if (targetTab) targetTab.classList.add('active');

  if (targetId === 'tab-trending') loadTrendingMovies();
  if (targetId === 'tab-favorites') renderFavorites();
  if (targetId === 'tab-profile') {
    updateStats();
    loadUserProfile();
  }
  if (targetId === 'tab-quiz' && quizQuestionsCount === 0) loadQuizQuestion();
  if (targetId === 'tab-badges') checkBadges();
  if (targetId === 'tab-admin') loadAdminPanel();
}

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    switchTab(targetId);
  });
});

async function loadTrendingMovies() {
  const trendingGrid = document.getElementById('trending-grid');
  if (!trendingGrid) return;
  trendingGrid.innerHTML = '<p style="color: var(--text-secondary);">Chargement...</p>';

  try {
    const res = await fetch(`${BASE_URL}/trending/movie/week?api_key=${API_KEY}&language=fr-FR`);
    const data = await res.json();

    trendingGrid.innerHTML = '';
    if (data.results) {
      data.results.forEach(m => {
        const card = document.createElement('div');
        card.className = 'fav-card';
        card.innerHTML = `
          <img src="${m.poster_path ? IMAGE_BASE_URL + m.poster_path : 'https://via.placeholder.com/150'}" alt="${m.title}" loading="lazy">
          <p>${m.title}</p>
        `;
        card.addEventListener('click', () => {
          seenMovies.add(m.id);
          fetchMovieDetails(m.id);
          switchTab('tab-discover');
        });
        trendingGrid.appendChild(card);
      });
    }
  } catch (err) {
    trendingGrid.innerHTML = '<p style="color: var(--text-secondary);">Impossible de charger les tendances.</p>';
  }
}

// 18. Espace Admin
function setupAdminPanel() {
  if (adminRefreshBtn) {
    adminRefreshBtn.addEventListener('click', loadAdminPanel);
  }
}

// Affiche ou masque le bouton "Admin" selon l'e-mail du compte Supabase
// connecté. Comme cette info vient d'une vraie session (et non plus d'une
// valeur locale au navigateur), l'accès admin fonctionne sur n'importe quel
// appareil dès qu'on se connecte avec breyneraphael02@gmail.com.
// NB : ce contrôle côté navigateur cache seulement le bouton/l'onglet aux
// yeux d'un visiteur normal — la vraie protection des données se fait via
// les policies RLS Supabase (voir la note SQL fournie avec ce projet).
function checkAdminAccess() {
  if (!adminNavBtn) return;
  const isAdmin = isLoggedIn && (userProfile.email || '').trim().toLowerCase() === ADMIN_EMAIL;
  adminNavBtn.style.display = isAdmin ? 'flex' : 'none';

  // Si l'utilisateur courant vient de perdre l'accès admin mais que l'onglet
  // admin est actif, on le ramène sur l'onglet Découvrir.
  if (!isAdmin) {
    const adminTab = document.getElementById('tab-admin');
    if (adminTab && adminTab.classList.contains('active')) {
      switchTab('tab-discover');
    }
  }
}

// Enregistre une visite dans Supabase (table "visites").
// Échoue silencieusement si la table n'existe pas encore ou si hors-ligne.
async function logVisite() {
  if (typeof supabaseClient === 'undefined') return;
  try {
    await supabaseClient.from('visites').insert([{
      pseudo: isLoggedIn ? (userProfile.pseudo || null) : null
    }]);
  } catch (err) {
    console.warn('Suivi de visite indisponible :', err);
  }
}

async function loadAdminPanel() {
  // Double vérification avant de charger quoi que ce soit, même si l'onglet
  // ne devrait être accessible qu'aux admins.
  const isAdmin = isLoggedIn && (userProfile.email || '').trim().toLowerCase() === ADMIN_EMAIL;
  if (!isAdmin || typeof supabaseClient === 'undefined') return;

  const usersStat = document.getElementById('admin-stat-users');
  const visitsStat = document.getElementById('admin-stat-visits');
  const visitsTodayStat = document.getElementById('admin-stat-visits-today');
  const usersTable = document.getElementById('admin-users-table');
  const visitsTable = document.getElementById('admin-visits-table');

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  try {
    const [
      { count: userCount },
      { count: visitCount },
      { count: visitTodayCount },
      { data: recentUsers },
      { data: recentVisits }
    ] = await Promise.all([
      supabaseClient.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseClient.from('visites').select('*', { count: 'exact', head: true }),
      supabaseClient.from('visites').select('*', { count: 'exact', head: true }).gte('created_at', startOfToday.toISOString()),
      supabaseClient.from('profiles').select('pseudo, email, created_at').order('created_at', { ascending: false }).limit(15),
      supabaseClient.from('visites').select('pseudo, created_at').order('created_at', { ascending: false }).limit(15)
    ]);

    if (usersStat) usersStat.textContent = userCount ?? '0';
    if (visitsStat) visitsStat.textContent = visitCount ?? '0';
    if (visitsTodayStat) visitsTodayStat.textContent = visitTodayCount ?? '0';

    if (usersTable) {
      if (recentUsers && recentUsers.length > 0) {
        usersTable.innerHTML = buildAdminTable(
          ['Pseudo', 'E-mail', 'Inscrit le'],
          recentUsers.map(u => [u.pseudo, u.email || '—', formatAdminDate(u.created_at)])
        );
      } else {
        usersTable.innerHTML = '<p class="admin-empty">Aucun utilisateur pour le moment.</p>';
      }
    }

    if (visitsTable) {
      if (recentVisits && recentVisits.length > 0) {
        visitsTable.innerHTML = buildAdminTable(
          ['Visiteur', 'Date'],
          recentVisits.map(v => [v.pseudo || 'Anonyme', formatAdminDate(v.created_at)])
        );
      } else {
        visitsTable.innerHTML = '<p class="admin-empty">Aucune visite enregistrée pour le moment.</p>';
      }
    }
  } catch (err) {
    console.error('Erreur chargement admin :', err);
    if (usersTable) usersTable.innerHTML = '<p class="admin-empty">Impossible de charger les données. Vérifie que les tables Supabase existent (voir la note fournie).</p>';
    if (visitsTable) visitsTable.innerHTML = '';
  }
}

function buildAdminTable(headers, rows) {
  const thead = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const tbody = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table class="admin-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function formatAdminDate(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
