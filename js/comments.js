// Shared comments functionality
let currentCommentBookId = null;
let currentCommentOwnerId = null;
let commentsUnsubscribe = null;

/**
 * Initialize comments modal functionality
 */
function initComments() {
    const commentsModal = document.getElementById('comments-modal');
    const commentsClose = document.getElementById('comments-close');
    const commentForm = document.getElementById('comment-form');
    const spoilerToggle = document.getElementById('spoiler-toggle');

    if (!commentsModal) return;

    // Close modal handlers
    commentsClose.addEventListener('click', closeCommentsModal);
    commentsModal.addEventListener('click', function(e) {
        if (e.target === commentsModal) {
            closeCommentsModal();
        }
    });

    // Spoiler toggle visual feedback
    spoilerToggle.addEventListener('change', function() {
        const label = document.querySelector('.spoiler-label');
        if (this.checked) {
            label.classList.add('active');
        } else {
            label.classList.remove('active');
        }
    });

    // Comment form submission
    commentForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const user = getCurrentUser();
        if (!user) {
            alert('You must be signed in to comment.');
            return;
        }

        const commentText = document.getElementById('comment-text').value.trim();
        const isSpoiler = spoilerToggle.checked;

        if (!commentText) return;

        const submitBtn = document.getElementById('submit-comment');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        try {
            // Get username
            const userDoc = await db.collection('users').doc(user.uid).get();
            const username = (userDoc.exists && userDoc.data().username) ? userDoc.data().username : 'Anonymous';

            await db.collection('users')
                .doc(currentCommentOwnerId)
                .collection('books')
                .doc(currentCommentBookId)
                .collection('comments')
                .add({
                    text: commentText,
                    authorId: user.uid,
                    authorUsername: username,
                    isSpoiler: isSpoiler,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

            // Clear form
            document.getElementById('comment-text').value = '';
            spoilerToggle.checked = false;
            document.querySelector('.spoiler-label').classList.remove('active');

        } catch (error) {
            console.error('Error posting comment:', error);
            if (error.code === 'permission-denied') {
                alert('Permission denied. Please make sure Firestore rules are updated to allow comments.');
            } else {
                alert('Failed to post comment: ' + error.message);
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post Comment';
        }
    });
}

/**
 * Open comments modal for a book
 */
function openCommentsModal(bookId, ownerId, bookTitle) {
    const commentsModal = document.getElementById('comments-modal');
    const modalTitle = document.getElementById('comments-book-title');
    const commentsList = document.getElementById('comments-list');
    const commentForm = document.getElementById('comment-form');

    currentCommentBookId = bookId;
    currentCommentOwnerId = ownerId;

    modalTitle.textContent = bookTitle;
    commentsList.innerHTML = '<div class="comments-loading">Loading comments...</div>';

    // Check if user is logged in
    const user = getCurrentUser();
    if (user) {
        commentForm.style.display = 'block';
    } else {
        commentForm.style.display = 'none';
    }

    // Show modal
    commentsModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Load comments with real-time updates
    loadComments(ownerId, bookId);
}

/**
 * Close comments modal
 */
function closeCommentsModal() {
    const commentsModal = document.getElementById('comments-modal');
    commentsModal.classList.remove('active');
    document.body.style.overflow = '';

    // Unsubscribe from real-time updates
    if (commentsUnsubscribe) {
        commentsUnsubscribe();
        commentsUnsubscribe = null;
    }

    currentCommentBookId = null;
    currentCommentOwnerId = null;
}

/**
 * Load comments for a book with real-time updates
 */
function loadComments(ownerId, bookId) {
    const commentsList = document.getElementById('comments-list');

    // Unsubscribe from previous listener if any
    if (commentsUnsubscribe) {
        commentsUnsubscribe();
    }

    commentsUnsubscribe = db.collection('users')
        .doc(ownerId)
        .collection('books')
        .doc(bookId)
        .collection('comments')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                commentsList.innerHTML = '<div class="no-comments">No comments yet. Be the first to comment!</div>';
                return;
            }

            const currentUser = getCurrentUser();
            let html = '';

            snapshot.forEach((doc) => {
                const comment = { id: doc.id, ...doc.data() };
                html += renderComment(comment, currentUser);
            });

            commentsList.innerHTML = html;

            // Add click handlers for spoiler reveals
            setupSpoilerClicks();

        }, (error) => {
            console.error('Error loading comments:', error);
            commentsList.innerHTML = '<div class="comments-error">Failed to load comments.</div>';
        });
}

/**
 * Render a single comment
 */
function renderComment(comment, currentUser) {
    const canDelete = currentUser && currentUser.uid === comment.authorId;
    const timeAgo = formatTimeAgo(comment.createdAt);

    if (comment.isSpoiler) {
        return `
            <div class="comment spoiler-comment" data-id="${comment.id}">
                <div class="comment-header">
                    <span class="comment-author">${escapeHtmlComment(comment.authorUsername)}</span>
                    <span class="comment-time">${timeAgo}</span>
                    ${canDelete ? `<button class="comment-delete" onclick="deleteComment('${comment.id}')" title="Delete comment">&times;</button>` : ''}
                </div>
                <div class="comment-content spoiler" onclick="revealSpoiler(this)">
                    <span class="spoiler-warning">Spoiler - Click to reveal</span>
                    <span class="spoiler-text">${escapeHtmlComment(comment.text)}</span>
                </div>
            </div>
        `;
    }

    return `
        <div class="comment" data-id="${comment.id}">
            <div class="comment-header">
                <span class="comment-author">${escapeHtmlComment(comment.authorUsername)}</span>
                <span class="comment-time">${timeAgo}</span>
                ${canDelete ? `<button class="comment-delete" onclick="deleteComment('${comment.id}')" title="Delete comment">&times;</button>` : ''}
            </div>
            <div class="comment-content">
                ${escapeHtmlComment(comment.text)}
            </div>
        </div>
    `;
}

/**
 * Reveal spoiler text
 */
function revealSpoiler(element) {
    element.classList.add('revealed');
}

/**
 * Setup click handlers for spoiler reveals
 */
function setupSpoilerClicks() {
    // Already handled via onclick in the HTML
}

/**
 * Delete a comment
 */
async function deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) {
        return;
    }

    const user = getCurrentUser();
    if (!user) return;

    try {
        await db.collection('users')
            .doc(currentCommentOwnerId)
            .collection('books')
            .doc(currentCommentBookId)
            .collection('comments')
            .doc(commentId)
            .delete();
    } catch (error) {
        console.error('Error deleting comment:', error);
        alert('Failed to delete comment. Please try again.');
    }
}

/**
 * Format timestamp as relative time
 */
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';

    const now = new Date();
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

/**
 * Escape HTML to prevent XSS (separate function to avoid conflicts)
 */
function escapeHtmlComment(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initComments);
