// ===================================================================================
// MÓDULO DE EMERGÊNCIA (emergencia.js)
// Gerencia o acompanhamento de trajeto, contatos de confiança e alertas.
// ===================================================================================

// Importa funções do Firebase Realtime Database
// ADICIONADO: query, orderByChild, equalTo para a função resumeActiveSession
import { getDatabase, ref, set, get, push, remove, onValue, off, update, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// Variáveis de estado do módulo (serão inicializadas em setupEmergencia)
let db, showMessage, showLoader, hideLoader;
let currentUserId;
let emergencyLinkModalInstance, safetyCheckResponseModalInstance, userSafetyCheckModalInstance, emergencyActionModalInstance;
let locationWatchId = null;
let currentEmergencySessionId = null;
let checkRequestListener = null;
let modoAlertaAtivo = false; // Estado para controlar se o pânico foi acionado

// --- NOVAS VARIÁVEIS (PATCHES) ---
let lastFirebaseUpdateTimestamp = 0; // Usado para throttling (Seção 2)
let contactsListener = null; // Usado para prevenir listeners duplicados (Seção 3)
// ----------------------------------

// Constantes e variáveis para o ciclo de verificação de segurança da usuária
const USER_CHECK_VISIBILITY_DURATION_MS = 15000; // Duração que o modal fica visível (15 segundos)
const USER_CHECK_INTERVAL_MS = 15000; // Intervalo que o modal fica oculto (15 segundos)
let userSafetyCheckIntervalId = null; // Armazena o ID do setInterval para o ciclo
let userSafetyCheckVisibilityTimeoutId = null; // Armazena o ID do setTimeout para esconder o modal

// Mapeamento dos elementos da UI relevantes para este módulo
const ui = {
    emergencyButton: document.getElementById('emergencyButton'),
    emergencyStatus: document.getElementById('emergencyStatus'),
    checkContactButton: document.getElementById('checkContactButton'),
    trackingLinkInput: document.getElementById('trackingLinkInput'),
    copyLinkButton: document.getElementById('copyLinkButton'),
    shareButton: document.getElementById('shareButton'),
    copyStatus: document.getElementById('copyStatus'),
    safetyCheckResponseModalIcon: document.getElementById('safetyCheckResponseModalIcon'),
    safetyCheckResponseModalText: document.getElementById('safetyCheckResponseModalText'),
    safetyCheckResponseModalHeader: document.getElementById('safetyCheckResponseModalHeader'),
    contactNameInput: document.getElementById('contactName'),
    contactDetailInput: document.getElementById('contactDetail'),
    addContactButton: document.getElementById('addContactButton'),
    contactsListDiv: document.getElementById('contactsList'),
    userSafetyCheckYes: document.getElementById('userSafetyCheckYes'),
    userSafetyCheckNo: document.getElementById('userSafetyCheckNo'),
    warnContactsButton: document.getElementById('warnContactsButton'),
    cancelEmergencyButton: document.getElementById('cancelEmergencyButton')
};

// --- Funções de Validação e Formatação ---

function isValidEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

// Verifica se é um número de telefone BR VÁLIDO (10 ou 11 dígitos)
function isValidPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10 || cleaned.length === 11;
}

// Verifica se é um username do Telegram (@ seguido por caracteres)
function isValidTelegramUsername(detail) {
    return typeof detail === 'string' && detail.startsWith('@') && detail.length > 1;
}

function maskPhone(value) {
    value = value.replace(/\D/g, '');
    value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
    value = value.replace(/(\d)(\d{4})$/, '$1-$2');
    return value;
}

// --- Inicialização do Módulo ---

/**
 * @function setupEmergencia
 * @description Configura o módulo de emergência, injetando dependências e adicionando listeners.
 * @param {object} dependencies - Objeto contendo dependências externas (db, showMessage, etc.).
 * @returns {object} - Objeto com funções expostas pelo módulo (ex: loadEmergencyContacts).
 */
export function setupEmergencia(dependencies) {
    if (dependencies) {
        db = dependencies.db;
        showMessage = dependencies.showMessage;
        showLoader = dependencies.showLoader;
        hideLoader = dependencies.hideLoader;
        emergencyLinkModalInstance = dependencies.emergencyLinkModalInstance;
        safetyCheckResponseModalInstance = dependencies.safetyCheckResponseModalInstance;
        userSafetyCheckModalInstance = dependencies.userSafetyCheckModalInstance;
        emergencyActionModalInstance = dependencies.emergencyActionModalInstance;
    } else {
        console.error("Módulo de Emergência: Dependências não fornecidas!");
        return {};
    }

    if (ui.emergencyButton) ui.emergencyButton.addEventListener('click', toggleEmergencyAlert);
    if (ui.checkContactButton) ui.checkContactButton.addEventListener('click', handleCheckContact);
    if (ui.copyLinkButton) ui.copyLinkButton.addEventListener('click', handleCopyLink);
    // O botão de compartilhar no MODAL chama handleShare diretamente
    if (ui.shareButton) ui.shareButton.addEventListener('click', handleShare);
    if (ui.addContactButton) ui.addContactButton.addEventListener('click', handleAddEmergencyContact);

    if (ui.contactDetailInput) {
        // Atualiza placeholder para incluir Telegram
        ui.contactDetailInput.placeholder = "Telefone (ex: (11) 9...) ou Telegram (@usuario)";
        ui.contactDetailInput.addEventListener('input', (e) => {
            const value = e.target.value;
            // Só aplica máscara se NÃO for email E NÃO for username de telegram
            if (!value.includes('@')) {
                e.target.value = maskPhone(value);
            }
        });
    }

    if (ui.userSafetyCheckYes) ui.userSafetyCheckYes.addEventListener('click', handleUserSafetyCheckYes);
    if (ui.userSafetyCheckNo) ui.userSafetyCheckNo.addEventListener('click', handleUserSafetyCheckNo);
    if (ui.cancelEmergencyButton) ui.cancelEmergencyButton.addEventListener('click', handleCancelPanicMode);

    return {
        loadEmergencyContacts,
        resumeActiveSession // <- MODIFICADO (PATCH SEÇÃO 1): Exporta a função de resumir sessão
    };
}

