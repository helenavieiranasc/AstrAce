"use strict";
// Cabeçalho inteligente: desliza para cima ao descer um tanto da tela e desliza de volta ao subir um pouco.
(() => {
    const topo = document.querySelector(".topo");
    if (!topo)
        return;
    const menuLateral = document.getElementById("menu-lateral");
    const contaTopo = document.getElementById("conta-topo");
    const LIMIAR_TOPO = 140; // perto do topo da página, fica sempre visível
    const DELTA_DESCER = 90; // precisa descer um bom trecho para recolher
    const DELTA_SUBIR = 18; // basta subir um pouco para reaparecer
    let ultimoY = Math.max(0, window.scrollY);
    let ancoraY = ultimoY;
    let direcao = 0; // 1 = descendo, -1 = subindo
    let agendado = false;
    function atualizar() {
        agendado = false;
        const y = Math.max(0, window.scrollY);
        const diff = y - ultimoY;
        if (Math.abs(diff) < 1)
            return;
        if (y <= LIMIAR_TOPO || menuLateral?.open) {
            topo.classList.remove("topo--oculto");
            ultimoY = y;
            ancoraY = y;
            direcao = 0;
            return;
        }
        if (diff > 0) {
            if (direcao !== 1) {
                direcao = 1;
                ancoraY = ultimoY;
            }
            if (y - ancoraY >= DELTA_DESCER && !topo.contains(document.activeElement)) {
                topo.classList.add("topo--oculto");
                if (contaTopo?.open)
                    contaTopo.open = false;
            }
        }
        else if (diff < 0) {
            if (direcao !== -1) {
                direcao = -1;
                ancoraY = ultimoY;
            }
            if (ancoraY - y >= DELTA_SUBIR) {
                topo.classList.remove("topo--oculto");
            }
        }
        ultimoY = y;
    }
    window.addEventListener("scroll", () => {
        if (!agendado) {
            agendado = true;
            window.requestAnimationFrame(atualizar);
        }
    }, { passive: true });
    topo.addEventListener("focusin", () => {
        topo.classList.remove("topo--oculto");
    });
})();
