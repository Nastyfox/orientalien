import { initializeApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-firestore.js";

import { v4 as uuidv4 } from "https://jspm.dev/uuid";

import {
  getUserTeam,
  getOrCreateUniqueId,
  loadPage,
  setHash,
} from "./utils.js";

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
const phoneId = getOrCreateUniqueId(); // Get the user's phone ID

// Click Counter Variables
let clickCount = 0;
const maxClicks = 7;
let clickTimeout;

let modal = null;
let modalContent = null;

export function initializePageScripts() { 
  const usersRef = collection(db, "users");

  onSnapshot(usersRef, (snapshot) => {
    const users = snapshot.docs.map((doc) => doc.data());
    const selectedTeamCard = document.querySelector(".team-card.selected");
    if (selectedTeamCard) {
      const teamName = selectedTeamCard.dataset.team;
      const roleSelect = selectedTeamCard.querySelector(".role-select");
      loadRolesForTeamCard(teamName, roleSelect);
    }
  });

  modal = document.getElementById("modal");
  modalContent = modal.querySelector(".modal-content");

  checkUserAndLoadMap(phoneId);
}

// Clear the teams container before loading the admin team
function clearTeamsContainer() {
  const teamsContainer = document.getElementById("teams-container");
  if (teamsContainer) {
    teamsContainer.innerHTML = ""; // Clear all content
  }
}

async function loadTeamsFromFirebase(showAdmin) {
  const teamsContainer = document.getElementById("teams-container");

  if (!teamsContainer) {
    console.error("Teams container not found.");
    return;
  }

  try {
    const teamsSnapshot = await getDocs(collection(db, "teams"));
    const teams = [];

    teamsSnapshot.forEach((doc) => {
      const teamData = doc.data();
      const teamName = teamData.name;

      // Only display the "admin" team if showAdmin is true
      if (doc.id !== "admin" || showAdmin) {
        teams.push({
          id: doc.id,
          name: teamName,
          roles: teamData.roles,
          logo: teamData.logoUrl,
          color: teamData.color,
        });
      }
    });

    // 🔹 Charge une première fois les rôles
    const takenRoles = await getTakenRoles();

    // 🔹 Écoute en temps réel les changements dans "users"
    onSnapshot(collection(db, "users"), async () => {
      const updatedTakenRoles = await getTakenRoles();
      renderTeamsAndRoles(teams, updatedTakenRoles);
    });
  } catch (error) {
    console.error("Error loading teams from Firebase:", error);
  }
}

// 🔹 Affiche les équipes et met à jour les rôles disponibles
async function renderTeamsAndRoles(teams, takenRoles) {
  const teamsContainer = document.getElementById("teams-container");

  // Au lieu de vider complètement, on va mettre à jour ou ajouter des équipes
  for (const team of teams) {
    // Vérifier si l'équipe existe déjà dans le conteneur
    let teamCard = teamsContainer.querySelector(`[data-team-id="${team.id}"]`);

    // Si l'équipe n'existe pas, la créer
    if (!teamCard) {
      teamCard = document.createElement("div");
      teamCard.className = "team-card";
      teamCard.dataset.team = team.name;
      teamCard.dataset.teamId = team.id;

      teamCard.innerHTML = `
        <div class="background-name" style="background: #${team.color};">
          <div class="team-info">
            <div class="team-logo">
              <img src="${team.logo}" alt="${team.name} Logo" class="team-logo-img">
            </div>
            <h2 class="team-name">${team.name}</h2>
          </div>
        </div>
        <div class="roles-container"></div>
      `;

      teamCard.addEventListener("click", () => {
        openTeamModal(team.id, team.name);
      });

      teamsContainer.appendChild(teamCard);
    } else {
      /*
      // Mettre à jour les informations de l'équipe si nécessaire
      const backgroundName = teamCard.querySelector(".background-name");
      if (backgroundName) backgroundName.style.background = `#${team.color}`;

      const teamNameElement = teamCard.querySelector(".team-name");
      if (teamNameElement) teamNameElement.textContent = team.name;

      const teamLogoImg = teamCard.querySelector(".team-logo-img");
      if (teamLogoImg) {
        teamLogoImg.src = team.logo;
        teamLogoImg.alt = `${team.name} Logo`;
      }
      */
    }

    // Récupérer le conteneur de rôles pour cette équipe
    const rolesContainer = teamCard.querySelector(".roles-container");

    // Mettre à jour les rôles pour cette équipe
    await loadRolesForTeamCard(team.id, rolesContainer, takenRoles);
  }

  // Optionnel: supprimer les équipes qui ne sont plus dans la liste
  const existingTeamCards = teamsContainer.querySelectorAll(".team-card");
  existingTeamCards.forEach((card) => {
    const teamId = card.dataset.teamId;
    if (!teams.some((team) => team.id === teamId)) {
      card.remove();
    }
  });
}

// 🔹 Récupère tous les rôles déjà pris dans la collection "users"
async function getTakenRoles() {
  const usersSnapshot = await getDocs(collection(db, "users"));
  const takenRoles = new Set();

  usersSnapshot.forEach((doc) => {
    const userData = doc.data();
    if (userData.team && userData.role) {
      takenRoles.add(`${userData.team}-${userData.role}`);
    }
  });

  return takenRoles;
}

async function loadRolesForTeamCard(teamName, rolesContainer, takenRoles) {
  // Récupérer les données de l'équipe
  const teamDoc = await getDoc(doc(db, "teams", teamName));
  if (!teamDoc.exists()) return;

  const teamData = teamDoc.data();
  if (!teamData.roles || teamData.roles.length === 0) return;

  // Supprimer les rôles qui sont maintenant pris
  const existingRoleItems = rolesContainer.querySelectorAll(".role-item");
  existingRoleItems.forEach((roleItem) => {
    const roleName = roleItem.dataset.role;
    if (takenRoles.has(`${teamName}-${roleName}`)) {
      roleItem.remove();
    }
  });

  // Ajouter les rôles qui ne sont pas encore affichés et qui ne sont pas pris
  teamData.roles.forEach((roleName) => {
    if (!takenRoles.has(`${teamName}-${roleName}`)) {
      // Vérifier si ce rôle existe déjà dans le conteneur
      const existingRole = rolesContainer.querySelector(
        `.role-item[data-role="${roleName}"]`
      );
      if (!existingRole) {
        const roleItem = document.createElement("div");
        roleItem.className = "role-item";
        roleItem.dataset.role = roleName;
        roleItem.textContent = roleName;

        rolesContainer.appendChild(roleItem);
      }
    }
  });
}

function openTeamModal(teamID, teamName) {
  enableFullscreen();

  // Prevent scrolling on the body and html when the modal is open
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  // Select the team card for the given teamID
  const teamCard = document.querySelector(
    `.team-card[data-team-id="${teamID}"]`
  );

  // Ensure the team card exists
  if (teamCard) {
    // Clone the team card
    const modalCard = teamCard.cloneNode(true);
    modalCard.classList.add("modal-card");

    // Fetch the team's color
    getDoc(doc(db, "teams", teamID)).then((docSnap) => {
      if (docSnap.exists()) {
        const teamData = docSnap.data();
        const teamColor = teamData.color || "4caf50"; // Default to green if no color

        // Add the "Close Modal" button if not already present
        const closeButton = document.createElement("span");
        closeButton.id = "close-modal";
        closeButton.className = "close";
        closeButton.innerHTML = "&times;";
        closeButton.addEventListener("click", closeTeamModal);
        modalCard.appendChild(closeButton);

        // Add the "Register" button if not already present
        const registerButton = document.createElement("button");
        registerButton.id = "register-button";
        registerButton.innerText = "Rejoindre";
        registerButton.style.backgroundColor = `#${teamColor}`; // Set background color
        registerButton.style.color = "#ffffff"; // White text for contrast
        registerButton.addEventListener("click", () => {
          const selectedRole = document.querySelector(
            ".role-item.selected-role"
          );
          if (selectedRole) {
            registerUser(
              teamID,
              selectedRole.dataset.role,
              getOrCreateUniqueId()
            );
          }
        });

        modalCard.appendChild(registerButton);

        // Add click event listener for the role items
        const roleItems = modalCard.querySelectorAll(".role-item");
        roleItems.forEach((roleItem) => {
          roleItem.classList.remove("disabled");
          roleItem.addEventListener("click", (event) => {
            selectRole(roleItem, teamColor);
          });
        });
      }
    });

    // Clear and append modal content
    const modalContent = document.getElementById("modal-content");
    modalContent.innerHTML = ""; // Clear any old content
    modalContent.appendChild(modalCard);

    // Show the modal
    const modal = document.getElementById("modal");
    modal.style.display = "flex"; // Make it visible

    // 🔹 Écoute en temps réel les changements dans "users" pour mettre à jour les rôles
    onSnapshot(collection(db, "users"), async () => {
      await updateRolesInModal(teamID);
    });

    // Add click listener to the modal background to close on outside click
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeTeamModal();
      }
    });
  } else {
    console.error(`Team card with ID ${teamID} not found.`);
  }
}

