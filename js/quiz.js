// ===================================================================================
// MÓDULO DO QUIZ (quiz.js) - VERSÃO APRIMORADA COM VALIDAÇÃO
// Gerencia a lógica do quiz interativo, com 20 perguntas e feedback inteligente.
// ===================================================================================

// BANCO DE DADOS DO QUIZ
const quizData = {
    title: "Avaliação de Segurança Pessoal",
    questions: [
        // Consciência Situacional
        {
            text: "Você está andando na rua à noite e percebe que alguém está te seguindo. Qual a melhor atitude inicial?",
            options: ["Acelerar o passo e ir para casa o mais rápido possível", "Parar, virar e confrontar a pessoa", "Atravessar a rua e entrar em um local público movimentado (loja, restaurante)", "Ligar para um amigo e conversar alto no telefone"],
            correctAnswer: "Atravessar a rua e entrar em um local público movimentado (loja, restaurante)"
        },
        {
            text: "Ao usar fones de ouvido em público, qual a prática mais segura?",
            options: ["Usar com volume máximo para bloquear distrações", "Usar apenas um fone ou manter o volume baixo", "Usar ambos os fones, mas sem música, apenas para inibir abordagens", "É sempre perigoso, nunca se deve usar fones em público"],
            correctAnswer: "Usar apenas um fone ou manter o volume baixo"
        },
        {
            text: "O que significa o 'visual de vítima' que deve ser evitado?",
            options: ["Usar roupas escuras e capuz", "Andar de cabeça baixa, distraída com o celular e aparentando insegurança", "Fazer contato visual direto com todos que passam", "Andar muito rápido e de forma apressada"],
            correctAnswer: "Andar de cabeça baixa, distraída com o celular e aparentando insegurança"
        },
        // Segurança Residencial
        {
            text: "Um entregador de um aplicativo que você não pediu toca seu interfone. O que você faz?",
            options: ["Desce para verificar, pois pode ser um presente ou engano", "Permite a entrada no prédio para ele deixar na sua porta", "Informa que não pediu nada e não permite a entrada, se necessário contatando a portaria", "Ignora o chamado completamente"],
            correctAnswer: "Informa que não pediu nada e não permite a entrada, se necessário contatando a portaria"
        },
        {
            text: "Qual é a melhor prática em redes sociais em relação às suas férias?",
            options: ["Postar fotos em tempo real para que amigos acompanhem", "Fazer check-in no aeroporto para mostrar que está viajando", "Postar as fotos e detalhes da viagem apenas quando já tiver retornado", "Anunciar a data da sua viagem com antecedência para receber dicas"],
            correctAnswer: "Postar as fotos e detalhes da viagem apenas quando já tiver retornado"
        },
        {
            text: "Ao chegar em casa à noite de carro, qual o procedimento recomendado?",
            options: ["Buzinar para que abram o portão rapidamente", "Desligar o carro e procurar as chaves com calma", "Observar o movimento na rua antes de parar e já ter as chaves/controle em mãos", "Parar o carro e ligar para alguém de dentro para abrir o portão"],
            correctAnswer: "Observar o movimento na rua antes de parar e já ter as chaves/controle em mãos"
        },
        // Proteção em Movimento
        {
            text: "Ao entrar em um carro de aplicativo, qual é a primeira e mais importante verificação?",
            options: ["Se o motorista é simpático", "Se o ar-condicionado está ligado", "Conferir se a placa e o modelo do carro batem com o do aplicativo", "Verificar se o carro está limpo"],
            correctAnswer: "Conferir se a placa e o modelo do carro batem com o do aplicativo"
        },
        {
            text: "No trânsito, por que é importante manter uma distância segura do carro da frente?",
            options: ["Para evitar multas de trânsito", "Para não forçar o freio do seu carro", "Apenas para evitar colisões traseiras", "Para ter uma rota de fuga e espaço para manobrar em caso de abordagem"],
            correctAnswer: "Para ter uma rota de fuga e espaço para manobrar em caso de abordagem"
        },
        {
            text: "Dentro de um ônibus ou metrô, qual é o local mais seguro para sua bolsa ou mochila?",
            options: ["No bagageiro acima do assento", "No seu colo ou à sua frente, sempre em contato com seu corpo", "Pendurada no ombro, virada para o corredor", "No assento ao lado, para ter mais conforto"],
            correctAnswer: "No seu colo ou à sua frente, sempre em contato com seu corpo"
        },
        // Segurança Digital
        {
            text: "Você recebe um e-mail do seu banco com um link para 'atualização cadastral urgente'. O que fazer?",
            options: ["Clicar no link e preencher os dados para não ter a conta bloqueada", "Responder o e-mail pedindo mais informações", "Ignorar o e-mail, acessar o site do banco digitando o endereço no navegador e verificar por lá", "Ligar para o gerente pelo telefone fornecido no próprio e-mail"],
            correctAnswer: "Ignorar o e-mail, acessar o site do banco digitando o endereço no navegador e verificar por lá"
        },
        {
            text: "Ao marcar um primeiro encontro com alguém que conheceu online, qual é a regra de ouro?",
            options: ["Encontrar em um local mais reservado para poderem conversar", "Sempre em local público e movimentado, e avisar um contato de confiança", "Permitir que a pessoa te busque em casa para ser mais cômodo", "Não contar a ninguém para não gerar preocupação desnecessária"],
            correctAnswer: "Sempre em local público e movimentado, e avisar um contato de confiança"
        },
        {
            text: "O que é 'Autenticação de Dois Fatores' (2FA)?",
            options: ["Ter duas senhas para a mesma conta", "Uma camada extra de segurança que exige um código (do celular, por ex.) além da senha", "Um sistema que verifica sua identidade por duas perguntas secretas", "Um antivírus que protege contra hackers"],
            correctAnswer: "Uma camada extra de segurança que exige um código (do celular, por ex.) além da senha"
        },
        // Resposta a Emergências
        {
            text: "Em uma situação de assalto com o agressor armado, qual deve ser sua postura?",
            options: ["Tentar desarmar o agressor usando uma técnica de defesa pessoal", "Gritar por socorro o mais alto que puder", "Não reagir, manter a calma, entregar os bens e memorizar características do agressor", "Tentar negociar para entregar apenas uma parte dos seus pertences"],
            correctAnswer: "Não reagir, manter a calma, entregar os bens e memorizar características do agressor"
        },
        {
            text: "O que é um 'código de emergência discreto'?",
            options: ["Um aplicativo de pânico no celular", "Um apito de segurança que você carrega consigo", "Uma palavra ou frase combinada com familiares para sinalizar perigo discretamente", "O número de telefone da polícia"],
            correctAnswer: "Uma palavra ou frase combinada com familiares para sinalizar perigo discretamente"
        },
        {
            text: "Se você se perder em uma área desconhecida, qual a ação mais segura?",
            options: ["Continuar andando até encontrar um ponto de referência", "Pedir ajuda para a primeira pessoa que passar na rua", "Entrar em um estabelecimento comercial (padaria, farmácia) para se localizar e, se necessário, pedir ajuda", "Sentar na calçada e esperar que alguém ofereça ajuda"],
            correctAnswer: "Entrar em um estabelecimento comercial (padaria, farmácia) para se localizar e, se necessário, pedir ajuda"
        },
        // Prevenção Contra Assédio
        {
            text: "Se alguém faz um comentário inadequado que te deixa desconfortável em público, o que você pode fazer?",
            options: ["Ignorar para não causar uma cena", "Responder com agressividade na mesma medida", "De forma firme e clara, dizer 'Não gostei desse comentário' ou 'Por favor, não fale assim comigo'", "Fingir que não ouviu e sair andando"],
            correctAnswer: "De forma firme e clara, dizer 'Não gostei desse comentário' ou 'Por favor, não fale assim comigo'"
        },
        {
            text: "Em uma situação de assédio em uma festa, a quem você deve recorrer primeiro?",
            options: ["Tentar encontrar o agressor para tirar satisfação", "Ir embora da festa imediatamente sem falar com ninguém", "Procurar seus amigos, seguranças do local ou a organização do evento", "Postar sobre o ocorrido nas redes sociais"],
            correctAnswer: "Procurar seus amigos, seguranças do local ou a organização do evento"
        },
        // Conhecimentos Gerais
        {
            text: "Qual item é considerado um 'multiplicador de força' em defesa pessoal?",
            options: ["Seu celular", "Um anel grande", "Uma chave ou caneta usada de forma estratégica", "Sua bolsa"],
            correctAnswer: "Uma chave ou caneta usada de forma estratégica"
        },
        {
            text: "A intuição é frequentemente descrita como um sistema de alerta. O que isso significa?",
            options: ["É apenas um sentimento de medo sem base na realidade", "É o seu subconsciente processando sinais de perigo que você não notou conscientemente", "É uma habilidade sobrenatural que poucas pessoas têm", "É o mesmo que ansiedade e deve ser ignorado"],
            correctAnswer: "É o seu subconsciente processando sinais de perigo que você não notou conscientemente"
        },
        {
            text: "O objetivo principal da defesa pessoal é:",
            options: ["Vencer o agressor em uma luta", "Proteger seus bens materiais a todo custo", "Criar uma oportunidade para escapar para um local seguro", "Imobilizar o agressor e esperar a polícia chegar"],
            correctAnswer: "Criar uma oportunidade para escapar para um local seguro"
        }
    ]
};

