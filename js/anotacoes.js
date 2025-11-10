// ===================================================================================
// MÓDULO DE ANOTAÇÕES (anotacoes.js)
// Gerencia o salvamento, carregamento e edição de anotações das técnicas.
// ===================================================================================

// CORREÇÃO: Importa todas as funções necessárias do Firebase Database.
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";
import { TECHNIQUE_DETAILS } from './main.js';

let db, showMessage, showLoader, hideLoader;
let currentUserId;

// Função principal que configura o módulo e retorna os métodos públicos
export function setupAnotacoes(dependencies) {
    if (dependencies) {
        db = dependencies.db;
        showMessage = dependencies.showMessage;
        showLoader = dependencies.showLoader;
        hideLoader = dependencies.hideLoader;
    }
    
    // Adiciona listeners aos botões de salvar nas páginas de técnicas
    document.querySelectorAll('.save-note-button').forEach(button => button.addEventListener('click', handleSaveNoteForTechniquePage));

    // Retorna a interface pública do módulo
    return {
        loadUserNotes,
        loadAndDisplayAllNotes
    };
}

// Carrega as anotações do usuário e preenche as textareas nas páginas de técnicas
async function loadUserNotes(userId) {
    if (!userId) return;
    currentUserId = userId; // Atualiza o ID do usuário para uso interno no módulo
    try {
        const notesSnapshot = await get(child(ref(db), `users/${currentUserId}/notes`));
        if (notesSnapshot.exists()) {
            const notes = notesSnapshot.val();
            document.querySelectorAll('.notes-area').forEach(area => {
                const techniqueId = area.dataset.techniqueId;
                if (notes[techniqueId]) {
                    area.value = typeof notes[techniqueId] === 'string' ? notes[techniqueId] : (notes[techniqueId].text || '');
                }
            });
        }
    } catch (error) { console.error("Erro ao carregar anotações:", error); }
}

// Salva a anotação a partir de um botão na página de técnica
async function handleSaveNoteForTechniquePage(e) {
    if (!currentUserId) { showMessage("Você precisa estar logada para salvar anotações.", true); return; }
    const techniqueId = e.target.closest('button').dataset.techniqueId;
    const noteText = document.querySelector(`textarea[data-technique-id="${techniqueId}"]`).value;
    showLoader();
    try {
        await set(ref(db, `users/${currentUserId}/notes/${techniqueId}`), {
            text: noteText,
            updatedAt: new Date().toISOString()
        });
        showMessage("Anotação salva com sucesso!");
    } catch (error) {
        showMessage("Erro ao salvar anotação: " + error.message, true);
    } finally {
        hideLoader();
    }
}

// Carrega todas as anotações e as exibe na página "Ver Anotações"
async function loadAndDisplayAllNotes(userId) {
    if (userId) currentUserId = userId;
    if (!currentUserId) return;
    showLoader();
    try {
        const notesSnapshot = await get(child(ref(db), `users/${currentUserId}/notes`));
        const whiteBeltNotesContainer = document.getElementById('whiteBeltNotesContainer');
        const yellowBeltNotesContainer = document.getElementById('yellowBeltNotesContainer');
        let whiteBeltHtml = '';
        let yellowBeltHtml = '';

        if (notesSnapshot.exists()) {
            const notes = notesSnapshot.val();
            for (const techniqueId in notes) {
                const noteData = notes[techniqueId];
                const noteText = typeof noteData === 'string' ? noteData : (noteData.text || '');
                if (noteText.trim() === '') continue; // Pula notas vazias

                const updatedAt = typeof noteData === 'object' && noteData.updatedAt ? new Date(noteData.updatedAt).toLocaleString('pt-BR') : '';
                const techniqueInfo = TECHNIQUE_DETAILS[techniqueId] || { name: `Técnica (${techniqueId})` };
                
                const noteCardHtml = `
                    <div class="note-card p-3 rounded shadow-sm mb-3" data-technique-id="${techniqueId}">
                        <h3>${techniqueInfo.name}</h3> <p class="timestamp">${updatedAt}</p>
                        <div class="note-content"><p class="note-text-display small">${noteText.replace(/\n/g, '<br>')}</p></div>
                        <div class="edit-buttons mt-2">
                            <button class="btn btn-sm btn-secondary edit-note-btn"><i class="fas fa-edit me-1"></i>Editar</button>
                            <button class="btn btn-sm btn-primary save-note-view-btn d-none"><i class="fas fa-save me-1"></i>Salvar</button>
                            <button class="btn btn-sm btn-outline-secondary cancel-edit-btn d-none ms-1"><i class="fas fa-times me-1"></i>Cancelar</button>
                        </div>
                    </div>`;
                
                if (techniqueId.startsWith('white_')) { whiteBeltHtml += noteCardHtml; } 
                else if (techniqueId.startsWith('yellow_')) { yellowBeltHtml += noteCardHtml; }
            }
        }
        
        whiteBeltNotesContainer.innerHTML = whiteBeltHtml || '<p class="text-muted-light">Nenhuma anotação para a Faixa Branca ainda.</p>';
        yellowBeltNotesContainer.innerHTML = yellowBeltHtml || '<p class="text-muted-light">Nenhuma anotação para a Faixa Amarela ainda.</p>';
        
        addEventListenersToNoteCards();
    } catch (error) {
        console.error("Erro ao carregar todas as anotações:", error);
    } finally {
        hideLoader();
    }
}

// Funções de ajuda para a edição na página "Ver Anotações"
function addEventListenersToNoteCards() {
    document.querySelectorAll('.edit-note-btn').forEach(b => b.addEventListener('click', handleEditNoteOnViewPage));
    document.querySelectorAll('.save-note-view-btn').forEach(b => b.addEventListener('click', handleSaveNoteOnViewPage));
    document.querySelectorAll('.cancel-edit-btn').forEach(b => b.addEventListener('click', () => loadAndDisplayAllNotes(currentUserId)));
}

function handleEditNoteOnViewPage(e) {
    const noteCard = e.target.closest('.note-card');
    const noteContentDiv = noteCard.querySelector('.note-content');
    const textDisplayP = noteCard.querySelector('.note-text-display');
    const currentText = textDisplayP.innerHTML.replace(/<br\s*\/?>/gi, '\n');
    
    noteContentDiv.innerHTML = `<textarea class="notes-area-view form-control form-control-sm w-100" rows="4">${currentText}</textarea>`;
    noteCard.querySelector('textarea').focus();
    
    noteCard.querySelector('.edit-note-btn').classList.add('d-none');
    noteCard.querySelector('.save-note-view-btn').classList.remove('d-none');
    noteCard.querySelector('.cancel-edit-btn').classList.remove('d-none');
}

async function handleSaveNoteOnViewPage(e) {
    const noteCard = e.target.closest('.note-card');
    const techniqueId = noteCard.dataset.techniqueId;
    const newText = noteCard.querySelector('textarea').value;
    showLoader();
    try {
        await set(ref(db, `users/${currentUserId}/notes/${techniqueId}`), { text: newText, updatedAt: new Date().toISOString() });
        showMessage("Anotação atualizada!");
        await loadAndDisplayAllNotes(currentUserId);
    } catch (error) {
        showMessage("Erro ao salvar: " + error.message, true);
    } finally {
        hideLoader();
    }
}