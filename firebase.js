import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
    getDatabase,
    ref,
    set,
    get,
    onValue
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "ENTER_YOUR_FIREBASE_API_KEY",
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
// FIREBASE AUTHENTICATION & PROFILES
// ===============================

const RTDB_URL = "https://circularseed-d0ced-default-rtdb.asia-southeast1.firebasedatabase.app";

/**
 * Save user profile to Firebase Realtime Database at /users/{uid}
 * and cache in localStorage for instant retrieval.
 */
export async function saveUserProfile(uid, profile) {
    if (!uid || !profile) return false;
    try {
        // Cache locally first
        if (typeof localStorage !== "undefined") {
            try {
                localStorage.setItem(`cs_user_role_${uid}`, profile.role || 'OPERATOR');
                localStorage.setItem(`cs_user_name_${uid}`, profile.name || '');
                if (profile.email) {
                    localStorage.setItem(`cs_user_role_${profile.email.toLowerCase()}`, profile.role || 'OPERATOR');
                }
                localStorage.setItem(`cs_user_profile_${uid}`, JSON.stringify(profile));
            } catch (e) {}
        }

        // Save in Firebase Realtime Database
        await set(ref(database, `users/${uid}`), profile);
        console.log("[AUTH] Saved user profile to RTDB:", profile);
        return true;
    } catch (err) {
        console.warn("[AUTH] Error saving profile via SDK, trying REST:", err);
        try {
            await fetch(`${RTDB_URL}/users/${uid}.json`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(profile)
            });
            console.log("[AUTH] Saved user profile via REST:", profile);
            return true;
        } catch (fetchErr) {
            console.error("[AUTH] Failed to save profile to RTDB:", fetchErr);
            return false;
        }
    }
}

/**
 * Retrieve user profile from Firebase Realtime Database or local cache
 * @param {string} uid
 * @param {string} [email]
 * @returns {Promise<object|null>}
 */
