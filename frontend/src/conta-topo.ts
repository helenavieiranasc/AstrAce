// Menu da foto no cabeçalho: fecha ao clicar fora ou com Esc; sem a foto, mostra a inicial.

const menu = document.getElementById("conta-topo") as HTMLDetailsElement | null;

if (menu) {
  document.addEventListener("click", (evento) => {
    if (menu.open && !menu.contains(evento.target as Node)) menu.open = false;
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && menu.open) {
      menu.open = false;
      menu.querySelector("summary")?.focus();
    }
  });

  const foto = menu.querySelector<HTMLImageElement>(".conta-topo__foto");
  const inicial = menu.querySelector<HTMLElement>(".conta-topo__inicial");
  const semFoto = (): void => {
    foto?.remove();
    if (inicial) inicial.hidden = false;
  };
  if (foto && foto.complete && foto.naturalWidth === 0) semFoto();
  foto?.addEventListener("error", semFoto, { once: true });
}

/** Troca a foto do cabeçalho na hora, depois de salvar o perfil. */
export function atualizarFotoDoTopo(url: string | null): void {
  const avatar = document.querySelector<HTMLElement>(".conta-topo__avatar");
  if (!avatar) return;
  avatar.querySelector(".conta-topo__foto")?.remove();
  const inicial = avatar.querySelector<HTMLElement>(".conta-topo__inicial");
  if (url) {
    const img = document.createElement("img");
    img.className = "conta-topo__foto";
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.src = url;
    avatar.prepend(img);
  }
  if (inicial) inicial.hidden = Boolean(url);
}
