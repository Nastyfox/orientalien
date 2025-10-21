import {
  collection,
  doc,
  getDocs,
  getFirestore,
  setDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";
import { v4 as uuidv4 } from "https://jspm.dev/uuid";
import {
  getUserTeam,
  getOrCreateUniqueId,
  loadPage,
  setHash,
  initializeNotes,
  enableFullscreen
} from "./utils.js";
import * as L from "https://unpkg.com/leaflet@1.7.1/dist/leaflet-src.esm.js";

import { initCompass } from "./compass.js";

// Declare the map variable globally
let map;

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Ensure db is defined

// Initialize circle variable to store the current location circle
let currentLocationCircle = null;

let userTeam = null;
const phoneId = getOrCreateUniqueId(); // Get the user's phone ID
let notificationDot = null;

let messageCheckInterval = null; // Declare the interval variable
let positionCheckInterval = null; // Declare the interval variable

// Function to initialize the map and page scripts
export function initializePageScripts() {
  console.log("MAP INIT");
  // Initialize the map and set the view to a default location
  map = L.map("map").setView([47.10281017395628, 0.6878686477110221], 18);

  // Add a tile layer from OpenStreetMap
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  initializeTeam();

  notificationDot = document.querySelector(".notification-dot");
  console.log(notificationDot);

  // Handle compass icon clicks
  const compassIcon = document.querySelector(".compass-icon");
  const compassCloseButton = document.querySelector("#compassModal .close");

  // Open compass modal
  compassIcon.addEventListener("click", async function () {
    requestOrientationPermission();
    openCompass();
  });

  // Close compass modal
  compassCloseButton.addEventListener("click", closeCompass);

  // Close compass modal if user clicks outside of it
  window.addEventListener("click", (event) => {
    const compassModal = document.getElementById("compassModal");
    if (event.target === compassModal) {
      compassModal.style.display = "none";
    }
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

  // Close walkie-talkie modal if user clicks outside of it
  window.addEventListener("click", (event) => {
    const walkieTalkieModal = document.getElementById("walkieTalkieModal");
    if (event.target === walkieTalkieModal) {
      walkieTalkieModal.style.display = "none";
    }
  });

  // Handle walkie-talkie icon clicks
  const rankingIcon = document.querySelector(".ranking-icon");
  const rankingCloseButton = document.querySelector("#rankingModal .close");

  // Open walkie-talkie modal
  rankingIcon.addEventListener("click", openRanking);

  // Close walkie-talkie modal
  rankingCloseButton.addEventListener("click", closeRanking);

  // Close walkie-talkie modal if user clicks outside of it
  window.addEventListener("click", (event) => {
    const rankingModal = document.getElementById("rankingModal");
    if (event.target === rankingModal) {
      rankingModal.style.display = "none";
    }
  });
  
  initializeNotes();

  // Request the user's location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(onLocationFound, onLocationError);
  } else {
    alert("Geolocation is not supported by this browser.");
  }

  // Refresh position every 30 seconds
  positionCheckInterval = setInterval(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        onLocationFound,
        onLocationError,
        {
          enableHighAccuracy: true,
        }
      );
    }
  }, 60000);

  if (!messageCheckInterval) {
    checkForNewMessages();
    // Only set it if it's not already set
    messageCheckInterval = setInterval(checkForNewMessages, 30000);
  }

  // Lock orientation to landscape when the document is loaded
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock("portrait").catch(function (err) {
      console.error("Failed to lock orientation: ", err);
    });
  } else {
    console.warn("Screen Orientation API not supported");
  }

  window.addEventListener("deviceorientationabsolute", (event) => {
    if (event.alpha === null) {
      console.error("Device orientation data is not available.");
    }
  });
}

// Function to open the compass modal
function openCompass() {
  // Prevent scrolling on the body and html when the modal is open
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  const modal = document.getElementById("compassModal");
  modal.style.display = "flex"; // Show the modal

  const iframe = document.getElementById("compass-iframe");
  console.log(iframe);
  if (iframe) {
    iframe.contentWindow.postMessage("startCompass", "*"); // Triggers initCompass inside the iframe
  }
}

// Function to close the compass modal
function closeCompass() {
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";

  const modal = document.getElementById("compassModal");
  modal.style.display = "none"; // Hide the modal
}

// Function to open the walkie-talkie modal
function openWalkieTalkie() {
  // Prevent scrolling on the body and html when the modal is open
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  const modal = document.getElementById("walkieTalkieModal");
  modal.style.display = "flex"; // Show the modal

  markMessagesAsRead();
}

