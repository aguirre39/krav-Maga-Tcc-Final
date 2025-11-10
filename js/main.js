// ===================================================================================
// KRAV MAGA WOMAN - SCRIPT PRINCIPAL (main.js)
// Responsável pela inicialização, autenticação, navegação e orquestração dos módulos.
// ===================================================================================

// Importações dos Módulos de Funcionalidades
// NOTA: Certifique-se que estes caminhos ('./anotacoes.js', etc.) estão corretos e que os arquivos existem.
import { setupAnotacoes } from './anotacoes.js';
import { setupChatComunidade } from './chatComunidade.js';
import { setupEmergencia } from './emergencia.js';
import { setupInstrutor } from './instrutor.js';
import { setupPerfil } from './perfil.js';
import { setupQuiz } from './quiz.js';
import { setupSuporte } from './suporte.js';

// Importações do Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// ===================================================================================
// I. INICIALIZAÇÃO E CONFIGURAÇÃO
// ===================================================================================

// Configuração do Firebase
const firebaseConfig = JSON.parse(window.__firebase_config_str || '{}'); // Garante que não quebre se a variável não existir
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Chave da API Gemini
const GEMINI_API_KEY = "AIzaSyBgTsrl7A51hVo4P8eHfMx0iFM98l1carY"; 

// Detalhes das técnicas (usado pelo módulo de anotações)
export const TECHNIQUE_DETAILS = {
    "white_001": { name: "Postura de Combate e Movimentação", belt: "Faixa Branca" },
    "white_002": { name: "Soco Direto (Jab e Direto)", belt: "Faixa Branca" },
    "white_003": { name: "Defesa Simples de Soco Direto (Bloqueio 360 Externo)", belt: "Faixa Branca" },
    "yellow_001": { name: "Liberação de Agarrão de Pulso (Mesmo Lado)", belt: "Faixa Amarela" },
    "yellow_002": { name: "Chute Frontal (Pisão - Reto)", belt: "Faixa Amarela" },
};

// Variáveis de estado global e de módulos
let currentUserId = null;
let messageModalInstance, nameInputModalInstance, emergencyLinkModalInstance, instructorChatModalInstance, safetyCheckResponseModalInstance, userSafetyCheckModalInstance, emergencyActionModalInstance;

// Variáveis para armazenar os módulos inicializados
let anotacoesModule, chatComunidadeModule, emergenciaModule, instrutorModule, perfilModule, quizModule, suporteModule;

