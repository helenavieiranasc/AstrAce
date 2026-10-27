// Página inicial: completa os cartazes com dados reais (próximo evento, quantos projetos e vagas)
// e carrega o aviãozinho 3D. Se alguma API falhar, o cartaz fica com o texto que já tem.
import { api } from "./comum.js";
async function proximoEvento() {
    let evento;
    try {
        evento = await api("/api/eventos/proximo");
    }
    catch {
        return;
    }
    if (!evento)
        return;
    const mes = document.getElementById("inicio-mes");
    const dia = document.getElementById("inicio-dia");
    const texto = document.getElementById("inicio-evento");
    if (mes)
        mes.textContent = evento.mes;
    if (dia)
        dia.textContent = String(evento.dia);
    if (texto)
        texto.textContent = `Próximo: ${evento.titulo} · ${(evento.quando ?? evento.data_rotulo).toLowerCase()}`;
}
async function contagem(chave, url, um, varios) {
    const alvo = document.querySelector(`[data-contagem="${chave}"]`);
    if (!alvo)
        return;
    try {
        const { total } = await api(url);
        if (!total)
            return;
        alvo.textContent = `${total} ${total === 1 ? um : varios}`;
        alvo.hidden = false;
    }
    catch {
        // sem número, o cartaz continua só com o texto
    }
}
void proximoEvento();
void contagem("projetos", "/api/projetos?por_pagina=1", "projeto no mural", "projetos no mural");
void contagem("vagas", "/api/vagas?por_pagina=1", "vaga e programa", "vagas e programas");
const aviao = document.getElementById("inicio-aviao");
const economia = navigator.connection?.saveData;
if (aviao && !economia) {
    import("./aviao-3d.js").then(({ montarAviao }) => montarAviao(aviao)).catch(() => {
        // sem 3D, fica o aviãozinho desenhado
    });
}
