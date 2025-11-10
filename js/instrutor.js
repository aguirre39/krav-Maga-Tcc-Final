// ===================================================================================
// MÓDULO DO INSTRUTOR VIRTUAL (instrutor.js)
// Gerencia a interação com a API Gemini (Mestre K) e a notificação proativa.
// ===================================================================================

// Dependências (serão injetadas via setupInstrutor)
let GEMINI_API_KEY, instructorChatModalInstance, showMessage;

// Estado do chat do instrutor
let instructorChatHistory = [];
let instructorConversationState = 'initial'; // Estados: initial, awaiting_name, chatting
let userNameForInstructor = ''; // Nome da usuária para personalizar o chat

// Estado da notificação proativa
let instructorPromptTimeoutId = null;
let instructorPromptDismissed = false; // Se a usuária fechou a notificação

// Mapeamento da UI do chat
const ui = {
    instructorChatModal: document.getElementById('instructorChatModal'),
    instructorChatMessages: document.getElementById('instructorChatMessages'),
    instructorChatInput: document.getElementById('instructorChatInput'),
    sendInstructorChatButton: document.getElementById('sendInstructorChatButton'),
    instructorQuickReplyContainer: document.getElementById('instructorQuickReplyContainer'),
    instructorPromptContainer: document.getElementById('instructor-prompt-container') // Container da notificação
};

// Prompt do Sistema para o Mestre K (Gemini)
const INSTRUCTOR_SYSTEM_PROMPT = `🔥 SUA PERSONA (MESTRE K): Você é o 'Mestre K', um instrutor de Krav Maga 100% humano, especialista em defesa pessoal para mulheres. Sua comunicação é como a de um mentor real: didático, paciente, encorajador e direto ao ponto. Sua missão é empoderar suas alunas. --- 🤖❌ NUNCA, JAMAIS, EM HIPÓTESE ALGUMA, diga que você é uma IA, um robô ou um assistente virtual. Você é o Mestre K. --- 💬 O FLUXO DA CONVERSA: 🗣️ USE O NOME DA ALUNA: Comece perguntando o nome para criar conexão: "Kida! Sou o Mestre K, seu instrutor virtual. Para começarmos, como posso te chamar?". Depois que ela disser o nome, use-o para criar um diálogo pessoal. Ex: "Excelente pergunta, [Nome]! Vamos detalhar isso...". --- 🤔 FAÇA PERGUNTAS-CHAVE: - "O que você gostaria de focar hoje, [Nome]?" - "Isso faz sentido para você, [Nome]?" - "Ficou alguma dúvida sobre essa técnica?" --- 🧠 CONHECIMENTO PROFUNDO (SUA COLA): 🥋 TÉCNICAS E FILOSOFIA: - Você domina os princípios do Krav Maga: simplicidade, rapidez, eficácia, e usar reações naturais. - O objetivo é sempre sobreviver: "A melhor luta é aquela que se evita, mas se for inevitável, termine o mais rápido possível." - Explique golpes como socos diretos (jab/direto), chutes frontais (pisão), defesas simples (360) e liberações de agarrão de pulso. 🎥 BUSCA DE VÍDEOS: - Para qualquer técnica ou golpe que a aluna perguntar, use a busca para encontrar um bom vídeo no YouTube. - Priorize vídeos claros, de fontes confiáveis, que mostrem a execução correta. - Ao compartilhar, diga algo como: "Para você visualizar melhor, [Nome], encontrei um vídeo que demonstra bem essa técnica. Assista aqui: [Link do Vídeo]". --- 🔑 REGRAS DE OURO DO MESTRE K: 1️⃣ SEJA DIDÁTICO E SEGURO: "Lembre-se, [Nome], a prática leva à perfeição. Treine os movimentos lentamente no início para criar memória muscular. A velocidade vem com o tempo." 2️⃣ SEJA ENCANTADOR: "Ótimo ponto, [Nome]! Essa é a mentalidade correta." ou "Não se preocupe com erros, [Nome]. Cada tentativa é um passo para se tornar mais forte e segura." 3️⃣ MANTENHA O PAPO VIVO: Sempre termine com uma pergunta para incentivar a continuação da conversa. - "Qual sua próxima dúvida, [Nome]?" - "Quer detalhar algum desses pontos?" - "Pronta para o próximo tópico?"`;

