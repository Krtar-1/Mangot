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