// 🔹 Met à jour uniquement les rôles dans le modal
async function updateRolesInModal(teamID) {
  const rolesContainer = document.querySelector(
    `#modal-content .roles-container`
  );
  if (!rolesContainer) return;

  const takenRoles = await getTakenRoles(); // Récupère les rôles déjà pris

  const teamDoc = await getDoc(doc(db, "teams", teamID));
  if (!teamDoc.exists()) {
    console.error(`Team ${teamID} not found.`);
    return;
  }

  const teamData = teamDoc.data();
  if (!teamData.roles) return;

  // Parcourir les éléments existants et supprimer ceux qui sont pris
  const existingRoleItems = rolesContainer.querySelectorAll(".role-item");
  existingRoleItems.forEach((roleItem) => {
    const roleName = roleItem.dataset.role;
    if (takenRoles.has(`${teamID}-${roleName}`)) {
      roleItem.remove();
    }
  });

  // Ajouter les rôles qui ne sont pas encore affichés
  teamData.roles.forEach((roleName) => {
    // Vérifier si le rôle n'est pas pris et n'est pas déjà affiché
    if (!takenRoles.has(`${teamID}-${roleName}`)) {
      // Vérifier si ce rôle existe déjà dans le conteneur
      const existingRole = rolesContainer.querySelector(
        `.role-item[data-role="${roleName}"]`
      );
      if (!existingRole) {
        // Créer et ajouter le rôle s'il n'existe pas déjà
        const roleItem = document.createElement("div");
        roleItem.className = "role-item";
        roleItem.dataset.role = roleName;
        roleItem.textContent = roleName;

        roleItem.addEventListener("click", () => selectRole(roleItem, teamID));

        rolesContainer.appendChild(roleItem);
      }
    }
  });
}

