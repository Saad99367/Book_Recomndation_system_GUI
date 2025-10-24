document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration and State ---
    const DEFAULT_USER = 'user123';
    const DEFAULT_PASS = '1234';
    const AUTH_TOKEN = 'bookify_user_session_f7g9h2j4k6l8m0n1';
    const API_URL = 'https://www.googleapis.com/books/v1/volumes?q=';
    
    // Application State - Check for the presence of the AUTH_TOKEN
    let loggedIn = localStorage.getItem("loggedInToken") === AUTH_TOKEN; 
    let selectedBook = null; 
    let favorites = JSON.parse(localStorage.getItem("favorites")) || {}; 

    // --- DOM Elements ---
    const appContainer = document.getElementById('app-container');
    const loginScreen = document.getElementById('login-screen');
    const allScreens = document.querySelectorAll('.screen');
    const navItems = document.querySelectorAll('.bottom-navbar .nav-item');
    const homeBookList = document.getElementById('home-book-list');
    const favoritesBookList = document.getElementById('favorites-book-list');
    const searchBookList = document.getElementById('search-book-list');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const backButton = document.getElementById('back-button');
    const noFavoritesMessage = document.getElementById('no-favorites-message');

    // --- Utility Functions ---

    /**
     * Toggles screen visibility and updates navigation state (SPA core).
     */
    const showScreen = (screenId) => {
        allScreens.forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');

        // Update Navbar Highlight
        navItems.forEach(item => item.classList.remove('active'));
        const targetNav = document.querySelector(`.nav-item[data-screen="${screenId}"]`);
        if (targetNav) {
            targetNav.classList.add('active');
        }

        // Specific Screen Logic (ensures data is current when navigating)
        if (screenId === 'favorites-screen') {
            renderFavorites();
        } else if (screenId === 'profile-screen') {
            setupProfileScreen();
        }
    };

    /**
     * Saves the current favorites state to localStorage.
     */
    const saveFavorites = () => {
        // Essential: Convert the JavaScript object back to a JSON string for storage
        localStorage.setItem("favorites", JSON.stringify(favorites));
    };

    /**
     * Converts a numeric rating to a star GUI string.
     */
    const getRatingHTML = (rating) => {
        const validRating = rating !== null ? Math.min(5, Math.max(0, parseFloat(rating))) : null;

        if (validRating === null || isNaN(validRating)) return `<span class="no-rating">N/A</span>`;
        
        const fullStars = Math.floor(validRating);
        const halfStar = validRating % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;
        
        let stars = '';
        for (let i = 0; i < fullStars; i++) stars += '<i class="fas fa-star full"></i>';
        if (halfStar) stars += '<i class="fas fa-star-half-alt half"></i>';
        for (let i = 0; i < emptyStars; i++) stars += '<i class="far fa-star empty"></i>';

        return `<div class="stars-container">${stars}</div>`;
    };
    
    // --- API and Rendering ---

    /**
     * Fetches books from Google Books API and renders them.
     */
    const fetchAndRenderBooks = async (query, targetElement) => {
        targetElement.innerHTML = '';
        
        let spinner = targetElement.querySelector('.loading-spinner');
        if (!spinner) {
            spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            targetElement.appendChild(spinner);
        }
        spinner.classList.add('show');

        try {
            const response = await fetch(`${API_URL}${encodeURIComponent(query)}&maxResults=20`);
            const data = await response.json();
            
            spinner.classList.remove('show');

            const books = data.items || [];
            if (books.length > 0) {
                targetElement.innerHTML = '';
                books.forEach(item => {
                    if (item.volumeInfo && item.volumeInfo.title) {
                        const book = formatBookData(item);
                        targetElement.appendChild(createBookCard(book, true));
                    }
                });
            } else {
                targetElement.innerHTML = `<p class="info-message">No books found for your query.</p>`;
            }

        } catch (error) {
            console.error('API Fetch Error:', error);
            spinner.classList.remove('show');
            targetElement.innerHTML = '<p class="info-message">Failed to load data. Check network connection.</p>';
        }
    };

    /**
     * Extracts and formats necessary book data from the API response item.
     */
    const formatBookData = (item) => {
        const info = item.volumeInfo;
        return {
            id: item.id,
            title: info.title || 'Unknown Title',
            author: info.authors ? info.authors.join(', ') : 'Unknown Author',
            image: info.imageLinks ? (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail) : 'placeholder.png',
            description: info.description || 'No description available for this book.',
            rating: info.averageRating || null,
            ratingsCount: info.ratingsCount || 0
        };
    };

    /**
     * Creates an HTML card for a book.
     */
    const createBookCard = (book, isHomeOrSearch) => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.dataset.id = book.id;

        const isFavorited = !!favorites[book.id];

        let actionButtons = '';
        if (isHomeOrSearch) {
            actionButtons = `
                <button class="details-btn" data-id="${book.id}">Details</button>
                <button class="fav-btn fas ${isFavorited ? 'fa-heart active' : 'fa-regular fa-heart'}" data-id="${book.id}"></button>
            `;
        } else {
            // Favorites screen card structure
            actionButtons = `
                <button class="details-btn" data-id="${book.id}">Details</button>
                <button class="remove-btn" data-id="${book.id}">Remove</button>
            `;
        }

        card.innerHTML = `
            <img class="book-card-img" src="${book.image}" alt="${book.title}" onerror="this.src='placeholder.png'">
            <div class="book-info">
                <h4>${book.title}</h4>
                <p>${book.author}</p>
                ${getRatingHTML(book.rating)}
            </div>
            <div class="book-actions">
                ${actionButtons}
            </div>
        `;
        
        // Event Listeners for buttons inside the card
        card.querySelector('.details-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showBookDetails(book);
        });
        
        if (isHomeOrSearch) {
            card.querySelector('.fav-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(book, e.currentTarget);
            });
        } else {
            // Add listener for the REMOVE button
            card.querySelector('.remove-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                removeFavorite(book.id);
            });
        }
        
        return card;
    };

    // --- Favorites Logic ---

    /**
     * Adds or removes a book from favorites and updates state/storage.
     */
    const toggleFavorite = (book, button) => {
        const id = book.id;
        let isAdding;
        
        if (favorites[id]) {
            delete favorites[id];
            isAdding = false;
        } else {
            favorites[id] = book;
            isAdding = true;
        }
        saveFavorites(); // Persist change
        
        // Update the visual state of the heart button that was clicked
        if (button) {
            button.classList.toggle('fa-heart', isAdding);
            button.classList.toggle('fa-regular', !isAdding);
            button.classList.toggle('active', isAdding);
        }

        // Sync with Detail Page/Favorites Screen
        const detailFavBtn = document.getElementById('detail-favorite-btn');
        if (document.getElementById('details-screen').classList.contains('active') && selectedBook && selectedBook.id === id) {
             detailFavBtn.textContent = isAdding ? 'Remove from Favorites ❤️' : 'Add to Favorites ❤️';
             detailFavBtn.classList.toggle('btn-secondary-active', isAdding);
        }
        
        if (document.getElementById('favorites-screen').classList.contains('active')) {
             renderFavorites();
        }
    };

    /**
     * Removes a book from favorites and updates state/storage.
     */
    const removeFavorite = (id) => {
        // FIX: Ensure item deletion and storage update happen together
        if (favorites.hasOwnProperty(id)) {
            delete favorites[id]; // Delete item from the local object
            saveFavorites();      // Crucial: Save the updated object to localStorage
        }
        
        // Update the heart button on the home/search screen if visible
        const homeButton = document.querySelector(`.fav-btn[data-id="${id}"]`);
        if (homeButton) {
            homeButton.classList.remove('fa-heart', 'active');
            homeButton.classList.add('fa-regular', 'fa-heart');
        }

        // Re-render the favorites list immediately
        renderFavorites();
    };

    /**
     * Renders the current list of favorites.
     */
    const renderFavorites = () => {
        favoritesBookList.innerHTML = '';
        const favoriteBooksArray = Object.values(favorites);
        
        if (favoriteBooksArray.length === 0) {
            noFavoritesMessage.classList.remove('hidden');
        } else {
            noFavoritesMessage.classList.add('hidden');
            favoriteBooksArray.forEach(book => {
                favoritesBookList.appendChild(createBookCard(book, false));
            });
        }
    };

    // --- Details and Profile Logic ---

    /**
     * Populates and shows the Book Details screen.
     */
    const showBookDetails = (book) => {
        selectedBook = book; 

        document.getElementById('detail-image').src = book.image;
        document.getElementById('detail-title').textContent = book.title;
        document.getElementById('detail-author').textContent = book.author;
        document.getElementById('detail-description').textContent = book.description;
        
        // Rating Display
        document.getElementById('detail-rating-stars').innerHTML = getRatingHTML(book.rating);
        document.getElementById('detail-rating-text').textContent = 
            `${book.rating || 'N/A'} average (${book.ratingsCount} votes)`;

        // Favorite Button Logic for Details Screen
        const favBtn = document.getElementById('detail-favorite-btn');
        const isFav = !!favorites[book.id];
        
        favBtn.textContent = isFav ? 'Remove from Favorites ❤️' : 'Add to Favorites ❤️';
        favBtn.classList.toggle('btn-secondary-active', isFav);

        favBtn.onclick = () => {
            const heartButton = document.querySelector(`.fav-btn[data-id="${book.id}"]`);
            toggleFavorite(book, heartButton);
            showBookDetails(book); // Re-render detail page button state
        };

        showScreen('details-screen');
    };

    /**
     * Populates the Profile screen with user info.
     */
    const setupProfileScreen = () => {
        const username = localStorage.getItem('currentUsername') || DEFAULT_USER;
        document.getElementById('profile-username').textContent = username;
        
        // DiceBear Avatar API
        document.getElementById('profile-avatar').src = 
            `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}&radius=50&backgroundColor=06b6d4,22c55e`;
    };
    
    // --- Event Handlers ---

    // 1. Login Logic
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (username === DEFAULT_USER && password === DEFAULT_PASS) {
            // SET AUTH TOKEN
            localStorage.setItem("loggedInToken", AUTH_TOKEN); 
            localStorage.setItem("currentUsername", username);
            loggedIn = true;
            loginScreen.classList.remove('active');
            appContainer.style.display = 'block';
            showScreen('home-screen');
            fetchAndRenderBooks('bestsellers', homeBookList);
        } else {
            alert("Invalid username or password");
        }
    });

    // 6. Logout Logic
    document.getElementById('logout-btn').addEventListener('click', () => {
        // REMOVE AUTH TOKEN
        localStorage.removeItem("loggedInToken");
        localStorage.removeItem("currentUsername");
        loggedIn = false;
        appContainer.style.display = 'none';
        loginScreen.classList.add('active');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    });

    // 7. Navigation Bar Logic (SPA Navigation)
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const screenId = item.dataset.screen;
            showScreen(screenId);
        });
    });

    // 5. Back Button Logic
    backButton.addEventListener('click', () => {
        showScreen('home-screen'); 
    });

    // 3. Search Logic
    searchButton.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
            document.getElementById('search-results-label').textContent = `Results for: "${query}"`;
            fetchAndRenderBooks(query, searchBookList);
        } else {
            searchBookList.innerHTML = '<p class="info-message">Please enter a search term.</p>';
            document.getElementById('search-results-label').textContent = `Search Results`;
        }
    });
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchButton.click();
        }
    });


    // --- Initialization on Load ---
    if (loggedIn) {
        loginScreen.classList.remove('active');
        appContainer.style.display = 'block';
        showScreen('home-screen');
        fetchAndRenderBooks('bestsellers', homeBookList);
    } else {
        loginScreen.classList.add('active');
        appContainer.style.display = 'none';
    }
});