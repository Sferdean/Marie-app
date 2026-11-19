import * as tts from 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.2/+esm';
import { vocabulary } from './data.js?v=10';

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

//--- ZAHLEN-ÜBERSETZER (0 bis 10.000 für DE, EN, RO) ---
function numberToGerman(n) {
  if (n === 0) return "Null";
  if (n === 10000) return "Zehntausend";
  const ones = ["", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
  const teens = ["zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
  const tens = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];

  let res = "";
  const th = Math.floor(n / 1000);
  const hu = Math.floor((n % 1000) / 100);
  const rem = n % 100;

  if (th > 0) res += ones[th] + "tausend";
  if (hu > 0) res += ones[hu] + "hundert";
  if (rem > 0) {
    if (rem === 1) res += "eins";
    else if (rem < 10) res += ones[rem];
    else if (rem < 20) res += teens[rem - 10];
    else {
      const o = rem % 10;
      const t = Math.floor(rem / 10);
      res += (o > 0 ? ones[o] + "und" : "") + tens[t];
    }
  }
  return res.charAt(0).toUpperCase() + res.slice(1);
}

function numberToEnglish(n) {
  if (n === 0) return "Zero";
  if (n === 10000) return "Ten thousand";
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  let parts = [];
  const th = Math.floor(n / 1000);
  const hu = Math.floor((n % 1000) / 100);
  const rem = n % 100;

  if (th > 0) parts.push(ones[th] + " thousand");
  if (hu > 0) parts.push(ones[hu] + " hundred");
  if (rem > 0) {
    if (rem < 10) parts.push(ones[rem]);
    else if (rem < 20) parts.push(teens[rem - 10]);
    else {
      const t = Math.floor(rem / 10);
      const o = rem % 10;
      parts.push(tens[t] + (o > 0 ? "-" + ones[o] : ""));
    }
  }
  const res = parts.join(" ");
  return res.charAt(0).toUpperCase() + res.slice(1);
}

function numberToRomanian(n) {
  if (n === 0) return "Zero";
  if (n === 10000) return "Zece mii";
  const ones = ["", "unu", "doi", "trei", "patru", "cinci", "șase", "șapte", "opt", "nouă"];
  const femOnes = ["", "o", "două", "trei", "patru", "cinci", "șase", "șapte", "opt", "nouă"];
  const teens = ["zece", "unsprezece", "doisprezece", "treisprezece", "paisprezece", "cincisprezece", "șaisprezece", "șaptesprezece", "optsprezece", "nouăsprezece"];
  const tens = ["", "", "douăzeci", "treizeci", "patruzeci", "cincizeci", "șaizeci", "șaptezeci", "optzeci", "nouăzeci"];

  let parts = [];
  const th = Math.floor(n / 1000);
  const hu = Math.floor((n % 1000) / 100);
  const rem = n % 100;

  if (th > 0) {
    parts.push(th === 1 ? "o mie" : femOnes[th] + " mii");
  }
  if (hu > 0) {
    parts.push(hu === 1 ? "o sută" : femOnes[hu] + " sute");
  }
  if (rem > 0) {
    if (rem < 10) parts.push(ones[rem]);
    else if (rem < 20) parts.push(teens[rem - 10]);
    else {
      const t = Math.floor(rem / 10);
      const o = rem % 10;
      parts.push(tens[t] + (o > 0 ? " și " + ones[o] : ""));
    }
  }
  const res = parts.join(" ");
  return res.charAt(0).toUpperCase() + res.slice(1);
}

function buildNumberCard(num) {
  return {
    category: "zahlen",
    num: num,
    de: num.toLocaleString("de-DE") + " (" + numberToGerman(num) + ")",
    en: numberToEnglish(num),
    ro: numberToRomanian(num),
    icon: "🔢"
  };
}

// Kuratierte Entdecker-Liste von 1 bis 10.000
const explorerNumbers = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 15, 20, 25, 50, 75, 100,
  200, 250, 500, 750, 1000, 2000, 2500, 5000, 7500, 10000
];

// --- APP LOGIK ---
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

  // Eigene Zahl testen (1 bis 10.000)
  document.getElementById("btn-test-number").addEventListener("click", showCustomNumber);
  document.getElementById("custom-number-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") showCustomNumber();
  });
}

