import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
    getDatabase,
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAf89nYZMx_agGM1xbApWM3hRqeHqxN-hQ",
    authDomain: "circularseed-d0ced.firebaseapp.com",
    databaseURL: "https://circularseed-d0ced-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "circularseed-d0ced",
    storageBucket: "circularseed-d0ced.firebasestorage.app",
    messagingSenderId: "38587494359",
    appId: "1:38587494359:web:8d0fd91446c8fca7326592",
    measurementId: "G-2TW3RT1SX8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// ===============================
// FIREBASE AUTHENTICATION
// ===============================

/**
 * Log in with email and password using Firebase Authentication
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, user?: object, error?: string, rawError?: object}>}
 */
export async function loginUser(email, password) {
    console.log("[AUTH] Login attempt");
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("[AUTH] Login successful");
        return {
            success: true,
            user: userCredential.user
        };
    } catch (error) {
        console.error("[AUTH] Login failed", error);
        let userMessage = "Authentication failed. Please verify your credentials.";
        switch (error.code) {
            case "auth/invalid-credential":
            case "auth/wrong-password":
            case "auth/user-not-found":
                userMessage = "Invalid email or password.";
                break;
            case "auth/invalid-email":
                userMessage = "Please enter a valid email address.";
                break;
            case "auth/user-disabled":
                userMessage = "This user account has been disabled. Please contact an administrator.";
                break;
            case "auth/too-many-requests":
                userMessage = "Too many failed attempts. Access is temporarily disabled. Please try again later.";
                break;
            case "auth/network-request-failed":
                userMessage = "Network error. Please check your internet connection.";
                break;
            default:
                userMessage = error.message || "Failed to sign in.";
                break;
        }
        return {
            success: false,
            error: userMessage,
            rawError: error
        };
    }
}

/**
 * Observe Firebase Authentication state changes
 * @param {function} callback
 * @returns {function} Unsubscribe function
 */
export function observeAuthState(callback) {
    return onAuthStateChanged(auth, (user) => {
        console.log("[AUTH] Auth state changed");
        if (typeof callback === "function") {
            callback(user);
        }
    });
}

/**
 * Sign out the currently authenticated user
 * @returns {Promise<{success: boolean, error?: object}>}
 */
export async function logoutUser() {
    try {
        await signOut(auth);
        console.log("[AUTH] User signed out");
        return { success: true };
    } catch (error) {
        console.error("[AUTH] Sign out error", error);
        return { success: false, error };
    }
}

// ===============================
// REALTIME DATABASE
// ===============================

const machineRef = ref(database, "machines/CS001");
let latestMachineData = null;

// Attempt to restore cached data from session storage if present
try {
    const cached = sessionStorage.getItem('cs_latest_rtdb');
    if (cached) latestMachineData = JSON.parse(cached);
} catch (e) {}

// Pre-fetch initial machine data immediately via REST endpoint
try {
    fetch("https://circularseed-d0ced-default-rtdb.asia-southeast1.firebasedatabase.app/machines/CS001.json")
        .then(res => res.json())
        .then(data => {
            if (data) {
                latestMachineData = data;
                try { sessionStorage.setItem('cs_latest_rtdb', JSON.stringify(data)); } catch (e) {}
                console.log("[Firebase RTDB] Initial machine snapshot preloaded:", data);
            }
        })
        .catch(() => {});
} catch (e) {}

/**
 * Returns the latest snapshot of CS001 machine data
 * @returns {object|null}
 */
export function getLatestMachineData() {
    return latestMachineData;
}

/**
 * Subscribe to live machine telemetry from Firebase Realtime Database
 * @param {function} callback
 * @returns {function} Unsubscribe function
 */
export function subscribeToMachine(callback) {
    return onValue(machineRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            latestMachineData = data;
            try { sessionStorage.setItem('cs_latest_rtdb', JSON.stringify(data)); } catch (e) {}
        }
        if (data && typeof callback === "function") {
            callback(data);
        }
    });
}

// Bridge for application scripts
const FirebaseService = {
    app,
    auth,
    database,
    loginUser,
    observeAuthState,
    logoutUser,
    subscribeToMachine,
    getLatestMachineData
};

if (typeof window !== "undefined") {
    window.FirebaseService = FirebaseService;
    window.loginUser = loginUser;
    window.observeAuthState = observeAuthState;
    window.logoutUser = logoutUser;
    window.subscribeToMachine = subscribeToMachine;
    window.getLatestMachineData = getLatestMachineData;
    window.dispatchEvent(new CustomEvent("firebase:ready", { detail: FirebaseService }));
}

export default FirebaseService;
