// ===================================================================================
// MÓDULO DE CHAT DA COMUNIDADE (chatComunidade.js)
// Gerencia a exibição e o envio de mensagens no chat global.
// ===================================================================================

// CORREÇÃO: Adicionada a importação de 'getDatabase' para resolver o ReferenceError.
import { getDatabase, ref, push, onValue, query, orderByChild, limitToLast, off, get } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

let db, showMessage;
let currentUserId;
let communityChatMessagesListener = null;

// Elementos da UI
const ui = {
    communityChatMessagesArea: document.getElementById('communityChatMessagesArea'),
    communityChatInput: document.getElementById('communityChatInput'),
    sendCommunityChatMessageButton: document.getElementById('sendCommunityChatMessageButton')
};

// Função de inicialização do módulo
export function setupChatComunidade(dependencies) {
    if (dependencies) {
        db = dependencies.db;
        showMessage = dependencies.showMessage;
    }

    ui.sendCommunityChatMessageButton.addEventListener('click', handleSendCommunityChatMessage);
    ui.communityChatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSendCommunityChatMessage(); });
    
    return {
        loadCommunityChatMessages,
        detachCommunityChatListener
    };
}

function getFormattedTimestamp(isoTimestamp) {
    if (!isoTimestamp) return '';
    try {
        return new Date(isoTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
}

function displayCommunityChatMessage(messageData, messageId) {
    if (!ui.communityChatMessagesArea || !messageData) return;
    const isSentMessage = messageData.userId === currentUserId;
    const messageItem = document.createElement('div');
    messageItem.className = `community-chat-message-item ${isSentMessage ? 'sent' : 'received'}`;
    messageItem.dataset.messageId = messageId;
    
    const senderName = isSentMessage ? "Você" : (messageData.displayName || 'Anônima');
    const timestamp = getFormattedTimestamp(messageData.timestamp);
    
    messageItem.innerHTML = `
        <div class="message-meta">
            <span class="sender-name">${senderName}</span>
            <span class="message-timestamp">${timestamp}</span>
        </div>
        <div class="message-text-content">${messageData.text}</div>`;
        
    const placeholder = ui.communityChatMessagesArea.querySelector('p');
    if (placeholder) placeholder.remove();
    
    ui.communityChatMessagesArea.appendChild(messageItem);
    ui.communityChatMessagesArea.scrollTop = ui.communityChatMessagesArea.scrollHeight;
}

async function handleSendCommunityChatMessage() {
    if (!currentUserId) { showMessage("Você precisa estar logado para enviar mensagens.", true); return; }
    const messageText = ui.communityChatInput.value.trim();
    if (messageText === "") return;

    let displayName = 'Anônima';
    try {
        const nameSnapshot = await get(ref(db, `users/${currentUserId}/profile/displayName`));
        if (nameSnapshot.exists() && nameSnapshot.val().trim() !== "") {
            displayName = nameSnapshot.val().trim();
        }
    } catch(e) { console.warn("Não foi possível buscar o nome de exibição para o chat."); }
    
    // CORREÇÃO: Utiliza a instância 'db' que já foi passada, em vez de chamar getDatabase() novamente.
    const communityChatMessagesRef = ref(db, 'globalChat/messages');

    const messageData = {
        userId: currentUserId,
        displayName: displayName,
        text: messageText,
        timestamp: new Date().toISOString()
    };

    try {
        await push(communityChatMessagesRef, messageData);
        ui.communityChatInput.value = "";
    } catch (error) {
        showMessage("Erro ao enviar mensagem.", true);
    }
}

function loadCommunityChatMessages(userId) {
    if(userId) currentUserId = userId;
    if (!currentUserId || communityChatMessagesListener) return;
    
    if (ui.communityChatMessagesArea) ui.communityChatMessagesArea.innerHTML = '<p class="text-muted-light small p-2 text-center">Carregando...</p>';
    
    const communityChatMessagesRef = ref(db, 'globalChat/messages');
    const queryRef = query(communityChatMessagesRef, orderByChild('timestamp'), limitToLast(50));
    
    communityChatMessagesListener = onValue(queryRef, (snapshot) => {
        if (!ui.communityChatMessagesArea) return;
        ui.communityChatMessagesArea.innerHTML = '';
        if (snapshot.exists()) {
            snapshot.forEach((child) => displayCommunityChatMessage(child.val(), child.key));
        } else {
            ui.communityChatMessagesArea.innerHTML = '<p class="text-muted-light small p-2 text-center">Nenhuma mensagem ainda.</p>';
        }
    }, (error) => {
        console.error("Erro ao carregar chat:", error);
        if (ui.communityChatMessagesArea) ui.communityChatMessagesArea.innerHTML = '<p class="text-danger small p-2">Erro ao carregar.</p>';
    });
}

function detachCommunityChatListener() {
    if (communityChatMessagesListener) {
        const communityChatMessagesRef = ref(db, 'globalChat/messages');
        off(communityChatMessagesRef, 'value', communityChatMessagesListener);
        communityChatMessagesListener = null;
    }
}