// Function to close the modal
function closeTeamModal() {
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";

  modal.style.display = "none"; // Hide the modal

  // Remove dynamically added buttons
  const closeButton = modal.querySelector("#close-modal");
  if (closeButton) closeButton.remove();

  const registerButton = modal.querySelector("#register-button");
  if (registerButton) registerButton.remove();
}

function selectRole(roleItem, teamColor) {
  const roleItems = document.querySelectorAll(".role-item");
  roleItems.forEach((item) => {
    item.classList.remove("selected-role");
    item.style.backgroundColor = "";
  });
  roleItem.style.backgroundColor = `#${teamColor}`;
  roleItem.classList.add("selected-role");
}

// Call this function after registering the user
async function registerUser(team, role, phoneId) {
  // Create user data
  const userData = {
    team: team,
    role: role,
    phoneId: phoneId,
    timestamp: serverTimestamp(),
  };

  // Add user data to Firebase Firestore
  try {
    await addDoc(collection(db, "users"), userData);
    console.log("Successfully registered!");

    // Check if the user exists and load the appropriate map
    await checkUserAndLoadMap(phoneId);
  } catch (error) {
    console.error("Error adding document: ", error);
  }
}

// After initializing Firebase and setting up variables...

async function checkUserAndLoadMap(phoneId) {
  console.log(phoneId);
  try {
    const userRef = collection(db, "users");
    const q = query(userRef, where("phoneId", "==", phoneId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      // Check if the user is an admin
      if (userData.role === "admin") {
        console.log("Map admin load");
        setHash({ page: "map-admin" });
        //loadPage("map-admin"); // Load admin map
      } else {
        console.log("Map load");
        setHash({ page: "map" });
        //loadPage("map"); // Load normal user map
      }
    } else {
      // All the initialization logic here
      const topLeftCorner = document.createElement("div");
      topLeftCorner.style.position = "absolute";
      topLeftCorner.style.top = "0";
      topLeftCorner.style.left = "0";
      topLeftCorner.style.width = "50px";
      topLeftCorner.style.height = "50px";
      topLeftCorner.style.zIndex = "9999"; // Ensure it's on top
      topLeftCorner.style.pointerEvents = "auto"; // Makes it clickable but invisible
      topLeftCorner.style.opacity = "0"; // Invisible

      document.body.appendChild(topLeftCorner);

      // Listen for clicks on the top-left corner
      topLeftCorner.addEventListener("click", () => {
        clickCount++;

        if (clickTimeout) {
          clearTimeout(clickTimeout);
        }

        // Reset the counter after 2 seconds of inactivity
        clickTimeout = setTimeout(() => {
          clickCount = 0;
        }, 2000);

        // When clicked 7 times, show the admin team
        if (clickCount === maxClicks) {
          clearTeamsContainer(); // Clear the displayed teams
          loadTeamsFromFirebase(true); // Pass true to show the admin team
          alert("Admin team revealed!");
        }
      });

      const splashScreen = document.getElementById("splash-screen");
      const mainContent = document.getElementById("main-content");

      splashScreen.style.display = "flex";

      // Display the splash screen for 3 seconds, then hide it
      setTimeout(() => {
        splashScreen.classList.add("hidden"); // Add the fade-out class
        setTimeout(() => {
          splashScreen.style.display = "none"; // Hide it completely after fading out
          mainContent.style.display = "block"; // Show the main content
        }, 500); // Match the CSS transition duration (0.5s)
      }, 3000);

      // User does not exist; show the team options for registration
      loadTeamsFromFirebase(false); // Load teams for normal users
    }
  } catch (error) {
    console.error("Error checking user existence:", error);
  }
}

// Function to enable fullscreen mode
function enableFullscreen() {
  console.log("ENABLE FULLSCREEN");
  const docElement = document.documentElement;
  if (docElement.requestFullscreen) {
    docElement.requestFullscreen();
  } else if (docElement.mozRequestFullScreen) {
    docElement.mozRequestFullScreen(); // Firefox
  } else if (docElement.webkitRequestFullscreen) {
    console.log("HERE");
    docElement.webkitRequestFullscreen(); // Chrome, Safari, Opera
  } else if (docElement.msRequestFullscreen) {
    docElement.msRequestFullscreen(); // IE/Edge
  }
}