// Mapeamento dos elementos da UI
const uiElements = {
    loader: document.getElementById('loader'),
    appHeader: document.getElementById('appHeader'),
    authPage: document.getElementById('auth-page'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    showRegisterLink: document.getElementById('showRegister'),
    showLoginLink: document.getElementById('showLogin'),
    switchToLoginP: document.getElementById('switchToLogin'),
    logoutButton: document.getElementById('logoutButton'),
    mobileMenu: document.getElementById('mobileMenu'),
    messageModal: document.getElementById('messageModal'),
    messageText: document.getElementById('messageText'),
    messageModalTitle: document.getElementById('messageModalTitle'),
    currentYearEl: document.getElementById('currentYear'),
    themeToggleButton: document.getElementById('themeToggle'),
    themeToggleButtonMobile: document.getElementById('themeToggleMobile'),
};

// ===================================================================================
// II. FUNÇÕES UTILITÁRIAS E DE UI (COMPARTILHADAS)
// ===================================================================================

export function showLoader() { if (uiElements.loader) uiElements.loader.style.display = 'block'; }
export function hideLoader() { if (uiElements.loader) uiElements.loader.style.display = 'none'; }

export function showMessage(message, isError = false) {
    if (uiElements.messageText) uiElements.messageText.textContent = message;
    if (uiElements.messageModalTitle) uiElements.messageModalTitle.textContent = isError ? "Erro" : "Notificação";
    if (messageModalInstance) messageModalInstance.show();
}

function getFriendlyAuthErrorMessage(errorCode) {
    const messages = {
        'auth/invalid-email': 'O formato do e-mail fornecido é inválido.',
        'auth/user-disabled': 'Esta conta de usuário foi desabilitada.',
        'auth/user-not-found': 'Nenhum usuário encontrado com este e-mail.',
        'auth/wrong-password': 'A senha está incorreta.',
        'auth/email-already-in-use': 'Este e-mail já está sendo utilizado por outra conta.',
        'auth/weak-password': 'A senha fornecida é muito fraca. Use pelo menos 6 caracteres.',
        'auth/missing-email': 'Por favor, insira seu e-mail.',
        'auth/missing-password': 'Por favor, insira sua senha.'
    };
    return messages[errorCode] || 'Ocorreu um erro desconhecido. Tente novamente.';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    const iconClass = theme === 'light' ? 'fa-moon' : 'fa-sun';
    if (uiElements.themeToggleButton) uiElements.themeToggleButton.innerHTML = `<i class="fas ${iconClass}"></i>`;
    if (uiElements.themeToggleButtonMobile) uiElements.themeToggleButtonMobile.innerHTML = `<i class="fas ${iconClass}"></i>`;
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(currentTheme === 'light' ? 'dark' : 'light');
}

// ===================================================================================
// III. NAVEGAÇÃO E FLUXO DA APLICAÇÃO
// ===================================================================================

function navigateToPage(pageId) {
    if (!pageId) return;
    document.querySelectorAll('.page-section').forEach(section => {
        const isActivePage = section.id === pageId;
        section.classList.toggle('active', isActivePage);
        section.style.display = isActivePage ? (section.id === 'auth-page' ? 'flex' : 'block') : 'none';
    });

    const whatsappButton = document.getElementById('whatsapp-float-button');
    if (whatsappButton) {
        whatsappButton.style.display = (pageId === 'warnings-page') ? 'flex' : 'none';
    }
    
    // Usa os módulos já inicializados
    if (pageId === 'dashboard-page' && currentUserId) {
        if (perfilModule) perfilModule.loadAndSetDisplayName(currentUserId);
        if (chatComunidadeModule) chatComunidadeModule.loadCommunityChatMessages(currentUserId);
        if (instrutorModule) instrutorModule.startInstructorPromptCycle();
    } else {
        if (chatComunidadeModule) chatComunidadeModule.detachCommunityChatListener();
        if (instrutorModule) instrutorModule.stopInstructorPromptCycle();
    }
    
    if (pageId === 'view-notes-page' && anotacoesModule) anotacoesModule.loadAndDisplayAllNotes(currentUserId);
    if (pageId === 'quiz-page' && quizModule) quizModule.loadQuiz();

    // Atualiza o menu de navegação
    document.querySelectorAll('#appHeader .nav-link').forEach(link => {
        if (link.dataset.page) {
            link.classList.toggle('active', link.dataset.page === pageId);
        }
    });

    const mobileMenuEl = uiElements.mobileMenu;
    if (mobileMenuEl && mobileMenuEl.classList.contains('show')) {
        (bootstrap.Collapse.getInstance(mobileMenuEl) || new bootstrap.Collapse(mobileMenuEl)).hide();
    }
    window.scrollTo(0, 0);
}

// ===================================================================================
// IV. MÓDULO DE AUTENTICAÇÃO
// ===================================================================================

function toggleAuthForms(e, targetForm) {
    e.preventDefault();
    uiElements.loginForm.style.display = targetForm === 'login' ? 'block' : 'none';
    uiElements.registerForm.style.display = targetForm === 'register' ? 'block' : 'none';
    uiElements.showRegisterLink.parentElement.style.display = targetForm === 'login' ? 'block' : 'none';
    uiElements.switchToLoginP.style.display = targetForm === 'register' ? 'block' : 'none';
}

async function handleLogin(e) {
    e.preventDefault();
    showLoader();
    const email = uiElements.loginForm.loginEmail.value.trim();
    const password = uiElements.loginForm.loginPassword.value.trim();

    if (!email || !password) {
        showMessage(getFriendlyAuthErrorMessage(password ? 'auth/missing-email' : 'auth/missing-password'), true);
        hideLoader();
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged cuidará da navegação
    } catch (error) {
        showMessage(getFriendlyAuthErrorMessage(error.code), true);
    } finally {
        hideLoader();
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = uiElements.registerForm.registerEmail.value.trim();
    const password = uiElements.registerForm.registerPassword.value.trim();
    const confirmPassword = uiElements.registerForm.registerConfirmPassword.value.trim();
    if (password !== confirmPassword) {
        showMessage("As senhas não coincidem.", true);
        return;
    }
    showLoader();
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        await signOut(auth); // Força o logout para que o usuário precise logar
        showMessage("Cadastro realizado com sucesso! Faça login para continuar.");
        toggleAuthForms({ preventDefault: () => {} }, 'login'); // Simula o evento
    } catch (error) {
        showMessage(getFriendlyAuthErrorMessage(error.code), true);
    } finally {
        hideLoader();
    }
}

function handleLogout() {
    signOut(auth).catch(error => showMessage(getFriendlyAuthErrorMessage(error.code), true));
}

// ===================================================================================
// VI. INICIALIZAÇÃO DA APLICAÇÃO E EVENT LISTENERS GLOBAIS
// ===================================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (uiElements.currentYearEl) uiElements.currentYearEl.textContent = new Date().getFullYear();
    
    // Instancia os modais do Bootstrap
    try {
        messageModalInstance = new bootstrap.Modal(uiElements.messageModal);
        nameInputModalInstance = new bootstrap.Modal(document.getElementById('nameInputModal'));
        emergencyLinkModalInstance = new bootstrap.Modal(document.getElementById('emergencyLinkModal'));
        instructorChatModalInstance = new bootstrap.Modal(document.getElementById('instructorChatModal'));
        safetyCheckResponseModalInstance = new bootstrap.Modal(document.getElementById('safetyCheckResponseModal'));
        userSafetyCheckModalInstance = new bootstrap.Modal(document.getElementById('userSafetyCheckModal'));
        emergencyActionModalInstance = new bootstrap.Modal(document.getElementById('emergencyActionModal')); // Adicionado
    } catch (e) {
        console.error("Erro ao inicializar modais Bootstrap:", e);
    }

    // Configura os listeners globais de UI
    document.querySelectorAll('.navigate-to').forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); navigateToPage(e.currentTarget.dataset.page); }));
    
    // Garante que os formulários existem antes de adicionar listeners
    if (uiElements.loginForm) {
        uiElements.loginForm.addEventListener('submit', handleLogin);
    }
    if (uiElements.registerForm) {
        uiElements.registerForm.addEventListener('submit', handleRegister);
    }
    if (uiElements.showRegisterLink) {
        uiElements.showRegisterLink.addEventListener('click', (e) => toggleAuthForms(e, 'register'));
    }
    if (uiElements.showLoginLink) {
        uiElements.showLoginLink.addEventListener('click', (e) => toggleAuthForms(e, 'login'));
    }
    if (uiElements.logoutButton) {
        uiElements.logoutButton.addEventListener('click', handleLogout);
    }
    if (uiElements.themeToggleButton) {
        uiElements.themeToggleButton.addEventListener('click', toggleTheme);
    }
    if (uiElements.themeToggleButtonMobile) {
        uiElements.themeToggleButtonMobile.addEventListener('click', toggleTheme);
    }

    applyTheme(localStorage.getItem('theme') || 'dark');
    
    // Inicializa todos os módulos UMA VEZ e armazena suas instâncias
    // Adicionado try/catch para garantir que a falha em um módulo não impeça outros de carregar
    try {
        const sharedDependencies = { db, auth, showMessage, showLoader, hideLoader };
        
        anotacoesModule = setupAnotacoes(sharedDependencies);
        chatComunidadeModule = setupChatComunidade(sharedDependencies);
        // Passa todas as instâncias de modal necessárias para o módulo de emergência
        emergenciaModule = setupEmergencia({ 
            ...sharedDependencies, 
            emergencyLinkModalInstance, 
            safetyCheckResponseModalInstance, 
            userSafetyCheckModalInstance,
            emergencyActionModalInstance // Passa o novo modal
        });
        instrutorModule = setupInstrutor({ GEMINI_API_KEY, instructorChatModalInstance });
        perfilModule = setupPerfil({ ...sharedDependencies, nameInputModalInstance });
        quizModule = setupQuiz();
        suporteModule = setupSuporte(sharedDependencies);
    } catch (e) {
        console.error("Erro ao inicializar módulos:", e);
        showMessage("Ocorreu um erro ao carregar partes da aplicação. Tente recarregar a página.", true);
    }
});

// Ponto de entrada principal da lógica da aplicação
onAuthStateChanged(auth, (user) => {
    showLoader();
    if (user) {
        currentUserId = user.uid;
        if (uiElements.appHeader) uiElements.appHeader.style.display = 'block';
        
        // Usa as instâncias dos módulos já criadas para chamar as funções
        if (anotacoesModule) anotacoesModule.loadUserNotes(currentUserId);
        if (emergenciaModule) emergenciaModule.loadEmergencyContacts(currentUserId);
        
        const onAuthPage = uiElements.authPage ? uiElements.authPage.classList.contains('active') : false;
        if (onAuthPage || !document.querySelector('.page-section.active')) {
            navigateToPage('dashboard-page');
        }
    } else {
        currentUserId = null;
        
        if (perfilModule) perfilModule.updateWelcomeMessageUI(null);
        if (chatComunidadeModule) chatComunidadeModule.detachCommunityChatListener();
        if (instrutorModule) instrutorModule.stopInstructorPromptCycle();
        
        if (uiElements.appHeader) uiElements.appHeader.style.display = 'none';
        navigateToPage('auth-page');
    }
    hideLoader();
});
