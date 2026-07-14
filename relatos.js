// ── Pro Povo — relatos.js ──

import { ouvirRelatos } from "./db.js";

const state = {
    relatos: [],
    busca: "",
    categoria: "todos",
    status: "todos",
    ordenacao: "votos"
};


// ── Carregar relatos ──

ouvirRelatos((relatos) => {
    state.relatos = relatos;
    renderizarRelatos();
});


// ── Renderizar lista ──

function renderizarRelatos() {

    const lista = document.getElementById("lista-relatos");
    const vazio = document.getElementById("sem-relatos");
    const contador = document.getElementById("contador");

    if (!lista) return;


    let relatos = [...state.relatos];


    // Pesquisa

    if (state.busca) {

        const termo = state.busca.toLowerCase();

        relatos = relatos.filter(r =>
            r.titulo?.toLowerCase().includes(termo) ||
            r.descricao?.toLowerCase().includes(termo) ||
            r.endereco?.toLowerCase().includes(termo)
        );

    }


    // Categoria

    if (state.categoria !== "todos") {

        relatos = relatos.filter(r =>
            r.categoria === state.categoria
        );

    }


    // Status

    if (state.status !== "todos") {

        relatos = relatos.filter(r =>
            r.status === state.status
        );

    }


    // Ordenação

    if (state.ordenacao === "votos") {

        relatos.sort((a,b) =>
            (b.votos || 0) - (a.votos || 0)
        );

    }

    if (state.ordenacao === "recentes") {

        relatos.sort((a,b) =>
            b.dataCriacao - a.dataCriacao
        );

    }

    if (state.ordenacao === "antigos") {

        relatos.sort((a,b) =>
            a.dataCriacao - b.dataCriacao
        );

    }


    contador.textContent =
        `${relatos.length} relato${relatos.length !== 1 ? "s" : ""} encontrado${relatos.length !== 1 ? "s" : ""}`;


    vazio.style.display =
        relatos.length ? "none" : "block";


    lista.innerHTML =
        relatos.map(cardRelato).join("");


    adicionarEventos();

}


// ── Card ──

function cardRelato(r) {

    const data = new Date(r.dataCriacao)
        .toLocaleDateString("pt-BR");


    return `

    <article class="card">

        <div class="card-body">


            <div class="card-tags">

                <span class="badge">
                    ${r.categoria}
                </span>


                <span class="status status-${r.status}">
                    ${r.status}
                </span>

            </div>


            <h3 class="card-title">
                ${r.titulo}
            </h3>


            <p class="card-desc">
                ${r.descricao}
            </p>


            <div class="card-meta">

                <span>
                    <i class="ti ti-map-pin"></i>
                    ${r.endereco}
                </span>


                <span>
                    <i class="ti ti-user"></i>
                    ${r.autorNome || "Usuário"}
                </span>


                <span>
                    <i class="ti ti-calendar"></i>
                    ${data}
                </span>

            </div>


            <div class="card-footer">


                <span>
                    <i class="ti ti-thumb-up"></i>
                    ${r.votos || 0} apoios
                </span>


                <button 
                    class="detail-btn"
                    data-id="${r.id}">
                    Ver detalhes
                    <i class="ti ti-arrow-right"></i>
                </button>


            </div>


        </div>

    </article>

    `;
}



// ── Eventos ──

function adicionarEventos() {


    document.querySelectorAll(".detail-btn")
    .forEach(btn => {


        btn.addEventListener("click", () => {

            const relato =
                state.relatos.find(
                    r => r.id === btn.dataset.id
                );


            abrirModal(relato);

        });


    });


}



// ── Modal ──

function abrirModal(r) {

    if (!r) return;


    document.getElementById("modal-titulo").textContent =
        r.titulo;


    document.getElementById("modal-descricao").textContent =
        r.descricao;


    document.getElementById("modal-badges").innerHTML = `

        <span class="badge">
            ${r.categoria}
        </span>

        <span class="status status-${r.status}">
            ${r.status}
        </span>

    `;


    document.getElementById("modal-infos").innerHTML = `

        <p>
            <i class="ti ti-map-pin"></i>
            ${r.endereco}
        </p>

        <p>
            <i class="ti ti-user"></i>
            ${r.autorNome || "Usuário"}
        </p>

    `;


    document
    .getElementById("modal-detalhes")
    .classList.add("open");

}



// Fechar modal

document
.getElementById("fechar-modal")
?.addEventListener("click", () => {

    document
    .getElementById("modal-detalhes")
    .classList.remove("open");

});


document
.getElementById("modal-fechar")
?.addEventListener("click", () => {

    document
    .getElementById("modal-detalhes")
    .classList.remove("open");

});



// ── Pesquisa ──

document
.getElementById("search-input")
?.addEventListener("input", e => {

    state.busca = e.target.value;

    renderizarRelatos();

});



// ── Filtros ──

document
.getElementById("categoria")
?.addEventListener("change", e => {

    state.categoria = e.target.value;

    renderizarRelatos();

});


document
.getElementById("status")
?.addEventListener("change", e => {

    state.status = e.target.value;

    renderizarRelatos();

});


document
.getElementById("ordenacao")
?.addEventListener("change", e => {

    state.ordenacao = e.target.value;

    renderizarRelatos();

});