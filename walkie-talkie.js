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

import { getUserTeam, getOrCreateUniqueId } from "./utils.js";

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
// Initialize Firestore
const db = getFirestore(app);
const storage = getStorage(app);

// DOM elements
const messageContainer = document.getElementById("message-container");
const startRecordingBtn = document.getElementById("start-recording-btn");
const controlsContainer = document.getElementById("input-container");

// Global variables
let mediaRecorder;
let audioChunks = [];
let userTeamName = null;
const phoneId = getOrCreateUniqueId(); // Get the user's phone ID
let isAdmin = false;

let loadAdminMessagesInterval = null;

window.onload = async () => {
  console.log("LOAD WALKIE");
  try {
    // Retrieve the user's team name
    userTeamName = await getUserTeam(db, phoneId);

    if (userTeamName) {
      console.log("User's team:", userTeamName);
      if (!loadAdminMessagesInterval) {
        loadAdminMessagesForTeam(userTeamName);
        // Only set it if it's not already set
        loadAdminMessagesInterval = setInterval(function () {
          loadAdminMessagesForTeam(userTeamName);
        }, 30000);
      }
    } else {
      console.error("No team found for this user.");
    }
  } catch (error) {
    console.error("Error initializing the page:", error);
  }
};

// Function to upload the voice message and mark it as an admin message
async function uploadVoiceMessage(blob, teamName) {
  const fileName = `${Date.now()}.wav`;
  const storageRef = ref(storage, `voice-messages/${teamName}/${fileName}`);

  // Upload the audio file to Firebase Storage
  await uploadBytes(storageRef, blob);

  // Get the download URL for the uploaded audio file
  const downloadURL = await getDownloadURL(storageRef);

  // Now save the metadata including the download URL and admin status in Firestore
  await addDoc(collection(db, "voice-messages"), {
    team: teamName,
    isAdmin: isAdmin, // Tagging the message as admin or non-admin
    audioURL: downloadURL,
    timestamp: serverTimestamp(), // Save the server timestamp
    readBy: [], // Initialize with an empty array for tracking who has read this message
  });
}

async function startRecording() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: "audio/wav" });
        audioChunks = [];

        const teamName = await getUserTeam(db, phoneId); // Get the user's team

        // Call uploadVoiceMessage and pass the team name and admin status
        uploadVoiceMessage(blob, teamName);
      };

      mediaRecorder.start();
      startRecordingBtn.style.display = "none";

      // Create and show the stop recording button
      const stopRecordingBtn = document.createElement("button");
      stopRecordingBtn.id = "stop-recording-btn";
      stopRecordingBtn.textContent = "Envoyer";
      controlsContainer.appendChild(stopRecordingBtn);

      console.log("Start recording");

      stopRecordingBtn.addEventListener("click", stopRecording);
    } catch (error) {
      console.error("Error accessing media devices.", error);
    }
  } else {
    alert("Media Devices API not supported.");
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    console.log("Stopping recording...");

    // Stop the MediaRecorder
    mediaRecorder.stop();

    // Stop all tracks associated with the media stream (this releases the microphone)
    const tracks = mediaRecorder.stream.getTracks();
    tracks.forEach((track) => track.stop());

    // Show the start recording button again
    startRecordingBtn.style.display = "block";

    // Remove the stop recording button
    const stopRecordingBtn = document.getElementById("stop-recording-btn");
    if (stopRecordingBtn) {
      stopRecordingBtn.remove();
    }
  } else {
    console.log("MediaRecorder is not recording or already stopped.");
  }
}

startRecordingBtn.addEventListener("click", startRecording);

async function loadAdminMessagesForTeam(teamName) {
  console.log("Load admin messages");
  const messageContainer = document.getElementById("message-container");
  messageContainer.innerHTML = ""; // Clear previous messages
  
  console.log(teamName);

  // Query to get only messages sent by the admin to the specific team
  const q = query(
    collection(db, "voice-messages"),
    where("team", "==", teamName),
    where("isAdmin", "==", true) // Only get admin messages
  );

  try {
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const messages = []; // Array to hold the messages

      querySnapshot.forEach((doc) => {
        const messageData = doc.data();
        const messageURL = messageData.audioURL;
        const readBy = messageData.readBy || [];

        // Check if the current team has read the message
        const isRead = readBy.some((entry) => entry.team === teamName);

        // Add message details to the array
        messages.push({
          id: doc.id,
          url: messageURL,
          isRead: isRead,
        });
      });

      // Sort messages: unread first, then read
      messages.sort((a, b) => (a.isRead === b.isRead ? 0 : a.isRead ? 1 : -1));

      // Display sorted messages
      messages.forEach(async (message) => {
        // Apply different styles based on read status
        console.log(message.isRead);
        const messageClass = message.isRead ? "read" : "unread";

        let messageDiv = await customAudio(message.url, message.id);
        messageDiv.classList.add(messageClass);
        messageContainer.appendChild(messageDiv);
      });
    } else {
      messageContainer.innerHTML =
        "<p>Pas de messages pour votre équipe pour l'instant.</p>";
    }
  } catch (error) {
    console.error("Error retrieving admin messages:", error);
    messageContainer.innerHTML = "<p>Error loading messages.</p>";
  }
}