// ===================================================================================
// SEÇÃO 1 (PATCH): CORREÇÃO DE CONSISTÊNCIA DA SESSÃO (RESUME)
// ===================================================================================

/**
 * @function resumeActiveSession
 * @description Verifica se há sessões ativas (ou perdidas) no Firebase para este usuário
 * e re-hidrata o estado do app para continuar o acompanhamento.
 * Deve ser chamada após a autenticação bem-sucedida.
 * @param {string} userId - O ID do usuário autenticado.
 */
export async function resumeActiveSession(userId) {
    if (!userId) return;
    currentUserId = userId; // Garante que o ID esteja definido no módulo

    console.log("Verificando sessões ativas para o usuário:", userId);

    try {
        const sessionsRef = ref(db, 'emergencySessions');
        // Consulta o Firebase por sessões "não finalizadas" deste usuário
        const q = query(
            sessionsRef,
            orderByChild('userId'),
            equalTo(userId)
        );

        const snapshot = await get(q);

        if (snapshot.exists()) {
            let sessionToResume = null;
            let sessionId = null;

            // Itera sobre as sessões encontradas
            snapshot.forEach(childSnapshot => {
                const session = childSnapshot.val();
                if (session.status === "active" || session.status === "connection_lost") {
                    // Encontrou uma sessão que precisa ser resumida
                    sessionToResume = session;
                    sessionId = childSnapshot.key;
                }
            });

            if (sessionToResume && sessionId) {
                console.warn(`Resumindo sessão ativa encontrada: ${sessionId}`);

                // 1. Re-hidrata o estado global do módulo
                currentEmergencySessionId = sessionId;
                modoAlertaAtivo = (sessionToResume.status === 'panic_triggered_by_user'); // Re-hidrata o estado de pânico
                lastLocation = sessionToResume.liveLocation || sessionToResume.initialLocation;

                // 2. Atualiza a UI para refletir o estado de "acompanhamento ativo"
                ui.emergencyButton.innerHTML = '<i class="fas fa-times-circle me-2"></i>ENCERRAR ACOMPANHAMENTO';
                ui.emergencyButton.classList.remove('btn-danger', 'emergency-button-pulse-animation');
                ui.emergencyButton.classList.add('btn-danger-active');
                ui.checkContactButton.style.display = 'block';
                ui.emergencyStatus.textContent = "Acompanhamento (resumido) ativo.";
                ui.emergencyStatus.classList.remove('d-none');

                // 3. Re-anexa o listener de 'checkRequest'
                const checkRequestRef = ref(db, `emergencySessions/${currentEmergencySessionId}/checkRequest`);
                if (checkRequestListener) off(checkRequestRef, 'value', checkRequestListener);
                checkRequestListener = onValue(checkRequestRef, handleCheckRequestUpdate);

                // 4. Reinicia o watchPosition
                if (locationWatchId) navigator.geolocation.clearWatch(locationWatchId);

                // (PATCH SEÇÃO 2)
                lastFirebaseUpdateTimestamp = Date.now(); // Inicia o timer do throttle
                locationWatchId = navigator.geolocation.watchPosition(
                    handleLocationUpdate, // <- MODIFICADO para usar a função com throttle
                    handleLocationError,
                    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
                );

                // 5. Reinicia o ciclo de verificação "Você está bem?" APENAS se o pânico não estiver ativo
                if (!modoAlertaAtivo) {
                    startUserSafetyCheckCycle();
                }

                // 6. Atualiza o status de 'connection_lost' de volta para 'active'
                if (sessionToResume.status === "connection_lost") {
                     await update(ref(db, `emergencySessions/${currentEmergencySessionId}`), {
                        status: 'active',
                        lastEventTimestamp: new Date().toISOString()
                    });
                }
            } else {
                console.log("Nenhuma sessão ativa encontrada para resumir.");
            }
        }
    } catch (error) {
        console.error("Erro ao tentar resumir sessão:", error);
        showMessage("Erro ao verificar sessões anteriores.", true);
    }
}


// --- Lógica de Acompanhamento de Trajeto ---

/** Alterna entre iniciar e cancelar o acompanhamento. */
function toggleEmergencyAlert() {
    locationWatchId ? handleCancelEmergencyAlert() : handleActivateEmergencyAlert();
}

// ===================================================================================
// 🔐 SEGURANÇA AVANÇADA — FAIL-SAFE, MODO SILENCIOSO E DETECÇÃO ANÔMALA
// ===================================================================================

// Fail-safe: registra no Firebase se a aba for fechada inesperadamente
window.addEventListener('beforeunload', () => {
    if (currentEmergencySessionId && locationWatchId) {
        // Usamos update em vez de set para não apagar a sessão, apenas atualizar o status
        update(ref(db, `emergencySessions/${currentEmergencySessionId}`), {
            status: 'connection_lost',
            lastEventTimestamp: new Date().toISOString()
        });
        console.warn("⚠️ Conexão perdida — status atualizado no servidor.");
    }
});

// --- DETECÇÃO DE MOVIMENTO ANÔMALO ---
let lastLocation = null;
function detectAnomalies(newLocation) {
    if (!lastLocation) { lastLocation = newLocation; return; }

    // (PATCH SEÇÃO 2) Apenas calcula se tivermos um timestamp anterior
    if (lastLocation.timestamp) {
        const R = 6371e3; // Raio da Terra em metros
        const φ1 = lastLocation.latitude * Math.PI / 180;
        const φ2 = newLocation.latitude * Math.PI / 180;
        const Δλ = (newLocation.longitude - lastLocation.longitude) * Math.PI / 180;
        const d = Math.acos(Math.sin(φ1) * Math.sin(φ2) +
                            Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ)) * R;

        const timeDiff = (new Date(newLocation.timestamp) - new Date(lastLocation.timestamp)) / 1000;

        if (timeDiff > 0) { // Evita divisão por zero
            const speed = d / timeDiff; // m/s

            if (speed > 50) { // velocidade anormal (>180 km/h)
                console.warn("⚠️ Movimento anômalo detectado — alerta silencioso enviado.");
                update(ref(db, `emergencySessions/${currentEmergencySessionId}`), {
                    anomalyDetected: true,
                    lastEventTimestamp: new Date().toISOString()
                });
            }
        }
    }

    lastLocation = newLocation;
}

