import {
  collection,
  getDocs,
  getFirestore,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";

import * as L from "https://unpkg.com/leaflet@1.7.1/dist/leaflet-src.esm.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBlBc7SqkqKbvAHHNOnnV1CurxAHkwg9-E",
  authDomain: "web-compass-df2fe.firebaseapp.com",
  projectId: "web-compass-df2fe",
  storageBucket: "web-compass-df2fe.appspot.com",
  messagingSenderId: "834740391251",
  appId: "1:834740391251:web:c862255165e426f39465a6",
  measurementId: "G-6QHSKR9SSB",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Ensure db is defined

let map = null;

// Function to initialize the map and page scripts
export function initializePageScripts() {
  // Lock orientation to landscape when the document is loaded
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock("portrait").catch(function (err) {
      console.error("Failed to lock orientation: ", err);
    });
  } else {
    console.warn("Screen Orientation API not supported");
  }

  // Initialize the map and set the view to a default location
  map = L.map("map").setView([51.505, -0.09], 13); // Default location (London)

  // Add a tile layer from OpenStreetMap
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  // Request the user's location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(onLocationFound, onLocationError);
  } else {
    alert("Geolocation is not supported by this browser.");
  }

  loadChallenges();

  window.addEventListener("deviceorientationabsolute", (event) => {
    if (event.alpha === null) {
      console.error("Device orientation data is not available.");
    }

    loadTeamMemberPositions();
    // Set interval to refresh positions every 30 seconds (30000 milliseconds)
    setInterval(loadTeamMemberPositions, 60000);
  });

  // Handle walkie-talkie icon clicks
  const walkieTalkieIcon = document.querySelector(".walkie-talkie-icon");
  const walkieTalkieCloseButton = document.querySelector(
    "#walkieTalkieModal .close"
  );

  // Open walkie-talkie modal
  walkieTalkieIcon.addEventListener("click", openWalkieTalkie);

  // Close walkie-talkie modal
  walkieTalkieCloseButton.addEventListener("click", closeWalkieTalkie);
  
  // Handle walkie-talkie icon clicks
  const chronoIcon = document.querySelector(".chrono-icon");
  const chronoCloseButton = document.querySelector(
    "#finishOrderModal .close"
  );

  // Open walkie-talkie modal
  chronoIcon.addEventListener("click", openFinishOrder);

  // Close walkie-talkie modal
  chronoCloseButton.addEventListener("click", closeFinishOrder);

  // Close walkie-talkie modal if user clicks outside of it
  window.addEventListener("click", (event) => {
    const walkieTalkieModal = document.getElementById("walkieTalkieModal");
    const finishOrderModal = document.getElementById("finishOrderModal");
    if (event.target === walkieTalkieModal) {
      walkieTalkieModal.style.display = "none";
    }
  });
}

function onLocationFound(e) {
  const radius = e.accuracy / 2;

  // Only set the view if it's the first time (i.e., when zoom level is unchanged)
  if (!map.getZoom()) {
    map.setView(e.latlng, 13); // Set view only when necessary
  }
}

// Function to handle geolocation errors
function onLocationError(e) {
  alert(e.message);
}

// Fetch challenge data from Firestore
async function loadChallenges() {
  const querySnapshot = await getDocs(collection(db, "challenges"));
  querySnapshot.forEach((doc) => {
    const target = doc.data(); // Each document data

    const marker = L.marker([target.lat, target.lng]).addTo(map);

    const popupContent = document.createElement("div");
    popupContent.innerHTML = `
      <strong>${
        target.challengeType === "question"
          ? "Challenge Point"
          : target.challengeType === "phone-placement"
          ? "Phone Placement Challenge"
          : "Camera Challenge"
      }</strong>
      <p>${
        target.challengeType === "question"
          ? target.question
          : target.challengeType === "phone-placement"
          ? "Place the phones according to the instructions"
          : "Find the target by opening your camera"
      }</p>
      <button class="challenge-btn">
        ${
          target.challengeType === "question"
            ? "Take on the challenge"
            : target.challengeType === "phone-placement"
            ? "Start Phone Placement Challenge"
            : "Start Camera Challenge"
        }
      </button>
    `;
  });
}

// Function to open the walkie-talkie modal
function openWalkieTalkie() {
  const modal = document.getElementById("walkieTalkieModal");
  modal.style.display = "flex"; // Show the modal
}

// Function to close the walkie-talkie modal
function closeWalkieTalkie() {
  const modal = document.getElementById("walkieTalkieModal");
  modal.style.display = "none"; // Hide the modal
}

// Function to open the finish order modal
function openFinishOrder() {
  const modal = document.getElementById("finishOrderModal");
  modal.style.display = "flex"; // Show the modal
}

// Function to close the finish order modal
function closeFinishOrder() {
  const modal = document.getElementById("finishOrderModal");
  modal.style.display = "none"; // Hide the modal
}

// Track existing team markers
const teamMarkers = new Map();

// Load one team member's current position per team and update periodically
async function loadTeamMemberPositions() {
  try {
    const querySnapshot = await getDocs(collection(db, "teams"));
    console.log("Team positions loaded");

    // Remove existing markers
    teamMarkers.forEach((marker) => {
      map.removeLayer(marker);
    });
    teamMarkers.clear();

    // Loop through each team and update the map
    querySnapshot.forEach((doc) => {
      const teamData = doc.data();
      const { location, color } = teamData; // Get location & color
      
      if (location) {
        const teamName = teamData.name; // Use document ID as team name

        // Create a colored icon for the team
        const teamIcon = L.divIcon({
          className: "custom-marker",
          html: `<div style="background-color: ${'#' + color || 'gray'}; 
                            width: 20px; height: 20px; 
                            border-radius: 50%; 
                            border: 2px solid white;"></div>`,
          iconSize: [20, 20], // Size of the icon
          iconAnchor: [10, 10], // Center the icon on the point
          popupAnchor: [0, -10], // Position the popup above the icon
        });

        // Create a marker with the custom icon
        const marker = L.marker([location.lat, location.lng], { icon: teamIcon }).addTo(map);

        // Always show the team name as a label
        marker.bindTooltip(`<strong>${teamName}</strong>`, {
          permanent: true, // Always visible
          direction: "top",
          offset: [0, -15], // Adjust position slightly above marker
        });

        // Store the marker to prevent duplicates
        teamMarkers.set(teamName, marker);
      }
    });
  } catch (error) {
    console.error("Error loading team positions:", error);
  }
}

// Async function to check for new messages
async function checkForNewMessages() {
  console.log("Check messages");

  const messagesQuery = query(
    collection(db, "voice-messages"),
    where("isAdmin", "==", true), // Only messages from admin
    where("team", "==", userTeam)
  );

  try {
    // Fetch all admin messages
    const snapshot = await getDocs(messagesQuery);

    let newMessagesExist = false;

    snapshot.forEach((doc) => {
      const messageData = doc.data();

      if (!messageData.isDisplayed) {
        newMessagesExist = true;
      }
    });

    if (newMessagesExist && notificationDot != null) {
      // New unread messages exist, show the notification dot
      notificationDot.style.display = "block";
    }
  } catch (error) {
    console.error("Error checking for new messages:", error);
  }
}