// Function to close the walkie-talkie modal
function closeWalkieTalkie() {
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";

  const modal = document.getElementById("walkieTalkieModal");
  modal.style.display = "none"; // Hide the modal
}

// Function to open the ranking modal
function openRanking() {
  // Prevent scrolling on the body and html when the modal is open
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  const modal = document.getElementById("rankingModal");
  modal.style.display = "flex"; // Show the modal
}

// Function to close the ranking modal
function closeRanking() {
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";

  const modal = document.getElementById("rankingModal");
  modal.style.display = "none"; // Hide the modal
}

// Function to save location to Firestore
async function saveLocationToFirestore(lat, lng) {
  if (userTeam != null) {
    try {
      await setDoc(
        doc(db, "teams", userTeam),
        {
          location: {
            lat: lat,
            lng: lng,
          },
        },
        { merge: true }
      ); // Merge to avoid overwriting existing data
      console.log("Location saved to Firestore successfully.");
    } catch (error) {
      console.error("Error saving location to Firestore:", error);
    }
  }
}

function onLocationFound(position) {
  const lat = position.coords.latitude; // Access latitude directly
  const lng = position.coords.longitude; // Access longitude directly
  const accuracy = position.coords.accuracy; // Access accuracy directly

  console.log("Location found:", { lat, lng }); // Log the location

  if (map) {
    let radius = accuracy;

    // Check if lat and lng are valid
    if (lat !== undefined && lng !== undefined) {
      // Create a LatLng object
      const latlng = L.latLng(lat, lng);

      // Check if the currentLocationCircle exists
      if (currentLocationCircle) {
        // Remove the existing circle from the map
        map.removeLayer(currentLocationCircle);
      }

      // Create a new circle at the specified latlng with the given radius
      console.log("CIRCLE");
      currentLocationCircle = L.circle(latlng, radius).addTo(map);

      // Save location to Firestore
      saveLocationToFirestore(lat, lng);
    } else {
      console.error("Invalid latitude or longitude data:", { lat, lng });
    }
  } else {
    console.error("Map is not defined.");
  }
}

// Function to handle location error
function onLocationError(e) {
  alert(e.message);
}

// Initialize team
async function initializeTeam() {
  // Retrieve the user's team name
  userTeam = await getUserTeam(db, phoneId);

  if (userTeam) {
    console.log("User's team:", userTeam);

    // Get the team document from Firestore
    const teamDoc = await getDoc(doc(db, "teams", userTeam));

    if (teamDoc.exists()) {
      const teamData = teamDoc.data();

      // Check if startingChallenge is assigned, if not, call assignStartingChallengesToTeams
      if (!teamData.startingChallenge) {
        console.log("No starting challenge assigned, assigning now...");
        await assignStartingChallengesToTeams();
        
        // Recharger les données de l'équipe après l'assignation
        const updatedTeamDoc = await getDoc(doc(db, "teams", userTeam));
        if (updatedTeamDoc.exists()) {
          teamData.startingChallenge = updatedTeamDoc.data().startingChallenge;
        }
      }

      // Vérifier si c'est le tout début (pas de currentChallenge et pas de completedChallenges)
	  const hasCompletedChallenges = Array.isArray(completedChallenges) && completedChallenges.length > 0;
      const hasCurrentChallenge = teamData.currentChallenge;
      const hasCompletedChallenges = completedChallenges.length > 0;

      // Si c'est le tout début, mettre startingChallenge en currentChallenge
      if (!hasCurrentChallenge && !hasCompletedChallenges && teamData.startingChallenge) {
        console.log("First time - setting startingChallenge as currentChallenge:", teamData.startingChallenge);
        
        const teamRef = doc(db, "teams", userTeam);
        await updateDoc(teamRef, {
          currentChallenge: teamData.startingChallenge
        });
        
        console.log("currentChallenge set to:", teamData.startingChallenge);
        await loadTeamChallenges();
      }
      // If currentChallenge is set, call loadChallenges to display it
      else if (hasCurrentChallenge) {
        console.log("Loading challenges for the team...");
        await loadTeamChallenges();
      } else {
        console.log("No current challenge assigned yet.");
        await unlockNextChallenge();
        await loadTeamChallenges();
      }
    } else {
      console.error("Team document not found.");
    }
  } else {
    console.error("No team found for this user.");
  }
}


