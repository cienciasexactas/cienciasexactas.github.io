// =========================================================================
// MÓDULO DE GESTÃO DE TRABALHOS (trabalhos.js) - NAVEGAÇÃO POR PASTAS
// =========================================================================

let arvoreCompleta = null;
let categoriaAtual = "Trabalhos Individuais";
let caminhoNavegacao = []; // Ex: ["Economia", "2026-2027", "Trabalho_1"]

const API_LISTAR_TRABALHOS = "https://api-cienciasexactas.vercel.app/api/trabalhos";
const RAW_GITHUB_BASE = "https://raw.githubusercontent.com/cienciasexactas/cienciasexactas.github.io/main/";

const CATEGORIAS_TRABALHOS = [
  "Trabalhos Individuais",
  "Trabalhos de Grupo"
];

/**
 * Devolve o contentor correto no DOM
 */
function obterContainerTrabalhos() {
  return (
    document.getElementById("trabalhos-praticos-container") ||
    document.getElementById("lista-trabalhos-container") ||
    document.getElementById("trabalhos-lista")
  );
}

/**
 * Codifica cada segmento do caminho sem estragar as barras "/"
 */
function codificarCaminhoGitHub(caminho) {
  return String(caminho || "")
    .split("/")
    .filter(Boolean)
    .map(seg => encodeURIComponent(seg))
    .join("/");
}

/**
 * Normaliza nós vindos da API (suporta árvore aninhada com children ou lista plana)
 */
function obterFilhosDiretos(arvore, caminhoAlvo) {
  if (!arvore) return [];

  // Caso 1: A API devolve árvore hierárquica com .children
  if (Array.isArray(arvore) || (typeof arvore === "object" && Array.isArray(arvore.children))) {
    const listaRaiz = Array.isArray(arvore) ? arvore : arvore.children;

    function procurarNo(nos, alvo) {
      for (const no of nos) {
        const pathNo = (no.path || no.caminho || "").replace(/^\/+|\/+$/g, "");
        if (pathNo === alvo) {
          return no.children || [];
        }
        if (Array.isArray(no.children) && no.children.length > 0) {
          const encontrado = procurarNo(no.children, alvo);
          if (encontrado) return encontrado;
        }
      }
      return null;
    }

    const filhos = procurarNo(listaRaiz, caminhoAlvo);
    if (filhos !== null) {
      return filhos
        .filter(item => {
          const nome = item.name || item.nome || "";
          return nome && !nome.startsWith(".");
        })
        .map(item => ({
          nome: item.name || item.nome,
          path: (item.path || item.caminho || `${caminhoAlvo}/${item.name || item.nome}`).replace(/^\/+|\/+$/g, ""),
          tipo: (item.type === "dir" || item.tipo === "dir" || Array.isArray(item.children)) ? "dir" : "file"
        }));
    }
  }

  // Caso 2: A API devolve uma lista plana de ficheiros/pastas (ex: { ficheiros: [...] } ou { tree: [...] })
  const listaPlana = Array.isArray(arvore?.ficheiros)
    ? arvore.ficheiros
    : Array.isArray(arvore?.tree)
      ? arvore.tree
      : Array.isArray(arvore?.items)
        ? arvore.items
        : [];

  if (listaPlana.length > 0) {
    const prefixo = caminhoAlvo ? caminhoAlvo + "/" : "";
    const mapaFilhos = new Map();

    for (const item of listaPlana) {
      const p = String(item.path || item.caminho || "").replace(/^\/+|\/+$/g, "");
      if (!p.startsWith(prefixo)) continue;

      const resto = p.slice(prefixo.length);
      if (!resto) continue;

      const partes = resto.split("/");
      const nomeFilho = partes[0];
      if (!nomeFilho || nomeFilho.startsWith(".")) continue;

      const ehPasta = partes.length > 1 || item.type === "dir" || item.type === "tree";
      const caminhoFilho = prefixo + nomeFilho;

      if (!mapaFilhos.has(nomeFilho)) {
        mapaFilhos.set(nomeFilho, {
          nome: nomeFilho,
          path: caminhoFilho,
          tipo: ehPasta ? "dir" : "file"
        });
      } else if (ehPasta) {
        mapaFilhos.get(nomeFilho).tipo = "dir";
      }
    }

    return Array.from(mapaFilhos.values());
  }

  return [];
}

/**
 * Obtém ícone adequado ao tipo de ficheiro
 */
