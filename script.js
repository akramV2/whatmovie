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
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modal-close');
const modalContainer = document.getElementById('modal-content-container');
const posterContainer = document.getElementById('poster-container');
const trailerBtn = document.getElementById('trailer-btn');
const shareBtn = document.getElementById('share-btn');

// État de l'application
let currentMovie = null;
let favorites = JSON.parse(localStorage.getItem('whatmovie_favs')) || [];
let seenMovies = new Set();
let searchDebounceTimer = null;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  fetchGenres();
  renderFavorites();
  setupKeyboardShortcuts();
  
  // Vérifie si un film spécifique est passé dans l'URL (ex: ?id=550)
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

// 2. Raccourcis Clavier (Espace & Flèche Droite pour suivant)
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.code === 'Space' || e.code === 'ArrowRight') {
      e.preventDefault();
      triggerSwipeNext();
    }
  });
}

// 3. Toast Notifications
function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast show';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

// 4. Charger les Genres
async function fetchGenres() {
  try {
    const res = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=fr-FR`);
    const data = await res.json();
    data.genres.forEach(g => {
      const option = document.createElement('option');
      option.value = g.id;
      option.textContent = g.name;
      genreSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Erreur genres:', err);
  }
}

// 5. Charger un Film Aléatoire avec Filtres
async function loadRandomMovie() {
  if (spinner) spinner.style.display = 'block';
  
  try {
    const genre = genreSelect.value;
    const era = eraSelect.value;
    const duration = durationSelect.value;
    const provider = providerSelect.value;

    let url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=fr-FR&sort_by=popularity.desc&include_adult=false&page=${Math.floor(Math.random() * 5) + 1}`;

    if (genre) url += `&with_genres=${genre}`;
    if (provider) url += `&with_watch_providers=${provider}&watch_region=FR`;

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

// 6. Recherche Dynamique
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  clearTimeout(searchDebounceTimer);

  if (query.length < 2) {
    searchDropdown.classList.remove('active');
    searchDropdown.innerHTML = '';
    return;
  }

  searchDebounceTimer = setTimeout(() => {
    fetchSearchSuggestions(query);
  }, 400);
});

async function fetchSearchSuggestions(query) {
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
          searchInput.value = '';
        });

        searchDropdown.appendChild(item);
      });
      searchDropdown.classList.add('active');
    } else {
      searchDropdown.innerHTML = '<div class="search-no-result">Aucun film trouvé</div>';
      searchDropdown.classList.add('active');
    }
  } catch (err) {
    console.error('Erreur recherche dynamique:', err);
  }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-input-wrapper')) {
    searchDropdown.classList.remove('active');
  }
});

// 7. Récupération & Affichage d'un Film
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
  movieCard.classList.remove('swipe-out');
  movieCard.classList.remove('fade-in');
  void movieCard.offsetWidth;
  movieCard.classList.add('fade-in');

  movieTitle.textContent = m.title;
  movieSynopsis.textContent = m.overview || "Aucun synopsis disponible.";
  movieRating.textContent = `${m.vote_average ? m.vote_average.toFixed(1) : 'N/A'} / 10`;

  if (m.poster_path) {
    posterImg.src = `${IMAGE_BASE_URL}${m.poster_path}`;
    dynamicBg.style.backgroundImage = `url(${IMAGE_BASE_URL}${m.poster_path})`;
    dynamicBg.style.opacity = '1';
  } else {
    posterImg.src = 'https://via.placeholder.com/300x450?text=Pas+d%27image';
  }

  movieGenres.innerHTML = '';
  m.genres.forEach(g => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = g.name;
    movieGenres.appendChild(span);
  });

  if (m.runtime) {
    const spanRuntime = document.createElement('span');
    spanRuntime.className = 'tag';
    spanRuntime.textContent = `${m.runtime} min`;
    movieGenres.appendChild(spanRuntime);
  }

  const director = m.credits?.crew?.find(c => c.job === 'Director');
  movieDirector.textContent = director ? `Réalisé par : ${director.name}` : '';

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

  // Logos de streaming cliquables vers Google/Plateforme
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
      img.className = 'provider-logo clickable-provider';

      link.appendChild(img);
      movieProviders.appendChild(link);
    });
  } else {
    movieProviders.textContent = 'Non disponible en streaming FR';
  }

  updateFavButtonState();
}