// --- MODO DE PÂNICO SILENCIOSO ---
async function handleSilentPanic() {
    modoAlertaAtivo = true;

    if (currentEmergencySessionId) {
        await update(ref(db, `emergencySessions/${currentEmergencySessionId}`), {
            status: 'panic_triggered_by_user',
            silentMode: true, // 🔕 Flag para o tracker.html
            lastEventTimestamp: new Date().toISOString()
        });
        console.log("🚨 Alerta silencioso enviado — tela permanece normal.");
    }
}

// ===================================================================================
// SEÇÃO 2 (PATCH): OTIMIZAÇÃO DE RASTREAMENTO (THROTTLING)
// ===================================================================================

/**
 * @function getHaversineDistance
 * @description Calcula a distância (em metros) entre duas coordenadas GPS.
 */
function getHaversineDistance(coords1, coords2) {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = coords1.latitude * Math.PI / 180;
    const φ2 = coords2.latitude * Math.PI / 180;
    const Δφ = (coords2.latitude - coords1.latitude) * Math.PI / 180;
    const Δλ = (coords2.longitude - coords1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distância em metros
}

/**
 * @function handleLocationUpdate
 * @description Callback para o `watchPosition`. Aplica throttling para economizar
 * bateria e dados, enviando atualizações ao Firebase apenas se o tempo ou
 * a distância mínima forem atingidos.
 */
function handleLocationUpdate(pos) {
    const now = Date.now();
    const MIN_UPDATE_INTERVAL_MS = 10000; // 10 segundos
    const MIN_UPDATE_DISTANCE_METERS = 20; // 20 metros

    const { latitude, longitude, accuracy, heading, speed } = pos.coords;
    const liveLocationData = {
        latitude, longitude, accuracy,
        heading: heading ?? null,
        speed: speed ?? null,
        timestamp: new Date().toISOString()
    };

    // Verifica a distância desde a última localização (se houver)
    const distanceMoved = lastLocation ? getHaversineDistance(lastLocation, liveLocationData) : 0;

    // CONDIÇÃO DE THROTTLE:
    // Atualiza o Firebase se (passou 10s) OU (moveu > 20m)
    if ( (now - lastFirebaseUpdateTimestamp > MIN_UPDATE_INTERVAL_MS) ||
         (distanceMoved > MIN_UPDATE_DISTANCE_METERS) ) {

        console.log(`Atualizando Firebase: (Tempo: ${now - lastFirebaseUpdateTimestamp > MIN_UPDATE_INTERVAL_MS}, Dist: ${distanceMoved > MIN_UPDATE_DISTANCE_METERS})`);

        lastFirebaseUpdateTimestamp = now; // Reseta o timer
        const sessionPath = `emergencySessions/${currentEmergencySessionId}`;

        // Atualiza a localização ao vivo e adiciona ao histórico (path)
        set(ref(db, `${sessionPath}/liveLocation`), liveLocationData);
        push(ref(db, `${sessionPath}/path`), liveLocationData); // Cria um histórico de pontos

        // Atualiza o 'heartbeat' para o tracker saber que estamos online
        update(ref(db, sessionPath), { heartbeat: new Date().toISOString() });

        // 🛰️ VERIFICAÇÃO DE ANOMALIA
        detectAnomalies(liveLocationData); // lastLocation é atualizado dentro de detectAnomalies

    } else {
        // console.log("Localização atualizada, mas ignorada (throttle).");
    }
}

/**
 * @function handleLocationError
 * @description Callback de erro para o `watchPosition`.
 */
function handleLocationError(error) {
    // Informa sobre erros no rastreamento, mas não para a sessão
    ui.emergencyStatus.textContent = "Erro no rastreamento: " + error.message;
    console.error("Geolocation watchPosition Error:", error);
}


/** * @function handleActivateEmergencyAlert
 * Inicia o monitoramento de localização e a sessão de emergência no Firebase.
 */
async function handleActivateEmergencyAlert() {
    if (!currentUserId) { showMessage("Você precisa estar logada para usar esta função.", true); return; }
    if (locationWatchId) return; // Já está ativo

    ui.emergencyButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>INICIANDO...';
    ui.emergencyButton.disabled = true;

    try {
        // 1. Obtém a localização inicial
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
        const { latitude, longitude, accuracy } = position.coords;
        const locationData = { latitude, longitude, accuracy, timestamp: new Date().toISOString() };

        lastLocation = locationData; // Define a localização inicial para o detector de anomalia

        // 2. Cria a sessão de emergência no Firebase
        const newSessionRef = push(ref(db, 'emergencySessions'));
        currentEmergencySessionId = newSessionRef.key;
        const sessionPath = `emergencySessions/${currentEmergencySessionId}`;

        await set(newSessionRef, {
            userId: currentUserId,
            status: "active",
            startTime: new Date().toISOString(),
            initialLocation: locationData,
            liveLocation: locationData, // Inicia com a localização inicial
            heartbeat: new Date().toISOString() // Define o heartbeat inicial
        });

        // 3. Gera e exibe o link de acompanhamento no modal
        const trackingLink = `${window.location.origin}${window.location.pathname.replace('index.html', '')}tracker.html?session=${currentEmergencySessionId}`;
        ui.trackingLinkInput.value = trackingLink;
        emergencyLinkModalInstance.show();

        // ===================================================================================
        // --- ADICIONADO: Tentativa de Notificação via CallMeBot ---
        // ===================================================================================
        // Dispara a tentativa de envio via CallMeBot *após* mostrar o modal
        await notifyContactsViaCallMeBot(trackingLink);
        // ===================================================================================

        // 4. Atualiza a UI principal
        ui.emergencyButton.innerHTML = '<i class="fas fa-times-circle me-2"></i>ENCERRAR ACOMPANHAMENTO';
        ui.emergencyButton.classList.remove('btn-danger', 'emergency-button-pulse-animation');
        ui.emergencyButton.classList.add('btn-danger-active');
        ui.checkContactButton.style.display = 'block';
        ui.emergencyStatus.textContent = "Acompanhamento ativo. Compartilhe o link manualmente se necessário."; // Mensagem ajustada
        ui.emergencyStatus.classList.remove('d-none');

        // 5. Inicia o listener para respostas de verificação do contato
        const checkRequestRef = ref(db, `${sessionPath}/checkRequest`);
        if (checkRequestListener) off(checkRequestRef, 'value', checkRequestListener);
        checkRequestListener = onValue(checkRequestRef, handleCheckRequestUpdate);

        // 6. Inicia o monitoramento contínuo da localização (watchPosition)
        lastFirebaseUpdateTimestamp = Date.now(); // Inicia o timer do throttle
        locationWatchId = navigator.geolocation.watchPosition(
            handleLocationUpdate,
            handleLocationError,
            {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 0
            }
        );

        // 7. Inicia o ciclo de verificação de segurança da usuária ("Você está bem?")
        modoAlertaAtivo = false; // Reseta o estado de pânico
        startUserSafetyCheckCycle();

    } catch (error) {
        console.error("Erro ao ativar alerta de emergência:", error);
        showMessage("Não foi possível obter sua localização inicial: " + error.message, true);
        ui.emergencyButton.innerHTML = '<i class="fas fa-map-marker-alt me-2"></i> INICIAR ACOMPANHAMENTO';
        currentEmergencySessionId = null;
    } finally {
        ui.emergencyButton.disabled = false; // Reabilita o botão
    }
}

/** Cancela o monitoramento de localização e atualiza o status da sessão no Firebase. */
async function handleCancelEmergencyAlert() {
    if (!locationWatchId) return;

    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;

    stopUserSafetyCheckCycle();
    modoAlertaAtivo = false;

    detachCheckRequestListener();

    showMessage("Acompanhamento de trajeto encerrado.");
    ui.emergencyStatus.textContent = "Acompanhamento encerrado.";

    if (currentUserId && currentEmergencySessionId) {
        const sessionPath = `emergencySessions/${currentEmergencySessionId}`;
        try {
            await update(ref(db, sessionPath), { // Atualiza o nó da sessão específica
                status: "cancelled",
                endTime: new Date().toISOString()
            });
        } catch (error) {
            console.error("Erro ao atualizar status da sessão para cancelado:", error);
        }
        currentEmergencySessionId = null;
    }

    ui.emergencyButton.innerHTML = '<i class="fas fa-map-marker-alt me-2"></i> INICIAR ACOMPANHAMENTO';
    ui.emergencyButton.classList.remove('btn-danger-active');
    ui.emergencyButton.classList.add('btn-danger', 'emergency-button-pulse-animation');
    ui.checkContactButton.style.display = 'none';
}

// --- Lógica de Verificação de Contato (Iniciada pela Usuária) ---

/** Envia uma solicitação de verificação para o contato que está acompanhando. */
async function handleCheckContact() {
    if (!currentEmergencySessionId) {
        showMessage("Inicie o acompanhamento para poder verificar o contato.", true);
        return;
    }
    const checkRequestRef = ref(db, `emergencySessions/${currentEmergencySessionId}/checkRequest`);
    try {
        await set(checkRequestRef, {
            timestamp: new Date().toISOString(),
            status: 'pending'
        });
        showMessage("Verificação enviada ao seu contato. Aguardando resposta...");
    } catch (error) {
        console.error("Erro ao enviar solicitação de verificação:", error);
        showMessage("Erro ao enviar verificação para o contato.", true);
    }
}

/** Processa a resposta do contato (ok/danger) recebida do Firebase. */
function handleCheckRequestUpdate(snapshot) {
    const checkData = snapshot.val();

    if (checkData && checkData.status !== 'pending') {
        const { status } = checkData;

        ui.safetyCheckResponseModalIcon.classList.remove('fa-check-circle', 'fa-exclamation-triangle', 'text-success', 'text-danger');
        ui.safetyCheckResponseModalHeader.classList.remove('bg-danger', 'text-white');

        if (status === 'ok') {
            ui.safetyCheckResponseModalIcon.classList.add('fa-check-circle', 'text-success');
            ui.safetyCheckResponseModalText.textContent = "Seu contato confirmou que está tudo bem.";
        } else if (status === 'danger') {
            ui.safetyCheckResponseModalIcon.classList.add('fa-exclamation-triangle', 'text-danger');
            ui.safetyCheckResponseModalText.textContent = "ALERTA: Seu contato sinalizou que você pode estar em perigo. Considere ligar para a emergência (190) ou acionar o botão de pânico.";
            ui.safetyCheckResponseModalHeader.classList.add('bg-danger', 'text-white');
        }

        if (safetyCheckResponseModalInstance) safetyCheckResponseModalInstance.show();

        if (currentEmergencySessionId) {
            set(ref(db, `emergencySessions/${currentEmergencySessionId}/checkRequest`), null)
                .catch(error => console.error("Erro ao limpar checkRequest:", error));
        }
    }
}

/** Remove o listener do Firebase para checkRequest. */
function detachCheckRequestListener() {
    if (checkRequestListener && currentEmergencySessionId) {
        const checkRequestRef = ref(db, `emergencySessions/${currentEmergencySessionId}/checkRequest`);
        try {
            off(checkRequestRef, 'value', checkRequestListener);
        } catch (error) {
            console.error("Erro ao remover listener de checkRequest:", error);
        }
        checkRequestListener = null;
    }
}


// --- Lógica de Verificação de Segurança da Usuária ("Você está bem?") ---

/** Inicia o ciclo que exibe periodicamente o modal "Você está bem?". */
function startUserSafetyCheckCycle() {
    if (modoAlertaAtivo) {
        console.log("Ciclo de verificação não iniciado: modo de alerta ativo.");
        return;
    }
    stopUserSafetyCheckCycle();
    showUserSafetyCheckModal();

    const totalCycleTime = USER_CHECK_VISIBILITY_DURATION_MS + USER_CHECK_INTERVAL_MS;
    userSafetyCheckIntervalId = setInterval(showUserSafetyCheckModal, totalCycleTime);
}

/** Interrompe o ciclo de exibição do modal "Você está bem?". */
function stopUserSafetyCheckCycle() {
    if (userSafetyCheckIntervalId) {
        clearInterval(userSafetyCheckIntervalId);
        userSafetyCheckIntervalId = null;
    }
    if (userSafetyCheckVisibilityTimeoutId) {
        clearTimeout(userSafetyCheckVisibilityTimeoutId);
        userSafetyCheckVisibilityTimeoutId = null;
    }
    if (userSafetyCheckModalInstance) {
        try { userSafetyCheckModalInstance.hide(); } catch (e) { /* Ignora erro */ }
    }
}

/** Exibe o modal "Você está bem?" e agenda seu desaparecimento automático. */
function showUserSafetyCheckModal() {
    const isAnyModalOpen = document.body.classList.contains('modal-open');
    if (locationWatchId && !isAnyModalOpen && !modoAlertaAtivo) {
        userSafetyCheckModalInstance.show();

        if (userSafetyCheckVisibilityTimeoutId) clearTimeout(userSafetyCheckVisibilityTimeoutId);

        userSafetyCheckVisibilityTimeoutId = setTimeout(() => {
            const modalElement = document.getElementById('userSafetyCheckModal');
            if (modalElement && modalElement.classList.contains('show')) {
                userSafetyCheckModalInstance.hide();
            }
        }, USER_CHECK_VISIBILITY_DURATION_MS);
    } else if (modoAlertaAtivo) {
        console.log("Modal 'Você está bem?' não exibido: modo de alerta ativo.");
    }
}

/** Chamada quando a usuária clica em "Sim" no modal "Você está bem?". */
async function handleUserSafetyCheckYes() {
    if (userSafetyCheckVisibilityTimeoutId) clearTimeout(userSafetyCheckVisibilityTimeoutId);
    userSafetyCheckModalInstance.hide();

    if (currentEmergencySessionId) {
        try {
            await update(ref(db, `emergencySessions/${currentEmergencySessionId}`), {
                userSafetyConfirmation: new Date().toISOString()
            });
            console.log("Confirmação de segurança ('Sim') enviada.");
        } catch (error) {
            console.error("Erro ao enviar confirmação de segurança ('Sim'):", error);
        }
    }
}

/** * Chamada quando a usuária clica em "Não" no modal "Você está bem?".
 * Ativa o modo de Pânico DISCRETO.
 */
async function handleUserSafetyCheckNo() {
    console.log("Botão 'Não' clicado. Ativando modo de pânico DISCRETO.");

    modoAlertaAtivo = true;
    handleSilentPanic();
    stopUserSafetyCheckCycle();

    if (currentEmergencySessionId) {
         console.log("Status da sessão atualizado para panic_triggered_by_user (modo silencioso). A tela permanece normal.");
    } else {
         console.error("Erro: Sessão de emergência não encontrada. Alerta silencioso não pôde ser enviado.");
    }
}

/** Chamado quando a usuária clica em "Está tudo bem agora (Cancelar Alerta)" no modal de ação de emergência. */
async function handleCancelPanicMode() {
    console.log("Cancelando modo de pânico.");
    modoAlertaAtivo = false;

    if (emergencyActionModalInstance) emergencyActionModalInstance.hide();

    if (currentEmergencySessionId) {
        try {
            await update(ref(db, `emergencySessions/${currentEmergencySessionId}`), {
                status: 'active',
                silentMode: false,
                lastEventTimestamp: new Date().toISOString()
            });
            showMessage("✅ Alerta cancelado. O acompanhamento continua ativo.", false);
            console.log("Status da sessão revertido para 'active'.");
            startUserSafetyCheckCycle();
        } catch (error) {
            showMessage("Erro ao cancelar o alerta no servidor. O acompanhamento pode continuar inconsistente.", true);
            console.error("Erro ao reverter status para 'active':", error);
        }
    } else {
        console.warn("Tentativa de cancelar pânico sem uma sessão ativa.");
    }
}


// --- Lógica de Compartilhamento do Link ---

/** Copia o link de acompanhamento para a área de transferência. */
function handleCopyLink() {
    if (!ui.trackingLinkInput) return;
    ui.trackingLinkInput.select();
    try {
        // Usa document.execCommand para compatibilidade, especialmente em iframes
        document.execCommand('copy');
        ui.copyStatus.textContent = "Link copiado!";
        setTimeout(() => { ui.copyStatus.textContent = ""; }, 3000);
    } catch (err) {
        console.error('Falha ao copiar link:', err);
        showMessage('Não foi possível copiar o link automaticamente.', true);
    }
}

/** Tenta compartilhar o link usando a API Web Share ou abre o WhatsApp como fallback. */
async function handleShare() {
    // Verifica se há um link válido no input para compartilhar
    let link = ui.trackingLinkInput ? ui.trackingLinkInput.value : null; // Use 'let'
    if (!link && currentEmergencySessionId) {
        // Se o input estiver vazio mas houver uma sessão, gera o link novamente
        link = `${window.location.origin}${window.location.pathname.replace('index.html', '')}tracker.html?session=${currentEmergencySessionId}`;
        // Atualiza o input para consistência, se ele existir
        if (ui.trackingLinkInput) ui.trackingLinkInput.value = link;
    } else if (!link) {
         showMessage("Inicie o acompanhamento para gerar um link para compartilhar.", true);
         return; // Não há o que compartilhar
    }

    const shareData = {
        title: 'Acompanhe meu Trajeto - Krav Maga Woman',
        text: `ALERTA KMW: Estou iniciando meu acompanhamento de trajeto. Acompanhe minha localização em tempo real: ${link}`, // Mensagem padrão para compartilhamento
        url: link // A URL é redundante se já estiver no text, mas é bom ter
    };

    if (navigator.share) { // Verifica se a API Web Share está disponível
        try {
            await navigator.share(shareData);
            console.log('Link compartilhado com sucesso via Web Share API.');
            showMessage('Compartilhamento iniciado. Selecione seus contatos.');
        } catch (err) {
            // Ignora erro se o usuário cancelar o compartilhamento (AbortError)
            if (err.name !== 'AbortError') {
                console.error('Erro ao usar Web Share API:', err);
                 // Fallback para WhatsApp se Web Share falhar por outro motivo
                 openWhatsAppShare(shareData.text); // Passa apenas o texto formatado
            } else {
                 console.log('Compartilhamento cancelado pelo usuário.');
            }
        }
    } else {
        // Fallback para WhatsApp se Web Share não for suportado
        console.log('Web Share API não suportada. Usando fallback para WhatsApp.');
        openWhatsAppShare(shareData.text); // Passa apenas o texto formatado
    }
}

/** Abre o WhatsApp com uma mensagem pré-formatada contendo o link. */
function openWhatsAppShare(text) { // Recebe apenas o texto já formatado
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    // Tenta abrir em nova aba/janela. Pode ser bloqueado por pop-up blocker.
    const newWindow = window.open(whatsappUrl, '_blank');
    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
         // Se falhou, informa o usuário para tentar copiar/colar manualmente
         showMessage('Não foi possível abrir o WhatsApp automaticamente. Copie o link e cole no app.', true);
    } else {
         showMessage('Abrindo WhatsApp para compartilhamento...');
    }
}

