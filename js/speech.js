// Optional voice typing through the browser's built-in speech recognition. Where it is missing, the button simply does not appear;
// the keyboard's own microphone key still works everywhere.
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const speechSupported = Boolean(Recognition);

/** @returns a controller { toggle(), stop(), listening } that calls onText(finalText) as the user speaks */
export function createDictation({ onText, onState, onProblem }) {
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = /^en/i.test(navigator.language) ? navigator.language : 'en-US';
  let listening = false;
  const set = (value) => { listening = value; onState?.(value); };

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) onText(event.results[i][0].transcript.trim());
    }
  };
  recognition.onend = () => set(false);
  recognition.onerror = (event) => {
    set(false);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      onProblem?.('The microphone is blocked. You can use the microphone key on your keyboard instead.');
    } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
      onProblem?.('Voice typing is not working right now. You can use the microphone key on your keyboard instead.');
    }
  };

  return {
    get listening() { return listening; },
    toggle() {
      if (listening) { recognition.stop(); return; }
      try { recognition.start(); set(true); } catch { /* already starting */ }
    },
    stop() { try { recognition.stop(); } catch {} },
  };
}