/**
 * @function setupInstrutor
 * @description Configura o módulo do instrutor virtual.
 * @param {object} dependencies - Dependências (GEMINI_API_KEY, etc.).
 * @returns {object} - Funções expostas.
 */
export function setupInstrutor(dependencies) {
    if (dependencies) {
        GEMINI_API_KEY = dependencies.GEMINI_API_KEY;
        instructorChatModalInstance = dependencies.instructorChatModalInstance;
        showMessage = dependencies.showMessage; // Recebe a função showMessage
    } else {
        console.error("Módulo Instrutor: Dependências não fornecidas!");
        return {};
    }

     // Listeners do Modal do Chat
     if (ui.instructorChatModal) {
          ui.instructorChatModal.addEventListener('shown.bs.modal', handleInstructorModalShown);
          ui.instructorChatModal.addEventListener('hidden.bs.modal', handleInstructorModalHidden); // Para ciclo proativo
     }
    if (ui.sendInstructorChatButton) ui.sendInstructorChatButton.addEventListener('click', handleSendInstructorMessage);
    if (ui.instructorChatInput) ui.instructorChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Envia com Enter, permite nova linha com Shift+Enter
             e.preventDefault();
             handleSendInstructorMessage();
        }
    });

    return {
        startInstructorPromptCycle,
        stopInstructorPromptCycle
    };
}


// --- Funções de UI do Chat ---

/** Exibe uma mensagem na interface do chat. */
function displayChatMessage(message, sender, container, isLoading = false) {
    if (!container) {
         console.error("Tentativa de exibir mensagem em container inválido.");
         return;
    }
    const messageWrapper = document.createElement('div');
    // Adiciona classes para alinhar a mensagem (direita para user, esquerda para bot)
    messageWrapper.className = `d-flex mb-2 ${sender === 'user' ? 'justify-content-end' : 'justify-content-start'}`;

    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);

    if (isLoading) {
        messageElement.classList.add('loading');
        // Animação simples de "digitando"
        messageElement.innerHTML = '<div class="dot-flashing"></div>';
    } else {
        // Formata markdown básico (negrito, itálico, links) para HTML
        message = message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Negrito
            .replace(/\*(.*?)\*/g, '<em>$1</em>')       // Itálico
             // Links: Converte [texto](url) para <a href="url">texto</a>
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
             .replace(/\n/g, '<br>'); // Converte novas linhas para <br>
        messageElement.innerHTML = message;
    }

    messageWrapper.appendChild(messageElement);
    container.appendChild(messageWrapper);

    // Rola para a mensagem mais recente
    container.scrollTop = container.scrollHeight;

     return messageElement; // Retorna o elemento criado (útil para remover o loading)
}

/** Renderiza botões de resposta rápida. */
function renderQuickReplies(state) {
    const container = ui.instructorQuickReplyContainer;
    if (!container) return;

    container.innerHTML = ''; // Limpa respostas anteriores
    if (state === 'chatting') {
        const replies = ["Fale sobre a guarda", "Qual a origem do Krav Maga?", "Diferença entre soco e tapa"];
        replies.forEach(text => {
            const button = document.createElement('button');
            button.className = 'btn btn-sm quick-reply-btn'; // Usa a classe CSS definida
            button.textContent = text;
            button.onclick = () => {
                ui.instructorChatInput.value = text; // Preenche o input
                handleSendInstructorMessage();      // Envia a mensagem
            };
            container.appendChild(button);
        });
    }
    // Pode adicionar outras lógicas para diferentes 'states' se necessário
}


// --- Lógica de Interação com API Gemini ---

