// Firebase configuration
// Replace these values with your Firebase project credentials
const firebaseConfig = {
    apiKey: "AIzaSyCbJBoCi4n24cbST8uyOO_vyZHZmLGrANg",
    authDomain: "mangot-9f79f.firebaseapp.com",
    projectId: "mangot-9f79f",
    storageBucket: "mangot-9f79f.firebasestorage.app",
    messagingSenderId: "1063793433201",
    appId: "1:1063793433201:web:81223594e213a65ccc59d0",
    measurementId: "G-K76LHHPG6N"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export auth and db references
const auth = firebase.auth();
const db = firebase.firestore();