export async function getUserProfile(uid, email = '') {
    if (!uid) return null;

    // Check localStorage cache first for immediate response
    let cached = null;
    if (typeof localStorage !== "undefined") {
        try {
            const raw = localStorage.getItem(`cs_user_profile_${uid}`);
            if (raw) cached = JSON.parse(raw);
        } catch (e) {}
    }

    try {
        const userRef = ref(database, `users/${uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            const profile = snapshot.val();
            if (typeof localStorage !== "undefined") {
                try {
                    localStorage.setItem(`cs_user_role_${uid}`, profile.role || 'OPERATOR');
                    localStorage.setItem(`cs_user_name_${uid}`, profile.name || '');
                    if (profile.email) {
                        localStorage.setItem(`cs_user_role_${profile.email.toLowerCase()}`, profile.role || 'OPERATOR');
                    }
                    localStorage.setItem(`cs_user_profile_${uid}`, JSON.stringify(profile));
                } catch (e) {}
            }
            return profile;
        }
    } catch (err) {
        console.warn("[AUTH] RTDB SDK get failed, trying REST fallback:", err);
        try {
            const res = await fetch(`${RTDB_URL}/users/${uid}.json`);
            const data = await res.json();
            if (data) {
                if (typeof localStorage !== "undefined") {
                    try {
                        localStorage.setItem(`cs_user_role_${uid}`, data.role || 'OPERATOR');
                        localStorage.setItem(`cs_user_name_${uid}`, data.name || '');
                        if (data.email) {
                            localStorage.setItem(`cs_user_role_${data.email.toLowerCase()}`, data.role || 'OPERATOR');
                        }
                        localStorage.setItem(`cs_user_profile_${uid}`, JSON.stringify(data));
                    } catch (e) {}
                }
                return data;
            }
        } catch (fetchErr) {
            console.warn("[AUTH] REST fallback failed:", fetchErr);
        }
    }

    if (cached) return cached;

    // Fallback: check localStorage by uid or email
    if (typeof localStorage !== "undefined") {
        const localRole = localStorage.getItem(`cs_user_role_${uid}`) || (email ? localStorage.getItem(`cs_user_role_${email.toLowerCase()}`) : null);
        const localName = localStorage.getItem(`cs_user_name_${uid}`);
        if (localRole) {
            return {
                uid,
                email,
                name: localName || '',
                role: localRole,
                organizationId: 'ORG-CIRCULARSEED',
                organizationName: 'CircularSeed Internal Fleet'
            };
        }
    }

    return null;
}

/**
 * Update a user's role in Realtime Database and localStorage
 * @param {string} uid
 * @param {string} newRole
 */
export async function updateUserRole(uid, newRole) {
    if (!uid || !newRole) return null;
    const normalizedRole = newRole.toUpperCase();
    console.log(`[AUTH] Updating role for ${uid} to ${normalizedRole}`);
    
    // Update local cache
    if (typeof localStorage !== "undefined") {
        try {
            localStorage.setItem(`cs_user_role_${uid}`, normalizedRole);
            const raw = localStorage.getItem(`cs_user_profile_${uid}`);
            if (raw) {
                const p = JSON.parse(raw);
                p.role = normalizedRole;
                localStorage.setItem(`cs_user_profile_${uid}`, JSON.stringify(p));
            }
        } catch (e) {}
    }

    try {
        await set(ref(database, `users/${uid}/role`), normalizedRole);
    } catch (err) {
        try {
            await fetch(`${RTDB_URL}/users/${uid}/role.json`, {
                method: "PUT",
                body: JSON.stringify(normalizedRole)
            });
        } catch (e) {}
    }

    return normalizedRole;
}

/**
 * Create a new user account with Firebase Authentication and save profile
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @param {string} role ('CEO' | 'CUSTOMER' | 'OPERATOR')
 * @returns {Promise<{success: boolean, user?: object, profile?: object, error?: string}>}
 */
export async function registerUser(name, email, password, role = 'OPERATOR') {
    console.log("[AUTH] Register attempt for:", email, "role:", role);
    try {
        const cleanName = (name || '').trim();
        const cleanEmail = (email || '').trim();
        const cleanRole = (role || 'OPERATOR').toUpperCase();

        if (!cleanName) {
            return { success: false, error: "Please enter your full name." };
        }
        if (!cleanEmail) {
            return { success: false, error: "Please enter a valid email address." };
        }
        if (!password || password.length < 6) {
            return { success: false, error: "Password must be at least 6 characters." };
        }

        // 1. Create account in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const fbUser = userCredential.user;

        // 2. Update display name
        try {
            await updateProfile(fbUser, { displayName: cleanName });
        } catch (e) {
            console.warn("[AUTH] Error setting displayName:", e);
        }

        // 3. Construct profile with designated role
        const profile = {
            uid: fbUser.uid,
            name: cleanName,
            email: cleanEmail,
            role: cleanRole,
            organizationId: 'ORG-CIRCULARSEED',
            organizationName: 'CircularSeed Internal Fleet',
            createdAt: Date.now()
        };

        // 4. Save profile in Firebase Realtime Database
        await saveUserProfile(fbUser.uid, profile);

        console.log("[AUTH] Register successful for:", cleanEmail);
        return {
            success: true,
            user: fbUser,
            profile: profile
        };
    } catch (error) {
        console.error("[AUTH] Register failed:", error);
        let userMessage = "Account creation failed.";
        switch (error.code) {
            case "auth/email-already-in-use":
                userMessage = "This email is already registered. Please sign in instead.";
                break;
            case "auth/invalid-email":
                userMessage = "Please enter a valid email address.";
                break;
            case "auth/weak-password":
                userMessage = "Password is too weak. Please use at least 6 characters.";
                break;
            case "auth/operation-not-allowed":
                userMessage = "Email/Password sign up is not enabled in Firebase Console.";
                break;
            case "auth/network-request-failed":
                userMessage = "Network error. Please check your internet connection.";
                break;
            default:
                userMessage = error.message || "Failed to create account.";
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
 * Log in with email and password using Firebase Authentication
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, user?: object, profile?: object, error?: string, rawError?: object}>}
 */
export async function loginUser(email, password) {
    console.log("[AUTH] Login attempt");
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("[AUTH] Login successful");
        
        // Fetch or load user's profile and role
        const profile = await getUserProfile(userCredential.user.uid, email);

        return {
            success: true,
            user: userCredential.user,
            profile: profile
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
    return onAuthStateChanged(auth, async (user) => {
        console.log("[AUTH] Auth state changed");
        if (typeof callback === "function") {
            if (user) {
                // Attach resolved profile if available
                const profile = await getUserProfile(user.uid, user.email);
                user.userProfile = profile;
            }
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
    registerUser,
    getUserProfile,
    saveUserProfile,
    updateUserRole,
    observeAuthState,
    logoutUser,
    subscribeToMachine,
    getLatestMachineData
};

if (typeof window !== "undefined") {
    window.FirebaseService = FirebaseService;
    window.loginUser = loginUser;
    window.registerUser = registerUser;
    window.getUserProfile = getUserProfile;
    window.saveUserProfile = saveUserProfile;
    window.updateUserRole = updateUserRole;
    window.observeAuthState = observeAuthState;
    window.logoutUser = logoutUser;
    window.subscribeToMachine = subscribeToMachine;
    window.getLatestMachineData = getLatestMachineData;
    window.dispatchEvent(new CustomEvent("firebase:ready", { detail: FirebaseService }));
}

export default FirebaseService;
