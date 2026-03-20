// Auth guard functions for route protection

/**
 * Require authentication - redirect to login if not authenticated
 * Use this on protected pages like collection.html and register.html
 */
function requireAuth() {
    onAuthStateChange((user) => {
        if (!user) {
            window.location.href = 'login.html';
        }
    });
}

/**
 * Redirect if already logged in
 * Use this on login.html to redirect authenticated users to collection
 */
function redirectIfLoggedIn() {
    onAuthStateChange((user) => {
        if (user) {
            window.location.href = 'collection.html';
        }
    });
}
