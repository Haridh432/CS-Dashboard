import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

import {
    getDatabase,
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

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

const app = initializeApp(firebaseConfig);

const database = getDatabase(app);
const auth = getAuth(app);


// ===============================
// FIREBASE AUTHENTICATION
// ===============================

export async function loginUser(email, password) {
    try {
        const userCredential =
            await signInWithEmailAndPassword(auth, email, password);

        console.log("Login successful:", userCredential.user.email);

        return {
            success: true,
            user: userCredential.user
        };

    } catch (error) {

        console.error("Firebase login error:", error);

        return {
            success: false,
            error: error
        };
    }
}


export function observeAuthState(callback) {
    return onAuthStateChanged(auth, callback);
}


export async function logoutUser() {
    await signOut(auth);
}


// ===============================
// REALTIME DATABASE
// ===============================

const machineRef = ref(database, "machines/CS001");

export function subscribeToMachine(callback) {

    return onValue(machineRef, (snapshot) => {

        const data = snapshot.val();

        console.log("Firebase machine data:", data);

        if (data) {
            callback(data);
        }

    });
}