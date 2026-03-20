// Profile page logic
document.addEventListener('DOMContentLoaded', function() {
    const signOutBtn = document.getElementById('sign-out-btn');
    const profileUsername = document.getElementById('profile-username');
    const avatarInitial = document.getElementById('avatar-initial');
    const profilePhoto = document.getElementById('profile-photo');
    const profileBio = document.getElementById('profile-bio');
    const profileFavoriteGenre = document.getElementById('profile-favorite-genre');
    const infoUsername = document.getElementById('info-username');
    const infoEmail = document.getElementById('info-email');
    const infoMemberSince = document.getElementById('info-member-since');
    const statTotalBooks = document.getElementById('stat-total-books');
    const statReadBooks = document.getElementById('stat-read-books');
    const statUnreadBooks = document.getElementById('stat-unread-books');
    const statSeries = document.getElementById('stat-series');

    // Handle sign out
    signOutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        signOutUser();
    });

    // Load profile when auth state is confirmed
    onAuthStateChange((user) => {
        if (user) {
            loadProfile(user);
            loadStats(user.uid);
        }
    });

    /**
     * Load user profile data
     */
    async function loadProfile(user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                const username = userData.username || 'User';

                // Update profile header
                profileUsername.textContent = username;

                // Show profile photo or initial
                if (userData.profilePhoto) {
                    profilePhoto.src = userData.profilePhoto;
                    profilePhoto.style.display = 'block';
                    avatarInitial.style.display = 'none';
                } else {
                    avatarInitial.textContent = username.charAt(0).toUpperCase();
                    avatarInitial.style.display = 'flex';
                    profilePhoto.style.display = 'none';
                }

                // Show bio
                if (userData.bio) {
                    profileBio.textContent = userData.bio;
                    profileBio.style.display = 'block';
                } else {
                    profileBio.style.display = 'none';
                }

                // Show favorite genre
                if (userData.favoriteGenre) {
                    profileFavoriteGenre.textContent = userData.favoriteGenre;
                    profileFavoriteGenre.style.display = 'inline-block';
                } else {
                    profileFavoriteGenre.style.display = 'none';
                }

                // Update info section
                infoUsername.textContent = username;
                infoEmail.textContent = user.email;

                // Format member since date
                if (userData.createdAt) {
                    const memberDate = userData.createdAt.toDate();
                    infoMemberSince.textContent = memberDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                } else {
                    infoMemberSince.textContent = 'Unknown';
                }
            } else {
                profileUsername.textContent = 'User';
                avatarInitial.textContent = 'U';
                infoEmail.textContent = user.email;
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    }

    /**
     * Load collection statistics
     */
    async function loadStats(userId) {
        try {
            const snapshot = await db.collection('users').doc(userId).collection('books').get();

            let totalBooks = 0;
            let readBooks = 0;
            let unreadBooks = 0;
            const seriesSet = new Set();

            snapshot.forEach((doc) => {
                const book = doc.data();
                totalBooks++;

                if (book.read) {
                    readBooks++;
                } else {
                    unreadBooks++;
                }

                if (book.series) {
                    seriesSet.add(book.series);
                }
            });

            // Update stats display
            statTotalBooks.textContent = totalBooks;
            statReadBooks.textContent = readBooks;
            statUnreadBooks.textContent = unreadBooks;
            statSeries.textContent = seriesSet.size;

        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
});