// ===================================================================================
// --- FUNCIONALIDADE: ENVIO VIA CALLMEBOT (MELHOR ESFORÇO - TELEGRAM) ---
// ===================================================================================

/**
 * @function sendCallMeBotTelegram
 * @description Tenta enviar uma mensagem via Telegram usando a API CallMeBot.
 * Requer que o destinatário (@username) tenha autorizado o bot @CallMeBot_txtbot.
 * @param {string} username - O username do Telegram do destinatário (sem o '@').
 * @param {string} message - A mensagem a ser enviada.
 * @returns {Promise<boolean>} - True se a API respondeu (não garante entrega), false se houve erro na requisição.
 */
async function sendCallMeBotTelegram(username, message) {
    const encodedMessage = encodeURIComponent(message);
    // Remove o '@' inicial do username para a URL da API
    const targetUser = username.startsWith('@') ? username.substring(1) : username;
    const apiUrl = `https://api.callmebot.com/text.php?user=${targetUser}&text=${encodedMessage}`;

    console.log(`Tentando enviar via CallMeBot Telegram para @${targetUser}...`);
    try {
        const response = await fetch(apiUrl); // GET request
        const responseText = await response.text(); // A API retorna texto simples

        // Verifica se a resposta indica sucesso (ou pelo menos que a API foi chamada)
        // A API CallMeBot geralmente retorna algo como "Message sent to @username" ou um erro.
        // Consideramos sucesso se a requisição foi feita, mesmo sem garantia de entrega ou autorização.
        if (response.ok && responseText.toLowerCase().includes("sent to")) {
            console.log(`SUCESSO (API CallMeBot Telegram): Resposta para @${targetUser}: ${responseText}`);
            return true;
        } else {
            console.error(`FALHA (API CallMeBot Telegram): Resposta inesperada para @${targetUser}: ${responseText} (Status: ${response.status})`);
            return false;
        }
    } catch (error) {
        console.error(`ERRO (REDE CallMeBot Telegram): Falha na requisição para @${targetUser}:`, error);
        return false;
    }
}

