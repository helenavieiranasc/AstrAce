// Emitir o certificado de um evento: manda o nome conferido e abre o certificado pronto.
import { ErroApi, el, mensagemDeErro, postJson } from "./comum.js";
const form = el("emitir");
const nome = el("emitir-nome");
const erro = el("emitir-erro");
const botao = form.querySelector("button[type=submit]");
function mostrarErro(mensagem) {
    erro.textContent = mensagem;
    erro.hidden = false;
    nome.setAttribute("aria-invalid", "true");
    nome.focus();
}
form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    erro.hidden = true;
    nome.removeAttribute("aria-invalid");
    if (nome.value.trim().length < 3) {
        mostrarErro("Escreva seu nome como ele deve aparecer no certificado.");
        return;
    }
    botao.disabled = true;
    botao.textContent = "Emitindo…";
    try {
        const { url } = await postJson(`/api/certificados/evento/${form.dataset.evento}`, {
            nome: nome.value,
        });
        window.location.assign(url);
    }
    catch (e) {
        mostrarErro(e instanceof ErroApi ? e.erros.nome ?? e.message : mensagemDeErro(e));
        botao.disabled = false;
        botao.textContent = "Emitir certificado";
    }
});