function showCustomNumber() {
  const input = document.getElementById("custom-number-input");
  let val = parseInt(input.value, 10);
  if (isNaN(val) || val < 0) val = 0;
  if (val > 10000) val = 10000;
  input.value = val;

  const customCard = buildNumberCard(val);
  currentList[currentIndex] = customCard;
  renderExploreCard();
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
  currentIndex = 0;

  const numberTester = document.getElementById("number-tester");
  if (category === "zahlen") {
    currentList = explorerNumbers.map(n => buildNumberCard(n));
    numberTester.classList.remove("hidden");
  } else {
    currentList = vocabulary.filter(item => item.category === category);
    numberTester.classList.add("hidden");
  }

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
// --- EXAKTER ZAHLEN-ÜBERSETZER (0 bis 10.000 für DE, EN, RO) ---
function numberToGerman(n) {
  if (n === 0) return "Null";
  if (n === 10000) return "Zehntausend";
  const ones = ["", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
  const teens = ["zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
  const tens = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];

  let res = "";
  const th = Math.floor(n / 1000);
  const hu = Math.floor((n % 1000) / 100);
  const rem = n % 100;

  if (th > 0) res += ones[th] + "tausend";
  if (hu > 0) res += ones[hu] + "hundert";
  if (rem > 0) {
    if (rem === 1) res += "eins";
    else if (rem < 10) res += ones[rem];
    else if (rem < 20) res += teens[rem - 10];
    else {
      const o = rem % 10;
      const t = Math.floor(rem / 10);
      res += (o > 0 ? ones[o] + "und" : "") + tens[t];
    }
  }
  return res.charAt(0).toUpperCase() + res.slice(1);
}

function numberToEnglish(n) {
  if (n === 0) return "Zero";
  if (n === 10000) return "Ten thousand";
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  let parts = [];
  const th = Math.floor(n / 1000);
  const hu = Math.floor((n % 1000) / 100);
  const rem = n % 100;

  if (th > 0) parts.push(ones[th] + " thousand");
  if (hu > 0) parts.push(ones[hu] + " hundred");
  if (rem > 0) {
    if (rem < 10) parts.push(ones[rem]);
    else if (rem < 20) parts.push(teens[rem - 10]);
    else {
      const t = Math.floor(rem / 10);
      const o = rem % 10;
      parts.push(tens[t] + (o > 0 ? "-" + ones[o] : ""));
    }
  }
  const res = parts.join(" ");
  return res.charAt(0).toUpperCase() + res.slice(1);
}

function numberToRomanian(n) {
  if (n === 0) return "Zero";
  if (n === 10000) return "Zece mii";
  const ones = ["", "unu", "doi", "trei", "patru", "cinci", "șase", "șapte", "opt", "nouă"];
  const femOnes = ["", "o", "două", "trei", "patru", "cinci", "șase", "șapte", "opt", "nouă"];
  const teens = ["zece", "unsprezece", "doisprezece", "treisprezece", "paisprezece", "cincisprezece", "șaisprezece", "șaptesprezece", "optsprezece", "nouăsprezece"];
  const tens = ["", "", "douăzeci", "treizeci", "patruzeci", "cincizeci", "șaizeci", "șaptezeci", "optzeci", "nouăzeci"];

  let parts = [];
  const th = Math.floor(n / 1000);
  const hu = Math.floor((n % 1000) / 100);
  const rem = n % 100;

  if (th > 0) {
    parts.push(th === 1 ? "o mie" : femOnes[th] + " mii");
  }
  if (hu > 0) {
    parts.push(hu === 1 ? "o sută" : femOnes[hu] + " sute");
  }
  if (rem > 0) {
    if (rem < 10) parts.push(ones[rem]);
    else if (rem < 20) parts.push(teens[rem - 10]);
    else {
      const t = Math.floor(rem / 10);
      const o = rem % 10;
      parts.push(tens[t] + (o > 0 ? " și " + ones[o] : ""));
    }
  }
  const res = parts.join(" ");
  return res.charAt(0).toUpperCase() + res.slice(1);
}

function buildNumberCard(num) {
  return {
    category: "zahlen",
    num: num,
    de: num.toLocaleString("de-DE") + " (" + numberToGerman(num) + ")",
    en: numberToEnglish(num),
    ro: numberToRomanian(num),
    icon: "🔢"
  };
}

function getCurrentExploreItem() {
  if (currentCategory === "zahlen") {
    return buildNumberCard(currentIndex + 1);
  }
  return currentList[currentIndex];
}

function getExploreTotalCount() {
  return currentCategory === "zahlen" ? MAX_NUMBER : currentList.length;
}

// --- APP LOGIK ---
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

  document.getElementById("btn-test-number").addEventListener("click", jumpToCustomNumber);
  document.getElementById("btn-random-number").addEventListener("click", jumpToRandomNumber);
  document.getElementById("custom-number-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") jumpToCustomNumber();
  });
}

function jumpToCustomNumber() {
  stopAllAudio();
  const input = document.getElementById("custom-number-input");
  let val = parseInt(input.value, 10);
  if (isNaN(val) || val < 1) val = 1;
  if (val > MAX_NUMBER) val = MAX_NUMBER;
  input.value = val;

  currentIndex = val - 1;
  renderExploreCard();
}