/**
 * @function sendCallMeBotWhatsapp
 * @description Tenta enviar uma mensagem via WhatsApp usando a API CallMeBot.
 * @param {string} phoneNumber - O número de telefone do destinatário no formato internacional (ex: +55119...).
 * @param {string} apiKey - A API Key do destinatário, obtida por ele no CallMeBot.
 * @param {string} message - A mensagem a ser enviada.
 * @returns {Promise<boolean>} - True se a API respondeu (não garante entrega), false se houve erro.
 */
async function sendCallMeBotWhatsapp(phoneNumber, apiKey, message) {
    const encodedMessage = encodeURIComponent(message);
    // Remove caracteres não numéricos do telefone para a URL
    const targetPhone = phoneNumber.replace(/\D/g, '');
    const apiUrl = `https://api.callmebot.com/whatsapp.php?phone=${targetPhone}&text=${encodedMessage}&apikey=${apiKey}`;

    console.log(`Tentando enviar via CallMeBot WhatsApp para ${targetPhone}...`);
    try {
        const response = await fetch(apiUrl);
        const responseText = await response.text();

        if (response.ok && !responseText.toLowerCase().includes("error")) {
            console.log(`SUCESSO (API CallMeBot WhatsApp): Resposta para ${targetPhone}: ${responseText}`);
            return true;
        } else {
            console.error(`FALHA (API CallMeBot WhatsApp): Resposta inesperada para ${targetPhone}: ${responseText} (Status: ${response.status})`);
            return false;
        }
    } catch (error) {
        console.error(`ERRO (REDE CallMeBot WhatsApp): Falha na requisição para ${targetPhone}:`, error);
        return false;
    }
}


