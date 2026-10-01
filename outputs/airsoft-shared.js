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
    update(state => {
      state.log = [{ time: stamp(), text }, ...(state.log || [])].slice(0, 80);
    });
  }

  function reset() {
    write({ ...defaults, resetId: Date.now(), log: [{ time: stamp(), text: 'Sistema reiniciado.' }] });
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
