import * as tts from 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.2/+esm';
import { vocabulary } from './data.js';

let currentCategory = "";
let currentList = [];
let currentIndex = 0;
let stars = parseInt(localStorage.getItem("marie_stars"), 10) || 0;
let currentQuizItem = null;
let quizLang = "en";

// Audio-Cache & Status für Piper TTS
const roAudioCache = new Map();
let isPiperLoading = false;
let isModelCached = false;
let currentAudio = null;

document.addEventListener("DOMContentLoaded", () => {
  updateStarDisplay();
  bindEvents();
});

function bindEvents() {
  // Navigation & Startbildschirm
  document.getElementById("home-btn").addEventListener("click", showHome);
  document.querySelectorAll(".module-card").forEach(card => {
    card.addEventListener("click", () => startModule(card.dataset.category));
  });

  // Modus-Umschalter
  document.getElementById("btn-explore").addEventListener("click", () => setMode("explore"));
  document.getElementById("btn-quiz").addEventListener("click", () => setMode("quiz"));

  // Karten-Steuerung & Audio
  document.getElementById("btn-prev").addEventListener("click", prevCard);
  document.getElementById("btn-next").addEventListener("click", nextCard);
  document.getElementById("btn-speak-en").addEventListener("click", () => speakWord("en"));
  document.getElementById("btn-speak-ro").addEventListener("click", () => speakWord("ro"));
}

function updateStarDisplay() {
  const starEl = document.getElementById("star-count");
  starEl.textContent = stars;
  try {
    localStorage.setItem("marie_stars", stars);
  } catch (e) {
    console.warn("localStorage nicht verfügbar:", e);
  }
}

function addStar() {
  stars++;
  updateStarDisplay();
  const counterBox = document.querySelector(".star-counter");
  counterBox.classList.add("pop");
  setTimeout(() => counterBox.classList.remove("pop"), 300);
}

// Navigation
function showHome() {
  stopAllAudio();
  document.getElementById("home-screen").classList.remove("hidden");
  document.getElementById("learning-screen").classList.add("hidden");
  document.getElementById("home-btn").classList.add("hidden");
}

function startModule(category) {
  currentCategory = category;
  currentList = vocabulary.filter(item => item.category === category);
  currentIndex = 0;

  document.getElementById("home-screen").classList.add("hidden");
  document.getElementById("learning-screen").classList.remove("hidden");
  document.getElementById("home-btn").classList.remove("hidden");

  setMode("explore");
  renderExploreCard();
}

function setMode(mode) {
  stopAllAudio();
  document.getElementById("btn-explore").classList.toggle("active", mode === "explore");
  document.getElementById("btn-quiz").classList.toggle("active", mode === "quiz");

  if (mode === "explore") {
    document.getElementById("explore-view").classList.remove("hidden");
    document.getElementById("quiz-view").classList.add("hidden");
    renderExploreCard();
  } else {
    document.getElementById("explore-view").classList.add("hidden");
    document.getElementById("quiz-view").classList.remove("hidden");
    nextQuizQuestion();
  }
}

// Entdecker-Modus
function renderExploreCard() {
  const item = currentList[currentIndex];
  const visualBox = document.getElementById("card-visual");
  
  visualBox.textContent = item.icon;
  visualBox.style.backgroundColor = item.colorCode ? item.colorCode + "22" : "#f8f9fa";
  
  document.getElementById("word-de").textContent = item.de;
  document.getElementById("word-en").textContent = item.en;
  document.getElementById("word-ro").textContent = item.ro;
  document.getElementById("card-progress").textContent = `${currentIndex + 1} / ${currentList.length}`;
}

function nextCard() {
  stopAllAudio();
  currentIndex = (currentIndex + 1) % currentList.length;
  renderExploreCard();
}

function prevCard() {
  stopAllAudio();
  currentIndex = (currentIndex - 1 + currentList.length) % currentList.length;
  renderExploreCard();
}

// Audio-Steuerung (Englisch via Web Speech, Rumänisch via Piper TTS)
function stopAllAudio() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
}

function speakWord(lang) {
  const item = currentList[currentIndex];
  if (lang === "en") {
    speakEnglish(item.en);
  } else {
    speakRomanianPiper(item.ro);
  }
}

function speakEnglish(text) {
  stopAllAudio();
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
}

async function speakRomanianPiper(text) {
  stopAllAudio();

  // 1. Wenn bereits im Arbeitsspeicher gecached -> sofort abspielen
  if (roAudioCache.has(text)) {
    currentAudio = new Audio(roAudioCache.get(text));
    currentAudio.play();
    return;
  }

  if (isPiperLoading) return; // Mehrfachklicks während Berechnung abfangen

  const roBtn = document.getElementById("btn-speak-ro");
  const statusBanner = document.getElementById("tts-status");

  try {
    isPiperLoading = true;
    if (roBtn) {
      roBtn.disabled = true;
      roBtn.textContent = "⏳";
    }
    if (!isModelCached) {
      statusBanner.classList.remove("hidden");
    }

    // Piper TTS Inferenz mit rumänischem Modell (Mihai)
    const wavBlob = await tts.predict({
      text: text,
      voiceId: 'ro_RO-mihai-medium'
    });

    isModelCached = true;
    const audioUrl = URL.createObjectURL(wavBlob
