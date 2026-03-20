// Collection page logic
document.addEventListener('DOMContentLoaded', function() {
    const collectionsContainer = document.getElementById('collections-container');
    const emptyState = document.getElementById('empty-state');
    const bookCount = document.getElementById('book-count');

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
    let draggedSection = null;
    let editPhotoBase64 = null;
    let currentEditBookId = null;
    let allBooksCache = []; // Cache for finding book data

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

        const saveBtn = document.getElementById('save-edit');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const updatedData = {
            title: document.getElementById('edit-book-title').value.trim(),
            author: document.getElementById('edit-book-author').value.trim(),
            dateAcquired: document.getElementById('edit-book-date').value,
            genre: document.getElementById('edit-book-genre').value,
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
        document.getElementById('edit-book-genre').value = book.genre || '';
        document.getElementById('edit-book-series').value = book.series || '';

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
     * Load section order preference from Firestore
     */
    async function loadSectionOrder(userId) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists && doc.data().sectionOrder) {
                sectionOrder = doc.data().sectionOrder;
            }
        } catch (error) {
            console.error('Error loading section order:', error);
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
            }, (error) => {
                console.error('Error loading books:', error);
            });
    }

    /**
     * Group books by series and render sections
     */
    function renderGroupedBooks(books) {
        bookCount.textContent = `${books.length} book${books.length !== 1 ? 's' : ''}`;

        if (books.length === 0) {
            collectionsContainer.style.display = 'none';
            emptyState.style.display = 'block';
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
            html += `
                <div class="collection-section unread-section" data-series="${UNREAD}">
                    <div class="section-header">
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
            const seriesBooks = groups[series];
            const displayName = series === UNCATEGORIZED ? 'Uncategorized' : series;
            const addBookUrl = series === UNCATEGORIZED
                ? 'register.html'
                : `register.html?series=${encodeURIComponent(series)}`;

            return `
                <div class="collection-section" data-series="${escapeAttr(series)}" draggable="true">
                    <div class="section-header">
                        <div class="drag-handle" title="Drag to reorder">&#9776;</div>
                        <h2 class="section-title">${escapeHtml(displayName)}</h2>
                        <span class="section-count">${seriesBooks.length} book${seriesBooks.length !== 1 ? 's' : ''}</span>
                        <a href="${addBookUrl}" class="section-add-btn" title="Add book to ${escapeAttr(displayName)}">+ Add</a>
                    </div>
                    <div class="section-grid">
                        ${seriesBooks.map(book => renderBookCard(book)).join('')}
                    </div>
                </div>
            `;
        }).join('');

        collectionsContainer.innerHTML = html;

        // Setup drag and drop
        setupDragAndDrop();
    }

    /**
     * Render a single book card
     */
    function renderBookCard(book) {
        const isRead = book.read === true;
        const ownerId = book.ownerId || currentUserId;
        const safeTitle = escapeAttr(book.title).replace(/'/g, "\\'");
        return `
            <div class="book-card ${isRead ? 'read' : 'unread'}" data-id="${book.id}">
                <div class="book-photo">
                    ${book.photoUrl
                        ? `<img src="${book.photoUrl}" alt="${escapeAttr(book.title)}">`
                        : `<div class="no-photo">No Photo</div>`
                    }
                </div>
                <div class="book-info">
                    <h3 class="book-title">${escapeHtml(book.title)}</h3>
                    <p class="book-author">${escapeHtml(book.author)}</p>
                    ${book.genre ? `<span class="book-genre-tag">${escapeHtml(book.genre)}</span>` : ''}
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
