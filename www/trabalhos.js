/* ============================================================================
   TRABALHOS (INDIVIDUAIS E DE GRUPO) - LEITURA DIRETA NO GITHUB (ISOLADO) 
   ============================================================================ */

const TP_CONFIG = {
  owner: 'cienciasexactas',
  repo: 'cienciasexactas.github.io',
  branch: 'main',

  // Pasta raiz no mesmo diretório dos ficheiros do projeto principal
  pastaRaiz: 'Trabalhos',

  // Subpastas dentro de "Trabalhos"
  categorias: [
    { pasta: 'Trabalhos Individuais', titulo: 'Trabalhos Individuais' },
    { pasta: 'Trabalhos de Grupo', titulo: 'Trabalhos de Grupo' }
  ],

  containerId: 'trabalhos-praticos-container',
  ficheirosIgnorados: ['.gitkeep', '.keep', 'readme.md', 'index.html']
};

const TP_CODIGOS_CURSOS = {
  'biologia': 'L2BIO2026',
  'cienciasnaturais': 'CNA2026',
  'matematica': 'MAT2026',
  'economia': 'L5ECO2026',
  'gestao-empresa': 'GES2026',
  'gestao-iscgvsm': 'ISC2026',
  'enfermagem-a': 'ENFA2026',
  'enfermagem-b': 'CHEFEKATIA123',
  'contabilidade': 'CONT2026',
  'agronomia': 'AGR2026',
  'turismo': 'TUR2026',
  'geografia': 'GEO2026',
  'educacao-infancia': 'EDU2026'
};

// Aceita o ID interno ou o nome da pasta no GitHub (ex.: "Economia", "Biologia", "Gestão de Empresas")
const TP_CURSOS = [
  { id: 'economia', pastasGitHub: ['Economia', 'economia'], nome: 'Economia' },
  { id: 'biologia', pastasGitHub: ['Biologia', 'biologia'], nome: 'Biologia' },
  { id: 'gestao-empresa', pastasGitHub: ['Gestão de Empresas', 'Gestao de Empresas', 'gestao-empresa'], nome: 'Gestão de Empresas' },
  { id: 'cienciasnaturais', pastasGitHub: ['Ciências Naturais', 'cienciasnaturais'], nome: 'Ciências Naturais' },
  { id: 'matematica', pastasGitHub: ['Matemática', 'Matematica', 'matematica'], nome: 'Matemática' },
  { id: 'gestao-iscgvsm', pastasGitHub: ['Gestão - ISCSVSM', 'gestao-iscgvsm'], nome: 'Gestão - ISCSVSM' },
  { id: 'enfermagem-a', pastasGitHub: ['Enfermagem - A', 'enfermagem-a'], nome: 'Enfermagem - A' },
  { id: 'enfermagem-b', pastasGitHub: ['Enfermagem - B', 'enfermagem-b'], nome: 'Enfermagem - B' },
  { id: 'contabilidade', pastasGitHub: ['Contabilidade', 'contabilidade'], nome: 'Contabilidade' },
  { id: 'agronomia', pastasGitHub: ['Agronomia', 'agronomia'], nome: 'Agronomia' },
  { id: 'turismo', pastasGitHub: ['Turismo', 'turismo'], nome: 'Turismo' },
  { id: 'geografia', pastasGitHub: ['Geografia', 'geografia'], nome: 'Geografia' },
  { id: 'educacao-infancia', pastasGitHub: ['Educação de Infância', 'Educacao de Infancia', 'educacao-infancia'], nome: 'Educação de Infância' }
];

const TP_ANOS_LECTIVOS = ['2023-2024', '2024-2025', '2025-2026', '2026-2027'];

let tpCacheArvore = null;