// Function to mark messages as read
async function markMessagesAsRead(messageId) {
  const messageRef = doc(db, "voice-messages", messageId);

  try {
    await updateDoc(messageRef, {
      readBy: arrayUnion({
        team: userTeamName,
      }),
    });
    console.log("Message marked as read");
  } catch (error) {
    console.error("Error marking message as read:", error);
  }
}

var getDuration = function (url, next) {
  var _player = new Audio(url);
  _player.addEventListener(
    "durationchange",
    function (e) {
      if (this.duration != Infinity) {
        var duration = this.duration;
        _player.remove();
        next(duration);
      }
    },
    false
  );
  _player.load();
  _player.currentTime = 24 * 60 * 60; //fake big time
  _player.volume = 0;
  //waiting...
};

getDuration("/path/to/audio/file", function (duration) {
  console.log(duration);
});

async function customAudio(audioUrl, messageID) {
  // Select the team card for the given teamID
  const audioPlayer = document.querySelector(".hidden");

  // Ensure the team card exists
  if (audioPlayer) {
    // Clone the team card
    const audioDisplay = audioPlayer.cloneNode(true);
    audioDisplay.className = "audio-player";

    const audio = new Audio(audioUrl);

    audio.addEventListener(
      "durationchange",
      function (e) {
        if (this.duration != Infinity) {
          var duration = this.duration;
          audio.remove();
        }
      },
      false
    );
    audio.load();
    audio.currentTime = 24 * 60 * 60; //fake big time
    audio.volume = 0;

    audio.addEventListener(
      "loadeddata",
      () => {
        audioDisplay.querySelector(".time .length").textContent =
          getTimeCodeFromNum(audio.duration);
        audio.currentTime = 0; //fake big time
        audio.volume = 0.75;
      },
      false
    );

    //click on timeline to skip around
    const timeline = audioDisplay.querySelector(".timeline");
    timeline.addEventListener(
      "click",
      (e) => {
        const timelineWidth = window.getComputedStyle(timeline).width;
        const timeToSeek =
          (e.offsetX / parseInt(timelineWidth)) * audio.duration;
        audio.currentTime = timeToSeek;
      },
      false
    );

    //click volume slider to change volume
    const volumeSlider = audioDisplay.querySelector(".controls .volume-slider");
    volumeSlider.addEventListener(
      "click",
      (e) => {
        const sliderWidth = window.getComputedStyle(volumeSlider).width;
        const newVolume = e.offsetX / parseInt(sliderWidth);
        audio.volume = newVolume;
        audioDisplay.querySelector(".controls .volume-percentage").style.width =
          newVolume * 100 + "%";
      },
      false
    );

    //check audio percentage and update time accordingly
    setInterval(() => {
      const progressBar = audioDisplay.querySelector(".progress");
      progressBar.style.width =
        (audio.currentTime / audio.duration) * 100 + "%";
      audioDisplay.querySelector(".time .current").textContent =
        getTimeCodeFromNum(audio.currentTime);
    }, 100);

    //toggle between playing and pausing on button click
    const playBtn = audioDisplay.querySelector(".controls .toggle-play");
    playBtn.addEventListener(
      "click",
      () => {
        if (audio.paused) {
          playBtn.classList.remove("play");
          playBtn.classList.add("pause");
          audio.play();
          markMessagesAsRead(messageID);
        } else {
          playBtn.classList.remove("pause");
          playBtn.classList.add("play");
          audio.pause();
        }
      },
      false
    );

    audioDisplay
      .querySelector(".volume-button")
      .addEventListener("click", () => {
        const volumeEl = audioDisplay.querySelector(
          ".volume-container .volume"
        );
        audio.muted = !audio.muted;
        if (audio.muted) {
          volumeEl.classList.remove("icono-volumeMedium");
          volumeEl.classList.add("icono-volumeMute");
        } else {
          volumeEl.classList.add("icono-volumeMedium");
          volumeEl.classList.remove("icono-volumeMute");
        }
      });

    return audioDisplay;
  }
}

//turn 128 seconds into 2:08
function getTimeCodeFromNum(num) {
  let seconds = parseInt(num);
  let minutes = parseInt(seconds / 60);
  seconds -= minutes * 60;
  const hours = parseInt(minutes / 60);
  minutes -= hours * 60;

  if (hours === 0) return `${minutes}:${String(seconds % 60).padStart(2, 0)}`;
  return `${String(hours).padStart(2, 0)}:${minutes}:${String(
    seconds % 60
  ).padStart(2, 0)}`;
}
