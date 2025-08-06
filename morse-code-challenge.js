import {
  goBack,
  completeChallenge,
  loadChallenge,
  getTeamInfos,
  updateTeamArray,
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
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/9.14.0/firebase-firestore.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";

import { getUserTeam, getOrCreateUniqueId, loadPage, isIOS } from "./utils.js";

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
let blinker,
  morseAlphabetDiv,
  morsePattern,
  morsePatternLettersOnly,
  morseButton,
  feedback = 0;
let userPattern = [];
let isListening = false;
let morseCodeFunction = null;
let listUsers = [];
let currentUser = 0;
let fullMessage = false;
let teamName = null;
let displayAlphabet = false;

const phoneId = getOrCreateUniqueId(); // Get the user's phone ID

let hintIndex = 0;

export async function initializePageScripts(challengeId) {
  // Wait for the CSS file to load before showing the content
  const stylesheet = document.getElementById("main-stylesheet");
  stylesheet.onload = function () {
    document.getElementById("loader").style.display = "none"; // Hide loader
    document.body.style.display = "flex"; // Show body
  };

  // Fallback in case of an error loading the stylesheet
  stylesheet.onerror = function () {
    document.getElementById("loader").innerText = "Failed to load styles.";
  };

  if (challengeId) {
    console.log(`Challenge ID: ${challengeId}`);
    targetId = await loadChallenge(challengeId); // Use the challengeId to load the data
    teamName = await getUserTeam(db, phoneId);

    initSubmitAndBack();

    hintIndex = initHints(teamName, hintIndex);

    blinker = document.getElementById("blinker");
    morseAlphabetDiv = document.getElementById("morse-alphabet");
    feedback = document.getElementById("feedback");

    // Start listening for user tap input
    morseButton = document.getElementById("reproduce-morse-code");

    // Mobile touch support
    morseButton.addEventListener("touchstart", handleTapStart);
    morseButton.addEventListener("touchend", handleTapEnd);

    displayAlphabet = false;

    // After targetId and teamName are loaded, run all targetId-dependent logic here
    checkForMorseAlphabet(targetId, teamName).then((alphabetReady) => {
      console.log(alphabetReady);
      if (!alphabetReady) {
        startMorseCode("E"); // Initial start

        morseCodeFunction = setInterval(() => {
          startMorseCode("E"); // Repeat every minute (60,000 ms)
        }, 30000);
      }
    });

    // Stockez la fonction de désabonnement
    const unsubscribeListener = listenChallengeChanges(teamName, db, targetId);
  } else {
    console.error("Challenge ID is missing.");
  }
}

let unsubscribeSnapshot; // Variable to hold the unsubscribe function

// Function to stop listening to the snapshot
function stopListening() {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot(); // Call the unsubscribe function
    unsubscribeSnapshot = null; // Clear the reference
    console.log("Stopped listening for snapshot updates.");
  }
}

async function checkForMorseAlphabet() {
  console.log("Target ID:", targetId);
  console.log("Team Name:", teamName); // Log to ensure teamName is correctly defined

  const challengeRef = doc(db, "challenges", targetId); // Firestore document reference

  return new Promise((resolve, reject) => {
    try {
      let initialResolved = false; // Track if the promise was resolved

      unsubscribeSnapshot = onSnapshot(challengeRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const challengeData = docSnapshot.data();
          console.log("Challenge data:", challengeData);

          const teamArray = challengeData[teamName] || [];
          console.log("Team Array:", teamArray);

          // Ensure that the array exists and is not empty before accessing the first element
          if (teamArray.length > 0) {
            const morseAlphabet = teamArray[0]?.morseAlphabet || false; // Safely access morseAlphabet
            console.log("Morse Alphabet Value:", morseAlphabet);

            // Resolve the promise with the initial value on the first snapshot
            if (!initialResolved) {
              initialResolved = true;
              resolve(morseAlphabet); // Resolve the promise with the current value of morseAlphabet
            }

            console.log(morseAlphabet + " " + displayAlphabet);

            // If morseAlphabet is true, display the alphabet
            if (morseAlphabet === true && !displayAlphabet) {
              console.log("Morse alphabet set to true, triggering display.");
              displayAlphabetAndStartMorseCode(false); // Trigger display logic
              stopListening(); // Stop listening after the change
            }
          } else {
            console.log("Team array is empty or not found.");
            resolve(false); // Resolve false if the array is empty or doesn't contain valid data
          }
        } else {
          console.log("Document does not exist.");
          resolve(false); // Resolve with false if the document doesn't exist
        }
      });
    } catch (error) {
      console.error("Error checking for Morse alphabet:", error);
      reject(error); // Reject the promise if there's an error
    }
  });
}