/**
 * @function notifyContactsViaCallMeBot
 * @description Busca contatos de confiança e tenta notificar via Telegram e/ou WhatsApp.
 * @param {string} trackingLink - O link de acompanhamento gerado.
 */
async function notifyContactsViaCallMeBot(trackingLink) {
    if (!currentUserId) {
        console.error("ID do usuário não definido. Não é possível buscar contatos para CallMeBot.");
        return;
    }

    console.log("Iniciando processo de notificação via CallMeBot (Telegram e WhatsApp)...");
    const contactsRef = ref(db, `users/${currentUserId}/emergencyContacts`);

    try {
        const snapshot = await get(contactsRef);

        if (snapshot.exists()) {
            const notificationPromises = [];
            const msg = `ALERTA KMW: Estou iniciando meu acompanhamento. Localização: ${trackingLink}`;
            let validContactsFound = 0;

            snapshot.forEach(child => {
                const contact = child.val();
                console.log(`Processando contato para CallMeBot: ${contact.name} - ${contact.detail}`);

                // Verifica se o 'detail' é um username do Telegram válido
                if (contact && contact.detail && isValidTelegramUsername(contact.detail)) {
                    console.log(`Username válido do Telegram encontrado: ${contact.detail}`);
                    validContactsFound++;
                    notificationPromises.push(sendCallMeBotTelegram(contact.detail, msg));
                }
                // --- INÍCIO DA MODIFICAÇÃO: Bloco WhatsApp ativado ---
                else if (contact && contact.detail && isValidPhone(contact.detail.replace(/\D/g, ''))) {
                    const cleanedPhone = contact.detail.replace(/\D/g, ''); // Remove máscara e caracteres

                    // Verifica se o número é o seu, para o qual você tem a API Key
                    if (cleanedPhone === '51984672843') {
                        const YOUR_PHONE_NUMBER_WITH_COUNTRY_CODE = '555184672843';
                        const YOUR_API_KEY = '9113901'; // Sua API Key aqui

                        console.log(`Número de WhatsApp correspondente encontrado: ${cleanedPhone}. Enviando notificação.`);
                        validContactsFound++;
                        notificationPromises.push(sendCallMeBotWhatsapp(YOUR_PHONE_NUMBER_WITH_COUNTRY_CODE, YOUR_API_KEY, msg));
                    } else {
                        console.warn(`Contato ${contact.name} (${contact.detail}) é um telefone, mas não corresponde ao número configurado com API Key. Pulando WhatsApp.`);
                    }
                }
                // --- FIM DA MODIFICAÇÃO ---
                else {
                    console.log(`Contato ${contact.name} (${contact.detail}) ignorado (não é Telegram @usuario nem o telefone configurado).`);
                }
            });

            if (validContactsFound === 0) {
                console.log("Nenhum contato válido encontrado para notificação via CallMeBot.");
                showMessage("Nenhum contato no formato @usuario (Telegram) ou o seu nº de WhatsApp foi encontrado para notificação automática.", true);
                return;
            }

            console.log(`Aguardando envio de ${notificationPromises.length} notificações via CallMeBot...`);
            const results = await Promise.all(notificationPromises);
            const successCount = results.filter(success => success === true).length;

            if (successCount > 0) {
                showMessage(`✅ Tentativa de notificação enviada para ${successCount} contato(s) (Telegram/WhatsApp).`);
            } else {
                //showMessage(`⚠️ Falha ao tentar notificar contatos. Verifique o console ou as autorizações do bot.`, true);
            }

        } else {
            console.log("Nenhum contato de confiança cadastrado para notificar via CallMeBot.");
            showMessage("Nenhum contato cadastrado. Adicione contatos na tela inicial antes.", true);
        }
    } catch (error) {
        console.error("Erro ao buscar contatos no Firebase para CallMeBot:", error);
        showMessage("Erro ao buscar contatos para notificar. Verifique sua conexão.", true);
    }
}
// ===================================================================================
// --- FIM DA FUNCIONALIDADE CALLMEBOT ---
// ===================================================================================


