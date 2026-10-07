(() => {
  let context;
  const enabled = () => localStorage.getItem('airsoft-audio-enabled') !== '0';
  async function unlock() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;
    context ||= new Audio();
    if (context.state === 'suspended') await context.resume();
    return context;
  }
  async function beep(frequency = 660, duration = 100, delay = 0) {
    if (!enabled()) return;
    try {
      const audio = await unlock();
      if (!audio || audio.state !== 'running') return;
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const start = audio.currentTime + delay / 1000;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration / 1000);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(start); oscillator.stop(start + duration / 1000 + 0.02);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch (_) {}
  }
  function alertAlarm() { beep(960, 200); beep(620, 200, 240); beep(960, 200, 480); }
  function successChime() { beep(523, 130); beep(659, 130, 150); beep(784, 260, 300); }
  function speak(text) {
    if (!enabled()) return false;
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      const status = document.getElementById('soundStatus');
      if (status) status.textContent = 'Voz indisponível neste aparelho. Os efeitos sonoros continuam disponíveis.';
      return false;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    const voice = speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith('pt'));
    if (voice) utterance.voice = voice;
    utterance.onerror = () => {
      const status = document.getElementById('soundStatus');
      if (status) status.textContent = 'Não foi possível reproduzir a voz. Confira o serviço de voz do aparelho.';
    };
    speechSynthesis.speak(utterance);
    return true;
  }
  function setEnabled(value) {
    localStorage.setItem('airsoft-audio-enabled', value ? '1' : '0');
    if (!value && window.speechSynthesis) speechSynthesis.cancel();
    if (value) { unlock(); beep(); }
    const status = document.getElementById('soundStatus');
    if (status) status.textContent = value ? 'Sons ativados neste aparelho.' : 'Sons desativados neste aparelho.';
  }
  window.AirsoftAudio = { unlock, beep, alertAlarm, successChime, setEnabled, enabled };
  window.AirsoftVoice = { speak };
  if (!window.AirsoftSound) window.AirsoftSound = { play(kind) {
    if (kind === 'armed') beep(960, 280);
    else beep(kind === 'locator' ? 620 : 660, kind === 'button' ? 45 : 160);
  }};
  document.addEventListener('pointerdown', () => { if (enabled()) unlock().catch(() => {}); }, { passive: true });
  document.addEventListener('keydown', () => { if (enabled()) unlock().catch(() => {}); });
  let previous;
  window.addEventListener('airsoft-state', () => {
    if (!window.AirsoftBus && typeof AirsoftBus === 'undefined') return;
    const state = AirsoftBus.read();
    if (previous && state.resetId === previous.resetId) {
      if (state.running && !previous.running && !state.finished) successChime();
      if (state.finished && !previous.finished) { alertAlarm(); speak('Operação encerrada.'); }
      else if (state.bombSequenceIndex > previous.bombSequenceIndex) successChime();
    }
    previous = state;
  });
})();