// Morse code dictionary (A-Z, 0-9)
const morseCode = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
};

const dotTime = 200; // Vibration time for dot
const dashTime = 600; // Vibration time for dash
const letterPause = 1200; // Pause between letters
const wordPause = 2800; // Pause between words
const betweenSignalPause = 400; // Pause between dots and dashes in the same letter

// Function to convert text to Morse code vibration pattern
function convertTextToMorse(text) {
  const vibrationPattern = [];

  // Convert the text into upper case for matching the Morse code dictionary
  text = text.toUpperCase();
  morsePatternLettersOnly = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === " ") {
      vibrationPattern.push(wordPause); // Add a longer pause for spaces between words
    } else if (morseCode[char]) {
      const morseSignals = morseCode[char];

      // For each dot or dash in the letter, push the appropriate vibration time
      for (let j = 0; j < morseSignals.length; j++) {
        if (morseSignals[j] === ".") {
          vibrationPattern.push(dotTime); // Vibrate for dot
          morsePatternLettersOnly.push("short");
        } else if (morseSignals[j] === "-") {
          vibrationPattern.push(dashTime); // Vibrate for dash
          morsePatternLettersOnly.push("long");
        }

        // Push the pause between dots and dashes, except for the last signal in the letter
        if (j < morseSignals.length - 1) {
          vibrationPattern.push(betweenSignalPause);
        }
      }

      // After each letter, add a pause
      if (i < text.length - 1) {
        vibrationPattern.push(letterPause);
      }
    }
  }

  //feedback.innerHTML = morsePatternLettersOnly;

  return vibrationPattern;
}

// Function to visually blink the screen in sync with the vibration
function blinkPattern(pattern) {
  return new Promise((resolve) => {
    const blinker = document.getElementById("blinker");
    let currentStep = 0;

    // Function to toggle blinker on/off
    function blink() {
      if (currentStep >= pattern.length) {
        blinker.style.display = "none"; // Hide blinker after pattern is complete
        resolve(); // Resolve the promise after blinking is complete
        return;
      }

      const duration = pattern[currentStep];
      if (duration == dotTime || duration == dashTime) {
        blinker.style.display = "block"; // Show blinker (on time)
      } else {
        blinker.style.display = "none"; // Hide blinker (off time)
      }

      currentStep++;
      setTimeout(blink, duration); // Move to the next part of the pattern
    }

    blink(); // Start blinking pattern
  });
}

// Function to vibrate the phone and return a Promise that resolves when vibration is done
function vibratePattern(pattern) {
  return new Promise((resolve) => {
    if (isIOS()) {
      vibrateScreenPattern(pattern);
    } else {
      if ("vibrate" in navigator) {
        navigator.vibrate(pattern); // Trigger the vibration pattern
        // Calculate the total vibration time
        const totalVibrationTime = pattern.reduce((acc, time) => acc + time, 0);
        setTimeout(resolve, totalVibrationTime); // Resolve the promise after the vibration pattern finishes
      } else {
        console.log("Vibration is not supported.");
        resolve(); // Resolve immediately if vibration is not supported
      }
    }
  });
}

function vibrateScreenPattern(pattern) {
  return new Promise((resolve) => {
    let index = 0;

    // Function to toggle blinker on/off
    function playNext() {
      if (index >= pattern.length) {
        document.body.classList.remove("vibrate-short", "vibrate-long");
        resolve(); // Resolve the promise after blinking is complete
        return;
      }

      const duration = pattern[index];
      // Appliquer la classe CSS uniquement pour les vibrations (pas pour les pauses)
      if (duration === dotTime) {
        document.body.classList.add("vibrate-short");
      } else if (duration === dashTime) {
        document.body.classList.add("vibrate-long");
      } else {
        document.body.classList.remove("vibrate-short", "vibrate-long");
      }

      index++;
      setTimeout(playNext, duration); // Move to the next part of the pattern
    }

    playNext(); // Start blinking pattern
  });
}