// Elementos da UI
const ui = {
    quizWrapper: document.getElementById('quiz-container-wrapper'),
    quizStartScreen: document.getElementById('quiz-start-screen'),
    startQuizButton: document.getElementById('start-quiz-button'),
    quizHeader: document.getElementById('quiz-header'),
    quizQuestionCounter: document.getElementById('quiz-question-counter'),
    quizProgressBar: document.getElementById('quiz-progress-bar'),
    quizForm: document.getElementById('quiz-form'),
    quizResult: document.getElementById('quiz-result'),
    quizResultIcon: document.getElementById('quiz-result-icon'),
    quizResultTitle: document.getElementById('quiz-result-title'),
    quizScoreDisplay: document.getElementById('quiz-score'),
    quizFeedbackMessage: document.getElementById('quiz-feedback-message'),
    retakeQuizButton: document.getElementById('retake-quiz-button')
};

let validationAlert; // Variável para o alerta de validação

// Inicialização do módulo
export function setupQuiz() {
    if (!ui.quizWrapper) return;

    ui.startQuizButton.addEventListener('click', startQuiz);
    ui.retakeQuizButton.addEventListener('click', startQuiz);
}

// Inicia ou reinicia o quiz
function startQuiz() {
    ui.quizResult.style.display = 'none';
    ui.quizResult.classList.remove('visible', 'result-excellent', 'result-good', 'result-average', 'result-poor');
    ui.quizStartScreen.style.display = 'none';
    ui.quizHeader.style.display = 'block';
    
    loadQuiz();
    ui.quizForm.style.display = 'block';
    ui.quizForm.classList.remove('submitted');
}

