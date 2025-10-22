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

await loadTeams();

let bestTime = null;

// Load teams from Firestore and avoid showing admin team
async function loadTeams() {
  try {
    const teamsSnapshot = await getDocs(collection(db, "teams"));
    const teams = [];

    teamsSnapshot.forEach((doc) => {
      const teamData = doc.data();
      const teamId = doc.id;
      const teamName = teamData.name;
      const finishTime = doc.finishTime ?? null;

      // Exclude the admin team and store teams that are not admin
      if (teamId !== "admin") {
        teams.push({name: teamName,finishTime: finishTime});
      }
    });

    // Process each team and create UI elements
    teams.forEach((team) => {
      const teamCard = document.createElement("div");
      teamCard.className = "team-card";
      teamCard.dataset.team = team.name;

      teamCard.innerHTML = ` <h2> ${team.name} </h2>
        <button class="record-time-button">Fin !</button> `;

      if (team.finishTime != null) {
        const finishTimeDiv = document.createElement("div");
        finishTimeDiv.className = "finish-time";
        finishTimeDiv.innerText = `Finish Time: ${team.finishTime}`;
        teamCard.appendChild(finishTimeDiv);
      }

      teamsContainer.appendChild(teamCard);

      // Ajouter un écouteur d'événement au bouton pour enregistrer le temps
      teamCard
		.querySelector(".record-time-button")
		.addEventListener("click", () => {
			recordTeamTime(team.name);
      });
    });

    const adminTeamRef = doc(db, "teams", "admin"); // Change this to your actual document path
    let chronoSaved = null;

    try {
      const adminTeamDoc = await getDoc(adminTeamRef);

      if (adminTeamDoc.exists()) {
        const adminTeamData = adminTeamDoc.data();
        chronoSaved = adminTeamData.chrono;
      } else {
        console.error("Admin team document does not exist.");
      }
    } catch(error) {
      console.error("Error getting team admin:", error);
    }

    if (chronoSaved > 0) {
	  startTime = chronoSaved;
	  updateChronoInterval = setInterval(updateChrono, 1000);
	  disableStartTimerButton();
    }

    document.getElementById("startTimer").addEventListener("click", async() => {
      startTime = chronoSaved > 0 ? chronoSaved: Date.now();
      console.log(startTime);
	  await saveChrono();
	  updateChronoInterval = setInterval(updateChrono, 1000);
	  disableStartTimerButton();
    });


  } catch(error) {
    console.error("Error loading teams:", error);
  }
}

function disableStartTimerButton()
{
	  const startButton = document.getElementById("startTimer");
      startButton.disabled = true;
      startButton.classList.add("disabled");
}

let startTime;
let updateChronoInterval;
let saveChronoInterval;
let elapsedTime = 0;
let timeDifference = 0;

function updateChrono() {
  const currentTime = Date.now();
  timeDifference = currentTime - startTime;
  const minutes = Math.floor(timeDifference / 60000);
  const seconds = Math.floor((timeDifference % 60000) / 1000);
  document.getElementById("chrono").innerText = `${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

async function saveChrono() {
  const adminTeamRef = doc(db, "teams", "admin"); // Change this to your actual document path

  try {
    await updateDoc(adminTeamRef, {
      chrono: startTime,
    });
    console.log("Chrono saved successfully.");
  } catch (error) {
    console.error("Error saving chrono:", error);
  }
}

// Fonction pour enregistrer le temps d'une équipe
async function recordTeamTime(teamName) {
  const teamRef = doc(db, "teams", teamName);
  const teamTime = document.getElementById("chrono").innerText;
  let diffTime = null;

  if (bestTime == null) {
    bestTime = teamTime;
  } else {
    diffTime = timeToSeconds(bestTime) - timeToSeconds(teamTime);

	console.log(teamName + " " + diffTime);
    await addPoints(teamName, diffTime);
  }

  // Ajouter une div pour afficher le temps de l'équipe
  const teamCard = document.querySelector(
    `.team-card[data-team="${teamName}"]`
  );
  const finishTimeDiv = document.createElement("div");
  finishTimeDiv.className = "finish-time";
  finishTimeDiv.innerText = `Finish Time: ${teamTime}`;
  teamCard.appendChild(finishTimeDiv);

  // Désactiver le bouton de fin
  const recordButton = teamCard.querySelector(".record-time-button");
  recordButton.disabled = true;
  recordButton.classList.add("disabled");

  await updateDoc(teamRef, {
    finishTime: teamTime,
  });
}

// Fonction pour convertir le temps en secondes
function timeToSeconds(time) {
  const [minutes, seconds] = time.split(":").map(Number);
  return minutes * 60 + seconds;
}
