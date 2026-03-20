document.addEventListener('DOMContentLoaded', function() {
    const photoInput = document.getElementById('book-photo');
    const photoPreview = document.getElementById('photo-preview');
    const previewImage = document.getElementById('preview-image');
    const placeholder = document.querySelector('.photo-placeholder');
    const bookForm = document.getElementById('book-form');
    const seriesInput = document.getElementById('book-series');

    let photoBase64 = null;

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

        try {
            // Get the user's username
            const userDoc = await db.collection('users').doc(user.uid).get();
            const username = userDoc.exists ? userDoc.data().username : 'Unknown';

            const bookData = {
                title: document.getElementById('book-title').value.trim(),
                author: document.getElementById('book-author').value.trim(),
                dateAcquired: document.getElementById('book-date').value,
                genre: document.getElementById('book-genre').value,
                series: document.getElementById('book-series').value.trim() || null,
                photoUrl: photoBase64 || null,
                ownerId: user.uid,
                ownerUsername: username,
                read: false,
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
