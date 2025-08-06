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
  "https://firebasestorage.googleapis.com/v0/b/web-compass-df2fe.appspot.com/o/images%2F1.png?alt=media&token=aa3b5ac3-0182-4c67-b4b4-06fde649bf7e",
  "https://firebasestorage.googleapis.com/v0/b/web-compass-df2fe.appspot.com/o/images%2F2.png?alt=media&token=1e06d425-ebe4-4820-9961-03c97574e941",
  "https://firebasestorage.googleapis.com/v0/b/web-compass-df2fe.appspot.com/o/images%2F3.png?alt=media&token=c2a7e6f7-1536-4fc0-9257-54c20f1c14b7",
  "https://firebasestorage.googleapis.com/v0/b/web-compass-df2fe.appspot.com/o/images%2F4.png?alt=media&token=82f602aa-af13-482e-909f-048f775b3934",
  "https://firebasestorage.googleapis.com/v0/b/web-compass-df2fe.appspot.com/o/images%2F5.png?alt=media&token=82521bc0-db98-42a9-9748-50b828ae805f",
  "https://firebasestorage.googleapis.com/v0/b/web-compass-df2fe.appspot.com/o/images%2F6.png?alt=media&token=fe1bb26c-9730-413d-9684-976c63e5b907",
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
