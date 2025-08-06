import {
  goBack,
  completeChallenge,
  loadChallenge,
  getTeamInfos,
  updateTeamArray,
  initHints,
  initSubmitAndBack,
  incorrectAnswer,
  checkCombination,
  listenChallengeChanges,
} from "./utils-challenge.js";

import {
  collection,
  getDoc,
  getFirestore,
  doc,
  updateDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-firestore.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";

import { getUserTeam, getOrCreateUniqueId, loadPage } from "./utils.js";

import { initCombinationLock, getEnterButton } from "./combination-lock.js";

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

let targetId; // Make targetId a global variable
let teamName;
let hintIndex = 0;

let lock;
let inputElement;
let submitButton;

export async function initializePageScripts(challengeId) {
  if (challengeId) {
    console.log(`Challenge ID: ${challengeId}`);
    targetId = await loadChallenge(challengeId, "code"); // Use the challengeId to load the data
    teamName = await getUserTeam(db, phoneId);

    initSubmitAndBack(false, true);

    submitButton = document.getElementById("submitAnswerButton");
    inputElement = document.getElementById("answer");
    lock = document.getElementById("lock");

    if (submitButton) {
      submitButton.addEventListener("click", async () => {
        await checkCoordinates();
      });
    } else {
      console.error("Submit button not found");
    }

    hintIndex = initHints(teamName, hintIndex);

    await loadCorrectCoordinates();
    correctCoordinates = extractCoordinates(stringCorrectCoordinates);

    await checkSavedCoordinates();

    initCombinationLock();
    getEnterButton().addEventListener("click", () => {
      checkCombination(targetId);
    });

    // Stockez la fonction de désabonnement
    const unsubscribeListener = listenChallengeChanges(teamName, db, targetId);
  } else {
    console.error("Challenge ID is missing.");
  }
}

let coordinates = [];
let correctCoordinates = [];
let stringCorrectCoordinates = "";
let stringOrder = "";
let stringStartCoordinates = "";
let displayCoordinatesElement = null;
let newCoordinateSaved = false;

const phoneId = getOrCreateUniqueId(); // Get the user's phone ID

function extractCoordinates(inputString) {
  // Match all numbers using a regular expression
  const coordinates = inputString.match(/\d+/g);

  // Convert the numbers to integers or keep them as strings
  return coordinates ? coordinates.map(Number) : [];
}

async function checkCoordinates() {
  updateChallengeQuestion();
  await checkSavedCoordinates();
  await checkAllCoordinatesDone();
}

function updateChallengeQuestion() {
  if (!displayCoordinatesElement) return; // Exit if the element doesn't exist

  // Get the input value
  const inputValue = inputElement.value;

  // Extract all numbers using a regular expression
  const numbers = inputValue.match(/\d+/g);

  let updatedCoordinates = updateCoordinates(
    displayCoordinatesElement.textContent.trim(),
    stringCorrectCoordinates,
    numbers,
    inputElement
  );

  displayCoordinatesElement.innerHTML = `<p>${updatedCoordinates}</p>`;
}

function updateCoordinates(display, correctAnswer, userInput, answerElement) {
  // Ensure userInput is treated as a string
  const userInputs = String(userInput)
    .split(",")
    .map((input) => input.trim());

  // Split the strings into arrays for comparison
  const displayArray = display.split("-");
  const answerArray = correctAnswer.split("-");

  // Iterate through the display array and update the '?' if needed
  const updatedDisplay = displayArray.map((value, index) => {
    // Check if the current position is '?' and if any userInput matches the correct answer
    if (value === "?" && userInputs.includes(answerArray[index])) {
      newCoordinateSaved = true;
      return answerArray[index]; // Correct match, replace '?'
    }
    return value; // Keep the existing value
  });

  if (!newCoordinateSaved) {
    incorrectAnswer(answerElement, teamName, 0);
  }

  // Rejoin the array back into a string
  return updatedDisplay.join("-");
}

// Load the correct sequence from Firebase
async function loadCorrectCoordinates() {
  const challengeDoc = await getDoc(doc(db, "challenges", targetId));
  if (challengeDoc.exists) {
    stringCorrectCoordinates = challengeDoc.data().answer[0];
    stringOrder = challengeDoc.data().order;
    stringStartCoordinates = challengeDoc.data().question;
  }
}

async function checkAllCoordinatesDone() {
  if (!displayCoordinatesElement) return; // Exit if the element doesn't exist

  if (
    displayCoordinatesElement.textContent.trim() === stringCorrectCoordinates
  ) {
    // Split the string by "_" to get individual segments
    console.log(stringOrder);
    const items = stringOrder.split("_");

    // Target container in the HTML
    const container = document.getElementById("result");

    // Clear the container
    displayCoordinatesElement.innerHTML = "";

    // Create a <ul> element to hold the bullet points
    const ul = document.createElement("ul");

    // Iterate through the items and create <li> for each
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item; // Set the text for the bullet point
      ul.appendChild(li);
    });

    // Append the <ul> to the container
    displayCoordinatesElement.appendChild(ul);

    lock.classList.remove("hidden");
    inputElement.classList.add("hidden");
    submitButton.classList.add("hidden");

    let array = { hintIndex: 3 };

    await updateTeamArray(teamName, array, 2);
  }
}

async function checkSavedCoordinates() {
  let array = [];

  displayCoordinatesElement = document.getElementById("challenge");

  const docRef = doc(db, "challenges", targetId);

  // Fetch the document
  const docSnapshot = await getDoc(docRef);

  if (docSnapshot.exists()) {
    const data = docSnapshot.data();
    const teamData = data[teamName];

    if (data[teamName]) {
      console.log(newCoordinateSaved);
      if (!newCoordinateSaved) {
        displayCoordinatesElement.innerHTML = `<p>${teamData[0].savedCoordinates}</p>`;
      }

      array = {
        savedCoordinates: displayCoordinatesElement.textContent.trim(),
      };
    } else {
      array = {
        savedCoordinates: stringStartCoordinates,
      };
    }
  }

  await checkAllCoordinatesDone();

  await updateTeamArray(teamName, array, 0);

  newCoordinateSaved = false;
}