function jumpToRandomNumber() {
  stopAllAudio();
  const randomNum = Math.floor(Math.random() * MAX_NUMBER) + 1;
  document.getElementById("custom-number-input").value = randomNum;
  currentIndex = randomNum - 1;
  renderExploreCard();
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
  currentIndex = 0;

  const numberTester = document.getElementById("number-tester");
  if (category === "zahlen") {
    currentList = [];
    numberTester.classList.remove("hidden");
  } else {
    currentList = vocabulary.filter(item => item.category === category);
    numberTester.classList.add("hidden");
  }

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
  const item = getCurrentExploreItem();
  const total = getExploreTotalCount();
  const visualBox = document.getElementById("card-visual");
  
  visualBox.textContent = item.icon;
  visualBox.style.backgroundColor = item.colorCode ? item.colorCode + "22" : "#f8f9fa";
  
  document.getElementById("word-de").textContent = item.de;
  document.getElementById("word-en").textContent = item.en;
  document.getElementById("word-ro").textContent = item.ro;
  document.getElementById("card-progress").textContent =
    (currentIndex + 1).toLocaleString("de-DE") + " / " + total.toLocaleString("de-DE");
}

function nextCard() {
  stopAllAudio();
  const total = getExploreTotalCount();
  currentIndex = (currentIndex + 1) % total;
  renderExploreCard();
}

function prevCard() {
  stopAllAudio();
  const total = getExploreTotalCount();
  currentIndex = (currentIndex - 1 + total) % total;
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
  const item = getCurrentExploreItem();
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

// --- QUIZ-MODUS (Echte Plus-, Minus- & Mal-Aufgaben bis 10.000) ---
function generateMathQuestion() {
  const opIndex = Math.floor(Math.random() * 3); // 0 = Plus, 1 = Minus, 2 = Mal
  let a, b, result, questionText;

  if (opIndex === 0) {
    // PLUS (krumme Zahlen, Ergebnis bis 10.000)
    a = Math.floor(Math.random() * 4900) + 17;
    b = Math.floor(Math.random() * (9999 - a)) + 13;
    result = a + b;
    questionText = a.toLocaleString("de-DE") + " + " + b.toLocaleString("de-DE") + " = ?";
  } else if (opIndex === 1) {
    // MINUS (krumme Zahlen bis 10.000)
    a = Math.floor(Math.random() * 9500) + 125;
    b = Math.floor(Math.random() * (a - 15)) + 11;
    result = a - b;
    questionText = a.toLocaleString("de-DE") + " - " + b.toLocaleString("de-DE") + " = ?";
  } else {
    // MAL (alle Multiplikationen bis Ergebnis <= 10.000)
    a = Math.floor(Math.random() * 98) + 2; // 2 bis 99
    const maxB = Math.min(100, Math.floor(10000 / a));
    b = Math.floor(Math.random() * (maxB - 1)) + 2;
    result = a * b;
    questionText = a.toLocaleString("de-DE") + " × " + b.toLocaleString("de-DE") + " = ?";
  }

  // Zwei plausible falsche Ergebnisse (kleine & größere Abweichungen)
  const wrongNums = new Set();
  const offsets = [-1, 1, -2, 2, -10, 10, -11, 11, -100, 100];
  while (wrongNums.size < 2) {
    const offset = offsets[Math.floor(Math.random() * offsets.length)];
    const candidate = result + offset;
    if (candidate >= 1 && candidate <= MAX_NUMBER && candidate !== result) {
      wrongNums.add(candidate);
    }
  }

  return {
    questionText,
    correctItem: buildNumberCard(result),
    wrongItems: Array.from(wrongNums).map(n => buildNumberCard(n))
  };
}

function nextQuizQuestion() {
  stopAllAudio();
  document.getElementById("quiz-feedback").textContent = "";
  
  quizLang = Math.random() < 0.7 ? "en" : "ro";
  const targetLangSpan = document.getElementById("quiz-target-lang");
  targetLangSpan.textContent = quizLang === "en" ? "Englisch 🇬🇧" : "Rumänisch 🇷🇴";

  let options = [];

  if (currentCategory === "zahlen") {
    const mathQ = generateMathQuestion();
    currentQuizItem = mathQ.correctItem;
    document.getElementById("quiz-visual").textContent = "🧮";
    document.getElementById("quiz-word-de").textContent = mathQ.questionText;

    options = [
      mathQ.correctItem[quizLang],
      mathQ.wrongItems[0][quizLang],
      mathQ.wrongItems[1][quizLang]
    ];
  } else {
    currentQuizItem = currentList[Math.floor(Math.random() * currentList.length)];
    document.getElementById("quiz-visual").textContent = currentQuizItem.icon;
    document.getElementById("quiz-word-de").textContent = currentQuizItem.de;

    const correctAnswer = currentQuizItem[quizLang];
    let wrongAnswers = currentList
      .filter(item => item[quizLang] !== correctAnswer)
      .map(item => item[quizLang]);
    
    wrongAnswers.sort(() => Math.random() - 0.5);
    options = [correctAnswer, ...wrongAnswers.slice(0, 2)];
  }

  options.sort(() => Math.random() - 0.5);
  const correctAnswer = currentQuizItem[quizLang];

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
    setTimeout(nextQuizQuestion, 2000);
  } else {
    button.classList.add("wrong");
    button.disabled = true;
    feedback.textContent = "Versuch es noch einmal!";
    feedback.style.color = "#e74c3c";
    playPronunciation(selected);
  }
}