// --- Lógica de Contatos de Confiança (Gerenciamento Local) ---

/** Adiciona um novo contato de confiança no Firebase. */
async function handleAddEmergencyContact() {
    if (!currentUserId) { showMessage("Faça login para adicionar contatos.", true); return; }

    const name = ui.contactNameInput.value.trim();
    const rawDetail = ui.contactDetailInput.value.trim();
    const cleanedDetail = rawDetail.replace(/\D/g, ''); // Para validação de telefone

    ui.contactDetailInput.classList.remove('is-invalid'); // Limpa erro anterior

    if (!name || !rawDetail) {
        showMessage("Preencha o nome e o detalhe (Telefone ou @usuario Telegram) do contato.", true);
        return;
    }

    // Valida se é Telefone OU Telegram OU Email (Email não será usado para CallMeBot)
    if (!isValidPhone(cleanedDetail) && !isValidTelegramUsername(rawDetail) && !isValidEmail(rawDetail)) {
        ui.contactDetailInput.classList.add('is-invalid');
        showMessage("Formato inválido. Use um Telefone BR (10/11 dígitos), um @usuario Telegram ou um email.", true);
        return;
    }

    // Salva o 'rawDetail' que pode conter máscara, @, ou ser email
    const detailToSave = rawDetail;

    showLoader();
    try {
        await push(ref(db, `users/${currentUserId}/emergencyContacts`), { name, detail: detailToSave });
        showMessage("Contato adicionado com sucesso!");
        ui.contactNameInput.value = '';
        ui.contactDetailInput.value = ''; // Limpa o campo após salvar
        ui.contactDetailInput.classList.remove('is-invalid');
    } catch (error) {
        console.error("Erro ao adicionar contato:", error);
        showMessage("Erro ao adicionar contato: " + error.message, true);
    } finally {
        hideLoader();
    }
}