async function assignStartingChallengesToTeams() {
  // Fetch all available challenges
  const challengesSnapshot = await getDocs(collection(db, "challenges"));
  const allChallenges = challengesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Fetch all teams
  const teamsSnapshot = await getDocs(collection(db, "teams"));
  const teams = teamsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Collect assigned challenges to avoid duplicates
  let assignedChallenges = teams
    .filter((team) => team.startingChallenge) // Only take teams with starting challenges
    .map((team) => team.startingChallenge);

  // Iterate over each team and assign a challenge if not already assigned
  for (let team of teams) {
    // Skip the admin team
    if (team.id === "admin") {
      console.log(`Skipping admin team`);
      continue;
    }

    if (!team.startingChallenge) {
      // Find a challenge that hasn't been assigned yet
      const availableChallenges = allChallenges.filter(
        (challenge) => !assignedChallenges.includes(challenge.id)
      );

      if (availableChallenges.length > 0) {
        // Pick a random challenge from the available ones
        const randomChallenge =
          availableChallenges[
            Math.floor(Math.random() * availableChallenges.length)
          ];

        // Assign this challenge to the team
        await setDoc(
          doc(db, "teams", team.id),
          {
            startingChallenge: randomChallenge.id, // Save the challenge ID
          },
          { merge: true }
        );
        assignedChallenges.push(randomChallenge.id); // Mark it as assigned
        console.log(
          `Assigned challenge ${randomChallenge.id} to team ${team.id}`
        );
      } else {
        console.log(`No available challenges to assign for team ${team.id}`);
      }
    } else {
      console.log(`Team ${team.id} already has a starting challenge.`);
    }
  }
}

async function loadTeamChallenges() {
  if (!map) {
    console.error("Map is not initialized.");
    return; // Exit if map is not defined
  }

  const teamDoc = await getDoc(doc(db, "teams", userTeam));

  if (!teamDoc.exists()) {
    console.error("Team does not exist.");
    return;
  }

  const teamData = teamDoc.data();
  const completedChallenges = teamData.completedChallenges || [];
  const currentChallengeId = teamData.currentChallenge;

  // Fetch all challenges
  const challengesSnapshot = await getDocs(collection(db, "challenges"));
  const challenges = challengesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Log challenges data
  console.log("Challenges fetched:", challenges);

  // Function to attempt adding a marker
  const tryAddingMarker = async (markerFunction, challenge) => {
    try {
      await markerFunction(challenge);
      return; // Exit if successful
    } catch (error) {
      console.error(`Marker failed: ${error.message}`);
      // Wait before the next attempt
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    }
    console.error("Failed to add marker after multiple attempts.");
  };

  // Display marker for the current challenge
  if (currentChallengeId) {
    const currentChallenge = challenges.find(
      (challenge) => challenge.id === currentChallengeId
    );

    console.log("Current Challenge:", currentChallenge); // Log current challenge

    if (currentChallenge) {
      const currentMarkerFunction = async (challenge) => {
        console.log(challenge.name);
        try {
          const currentMarker = L.marker([challenge.lat, challenge.lng], {
            title: `Current Challenge: ${challenge.name}`,
            icon: L.icon({
              iconUrl:
                "https://firebasestorage.googleapis.com/v0/b/web-compass-df2fe.appspot.com/o/images%2Fmarker_current.png?alt=media&token=dc49e021-d228-46ae-99be-0ad8388a3842",
              iconSize: [50, 50],
            }),
          }).addTo(map);
          //.bindPopup(`<b>${challenge.name}</b>`, { closeButton: false });

          // Create a simple and stylish pop-up
          const popupContent = document.createElement("div");
          popupContent.style.padding = "10px";
          popupContent.style.textAlign = "center";
          popupContent.style.fontFamily = "'Arial', sans-serif";
          popupContent.style.fontSize = "14px";
          popupContent.style.fontWeight = "bold";
          popupContent.style.color = "#ffffff";
          popupContent.style.background =
            "linear-gradient(to right, #abd7ff, #4093df)";
          popupContent.style.borderRadius = "10px";
          popupContent.style.boxShadow = "0px 4px 6px rgba(0, 0, 0, 0.2)";
          popupContent.style.border = "1px solid #A9C9FF";

          popupContent.textContent = challenge.name;

          // Bind the custom-styled pop-up to the marker
          currentMarker.bindPopup(popupContent, { closeButton: false });

          // Add click event listener to the pop-up content directly
          popupContent.addEventListener("click", () => {
            console.log(challenge.challengeType);
			enableFullscreen();
            // Check if the challenge type is ball-maze-challenge
            if (challenge.challengeType === "ball-maze-challenge") {
              // Request permission if needed (for iOS devices)
              requestOrientationPermission();
            }

            openChallenge(challenge.id, challenge.challengeType); // Trigger your challenge opening function
          });
        } catch (error) {
          console.error("Error adding current challenge marker:", error);
          throw error; // Rethrow error to trigger retry
        }
      };

      await tryAddingMarker(currentMarkerFunction, currentChallenge);
    } else {
      console.error(
        "Current challenge not found in the challenges collection."
      );
    }
  }

  // Display markers for completed challenges
  for (const completedChallengeId of completedChallenges) {
    const completedChallenge = challenges.find(
      (challenge) => challenge.id === completedChallengeId
    );

    console.log("Completed Challenge:", completedChallenge); // Log completed challenge

    if (completedChallenge) {
      const completedMarkerFunction = async (challenge) => {
        try {
          const completedMarker = L.marker([challenge.lat, challenge.lng], {
            title: `Completed Challenge: ${challenge.name}`,
            icon: L.icon({
              iconUrl:
                "https://firebasestorage.googleapis.com/v0/b/web-compass-df2fe.appspot.com/o/images%2Fmarker_completed.png?alt=media&token=34e7d8e2-7d50-4dfe-991f-59d036536a4e",
              iconSize: [50, 50],
            }),
          }).addTo(map);
          //.bindPopup(`<b>${challenge.name}</b>`, { closeButton: false });

          // Create a simple and stylish pop-up
          const popupContent = document.createElement("div");
          popupContent.style.padding = "10px";
          popupContent.style.textAlign = "center";
          popupContent.style.fontFamily = "'Arial', sans-serif";
          popupContent.style.fontSize = "14px";
          popupContent.style.fontWeight = "bold";
          popupContent.style.color = "#ffffff";
          popupContent.style.background =
            "linear-gradient(to right, #c0ffb8, #69da5b)";
          popupContent.style.borderRadius = "10px";
          popupContent.style.boxShadow = "0px 4px 6px rgba(0, 0, 0, 0.2)";
          popupContent.style.border = "1px solid #A9C9FF";

          popupContent.textContent = challenge.name;

          // Bind the custom-styled pop-up to the marker
          completedMarker.bindPopup(popupContent, { closeButton: false });

          // Add click event listener to the pop-up content directly
          popupContent.addEventListener("click", () => {
            console.log(challenge.challengeType);
			enableFullscreen();
            // Check if the challenge type is ball-maze-challenge
            if (challenge.challengeType === "ball-maze") {
              // Request permission if needed (for iOS devices)
              requestOrientationPermission();
            }

            openChallenge(challenge.id, challenge.challengeType); // Trigger your challenge opening function
          });

          /*
          // Use a separate function to set up the pop-up click event
          completedMarker.on("popupopen", () => {
            const popupContent = document.createElement("div");
            popupContent.innerHTML = `<b>${challenge.name}</b>`;
            popupContent.style.cursor = "pointer"; // Change cursor to pointer
            popupContent.onclick = () => {
              openChallenge(challenge.id, challenge.challengeType); // Open the challenge
            };
            completedMarker.getPopup().setContent(popupContent);
          });
          */
        } catch (error) {
          console.error("Error adding completed challenge marker:", error);
          throw error; // Rethrow error to trigger retry
        }
      };

      await tryAddingMarker(completedMarkerFunction, completedChallenge);
    }
  }
}

