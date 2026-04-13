document.addEventListener('DOMContentLoaded', function() {
    const photoInput = document.getElementById('book-photo');
    const photoPreview = document.getElementById('photo-preview');
    const previewImage = document.getElementById('preview-image');
    const placeholder = document.querySelector('.photo-placeholder');
    const bookForm = document.getElementById('book-form');
    const seriesInput = document.getElementById('book-series');
    const genreCheckboxes = document.querySelectorAll('input[name="genre"]');
    const readCheckbox = document.getElementById('book-read');
    const readLabel = document.getElementById('read-label');

    // Import modal elements
    const importBtn = document.getElementById('import-book-btn');
    const importModal = document.getElementById('import-modal');
    const importModalClose = document.getElementById('import-modal-close');
    const importSearchInput = document.getElementById('import-search-input');
    const importSearchBtn = document.getElementById('import-search-btn');
    const importResults = document.getElementById('import-results');

    let photoBase64 = null;

    // Import modal handlers
    importBtn.addEventListener('click', () => {
        importModal.classList.add('active');
        importSearchInput.focus();
    });

    importModalClose.addEventListener('click', closeImportModal);

    importModal.addEventListener('click', (e) => {
        if (e.target === importModal) {
            closeImportModal();
        }
    });

    function closeImportModal() {
        importModal.classList.remove('active');
        importSearchInput.value = '';
        importResults.innerHTML = '<p class="import-hint">Enter a book title or ISBN to search Google Books</p>';
    }

    // Search Google Books API
    importSearchBtn.addEventListener('click', searchBooks);
    importSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchBooks();
        }
    });

    async function searchBooks() {
        const query = importSearchInput.value.trim();
        if (!query) return;

        importResults.innerHTML = '<p class="import-loading">Searching...</p>';

        try {
            // Use Open Library API (free, no API key required)
            const response = await fetch(
                `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`
            );

            if (!response.ok) {
                throw new Error('Failed to search books');
            }

            const data = await response.json();

            if (!data.docs || data.docs.length === 0) {
                importResults.innerHTML = '<p class="import-hint">No books found. Try a different search.</p>';
                return;
            }

            renderSearchResults(data.docs);
        } catch (error) {
            console.error('Error searching books:', error);
            importResults.innerHTML = '<p class="import-error">Failed to search. Please try again.</p>';
        }
    }

    function renderSearchResults(books) {
        importResults.innerHTML = books.map(book => {
            const coverId = book.cover_i;
            const thumbnail = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : '';
            const authors = book.author_name?.join(', ') || 'Unknown Author';
            const year = book.first_publish_year || '';
            const subjects = book.subject?.slice(0, 2) || [];

            return `
                <div class="import-result-item" data-book='${JSON.stringify({
                    title: book.title || '',
                    authors: authors,
                    thumbnail: thumbnail,
                    categories: book.subject || []
                }).replace(/'/g, '&#39;')}'>
                    <div class="import-result-cover">
                        ${thumbnail
                            ? `<img src="${thumbnail}" alt="${book.title}">`
                            : '<span class="no-cover">&#128218;</span>'}
                    </div>
                    <div class="import-result-info">
                        <div class="import-result-title">${escapeHtml(book.title || 'Untitled')}</div>
                        <div class="import-result-author">${escapeHtml(authors)}</div>
                        <div class="import-result-meta">
                            ${year ? `<span>${year}</span>` : ''}
                            ${subjects.length ? `<span>${escapeHtml(subjects.join(', '))}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers to results
        importResults.querySelectorAll('.import-result-item').forEach(item => {
            item.addEventListener('click', () => selectBook(item));
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function selectBook(item) {
        const bookData = JSON.parse(item.dataset.book);

        // Fill in the form
        document.getElementById('book-title').value = bookData.title;
        document.getElementById('book-author').value = bookData.authors;

        // Try to set cover image from Google Books
        if (bookData.thumbnail) {
            try {
                // Load and convert thumbnail to base64
                const img = await loadImageAsBase64(bookData.thumbnail);
                if (img) {
                    photoBase64 = img;
                    previewImage.src = img;
                    previewImage.style.display = 'block';
                    placeholder.style.display = 'none';
                }
            } catch (error) {
                console.error('Error loading cover image:', error);
            }
        }

        // Try to match categories to genres
        if (bookData.categories && bookData.categories.length > 0) {
            clearGenreCheckboxes();
            const genreMap = mapCategoriesToGenres(bookData.categories);
            genreMap.slice(0, 3).forEach(genre => {
                const checkbox = document.querySelector(`input[name="genre"][value="${genre}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        closeImportModal();
    }

    function clearGenreCheckboxes() {
        document.querySelectorAll('input[name="genre"]').forEach(cb => cb.checked = false);
    }

    function mapCategoriesToGenres(categories) {
        const categoryText = categories.join(' ').toLowerCase();
        const matched = [];

        const mappings = {
            'fiction': 'Fiction',
            'novel': 'Novel',
            'romance': 'Romance',
            'fantasy': 'Fantasy',
            'horror': 'Horror',
            'drama': 'Drama',
            'biography': 'Biography',
            'history': 'History',
            'historical': 'History',
            'poetry': 'Poems',
            'poems': 'Poems',
            'children': 'Children',
            'juvenile': 'Children',
            'manga': 'Manga',
            'comics': 'Manga',
            'graphic novel': 'Manga',
            'mythology': 'Myth',
            'myth': 'Myth',
            'fairy tale': 'Fairy Tale',
            'fairy tales': 'Fairy Tale',
            'folklore': 'Fairy Tale',
            'western': 'Western',
            'non-fiction': 'Non-Fiction',
            'nonfiction': 'Non-Fiction',
            'self-help': 'Non-Fiction',
            'thriller': 'Dark',
            'dark': 'Dark',
            'suspense': 'Dark'
        };

        for (const [keyword, genre] of Object.entries(mappings)) {
            if (categoryText.includes(keyword) && !matched.includes(genre)) {
                matched.push(genre);
            }
        }

        return matched;
    }

    async function loadImageAsBase64(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                try {
                    const base64 = canvas.toDataURL('image/jpeg', 0.8);
                    resolve(base64);
                } catch (e) {
                    // CORS issue - use the URL directly
                    resolve(null);
                }
            };

            img.onerror = function() {
                resolve(null);
            };

            // Use a CORS proxy for Google Books images
            img.src = url.replace('http://', 'https://');
        });
    }

    // Load nav avatar
    onAuthStateChange(async (user) => {
        if (user) {
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const navAvatarImg = document.getElementById('nav-avatar-img');
                    const navAvatarInitial = document.getElementById('nav-avatar-initial');
                    if (navAvatarImg && navAvatarInitial) {
                        if (userData.profilePhoto) {
                            navAvatarImg.src = userData.profilePhoto;
                            navAvatarImg.style.display = 'block';
                            navAvatarInitial.style.display = 'none';
                        } else if (userData.username) {
                            navAvatarInitial.textContent = userData.username.charAt(0).toUpperCase();
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading nav avatar:', error);
            }
        }
    });

    // Handle read toggle label update
    readCheckbox.addEventListener('change', function() {
        readLabel.textContent = this.checked ? 'Read' : 'Unread';
    });

    // Limit genre selection to 3
    genreCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const checked = document.querySelectorAll('input[name="genre"]:checked');
            if (checked.length > 3) {
                this.checked = false;
                alert('You can select up to 3 genres.');
            }
        });
    });

    // Check for series parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const presetSeries = urlParams.get('series');

    if (presetSeries) {
        seriesInput.value = presetSeries;
        seriesInput.readOnly = true;
        seriesInput.classList.add('locked');

        // Update the label to show it's locked
        const seriesLabel = seriesInput.closest('.form-group').querySelector('label');
        seriesLabel.innerHTML = `Series <span class="locked-badge">Locked</span>`;

        // Wait for auth to be ready, then autofill author, genre, and title template
        onAuthStateChange((user) => {
            if (user) {
                autofillFromSeries(user, presetSeries);
                applyNamingTemplate(user, presetSeries);
            }
        });
    }

    /**
     * Apply naming template to auto-fill title
     * @param {firebase.User} user - The authenticated user
     * @param {string} seriesName - The series to look up
     */
    async function applyNamingTemplate(user, seriesName) {
        try {
            // Get user settings
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) return;

            const seriesSettings = userDoc.data().seriesSettings || {};
            const settings = seriesSettings[seriesName];

            if (!settings || !settings.namingTemplate) return;

            const template = settings.namingTemplate;
            const parsed = parseTemplate(template);
            if (!parsed) return;

            // Get all books in this series to find used numbers
            const snapshot = await db.collection('users').doc(user.uid)
                .collection('books')
                .where('series', '==', seriesName)
                .get();

            const usedNumbers = [];
            const prefix = parsed.prefix.toLowerCase();

            snapshot.forEach(doc => {
                const book = doc.data();
                const title = (book.title || '').toLowerCase();
                if (title.startsWith(prefix)) {
                    const remainder = book.title.substring(parsed.prefix.length);
                    const num = parseInt(remainder, 10);
                    if (!isNaN(num)) {
                        usedNumbers.push(num);
                    }
                }
            });

            // Find next available number
            let nextNum = 1;
            if (usedNumbers.length > 0) {
                const maxNum = Math.max(...usedNumbers);
                // Check for gaps
                for (let i = 1; i <= maxNum; i++) {
                    if (!usedNumbers.includes(i)) {
                        nextNum = i;
                        break;
                    }
                }
                if (nextNum === 1 && usedNumbers.includes(1)) {
                    nextNum = maxNum + 1;
                }
            }

            // Auto-fill the title
            const titleInput = document.getElementById('book-title');
            titleInput.value = parsed.prefix + nextNum;

        } catch (error) {
            console.error('Error applying naming template:', error);
        }
    }

    /**
     * Parse a template to extract prefix and number
     */
    function parseTemplate(template) {
        const match = template.match(/^(.+?)(\d+)$/);
        if (match) {
            return {
                prefix: match[1],
                number: parseInt(match[2], 10)
            };
        }
        return null;
    }

    /**
     * Look up existing books in a series and autofill author/genre
     * @param {firebase.User} user - The authenticated user
     * @param {string} seriesName - The series to look up
     */
    async function autofillFromSeries(user, seriesName) {
        try {
            const snapshot = await db.collection('users').doc(user.uid)
                .collection('books')
                .where('series', '==', seriesName)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                const existingBook = snapshot.docs[0].data();
                const authorInput = document.getElementById('book-author');

                // Autofill author if available
                if (existingBook.author) {
                    authorInput.value = existingBook.author;
                }

                // Autofill genres if available
                if (existingBook.genres && Array.isArray(existingBook.genres)) {
                    existingBook.genres.forEach(genre => {
                        const checkbox = document.querySelector(`input[name="genre"][value="${genre}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                } else if (existingBook.genre) {
                    // Legacy: single genre as string
                    const checkbox = document.querySelector(`input[name="genre"][value="${existingBook.genre}"]`);
                    if (checkbox) checkbox.checked = true;
                }
            }
        } catch (error) {
            console.error('Error fetching series data:', error);
            // Silently fail - user can still fill in manually
        }
    }

    // Handle photo preview click to trigger file input
    photoPreview.addEventListener('click', function() {
        photoInput.click();
    });

    // Handle file selection and preview
    photoInput.addEventListener('change', async function(event) {
        const file = event.target.files[0];

        if (file) {
            try {
                // Compress the image before storing
                photoBase64 = await compressImage(file, 800, 0.7);
                previewImage.src = photoBase64;
                previewImage.style.display = 'block';
                placeholder.style.display = 'none';
            } catch (error) {
                console.error('Error processing image:', error);
                alert('Failed to process image. Please try a different photo.');
            }
        }
    });

    /**
     * Compress an image file to reduce size for Firestore storage
     * @param {File} file - The image file to compress
     * @param {number} maxWidth - Maximum width in pixels
     * @param {number} quality - JPEG quality (0-1)
     * @returns {Promise<string>} - Compressed base64 string
     */
    function compressImage(file, maxWidth, quality) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = function(e) {
                const img = new Image();

                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to compressed JPEG
                    const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedBase64);
                };

                img.onerror = function() {
                    reject(new Error('Failed to load image'));
                };

                img.src = e.target.result;
            };

            reader.onerror = function() {
                reject(new Error('Failed to read file'));
            };

            reader.readAsDataURL(file);
        });
    }

    // Handle form submission
    bookForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const user = getCurrentUser();
        if (!user) {
            alert('You must be signed in to add books.');
            window.location.href = 'login.html';
            return;
        }

        const submitBtn = bookForm.querySelector('.submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding book...';

        // Validate at least one genre is selected
        const selectedGenres = [...document.querySelectorAll('input[name="genre"]:checked')].map(cb => cb.value);
        if (selectedGenres.length === 0) {
            alert('Please select at least one genre.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add to Collection';
            return;
        }

        try {
            // Get the user's username and settings
            const userDoc = await db.collection('users').doc(user.uid).get();
            const username = userDoc.exists ? userDoc.data().username : 'Unknown';
            const seriesSettings = userDoc.exists ? (userDoc.data().seriesSettings || {}) : {};

            // Check series book limit
            const seriesName = document.getElementById('book-series').value.trim();
            if (seriesName) {
                const settings = seriesSettings[seriesName];
                if (settings && settings.status === 'finished' && settings.totalBooks) {
                    // Count existing books in this series
                    const seriesSnapshot = await db.collection('users').doc(user.uid)
                        .collection('books')
                        .where('series', '==', seriesName)
                        .get();

                    const currentCount = seriesSnapshot.size;
                    if (currentCount >= settings.totalBooks) {
                        alert(`Cannot add book: "${seriesName}" is marked as finished with ${settings.totalBooks} books and you already have ${currentCount}.`);
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Add to Collection';
                        return;
                    }
                }
            }

            const bookData = {
                title: document.getElementById('book-title').value.trim(),
                author: document.getElementById('book-author').value.trim(),
                dateAcquired: document.getElementById('book-date').value || null,
                genres: selectedGenres,
                series: document.getElementById('book-series').value.trim() || null,
                photoUrl: photoBase64 || null,
                ownerId: user.uid,
                ownerUsername: username,
                read: readCheckbox.checked,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('users').doc(user.uid).collection('books').add(bookData);

            // Redirect to collection on success
            window.location.href = 'collection.html';
        } catch (error) {
            console.error('Error adding book:', error);
            alert('Failed to add book. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add to Collection';
        }
    });
});
