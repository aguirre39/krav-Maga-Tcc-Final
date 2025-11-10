// ===================================================================================
// MÓDULO DE SUPORTE (suporte.js)
// Gerencia a funcionalidade da página de Assistência e Suporte.
// ===================================================================================

let showLoader, hideLoader, showMessage;

// Inicialização do módulo
export function setupSuporte(dependencies) {
    if (dependencies) {
        showLoader = dependencies.showLoader;
        hideLoader = dependencies.hideLoader;
        showMessage = dependencies.showMessage;
    }

    const findSupportButton = document.getElementById('findSupportNearMeButton');
    if (findSupportButton) {
        findSupportButton.addEventListener('click', handleFindSupportNearMe);
    }
}

// Abre o Google Maps para encontrar delegacias e centros de referência próximos
function handleFindSupportNearMe() {
    showLoader();
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            const deamQuery = `https://www.google.com/maps/search/?api=1&query=delegacia+da+mulher+perto+de+${latitude},${longitude}`;
            const cramQuery = `https://www.google.com/maps/search/?api=1&query=centro+de+referencia+da+mulher+perto+de+${latitude},${longitude}`;
            
            // Abre os mapas em novas abas
            window.open(deamQuery, '_blank');
            window.open(cramQuery, '_blank');
            
            hideLoader();
            showMessage("Abrindo mapas para encontrar ajuda próxima. Verifique se seu navegador permitiu os pop-ups.");
        }, () => {
            hideLoader();
            showMessage("Não foi possível obter sua localização. Por favor, habilite o serviço de localização no seu navegador.", true);
        });
    } else {
        hideLoader();
        showMessage("Geolocalização não é suportada pelo seu navegador.", true);
    }
}
