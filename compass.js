import { isIOS } from "./utils.js";

export function initCompass() {
  // Get the compass element
  const compass = document.querySelector(".compass");
  // Create the degree markers and their labels
  for (let i = 0; i < 360; i += 10) {
    const degree = document.createElement("div");
    degree.classList.add("degrees");

    // Use percentage-based positioning to ensure responsiveness
    degree.style.transform = `rotate(${i}deg) translateY(-900%)`;

    // Create a label for the degree value
    const degreeLabel = document.createElement("span");
    degreeLabel.classList.add("degree-label");
    degreeLabel.innerText = i;

    degree.appendChild(degreeLabel);
    compass.appendChild(degree);
  }

  // Directly add event listener for non-iOS devices
  window.addEventListener("deviceorientation", updateCompass);
}

function updateCompass(event) {
  const needle = document.getElementById("needle");
  if (!needle) return;

  if (event.alpha !== null) {
    const angle = event.alpha;
    let correctedDirection = (angle + 180) % 360;

    // Adjust based on screen rotation
    const screenAngle = screen.orientation
      ? screen.orientation.angle
      : window.orientation || 0;
    correctedDirection = (correctedDirection - screenAngle + 360) % 360;

    // Detect iOS and apply offset
    if (isIOS()) {
      correctedDirection = (270 - correctedDirection + 360) % 360;
    }

    needle.style.transform = `translateX(-50%) translateY(-100%) rotate(${-correctedDirection}deg)`;
  }
}

window.addEventListener("message", (event) => {
  if (event.data === "startCompass") {
    initCompass();
  }
});
