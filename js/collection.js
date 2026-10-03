// Collection page logic
document.addEventListener('DOMContentLoaded', function() {
    const collectionsContainer = document.getElementById('collections-container');
    const emptyState = document.getElementById('empty-state');
    const bookCount = document.getElementById('book-count');
    const seriesCount = document.getElementById('series-count');

    // Edit modal elements
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const modalClose = document.getElementById('modal-close');
    const cancelEdit = document.getElementById('cancel-edit');
    const editPhotoInput = document.getElementById('edit-book-photo');
    const editPhotoPreview = document.getElementById('edit-photo-preview');
    const editPreviewImage = document.getElementById('edit-preview-image');
    const editPlaceholder = editPhotoPreview.querySelector('.photo-placeholder');

    let currentUserId = null;
    let sectionOrder = []; // Stored order of sections
    let bookOrders = {}; // Stored order of books within each section
    let collapsedSections = []; // Stored collapsed state of sections
    let seriesSettings = {}; // Stored settings per series (autoSort, namingTemplate)
    let draggedSection = null;
    let draggedBook = null;
    let editPhotoBase64 = null;
    let currentEditBookId = null;
    let allBooksCache = []; // Cache for finding book data
    const editGenreCheckboxes = document.querySelectorAll('input[name="edit-genre"]');

    // Limit genre selection to 3 in edit modal
    editGenreCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const checked = document.querySelectorAll('input[name="edit-genre"]:checked');
            if (checked.length > 3) {
                this.checked = false;
                alert('You can select up to 3 genres.');
            }
        });
    });

    // Limit genre selection to 3 in series settings modal
    const seriesGenreCheckboxes = document.querySelectorAll('input[name="series-genre"]');
    seriesGenreCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const checked = document.querySelectorAll('input[name="series-genre"]:checked');
            if (checked.length > 3) {
                this.checked = false;
                alert('You can select up to 3 tags.');
            }
        });
    });

    // Collection search functionality
    const searchInput = document.getElementById('collection-search-input');
    const searchResultsCount = document.getElementById('search-results-count');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    let searchTimeout = null;

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            const query = this.value.trim().toLowerCase();

            // Show/hide clear button
            clearSearchBtn.style.display = query ? 'block' : 'none';

            // Debounce search
            searchTimeout = setTimeout(() => {
                filterCollection(query);
            }, 150);
        });
    }

    function filterCollection(query) {
        const bookCards = document.querySelectorAll('.book-card');
        const sections = document.querySelectorAll('.collection-section');
        let matchCount = 0;

        if (!query) {
            // Show all books and sections
            bookCards.forEach(card => {
                card.style.display = '';
                card.classList.remove('search-highlight');
            });
            sections.forEach(section => {
                section.style.display = '';
            });
            searchResultsCount.textContent = '';
            return;
        }

        // Filter books
        bookCards.forEach(card => {
            const title = card.querySelector('.book-title')?.textContent.toLowerCase() || '';
            const author = card.querySelector('.book-author')?.textContent.toLowerCase() || '';
            const genres = Array.from(card.querySelectorAll('.book-genre-tag')).map(t => t.textContent.toLowerCase()).join(' ');

            const matches = title.includes(query) || author.includes(query) || genres.includes(query);

            if (matches) {
                card.style.display = '';
                card.classList.add('search-highlight');
                matchCount++;
            } else {
                card.style.display = 'none';
                card.classList.remove('search-highlight');
            }
        });

        // Hide sections with no visible books
        sections.forEach(section => {
            const visibleBooks = section.querySelectorAll('.book-card[style=""], .book-card:not([style*="display: none"])');
            const hasVisibleBooks = Array.from(section.querySelectorAll('.book-card')).some(card => card.style.display !== 'none');
            section.style.display = hasVisibleBooks ? '' : 'none';
        });

        // Update results count
        searchResultsCount.textContent = `${matchCount} result${matchCount !== 1 ? 's' : ''}`;
    }

    window.clearCollectionSearch = function() {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        filterCollection('');
        searchInput.focus();
    };

    // Modal close handlers
    modalClose.addEventListener('click', closeEditModal);
    cancelEdit.addEventListener('click', closeEditModal);
    editModal.addEventListener('click', function(e) {
        if (e.target === editModal) {
            closeEditModal();
        }
    });

    // Photo upload in edit modal
    editPhotoPreview.addEventListener('click', function() {
        editPhotoInput.click();
    });

    editPhotoInput.addEventListener('change', async function(event) {
        const file = event.target.files[0];
        if (file) {
            try {
                editPhotoBase64 = await compressImage(file, 800, 0.7);
                editPreviewImage.src = editPhotoBase64;
                editPreviewImage.style.display = 'block';
                editPlaceholder.style.display = 'none';
            } catch (error) {
                console.error('Error processing image:', error);
                alert('Failed to process image. Please try a different photo.');
            }
        }
    });

    // Edit form submission
    editForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const user = getCurrentUser();
        if (!user || !currentEditBookId) return;

        // Validate at least one genre is selected
        const selectedGenres = [...document.querySelectorAll('input[name="edit-genre"]:checked')].map(cb => cb.value);
        if (selectedGenres.length === 0) {
            alert('Please select at least one genre.');
            return;
        }

        const saveBtn = document.getElementById('save-edit');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const updatedData = {
            title: document.getElementById('edit-book-title').value.trim(),
            author: document.getElementById('edit-book-author').value.trim(),
            dateAcquired: document.getElementById('edit-book-date').value || null,
            genres: selectedGenres,
            series: document.getElementById('edit-book-series').value.trim() || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Only update photo if a new one was selected
        if (editPhotoBase64 !== null) {
            updatedData.photoUrl = editPhotoBase64;
        }

        try {
            await db.collection('users').doc(user.uid).collection('books').doc(currentEditBookId).update(updatedData);
            closeEditModal();
        } catch (error) {
            console.error('Error updating book:', error);
            alert('Failed to update book. Please try again.');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    });

    // Load books when auth state is confirmed
    onAuthStateChange((user) => {
        if (user) {
            currentUserId = user.uid;
            loadSectionOrder(user.uid).then(() => {
                loadBooks(user.uid);
            });
        }
    });

    /**
     * Open edit modal with book data
     */
    window.openEditModal = function(bookId) {
        const book = allBooksCache.find(b => b.id === bookId);
        if (!book) return;

        currentEditBookId = bookId;
        editPhotoBase64 = null; // Reset photo state

        // Populate form fields
        document.getElementById('edit-book-id').value = bookId;
        document.getElementById('edit-book-title').value = book.title || '';
        document.getElementById('edit-book-author').value = book.author || '';
        document.getElementById('edit-book-date').value = book.dateAcquired || '';
        document.getElementById('edit-book-series').value = book.series || '';

        // Clear and set genre checkboxes
        editGenreCheckboxes.forEach(cb => cb.checked = false);
        const bookGenres = book.genres || (book.genre ? [book.genre] : []);
        bookGenres.forEach(genre => {
            const checkbox = document.querySelector(`input[name="edit-genre"][value="${genre}"]`);
            if (checkbox) checkbox.checked = true;
        });

        // Set photo preview
        if (book.photoUrl) {
            editPreviewImage.src = book.photoUrl;
            editPreviewImage.style.display = 'block';
            editPlaceholder.style.display = 'none';
        } else {
            editPreviewImage.src = '';
            editPreviewImage.style.display = 'none';
            editPlaceholder.style.display = 'block';
        }

        // Reset file input
        editPhotoInput.value = '';

        // Show modal
        editModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    function closeEditModal() {
        editModal.classList.remove('active');
        document.body.style.overflow = '';
        currentEditBookId = null;
        editPhotoBase64 = null;

        // Reset save button
        const saveBtn = document.getElementById('save-edit');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    }

    /**
     * Compress an image file
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

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedBase64);
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Load section order and book orders from Firestore
     */
    async function loadSectionOrder(userId) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists) {
                if (doc.data().sectionOrder) {
                    sectionOrder = doc.data().sectionOrder;
                }
                if (doc.data().bookOrders) {
                    bookOrders = doc.data().bookOrders;
                }
                if (doc.data().collapsedSections) {
                    collapsedSections = doc.data().collapsedSections;
                }
                if (doc.data().seriesSettings) {
                    seriesSettings = doc.data().seriesSettings;
                }
                // Load nav avatar
                loadNavAvatar(doc.data());
            }
        } catch (error) {
            console.error('Error loading section order:', error);
        }
    }

    /**
     * Load user avatar in navigation
     */
    function loadNavAvatar(userData) {
        const navAvatarImg = document.getElementById('nav-avatar-img');
        const navAvatarInitial = document.getElementById('nav-avatar-initial');

        if (!navAvatarImg || !navAvatarInitial) return;

        if (userData && userData.profilePhoto) {
            navAvatarImg.src = userData.profilePhoto;
            navAvatarImg.style.display = 'block';
            navAvatarInitial.style.display = 'none';
        } else if (userData && userData.username) {
            navAvatarInitial.textContent = userData.username.charAt(0).toUpperCase();
            navAvatarInitial.style.display = 'flex';
            navAvatarImg.style.display = 'none';
        } else {
            navAvatarInitial.textContent = '?';
            navAvatarInitial.style.display = 'flex';
            navAvatarImg.style.display = 'none';
        }
    }

    /**
     * Save section order preference to Firestore
     */
    async function saveSectionOrder(userId, order) {
        try {
            await db.collection('users').doc(userId).set(
                { sectionOrder: order },
                { merge: true }
            );
        } catch (error) {
            console.error('Error saving section order:', error);
        }
    }

    /**
     * Strip leading articles (A, An, The) for sorting purposes
     */
    function stripLeadingArticle(title) {
        const lower = title.toLowerCase();
        if (lower.startsWith('the ')) return title.substring(4);
        if (lower.startsWith('a ')) return title.substring(2);
        if (lower.startsWith('an ')) return title.substring(3);
        return title;
    }

    /**
     * Sort all series alphabetically A-Z
     */
    window.sortAllSeriesAlphabetically = async function() {
        // Get all series sections (excluding Unread and Uncategorized)
        const sections = document.querySelectorAll('.collection-section[draggable="true"]');
        if (sections.length === 0) return;

        // Get series names and sort them
        const seriesNames = [...sections].map(s => s.dataset.series);
        const sortedNames = [...seriesNames].sort((a, b) => {
            // Put Uncategorized at the end
            if (a === '(No Series)') return 1;
            if (b === '(No Series)') return -1;
            // Strip leading articles for sorting (A, An, The)
            const sortA = stripLeadingArticle(a).toLowerCase();
            const sortB = stripLeadingArticle(b).toLowerCase();
            return naturalCompare(sortA, sortB);
        });

        // Check if already sorted
        const alreadySorted = seriesNames.every((name, i) => name === sortedNames[i]);
        if (alreadySorted) {
            return;
        }

        // Update section order and save
        sectionOrder = sortedNames;
        await saveSectionOrder(currentUserId, sortedNames);

        // Re-render to apply new order
        renderGroupedBooks(allBooksCache);
    };

    /**
     * Show alert when trying to add to a series at its book limit
     */
    window.showSeriesLimitAlert = function(seriesName, totalBooks) {
        alert(`"${seriesName}" is marked as finished with ${totalBooks} book${totalBooks !== 1 ? 's' : ''}. No more books can be added.\n\nTo add more books, change the series status in Series Settings.`);
    };

    /**
     * Save book order within a section to Firestore
     */
    async function saveBookOrder(userId, seriesKey, bookIds) {
        try {
            bookOrders[seriesKey] = bookIds;
            await db.collection('users').doc(userId).set(
                { bookOrders: bookOrders },
                { merge: true }
            );
        } catch (error) {
            console.error('Error saving book order:', error);
        }
    }

    /**
     * Toggle section collapsed state
     */
    window.toggleSectionCollapse = async function(seriesKey) {
        const section = document.querySelector(`.collection-section[data-series="${CSS.escape(seriesKey)}"]`);
        if (!section) return;

        const isCollapsed = section.classList.toggle('collapsed');
        const btn = section.querySelector('.collapse-btn');
        if (btn) {
            btn.classList.toggle('is-hidden', isCollapsed);
            btn.title = isCollapsed ? 'Show books' : 'Hide books';
        }

        // Update collapsed sections array
        if (isCollapsed) {
            if (!collapsedSections.includes(seriesKey)) {
                collapsedSections.push(seriesKey);
            }
        } else {
            collapsedSections = collapsedSections.filter(s => s !== seriesKey);
        }

        // Save to Firestore
        if (currentUserId) {
            try {
                await db.collection('users').doc(currentUserId).set(
                    { collapsedSections: collapsedSections },
                    { merge: true }
                );
            } catch (error) {
                console.error('Error saving collapsed state:', error);
            }
        }
    };

    /**
     * Open series settings modal
     */
    window.openSeriesSettings = function(seriesKey) {
        const modal = document.getElementById('series-settings-modal');
        const seriesNameEl = document.getElementById('settings-series-name');
        const autoSortCheckbox = document.getElementById('series-auto-sort');
        const namingTemplateInput = document.getElementById('series-naming-template');
        const templatePreview = document.getElementById('template-preview');

        // Get current settings for this series
        const settings = seriesSettings[seriesKey] || {};

        seriesNameEl.textContent = seriesKey;
        modal.dataset.series = seriesKey;
        autoSortCheckbox.checked = settings.autoSort !== false; // Default to true
        namingTemplateInput.value = settings.namingTemplate || '';

        updateTemplatePreview(namingTemplateInput.value, seriesKey);

        // Reset genre checkboxes
        document.querySelectorAll('input[name="series-genre"]').forEach(cb => {
            cb.checked = false;
        });

        // Find common genres across all books in the series
        const seriesBooks = allBooksCache.filter(b => b.series === seriesKey);
        if (seriesBooks.length > 0) {
            // Get genres that ALL books in the series have
            const firstBookGenres = seriesBooks[0].genres || [];
            const commonGenres = firstBookGenres.filter(genre =>
                seriesBooks.every(book => (book.genres || []).includes(genre))
            );

            // Pre-check common genres
            commonGenres.forEach(genre => {
                const checkbox = document.querySelector(`input[name="series-genre"][value="${genre}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        // Set series status (ongoing/finished)
        const status = settings.status || 'ongoing';
        const totalBooks = settings.totalBooks || '';
        setSeriesStatus(status, false);
        document.getElementById('series-total-books').value = totalBooks;

        // Update progress display
        updateSeriesProgress(seriesKey);

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    /**
     * Set series status (ongoing/finished)
     */
    window.setSeriesStatus = function(status, updateProgress = true) {
        const ongoingBtn = document.getElementById('status-ongoing-btn');
        const finishedBtn = document.getElementById('status-finished-btn');
        const totalBooksContainer = document.getElementById('series-total-books-container');

        if (status === 'finished') {
            ongoingBtn.classList.remove('active');
            finishedBtn.classList.add('active');
            totalBooksContainer.style.display = 'block';
        } else {
            ongoingBtn.classList.add('active');
            finishedBtn.classList.remove('active');
            totalBooksContainer.style.display = 'none';
        }

        if (updateProgress) {
            const modal = document.getElementById('series-settings-modal');
            const seriesKey = modal.dataset.series;
            updateSeriesProgress(seriesKey);
        }
    };

    /**
     * Update series progress display
     */
    function updateSeriesProgress(seriesKey) {
        const progressEl = document.getElementById('series-progress');
        const totalBooksInput = document.getElementById('series-total-books');
        const finishedBtn = document.getElementById('status-finished-btn');

        if (!finishedBtn.classList.contains('active')) {
            progressEl.textContent = '';
            return;
        }

        const seriesBooks = allBooksCache.filter(b => b.series === seriesKey);
        const currentCount = seriesBooks.length;
        const totalBooks = parseInt(totalBooksInput.value, 10);

        if (totalBooks && totalBooks > 0) {
            const remaining = totalBooks - currentCount;
            if (remaining > 0) {
                progressEl.textContent = `${currentCount} of ${totalBooks} collected (${remaining} remaining)`;
                progressEl.style.color = '#ff6b6b';
            } else if (remaining === 0) {
                progressEl.textContent = `${currentCount} of ${totalBooks} collected (Complete!)`;
                progressEl.style.color = '#4ade80';
            } else {
                progressEl.textContent = `${currentCount} of ${totalBooks} (${Math.abs(remaining)} over limit)`;
                progressEl.style.color = '#ff6b6b';
            }
        } else {
            progressEl.textContent = `${currentCount} book${currentCount !== 1 ? 's' : ''} in collection`;
            progressEl.style.color = '#888888';
        }
    }

    /**
     * Update the template preview
     */
    function updateTemplatePreview(template, seriesKey) {
        const preview = document.getElementById('template-preview');
        if (!template) {
            preview.textContent = 'No template set';
            preview.style.color = '#666666';
            return;
        }

        // Extract the pattern and find next number
        const nextNum = getNextNumberForSeries(seriesKey, template);
        const parsed = parseTemplate(template);
        if (parsed) {
            preview.textContent = `Next: "${parsed.prefix}${nextNum}"`;
            preview.style.color = '#4ade80';
        } else {
            preview.textContent = 'Invalid template (must end with a number)';
            preview.style.color = '#ff6b6b';
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
     * Get the next available number for a series based on template
     */
    function getNextNumberForSeries(seriesKey, template) {
        const parsed = parseTemplate(template);
        if (!parsed) return 1;

        const prefix = parsed.prefix.toLowerCase();
        const seriesBooks = allBooksCache.filter(b => b.series === seriesKey);

        // Find all numbers used with this prefix
        const usedNumbers = [];
        seriesBooks.forEach(book => {
            const title = (book.title || '').toLowerCase();
            if (title.startsWith(prefix)) {
                const remainder = book.title.substring(parsed.prefix.length);
                const num = parseInt(remainder, 10);
                if (!isNaN(num)) {
                    usedNumbers.push(num);
                }
            }
        });

        // Find the next available number
        if (usedNumbers.length === 0) return 1;
        const maxNum = Math.max(...usedNumbers);

        // Check for gaps
        for (let i = 1; i <= maxNum; i++) {
            if (!usedNumbers.includes(i)) return i;
        }

        return maxNum + 1;
    }

    /**
     * Save series settings
     */
    window.saveSeriesSettings = async function() {
        const modal = document.getElementById('series-settings-modal');
        const seriesKey = modal.dataset.series;
        const autoSort = document.getElementById('series-auto-sort').checked;
        const namingTemplate = document.getElementById('series-naming-template').value.trim();
        const isFinished = document.getElementById('status-finished-btn').classList.contains('active');
        const totalBooksValue = document.getElementById('series-total-books').value;
        const totalBooks = isFinished && totalBooksValue ? parseInt(totalBooksValue, 10) : null;

        // Validate template if provided
        if (namingTemplate && !parseTemplate(namingTemplate)) {
            alert('Invalid template. It must end with a number (e.g., "Attack on Titan Vol. 1")');
            return;
        }

        // Validate total books if finished
        if (isFinished && totalBooks && totalBooks < 1) {
            alert('Total books must be at least 1.');
            return;
        }

        seriesSettings[seriesKey] = {
            autoSort: autoSort,
            namingTemplate: namingTemplate || null,
            status: isFinished ? 'finished' : 'ongoing',
            totalBooks: totalBooks
        };

        // Save to Firestore
        if (currentUserId) {
            try {
                await db.collection('users').doc(currentUserId).set(
                    { seriesSettings: seriesSettings },
                    { merge: true }
                );
            } catch (error) {
                console.error('Error saving series settings:', error);
                alert('Failed to save settings. Please try again.');
                return;
            }
        }

        closeSeriesSettingsModal();

        // Re-render to apply new sort settings
        if (allBooksCache.length > 0) {
            renderGroupedBooks(allBooksCache);
            syncSeriesTotals(allBooksCache);
        }
    };

    /**
     * Close series settings modal
     */
    window.closeSeriesSettingsModal = function() {
        const modal = document.getElementById('series-settings-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    };

    /**
     * Mark all books in a series as read
     */
    window.markSeriesAsRead = async function() {
        const modal = document.getElementById('series-settings-modal');
        const seriesKey = modal.dataset.series;

        if (!currentUserId || !seriesKey) return;

        const btn = document.getElementById('mark-all-read-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="action-icon">&#8987;</span> Marking...';

        try {
            const seriesBooks = allBooksCache.filter(b => b.series === seriesKey && !b.read);
            const batch = db.batch();

            seriesBooks.forEach(book => {
                const bookRef = db.collection('users').doc(currentUserId).collection('books').doc(book.id);
                batch.update(bookRef, {
                    read: true,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch.commit();
            btn.innerHTML = '<span class="action-icon">&#10003;</span> Done!';

            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = '<span class="action-icon">&#10003;</span> Mark all as read';
            }, 1500);
        } catch (error) {
            console.error('Error marking series as read:', error);
            alert('Failed to mark books as read. Please try again.');
            btn.disabled = false;
            btn.innerHTML = '<span class="action-icon">&#10003;</span> Mark all as read';
        }
    };

    /**
     * Mark all books in a series as unread
     */
    window.markSeriesAsUnread = async function() {
        const modal = document.getElementById('series-settings-modal');
        const seriesKey = modal.dataset.series;

        if (!currentUserId || !seriesKey) return;

        const btn = document.getElementById('mark-all-unread-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="action-icon">&#8987;</span> Marking...';

        try {
            const seriesBooks = allBooksCache.filter(b => b.series === seriesKey && b.read);
            const batch = db.batch();

            seriesBooks.forEach(book => {
                const bookRef = db.collection('users').doc(currentUserId).collection('books').doc(book.id);
                batch.update(bookRef, {
                    read: false,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch.commit();
            btn.innerHTML = '<span class="action-icon">&#9675;</span> Done!';

            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = '<span class="action-icon">&#9675;</span> Mark all as unread';
            }, 1500);
        } catch (error) {
            console.error('Error marking series as unread:', error);
            alert('Failed to mark books as unread. Please try again.');
            btn.disabled = false;
            btn.innerHTML = '<span class="action-icon">&#9675;</span> Mark all as unread';
        }
    };

    /**
     * Apply tags to all books in a series
     */
    window.applyTagsToSeries = async function() {
        const modal = document.getElementById('series-settings-modal');
        const seriesKey = modal.dataset.series;
        const btn = document.querySelector('.settings-apply-tags-btn');

        // Get selected genres
        const selectedGenres = Array.from(document.querySelectorAll('input[name="series-genre"]:checked'))
            .map(cb => cb.value);

        if (selectedGenres.length === 0) {
            alert('Please select at least one tag to apply.');
            return;
        }

        if (selectedGenres.length > 3) {
            alert('Please select no more than 3 tags.');
            return;
        }

        // Get all books in this series
        const seriesBooks = allBooksCache.filter(b => b.series === seriesKey);

        if (seriesBooks.length === 0) {
            alert('No books found in this series.');
            return;
        }

        const confirmMsg = `Apply ${selectedGenres.join(', ')} to ${seriesBooks.length} book${seriesBooks.length !== 1 ? 's' : ''} in "${seriesKey}"?\n\nThis will replace existing tags on all books.`;
        if (!confirm(confirmMsg)) {
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="action-icon">&#8987;</span> Applying...';

        try {
            const batch = db.batch();

            seriesBooks.forEach(book => {
                const bookRef = db.collection('users').doc(currentUserId).collection('books').doc(book.id);
                batch.update(bookRef, { genres: selectedGenres });
            });

            await batch.commit();

            // Update local cache
            seriesBooks.forEach(book => {
                book.genres = [...selectedGenres];
            });

            // Re-render
            renderGroupedBooks(allBooksCache);

            alert(`Tags applied to ${seriesBooks.length} book${seriesBooks.length !== 1 ? 's' : ''} successfully!`);
        } catch (error) {
            console.error('Error applying tags to series:', error);
            alert('Failed to apply tags. Please try again.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="action-icon">&#9998;</span> Apply tags to all books';
        }
    };

    // Setup template preview update on input
    document.getElementById('series-naming-template')?.addEventListener('input', function() {
        const modal = document.getElementById('series-settings-modal');
        const seriesKey = modal.dataset.series;
        updateTemplatePreview(this.value, seriesKey);
    });

    // Setup total books progress update on input
    document.getElementById('series-total-books')?.addEventListener('input', function() {
        const modal = document.getElementById('series-settings-modal');
        const seriesKey = modal.dataset.series;
        updateSeriesProgress(seriesKey);
    });

    /**
     * Natural sort comparison - handles numbers within strings correctly
     * e.g., "Book 2" comes before "Book 10"
     */
    function naturalCompare(a, b) {
        const aParts = a.split(/(\d+)/);
        const bParts = b.split(/(\d+)/);

        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aPart = aParts[i] || '';
            const bPart = bParts[i] || '';

            // Check if both parts are numeric
            const aNum = parseInt(aPart, 10);
            const bNum = parseInt(bPart, 10);

            if (!isNaN(aNum) && !isNaN(bNum)) {
                // Compare as numbers
                if (aNum !== bNum) {
                    return aNum - bNum;
                }
            } else {
                // Compare as strings
                const cmp = aPart.localeCompare(bPart);
                if (cmp !== 0) {
                    return cmp;
                }
            }
        }
        return 0;
    }

    /**
     * Sort books alphabetically by title within a section
     */
    window.sortSectionAlphabetically = async function(seriesKey) {
        const section = document.querySelector(`.collection-section[data-series="${CSS.escape(seriesKey)}"]`);
        if (!section) return;

        const grid = section.querySelector('.section-grid');
        const bookCards = [...grid.querySelectorAll('.book-card')];

        // Sort by title using natural sort
        bookCards.sort((a, b) => {
            const titleA = a.querySelector('.book-title').textContent.toLowerCase();
            const titleB = b.querySelector('.book-title').textContent.toLowerCase();
            return naturalCompare(titleA, titleB);
        });

        // Reorder in DOM
        bookCards.forEach(card => grid.appendChild(card));

        // Save new order
        const newOrder = bookCards.map(card => card.dataset.id);
        await saveBookOrder(currentUserId, seriesKey, newOrder);
    };

    /**
     * Load books from Firestore for the current user
     */
    function loadBooks(userId) {
        db.collection('users').doc(userId).collection('books')
            .orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                const books = [];
                snapshot.forEach((doc) => {
                    books.push({ id: doc.id, ...doc.data() });
                });
                allBooksCache = books; // Cache for edit modal
                renderGroupedBooks(books);
                syncSeriesTotals(books);
            }, (error) => {
                console.error('Error loading books:', error);
            });
    }

    /**
     * Copy each series' total (when finished) and naming template onto its
     * books as `seriesTotal` / `seriesNamingTemplate`. User docs are private,
     * but books are public, so this is how the Collectors page can show
     * "30/34 books" and "next to get" titles for other users' series.
     */
    async function syncSeriesTotals(books) {
        if (!currentUserId) return;

        const updates = [];
        books.forEach(book => {
            const settings = (book.series && seriesSettings[book.series]) || {};
            const expected = {
                seriesTotal: settings.status === 'finished' && settings.totalBooks ? settings.totalBooks : null,
                seriesNamingTemplate: settings.namingTemplate || null
            };
            if ((book.seriesTotal ?? null) !== expected.seriesTotal ||
                (book.seriesNamingTemplate ?? null) !== expected.seriesNamingTemplate) {
                updates.push({ id: book.id, data: expected });
            }
        });

        try {
            // Firestore batches are limited to 500 writes
            for (let i = 0; i < updates.length; i += 500) {
                const batch = db.batch();
                updates.slice(i, i + 500).forEach(({ id, data }) => {
                    const ref = db.collection('users').doc(currentUserId).collection('books').doc(id);
                    batch.update(ref, data);
                });
                await batch.commit();
            }
        } catch (error) {
            console.error('Error syncing series totals:', error);
        }
    }

    /**
     * Group books by series and render sections
     */
    function renderGroupedBooks(books) {
        bookCount.textContent = `${books.length} book${books.length !== 1 ? 's' : ''}`;

        if (books.length === 0) {
            collectionsContainer.style.display = 'none';
            emptyState.style.display = 'block';
            seriesCount.textContent = '0 series';
            return;
        }

        collectionsContainer.style.display = 'block';
        emptyState.style.display = 'none';

        // Separate unread books
        const unreadBooks = books.filter(book => !book.read);

        // Group books by series
        const groups = {};
        const UNCATEGORIZED = '__uncategorized__';
        const UNREAD = '__unread__';

        books.forEach(book => {
            const key = book.series || UNCATEGORIZED;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(book);
        });

        // Count actual series (excluding uncategorized)
        const actualSeriesCount = Object.keys(groups).filter(key => key !== UNCATEGORIZED).length;
        seriesCount.textContent = `${actualSeriesCount} series`;

        // Get all series names (excluding special sections)
        const allSeries = Object.keys(groups);

        // Sort series based on saved order, with new series at the end
        const sortedSeries = [];

        // First, add series in saved order
        sectionOrder.forEach(series => {
            if (allSeries.includes(series)) {
                sortedSeries.push(series);
            }
        });

        // Then add any new series not in saved order
        allSeries.forEach(series => {
            if (!sortedSeries.includes(series)) {
                sortedSeries.push(series);
            }
        });

        // Update section order with current series
        sectionOrder = sortedSeries;

        // Build HTML - Unread section first (if there are unread books)
        let html = '';

        if (unreadBooks.length > 0) {
            const isUnreadCollapsed = collapsedSections.includes(UNREAD);
            html += `
                <div class="collection-section unread-section ${isUnreadCollapsed ? 'collapsed' : ''}" data-series="${UNREAD}">
                    <div class="section-header">
                        <button class="collapse-btn ${isUnreadCollapsed ? 'is-hidden' : ''}" onclick="toggleSectionCollapse('${UNREAD}')" title="${isUnreadCollapsed ? 'Show' : 'Hide'} books">
                            <span class="eye-icon"></span>
                        </button>
                        <div class="section-icon">&#128214;</div>
                        <h2 class="section-title">Unread</h2>
                        <span class="section-count">${unreadBooks.length} book${unreadBooks.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="section-grid">
                        ${unreadBooks.map(book => renderBookCard(book)).join('')}
                    </div>
                </div>
            `;
        }

        // Render series sections
        html += sortedSeries.map(series => {
            let seriesBooks = groups[series];
            const displayName = series === UNCATEGORIZED ? 'Uncategorized' : series;
            const addBookUrl = series === UNCATEGORIZED
                ? 'register.html'
                : `register.html?series=${encodeURIComponent(series)}`;

            // Get series settings
            const settings = seriesSettings[series] || {};
            const autoSort = settings.autoSort !== false; // Default to true

            // Check if series is at book limit
            const isFinished = settings.status === 'finished';
            const totalBooks = settings.totalBooks;
            const isAtLimit = isFinished && totalBooks && seriesBooks.length >= totalBooks;

            // Sort books A-Z if autoSort is enabled
            if (autoSort) {
                seriesBooks = [...seriesBooks].sort((a, b) => {
                    const titleA = (a.title || '').toLowerCase();
                    const titleB = (b.title || '').toLowerCase();
                    return naturalCompare(titleA, titleB);
                });
            }

            const isCollapsed = collapsedSections.includes(series);
            const showSettingsBtn = series !== UNCATEGORIZED;
            const allRead = seriesBooks.length > 0 && seriesBooks.every(book => book.read === true);

            // Determine completion status
            // Finished! (gold) - Own all books AND read all
            // Owned! (green) - Own all books but haven't read all
            // Caught up! (orange) - Don't own all but read everything you own
            let completionBadge = '';
            let sectionClass = '';
            if (isAtLimit && allRead) {
                completionBadge = '<span class="series-badge badge-finished" title="Series complete and fully read">&#9733; Finished!</span>';
                sectionClass = 'series-finished';
            } else if (isAtLimit && !allRead) {
                completionBadge = '<span class="series-badge badge-owned" title="All books in series owned">&#10003; Owned!</span>';
                sectionClass = 'series-owned';
            } else if (!isAtLimit && allRead && seriesBooks.length > 0) {
                completionBadge = '<span class="series-badge badge-caught-up" title="All owned books read">&#10003; Caught up!</span>';
                sectionClass = 'series-caught-up';
            }

            // Progress bar for finished series (not yet fully owned)
            let progressBar = '';
            if (isFinished && totalBooks && !isAtLimit) {
                const ownedCount = seriesBooks.length;
                const percentage = Math.round((ownedCount / totalBooks) * 100);
                progressBar = `
                    <div class="series-progress-bar">
                        <div class="progress-track">
                            <div class="progress-fill" style="width: ${percentage}%"></div>
                        </div>
                        <span class="progress-text">${ownedCount}/${totalBooks}<span class="progress-owned-label"> owned</span> (${percentage}%)</span>
                    </div>
                `;
            }

            return `
                <div class="collection-section ${isCollapsed ? 'collapsed' : ''} ${sectionClass}" data-series="${escapeAttr(series)}" draggable="true">
                    <div class="section-header">
                        <button class="collapse-btn ${isCollapsed ? 'is-hidden' : ''}" onclick="toggleSectionCollapse('${escapeJs(series)}')" title="${isCollapsed ? 'Show' : 'Hide'} books">
                            <span class="eye-icon"></span>
                        </button>
                        <div class="drag-handle" title="Drag to reorder">&#9776;</div>
                        <h2 class="section-title">${escapeHtml(displayName)}</h2>
                        ${completionBadge}
                        <span class="section-count">${seriesBooks.length} book${seriesBooks.length !== 1 ? 's' : ''}</span>
                        ${showSettingsBtn ? `<button class="series-settings-btn" onclick="openSeriesSettings('${escapeJs(series)}')" title="Series settings">&#9881;</button>` : ''}
                        <button class="sort-az-btn" onclick="sortSectionAlphabetically('${escapeJs(series)}')" title="Sort alphabetically">A-Z</button>
                        ${isAtLimit
                            ? `<button class="section-add-btn disabled" onclick="showSeriesLimitAlert('${escapeJs(series)}', ${totalBooks})" title="Series complete (${totalBooks}/${totalBooks})">Complete</button>`
                            : `<a href="${addBookUrl}" class="section-add-btn" title="Add book to ${escapeAttr(displayName)}">+ Add</a>`
                        }
                    </div>
                    ${progressBar}
                    <div class="section-grid" data-series="${escapeAttr(series)}">
                        ${seriesBooks.map(book => renderBookCard(book, series)).join('')}
                    </div>
                </div>
            `;
        }).join('');

        collectionsContainer.innerHTML = html;

        // Setup drag and drop for sections and books
        setupDragAndDrop();
        setupBookDragAndDrop();
    }

    /**
     * Render a single book card
     */
    function renderBookCard(book, seriesKey) {
        const isRead = book.read === true;
        const ownerId = book.ownerId || currentUserId;
        const safeTitle = escapeAttr(book.title).replace(/'/g, "\\'");
        const isDraggable = seriesKey ? 'draggable="true"' : '';

        // Handle both new genres array and legacy genre string
        const genres = book.genres || (book.genre ? [book.genre] : []);
        const genreTags = genres.map(g => `<span class="book-genre-tag">${escapeHtml(g)}</span>`).join('');

        return `
            <div class="book-card ${isRead ? 'read' : 'unread'}" data-id="${book.id}" ${isDraggable}>
                <div class="book-photo">
                    ${book.photoUrl
                        ? `<img src="${book.photoUrl}" alt="${escapeAttr(book.title)}">`
                        : `<div class="no-photo">No Photo</div>`
                    }
                </div>
                <div class="book-info">
                    <h3 class="book-title">${escapeHtml(book.title)}</h3>
                    <p class="book-author">${escapeHtml(book.author)}</p>
                    ${genreTags ? `<div class="book-genres">${genreTags}</div>` : ''}
                    <p class="book-date">${formatDate(book.dateAcquired)}</p>
                </div>
                <button class="comments-btn" onclick="openCommentsModal('${book.id}', '${ownerId}', '${safeTitle}')" title="View comments">
                    &#128172;
                </button>
                <div class="book-actions">
                    <button class="read-toggle-btn ${isRead ? 'is-read' : ''}"
                            onclick="toggleReadStatus('${book.id}', ${!isRead})"
                            title="${isRead ? 'Mark as unread' : 'Mark as read'}">
                        ${isRead ? '&#10003;' : '&#9675;'}
                    </button>
                    <button class="edit-btn" onclick="openEditModal('${book.id}')" title="Edit book">
                        &#9998;
                    </button>
                    <button class="delete-btn" onclick="deleteBook('${book.id}')" title="Delete book">
                        &times;
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Setup drag and drop for section reordering
     */
    function setupDragAndDrop() {
        const sections = document.querySelectorAll('.collection-section[draggable="true"]');

        sections.forEach(section => {
            section.addEventListener('dragstart', handleDragStart);
            section.addEventListener('dragend', handleDragEnd);
            section.addEventListener('dragover', handleDragOver);
            section.addEventListener('dragenter', handleDragEnter);
            section.addEventListener('dragleave', handleDragLeave);
            section.addEventListener('drop', handleDrop);
        });
    }

    function handleDragStart(e) {
        draggedSection = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.series);
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        document.querySelectorAll('.collection-section').forEach(section => {
            section.classList.remove('drag-over');
        });
        draggedSection = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(e) {
        e.preventDefault();
        if (this !== draggedSection && this.getAttribute('draggable') === 'true') {
            this.classList.add('drag-over');
        }
    }

    function handleDragLeave(e) {
        this.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        this.classList.remove('drag-over');

        if (draggedSection && this !== draggedSection) {
            const allSections = [...document.querySelectorAll('.collection-section[draggable="true"]')];
            const draggedIndex = allSections.indexOf(draggedSection);
            const targetIndex = allSections.indexOf(this);

            if (draggedIndex < targetIndex) {
                this.parentNode.insertBefore(draggedSection, this.nextSibling);
            } else {
                this.parentNode.insertBefore(draggedSection, this);
            }

            // Update and save the new order
            const newOrder = [...document.querySelectorAll('.collection-section[draggable="true"]')]
                .map(section => section.dataset.series);

            sectionOrder = newOrder;
            saveSectionOrder(currentUserId, newOrder);
        }
    }

    /**
     * Setup drag and drop for book reordering within sections
     */
    function setupBookDragAndDrop() {
        const bookCards = document.querySelectorAll('.book-card[draggable="true"]');

        bookCards.forEach(card => {
            card.addEventListener('dragstart', handleBookDragStart);
            card.addEventListener('dragend', handleBookDragEnd);
            card.addEventListener('dragover', handleBookDragOver);
            card.addEventListener('dragenter', handleBookDragEnter);
            card.addEventListener('dragleave', handleBookDragLeave);
            card.addEventListener('drop', handleBookDrop);
        });
    }

    function handleBookDragStart(e) {
        // Prevent section drag when dragging a book
        e.stopPropagation();
        draggedBook = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.id);
    }

    function handleBookDragEnd(e) {
        this.classList.remove('dragging');
        document.querySelectorAll('.book-card').forEach(card => {
            card.classList.remove('drag-over');
        });
        draggedBook = null;
    }

    function handleBookDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleBookDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        if (this !== draggedBook && draggedBook) {
            // Only allow dropping in the same section
            const draggedGrid = draggedBook.closest('.section-grid');
            const targetGrid = this.closest('.section-grid');
            if (draggedGrid === targetGrid) {
                this.classList.add('drag-over');
            }
        }
    }

    function handleBookDragLeave(e) {
        this.classList.remove('drag-over');
    }

    function handleBookDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('drag-over');

        if (draggedBook && this !== draggedBook) {
            const grid = this.closest('.section-grid');
            const draggedGrid = draggedBook.closest('.section-grid');

            // Only allow reordering within the same section
            if (grid !== draggedGrid) return;

            const allCards = [...grid.querySelectorAll('.book-card')];
            const draggedIndex = allCards.indexOf(draggedBook);
            const targetIndex = allCards.indexOf(this);

            if (draggedIndex < targetIndex) {
                grid.insertBefore(draggedBook, this.nextSibling);
            } else {
                grid.insertBefore(draggedBook, this);
            }

            // Save the new order
            const seriesKey = grid.dataset.series;
            const newOrder = [...grid.querySelectorAll('.book-card')].map(card => card.dataset.id);
            saveBookOrder(currentUserId, seriesKey, newOrder);
        }
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

    /**
     * Escape attribute value
     */
    function escapeAttr(text) {
        if (!text) return '';
        return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /**
     * Escape string for use in JavaScript onclick handlers
     */
    function escapeJs(text) {
        if (!text) return '';
        return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
    }
});

/**
 * Toggle read status of a book
 */
async function toggleReadStatus(bookId, read) {
    const user = getCurrentUser();
    if (!user) return;

    try {
        await db.collection('users').doc(user.uid).collection('books').doc(bookId).update({
            read: read,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating read status:', error);
        alert('Failed to update read status. Please try again.');
    }
}

/**
 * Delete a book from the collection
 */
async function deleteBook(bookId) {
    if (!confirm('Are you sure you want to delete this book?')) {
        return;
    }

    const user = getCurrentUser();
    if (!user) return;

    try {
        await db.collection('users').doc(user.uid).collection('books').doc(bookId).delete();
    } catch (error) {
        console.error('Error deleting book:', error);
        alert('Failed to delete book. Please try again.');
    }
}
