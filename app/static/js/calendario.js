// Calendário do painel: troca o seletor de data do navegador (que o CSS não alcança) por um com o estilo do site.
// O input original continua no formulário, escondido, com o mesmo valor em ISO ("2026-10-29" ou
// "2026-10-29T14:30"): quem lê ou escreve `input.value` (admin.ts) nem percebe a troca.
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const DIAS_POR_EXTENSO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const dois = (n) => String(n).padStart(2, "0");
function lerValor(texto) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(texto);
    if (!m)
        return null;
    return { ano: +m[1], mes: +m[2] - 1, dia: +m[3], hora: +(m[4] ?? 0), minuto: +(m[5] ?? 0) };
}
function paraTexto(v, comHora) {
    const data = `${v.ano}-${dois(v.mes + 1)}-${dois(v.dia)}`;
    return comHora ? `${data}T${dois(v.hora)}:${dois(v.minuto)}` : data;
}
function paraExibir(v, comHora) {
    const data = `${dois(v.dia)}/${dois(v.mes + 1)}/${v.ano}`;
    return comHora ? `${data} às ${dois(v.hora)}:${dois(v.minuto)}` : data;
}
function hoje() {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth(), dia: d.getDate(), hora: d.getHours(), minuto: Math.floor(d.getMinutes() / 5) * 5 };
}
function melhorar(input) {
    const comHora = input.type === "datetime-local";
    const rotulo = document.querySelector(`label[for="${input.id}"]`)?.textContent?.replace("*", "").trim() ?? "data";
    const id = input.id;
    const nome = input.name;
    const caixa = document.createElement("div");
    caixa.className = "cal";
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "cal__campo";
    botao.id = id;
    botao.setAttribute("aria-haspopup", "dialog");
    botao.setAttribute("aria-expanded", "false");
    botao.dataset.erroPara = nome;
    botao.innerHTML = `<span class="cal__texto"></span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>`;
    const textoBotao = botao.querySelector(".cal__texto");
    const painel = document.createElement("div");
    painel.className = "cal__painel";
    painel.hidden = true;
    painel.setAttribute("role", "dialog");
    painel.setAttribute("aria-label", `Escolher ${rotulo.toLowerCase()}`);
    input.removeAttribute("id");
    const descricao = input.getAttribute("aria-describedby");
    if (descricao)
        botao.setAttribute("aria-describedby", descricao);
    input.type = "hidden";
    input.parentElement.insertBefore(caixa, input);
    caixa.append(botao, painel, input);
    // O `value` do input passa a avisar o calendário quando o código o muda (como o admin.ts faz ao abrir um evento).
    const original = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    Object.defineProperty(input, "value", {
        get: () => original.get.call(input),
        set: (v) => {
            original.set.call(input, v);
            atualizarBotao();
        },
    });
    let escolhido = null;
    let vendo = { ano: hoje().ano, mes: hoje().mes };
    function atualizarBotao() {
        escolhido = lerValor(input.value);
        textoBotao.textContent = escolhido ? paraExibir(escolhido, comHora) : comHora ? "dd/mm/aaaa --:--" : "dd/mm/aaaa";
        textoBotao.classList.toggle("cal__texto--vazio", !escolhido);
    }
    function gravar(v) {
        original.set.call(input, v ? paraTexto(v, comHora) : "");
        atualizarBotao();
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function desenhar() {
        const h = hoje();
        const primeiro = new Date(vendo.ano, vendo.mes, 1);
        const total = new Date(vendo.ano, vendo.mes + 1, 0).getDate();
        const celulas = [];
        for (let i = 0; i < primeiro.getDay(); i++)
            celulas.push(`<span></span>`);
        for (let d = 1; d <= total; d++) {
            const marcado = escolhido && escolhido.ano === vendo.ano && escolhido.mes === vendo.mes && escolhido.dia === d;
            const eHoje = h.ano === vendo.ano && h.mes === vendo.mes && h.dia === d;
            const nomeDia = DIAS_POR_EXTENSO[new Date(vendo.ano, vendo.mes, d).getDay()];
            celulas.push(`<button type="button" class="cal__dia${eHoje ? " cal__dia--hoje" : ""}" data-dia="${d}" aria-pressed="${marcado ? "true" : "false"}" aria-label="${nomeDia}, ${d} de ${MESES[vendo.mes]} de ${vendo.ano}">${d}</button>`);
        }
        const horas = comHora
            ? `<div class="cal__hora"><label>Hora <select class="cal__select" data-hora>${Array.from({ length: 24 }, (_, i) => `<option value="${i}"${(escolhido?.hora ?? 9) === i ? " selected" : ""}>${dois(i)}</option>`).join("")}</select></label>
         <span aria-hidden="true">:</span>
         <label>Minuto <select class="cal__select" data-minuto>${Array.from({ length: 12 }, (_, i) => i * 5).map((m) => `<option value="${m}"${(escolhido?.minuto ?? 0) === m ? " selected" : ""}>${dois(m)}</option>`).join("")}</select></label></div>`
            : "";
        painel.innerHTML = `
      <div class="cal__topo">
        <button type="button" class="cal__nav" data-mes="-1" aria-label="Mês anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
        <p class="cal__titulo" aria-live="polite">${MESES[vendo.mes]} de ${vendo.ano}</p>
        <button type="button" class="cal__nav" data-mes="1" aria-label="Próximo mês"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
      <div class="cal__semana" aria-hidden="true">${DIAS.map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="cal__grade">${celulas.join("")}</div>
      ${horas}
      <div class="cal__rodape">
        <button type="button" class="cal__acao" data-limpar>Limpar</button>
        <button type="button" class="cal__acao" data-hoje>Hoje</button>
        ${comHora ? `<button type="button" class="cal__ok" data-ok>Pronto</button>` : ""}
      </div>`;
    }
    function horaEscolhida() {
        const hora = painel.querySelector("[data-hora]");
        const minuto = painel.querySelector("[data-minuto]");
        return { hora: hora ? +hora.value : escolhido?.hora ?? 9, minuto: minuto ? +minuto.value : escolhido?.minuto ?? 0 };
    }
    function abrir() {
        atualizarBotao();
        const base = escolhido ?? hoje();
        vendo = { ano: base.ano, mes: base.mes };
        desenhar();
        painel.hidden = false;
        botao.setAttribute("aria-expanded", "true");
        painel.querySelector("[aria-pressed=true], .cal__dia--hoje, .cal__dia")?.focus({ preventScroll: true });
        painel.scrollIntoView({ block: "nearest" }); // dentro do formulário rolável, mostra o calendário inteiro
    }
    function fechar(devolverFoco = false) {
        if (painel.hidden)
            return;
        painel.hidden = true;
        botao.setAttribute("aria-expanded", "false");
        if (devolverFoco)
            botao.focus();
    }
    botao.addEventListener("click", () => (painel.hidden ? abrir() : fechar()));
    painel.addEventListener("click", (evento) => {
        const alvo = evento.target.closest("button");
        if (!alvo)
            return;
        if (alvo.dataset.mes) {
            vendo = { ano: vendo.ano, mes: vendo.mes + Number(alvo.dataset.mes) };
            if (vendo.mes < 0)
                vendo = { ano: vendo.ano - 1, mes: 11 };
            if (vendo.mes > 11)
                vendo = { ano: vendo.ano + 1, mes: 0 };
            desenhar();
            painel.querySelector(`[data-mes="${alvo.dataset.mes}"]`)?.focus();
        }
        else if (alvo.dataset.dia) {
            escolhido = { ano: vendo.ano, mes: vendo.mes, dia: Number(alvo.dataset.dia), ...horaEscolhida() };
            gravar(escolhido);
            if (comHora)
                desenhar();
            else
                fechar(true);
        }
        else if (alvo.hasAttribute("data-hoje")) {
            const h = hoje();
            gravar({ ...h, ...(comHora ? horaEscolhida() : {}) });
            vendo = { ano: h.ano, mes: h.mes };
            if (comHora)
                desenhar();
            else
                fechar(true);
        }
        else if (alvo.hasAttribute("data-limpar")) {
            gravar(null);
            fechar(true);
        }
        else if (alvo.hasAttribute("data-ok")) {
            fechar(true);
        }
    });
    // Mudar a hora com um dia já escolhido atualiza o valor na hora.
    painel.addEventListener("change", () => {
        if (escolhido)
            gravar({ ...escolhido, ...horaEscolhida() });
    });
    painel.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") {
            evento.stopPropagation(); // não fecha o formulário inteiro
            evento.preventDefault();
            fechar(true);
        }
    });
    document.addEventListener("click", (evento) => {
        // composedPath: o painel é redesenhado no clique, e o alvo já saiu da página quando este ouvinte roda.
        if (!evento.composedPath().includes(caixa))
            fechar();
    });
    input.form?.addEventListener("reset", () => setTimeout(atualizarBotao));
    atualizarBotao();
}
/** Troca todos os campos de data e de data com hora dos formulários do painel. */
export function iniciarCalendarios(raiz = document) {
    raiz
        .querySelectorAll('.painel-form input[type="date"], .painel-form input[type="datetime-local"]')
        .forEach(melhorar);
}
