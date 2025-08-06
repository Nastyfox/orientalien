import {
  collection,
  doc,
  getDocs,
  getFirestore,
  setDoc,
  getDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";

import { v4 as uuidv4 } from "https://jspm.dev/uuid";

import { initializePageScripts as initializeMapPageScripts } from "./map.js"; // Import from map.js

import { initializePageScripts as initializeMapAdminPageScripts } from "./map-admin.js"; // Import from map.js

import { initializePageScripts as initializeJoinTeamPageScripts } from "./join-team.js"; // Import from map.js

import { initializePageScripts as initializeChallengePageScripts } from "./challenge.js"; // Import from challenge.js

import { initializePageScripts as initializeCameraChallengePageScripts } from "./camera-challenge.js"; // Import from camera-challenge.js

import { initializePageScripts as initializePhonePlacementChallengePageScripts } from "./phone-placement-challenge.js"; // Import from camera-challenge.js

import { initializePageScripts as initializeLightChallengePageScripts } from "./light-challenge.js"; // Import from light-challenge.js

import { initializePageScripts as initializeMorseCodeChallengePageScripts } from "./morse-code-challenge.js"; // Import from morse-code-challenge.js

import { initializePageScripts as initializeSoundChallengePageScripts } from "./sound-challenge.js"; // Import from sound-challenge.js

import { initializePageScripts as initializeBallMazeChallengePageScripts } from "./ball-maze-challenge.js"; // Import from ball-maze-challenge.js

import { initializePageScripts as initializeCompassChallengePageScripts } from "./compass-challenge.js"; // Import from compass-challenge.js

import { saveNotes, loadNotes } from "./notes.js"; // Import from notes.js

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBlBc7SqkqKbvAHHNOnnV1CurxAHkwg9-E",
  authDomain: "web-compass-df2fe.firebaseapp.com",
  projectId: "web-compass-df2fe",
  storageBucket: "web-compass-df2fe.appspot.com",
  messagingSenderId: "834740391251",
  appId: "1:834740391251:web:c862255165e426f39465a6",
  measurementId: "G-6QHSKR9SSB",
};

// Initialize Firebase (ensure this happens before anything else)
const app = initializeApp(firebaseConfig);

// Initialize Firestore (after Firebase initialization)
//const db = getFirestore(app);