// Function to open the challenge on the same page
function openChallenge(challengeId, challengeType) {
  if (challengeType === "phone-placement") {
    setHash({ page: "phone-placement-challenge", id: challengeId });
    //loadPage("phone-placement-challenge", challengeId);
  } else if (challengeType === "question") {
    setHash({ page: "challenge", id: challengeId });
    //loadPage("challenge", challengeId);
  } else if (challengeType === "camera") {
    setHash({ page: "camera-challenge", id: challengeId });
    //loadPage("camera-challenge", challengeId);
  } else if (challengeType === "light") {
    setHash({ page: "light-challenge", id: challengeId });
    //loadPage("light-challenge", challengeId);
  } else if (challengeType === "morse-code") {
    setHash({ page: "morse-code-challenge", id: challengeId });
    //loadPage("morse-code-challenge", challengeId);
  } else if (challengeType === "sound") {
    setHash({ page: "sound-challenge", id: challengeId });
    //loadPage("sound-challenge", challengeId);
  } else if (challengeType === "ball-maze") {
    setHash({ page: "ball-maze-challenge", id: challengeId });
    //loadPage("ball-maze-challenge", challengeId);
  } else if (challengeType === "compass") {
    setHash({ page: "compass-challenge", id: challengeId });
    //loadPage("compass-challenge", challengeId);
  } else {
    console.error("Unknown challenge type:", challengeType);
  }
  clearInterval(messageCheckInterval);
  clearInterval(positionCheckInterval);
}