function triggerSwipeNext() {
  movieCard.classList.add('swipe-out');
  setTimeout(() => {
    loadRandomMovie();
  }, 300);
}

// 8. Favoris
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
  localStorage.setItem('whatmovie_favs', JSON.stringify(favorites));
  updateFavButtonState();
  renderFavorites();
}

function updateFavButtonState() {
  if (!currentMovie) return;
  const isFav = favorites.some(f => f.id === currentMovie.id);
  favBtn.textContent = isFav ? '❤️ Dans vos favoris' : '🤍 Ajouter aux favoris';
}

function renderFavorites() {
  favoritesGrid.innerHTML = '';
  favCountTitle.textContent = `Mes Favoris (${favorites.length})`;

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

    card.querySelector('img').addEventListener('click', () => fetchMovieDetails(f.id));
    card.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      favorites = favorites.filter(fav => fav.id !== f.id);
      localStorage.setItem('whatmovie_favs', JSON.stringify(favorites));
      renderFavorites();
      updateFavButtonState();
      showToast("Favori supprimé.");
    });

    favoritesGrid.appendChild(card);
  });
}

// 9. Modales & Partage (Génération du lien direct ?id=)
trailerBtn.addEventListener('click', () => {
  if (!currentMovie || !currentMovie.videos) return;
  const trailer = currentMovie.videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || currentMovie.videos[0];
  if (trailer) {
    modalContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${trailer.key}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    modal.style.display = 'flex';
  } else {
    showToast("Aucune bande-annonce disponible.");
  }
});

shareBtn.addEventListener('click', () => {
  if (!currentMovie) return;
  const shareUrl = `${window.location.origin}${window.location.pathname}?id=${currentMovie.id}`;

  if (navigator.share) {
    navigator.share({
      title: currentMovie.title,
      text: `Regarde ${currentMovie.title} ce soir sur WhatMovie !`,
      url: shareUrl
    });
  } else {
    navigator.clipboard.writeText(shareUrl);
    showToast("Lien du film copié !");
  }
});

// Événements boutons
proposeBtn.addEventListener('click', loadRandomMovie);
nextBtn.addEventListener('click', triggerSwipeNext);
favBtn.addEventListener('click', toggleFavorite);

searchBtn.addEventListener('click', () => {
  const query = searchInput.value.trim();
  if (query) {
    searchDropdown.classList.remove('active');
  }
});

searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchDropdown.classList.remove('active');
});

posterContainer.addEventListener('click', () => {
  if (posterImg.src) {
    modalContainer.innerHTML = `<img src="${posterImg.src}" alt="Affiche grand format">`;
    modal.style.display = 'flex';
  }
});

function closeModal() {
  modal.style.display = 'none';
  modalContainer.innerHTML = '';
}

modalClose.addEventListener('click', closeModal);
window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// 10. Onglets & Tendances
const navButtons = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');

    navButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(targetId).classList.add('active');

    if (targetId === 'tab-trending') {
      loadTrendingMovies();
    }
  });
});

async function loadTrendingMovies() {
  const trendingGrid = document.getElementById('trending-grid');
  if (!trendingGrid) return;
  trendingGrid.innerHTML = '<div class="spinner" style="position:relative; left:0; transform:none;"></div>';

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
          document.querySelector('[data-target="tab-discover"]').click();
        });
        trendingGrid.appendChild(card);
      });
    }
  } catch (err) {
    trendingGrid.innerHTML = '<p style="color: var(--text-secondary);">Impossible de charger les tendances.</p>';
  }
}