// Function to get the current user's team from Firestore
export async function getUserTeam(db, phoneId) {
  if (!db) {
    console.error("Firestore is not initialized.");
    return;
  }

  try {
    const userRef = collection(db, "users");
    const q = query(userRef, where("phoneId", "==", phoneId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      console.log(userData.team);
      return userData.team; // Return the team the user belongs to
    } else {
      console.error("No user found with the given phone ID.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching user team:", error);
  }
}

export function getOrCreateUniqueId() {
  // Try to get the unique ID from local storage
  let uniqueId = localStorage.getItem("uniqueId");
  if (!uniqueId) {
    // If no ID is found, generate a new UUID
    uniqueId = generateUniqueId(); // Function to generate UUID
    // Store the new ID in local storage
    localStorage.setItem("uniqueId", uniqueId);
  }
  return uniqueId;
}

function generateUniqueId() {
  // Generate a UUID (v4) using an external library or your method
  // Example using a library like uuid:
  return uuidv4(); // Ensure uuid library is included in your project
}

export function loadPage(page, id) {
  let url = ""; // Declare the URL variable

  // Use a switch or if-else statement to handle different page loads
  switch (page) {
    case "map":
      console.log("Loading map utils");
      url = "map.html";
      break;

    case "map-admin":
      console.log("Loading map-admin");
      url = "map-admin.html";
      break;

    case "join-team":
      console.log("Loading join-team");
      url = "join-team.html";
      break;

    case "phone-placement-challenge":
      console.log("Loading phone-placement-challenge");
      url = "phone-placement-challenge.html";
      break;

    case "camera-challenge":
      console.log("Loading camera-challenge");
      url = "camera-challenge.html";
      break;

    case "challenge":
      console.log("Loading challenge");
      url = "challenge.html";
      break;

    case "light-challenge":
      console.log("Loading challenge");
      url = "light-challenge.html";
      break;

    case "morse-code-challenge":
      console.log("Loading challenge");
      url = "morse-code-challenge.html";
      break;

    case "sound-challenge":
      console.log("Loading challenge");
      url = "sound-challenge.html";
      break;

    case "ball-maze-challenge":
      console.log("Loading challenge");
      url = "ball-maze-challenge.html";
      break;

    default:
      console.error("Invalid page name");
      return; // Exit the function if page is invalid
  }

  // Fetch the page
  fetch(url)
    .then((response) => response.text())
    .then((data) => {
      document.getElementById("content").innerHTML = data;

      initPageScripts(page, id);
    })
    .catch((error) => console.error("Error loading page:", error));
}

function initPageScripts(page, id) {
  // Initialize scripts after the page content is loaded
  if (page === "challenge") {
    console.log("Initializing challenge scripts with ID:", id);
    initializeChallengePageScripts(id); // Call the correct initialize function for challenges
  } else if (page === "camera-challenge") {
    console.log("Initializing camera challenge");
    initializeCameraChallengePageScripts(id); // Call the correct initialize function for challenges
  } else if (page === "phone-placement-challenge") {
    console.log("Initializing phone placement challenge");
    initializePhonePlacementChallengePageScripts(id); // Call the correct initialize function for challenges
  } else if (page === "light-challenge") {
    console.log("Initializing light challenge");
    initializeLightChallengePageScripts(id); // Call the correct initialize function for challenges
  } else if (page === "morse-code-challenge") {
    console.log("Initializing morse code challenge");
    initializeMorseCodeChallengePageScripts(id); // Call the correct initialize function for challenges
  } else if (page === "sound-challenge") {
    console.log("Initializing sound challenge");
    initializeSoundChallengePageScripts(id); // Call the correct initialize function for challenges
  } else if (page === "ball-maze-challenge") {
    console.log("Initializing ball maze challenge");
    initializeBallMazeChallengePageScripts(id); // Call the correct initialize function for challenges
  } else if (page === "compass-challenge") {
    console.log("Initializing compass challenge");
    initializeCompassChallengePageScripts(id); // Call the correct initialize function for challenges
  } else if (page === "map") {
    console.log("Initializing map utils");
    initializeMapPageScripts(); // Call the correct initialize function for challenges
  } else if (page === "map-admin") {
    console.log("Initializing map admin utils");
    initializeMapAdminPageScripts(); // Call the correct initialize function for challenges
  } else if (page === "join-team") {
    console.log("Initializing join team utils");
    initializeJoinTeamPageScripts(); // Call the correct initialize function for challenges
  }
}

// Dynamically load HTML
async function loadHTML(route) {
  const contentDiv = document.getElementById("content");
  try {
    const response = await fetch(`${route}.html`);
    if (response.ok) {
      const html = await response.text();
      contentDiv.innerHTML = html;
    } else {
      contentDiv.innerHTML = "<h1>404 - Page Not Found</h1>";
    }
  } catch (error) {
    contentDiv.innerHTML = "<h1>Error loading page</h1>";
  }
}

// Dynamically load CSS
function loadCSS(route) {
  const existingLink = document.getElementById("dynamic-css");
  if (existingLink) existingLink.remove(); // Remove previous CSS

  const link = document.createElement("link");
  link.id = "dynamic-css";
  link.rel = "stylesheet";
  link.href = `${route}.css`;
  document.head.appendChild(link);
}

// Dynamically load JS
function loadJS(route) {
  const existingScript = document.getElementById("dynamic-js");
  if (existingScript) existingScript.remove(); // Remove previous script

  const script = document.createElement("script");
  script.id = "dynamic-js";
  script.src = `${route}.js`;
  script.defer = true; // Ensures script executes after DOM parsing
  script.type = "module";
  document.body.appendChild(script);
}

// Combined load function
export async function loadPageSPA(route, id) {
  // Load CSS
  loadCSS(route);

  // Load HTML
  await loadHTML(route);

  // Load JavaScript
  loadJS(route);

  initPageScripts(route, id);
}

export function setHash(params) {
  const hashString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  window.location.hash = hashString;
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function initializeNotes() {
  // Handle notes icon clicks
  const notesIcon = document.querySelector(".notes-icon");
  const notesCloseButton = document.querySelector("#notesModal .close");

  // Open walkie-talkie modal
  notesIcon.addEventListener("click", openNotes);

  // Close walkie-talkie modal
  notesCloseButton.addEventListener("click", closeNotes);

  // Close walkie-talkie modal if user clicks outside of it
  window.addEventListener("click", (event) => {
    const notesModal = document.getElementById("notesModal");
    if (event.target === notesModal) {
      notesModal.style.display = "none";
    }
  });

  loadNotes();
}

// Function to open the ranking modal
function openNotes() {
  // Prevent scrolling on the body and html when the modal is open
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  const modal = document.getElementById("notesModal");
  modal.style.display = "flex"; // Show the modal

  // Get the iframe element first
  const iframe = document.getElementById("notesIframe");
  const iframeDocument =
    iframe.contentDocument || iframe.contentWindow.document;
  const notesElement = iframeDocument.getElementById("notes");

  if (notesElement) {
    // Trigger initial resize
    notesElement.style.height = "auto";
    notesElement.style.height = notesElement.scrollHeight + "px";
  }
}

// Function to close the ranking modal
function closeNotes() {
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";

  const modal = document.getElementById("notesModal");
  modal.style.display = "none"; // Hide the modal

  saveNotes();
}