async function unlockNextChallenge() {
  // Get the completed challenges for the user team
  const teamDoc = await getDoc(doc(db, "teams", userTeam));

  if (!teamDoc.exists()) {
    console.error("Team does not exist.");
    return;
  }

  const teamData = teamDoc.data();

  const completedChallenges = teamData.completedChallenges || [];
  const currentChallenge = teamData.currentChallenge || null;

  // Récupérer tous les challenges
  const challengesSnapshot = await getDocs(collection(db, "challenges"));
  const challenges = challengesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Trier les challenges par un ordre défini (exemple : ID, ordre personnalisé, etc.)
  challenges.sort((a, b) => a.order - b.order); // Assurez-vous que chaque challenge a un champ 'order'

  // Trouver l'index du challenge actuel
  let nextChallenge = null;
  // Si aucun challenge n'est en cours, prendre le premier non terminé
  nextChallenge = challenges.find((c) => !completedChallenges.includes(c.id));

  if (nextChallenge) {
    await setDoc(
      doc(db, "teams", userTeam),
      {
        ...teamData,
        currentChallenge: nextChallenge.id, // Store the ID of the current challenge
      },
      { merge: true }
    );
    console.log(`Prochain challenge sélectionné : ${nextChallenge.id}`);
  } else {
    console.log("Aucun challenge disponible.");
  }
}

async function unlockClosestChallenge() {
  const positionDoc = await getDoc(doc(db, "teams", userTeam)); // Get user's current position
  const userPosition = positionDoc.data().location;

  // Fetch all challenges to find the closest one
  const challengesSnapshot = await getDocs(collection(db, "challenges"));
  const challenges = challengesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Get the completed challenges for the user team
  const teamDoc = await getDoc(doc(db, "teams", userTeam));

  if (!teamDoc.exists()) {
    console.error("Team does not exist.");
    return;
  }

  const teamData = teamDoc.data();

  // If currentChallenge is empty, assign a random challenge
  if (!teamData.currentChallenge) {
    // Filter out completed challenges
    const completedChallenges = teamData.completedChallenges || [];
    const availableChallenges = challenges.filter(
      (challenge) => !completedChallenges.includes(challenge.id)
    );

    if (availableChallenges.length > 0) {
      let closestChallenge = null;
      let closestDistance = Infinity;

      challengesSnapshot.forEach((doc) => {
        const challenge = doc.data();
        const distance = calculateDistance(
          userPosition.lat,
          userPosition.lng,
          challenge.lat,
          challenge.lng
        );

        // Exclude the starting challenge and completed challenges
        if (
          distance < closestDistance &&
          !completedChallenges.includes(doc.id)
        ) {
          closestDistance = distance;
          closestChallenge = challenge;
        }
      });

      await setDoc(
        doc(db, "teams", userTeam),
        {
          ...teamData,
          currentChallenge: closestChallenge.id, // Store the ID of the current challenge
        },
        { merge: true }
      );

      console.log(
        `Assigned challenge ${closestChallenge.id} to team ${userTeam}`
      );
    } else {
      console.log(`No available challenges for team ${userTeam}`);
    }
  } else {
    console.log(
      `Team ${userTeam} already has an assigned current challenge: ${teamData.currentChallenge}`
    );
  }
}

// Function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
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

// Async function to mark messages as read by the current team
async function markMessagesAsRead() {
  const messagesQuery = query(
    collection(db, "voice-messages"),
    where("isAdmin", "==", true) // Only admin messages
  );

  try {
    const querySnapshot = await getDocs(messagesQuery);

    querySnapshot.forEach(async (doc) => {
      const messageData = doc.data();
      const readByArray = messageData.readby || [];

      // Check if the team hasn't already read this message
      const isReadByTeam = readByArray.some((entry) => entry.team === userTeam);

      if (!isReadByTeam) {
        // Add the team and timestamp to the readby array
        const newReadEntry = {
          team: userTeam,
          timestamp: new Date().toISOString(), // Add current timestamp
        };

        // Update the message with the new read entry
        await updateDoc(doc.ref, {
          isDisplayed: true,
        });
      }
    });

    if (notificationDot != null) {
      // Hide the notification dot after marking messages as read
      notificationDot.style.display = "none";
    }
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
}

// Function to check if orientation is allowed and request permission if not
function requestOrientationPermission() {
  // Check if the DeviceOrientationEvent is available
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission()
      .then((response) => {
        if (response === "granted") {
          console.log("Orientation permission granted.");
        } else {
          console.log("Orientation permission denied.");
        }
      })
      .catch((error) => {
        console.error("Error requesting orientation permission:", error);
      });
  } else {
    // If permission request is not needed (for Android or older iOS versions)
    console.log("Orientation permission is not required on this platform.");
  }
}
