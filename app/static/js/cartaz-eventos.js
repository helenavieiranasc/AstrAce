// Cartaz de eventos no mural (Pessoa 3): mostra a data e o nome do próximo evento da agenda.
// Sem eventos (ou sem conexão), o cartaz fica como o mural deixou: com a data de hoje.
import { api } from "./comum.js";
async function preencherCartaz() {
    const cartaz = document.querySelector(".cartaz-eventos");
    if (!cartaz)
        return;
    let evento;
    try {
        evento = await api("/api/eventos/proximo");
    }
    catch {
        return;
    }
    if (!evento)
        return;
    const mes = document.getElementById("cartaz-mes");
    const dia = document.getElementById("cartaz-dia");
    const texto = cartaz.querySelector(".cartaz-eventos__texto");
    if (mes)
        mes.textContent = evento.mes;
    if (dia)
        dia.textContent = String(evento.dia);
    if (texto) {
        const quando = evento.quando ?? evento.data_rotulo;
        texto.textContent = `Próximo: ${evento.titulo} · ${quando.toLowerCase()}`;
    }
}
void preencherCartaz();