/** Remove um contato de confiança do Firebase. */
async function handleRemoveEmergencyContact(e) {
    // Impede que o evento se propague, caso o botão esteja dentro de outro elemento clicável
    e.stopPropagation();

    const contactId = e.currentTarget.dataset.id;
    if (!currentUserId || !contactId) {
         console.error("Não foi possível remover contato: ID do usuário ou contato ausente.");
         return;
    }

    // ADICIONADO: Confirmação visual antes de remover (substitui confirm())
    const contactElement = e.currentTarget.closest('.d-flex'); // Encontra o elemento pai
    const contactName = contactElement?.querySelector('.text-break')?.textContent?.split('(')[0]?.trim() || 'este contato';

    // REMOVIDO: Prompt que pode falhar em iframes
    // if (prompt(`Tem certeza que deseja remover "${contactName}"? Digite 'sim' para confirmar.`)?.toLowerCase() !== 'sim') {
    //     console.log("Remoção cancelada pelo usuário.");
    //     return;
    // }
    console.warn(`Removendo contato ${contactName} (${contactId}) - Confirmação pulada.`); // Adiciona log

    showLoader();
    try {
        await remove(ref(db, `users/${currentUserId}/emergencyContacts/${contactId}`));
        showMessage("Contato removido.");
        // A UI será atualizada automaticamente pelo listener onValue
    } catch (error) {
        console.error("Erro ao remover contato:", error);
        showMessage("Erro ao remover contato: " + error.message, true);
    } finally {
        hideLoader();
    }
}

/** * @function loadEmergencyContacts
 * Carrega e exibe a lista de contatos de confiança, atualizando em tempo real.
 * (MODIFICADO PELO PATCH SEÇÃO 3)
 */
async function loadEmergencyContacts(userId) {
    if(userId) currentUserId = userId;
    if (!currentUserId || !ui.contactsListDiv) {
         console.warn("Não foi possível carregar contatos: ID do usuário ou div da lista não encontrados.");
         return;
    }

    const contactsRef = ref(db, `users/${currentUserId}/emergencyContacts`);

    // --- PATCH: SEÇÃO 3 ---
    // Garante que o listener antigo seja removido antes de adicionar um novo.
    if (contactsListener) {
        try {
             off(contactsRef, 'value', contactsListener);
             console.log("Removendo listener de contatos antigo.");
        } catch(e) {
             console.error("Erro ao tentar remover listener de contatos antigo:", e);
        }
        contactsListener = null; // Garante que a variável seja limpa
    }
    // ----------------------------

    console.log("Adicionando listener para contatos...");
    // MODIFICADO: Armazena o listener na variável
    contactsListener = onValue(contactsRef, (snapshot) => {
        // Verifica novamente se o elemento ainda existe
        if (!ui.contactsListDiv) {
             console.warn("Div da lista de contatos não encontrada no momento da atualização.");
             // Tenta remover o listener se a div sumiu
             if (contactsListener) {
                  try {
                       off(contactsRef, 'value', contactsListener);
                       console.log("Div sumiu, removendo listener de contatos.");
                  } catch(e) {
                      console.error("Erro ao remover listener após div sumir:", e);
                  }
                  contactsListener = null;
             }
             return;
        }

        ui.contactsListDiv.innerHTML = '';
        let contactsFound = false;

        if (snapshot.exists()) {
            contactsFound = true;
            snapshot.forEach(childSnapshot => {
                const contact = { id: childSnapshot.key, ...childSnapshot.val() };

                // Validação defensiva: garante que o contato tem id e detail
                if (!contact.id || !contact.detail) {
                     console.warn("Contato inválido encontrado no Firebase (sem id ou detail):", childSnapshot.val());
                     return; // Pula este contato
                }

                const div = document.createElement('div');
                div.className = 'd-flex justify-content-between align-items-center p-2 rounded mb-1 small';
                // Sanitização básica (evitar XSS simples se nome/detail viesse de fontes não confiáveis)
                const safeName = contact.name ? contact.name.replace(/</g, "&lt;").replace(/>/g, "&gt;") : 'Nome Ausente';
                const safeDetail = contact.detail ? contact.detail.replace(/</g, "&lt;").replace(/>/g, "&gt;") : 'Detalhe Ausente';

                div.innerHTML = `
                    <span class="text-break me-2">${safeName} (${safeDetail})</span>
                    <button data-id="${contact.id}" class="btn btn-sm btn-link text-danger remove-contact-btn p-0 ms-auto flex-shrink-0" aria-label="Remover contato ${safeName}">
                        <i class="fas fa-trash"></i>
                    </button>`;
                ui.contactsListDiv.appendChild(div);

                // Adiciona listener DEPOIS de adicionar ao DOM
                const removeButton = div.querySelector('.remove-contact-btn');
                if (removeButton) {
                     removeButton.addEventListener('click', handleRemoveEmergencyContact);
                } else {
                     console.error("Botão de remover não encontrado para o contato:", contact.id);
                }
            });
        }

        if (!contactsFound) {
            ui.contactsListDiv.innerHTML = '<p class="text-muted-light small fst-italic">Nenhum contato de confiança adicionado.</p>';
        }
    }, (error) => {
        console.error("Erro ao carregar/ouvir contatos de emergência:", error);
        if (ui.contactsListDiv) {
            ui.contactsListDiv.innerHTML = '<p class="text-danger small">Erro ao carregar contatos. Verifique o console.</p>';
        }
        showMessage("Não foi possível carregar seus contatos de confiança.", true);
        // Tenta remover o listener em caso de erro persistente
        if (contactsListener) {
             try {
                 off(contactsRef, 'value', contactsListener);
                 console.log("Erro ao carregar, removendo listener de contatos.");
             } catch(e) {
                 console.error("Erro ao remover listener após falha no carregamento:", e);
             }
             contactsListener = null;
        }
    });
}