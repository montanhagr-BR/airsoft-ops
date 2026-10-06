const AirsoftBus = (() => {
  const key = 'airsoft-ops-state-v1';
  let channel = null;
  try {
    channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('airsoft-ops-state-v1') : null;
  } catch {
    channel = null;
  }
  const defaults = {
    running: false,
    finished: false,
    mode: 'Bomba clássica',
    team1Name: 'Time 1 - CT',
    team2Name: 'Time 2 - Terrorista',
    playerRegistrationOpen: true,
    teamTrackingEnabled: true,
    keepOrganizationsTogether: true,
    teamStartPositions: { ct: null, terrorist: null },
    tacticalAreas: [],
    bombDevices: [],
    players: [],
    resetId: 0,
    gameSeconds: 1080,
    bombSeconds: null,
    bombSequenceIndex: 0,
    bombDeploymentMode: 'sequential',
    bombSequence: [
      { id:'bomb-1', name:'Bomba Alpha', armCode:'4072', defuseCode:'7294', resultSeconds:600, status:'waiting', locatorEnabled:true, lat:null, lng:null, remoteArmEnabled:true, remoteDefuseEnabled:true }
    ],
    actionSeconds: 10,
    resultSeconds: 15,
    penaltySeconds: 5,
    penaltyEnabled: true,
    bombState: 'Preparação',
    phase: 'Aguardando início',
    winner: null,
    armCode: '4072',
    defuseCode: '7294',
    dataNotebookName: 'NBK-17 Operações',
    dataFolderName: 'OP_BLACKBOX',
    dataFolderOptions: ['SYSTEM_CACHE', 'OP_BLACKBOX', 'FIELD_LOGS', 'ARCHIVE_09'],
    dataCorrectFolder: 1,
    dataFileName: 'rotas-extracao.enc',
    dataRecipient: 'relay@darknet.ops',
    dataPayloadSize: '48 MB',
    dataDecryptCode: '9137',
    dataAccessSeconds: 6,
    dataDownloadSeconds: 10,
    dataDecryptSeconds: 12,
    dataSendSeconds: 8,
    dataStage: 'locked',
    dataDownloaded: false,
    dataDecrypted: false,
    dataSent: false,
    terminalName: 'TERMINAL AX-07',
    terminalCaptureSeconds: 10,
    terminalValidationIntervalSeconds: 60,
    terminalValidationWindowSeconds: 15,
    terminalWinSeconds: 300,
    terminalCaptureCode: '2468',
    terminalCaptureNeedsCode: true,
    terminalRandomRevalidateCode: true,
    terminalValidationCode: '----',
    terminalOwner: null,
    terminalValidationRequired: false,
    terminalValidationTeam: null,
    terminalTeam1Seconds: 0,
    terminalTeam2Seconds: 0,
    locatorArtifactName: 'Artefato AX-07',
    gameObjectives: 'Localize o artefato, cumpra as etapas do modo de jogo e aguarde novas ordens do Controlador.',
    locatorEnabled: false,
    locatorUpdateMode: '10s',
    locatorTransmitOnMove: false,
    locatorAccuracyMode: 'high',
    bombActivationAlertEnabled: true,
    locatorOnBombActivated: false,
    bombActivationId: 0,
    bombActivatedAt: null,
    locatorArtifactLat: null,
    locatorArtifactLng: null,
    locatorLastMasterFix: null,
    locatorLastArtifactFix: null,
    locatorArtifactAccuracy: null,
    locatorProximityMeters: 12,
    locatorMovementAlertEnabled: true,
    locatorMovementThresholdMeters: 25,
    locatorOriginLat: null,
    locatorOriginLng: null,
    locatorMovementDetected: false,
    locatorMovementNoticeId: 0,
    locatorMovementMeters: 0,
    armFactors: 1,
    defuseFactors: 1,
    qrRequired: true,
    qrStageNonce: 0,
    qrStageName: 'preparacao',
    qrArm: 0,
    qrDefuse: 0,
    qrArmAt: null,
    qrDefuseAt: null,
    pending: null,
    operationId: 0,
    operation: null,
    noticeId: 0,
    notice: null,
    ctHasCode: false,
    terroristHasCode: false,
    ctBombValidated: false,
    terroristBombValidated: false,
    ctKnownCode: '----',
    terroristKnownCode: '----',
    log: []
  };

  function read() {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') };
    } catch {
      return { ...defaults };
    }
  }

  function write(state) {
    localStorage.setItem(key, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('airsoft-state', { detail: state }));
    if (channel) channel.postMessage({ type: 'state-changed' });
  }

  function stamp() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function update(mutator) {
    const state = read();
    mutator(state);
    write(state);
    return state;
  }

  function log(text) {
    const current = read();
    if (!current.running && !current.startedAt) return;
    update(state => {
      state.log = [{ time: stamp(), text }, ...(state.log || [])].slice(0, 80);
    });
  }

  function reset() {
    write({ ...defaults, startedAt: null, resetId: Date.now(), log: [] });
  }

  function subscribe(fn) {
    const handler = () => fn(read());
    window.addEventListener('storage', handler);
    window.addEventListener('airsoft-state', handler);
    if (channel) channel.addEventListener('message', handler);
    handler();
  }

  if (!localStorage.getItem(key)) reset();

  return { read, write, update, log, reset, subscribe };
})();

const AirsoftVoice = (() => {
  function speak(text) {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(text));
      utterance.lang = 'pt-BR';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  }
  return { speak };
})();

const AirsoftAudio = (() => {
  let audioCtx = null;
  function getContext() {
    if (!audioCtx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    return audioCtx;
  }

  function beep(frequency = 440, duration = 80, type = 'sine') {
    if (window.AirsoftSound && typeof window.AirsoftSound.play === 'function') {
      window.AirsoftSound.play('button');
      return;
    }
    try {
      const ctx = getContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration / 1000);
    } catch (_) {}
  }

  function alertAlarm() {
    beep(880, 220, 'square');
    setTimeout(() => beep(660, 220, 'square'), 240);
  }

  function successChime() {
    beep(523.25, 120);
    setTimeout(() => beep(659.25, 120), 130);
    setTimeout(() => beep(783.99, 220), 260);
  }

  return { beep, alertAlarm, successChime };
})();

if (typeof window !== 'undefined') {
  let lastPhase = '';
  let lastBombState = '';
  AirsoftBus.subscribe(s => {
    if (s.phase && s.phase !== lastPhase) {
      lastPhase = s.phase;
      if (s.phase.includes('iniciada') || s.phase.includes('andamento')) {
        AirsoftVoice.speak('Atenção operadores. Missão iniciada.');
      } else if (s.phase.includes('Concluído') || s.phase.includes('neutralizada')) {
        AirsoftVoice.speak('Missão cumprida. Etapa concluída com sucesso.');
      }
    }
    if (s.bombState && s.bombState !== lastBombState) {
      lastBombState = s.bombState;
      if (s.bombState.includes('Armada')) {
        AirsoftVoice.speak('Atenção: Bomba armada. Contagem regressiva iniciada.');
        AirsoftAudio.alertAlarm();
      } else if (s.bombState.includes('neutralizada')) {
        AirsoftVoice.speak('Bomba neutralizada com sucesso.');
        AirsoftAudio.successChime();
      }
    }
  });
}
