// Landing do AstrAce: estado de carregamento do botão do Google e estrela 3D.
import { el } from "./comum.js";
const botao = el("entrar-google");
const texto = botao.querySelector(".botao-google__texto");
const textoOriginal = texto?.textContent ?? "";
botao.addEventListener("click", () => {
    // O resto é redirecionamento do servidor para o Google.
    botao.setAttribute("aria-disabled", "true");
    if (texto)
        texto.textContent = "Abrindo o Google…";
});
// Ao voltar do Google pelo botão "voltar", o navegador pode restaurar a página como estava.
window.addEventListener("pageshow", () => {
    botao.removeAttribute("aria-disabled");
    if (texto)
        texto.textContent = textoOriginal;
});
const palco = document.getElementById("palco-estrela");
const economia = navigator.connection?.saveData;
if (palco && !economia) {
    import("./estrela-3d.js").then(({ montarEstrela }) => montarEstrela(palco)).catch(() => {
        // Sem 3D a página segue completa, com a estrela desenhada no lugar.
    });
}
