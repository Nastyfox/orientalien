import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.12.7/+esm";

import { checkAnswer } from "./utils-challenge.js";

let lockElement = null;
let enterBTN = null;

export function initCombinationLock() {
  lockElement = document.getElementById("lock");
  makeLock();
}

function makeLock() {
  let combo;
  const dials = lockElement.getAttribute("data-dials");
  lockElement.classList.add("myLock");

  const lockInset = document.createElement("div");
  lockInset.classList.add("lockInset");
  const lockLine = document.createElement("div");
  lockLine.classList.add("lockLine");
  const lockWrapper = document.createElement("div");
  lockWrapper.classList.add("lockWrapper");

  lockInset.appendChild(lockLine);
  lockInset.appendChild(lockWrapper);
  lockElement.appendChild(lockInset);

  enterBTN = document.createElement("button");
  enterBTN.classList.add("btnEnter", "button");
  enterBTN.textContent = "Valider";
  lockElement.appendChild(enterBTN);

  //On enlève 1% de marge à gauche et à droite
  const widthDial = 100 / dials - 2;

  for (let i = 0; i < dials; i++) {
    const dial = document.createElement("div");
    dial.classList.add("dial");
    dial.style.width = `${widthDial}%`;
    const slider = document.createElement("ol");
    dial.appendChild(slider);
    lockWrapper.appendChild(dial);

    for (let n = 0; n < 10; n++) {
      const li = document.createElement("li");
      li.textContent = n;
      slider.appendChild(li);
    }
    slider.insertBefore(slider.lastChild, slider.firstChild);
  }

  const shadow = document.createElement("div");
  shadow.classList.add("shadow");
  lockWrapper.appendChild(shadow);

  const dialMove = function (e) {
    const slider = e.currentTarget;
    slider.appendChild(slider.firstChild);
    gsap.fromTo(
      slider,
      { top: 0 },
      { top: -22, duration: 0.35, ease: "power2.out" }
    );
  };

  const sliders = lockElement.querySelectorAll("ol");
  sliders.forEach(function (slider) {
    slider.addEventListener("click", dialMove);
  });
}

export function getCombination() {
  let combo = "";
  const activeLis = lockElement.querySelectorAll("li:nth-child(2)");
  activeLis.forEach(function (li) {
    combo += li.textContent;
  });
  return combo;
}

export function getEnterButton() {
  return enterBTN;
}

export function codeCheck(combo, targetId) {
  console.log(targetId);
  checkAnswer(combo, lockElement, targetId);
}