// Function to start the vibration and blinking pattern for Morse code
async function startMorseCode(text) {
  console.log(text);
  morsePattern = convertTextToMorse(text);
  console.log(morsePatternLettersOnly);

  await Promise.all([vibratePattern(morsePattern), blinkPattern(morsePattern)]);

  await newUserMessage(currentUserCount);
}

async function checkPattern() {
  if (userPattern.length === morsePatternLettersOnly.length) {
    if (
      JSON.stringify(userPattern) === JSON.stringify(morsePatternLettersOnly)
    ) {
      //feedback.innerHTML = "Success! You matched the Morse code!";
      displayAlphabetAndStartMorseCode(true); // Display the alphabet when pattern is correct
      //userCount = await getTeamUserCount(teamName);
    } else {
      //feedback.innerHTML = "Failed to match the Morse code.";
    }
    userPattern = []; // Reset the pattern
  }
}

// Function to capture tap duration
let tapStart = 0;
function handleTapStart() {
  tapStart = new Date().getTime();
}

function handleTapEnd() {
  const tapEnd = new Date().getTime();
  const tapDuration = tapEnd - tapStart;

  if (tapDuration < 300) {
    userPattern.push("short"); // Short tap
    //feedback.innerHTML = userPattern;
  } else {
    userPattern.push("long"); // Long tap
    //feedback.innerHTML = userPattern;
  }

  checkPattern();
}

let currentUserCount = 0;
let userCount = 0;

async function getInfosForGame(updateFirebase) {
  const teamData = await getTeamInfos(teamName);
  userCount = teamData[0];
  currentUserCount = teamData[1];
  listUsers = teamData[2];

  if (updateFirebase) {
    let array = {
      phoneId: listUsers[currentUser].phoneId,
      morseAlphabet: true,
    };

    await updateTeamArray(listUsers[currentUser].team, array, 0);
  }
}

// Get overlay image URL based on user count from Firestore
async function getStringMorseCode(userCount) {
  console.log(targetId);
  const challengeDoc = await getDoc(doc(db, "challenges", targetId));

  if (challengeDoc.exists()) {
    let stringMorseCode = null;
    switch (userCount) {
      case 1:
        stringMorseCode = challengeDoc.data().users2;
        break;
      case 2:
        stringMorseCode = challengeDoc.data().users2;
        break;
      case 3:
        stringMorseCode = challengeDoc.data().users3;
        break;
      case 4:
        stringMorseCode = challengeDoc.data().users4;
        break;
      case 5:
        stringMorseCode = challengeDoc.data().users5;
        break;
      case 6:
        stringMorseCode = challengeDoc.data().users6;
        break;
    }
    if (stringMorseCode && stringMorseCode[currentUserCount - 1]) {
      return stringMorseCode[currentUserCount - 1]; // Return corresponding image URL
    }
  }
  return null; // Fallback if no image found
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function displayAlphabetAndStartMorseCode(updateFirebase) {
  morseAlphabetDiv.style.display = "block"; // Display Morse alphabet
  morseButton.style.display = "none";
  clearInterval(morseCodeFunction);

  displayAlphabet = true;

  await getInfosForGame(updateFirebase);

  const stringMorseCode = await getStringMorseCode(userCount);
  console.log(userCount);

  fullMessage = true;

  const challengeRef = doc(db, "challenges", targetId); // Change this to your actual document path
  onSnapshot(challengeRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const challengeData = docSnapshot.data();
      console.log(challengeData);
      const teamArray = challengeData[teamName] || []; // Get the current array for the team, or an empty array if it doesn't exist
      console.log(teamName);
      console.log(teamArray[0].phoneId);
      if (teamArray[0].phoneId === phoneId) {
        startMorseCode(stringMorseCode);
      }
    }
  });
}

async function newUserMessage(value) {
  if (fullMessage) {
    currentUser = value;
    if (currentUser > userCount - 1) {
      currentUser = 0;
      await delay(10000);
    }

    let array = {
      phoneId: listUsers[currentUser].phoneId,
      morseAlphabet: true,
    };
    await updateTeamArray(listUsers[currentUser].team, array, 0);
  }
}
