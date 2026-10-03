// Collectors page logic - search for users and browse their collections
document.addEventListener('DOMContentLoaded', function() {
    const DEFAULT_USERNAME = 'krtar';
    const MAX_USERS_SHOWN = 24;

    const searchInput = document.getElementById('user-search-input');
    const clearBtn = document.getElementById('clear-user-search');
    const userList = document.getElementById('user-list');
    const loadingState = document.getElementById('loading-state');
    const noUsers = document.getElementById('no-users');
    const viewedUser = document.getElementById('viewed-user');
    const viewedCollection = document.getElementById('viewed-collection');
    const collectionSearch = document.getElementById('viewed-collection-search');
    const resultsCount = document.getElementById('viewed-results-count');
    const navLinks = document.getElementById('nav-links');

    let users = []; // { uid, username, books: [] }
    let selectedUid = null;
    let debounceTimer = null;

    // Setup navigation based on auth state
    onAuthStateChange(async (user) => {
        if (user) {
            navLinks.innerHTML = `
                <a href="search.html" class="nav-link">Search</a>
                <a href="users.html" class="nav-link active">Collectors</a>
                <a href="collection.html" class="nav-link">My Collection</a>
                <a href="register.html" class="nav-link">Add Book</a>
                <a href="profile.html" class="nav-profile-link" title="Profile">
                    <div class="nav-avatar" id="nav-avatar">
                        <img id="nav-avatar-img" src="" alt="Profile" style="display: none;">
                        <span id="nav-avatar-initial">?</span>
                    </div>
                </a>
            `;
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const navAvatarImg = document.getElementById('nav-avatar-img');
                    const navAvatarInitial = document.getElementById('nav-avatar-initial');
                    if (userData.profilePhoto) {
                        navAvatarImg.src = userData.profilePhoto;
                        navAvatarImg.style.display = 'block';
                        navAvatarInitial.style.display = 'none';
                    } else if (userData.username) {
                        navAvatarInitial.textContent = userData.username.charAt(0).toUpperCase();
                    }
                }
            } catch (error) {
                console.error('Error loading nav avatar:', error);
            }
        } else {
            navLinks.innerHTML = signedOutNavHtml('users.html');
        }
    });

    loadUsers();

    // User search with debounce
    searchInput.addEventListener('input', function() {
        clearBtn.style.display = searchInput.value ? 'block' : 'none';
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(renderUserList, 200);
    });

    clearBtn.addEventListener('click', function() {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        renderUserList();
        searchInput.focus();
    });

    document.getElementById('next-to-get-shuffle').addEventListener('click', () => {
        const user = users.find(u => u.uid === selectedUid);
        if (user) renderNextToGet(user.books);
    });

    // Filter within the viewed collection
    collectionSearch.addEventListener('input', function() {
        filterViewedCollection(this.value.trim().toLowerCase());
    });

    /**
     * Build the user list from every book on Mangot, grouped by owner
     */
    async function loadUsers() {
        loadingState.style.display = 'block';

        try {
            const snapshot = await db.collectionGroup('books').get();
            const byOwner = {};

            snapshot.forEach((doc) => {
                const book = { id: doc.id, ...doc.data() };
                // Fall back to the parent path for books saved without an ownerId
                const ownerId = book.ownerId || doc.ref.parent.parent.id;
                if (!byOwner[ownerId]) {
                    byOwner[ownerId] = { uid: ownerId, username: book.ownerUsername || 'Unknown', books: [] };
                }
                byOwner[ownerId].books.push({ ...book, ownerId });
            });

            // Krtar first, then largest collections
            const isDefault = u => u.username.toLowerCase() === DEFAULT_USERNAME;
            users = Object.values(byOwner).sort((a, b) =>
                (isDefault(b) - isDefault(a)) || (b.books.length - a.books.length));
            loadingState.style.display = 'none';

            renderUserList();

            // Open on just the list of names, unless a shared link names a user
            const urlUid = new URLSearchParams(window.location.search).get('user');
            if (users.some(u => u.uid === urlUid)) {
                selectUser(urlUid, false);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            loadingState.style.display = 'none';
            noUsers.style.display = 'block';
            noUsers.querySelector('p').textContent = 'Could not load collectors';
            noUsers.querySelector('.empty-hint').textContent = error.message;
        }
    }

    /**
     * Render user chips matching the search query
     */
    function renderUserList() {
        const query = searchInput.value.toLowerCase().trim();
        let matches = users.filter(u => u.username.toLowerCase().includes(query));

        noUsers.style.display = matches.length === 0 ? 'block' : 'none';
        if (!query) {
            matches = matches.slice(0, MAX_USERS_SHOWN);
        }

        userList.innerHTML = matches.map(u => `
            <button class="user-chip ${u.uid === selectedUid ? 'active' : ''}" data-uid="${escapeAttr(u.uid)}">${escapeHtml(u.username)}</button>
        `).join('');

        userList.querySelectorAll('.user-chip').forEach(chip => {
            chip.addEventListener('click', () => selectUser(chip.dataset.uid, true));
        });
    }

    /**
     * Show a user's profile header and collection
     */
    function selectUser(uid, scrollIntoView) {
        const user = users.find(u => u.uid === uid);
        if (!user) return;

        selectedUid = uid;
        userList.querySelectorAll('.user-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.uid === uid);
        });

        // Keep the URL shareable
        const url = new URL(window.location);
        url.searchParams.set('user', uid);
        history.replaceState(null, '', url);

        document.getElementById('viewed-user-name').textContent = user.username;
        const initialEl = document.getElementById('viewed-user-initial');
        const photoEl = document.getElementById('viewed-user-photo');
        const bioEl = document.getElementById('viewed-user-bio');
        initialEl.textContent = user.username.charAt(0).toUpperCase();
        initialEl.style.display = 'flex';
        photoEl.style.display = 'none';
        bioEl.style.display = 'none';
        loadProfileExtras(uid);

        const books = user.books;
        const seriesNames = new Set(books.filter(b => b.series).map(b => b.series));
        const readCount = books.filter(b => b.read).length;
        document.getElementById('viewed-book-count').textContent = `${books.length} book${books.length !== 1 ? 's' : ''}`;
        document.getElementById('viewed-series-count').textContent = `${seriesNames.size} series`;
        document.getElementById('viewed-read-count').textContent = `${readCount} read`;

        collectionSearch.value = '';
        resultsCount.textContent = '';
        renderNextToGet(books);
        renderCollection(books);

        viewedUser.style.display = 'block';
        if (scrollIntoView) {
            viewedUser.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * Load photo and bio if the user's profile is readable
     */
    async function loadProfileExtras(uid) {
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (!doc.exists || selectedUid !== uid) return;
            const data = doc.data();

            if (data.profilePhoto) {
                const photoEl = document.getElementById('viewed-user-photo');
                photoEl.src = data.profilePhoto;
                photoEl.style.display = 'block';
                document.getElementById('viewed-user-initial').style.display = 'none';
            }
            if (data.bio) {
                const bioEl = document.getElementById('viewed-user-bio');
                bioEl.textContent = data.bio;
                bioEl.style.display = 'block';
            }
        } catch (error) {
            // Profiles may be private - the page works without them
        }
    }

    /**
     * Render the collection grouped by series (read-only)
     */
    function renderCollection(books) {
        const groups = {};
        books.forEach(book => {
            const key = book.series || '';
            if (!groups[key]) groups[key] = [];
            groups[key].push(book);
        });

        // Series A-Z, uncategorized last
        const seriesKeys = Object.keys(groups).sort((a, b) => {
            if (a === '') return 1;
            if (b === '') return -1;
            return naturalCompare(stripLeadingArticle(a), stripLeadingArticle(b));
        });

        viewedCollection.innerHTML = seriesKeys.map(key => {
            const seriesBooks = groups[key];
            const displayName = key || 'Uncategorized';

            // Finished series carry their total (synced from the owner's series settings)
            const total = key ? Math.max(0, ...seriesBooks.map(b => b.seriesTotal || 0)) : 0;
            const owned = seriesBooks.length;
            const countText = total
                ? `${owned}/${total} books`
                : `${owned} book${owned !== 1 ? 's' : ''}`;
            const countClass = total && owned >= total ? 'section-count series-complete' : 'section-count';
            // Sections start collapsed; book cards are only built when first opened
            return `
                <div class="collection-section collapsed viewed-series" data-series="${escapeAttr(key)}">
                    <button class="section-header viewed-series-toggle" aria-expanded="false">
                        <span class="viewed-series-arrow">&#9656;</span>
                        <h2 class="section-title">${escapeHtml(displayName)}</h2>
                        <span class="${countClass}">${countText}</span>
                    </button>
                    <div class="section-grid"></div>
                </div>
            `;
        }).join('');

        viewedCollection.querySelectorAll('.viewed-series').forEach(section => {
            const books = [...groups[section.dataset.series]].sort((a, b) => naturalCompare(a.title || '', b.title || ''));
            section._books = books;
            section.querySelector('.viewed-series-toggle').addEventListener('click', () => {
                setSeriesOpen(section, section.classList.contains('collapsed'));
            });
        });
    }

    function setSeriesOpen(section, open) {
        const grid = section.querySelector('.section-grid');
        if (open && !grid.childElementCount) {
            grid.innerHTML = section._books.map(renderBookCard).join('');
        }
        section.classList.toggle('collapsed', !open);
        section.querySelector('.viewed-series-toggle').setAttribute('aria-expanded', open);
    }

    function renderBookCard(book) {
        // Escape for the JS string first, then for the HTML attribute it sits in
        const safeTitle = escapeAttr((book.title || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
        const genres = book.genres || (book.genre ? [book.genre] : []);
        const genreTags = genres.map(g => `<span class="book-genre-tag">${escapeHtml(g)}</span>`).join('');

        return `
            <div class="book-card ${book.read ? 'read' : 'unread'}">
                <div class="book-photo">
                    ${book.photoUrl
                        ? `<img src="${book.photoUrl}" alt="${escapeAttr(book.title)}" loading="lazy">`
                        : `<div class="no-photo">No Photo</div>`
                    }
                </div>
                <div class="book-info">
                    <h3 class="book-title">${escapeHtml(book.title)}</h3>
                    <p class="book-author">${escapeHtml(book.author)}</p>
                    ${genreTags ? `<div class="book-genres">${genreTags}</div>` : ''}                </div>
                <button class="comments-btn" onclick="openCommentsModal('${book.id}', '${book.ownerId}', '${safeTitle}')" title="View comments">
                    &#128172;
                </button>
            </div>
        `;
    }

    /**
     * Show 5 random missing books from finished series that aren't fully collected.
     * Titles follow the series' auto-naming template, e.g. "Attack on Titan Vol. 31".
     */
    function renderNextToGet(books) {
        const section = document.getElementById('next-to-get');
        const list = document.getElementById('next-to-get-list');

        const bySeries = {};
        books.forEach(book => {
            if (!book.series) return;
            if (!bySeries[book.series]) bySeries[book.series] = [];
            bySeries[book.series].push(book);
        });

        // Each eligible series contributes its missing numbers, lowest first
        const pools = [];
        Object.values(bySeries).forEach(seriesBooks => {
            const total = Math.max(0, ...seriesBooks.map(b => b.seriesTotal || 0));
            if (!total || seriesBooks.length >= total) return;

            const prefix = getTitlePrefix(seriesBooks);
            if (!prefix) return;

            const used = new Set();
            seriesBooks.forEach(book => {
                const title = book.title || '';
                if (title.toLowerCase().startsWith(prefix.toLowerCase())) {
                    const num = parseInt(title.substring(prefix.length), 10);
                    if (!isNaN(num)) used.add(num);
                }
            });

            const missing = [];
            for (let n = 1; n <= total; n++) {
                if (!used.has(n)) missing.push(prefix + n);
            }
            if (missing.length) pools.push(missing);
        });

        // Pick a random series each time and take its next missing book,
        // so the list spreads across series before repeating one
        const picks = [];
        while (picks.length < 5 && pools.length) {
            const i = Math.floor(Math.random() * pools.length);
            picks.push(pools[i].shift());
            if (!pools[i].length) pools.splice(i, 1);
        }

        section.style.display = picks.length ? 'block' : 'none';
        list.innerHTML = picks.map(title => `<li>${escapeHtml(title)}</li>`).join('');
    }

    /**
     * Title prefix before the volume number: from the series' naming template,
     * or, if none is set, the most common "<prefix><number>" pattern in its titles
     */
    function getTitlePrefix(seriesBooks) {
        const template = seriesBooks.find(b => b.seriesNamingTemplate)?.seriesNamingTemplate;
        const fromTemplate = template && template.match(/^(.+?)(\d+)$/);
        if (fromTemplate) return fromTemplate[1];

        const counts = {};
        seriesBooks.forEach(book => {
            const match = (book.title || '').match(/^(.+?)(\d+)$/);
            if (match) counts[match[1]] = (counts[match[1]] || 0) + 1;
        });
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return best ? best[0] : null;
    }

    function filterViewedCollection(query) {
        let matchCount = 0;

        viewedCollection.querySelectorAll('.viewed-series').forEach(section => {
            const seriesMatches = query && section.dataset.series.toLowerCase().includes(query);
            const matching = new Set(section._books.filter(book => {
                if (!query || seriesMatches) return true;
                const genres = book.genres || (book.genre ? [book.genre] : []);
                return [book.title, book.author, ...genres].join(' ').toLowerCase().includes(query);
            }));

            // Searching opens series with matches; clearing the search collapses everything again
            setSeriesOpen(section, !!query && matching.size > 0);
            section.querySelectorAll('.book-card').forEach((card, i) => {
                card.style.display = matching.has(section._books[i]) ? '' : 'none';
            });
            section.style.display = matching.size ? '' : 'none';
            if (query) matchCount += matching.size;
        });

        resultsCount.textContent = query ? `${matchCount} result${matchCount !== 1 ? 's' : ''}` : '';
    }

    function naturalCompare(a, b) {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    }

    function stripLeadingArticle(title) {
        return title.replace(/^(the|a|an)\s+/i, '');
    }

    function escapeAttr(text) {
        if (!text) return '';
        return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
