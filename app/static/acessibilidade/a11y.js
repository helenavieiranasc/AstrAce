/* Widget de acessibilidade do AstrAce.
 * Adaptado de https://github.com/junanobi/accessibility-widget (MIT, veja LICENSE nesta pasta).
 * Mudanças: textos em português, botões de verdade com teclado e leitor de tela, sem dicionário externo,
 * e o "restaurar" só mexe nas classes do próprio widget. */
document.addEventListener("DOMContentLoaded", () => {
    const CHAVE = 'a11y-settings';

    // --- 1. ICON LIBRARY (FULL & FIXED) ---
    const ICONS = {
        close: '<path d="M16.9497 7.05023L7.05025 16.9497M7.05025 7.05023L16.9497 16.9497" />',
        trigger: '<path d="M6 11C7.73096 12.2982 9.8363 13 12 13C14.1637 13 16.269 12.2982 18 11M14 13V17M14 17H10M14 17L15 21M10 17V13M10 17L9 21M15 6C15 7.65685 13.6569 9 12 9C10.3431 9 9 7.65685 9 6C9 4.34315 10.3431 3 12 3C13.6569 3 15 4.34315 15 6Z"/>',
        
        // Multi-state Icons
        contrast: [
            '<path d="M12 2V2.00995M22 12V12.0099M2 12V12.0099M19 5V5.00995M19 19V19.0099M5 19V19.0099M5 5V5.00995M12 22V22.0099M18 12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12Z" />', 
            '<path d="M20.9504 12.9504C20.6381 12.9832 20.321 13 20 13C15.0294 13 11 8.97054 11 3.99997C11 3.67897 11.0168 3.36188 11.0496 3.04956C6.52579 3.52435 3 7.35042 3 12C3 16.9705 7.02944 21 12 21C16.6496 21 20.4756 17.4742 20.9504 12.9504Z" />', 
            '<path d="M2 12H3M5 5L6 6M12 2V3M19 5L18 6M22 12H21M19 19L18 18M12 22V21M5 19L6 18M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z" />' 
        ],
        
        textSize: [
            '<path d="M4 7.625C4 6.17525 5.17525 5 6.625 5L17.125 5C18.5747 5 19.75 6.17525 19.75 7.625M15.375 19L8.375 19M11.875 19V5"/>', 
            '<path d="M3 7C3 5.34315 4.34315 4 6 4L18 4C19.6569 4 21 5.34315 21 7M16 20H8M12 20L12 4" />', 
            '<path d="M3.75 3.75v4.5m0-4.5h16.5m-16.5 0a9 9 0 0118 0m-18 0a9 9 0 009 9m9-9v4.5m0-4.5h-16.5" />' 
        ],
        textSize_override: [
             '<path d="M4 7.625C4 6.17525 5.17525 5 6.625 5L17.125 5C18.5747 5 19.75 6.17525 19.75 7.625M15.375 19L8.375 19M11.875 19V5"/>', 
             '<path d="M3 7C3 5.34315 4.34315 4 6 4L18 4C19.6569 4 21 5.34315 21 7M16 20H8M12 20L12 4" />', 
             '<path d="M3 6C3 4.34315 4.34315 3 6 3L18 3C19.6569 3 21 4.34315 21 6M16 21H8M12 21L12 3" />'  
        ],

        lineHeight: [
            '<path d="M21 12H14M21 6L14 6M21 18H14M6 4L6 21M6 21L3 18M6 21L9 18M3 6L6 3L9 6" />', 
            '<path d="M21 3H3M21 21H3M7 17L10.8462 7.76923C11.0402 7.30342 11.4954 7 12 7C12.5046 7 12.9598 7.30342 13.1538 7.76923L17 17M9.08341 12.8333L14.9167 12.8333" />', 
            '<path d="M6 18L10.6154 6.92308C10.8483 6.36411 11.3944 6 12 6C12.6056 6 13.1517 6.36411 13.3846 6.92308L18 18M8.50009 13L15.5 13M21 2H3M21 22H3" />' 
        ],
        
        textAlign: [
            '<path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />', 
            '<path d="M11 9.5L3 9.5M21 4.5L3 4.5M11 19.5L3 19.5M21 14.5L3 14.5" />', 
            '<path d="M16 9.5L8 9.5M21 4.5L3 4.5M16 19.5L8 19.5M21 14.5L3 14.5" />', 
            '<path d="M21 9.5L13 9.5M21 4.5L3 4.5M21 19.5L13 19.5M21 14.5L3 14.5" />', 
            '<path d="M21 9.5L3 9.5M21 4.5L3 4.5M11 19.5L3 19.5M21 14.5L3 14.5" />' 
        ],

        // NEW: Saturation Icons (Normal, Low/Gray, High)
        saturation: [
            '<path d="M15.0003 17V17.01M20 14.0001C20 18.4184 16.4183 22.0001 12 22.0001C7.58172 22.0001 4 18.4184 4 14.0001C4 9.58184 11.5556 2.00012 12 2.00012C12.4444 2.00012 20 9.58184 20 14.0001Z" />',
            '<path d="M20 14.0001C20 9.58184 12.4444 2.00012 12 2.00012C11.5556 2.00012 4 9.58184 4 14.0001C4 18.4184 7.58172 22.0001 12 22.0001M16 20H21" />', // Grayscale circle
            '<path d="M12 22.0001C7.58172 22.0001 4 18.4184 4 14.0001C4 9.58184 11.5556 2.00012 12 2.00012C12.3826 2.00012 18.0342 7.61788 19.6003 12M18.5 17V19.5M18.5 19.5V22M18.5 19.5H16M18.5 19.5H21" />' // Drop (Saturate)
        ],

        // NEW: Text Spacing Icons
        textSpacing: [
            '<path d="M20 17L3 17M3 17L6 14M3 17L6 20M18 14L21 17L18 20M18 10L6 10M18 4L6 4" />',
            '<path d="M3 21L3 3M21 21V3M7 17L10.8462 7.76923C11.0402 7.30342 11.4954 7 12 7C12.5046 7 12.9598 7.30342 13.1538 7.76923L17 17M9.08341 12.8333L14.9167 12.8333" />', // Arrows logic simulated
            '<path d="M6 18L10.6154 6.92308C10.8483 6.36411 11.3944 6 12 6C12.6056 6 13.1517 6.36411 13.3846 6.92308L18 18M8.50009 13L15.5 13M2 21L2 3M22 21V3" />' 
        ],
        
        // NEW: Structure Icon
        structure: '<path d="M7.40801 9.91319L10.6749 11.3981C11.1621 11.6196 11.4057 11.7303 11.6594 11.774C11.8842 11.8128 12.1139 11.8128 12.3387 11.774C12.5923 11.7303 12.8359 11.6196 13.3232 11.3981L16.59 9.91318M7.40801 9.91319C5.37194 8.9877 4.35391 8.52496 4.03807 7.88373C3.76363 7.32654 3.76363 6.67348 4.03807 6.1163C4.35391 5.47506 5.37194 5.01232 7.408 4.08684L10.6749 2.60191C11.1621 2.38043 11.4057 2.26969 11.6594 2.22598C11.8842 2.18725 12.1139 2.18725 12.3387 2.22598C12.5923 2.26969 12.8359 2.38043 13.3232 2.60191L16.59 4.08684C18.6261 5.01232 19.6441 5.47506 19.96 6.1163C20.2344 6.67348 20.2344 7.32654 19.96 7.88373C19.6441 8.52496 18.6261 8.9877 16.59 9.91318M7.40801 9.91319C7.08066 9.76439 6.77938 9.62757 6.50335 9.50003C5.06252 10.1657 4.30292 10.5782 4.03786 11.1163C3.76342 11.6735 3.76342 12.3266 4.03786 12.8837C4.3537 13.525 5.37173 13.9877 7.4078 14.9132M16.59 9.91318C16.9174 9.76438 17.2182 9.62755 17.4942 9.50001C18.9351 10.1657 19.6947 10.5782 19.9598 11.1163C20.2342 11.6735 20.2342 12.3266 19.9598 12.8837C19.6439 13.525 18.6259 13.9877 16.5898 14.9132M7.4078 14.9132L10.6746 16.3981C11.1619 16.6196 11.4055 16.7303 11.6592 16.7741C11.8839 16.8128 12.1137 16.8128 12.3385 16.7741C12.5921 16.7303 12.8357 16.6196 13.323 16.3981L16.5898 14.9132M7.4078 14.9132C7.08045 14.7644 6.77938 14.6276 6.50335 14.5C5.06252 15.1657 4.30292 15.5782 4.03786 16.1163C3.76342 16.6735 3.76342 17.3266 4.03786 17.8837C4.3537 18.525 5.37173 18.9877 7.4078 19.9132L10.6746 21.3981C11.1619 21.6196 11.4055 21.7303 11.6592 21.7741C11.8839 21.8128 12.1137 21.8128 12.3385 21.7741C12.5921 21.7303 12.8357 21.6196 13.323 21.3981L16.5898 19.9132C18.6259 18.9877 19.6439 18.525 19.9598 17.8837C20.2342 17.3266 20.2342 16.6735 19.9598 16.1163C19.6947 15.5782 18.9351 15.1657 17.4942 14.5C17.2182 14.6276 16.9172 14.7644 16.5898 14.9132" />',

        // FIXED KEYS (Disamakan dengan data-action HTML)
        highlightLinks: '<path d="M16.9502 12.7071L19.0715 10.5858C20.6336 9.02365 20.6336 6.49099 19.0715 4.9289C17.5094 3.3668 14.9768 3.3668 13.4147 4.9289L11.2933 7.05022M12.7076 16.9497L10.5862 19.071C9.02414 20.6331 6.49148 20.6331 4.92939 19.071C3.36729 17.5089 3.36729 14.9763 4.92939 13.4142L7.05071 11.2929M9.87913 14.1213L14.1218 9.87864" />',
        dyslexia: '<path d="M21 9H20.5414C19.0749 9 17.8233 10.0602 17.5822 11.5068L16 21M16 14H20M5 4H8.90167C8.90167 4 14 4.16983 13.5 10.5C13 16.8302 8.27636 17 8.27636 17H3L5 4Z" />',
        cursor: '<path d="M2 10.0667H4.01184M4.35665 15.771L5.77902 14.3453M15.738 4.36236L14.3157 5.78814M4.35665 4.36236L5.77902 5.78814M10.0474 2V4.01667M9.08862 9.0578L11.1289 22L13.7818 16.9521L17.8851 21.0656C18.824 22.0069 20.3464 22.0069 21.2855 21.0658C22.2246 20.1245 22.2247 18.5984 21.2857 17.6571L17.2498 13.6112L22 11.1026L9.08862 9.0578Z" />',
        tooltips: '<path d="M15.9999 14H7.99992M11.9999 10H7.99992M21 12C21 16.9706 16.9706 21 12 21C10.7098 21 8.23 21 6.19959 21C5.07976 21 4.51984 21 4.09202 20.782C3.71569 20.5903 3.40973 20.2843 3.21799 19.908C3 19.4802 3 18.9202 3 17.8002C3 15.7996 3 13.3539 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" />',
        dictionary: '<path d="M20 16V10C20 7.19974 20 5.79961 19.455 4.73005C18.9757 3.78924 18.2108 3.02433 17.27 2.54497C16.2004 2 14.8003 2 12 2C9.19974 2 7.79961 2 6.73005 2.54497C5.78924 3.02433 5.02433 3.78924 4.54497 4.73005C4 5.79961 4 7.19974 4 10V19M20 16H7C5.34315 16 4 17.3431 4 19M20 16V16.1707C18.8348 16.5825 18 17.6938 18 19C18 20.3062 18.8348 21.4175 20 21.8293V22H7C5.34315 22 4 20.6569 4 19" />',
        screenReader: '<path d="M17 8.99999C18.3333 10.7775 18.3333 13.2225 17 15M20 5.99999C22.6667 9.55499 22.6667 14.445 20 18M8.71963 19.2663L6.81681 17.6807C6.28903 17.2408 5.62376 17 4.93675 17C3.31483 17 2 15.6851 2 14.0632V9.93673C2 8.3148 3.31483 6.99997 4.93675 6.99997C5.62377 6.99997 6.28904 6.75911 6.81682 6.31929L8.71963 4.73361C10.0223 3.64807 12 4.57438 12 6.27006V17.7299C12 19.4256 10.0223 20.3519 8.71963 19.2663Z" />',
        pauseAnim: '<path d="M9.5 9V15M14.5 9V15M13 21H11C8.19974 21 6.79961 21 5.73005 20.455C4.78924 19.9757 4.02433 19.2108 3.54497 18.27C3 17.2004 3 15.8003 3 13L3 11C3 8.19974 3 6.79961 3.54497 5.73005C4.02433 4.78924 4.78924 4.02433 5.73005 3.54497C6.79961 3 8.19974 3 11 3L13 3C15.8003 3 17.2004 3 18.27 3.54497C19.2108 4.02433 19.9757 4.78924 20.455 5.73005C21 6.79961 21 8.19974 21 11V13C21 15.8003 21 17.2004 20.455 18.27C19.9757 19.2108 19.2108 19.9757 18.27 20.455C17.2004 21 15.8003 21 13 21Z" />',
        hideImages: '<path d="M13 8V8.00995M14 20H10M10 20C7.19974 20 5.79961 20 4.73005 19.455C3.78924 18.9757 3.02433 18.2108 2.54497 17.27C2 16.2004 2 14.8003 2 12L2 9.00995M10 20C8.87516 20 7.97627 19.9998 7.23395 19.9644M4.61771 4.61771C5.68727 4.07275 7.19974 4 10 4H14C16.8003 4 18.2004 4 19.27 4.54497C20.2108 5.02433 20.9757 5.78924 21.455 6.73005C22 7.79961 22 9.19974 22 12C22 14.8003 22 16.2004 21.455 17.27M21.455 17.27C21.4859 17.2095 21.515 17.1477 21.5424 17.0849L18.789 11.578C18.0519 10.1039 15.9483 10.1039 15.2113 11.578L14 14M21.455 17.27C20.9964 18.17 20.2765 18.9091 19.3912 19.3912M3 3L19.3912 19.3912M21 21L19.3912 19.3912" />',
        reset: '<path d="M14 2C14 2 14.8492 2.12132 18.364 5.63604C21.8787 9.15076 21.8787 14.8492 18.364 18.364C17.6532 19.0747 16.8532 19.6417 16 20.065M14 2L19 2M14 2L14 7M10 22C10 22 9.15076 21.8787 5.63604 18.364C2.12132 14.8492 2.12132 9.15076 5.63604 5.63604C6.34677 4.92531 7.14679 4.3583 8 3.93501M10 22H5M10 22L10 17" />'
    };

    // --- 2. TEXTOS E ESTADO ---
    // Cada ajuste tem um nome para o leitor de tela e, quando tem níveis, o nome de cada nível.
    const AJUSTES = {
        contrast: { rotulo: 'Contraste', niveis: ['Padrão', 'Modo escuro', 'Alto contraste'] },
        textSize: { rotulo: 'Tamanho do texto', niveis: ['Padrão', 'Grande', 'Muito grande'] },
        lineHeight: { rotulo: 'Altura da linha', niveis: ['Padrão', 'Média', 'Grande'] },
        textAlign: { rotulo: 'Alinhamento do texto', niveis: ['Padrão', 'À esquerda', 'Centralizado', 'À direita', 'Justificado'] },
        textSpacing: { rotulo: 'Espaçamento do texto', niveis: ['Padrão', 'Médio', 'Grande'] },
        saturation: { rotulo: 'Saturação', niveis: ['Padrão', 'Tons de cinza', 'Cores intensas'] },
        highlightLinks: { rotulo: 'Destacar links' },
        dyslexia: { rotulo: 'Fonte para dislexia' },
        cursor: { rotulo: 'Cursor grande' },
        tooltips: { rotulo: 'Dicas ao passar o mouse' },
        structure: { rotulo: 'Estrutura da página' },
        screenReader: { rotulo: 'Leitura em voz alta' },
        pauseAnim: { rotulo: 'Pausar animações' },
        hideImages: { rotulo: 'Esconder imagens' }
    };

    const state = {
        contrast: 0, textSize: 0, lineHeight: 0, textAlign: 0,
        highlightLinks: false, hideImages: false, dyslexia: false,
        cursor: false, pauseAnim: false, screenReader: false,
        tooltips: false, saturation: 0, textSpacing: 0
    };

    // --- 3. MONTAGEM DO WIDGET ---
    function renderBtn(action) {
        const aj = AJUSTES[action];
        const levels = aj.niveis ? aj.niveis.length : 0;
        let dotsHTML = '';
        if (levels > 0) {
            dotsHTML = '<span class="a11y-indicators" aria-hidden="true">';
            for (let i = 0; i < levels; i++) dotsHTML += `<span class="a11y-dot"></span>`;
            dotsHTML += '</span>';
        }
        const iconSVG = Array.isArray(ICONS[action]) ? ICONS[action][0] : ICONS[action];
        return `
            <button type="button" class="a11y-btn" data-action="${action}" data-levels="${levels}" aria-label="${aj.rotulo}"${levels ? '' : ' aria-pressed="false"'}>
                <span class="a11y-icon-box" aria-hidden="true"><svg viewBox="0 0 24 24">${iconSVG}</svg></span>
                <span class="a11y-rotulo" aria-hidden="true">${aj.rotulo}</span>
                ${dotsHTML}
            </button>`;
    }

    const widgetHTML = `
    <div class="a11y-ui">
    <button type="button" id="a11y-trigger" aria-label="Abrir o menu de acessibilidade" aria-expanded="false" aria-controls="a11y-panel">
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.trigger}</svg>
    </button>

    <div id="a11y-panel" role="dialog" aria-label="Menu de acessibilidade" hidden>
        <div class="a11y-header">
            <h2>Acessibilidade</h2>
            <button type="button" class="a11y-close" aria-label="Fechar o menu de acessibilidade"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.close}</svg></button>
        </div>

        <div class="a11y-content">
            <div class="a11y-grid">
                ${['contrast', 'textSize', 'lineHeight', 'textAlign', 'textSpacing', 'saturation',
                   'highlightLinks', 'dyslexia', 'cursor', 'tooltips', 'structure', 'screenReader',
                   'pauseAnim', 'hideImages'].map(renderBtn).join('')}

                <button type="button" class="a11y-btn a11y-btn--reset" data-action="reset">
                    <span class="a11y-icon-box" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS.reset}</svg></span>
                    <span class="a11y-rotulo">Restaurar tudo</span>
                </button>
            </div>
        </div>

        <div class="a11y-footer">
            Baseado no <a href="https://github.com/junanobi/accessibility-widget" target="_blank" rel="noopener">Accessibility Widget</a> (MIT).
            As escolhas ficam só neste navegador.
        </div>
    </div>

    <div id="a11y-struct-modal" class="a11y-structure-modal" role="dialog" aria-modal="true" aria-labelledby="a11y-struct-titulo" hidden>
        <div class="a11y-struct-header">
            <h2 id="a11y-struct-titulo">Títulos desta página</h2>
            <button type="button" class="a11y-struct-close" aria-label="Fechar a estrutura da página"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.close}</svg></button>
        </div>
        <div class="a11y-struct-content" id="a11y-struct-list"></div>
    </div>

    <p class="a11y-status" id="a11y-status" role="status" aria-live="polite"></p>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', widgetHTML);

    // --- 4. REFERÊNCIAS ---
    const btnTrigger = document.getElementById('a11y-trigger');
    const panel = document.getElementById('a11y-panel');
    const btnClose = panel.querySelector('.a11y-close');
    const buttons = panel.querySelectorAll('.a11y-btn');
    const html = document.documentElement;
    const structModal = document.getElementById('a11y-struct-modal');
    const statusEl = document.getElementById('a11y-status');

    function anunciar(texto) {
        statusEl.textContent = '';
        // O texto entra no próximo quadro para o leitor de tela reconhecer a mudança.
        requestAnimationFrame(() => { statusEl.textContent = texto; });
    }

    function abrirPainel() {
        panel.hidden = false;
        btnTrigger.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => panel.classList.add('active'));
        panel.querySelector('.a11y-btn').focus();
    }

    function fecharPainel(devolverFoco) {
        panel.classList.remove('active');
        panel.hidden = true;
        btnTrigger.setAttribute('aria-expanded', 'false');
        if (devolverFoco) btnTrigger.focus();
    }

    btnTrigger.addEventListener('click', () => (panel.hidden ? abrirPainel() : fecharPainel(true)));
    btnClose.addEventListener('click', () => fecharPainel(true));

    function fecharEstrutura() {
        structModal.hidden = true;
        btnTrigger.focus();
    }
    structModal.querySelector('.a11y-struct-close').addEventListener('click', fecharEstrutura);

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!structModal.hidden) { fecharEstrutura(); return; }
        if (!panel.hidden) fecharPainel(true);
    });

    // Clicar fora do painel fecha, como qualquer popup.
    document.addEventListener('click', (e) => {
        if (panel.hidden) return;
        if (e.composedPath().some((n) => n === panel || n === btnTrigger)) return;
        fecharPainel(false);
    });

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => handleAction(btn.getAttribute('data-action'), btn));
    });

    // --- 5. LÓGICA ---
    function handleAction(action, btn) {
        if (action === 'reset') { resetAll(); anunciar('Todos os ajustes de acessibilidade foram restaurados.'); return; }
        if (action === 'structure') { showStructure(); return; }

        const levels = parseInt(btn.getAttribute('data-levels'), 10) || 0;
        if (levels > 0) state[action] = (state[action] + 1) % levels;
        else state[action] = !state[action];

        applyEffects(action);
        updateButtonVisuals(btn, action);
        saveSettings();

        const aj = AJUSTES[action];
        anunciar(levels > 0 ? `${aj.rotulo}: ${aj.niveis[state[action]]}` : `${aj.rotulo}: ${state[action] ? 'ligado' : 'desligado'}`);
    }

    function updateButtonVisuals(btn, action) {
        if (action === 'reset' || action === 'structure') return;
        const val = state[action];
        const aj = AJUSTES[action];
        const iconBox = btn.querySelector('.a11y-icon-box svg');

        btn.classList.toggle('active', val !== 0 && val !== false);

        if (Array.isArray(ICONS[action]) && ICONS[action][val]) iconBox.innerHTML = ICONS[action][val];

        if (aj.niveis) {
            btn.setAttribute('aria-label', `${aj.rotulo}: ${aj.niveis[val]}. Toque para mudar.`);
            btn.querySelectorAll('.a11y-dot').forEach((d, i) => d.classList.toggle('active', i === val && val !== 0));
        } else {
            btn.setAttribute('aria-pressed', String(Boolean(val)));
        }
    }

    // Todas as classes do widget começam com "a11y-": só elas saem no restaurar, as do site ficam.
    function limparClasses(prefixos) {
        Array.from(html.classList)
            .filter((c) => prefixos.some((p) => c.startsWith(p)))
            .forEach((c) => html.classList.remove(c));
    }

    const GRUPOS = {
        contrast: ['a11y-contrast-'],
        textSize: ['a11y-bigger-text', 'a11y-extra-big-text'],
        lineHeight: ['a11y-lh-'],
        textAlign: ['a11y-align-'],
        textSpacing: ['a11y-spacing-'],
        saturation: ['a11y-saturation-']
    };

    function applyEffects(action) {
        if (GRUPOS[action]) limparClasses(GRUPOS[action]);

        switch (action) {
            case 'contrast':
                if (state.contrast === 1) html.classList.add('a11y-contrast-dark');
                if (state.contrast === 2) html.classList.add('a11y-contrast-high');
                break;
            case 'textSize':
                if (state.textSize === 1) html.classList.add('a11y-bigger-text');
                if (state.textSize === 2) html.classList.add('a11y-extra-big-text');
                break;
            case 'lineHeight':
                if (state.lineHeight > 0) html.classList.add('a11y-lh-' + state.lineHeight);
                break;
            case 'textAlign':
                ['', 'left', 'center', 'right', 'justify'].forEach((nome, i) => {
                    if (nome && state.textAlign === i) html.classList.add('a11y-align-' + nome);
                });
                break;
            case 'textSpacing':
                if (state.textSpacing === 1) html.classList.add('a11y-spacing-medium');
                if (state.textSpacing === 2) html.classList.add('a11y-spacing-wide');
                break;
            case 'saturation':
                if (state.saturation === 1) html.classList.add('a11y-saturation-low');
                if (state.saturation === 2) html.classList.add('a11y-saturation-high');
                break;
            case 'highlightLinks': html.classList.toggle('a11y-highlight-links', state.highlightLinks); break;
            case 'dyslexia': html.classList.toggle('a11y-dyslexia', state.dyslexia); break;
            case 'cursor': html.classList.toggle('a11y-cursor-big', state.cursor); break;
            case 'hideImages': html.classList.toggle('a11y-hide-images', state.hideImages); break;
            case 'pauseAnim': html.classList.toggle('a11y-pause-anim', state.pauseAnim); break;
            case 'screenReader':
                if (!state.screenReader && synth) synth.cancel();
                break;
            case 'tooltips':
                if (!state.tooltips) hideTooltip();
                break;
        }
    }

    // --- 6. ESTRUTURA DA PÁGINA ---
    function showStructure() {
        const headings = document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6, body > h1, body > h2');
        const listContainer = document.getElementById('a11y-struct-list');
        listContainer.textContent = '';

        if (headings.length === 0) {
            const p = document.createElement('p');
            p.textContent = 'Esta página não tem títulos.';
            listContainer.appendChild(p);
        } else {
            headings.forEach((h) => {
                const texto = (h.textContent || '').trim();
                if (!texto || h.closest('.a11y-ui')) return;
                const link = document.createElement('a');
                link.href = '#';
                link.className = 'a11y-struct-item';
                link.style.paddingLeft = (Number(h.tagName[1]) - 1) * 14 + 'px';
                const tag = document.createElement('span');
                tag.className = 'a11y-tag-label';
                tag.textContent = h.tagName;
                link.append(tag, document.createTextNode(' ' + texto));
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    structModal.hidden = true;
                    h.setAttribute('tabindex', '-1');
                    h.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    h.focus({ preventScroll: true });
                });
                listContainer.appendChild(link);
            });
        }
        structModal.hidden = false;
        const primeiro = listContainer.querySelector('a') || structModal.querySelector('.a11y-struct-close');
        primeiro.focus();
    }

    // --- 7. LEITURA EM VOZ ALTA E DICAS ---
    const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
    const LIDOS = 'p, h1, h2, h3, h4, h5, h6, a, button, li, label, dt, dd, summary, legend, figcaption, blockquote, td, th, option, [role="button"], [role="tab"], [role="link"]';
    let lendo = null;

    function temTextoProprio(n) {
        return Array.from(n.childNodes).some((c) => c.nodeType === 3 && c.textContent.trim().length > 1);
    }

    /** O nome de um controle ou imagem, do jeito que um leitor de tela diria. */
    function nomeDe(el) {
        const direto = el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title');
        if (direto) return direto.trim();
        const por = el.getAttribute('aria-labelledby');
        if (por) {
            const t = por.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
            if (t) return t;
        }
        if (el.labels && el.labels[0]) return el.labels[0].textContent.trim();
        const svgTitulo = el.querySelector && el.querySelector('svg title');
        if (svgTitulo && svgTitulo.textContent.trim()) return svgTitulo.textContent.trim();
        if (el.placeholder) return el.placeholder.trim();
        return '';
    }

    /** O pedaço da página que se lê a partir do que está sob o mouse: o título, o parágrafo, o botão... */
    function alvoDeLeitura(origem) {
        let n = origem.nodeType === 1 ? origem : origem.parentElement;
        for (let i = 0; n && n !== document.body && i < 8; i++, n = n.parentElement) {
            if (n.closest('.a11y-ui') && !n.closest('#a11y-panel, #a11y-struct-modal')) return null;
            if (n.matches('img, svg, canvas, input, select, textarea') && nomeDe(n)) return n;
            if (n.matches(LIDOS) || temTextoProprio(n)) return n;
        }
        return null;
    }

    function falar(origem) {
        if (!synth) return;
        const el = alvoDeLeitura(origem);
        if (!el) return;
        const texto = ((el.matches('img, svg, canvas, input, select, textarea') ? nomeDe(el) : (el.getAttribute('aria-label') || el.innerText || el.textContent)) || '').trim().slice(0, 600);
        if (!texto) return;
        if (el === lendo) return;
        if (lendo) lendo.classList.remove('a11y-lendo');
        lendo = el;
        el.classList.add('a11y-lendo');
        synth.cancel();
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = 'pt-BR';
        synth.speak(u);
    }

    function pararDeFalar() {
        if (lendo) { lendo.classList.remove('a11y-lendo'); lendo = null; }
        if (synth) synth.cancel();
    }

    document.addEventListener('mouseover', (e) => {
        if (state.screenReader) falar(e.target);
        if (state.tooltips) {
            const alvo = e.target.closest('[aria-label], [alt], [title], [aria-labelledby], a, button, input, select, textarea, summary, [role="button"]');
            if (alvo && !alvo.closest('.a11y-ui')) {
                let label = nomeDe(alvo);
                // Quem já tem texto visível (um link escrito, um botão com rótulo) não precisa repetir a dica.
                if (label && (alvo.textContent || '').trim() === label) label = '';
                if (label) showTooltip(e.clientX, e.clientY, label);
            }
        }
    });
    document.addEventListener('mouseout', () => {
        if (state.screenReader) pararDeFalar();
        if (state.tooltips) hideTooltip();
    });
    // Quem navega pelo teclado também ouve o que recebe o foco.
    document.addEventListener('focusin', (e) => { if (state.screenReader) falar(e.target); });
    document.addEventListener('focusout', () => { if (state.screenReader) pararDeFalar(); });

    let tooltipEl;
    function showTooltip(x, y, txt) {
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'a11y-tooltip-box';
            tooltipEl.setAttribute('aria-hidden', 'true');
            tooltipEl.setAttribute('popover', 'manual');
            document.body.appendChild(tooltipEl);
        }
        tooltipEl.textContent = txt;
        tooltipEl.style.display = 'block';
        try { if (!tooltipEl.matches(':popover-open')) tooltipEl.showPopover(); } catch (e) { /* sem popover: fica o z-index */ }
        tooltipEl.style.left = Math.min(x + 12, window.innerWidth - 260) + 'px';
        tooltipEl.style.top = (y + 16) + 'px';
    }
    function hideTooltip() {
        if (!tooltipEl) return;
        try { tooltipEl.hidePopover(); } catch (e) { /* já fechado */ }
        tooltipEl.style.display = 'none';
    }

    // --- 8. INÍCIO E RESTAURAR ---
    function resetAll() {
        Object.keys(state).forEach((k) => { state[k] = typeof state[k] === 'number' ? 0 : false; });
        limparClasses(['a11y-']);
        buttons.forEach((btn) => updateButtonVisuals(btn, btn.getAttribute('data-action')));
        pararDeFalar();
        hideTooltip();
        try { localStorage.removeItem(CHAVE); } catch (e) { /* sem armazenamento: nada a apagar */ }
        structModal.hidden = true;
    }

    function saveSettings() {
        try { localStorage.setItem(CHAVE, JSON.stringify(state)); } catch (e) { /* modo privado: vale só nesta visita */ }
    }

    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { saved = null; }
    if (saved && typeof saved === 'object') {
        Object.keys(state).forEach((k) => {
            if (typeof saved[k] === typeof state[k]) state[k] = saved[k];
        });
        Object.keys(state).forEach(applyEffects);
        buttons.forEach((btn) => updateButtonVisuals(btn, btn.getAttribute('data-action')));
    }
    buttons.forEach((btn) => updateButtonVisuals(btn, btn.getAttribute('data-action')));
});