function tpNormalizarChave(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tpEncontrarCurso(nomePastaCurso) {
  const chave = tpNormalizarChave(nomePastaCurso);
  const encontrado = TP_CURSOS.find(c =>
    tpNormalizarChave(c.id) === chave ||
    tpNormalizarChave(c.nome) === chave ||
    (c.pastasGitHub || []).some(p => tpNormalizarChave(p) === chave)
  );

  if (encontrado) {
    return {
      id: encontrado.id,
      nome: nomePastaCurso || encontrado.nome
    };
  }

  return {
    id: chave,
    nome: nomePastaCurso
  };
}

function tpFormatarTamanho(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const unidades = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + unidades[i];
}

function tpFormatarNomePasta(nomeBruto) {
  return nomeBruto.replace(/_/g, ' ');
}

function tpEhFicheiroValido(nomeFicheiro) {
  if (!nomeFicheiro) return false;
  if (nomeFicheiro.startsWith('.')) return false;
  return !TP_CONFIG.ficheirosIgnorados.includes(nomeFicheiro.toLowerCase());
}

function tpOrdenarFicheiros(lista) {
  const prefixosModelo = ['Modelo_', 'Template_', 'Enunciado_', 'Ficha_', 'Lista_', 'Base_', 'Dados_'];
  return [...lista].sort((a, b) => {
    const aModelo = prefixosModelo.some(p => a.nomeSimples.startsWith(p));
    const bModelo = prefixosModelo.some(p => b.nomeSimples.startsWith(p));
    if (aModelo && !bModelo) return -1;
    if (!aModelo && bModelo) return 1;
    return a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' });
  });
}

async function tpObterArvoreGitHub(forcarAtualizacao = false) {
  if (tpCacheArvore && !forcarAtualizacao) {
    return tpCacheArvore;
  }

  const { owner, repo, branch } = TP_CONFIG;
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;

  const resposta = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' }
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao consultar GitHub API (${resposta.status})`);
  }

  const dados = await resposta.json();
  tpCacheArvore = Array.isArray(dados.tree) ? dados.tree : [];
  return tpCacheArvore;
}

/**
 * Mapeia:
 * estrutura[categoriaPasta][cursoChave][anoLectivo][nomePastaTrabalho] = {
 *   cursoInfo: { id, nome },
 *   ficheiros: [ ... ]
 * }
 *
 * Caminho esperado no GitHub:
 * Trabalhos/<Trabalhos Individuais | Trabalhos de Grupo>/<Curso>/<Ano Lectivo>/<Nome da Pasta>/<ficheiro>
 */
function tpExtrairEstrutura(arvore) {
  const raiz = TP_CONFIG.pastaRaiz.replace(/^\/+|\/+$/g, '');
  const estrutura = {};

  for (const cat of TP_CONFIG.categorias) {
    estrutura[cat.pasta] = {};
  }

  for (const no of arvore) {
    if (!no.path.startsWith(raiz + '/')) continue;

    const rel = no.path.slice(raiz.length + 1);
    const partes = rel.split('/');

    // partes[0] = Categoria ("Trabalhos Individuais" / "Trabalhos de Grupo")
    // partes[1] = Curso ("Economia", "Biologia", "Gestão de Empresas", etc.)
    // partes[2] = Ano Lectivo ("2026-2027", etc.)
    // partes[3] = Nome da pasta criada manualmente dentro do Ano Lectivo
    // partes[4+] = Ficheiro(s) dentro da pasta
    if (partes.length < 4) continue;

    const [categoriaPasta, nomeCursoPasta, anoLectivo, nomePastaTrabalho, ...restoCaminho] = partes;
    if (!estrutura[categoriaPasta]) continue;

    const cursoInfo = tpEncontrarCurso(nomeCursoPasta);
    const cursoChave = cursoInfo.id;

    if (!estrutura[categoriaPasta][cursoChave]) {
      estrutura[categoriaPasta][cursoChave] = {
        cursoInfo,
        anos: {}
      };
    }

    if (!estrutura[categoriaPasta][cursoChave].anos[anoLectivo]) {
      estrutura[categoriaPasta][cursoChave].anos[anoLectivo] = {};
    }

    if (!estrutura[categoriaPasta][cursoChave].anos[anoLectivo][nomePastaTrabalho]) {
      estrutura[categoriaPasta][cursoChave].anos[anoLectivo][nomePastaTrabalho] = [];
    }

    // Se for um ficheiro válido (blob), regista-o; se for apenas pasta vazia (tree), deixa array vazio para ficar bloqueada
    if (no.type === 'blob' && restoCaminho.length >= 1) {
      const nomeFicheiro = restoCaminho[restoCaminho.length - 1];
      if (tpEhFicheiroValido(nomeFicheiro)) {
        const urlDownload = `https://raw.githubusercontent.com/${TP_CONFIG.owner}/${TP_CONFIG.repo}/${TP_CONFIG.branch}/${encodeURI(no.path)}`;
        estrutura[categoriaPasta][cursoChave].anos[anoLectivo][nomePastaTrabalho].push({
          nome: restoCaminho.join('/'),
          nomeSimples: nomeFicheiro,
          caminho: no.path,
          tamanho: no.size || 0,
          url: urlDownload
        });
      }
    }
  }

  return estrutura;
}