// Carrega e renderiza o formulário do quiz
function loadQuiz() {
    ui.quizForm.innerHTML = '';
    const totalQuestions = quizData.questions.length;
    
    // Adiciona o container para o alerta de validação
    ui.quizForm.innerHTML += `<div id="quiz-validation-alert" class="alert alert-danger" role="alert" style="display:none;"></div>`;
    validationAlert = document.getElementById('quiz-validation-alert'); // Atribui o elemento à variável

    quizData.questions.forEach((q, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'mb-4 question-container'; // Adicionada classe para fácil seleção
        
        let optionsHTML = '';
        const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);

        shuffledOptions.forEach(opt => {
            const safeOptId = `q${index}-opt-${opt.replace(/[^a-zA-Z0-9]/g, '')}`;
            optionsHTML += `
                <div class="form-check">
                    <input class="form-check-input" type="radio" name="question-${index}" value="${opt}" id="${safeOptId}">
                    <label class="form-check-label" for="${safeOptId}">${opt}</label>
                </div>`;
        });
        
        questionDiv.innerHTML = `
            <p class="fw-semibold lead">${index + 1}. ${q.text}</p>
            <div class="options-container">${optionsHTML}</div>
            <hr class="mt-4">`;

        ui.quizForm.appendChild(questionDiv);
    });
    
    ui.quizForm.innerHTML += '<button type="submit" id="submit-quiz-button" class="btn btn-primary btn-lg">Finalizar e Ver Resultado</button>';
    ui.quizForm.addEventListener('submit', handleQuizSubmit);
}

