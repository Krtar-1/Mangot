// Search page logic
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search');
    const sortBy = document.getElementById('sort-by');
    const searchResults = document.getElementById('search-results');
    const noResults = document.getElementById('no-results');
    const initialState = document.getElementById('initial-state');
    const loadingState = document.getElementById('loading-state');
    const searchStats = document.getElementById('search-stats');
    const navLinks = document.getElementById('nav-links');

    let allBooks = [];
    let debounceTimer = null;

    // Setup navigation based on auth state
    onAuthStateChange((user) => {
        if (user) {
            navLinks.innerHTML = `
                <a href="collection.html" class="nav-link">My Collection</a>
                <a href="register.html" class="nav-link">Add Book</a>
                <a href="profile.html" class="nav-link">Profile</a>
            `;
        } else {
            navLinks.innerHTML = `
                <a href="login.html" class="nav-link">Sign In</a>
            `;
        }
    });

    // Load all books on page load
    loadAllBooks();

    // Search input handler with debounce
    searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            performSearch();
        }, 300);

        // Show/hide clear button
        clearBtn.style.display = searchInput.value ? 'block' : 'none';
    });

    // Clear search
    clearBtn.addEventListener('click', function() {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        performSearch();
        searchInput.focus();
    });

    // Sort change handler
    sortBy.addEventListener('change', function() {
        performSearch();
    });

    /**
     * Load all books from Firestore using collection group query
     */
    async function loadAllBooks() {
        showLoading();

        try {
            const snapshot = await db.collectionGroup('books').get();
            allBooks = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                allBooks.push({
                    id: doc.id,
                    ...data,
                    // Convert Firestore timestamp to date string for sorting
                    createdAtDate: data.createdAt ? data.createdAt.toDate() : new Date(0)
                });
            });

            // Show initial state
            hideLoading();
            initialState.style.display = 'block';

        } catch (error) {
            console.error('Error loading books:', error);
            hideLoading();
            if (error.code === 'failed-precondition') {
                searchStats.innerHTML = 'Index required. Check browser console (F12) and click the link to create it.';
            } else if (error.code === 'permission-denied') {
                searchStats.textContent = 'Permission denied. Update Firestore rules.';
            } else {
                searchStats.textContent = 'Error: ' + error.message;
            }
            searchStats.style.color = '#ff6b6b';
        }
    }

    /**
     * Perform search and filter/sort results
     */
    function performSearch() {
        const query = searchInput.value.toLowerCase().trim();
        const sortValue = sortBy.value;

        // Hide all states initially
        initialState.style.display = 'none';
        noResults.style.display = 'none';
        searchResults.style.display = 'none';
        searchStats.textContent = '';

        if (!query) {
            initialState.style.display = 'block';
            return;
        }

        // Filter books
        let filtered = allBooks.filter(book => {
            const title = (book.title || '').toLowerCase();
            const author = (book.author || '').toLowerCase();
            const series = (book.series || '').toLowerCase();
            const owner = (book.ownerUsername || '').toLowerCase();

            return title.includes(query) ||
                   author.includes(query) ||
                   series.includes(query) ||
                   owner.includes(query);
        });

        // Sort books
        filtered = sortBooks(filtered, sortValue);

        // Display results
        if (filtered.length === 0) {
            noResults.style.display = 'block';
            searchStats.textContent = `No results for "${searchInput.value}"`;
        } else {
            renderResults(filtered);
            searchStats.textContent = `${filtered.length} book${filtered.length !== 1 ? 's' : ''} found`;
        }
    }

    /**
     * Sort books based on selected criteria
     */
    function sortBooks(books, sortValue) {
        const sorted = [...books];

        switch (sortValue) {
            case 'title-asc':
                sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                break;
            case 'title-desc':
                sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
                break;
            case 'author-asc':
                sorted.sort((a, b) => (a.author || '').localeCompare(b.author || ''));
                break;
            case 'author-desc':
                sorted.sort((a, b) => (b.author || '').localeCompare(a.author || ''));
                break;
            case 'date-desc':
                sorted.sort((a, b) => b.createdAtDate - a.createdAtDate);
                break;
            case 'date-asc':
                sorted.sort((a, b) => a.createdAtDate - b.createdAtDate);
                break;
        }

        return sorted;
    }

    /**
     * Render search results
     */
    function renderResults(books) {
        searchResults.style.display = 'grid';

        searchResults.innerHTML = books.map(book => {
            const safeTitle = escapeAttr(book.title).replace(/'/g, "\\'");
            return `
                <div class="book-card">
                    <div class="book-photo">
                        ${book.photoUrl
                            ? `<img src="${book.photoUrl}" alt="${escapeHtml(book.title)}">`
                            : `<div class="no-photo">No Photo</div>`
                        }
                    </div>
                    <div class="book-info">
                        <h3 class="book-title">${escapeHtml(book.title)}</h3>
                        <p class="book-author">${escapeHtml(book.author)}</p>
                        ${book.genre ? `<span class="book-genre-tag">${escapeHtml(book.genre)}</span>` : ''}
                        ${book.series ? `<p class="book-series">${escapeHtml(book.series)}</p>` : ''}
                        <p class="book-date">${formatDate(book.dateAcquired)}</p>
                        <p class="book-owner">Added by <span class="owner-name">${escapeHtml(book.ownerUsername || 'Unknown')}</span></p>
                    </div>
                    <button class="comments-btn" onclick="openCommentsModal('${book.id}', '${book.ownerId}', '${safeTitle}')" title="View comments">
                        &#128172;
                    </button>
                </div>
            `;
        }).join('');
    }

    /**
     * Escape attribute value
     */
    function escapeAttr(text) {
        if (!text) return '';
        return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /**
     * Show loading state
     */
    function showLoading() {
        initialState.style.display = 'none';
        noResults.style.display = 'none';
        searchResults.style.display = 'none';
        loadingState.style.display = 'block';
    }

    /**
     * Hide loading state
     */
    function hideLoading() {
        loadingState.style.display = 'none';
    }

    /**
     * Format date for display
     */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
