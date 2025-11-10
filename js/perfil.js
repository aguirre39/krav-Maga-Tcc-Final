// ===================================================================================
// MÓDULO DE PERFIL (perfil.js)
// Gerencia o nome de exibição do usuário.
// ===================================================================================

// CORREÇÃO: Garante que as funções necessárias do Firebase estão importadas.
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

let db, showMessage, showLoader, hideLoader;
let nameInputModalInstance;
let currentUserId;

// Elementos da UI
const ui = {
    displayNameSpan: document.getElementById('displayNameSpan'),
    displayNamePromptContainer: document.getElementById('displayNamePromptContainer'),
    displayNamePromptLink: document.getElementById('displayNamePromptLink'),
    nameInputField: document.getElementById('nameInputField'),
    saveNameButton: document.getElementById('saveNameButton')
};

// Inicialização do módulo
export function setupPerfil(dependencies) {
    if (dependencies) {
        db = dependencies.db;
        showMessage = dependencies.showMessage;
        showLoader = dependencies.showLoader;
        hideLoader = dependencies.hideLoader;
        nameInputModalInstance = dependencies.nameInputModalInstance;
    }

    ui.displayNamePromptLink.addEventListener('click', (e) => { e.preventDefault(); nameInputModalInstance.show(); });
    ui.saveNameButton.addEventListener('click', handleSaveDisplayName);
    ui.nameInputField.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveDisplayName(); }});

    return {
        loadAndSetDisplayName,
        updateWelcomeMessageUI
    };
}

// Atualiza a mensagem de boas-vindas na UI
function updateWelcomeMessageUI(displayName) {
    if (ui.displayNameSpan && ui.displayNamePromptContainer) {
        if (displayName && displayName.trim() !== "") {
            ui.displayNameSpan.textContent = `, ${displayName}`;
            ui.displayNamePromptContainer.style.display = 'none';
        } else {
            ui.displayNameSpan.textContent = '';
            ui.displayNamePromptContainer.style.display = 'inline';
        }
    }
}

// Carrega o nome de exibição do Firebase e atualiza a UI
async function loadAndSetDisplayName(userId) {
    if(userId) currentUserId = userId;
    if (!currentUserId) { updateWelcomeMessageUI(null); return; }
    try {
        const snapshot = await get(ref(db, `users/${currentUserId}/profile/displayName`));
        updateWelcomeMessageUI(snapshot.exists() ? snapshot.val() : null);
    } catch (error) {
        console.error("Erro ao carregar nome de exibição:", error);
        updateWelcomeMessageUI(null);
    }
}

// Salva o novo nome de exibição no Firebase
async function handleSaveDisplayName() {
    if (!currentUserId || !ui.nameInputField) return;
    const newName = ui.nameInputField.value.trim();
    if (newName === "") { showMessage("Por favor, insira um nome.", true); return; }
    showLoader();
    try {
        await set(ref(db, `users/${currentUserId}/profile/displayName`), newName);
        updateWelcomeMessageUI(newName);
        nameInputModalInstance.hide();
        showMessage("Nome salvo com sucesso!");
        ui.nameInputField.value = '';
    } catch (error) {
        showMessage("Erro ao salvar nome. Tente novamente.", true);
    } finally {
        hideLoader();
    }
}