function obterIconeFicheiro(nome) {
  const ext = (nome.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "📄";
  if (["doc", "docx", "odt"].includes(ext)) return "📝";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["ppt", "pptx"].includes(ext)) return "📽️";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "🖼️";
  return "📎";
}

/**
 * Carrega a árvore da categoria selecionada a partir da API
 */
async function carregarArvoreTrabalhos(forcarAtualizacao = false) {
  const container = obterContainerTrabalhos();
  if (!container) return;

  container.innerHTML = `
    <div class="tp-estado-carregamento">
      <div class="tp-spinner"></div>
      <p>A carregar pastas e ficheiros de <b>${categoriaAtual}</b>...</p>
    </div>
  `;

  try {
    const caminhoBase = `www/Trabalhos/${categoriaAtual}`;
    const url = `${API_LISTAR_TRABALHOS}?caminho=${encodeURIComponent(caminhoBase)}${forcarAtualizacao ? "&refresh=1&t=" + Date.now() : ""}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Erro HTTP ${resp.status}`);

    const dados = await resp.json();
    arvoreCompleta = dados;
    renderizarExploradorTrabalhos();
  } catch (erro) {
    console.error("Erro ao carregar trabalhos:", erro);
    container.innerHTML = `
      <div class="tp-estado-vazio">
        <p>⚠️ Não foi possível carregar os trabalhos neste momento.</p>
        <button type="button" class="tp-btn-acao" onclick="carregarArvoreTrabalhos(true)">🔄 Tentar novamente</button>
      </div>
    `;
  }
}

/**
 * Renderiza o explorador de pastas e ficheiros do nível atual
 */
function renderizarExploradorTrabalhos() {
  const container = obterContainerTrabalhos();
  if (!container) return;

  const caminhoBase = `www/Trabalhos/${categoriaAtual}`;
  const caminhoCompleto = caminhoNavegacao.length > 0
    ? `${caminhoBase}/${caminhoNavegacao.join("/")}`
    : caminhoBase;

  const itens = obterFilhosDiretos(arvoreCompleta, caminhoCompleto);

  // Ordenar: pastas primeiro (ordem alfabética), depois ficheiros (ordem alfabética)
  itens.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === "dir" ? -1 : 1;
    return a.nome.localeCompare(b.nome, "pt", { numeric: true });
  });

  // Barra superior de categorias + atualizar
  let html = `
    <div class="tp-barra-topo" style="display:flex; flex-wrap:wrap; gap:8px; justify-content:space-between; align-items:center; margin-bottom:14px;">
      <div class="tp-tabs" style="display:flex; flex-wrap:wrap; gap:8px;">
        ${CATEGORIAS_TRABALHOS.map(cat => `
          <button type="button"
            class="tp-tab-btn ${cat === categoriaAtual ? "ativo" : ""}"
            onclick="selecionarCategoriaTrabalho('${cat}')">
            📁 ${cat}
          </button>
        `).join("")}
      </div>
      <button type="button" class="tp-btn-atualizar" onclick="carregarArvoreTrabalhos(true)" title="Atualizar lista">
        🔄 Atualizar
      </button>
    </div>
  `;

  // Breadcrumb / Caminho atual
  html += `
    <div class="tp-breadcrumb" style="display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:10px 12px; background:#f4f6f9; border-radius:8px; margin-bottom:14px; font-size:0.95rem;">
      <button type="button" class="tp-crumb-link" onclick="irParaNivelTrabalho(-1)" style="background:none; border:none; color:#0b5ed7; font-weight:600; cursor:pointer; padding:0;">
        🏠 ${categoriaAtual}
      </button>
      ${caminhoNavegacao.map((pasta, idx) => `
        <span style="color:#6c757d;">/</span>
        <button type="button" class="tp-crumb-link" onclick="irParaNivelTrabalho(${idx})" style="background:none; border:none; color:${idx === caminhoNavegacao.length - 1 ? "#212529" : "#0b5ed7"}; font-weight:${idx === caminhoNavegacao.length - 1 ? "700" : "600"}; cursor:pointer; padding:0;">
          ${pasta.replace(/_/g, " ")}
        </button>
      `).join("")}
    </div>
  `;

  // Botão voltar se estiver dentro de alguma subpasta
  if (caminhoNavegacao.length > 0) {
    html += `
      <div style="margin-bottom:12px;">
        <button type="button" class="tp-btn-voltar" onclick="voltarPastaTrabalho()" style="padding:6px 12px; border-radius:6px; border:1px solid #ced4da; background:#fff; cursor:pointer; font-weight:600;">
          ⬅️ Voltar
        </button>
      </div>
    `;
  }

  // Lista de pastas e ficheiros
  if (itens.length === 0) {
    html += `
      <div class="tp-estado-vazio" style="padding:24px; text-align:center; background:#fff; border:1px dashed #ced4da; border-radius:10px; color:#6c757d;">
        <p style="margin:0;">📂 Esta pasta está vazia no momento.</p>
      </div>
    `;
  } else {
    html += `<div class="tp-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:12px;">`;

    for (const item of itens) {
      if (item.tipo === "dir") {
        const nomeExibicao = item.nome.replace(/_/g, " ");
        html += `
          <div class="tp-card tp-card-pasta"
               onclick="abrirPastaTrabalho('${item.nome.replace(/'/g, "\\'")}')"
               style="display:flex; align-items:center; gap:12px; padding:14px; background:#fff; border:1px solid #dee2e6; border-left:4px solid #f59e0b; border-radius:10px; cursor:pointer; transition:transform 0.15s ease, box-shadow 0.15s ease;">
            <span style="font-size:1.7rem;">📁</span>
            <div style="overflow:hidden;">
              <div style="font-weight:700; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${nomeExibicao}</div>
              <div style="font-size:0.82rem; color:#64748b;">Abrir pasta</div>
            </div>
          </div>
        `;
      } else {
        const urlFicheiro = RAW_GITHUB_BASE + codificarCaminhoGitHub(item.path);
        const icone = obterIconeFicheiro(item.nome);
        html += `
          <div class="tp-card tp-card-ficheiro"
               style="display:flex; flex-direction:column; justify-content:space-between; gap:10px; padding:14px; background:#fff; border:1px solid #dee2e6; border-left:4px solid #0d6efd; border-radius:10px;">
            <div style="display:flex; align-items:flex-start; gap:10px;">
              <span style="font-size:1.6rem;">${icone}</span>
              <div style="font-weight:600; color:#1e293b; word-break:break-word; font-size:0.95rem;">${item.nome}</div>
            </div>
            <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:4px;">
              <a href="${urlFicheiro}" target="_blank" rel="noopener noreferrer"
                 style="padding:6px 12px; background:#0d6efd; color:#fff; text-decoration:none; border-radius:6px; font-size:0.85rem; font-weight:600;">
                👁️ Abrir / Baixar
              </a>
            </div>
          </div>
        `;
      }
    }

    html += `</div>`;
  }

  container.innerHTML = html;
}

