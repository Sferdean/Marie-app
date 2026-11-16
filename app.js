import * as tts from 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.2/+esm';
import { vocabulary } from './data.js?v=3';

let currentCategory = "";
let currentList = [];
let currentIndex = 0;
let stars = parseInt(localStorage.getItem("marie_stars"), 10) || 0;
let currentQuizItem = null;
let quizLang = "en";

const roAudioCache = new Map();
let isPiperLoading = false;
let isModelCached = false;
let currentAudio = null;

document.addEventListener("DOMContentLoaded", () => {
  updateStarDisplay();
  bindEvents();
});

function bindEvents() {
  document.getElementById("home-btn").addEventListener("click", showHome);
  document.querySelectorAll(".module-card").forEach(card => {
    card.addEventListener("click", () => startModule(card.dataset.category));
  });

  document.getElementById("btn-explore").addEventListener("click", () => setMode("explore"));
  document.getElementById("btn-quiz").addEventListener("click", () => setMode("quiz"));

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

function renderExploreCard() {
  const item = currentList[currentIndex];
  const visualBox = document.getElementById("card-visual");
  
  visualBox.textContent = item.icon;
  visualBox.style.backgroundColor = item.colorCode ? item.colorCode + "22" : "#f8f9fa";
  
  document.getElementById("word-de").textContent = item.de;
  document.getElementById("word-en").textContent = item.en;
  document.getElementById("word-ro").textContent = item.ro;
  document.getElementById("card-progress").textContent = (currentIndex + 1) + " / " + currentList.length;
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

  if (roAudioCache.has(text)) {
    currentAudio = new Audio(roAudioCache.get(text));
    currentAudio.play();
    return;
  }

  if (isPiperLoading) return;

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

    const wavBlob = await tts.predict({
      text: text,
      voiceId: 'ro_RO-mihai-medium'
    });

    isModelCached = true;
    const audioUrl = URL.createObjectURL(wavBlob);
    roAudioCache.set(text, audioUrl);

    currentAudio = new Audio(audioUrl);
    await currentAudio.play();
  } catch (error) {
    console.error("Piper TTS Fehler, nutze Browser-Fallback:", error);
    if ("speechSynthesis" in window) {
      const fallback = new SpeechSynthesisUtterance(text);
      fallback.lang = "ro-RO";
      fallback.rate = 0.85;
      window.speechSynthesis.speak(fallback);
    }
  } finally {
    isPiperLoading = false;
    statusBanner.classList.add("hidden");
    if (roBtn) {
      roBtn.disabled = false;
      roBtn.textContent = "🔊";
    }
  }
}

function nextQuizQuestion() {
  stopAllAudio();
  document.getElementById("quiz-feedback").textContent = "";
  
  currentQuizItem = currentList[Math.floor(Math.random() * currentList.length)];
  quizLang = Math.random() < 0.7 ? "en" : "ro";

  const targetLangSpan = document.getElementById("quiz-target-lang");
  targetLangSpan.textContent = quizLang === "en" ? "Englisch 🇬🇧" : "Rumänisch 🇷🇴";

  document.getElementById("quiz-visual").textContent = currentQuizItem.icon;
  document.getElementById("quiz-word-de").textContent = currentQuizItem.de;

  const correctAnswer = currentQuizItem[quizLang];
  let wrongAnswers = currentList
    .filter(item => item[quizLang] !== correctAnswer)
    .map(item => item[quizLang]);
  
  wrongAnswers.sort(() => Math.random() - 0.5);
  let options = [correctAnswer, ...wrongAnswers.slice(0, 2)];
  options.sort(() => Math.random() - 0.5);

  const optionsContainer = document.getElementById("quiz-options");
  optionsContainer.innerHTML = "";

  options.forEach(optionText => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = optionText;
    btn.addEventListener("click", () => checkAnswer(btn, optionText, correctAnswer));
    optionsContainer.appendChild(btn);
  });
}

function checkAnswer(button, selected, correct) {
  const feedback = document.getElementById("quiz-feedback");
  const playPronunciation = (word) => {
    if (quizLang === "en") speakEnglish(word);
    else speakRomanianPiper(word);
  };

  if (selected === correct) {
    button.classList.add("correct");
    feedback.textContent = "Super gemacht, Marie! +1 ⭐";
    feedback.style.color = "#2ecc71";
    playPronunciation(correct);
    addStar();

    document.querySelectorAll(".option-btn").forEach(b => b.disabled = true);
    setTimeout(nextQuizQuestion, 1800);
  } else {
    button.classList.add("wrong");
    button.disabled = true;
    feedback.textContent = "Versuch es noch einmal!";
    feedback.style.color = "#e74c3c";
    playPronunciation(selected);
  }
}