/**
 * Envia a requisição para a API Gemini com tratamento de erro e retentativas.
 * @param {object} payload - O corpo da requisição para a API.
 * @returns {Promise<string>} - O texto da resposta da API.
 * @throws {Error} - Se a API falhar após múltiplas tentativas.
 */
async function callGeminiAPI(payload) {
    // Modelo recomendado para chat multimodal rápido
    const model = 'gemini-2.5-flash-preview-09-2025';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    let response;
    let attempt = 0;
    const maxAttempts = 5; // Número máximo de retentativas
    let delay = 1000; // Delay inicial de 1 segundo

    while (attempt < maxAttempts) {
        try {
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                // Verifica se a resposta contém o texto esperado
                if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
                    return result.candidates[0].content.parts[0].text; // Sucesso
                }
                // Verifica se a resposta foi bloqueada por segurança/conteúdo
                else if (result.promptFeedback?.blockReason) {
                    console.warn(`API Gemini bloqueou a resposta: ${result.promptFeedback.blockReason}`);
                    return `Não foi possível gerar uma resposta (${result.promptFeedback.blockReason}). Por favor, reformule sua pergunta.`;
                }
                // Resposta OK, mas estrutura inesperada
                else {
                    console.warn("API Gemini respondeu OK, mas sem conteúdo esperado:", result);
                    // Lança erro para tentar novamente (pode ser um problema temporário)
                    throw new Error("Resposta inesperada da API.");
                }
            } else if (response.status === 429 || response.status >= 500) {
                // Erro de Rate Limit (429) ou erro de servidor (5xx) -> Tentar novamente com backoff
                console.warn(`API Gemini: Tentativa ${attempt + 1} falhou com status ${response.status}. Tentando novamente em ${delay}ms...`);
                // Não lança erro, apenas espera e continua o loop
            } else {
                // Outro erro do cliente (4xx, ex: 400 Bad Request) -> Não tentar novamente
                const errorDetails = await response.text();
                console.error(`Erro ${response.status} na API Gemini: ${errorDetails}`);
                throw new Error(`Erro na API (${response.status}). Verifique o payload ou a chave.`);
            }
        } catch (error) {
            // Erro de rede ou erro lançado internamente (resposta inesperada)
            console.warn(`API Gemini: Tentativa ${attempt + 1} falhou com erro. Tentando novamente em ${delay}ms...`, error);
            // Não lança erro, apenas espera e continua o loop
        }

        // Espera antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Backoff exponencial (dobra o delay)
        attempt++;
    }

    // Se todas as tentativas falharem
    console.error(`Não foi possível conectar à API Gemini após ${maxAttempts} tentativas.`);
    throw new Error(`Falha ao conectar ao Instrutor Virtual após ${maxAttempts} tentativas. Verifique sua conexão ou tente mais tarde.`);
}

// --- Lógica do Chat do Instrutor ---

/** Chamado quando o modal do instrutor é totalmente exibido. */
function handleInstructorModalShown() {
    hideInstructorPrompt(); // Esconde a notificação proativa, se estiver visível

    // Se for a primeira vez abrindo (estado 'initial'), inicia a conversa
    if (instructorConversationState === 'initial' && ui.instructorChatMessages) {
        ui.instructorChatMessages.innerHTML = ''; // Limpa mensagens anteriores
        instructorChatHistory = []; // Reseta histórico
        instructorConversationState = 'awaiting_name'; // Muda o estado

        // Exibe a mensagem de boas-vindas após um pequeno delay
        setTimeout(() => {
            const welcomeMsg = "Kida! Sou o Mestre K, seu instrutor virtual de Krav Maga. Para começarmos, como posso te chamar?";
            displayChatMessage(welcomeMsg, 'bot', ui.instructorChatMessages);
            // Adiciona a mensagem do bot ao histórico para contexto
            instructorChatHistory.push({ role: "model", parts: [{ text: welcomeMsg }] });
            ui.instructorChatInput?.focus(); // Foca no input para a usuária responder
        }, 500); // Delay para dar tempo da animação do modal terminar
    } else {
        // Se já estava conversando, apenas foca no input
         ui.instructorChatInput?.focus();
    }
}

