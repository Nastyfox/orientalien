import {
  collection,
  getDoc,
  getFirestore,
  doc,
  updateDoc,
  arrayUnion,
  getDocs,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-firestore.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";

import {
  getUserTeam,
  getOrCreateUniqueId,
  loadPage,
  setHash,
  initializeNotes
} from "./utils.js";

import { getCombination, codeCheck } from "./combination-lock.js";

import Fireworks from "https://cdn.jsdelivr.net/npm/fireworks-js@2.10.8/+esm";

let fireworks = null;

export function createFireworks(fireworksContainer) {
  fireworks = new Fireworks(fireworksContainer, {
    autoresize: true,
    acceleration: 1.05,
    friction: 0.97,
    gravity: 1.5,
    particles: 50,
    traceLength: 3,
    traceSpeed: 10,
    explosion: 5,
    intensity: 30,
    flickering: 50,
    lineStyle: "round",
    hue: {
      min: 0,
      max: 360,
    },
    delay: {
      min: 15,
      max: 30,
    },
    rocketsPoint: {
      min: 50,
      max: 50,
    },
    lineWidth: {
      explosion: {
        min: 1,
        max: 3,
      },
      trace: {
        min: 1,
        max: 2,
      },
    },
    brightness: {
      min: 50,
      max: 80,
    },
    decay: {
      min: 0.015,
      max: 0.03,
    },
    sound: {
      enabled: true,
      files: [
        "https://firebasestorage.googleapis.com/v0/b/web-compass-df2fe.appspot.com/o/sounds%2Ffirework1.mp3?alt=media&token=927f93b8-408e-4abd-b07d-682a6d981eb7",
        "https://firebasestorage.googleapis.com/v0/b/web-compass-df2fe.appspot.com/o/sounds%2Ffirework2.mp3?alt=media&token=03e5ce5c-333f-406e-b513-ae79b9999534",
        "https://firebasestorage.googleapis.com/v0/b/web-compass-df2fe.appspot.com/o/sounds%2Ffirework3.mp3?alt=media&token=4cce1a73-4c15-4ac3-89f5-4391577b64ed",
        "https://firebasestorage.googleapis.com/v0/b/web-compass-df2fe.appspot.com/o/sounds%2Ffirework4.mp3?alt=media&token=6e3ca566-a79f-4024-8954-62faa1c39a55",
        "https://firebasestorage.googleapis.com/v0/b/web-compass-df2fe.appspot.com/o/sounds%2Ffirework5.mp3?alt=media&token=dd84ac29-37cf-4d60-b0bb-c24063ff7c27",
      ],
    },
  });
}

export function startFireworks() {
  fireworks.start();
}

export function stopFireworks() {
  fireworks.stop();
}

let fireworksContainer = null;

// Function to trigger fireworks
async function triggerFireworks() {
  fireworksContainer = document.getElementById("fireworks-container");
  return new Promise((resolve) => {
    createFireworks(fireworksContainer);
    startFireworks();
    // Resolve the promise after the fireworks animation is complete (1 second)
    setTimeout(resolve, 3000);
  });
}

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
let targetId = 0;

export async function completeChallenge(targetId) {
  const userTeam = await getUserTeam(db, phoneId);
  const userTeamRef = doc(db, "teams", userTeam); // Adjust as necessary to get the correct document

  const userTeamDoc = await getDoc(doc(db, "teams", userTeam));
  const completedChallenges = userTeamDoc.data().completedChallenges;

  if (!completedChallenges.includes(targetId)) {
    const challengeDoc = await getDoc(doc(db, "challenges", targetId));
    const challengeDocData = challengeDoc.data();

    await addPoints(userTeam, challengeDocData.points);
  }

  try {
    await updateDoc(userTeamDoc, {
      completedChallenges: arrayUnion(targetId.toString()), // Use the imported arrayUnion function
      currentChallenge: null, // Clear the current challenge
    });
    console.log("Challenge completed and added to completedChallenges");
  } catch (error) {
    console.error("Error updating challenge:", error);
  }

  //goBack();
}

// Function to go back to the map
export function goBack() {
  console.log("LOAD MAP");
  setHash({ page: "map" });
  location.reload();
  console.log("Here");
  //loadPage("map");
}

// Function to convert vh to pixels for responsiveness
export function vhToPx(vh) {
  return (vh / 100) * window.innerHeight;
}

export function vwToPx(vw) {
  return (vw / 100) * window.innerWidth;
}

export function pxToVh(px) {
  return (px * 100) / window.innerHeight;
}

export function pxToVw(px) {
  return (px * 100) / window.innerWidth;
}

// Function to load challenge data from Firestore
export async function loadChallenge(challengeId, type = "answer") {
  targetId = challengeId; // Use the passed challengeId instead of extracting from URL
  console.log(targetId);

  try {
    const challengeDoc = await getDoc(doc(db, "challenges", targetId));

    if (challengeDoc.exists()) {
      console.log("Challenge exists");
      const target = challengeDoc.data();
      console.log(target);
      if (document.getElementById("challenge") != null) {
        document.getElementById("challenge").innerHTML = `
        <p>${target.question}</p>
      `;
      }
      if (type == "answer") {
        window.targetAnswer = target.answer; // Store the correct answer
      } else if (type == "code") {
        window.targetAnswer = target.code; // Store the correct answer
      }

      initializeNotes();
    } else {
      document.getElementById("challenge").innerHTML = "Challenge not found.";
    }
  } catch (error) {
    console.error("Error loading challenge:", error);
  }

  return targetId;
}

// Get the number of users in the current team from Firestore
export async function getTeamInfos(teamName) {
  const usersRef = collection(db, "users");
  const querySnapshot = await getDocs(usersRef);

  let userCount = 0;
  let currentUserCount = 0;
  let listUsers = [];
  let teamInfosAvailable = false;

  querySnapshot.forEach((doc) => {
    const userData = doc.data();
    if (userData.team === teamName) {
      listUsers.push(userData);
      userCount++; // Count users in the same team
      teamInfosAvailable = true;
    }
    if (userData.phoneId === phoneId) {
      currentUserCount = userCount;
    }
  });

  if (!teamInfosAvailable) {
    return null;
  }

  const returnArray = [userCount, currentUserCount, listUsers];
  return returnArray;
}

export async function updateTeamArray(teamName, array, index) {
  const challengeRef = doc(db, "challenges", targetId); // Change this to your actual document path

  try {
    const challengeDoc = await getDoc(challengeRef);

    if (challengeDoc.exists()) {
      const challengeData = challengeDoc.data();
      let teamArray = challengeData[teamName] || []; // Get the current array for the team, or an empty array if it doesn't exist

      if (teamArray.length < index) {
        for (let i = teamArray.length; i <= index; i++) {
          teamArray.push(array);
        }
      } else {
        teamArray[index] = array;
      }

      // Update the Firestore document with the new/updated array
      await updateDoc(challengeRef, {
        [teamName]: teamArray,
      });

      console.log(`Team array updated successfully for team: ${teamName}`);
    } else {
      console.error("Challenge document does not exist.");
    }
  } catch (error) {
    console.error("Error updating team array:", error);
  }
}

// Function to check the user's answer
export async function checkAnswer(userAnswer, answerElement, targetId) {
  const resultDiv = document.getElementById("result");
  let correctAnswer = false;

  const userTeam = await getUserTeam(db, phoneId);
  const challengeDoc = await getDoc(doc(db, "challenges", targetId));
  const challengeDocData = challengeDoc.data();

  // Check if targetAnswer is defined
  if (!window.targetAnswer) {
    resultDiv.innerHTML =
      "<span style='color: red;'>No challenge answer available.</span>";
    return;
  }

  window.targetAnswer.forEach((answer) => {
    if (userAnswer.toLowerCase() === answer.toLowerCase()) {
      correctAnswer = true;
    }
  });

  if (correctAnswer) {
    let array = { challengeEnded: true };
    await updateTeamArray(userTeam, array, 0);
  } else {
    incorrectAnswer(answerElement, userTeam, -challengeDocData.points / 10);
  }
}

// Dans utils-challenge.js
export function listenChallengeChanges(teamName, database, target) {
  const challengeDoc = doc(database, "challenges", target);

  return onSnapshot(challengeDoc, async (docSnapshot) => {
    const teamDataChallenge = docSnapshot.data()?.[teamName];
    if (teamDataChallenge) {
      if (teamDataChallenge[0].challengeEnded) {
        await triggerFireworks();
        stopFireworks();

        // Clear currentChallenge and add to completedChallenges
        await completeChallenge(targetId);
      }
    }
  });
}

export function incorrectAnswer(answerElement, teamId, negativePoints) {
  answerElement.classList.add("incorrect-answer");

  addPoints(teamId, negativePoints);

  // Optional: remove the animation class after the animation ends
  setTimeout(() => {
    answerElement.classList.remove("incorrect-answer");
  }, 500); // Duration matches the animation length
}

export async function addPoints(teamId, points) {
  const userTeamRef = doc(db, "teams", teamId);
  const userTeamDoc = await getDoc(doc(db, "teams", teamId));
  const userTeamData = userTeamDoc.data();

  const newPoints = userTeamData.points + points;

  try {
    await updateDoc(userTeamRef, {
      points: newPoints, // Use the imported arrayUnion function
    });
    console.log("Points added");
  } catch (error) {
    console.error("Error updating challenge:", error);
  }
}

export async function displayHints(teamId) {
  const hintContainer = document.getElementById("hintsContent");
  clearDivs(hintContainer);

  let teamHintIndex;

  const challengeRef = doc(db, "challenges", targetId); // Change this to your actual document path

  try {
    const challengeDoc = await getDoc(challengeRef);

    if (challengeDoc.exists()) {
      const challengeData = challengeDoc.data();
      const hints = challengeData.hints;
      const hintsText = hints.hintsText;
      let teamArray = challengeData[teamId] || []; // Get the current array for the team, or an empty array if it doesn't exist

      // Ensure that the array exists and is not empty before accessing the first element
      if (teamArray.length > 2) {
        teamHintIndex = teamArray[2].hintIndex; // Safely access hintIndex for current team

        for (let i = 0; i <= teamHintIndex; i++) {
          // Créer une nouvelle div pour l'indice
          const hintDiv = document.createElement("div");
          hintDiv.classList.add("hint");
          hintDiv.innerHTML = `
         <p> <b>Indice : </b> ${hintsText[i]}</p>
      `;

          // Ajouter la nouvelle div avant le bouton
          hintContainer.appendChild(hintDiv);
        }
      } else {
        console.log("Team array doesn't contain hints or not found.");
        teamHintIndex = -1;
      }
    } else {
      console.error("Challenge document does not exist.");
      teamHintIndex = -1;
    }
  } catch (error) {
    console.error("Error getting hints:", error);
    teamHintIndex = -1;
  }

  const hintModal = document.getElementById("hintModal");
  hintModal.style.display = "flex";
  return teamHintIndex + 1;
}

export function closeHints() {
  const hintModal = document.getElementById("hintModal");
  hintModal.style.display = "none";
}

export function clearDivs(parentContainer) {
  const divs = parentContainer.querySelectorAll("div");
  divs.forEach((div) => div.remove());
}

export async function updateNextHintCost(targetId, nextHintIndex) {
  const challengeRef = doc(db, "challenges", targetId); // Change this to your actual document path
  try {
    const challengeDoc = await getDoc(challengeRef);

    if (challengeDoc.exists()) {
      const challengeData = challengeDoc.data();
      const hints = challengeData.hints;
      const hintsCost = hints.hintsCost;
      const hintCostContainer = document.getElementById("hintCost");
      const newHintButton = document.getElementById("newHint");

      if (nextHintIndex < hintsCost.length) {
        console.log(hintsCost[nextHintIndex]);

        hintCostContainer.innerHTML =
          "Coût du prochain indice : " + hintsCost[nextHintIndex] + " points";
      } else {
        hintCostContainer.innerHTML = "Tous les indices ont été récupérés !";
        newHintButton.style.display = "none";
      }
    } else {
      console.error("Challenge document does not exist.");
    }
  } catch (error) {
    console.error("Error updating hint cost:", error);
  }
}

export async function getNewHint(targetId, teamId, hintIndex) {
  const challengeRef = doc(db, "challenges", targetId); // Change this to your actual document path

  try {
    const challengeDoc = await getDoc(challengeRef);

    if (challengeDoc.exists()) {
      const challengeData = challengeDoc.data();
      const hints = challengeData.hints;
      const hintsText = hints.hintsText;
      const hintsCost = hints.hintsCost;

      if (hintIndex < hintsText.length) {
        const hintContainer = document.getElementById("hintsContent");
        const hintButton = document.getElementById("newHint");

        await addPoints(teamId, -hintsCost[hintIndex]);

        // Créer une nouvelle div pour l'indice
        const hintDiv = document.createElement("div");
        hintDiv.classList.add("hint");
        hintDiv.innerHTML = `
        <p> <b>Indice : </b> ${hintsText[hintIndex]}</p>
      `;

        // Ajouter la nouvelle div avant le bouton
        hintContainer.appendChild(hintDiv);

        let hintsArray = { hintIndex: hintIndex };
        await updateTeamArray(teamId, hintsArray, 2);
      }
    } else {
      console.error("Challenge document does not exist.");
    }
  } catch (error) {
    console.error("Error updating hints:", error);
  }
}

export function initHints(teamName, hintIndex) {
  document.getElementById("hintButton").addEventListener("click", async () => {
    hintIndex = await displayHints(teamName);
    console.log(hintIndex);
    await updateNextHintCost(targetId, hintIndex);
  });
  document.getElementById("closeHints").addEventListener("click", closeHints);
  document.getElementById("newHint").addEventListener("click", async () => {
    getNewHint(targetId, teamName, hintIndex);
    hintIndex = hintIndex + 1;
    await updateNextHintCost(targetId, hintIndex);
  });

  return hintIndex;
}

export function initSubmitAndBack(submit = true, back = true) {
  if (submit) {
    const submitButton = document.getElementById("submitAnswerButton");
    if (submitButton) {
      submitButton.addEventListener("click", () => {
        const userAnswer = document.getElementById("answer").value.trim();
        const answerElement = document.getElementById("answer"); // Replace with your actual answer element
        checkAnswer(userAnswer, answerElement, targetId);
      });
    } else {
      console.error("Submit button not found");
    }
  }

  if (back) {
    document.getElementById("backButton").addEventListener("click", goBack);
  }
}

export function checkCombination(targetId) {
  let combo = getCombination();
  codeCheck(combo, targetId);
}
