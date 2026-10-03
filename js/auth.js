// Authentication functions

/**
 * Sign up a new user with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<firebase.auth.UserCredential>}
 */
async function signUp(email, password) {
    return auth.createUserWithEmailAndPassword(email, password);
}

/**
 * Sign in an existing user with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<firebase.auth.UserCredential>}
 */
async function signIn(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
}

/**
 * Sign out the current user and redirect to index
 */
async function signOutUser() {
    await auth.signOut();
    window.location.href = 'index.html';
}

/**
 * Get the current authenticated user
 * @returns {firebase.User|null}
 */
function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Listen for auth state changes
 * @param {function} callback - Called with user object or null
 * @returns {function} Unsubscribe function
 */
function onAuthStateChange(callback) {
    return auth.onAuthStateChanged(callback);
}

// Guest mode - view-only browsing without an account.
// Stored in the browser only; guests are signed out, so Firestore
// rules already keep them from writing anything.
const GUEST_KEY = 'mangotGuest';

/**
 * @returns {boolean} True if browsing as a guest (and not signed in)
 */
function isGuest() {
    try {
        return localStorage.getItem(GUEST_KEY) === 'true' && !auth.currentUser;
    } catch (e) {
        return false;
    }
}

/**
 * Start browsing as a guest and go to the Collectors page
 */
function continueAsGuest() {
    try {
        localStorage.setItem(GUEST_KEY, 'true');
    } catch (e) {
        // Storage blocked - guest pages still work signed out
    }
    window.location.href = 'users.html';
}

/**
 * Leave guest mode (called on sign in / sign up)
 */
function exitGuestMode() {
    try {
        localStorage.removeItem(GUEST_KEY);
    } catch (e) {
        // Ignore
    }
}

/**
 * Nav links for signed-out visitors: view-only pages, plus a guest badge
 * @param {string} activePage - File name of the current page, e.g. 'users.html'
 */
function signedOutNavHtml(activePage) {
    const link = (href, label) =>
        `<a href="${href}" class="nav-link${href === activePage ? ' active' : ''}">${label}</a>`;
    return `
        ${link('search.html', 'Search')}
        ${link('users.html', 'Collectors')}
        ${isGuest() ? '<span class="guest-badge" title="View-only guest mode">Guest</span>' : ''}
        <a href="login.html" class="nav-link sign-out">Sign In</a>
    `;
}