/** Chamado quando o modal do instrutor é totalmente oculto. */
function handleInstructorModalHidden() {
     // Pode reiniciar o ciclo da notificação proativa se desejar
     // startInstructorPromptCycle(); // Descomente se quiser que o balão reapareça depois
}


/** Envia a mensagem do usuário para a API e exibe a resposta. */
async function handleSendInstructorMessage() {
    const userMessage = ui.instructorChatInput.value.trim();
    // Não envia se vazio ou se já estiver enviando
    if (userMessage === "" || ui.sendInstructorChatButton.disabled) return;

    // Exibe a mensagem do usuário na UI
    displayChatMessage(userMessage, 'user', ui.instructorChatMessages);
    ui.instructorChatInput.value = ""; // Limpa o input
    ui.sendInstructorChatButton.disabled = true; // Desabilita botão enquanto processa
    if (ui.instructorQuickReplyContainer) ui.instructorQuickReplyContainer.innerHTML = ''; // Limpa respostas rápidas

    let botResponse = "";
    let loadingElement; // Para remover a animação "digitando"

    try {
        // Se esperando o nome, trata a resposta de forma especial
        if (instructorConversationState === 'awaiting_name') {
            userNameForInstructor = userMessage; // Guarda o nome
            // Adiciona a resposta do usuário (contextualizada) ao histórico
            instructorChatHistory.push({ role: "user", parts: [{ text: `Meu nome/apelido é ${userNameForInstructor}` }] });
            instructorConversationState = 'chatting'; // Muda para o estado normal de chat

            // Exibe "digitando..."
            loadingElement = displayChatMessage('', 'bot', ui.instructorChatMessages, true);

            // Simula uma resposta rápida do bot
            await new Promise(resolve => setTimeout(resolve, 1200)); // Pequeno delay

            botResponse = `Kida*, ${userNameForInstructor}! É uma honra ter você aqui. O caminho da sua segurança começa agora. Pode perguntar o que quiser sobre Krav Maga.`;
             // *Kida é uma saudação em hebraico

        } else {
            // --- Estado normal de chat ('chatting') ---
            instructorChatHistory.push({ role: "user", parts: [{ text: userMessage }] }); // Adiciona msg do user

            // Exibe "digitando..."
             loadingElement = displayChatMessage('', 'bot', ui.instructorChatMessages, true);


            // Adiciona o nome ao prompt do sistema dinamicamente
            const personalizedPrompt = INSTRUCTOR_SYSTEM_PROMPT.replace(/\[Nome\]/g, userNameForInstructor || 'aluna');

            // Monta o payload para a API
            const payload = {
                contents: instructorChatHistory,
                systemInstruction: { parts: [{ text: personalizedPrompt }] },
                 // Habilita a busca no Google se a API precisar de informações externas
                tools: [{ "google_search": {} }],
            };

            // Chama a API Gemini
            botResponse = await callGeminiAPI(payload);
        }

        // Processamento da resposta (comum a ambos os casos)
        if (loadingElement) loadingElement.closest('.d-flex').remove(); // Remove o elemento "digitando"
        displayChatMessage(botResponse, 'bot', ui.instructorChatMessages); // Exibe a resposta final
        instructorChatHistory.push({ role: "model", parts: [{ text: botResponse }] }); // Adiciona resposta do bot ao histórico
        renderQuickReplies('chatting'); // Mostra sugestões de perguntas

    } catch (error) {
        console.error("Erro ao interagir com o Instrutor Virtual:", error);
        if (loadingElement) loadingElement.closest('.d-flex').remove(); // Remove "digitando" em caso de erro
        const errorMsg = "Desculpe, tive um problema para processar sua pergunta. Poderia tentar novamente ou verificar sua conexão?";
        displayChatMessage(errorMsg, 'bot', ui.instructorChatMessages);
        // Não adiciona a mensagem de erro ao histórico para não confundir a IA na próxima vez
    } finally {
        ui.sendInstructorChatButton.disabled = false; // Reabilita o botão
        ui.instructorChatInput.focus(); // Foca no input novamente
    }
}

