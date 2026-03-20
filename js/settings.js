// Settings page logic
document.addEventListener('DOMContentLoaded', function() {
    const settingsForm = document.getElementById('settings-form');
    const usernameInput = document.getElementById('username');
    const photoInput = document.getElementById('profile-photo');
    const photoPreview = document.getElementById('profile-photo-preview');
    const previewImage = document.getElementById('preview-image');
    const photoPlaceholder = document.getElementById('photo-placeholder');
    const avatarInitial = document.getElementById('avatar-initial');
    const removePhotoBtn = document.getElementById('remove-photo');
    const bioInput = document.getElementById('bio');
    const bioCount = document.getElementById('bio-count');
    const favoriteGenre = document.getElementById('favorite-genre');
    const saveBtn = document.getElementById('save-btn');
    const successMessage = document.getElementById('success-message');

    let profilePhotoBase64 = null;
    let removePhoto = false;
    let currentUsername = '';
    let originalUsername = '';

    // Load settings when auth state is confirmed
    onAuthStateChange((user) => {
        if (user) {
            loadSettings(user.uid);
        }
    });

    // Photo upload click handler
    photoPreview.addEventListener('click', function() {
        photoInput.click();
    });

    // Photo file selection
    photoInput.addEventListener('change', async function(event) {
        const file = event.target.files[0];
        if (file) {
            try {
                profilePhotoBase64 = await compressImage(file, 300, 0.8);
                previewImage.src = profilePhotoBase64;
                previewImage.style.display = 'block';
                photoPlaceholder.style.display = 'none';
                removePhotoBtn.style.display = 'block';
                removePhoto = false;
            } catch (error) {
                console.error('Error processing image:', error);
                alert('Failed to process image. Please try a different photo.');
            }
        }
    });

    // Remove photo button
    removePhotoBtn.addEventListener('click', function(e) {
        e.preventDefault();
        profilePhotoBase64 = null;
        removePhoto = true;
        previewImage.src = '';
        previewImage.style.display = 'none';
        photoPlaceholder.style.display = 'flex';
        removePhotoBtn.style.display = 'none';
        photoInput.value = '';
    });

    // Bio character count
    bioInput.addEventListener('input', function() {
        bioCount.textContent = bioInput.value.length;
    });

    // Form submission
    settingsForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const user = getCurrentUser();
        if (!user) return;

        const newUsername = usernameInput.value.trim();

        // Validate username
        if (newUsername.length < 3) {
            alert('Username must be at least 3 characters.');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        successMessage.style.display = 'none';

        try {
            // Check if username changed and is available
            const usernameChanged = newUsername.toLowerCase() !== originalUsername.toLowerCase();

            if (usernameChanged && newUsername) {
                const usernameDoc = await db.collection('usernames').doc(newUsername.toLowerCase()).get();
                if (usernameDoc.exists) {
                    alert('This username is already taken. Please choose another.');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Changes';
                    return;
                }
            }

            const updateData = {
                username: newUsername,
                bio: bioInput.value.trim(),
                favoriteGenre: favoriteGenre.value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Handle photo update
            if (profilePhotoBase64) {
                updateData.profilePhoto = profilePhotoBase64;
            } else if (removePhoto) {
                updateData.profilePhoto = null;
            }

            // Update user document
            await db.collection('users').doc(user.uid).set(updateData, { merge: true });

            // Update username reservation if changed
            if (usernameChanged) {
                // Remove old username reservation
                if (originalUsername) {
                    await db.collection('usernames').doc(originalUsername.toLowerCase()).delete();
                }
                // Add new username reservation
                await db.collection('usernames').doc(newUsername.toLowerCase()).set({
                    userId: user.uid
                });
                originalUsername = newUsername;
            }

            // Update avatar initial
            avatarInitial.textContent = newUsername.charAt(0).toUpperCase();

            successMessage.style.display = 'block';
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';

            // Hide success message after 3 seconds
            setTimeout(() => {
                successMessage.style.display = 'none';
            }, 3000);

        } catch (error) {
            console.error('Error saving settings:', error);
            if (error.code === 'permission-denied') {
                alert('Permission denied. Please update Firestore rules to allow username changes.');
            } else {
                alert('Failed to save settings: ' + error.message);
            }
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    });

    /**
     * Load current settings
     */
    async function loadSettings(userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                currentUsername = userData.username || '';
                originalUsername = currentUsername;

                // Load username
                usernameInput.value = currentUsername;

                // Set avatar initial
                avatarInitial.textContent = currentUsername ? currentUsername.charAt(0).toUpperCase() : 'U';

                // Load profile photo
                if (userData.profilePhoto) {
                    previewImage.src = userData.profilePhoto;
                    previewImage.style.display = 'block';
                    photoPlaceholder.style.display = 'none';
                    removePhotoBtn.style.display = 'block';
                }

                // Load bio
                if (userData.bio) {
                    bioInput.value = userData.bio;
                    bioCount.textContent = userData.bio.length;
                }

                // Load favorite genre
                if (userData.favoriteGenre) {
                    favoriteGenre.value = userData.favoriteGenre;
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
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

                    // Make it square (crop to center)
                    const size = Math.min(width, height);
                    const offsetX = (width - size) / 2;
                    const offsetY = (height - size) / 2;

                    canvas.width = maxWidth;
                    canvas.height = maxWidth;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, maxWidth, maxWidth);

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
});