// Funções de navegação expostas globalmente
window.selecionarCategoriaTrabalho = function (categoria) {
  if (categoriaAtual === categoria && arvoreCompleta) {
    caminhoNavegacao = [];
    renderizarExploradorTrabalhos();
    return;
  }
  categoriaAtual = categoria;
  caminhoNavegacao = [];
  carregarArvoreTrabalhos(false);
};

window.abrirPastaTrabalho = function (nomePasta) {
  caminhoNavegacao.push(nomePasta);
  renderizarExploradorTrabalhos();
};

window.voltarPastaTrabalho = function () {
  if (caminhoNavegacao.length > 0) {
    caminhoNavegacao.pop();
    renderizarExploradorTrabalhos();
  }
};

window.irParaNivelTrabalho = function (indice) {
  if (indice < 0) {
    caminhoNavegacao = [];
  } else {
    caminhoNavegacao = caminhoNavegacao.slice(0, indice + 1);
  }
  renderizarExploradorTrabalhos();
};

window.carregarArvoreTrabalhos = carregarArvoreTrabalhos;
window.inicializarTrabalhos = function (categoriaInicial) {
  if (categoriaInicial && CATEGORIAS_TRABALHOS.includes(categoriaInicial)) {
    const mudouCategoria = categoriaAtual !== categoriaInicial;
    categoriaAtual = categoriaInicial;
    if (mudouCategoria) caminhoNavegacao = [];
  }
  if (!arvoreCompleta || (categoriaInicial && categoriaAtual !== categoriaInicial)) {
    carregarArvoreTrabalhos(false);
  } else {
    renderizarExploradorTrabalhos();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const secaoTrabalhosPraticos = document.getElementById("trabalhos-praticos");
  const secaoTrabalhosIndividuais = document.getElementById("trabalhos-individuais");
  const secaoTrabalhos = document.getElementById("trabalhos");

  if (secaoTrabalhosPraticos || secaoTrabalhosIndividuais || secaoTrabalhos) {
    carregarArvoreTrabalhos(false);
  }
});