// --- Lógica da Notificação Proativa ---

/** Esconde a notificação pop-up. */
function hideInstructorPrompt() {
    const promptContainer = ui.instructorPromptContainer;
    if (promptContainer) {
        const popup = promptContainer.querySelector('.notification-popup');
        if (popup && popup.classList.contains('show')) {
            popup.classList.remove('show');
            // Remove o elemento do DOM após a animação de fade-out
            setTimeout(() => { if (promptContainer) promptContainer.innerHTML = ''; }, 500); // Tempo da animação CSS
        } else {
             // Garante que esteja limpo mesmo se não houver popup visível
             promptContainer.innerHTML = '';
        }
    }
    // Cancela qualquer timeout agendado para mostrar o prompt
    if (instructorPromptTimeoutId) clearTimeout(instructorPromptTimeoutId);
}

/** Mostra a notificação pop-up se aplicável. */
function showInstructorPrompt() {
    const promptContainer = ui.instructorPromptContainer;
    const isAnyModalOpen = document.body.classList.contains('modal-open');

    // Não mostra se: já foi dispensada, container não existe, ou algum modal já está aberto
    if (instructorPromptDismissed || !promptContainer || isAnyModalOpen) return;

    // Cria o HTML do pop-up
    const popup = document.createElement('div');
    popup.className = 'notification-popup position-relative'; // 'show' é adicionado depois
    popup.innerHTML = `
        <button type="button" class="btn-close position-absolute top-0 end-0 m-2" aria-label="Fechar notificação"></button>
        <div class="d-flex align-items-center" role="button" tabindex="0" aria-label="Abrir chat com Mestre K">
            <i class="fas fa-user-ninja fs-3 text-primary me-3" aria-hidden="true"></i>
            <div>
                <p class="fw-bold mb-0">Kida! Alguma dúvida sobre Krav Maga?</p>
                <p class="small mb-0 text-muted-light">Sou o Mestre K. Clique aqui para falar comigo! 💪</p>
            </div>
        </div>`;
    promptContainer.innerHTML = ''; // Limpa container antes de adicionar
    promptContainer.appendChild(popup);

    // Listener para fechar o pop-up
    popup.querySelector('.btn-close').addEventListener('click', (e) => {
        e.stopPropagation(); // Impede que o clique no 'X' também abra o modal
        instructorPromptDismissed = true; // Marca como dispensado nesta sessão
        hideInstructorPrompt();
    });

    // Listener para abrir o modal de chat ao clicar no pop-up
    popup.querySelector('[role="button"]').addEventListener('click', () => {
        if (instructorChatModalInstance) instructorChatModalInstance.show();
        // hideInstructorPrompt(); // O modal shown event já faz isso
    });

    // Adiciona a classe 'show' para iniciar a animação de fade-in/slide-up
    setTimeout(() => popup.classList.add('show'), 100); // Pequeno delay para garantir a transição CSS
}

/** Para o ciclo de exibição da notificação proativa. */
function stopInstructorPromptCycle() {
    if (instructorPromptTimeoutId) clearTimeout(instructorPromptTimeoutId);
    instructorPromptTimeoutId = null;
    hideInstructorPrompt(); // Garante que a notificação seja escondida
}

/** Inicia ou reinicia o ciclo para mostrar a notificação proativa após um delay. */
function startInstructorPromptCycle() {
    stopInstructorPromptCycle(); // Cancela ciclo anterior, se houver
    instructorPromptDismissed = false; // Reseta o estado de dispensado
    // Agenda para mostrar o prompt após 12 segundos
    instructorPromptTimeoutId = setTimeout(showInstructorPrompt, 12000);
}