// Processa o envio do quiz, com VALIDAÇÃO
function handleQuizSubmit(e) {
    e.preventDefault();

    let firstUnanswered = null;
    let allAnswered = true;

    // Remove destaques de erros anteriores
    validationAlert.style.display = 'none';
    document.querySelectorAll('.question-container.unanswered').forEach(el => el.classList.remove('unanswered'));
    
    // ** LÓGICA DE VALIDAÇÃO **
    quizData.questions.forEach((q, index) => {
        const selected = ui.quizForm.querySelector(`input[name="question-${index}"]:checked`);
        if (!selected) {
            allAnswered = false;
            const unansweredQuestion = document.querySelectorAll('.question-container')[index];
            unansweredQuestion.classList.add('unanswered');
            if (!firstUnanswered) {
                firstUnanswered = unansweredQuestion;
            }
        }
    });

    // Se alguma pergunta não foi respondida, mostra o alerta e para a execução
    if (!allAnswered) {
        validationAlert.textContent = 'Por favor, responda todas as perguntas. As questões pendentes foram destacadas.';
        validationAlert.style.display = 'block';
        firstUnanswered.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return; // Impede a continuação do envio
    }

    // ** LÓGICA DE PONTUAÇÃO (só executa se tudo foi respondido) **
    let score = 0;
    quizData.questions.forEach((q, index) => {
        const selected = ui.quizForm.querySelector(`input[name="question-${index}"]:checked`);
        const labels = document.querySelectorAll(`input[name="question-${index}"] + label`);

        labels.forEach(label => {
            if (label.textContent === q.correctAnswer) {
                label.classList.add('correct-answer');
            } else {
                label.classList.add('incorrect-answer');
            }
        });

        if (selected && selected.value === q.correctAnswer) {
            score++;
        }
    });
    
    ui.quizForm.classList.add('submitted');
    displayResults(score);

    const submitButton = document.getElementById('submit-quiz-button');
    if (submitButton) submitButton.style.display = 'none';
}

// Mostra o card de resultados com feedback inteligente
function displayResults(score) {
    const totalQuestions = quizData.questions.length;
    const percentage = Math.round((score / totalQuestions) * 100);
    
    let resultClass, icon, title, message;

    if (percentage >= 90) { // 18-20 acertos
        resultClass = 'result-excellent';
        icon = 'fa-solid fa-trophy';
        title = 'Excelente!';
        message = 'Seu conhecimento em segurança pessoal é impressionante. Você demonstra ter instintos afiados e preparo. Continue aplicando esses conceitos e mantenha-se sempre vigilante.';
    } else if (percentage >= 70) { // 14-17 acertos
        resultClass = 'result-good';
        icon = 'fa-solid fa-shield-halved';
        title = 'Bom Trabalho!';
        message = 'Você possui uma base sólida de conhecimentos em segurança. Revise as questões que errou para fortalecer ainda mais sua capacidade de prevenção e reação.';
    } else if (percentage >= 50) { // 10-13 acertos
        resultClass = 'result-average';
        icon = 'fa-solid fa-book-open-reader';
        title = 'Requer Atenção';
        message = 'Sua pontuação indica que há pontos importantes a serem melhorados. Recomendamos fortemente que você revise nossas dicas de segurança para aumentar sua confiança e preparo.';
    } else { // Abaixo de 10 acertos
        resultClass = 'result-poor';
        icon = 'fa-solid fa-triangle-exclamation';
        title = 'Estudo Crítico Necessário';
        message = 'Alerta! É crucial que você dedique um tempo para estudar os fundamentos da segurança pessoal. A prevenção é sua melhor defesa. Comece agora a navegar por nossas dicas para se fortalecer.';
    }

    ui.quizResult.classList.add(resultClass);
    ui.quizResultIcon.innerHTML = `<i class="${icon}"></i>`;
    ui.quizResultTitle.textContent = title;
    ui.quizScoreDisplay.textContent = `Sua pontuação: ${score} de ${totalQuestions} (${percentage}%)`;
    ui.quizFeedbackMessage.textContent = message;

    ui.quizHeader.style.display = 'none'; // Oculta o cabeçalho do quiz
    ui.quizForm.style.display = 'none'; // Oculta o formulário
    ui.quizResult.style.display = 'block';
    
    setTimeout(() => {
        ui.quizResult.classList.add('visible');
        ui.quizResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}