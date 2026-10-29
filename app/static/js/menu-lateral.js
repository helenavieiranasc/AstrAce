"use strict";
// Barra lateral: abre pelo botão "Menu" do cabeçalho e fecha com animação no X, no Esc ou clicando fora.
const barra = document.getElementById("menu-lateral");
const abrir = document.getElementById("abrir-menu");
const fechar = document.getElementById("fechar-menu");
if (barra && abrir) {
    const folha = barra.querySelector(".lateral__folha");
    let timerFechar = null;
    const concluirFechamento = () => {
        if (timerFechar !== null) {
            window.clearTimeout(timerFechar);
            timerFechar = null;
        }
        barra.classList.remove("lateral--fechando");
        if (barra.open)
            barra.close();
    };
    const fecharComAnimacao = () => {
        if (!barra.open || barra.classList.contains("lateral--fechando"))
            return;
        barra.classList.add("lateral--fechando");
        folha?.addEventListener("animationend", concluirFechamento, { once: true });
        timerFechar = window.setTimeout(concluirFechamento, 310);
    };
    abrir.addEventListener("click", () => {
        if (timerFechar !== null) {
            window.clearTimeout(timerFechar);
            timerFechar = null;
        }
        barra.classList.remove("lateral--fechando");
        barra.showModal();
        abrir.setAttribute("aria-expanded", "true");
        // O foco começa na página atual; se ela não está no menu, no primeiro link.
        (barra.querySelector(".lateral__nav [aria-current='page']") ??
            barra.querySelector(".lateral__nav a"))?.focus();
    });
    fechar?.addEventListener("click", fecharComAnimacao);
    // O <dialog> só recebe o clique direto quando ele cai no fundo escurecido, fora da folha.
    barra.addEventListener("click", (evento) => {
        if (evento.target === barra) {
            fecharComAnimacao();
            return;
        }
        // Se clicou num link com âncora da própria página (ex.: /perfil#certificados já estando em /perfil), fecha a barra.
        const link = evento.target instanceof Element ? evento.target.closest(".lateral__nav a") : null;
        if (link instanceof HTMLAnchorElement && link.hash && link.pathname === window.location.pathname) {
            fecharComAnimacao();
        }
    });
    // Intercepta o Esc para tocar a animação de saída antes de fechar o <dialog>.
    barra.addEventListener("cancel", (evento) => {
        evento.preventDefault();
        fecharComAnimacao();
    });
    barra.addEventListener("close", () => {
        barra.classList.remove("lateral--fechando");
        abrir.setAttribute("aria-expanded", "false");
        abrir.focus();
    });
}
