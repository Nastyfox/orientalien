// Load Tone.js dynamically
function loadToneJS() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.25/Tone.js"; // Ensure this is the correct version
    script.onload = resolve;
    script.onerror = () => reject(new Error("Failed to load Tone.js"));
    document.head.appendChild(script);
  });
}

import {
  goBack,
  completeChallenge,
  loadChallenge,
  getTeamInfos,
  createFireworks,
  startFireworks,
  stopFireworks,
  checkAnswer,
  initHints,
  initSubmitAndBack,
  listenChallengeChanges,
} from "./utils-challenge.js";

import {
  collection,
  getDoc,
  getFirestore,
  doc,
  updateDoc,
  arrayUnion,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-storage.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";

import { getUserTeam, getOrCreateUniqueId, loadPage } from "./utils.js";

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

const phoneId = getOrCreateUniqueId(); // Get the user's phone ID

let ctx,
  canvas,
  synth = null;

let isPlaying = false;

export async function initializePageScripts(challengeId) {
  if (challengeId) {
    console.log(`Challenge ID: ${challengeId}`);
    targetId = await loadChallenge(challengeId); // Use the challengeId to load the data
    teamName = await getUserTeam(db, phoneId);

    initSubmitAndBack();

    hintIndex = initHints(teamName, hintIndex);

    await loadToneJS(); // Load Tone.js

    // Initialize Tone.js for sound playback
    synth = new Tone.Synth().toDestination();

    const musicBars = document.querySelectorAll(".bar"); // Select all bars

    // Attach event listener to each `.bar`
    musicBars.forEach((bar) => {
      bar.addEventListener("click", inputOrRemoveNote);
    });

    // Load the correct sequence from Firebase and play it
    const firebaseUserCorrectSequence = await getUserCorrectSequence();
    userCorrectSequence = firebaseUserCorrectSequence.map((note) => ({ note }));

    const firebaseSequence = await loadCorrectSequence();
    correctSequence = firebaseSequence.map((note) => ({ note })); // Store the correct sequence for visual representation

    initSequences();

    await playSequence(userCorrectSequence, false); // Play the correct sequence at the start

    // Play the user's note sequence
    document
      .getElementById("play-sequence")
      .addEventListener("click", async () => {
        checkUserSequence = await processEntireStaff();
        // Start recording before playing the sequence
        await playSequence(checkUserSequence, true);
      });

    // Play the correct sequence
    document
      .getElementById("correct-sequence")
      .addEventListener("click", async () => {
        await playSequence(userCorrectSequence, false);
      });

    // Validate the user's note sequence
    document
      .getElementById("submit-sequence")
      .addEventListener("click", async () => {
        checkUserSequence = await processEntireStaff(); // Process the staff to prepare the notes
        console.log(checkUserSequence);
        verifySequence();
      });

    // Clear Sheet Button event listener
    document
      .getElementById("clearSheetButton")
      .addEventListener("click", clearSheet);

    // Stockez la fonction de désabonnement
    const unsubscribeListener = listenChallengeChanges(teamName, db, targetId);
  } else {
    console.error("Challenge ID is missing.");
  }
}

let userSequence = [];
let checkUserSequence = [];
let correctSequence = [];

// Load the correct sequence from Firebase
async function loadCorrectSequence() {
  const challengeDoc = await getDoc(doc(db, "challenges", targetId));
  if (challengeDoc.exists) {
    return challengeDoc.data().correctSequence; // Example: ["C", "E", "G"]
  }
  return [];
}

let notePositions = null;

const noteNames = [
  "b4",
  "c4",
  "d4",
  "e4",
  "f4",
  "g4",
  "a5",
  "b5",
  "c5",
  "d5",
  "e5",
  "f5",
  "g5",
  "a6",
  "b6",
]; // Adjust based on your notation system

const acceptedNotes = [
  "d4",
  "e4",
  "f4",
  "g4",
  "a5",
  "b5",
  "c5",
  "d5",
  "e5",
  "f5",
  "g5",
]; // Adjust based on your notation system

const classNames = ["half-note-spacer", "quarter-note"];

// Function to input a note or remove an existing note
function inputOrRemoveNote(event) {
  const targetBar = event.currentTarget; // The `.bar` container clicked
  const staveHeader = targetBar.querySelector(".stave-header"); // Reference for positioning

  // Get bar dimensions
  const barRect = targetBar.getBoundingClientRect();
  const staveRect = staveHeader.getBoundingClientRect();

  // Get clicked position within the bar
  const clickX = event.clientX - barRect.left;
  const clickY = event.clientY - barRect.top;

  // Get clicked element
  let clickedElement = event.target;

  // Only allow clicks on spacers or existing notes
  if (
    !clickedElement.classList.contains("half-note-spacer") &&
    !clickedElement.classList.contains("quarter-note")
  ) {
    let closestClassPresent = findClosestElement(clickX, targetBar, barRect);
    console.log(closestClassPresent);
    clickedElement = closestClassPresent;
  }

  // **1. Determine Clicked Position (Y) and Find Closest Note**
  const lineSpacing = staveRect.height / (noteNames.length - 1);

  let closestNote = null;
  let minDistance = Infinity;
  noteNames.forEach((note, index) => {
    const noteY = staveRect.height - index * lineSpacing;
    const distance = Math.abs(event.clientY - staveRect.top - noteY);
    if (distance < minDistance) {
      minDistance = distance;
      closestNote = note;
    }
  });

  if (
    !closestNote ||
    closestNote == "a6" ||
    closestNote == "b6" ||
    closestNote == "b4" ||
    closestNote == "c4"
  )
    return;

  // **2. Handle Toggle Logic (Remove or Add Note)**
  if (!clickedElement.classList.contains("half-note-spacer")) {
    if (clickedElement.classList.contains(closestNote)) {
      // If a note exists, revert it back to a spacer
      clickedElement.classList.remove(...clickedElement.classList);
      clickedElement.classList.add("half-note-spacer");
      console.log(`Removed note, reverted to spacer`);
    } else {
      // If a note exists, revert it back to a spacer
      clickedElement.classList.remove(...clickedElement.classList);
      clickedElement.classList.add(closestNote, "quarter-note");
      console.log(`Added note: ${closestNote}`);
    }
  } else {
    // Replace the spacer with the selected note
    clickedElement.classList.remove("half-note-spacer");
    clickedElement.classList.add(closestNote, "quarter-note");
    console.log(`Added note: ${closestNote}`);
  }
}

// **2. Find the Closest "half-note-spacer" or "closestNote"**
function findClosestElement(clickX, targetBar, barRect) {
  let closestElement = null;
  let minDistance = Infinity;

  const children = Array.from(targetBar.children);
  children.forEach((child) => {
    classNames.forEach((className) => {
      if (child.classList.contains(className)) {
        const childRect = child.getBoundingClientRect();
        const distance = Math.abs(
          (childRect.left + childRect.right) / 2 - (barRect.left + clickX)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestElement = child;
        }
      }
    });
  });

  return closestElement;
}

// Function to sort the userSequence by the horizontal position (x value)
function sortUserSequence() {
  userSequence.sort((a, b) => a.x - b.x);
}

async function processEntireStaff() {
  const newSequence = []; // Holds the extracted notes and rests

  // Select all divs inside bars (excluding stave-header and bar-line)
  const noteDivs = document.querySelectorAll(
    ".bar div:not(.stave-header):not(.bar-line)"
  );

  noteDivs.forEach((div) => {
    const classList = Array.from(div.classList);

    console.log(classList);

    // Find the note class (e.g., "a5", "b5", etc.)
    let noteClass = classList.find((cls) =>
      /^[a-gA-G](diese)?[0-9]$/.test(cls)
    );

    if (noteClass != null) {
      noteClass = noteClass.replace(/([a-gA-G])diese([0-9])/g, "$1#$2");
    }

    if (noteClass) {
      // If a note is found, add it to the sequence
      newSequence.push({ note: noteClass });
    } else {
      // If no note class found, assume it's a spacer (rest)
      newSequence.push({ note: " " });
    }
  });

  console.log("Extracted sequence:", newSequence);
  return newSequence;
}

let currentSequenceController = null; // Variable pour contrôler l'arrêt de la séquence

async function playSequence(sequence, user) {
  console.log(sequence);

  // Arrêter la séquence en cours si elle joue
  if (isPlaying && currentSequenceController) {
    currentSequenceController.stop = true; // Signal d'arrêt
    synth.triggerRelease(); // Arrêter la note en cours
    await new Promise((resolve) => setTimeout(resolve, 100)); // Petit délai pour nettoyer
  }

  isPlaying = true;
  currentSequenceController = { stop: false }; // Nouveau contrôleur pour cette séquence
  const localController = currentSequenceController; // Référence locale

  // Play each note in the sequence
  for (let i = 0; i < sequence.length; i++) {
    // Vérifier si on doit arrêter cette séquence
    if (localController.stop) {
      console.log("Sequence stopped by new playback");
      break;
    }

    const correctNote = correctSequence[i].note.replace(" ", "");
    const correctNoteFlat = correctSequence[i].note.replace("#", "");
    const correctNoteText = correctNote.replace("#", "diese");
    const noteObj = sequence[i];
    
    if (
      correctNote.includes("#") &&
      correctNoteFlat.includes(noteObj.note) &&
      user &&
      sequence[i].note != " "
    ) {
      sequence[i].note = correctNote;
      updateNoteClass(i, correctNoteText);
    }

    if (noteObj.note !== " ") {
      if (noteObj.note == "b5") {
        synth.triggerAttackRelease("b4", "8n");
      } else if (noteObj.note == "a5") {
        synth.triggerAttackRelease("a4", "8n");
      } else {
        synth.triggerAttackRelease(noteObj.note, "4n");
      }
    }

    // Wait for a shorter duration to ensure we don't miss the last note
    if (i < sequence.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Ne réinitialiser isPlaying que si c'est la dernière séquence lancée
  if (currentSequenceController === localController) {
    isPlaying = false;
  }
}


function updateNoteClass(index, note) {
  const bars = document.querySelectorAll(".bar");
  const numDivBar = bars[0].querySelectorAll("div").length - 2;
  const barIndex = Math.floor(index / numDivBar);

  if (barIndex < bars.length) {
    const bar = bars[barIndex];

    const divs = bar.querySelectorAll("div");
    // Determine which div within the bar
    const divIndex = (index % numDivBar) + 1;

    if (divIndex < divs.length) {
      const div = divs[divIndex]; // Assuming you want to update the first spacer in the bar
      div.classList.remove(...div.classList);
      div.classList.add(note, "quarter-note");
      console.log(`Updated note at index ${index} to ${note}`);
    }
  }
}

// Function to clear the music sheet
function clearSheet() {
  userSequence = []; // Clear the sequence

  // Select all elements that are either notes or spacers
  document.querySelectorAll(".bar div").forEach((element) => {
    if (
      !element.classList.contains("stave-header") &&
      !element.classList.contains("bar-line")
    ) {
      // Reset everything back to 'half-note-spacer'
      element.classList.remove(...element.classList);
      element.classList.add("half-note-spacer");
    }
  });

  console.log("Sheet cleared");
}

let currentUserCount = 0;
let userCorrectSequence = null;
let userCount = 0;

async function getInfosForGame() {
  const teamData = await getTeamInfos(teamName);
  userCount = teamData[0];
  currentUserCount = teamData[1];
}

// Get overlay image URL based on user count from Firestore
async function getUserCorrectSequence() {
  const challengeDoc = await getDoc(doc(db, "challenges", targetId));

  // Get the current team and count its members
  teamName = await getUserTeam(db, phoneId);

  await getInfosForGame();
  //userCount = await getTeamUserCount(teamName);

  if (challengeDoc.exists()) {
    const userName = "user" + currentUserCount;
    let correctSequences = null;
    console.log(userCount);
    switch (userCount) {
      case 1:
        correctSequences = getCurrentUserSequence(
          userName,
          challengeDoc.data().users1
        );
        break;
      case 2:
        correctSequences = getCurrentUserSequence(
          userName,
          challengeDoc.data().users2
        );
        break;
      case 3:
        correctSequences = getCurrentUserSequence(
          userName,
          challengeDoc.data().users3
        );
        break;
      case 4:
        correctSequences = getCurrentUserSequence(
          userName,
          challengeDoc.data().users4
        );
        break;
      case 5:
        correctSequences = getCurrentUserSequence(
          userName,
          challengeDoc.data().users5
        );
        break;
      case 6:
        correctSequences = getCurrentUserSequence(
          userName,
          challengeDoc.data().users6
        );
        break;
    }
    if (correctSequences) {
      return correctSequences; // Return corresponding image URL
    }
  }
  return null; // Fallback if no image found
}

async function getCurrentUserSequence(userName, challengeData) {
  for (const [userCount, sequence] of Object.entries(challengeData)) {
    if (userCount === userName) {
      return sequence;
    }
  }
}

function verifySequence() {
  const resultDiv = document.getElementById("result");
  let checkUser = true;
  let checkGlobal = true;

  const musicNameDiv = document.getElementById("musicName");

  // Check each note in the arrays
  for (let i = 0; i < checkUserSequence.length; i++) {
    if (checkUserSequence[i].note !== userCorrectSequence[i].note) {
      checkUser = false;
      console.log(
        "False : " +
          userCorrectSequence[i].note +
          " " +
          checkUserSequence[i].note
      );
    }
  }

  // Check each note in the arrays
  for (let i = 0; i < checkUserSequence.length; i++) {
    if (checkUserSequence[i].note !== correctSequence[i].note) {
      checkGlobal = false;
      console.log(
        "False : " + correctSequence[i].note + " " + checkUserSequence[i].note
      );
    }
  }

  if (checkUser) {
    resultDiv.innerHTML =
      "<span style='color: orange;'>La séquence n'est pas tout à fait la bonne</span>";
  }
  if (checkGlobal) {
    resultDiv.innerHTML = "";
    musicNameDiv.style.display = "block";
  }
  if (!checkUser && !checkGlobal) {
    resultDiv.innerHTML =
      "<span style='color: red;'>La séquence n'est pas bonne</span>";
  }
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

async function initSequences() {
  const sequence = [
    "g5",
    "f5",
    "e5",
    "f5",
    "f5",
    "e5",
    "d#5",
    "e5",
    "e5",
    "d5",
    "c#5",
    "d5",
  ];

  // Définition des groupes et membres
  const groups = {
    users1: ["user1"],
    users2: ["user1", "user2"],
    users3: ["user1", "user2", "user3"],
    users4: ["user1", "user2", "user3", "user4"],
    users5: ["user1", "user2", "user3", "user4", "user5"],
    users6: ["user1", "user2", "user3", "user4", "user5", "user6"],
  };

  let updateData = {}; // Objet pour stocker les séquences par utilisateur

  // Générer les séquences avec masquage partiel
  for (const [group, members] of Object.entries(groups)) {
    let sequences = Array(members.length)
      .fill()
      .map(() => [...sequence]); // Cloner la séquence pour chaque membre

    // Appliquer le masquage avec des probabilités
    sequence.forEach((_, index) => {
      let visibleMembers = new Set();

      // Déterminer combien de personnes voient la note (minimum 1, max tous)
      let visibleCount = Math.floor(Math.random() * (members.length - 1)) + 1;

      while (visibleMembers.size < visibleCount) {
        let randomIndex = Math.floor(Math.random() * members.length);
        visibleMembers.add(randomIndex);
      }

      // Masquer la note pour ceux qui ne sont pas dans visibleMembers
      members.forEach((_, i) => {
        if (!visibleMembers.has(i)) {
          sequences[i][index] = " ";
        }
      });
    });

    // Associer chaque séquence au membre correspondant
    members.forEach((member, i) => {
      updateData[`${group}.${member}`] = sequences[i];
    });
  }

  // Mettre à jour Firebase avec les séquences générées
  const challengeDoc = doc(db, "challenges", targetId);
  await updateDoc(challengeDoc, updateData);
}
