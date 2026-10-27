// Barra lateral: abre pelo botão "Menu" do cabeçalho e fecha no X, no Esc ou clicando fora.

const barra = document.getElementById("menu-lateral") as HTMLDialogElement | null;
const abrir = document.getElementById("abrir-menu");
const fechar = document.getElementById("fechar-menu");

if (barra && abrir) {
  abrir.addEventListener("click", () => {
    barra.showModal();
    abrir.setAttribute("aria-expanded", "true");
    // O foco começa na página atual; se ela não está no menu, no primeiro link.
    (barra.querySelector<HTMLElement>(".lateral__nav [aria-current='page']") ??
      barra.querySelector<HTMLElement>(".lateral__nav a"))?.focus();
  });
  fechar?.addEventListener("click", () => barra.close());
  // O <dialog> só recebe o clique direto quando ele cai no fundo escurecido, fora da folha.
  barra.addEventListener("click", (evento) => {
    if (evento.target === barra) barra.close();
  });
  barra.addEventListener("close", () => {
    abrir.setAttribute("aria-expanded", "false");
    abrir.focus();
  });
}