async function carregarTrabalhosPraticos(forcarAtualizacao = false) {
  const container = document.getElementById(TP_CONFIG.containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="tp-seccao">
      <div class="tp-header">
        <h2 class="tp-titulo">Trabalhos</h2>
        <div class="tp-acoes-topo">
          <button type="button" class="tp-btn tp-btn-secundario" id="tp-btn-atualizar">Atualizar Pastas</button>
        </div>
      </div>
      <p class="tp-vazio">A carregar estrutura de "${TP_CONFIG.pastaRaiz}" no GitHub...</p>
    </div>
  `;

  let estrutura;
  try {
    const arvore = await tpObterArvoreGitHub(forcarAtualizacao);
    estrutura = tpExtrairEstrutura(arvore);
  } catch (erro) {
    console.error('Erro ao ler a pasta Trabalhos no GitHub:', erro);
    container.innerHTML = `
      <div class="tp-seccao">
        <div class="tp-header">
          <h2 class="tp-titulo">Trabalhos</h2>
        </div>
        <div class="tp-erro">
          Não foi possível carregar os trabalhos a partir do GitHub. Verifique a ligação ou tente novamente.
        </div>
      </div>
    `;
    return;
  }

  const seccaoEl = document.createElement('div');
  seccaoEl.className = 'tp-seccao';

  const headerEl = document.createElement('div');
  headerEl.className = 'tp-header';
  headerEl.innerHTML = `
    <h2 class="tp-titulo">Trabalhos</h2>
    <div class="tp-acoes-topo">
      <button type="button" class="tp-btn tp-btn-secundario" id="tp-btn-atualizar">Atualizar Pastas</button>
    </div>
  `;
  seccaoEl.appendChild(headerEl);

  let totalPastas = 0;

  for (const categoria of TP_CONFIG.categorias) {
    const mapaCursosCat = estrutura[categoria.pasta] || {};
    const chavesCursos = Object.keys(mapaCursosCat);

    const blocoCat = document.createElement('div');
    blocoCat.className = 'tp-bloco-categoria';

    const h2Cat = document.createElement('h3');
    h2Cat.className = 'tp-categoria-titulo';
    h2Cat.textContent = categoria.titulo;
    blocoCat.appendChild(h2Cat);

    let catTemPastas = false;

    for (const chaveCurso of chavesCursos.sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }))) {
      const blocoCursoDados = mapaCursosCat[chaveCurso];
      const cursoInfo = blocoCursoDados.cursoInfo;
      const anosMap = blocoCursoDados.anos || {};
      const anosOrdenados = Object.keys(anosMap).sort();

      const divCurso = document.createElement('div');
      divCurso.className = 'tp-bloco-curso';

      const h4Curso = document.createElement('h4');
      h4Curso.className = 'tp-curso-titulo';
      h4Curso.textContent = `Curso: ${cursoInfo.nome}`;
      divCurso.appendChild(h4Curso);

      let cursoTemPastas = false;

      for (const ano of anosOrdenados) {
        const pastasDoAno = anosMap[ano] || {};
        const nomesPastas = Object.keys(pastasDoAno).sort((a, b) =>
          a.localeCompare(b, 'pt', { sensitivity: 'base' })
        );

        if (nomesPastas.length === 0) continue;

        cursoTemPastas = true;
        catTemPastas = true;
        totalPastas += nomesPastas.length;

        const divAno = document.createElement('div');
        divAno.className = 'tp-bloco-ano';

        const pAno = document.createElement('p');
        pAno.className = 'tp-ano-label';
        pAno.innerHTML = `<strong>Ano Lectivo:</strong> ${ano}`;
        divAno.appendChild(pAno);

        const gridPastas = document.createElement('div');
        gridPastas.className = 'tp-grid-pastas';

        for (const nomePasta of nomesPastas) {
          const ficheiros = pastasDoAno[nomePasta] || [];
          const temFicheiros = ficheiros.length > 0;

          const card = document.createElement('div');
          card.className = temFicheiros ? 'tp-card-pasta' : 'tp-card-pasta tp-bloqueada';
          card.setAttribute('role', 'button');
          card.setAttribute('tabindex', temFicheiros ? '0' : '-1');
          card.setAttribute('aria-disabled', temFicheiros ? 'false' : 'true');

          const icone = temFicheiros ? '📁' : '🔒';
          const badgeEstado = temFicheiros
            ? `<span class="tp-estado-pasta tp-estado-disponivel">${ficheiros.length} ficheiro(s)</span>`
            : `<span class="tp-estado-pasta tp-estado-bloqueado">Bloqueada (sem ficheiros)</span>`;

          const dica = temFicheiros
            ? 'Aceder com código da Turma'
            : 'Aguarda ficheiros no GitHub';

          card.innerHTML = `
            <div class="tp-icone-pasta">${icone}</div>
            <div class="tp-nome-pasta">${tpFormatarNomePasta(nomePasta)}</div>
            ${badgeEstado}
            <span class="tp-meta-pasta">${dica}</span>
          `;

          if (temFicheiros) {
            const abrirComCodigo = () => {
              tpSolicitarCodigoEAbrirPasta(
                categoria.titulo,
                cursoInfo,
                ano,
                nomePasta,
                tpOrdenarFicheiros(ficheiros),
                seccaoEl
              );
            };

            card.addEventListener('click', abrirComCodigo);
            card.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                abrirComCodigo();
              }
            });
          } else {
            card.addEventListener('click', (e) => {
              e.preventDefault();
              alert(`A pasta "${tpFormatarNomePasta(nomePasta)}" encontra-se bloqueada enquanto não tiver ficheiros no GitHub.`);
            });
          }

          gridPastas.appendChild(card);
        }

        divAno.appendChild(gridPastas);
        divCurso.appendChild(divAno);
      }

      if (cursoTemPastas) {
        blocoCat.appendChild(divCurso);
      }
    }

    if (!catTemPastas) {
      const pVazioCat = document.createElement('p');
      pVazioCat.className = 'tp-vazio';
      pVazioCat.textContent = `Sem pastas criadas em "${TP_CONFIG.pastaRaiz}/${categoria.pasta}" no GitHub.`;
      blocoCat.appendChild(pVazioCat);
    }

    seccaoEl.appendChild(blocoCat);
  }

  if (totalPastas === 0) {
    const avisoGeral = document.createElement('p');
    avisoGeral.className = 'tp-vazio';
    avisoGeral.textContent = `Nenhuma pasta encontrada dentro de "${TP_CONFIG.pastaRaiz}". Crie as pastas manualmente no GitHub seguindo: ${TP_CONFIG.pastaRaiz}/<Trabalhos Individuais | Trabalhos de Grupo>/<Curso>/<Ano Lectivo>/<Nome da Pasta>.`;
    seccaoEl.appendChild(avisoGeral);
  }

  container.innerHTML = '';
  container.appendChild(seccaoEl);

  const btnAtualizar = document.getElementById('tp-btn-atualizar');
  if (btnAtualizar) {
    btnAtualizar.addEventListener('click', () => carregarTrabalhosPraticos(true));
  }
}

function tpSolicitarCodigoEAbrirPasta(categoriaTitulo, cursoInfo, anoLectivo, nomePasta, ficheiros, seccaoEl) {
  const codigoEsperado = TP_CODIGOS_CURSOS[cursoInfo.id];
  const nomeVisivelPasta = tpFormatarNomePasta(nomePasta);

  if (!codigoEsperado) {
    alert('Código de acesso não configurado para este curso.');
    return;
  }

  const codigoInformado = prompt(
    `Introduza o código de acesso para visualizar "${nomeVisivelPasta}" (${categoriaTitulo} - ${cursoInfo.nome} - ${anoLectivo}):`
  );

  if (codigoInformado === null) return;

  if (codigoInformado.trim() !== codigoEsperado) {
    alert('Código de acesso incorreto! Acesso negado.');
    return;
  }

  tpRenderizarFicheirosPasta(categoriaTitulo, cursoInfo, anoLectivo, nomePasta, ficheiros, seccaoEl);
}

function tpRenderizarFicheirosPasta(categoriaTitulo, cursoInfo, anoLectivo, nomePasta, ficheiros, seccaoEl) {
  const nomeVisivelPasta = tpFormatarNomePasta(nomePasta);
  const prefixosModelo = ['Modelo_', 'Template_', 'Enunciado_', 'Ficha_', 'Lista_', 'Base_', 'Dados_'];

  seccaoEl.innerHTML = `
    <div class="tp-header">
      <h2 class="tp-titulo">${categoriaTitulo} — ${nomeVisivelPasta}</h2>
      <div class="tp-acoes-topo">
        <button type="button" class="tp-btn tp-btn-secundario" id="tp-btn-voltar">← Voltar</button>
      </div>
    </div>
    <p class="tp-ano-label">
      <strong>Curso:</strong> ${cursoInfo.nome} |
      <strong>Ano Lectivo:</strong> ${anoLectivo} |
      <strong>Pasta:</strong> ${nomeVisivelPasta}
    </p>
  `;

  const btnVoltar = document.getElementById('tp-btn-voltar');
  if (btnVoltar) {
    btnVoltar.addEventListener('click', () => carregarTrabalhosPraticos(false));
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'tp-tabela-wrapper';

  const tabela = document.createElement('table');
  tabela.className = 'tp-tabela';
  tabela.innerHTML = `
    <thead>
      <tr>
        <th style="width: 65%;">Nome do Ficheiro</th>
        <th style="width: 20%;">Tipo</th>
        <th style="width: 15%;">Tamanho</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = tabela.querySelector('tbody');

  for (const arq of ficheiros) {
    const isModelo = prefixosModelo.some(p => arq.nomeSimples.startsWith(p));
    const tr = document.createElement('tr');
    const badge = isModelo ? '<span class="tp-badge-modelo">Modelo / Apoio</span>' : '';
    const tipoTexto = isModelo ? 'Material de Apoio' : 'Ficheiro da Pasta';

    tr.innerHTML = `
      <td>
        ${badge}
        <a class="tp-link-ficheiro" href="${arq.url}" target="_blank" rel="noopener noreferrer">
          ${arq.nome}
        </a>
      </td>
      <td>${tipoTexto}</td>
      <td>${tpFormatarTamanho(arq.tamanho)}</td>
    `;

    tbody.appendChild(tr);
  }

  wrapper.appendChild(tabela);
  seccaoEl.appendChild(wrapper);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById(TP_CONFIG.containerId)) {
    carregarTrabalhosPraticos(false);
  }
});