// Import the Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-storage.js";

import { v4 as uuidv4 } from "https://jspm.dev/uuid";

import { getUserTeam, getOrCreateUniqueId } from "./utils.js";

import { addPoints } from "./utils-challenge.js";

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
// Initialize Firestore
const db = getFirestore(app);
const storage = getStorage(app);

// DOM elements
const teamsContainer = document.getElementById("teams-container");

// Global variables
let userTeamName = null;
const phoneId = getOrCreateUniqueId(); // Get the user's phone ID

loadTeams();

let rankingImages = [
  "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/1.png?v=1739807442392",
  "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/2.png?v=1739807439638",
  "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/3.png?v=1739807436206",
  "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/4.png?v=1739806983715",
  "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/5.png?v=1739806985719",
  "https://cdn.glitch.global/7ce7c2ee-b72f-4eeb-bae8-ea194d64bf0c/6.png?v=1739806987727",
];

let bestTime = null;

// Load teams from Firestore and avoid showing admin team
async function loadTeams() {
  try {
    const teamsSnapshot = await getDocs(collection(db, "teams"));
    const teams = [];

    teamsSnapshot.forEach((doc) => {
      const teamData = doc.data();
      const teamId = doc.id;
      // Exclude the admin team and store teams that are not admin
      if (teamId !== "admin") {
        teams.push({
          name: teamData.name,
          finishTime: teamData.finishTime,
          points: teamData.points,
          logo: teamData.logoUrl,
          color: teamData.color,
        });
      }
    });

    teams.sort((a, b) => b.points - a.points);

    // Process each team and create UI elements
    teams.forEach((team, index) => {
      const teamContainer = document.createElement("div");
      teamContainer.className = "team-container";

      const teamRank = document.createElement("img");
      teamRank.className = "rank-number";
      teamRank.src = `${rankingImages[index]}`;

      teamContainer.appendChild(teamRank);

      const teamCard = document.createElement("div");
      teamCard.className = "team-card";
      teamCard.dataset.team = team.name;

      teamCard.innerHTML = `
      <div class="background-name" style="background: #${team.color};">
        <div class="team-info">
          <div class="team-logo">
            <img src="${team.logo}" alt="${team.name} Logo" class="team-logo-img">
          </div>
          <h2 class="team-name"">${team.name}</h2>
        </div>
      </div>
      `;

      if (team.finishTime == null) {
        team.finishTime = "00:00";
      }
      const finishTimeDiv = document.createElement("div");
      finishTimeDiv.className = "finish-time";
      finishTimeDiv.innerText = `Temps : ${team.finishTime}`;
      teamCard.appendChild(finishTimeDiv);

      const pointsDiv = document.createElement("div");
      pointsDiv.className = "points";
      pointsDiv.innerText = `Points : ${team.points}`;
      teamCard.appendChild(pointsDiv);

      teamContainer.appendChild(teamCard);

      teamsContainer.appendChild(teamContainer);
    });
  } catch (error) {
    console.error("Error loading teams:", error);
  }
}
