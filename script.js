// ============================================================================
// 1. UTILITÁRIOS & OTIMIZAÇÕES DE DESEMPENHO
// ============================================================================

/**
 * Função de Debounce para limitar a frequência de execução de funções de alto custo (ex: resize).
 * @param {Function} func - Função a ser executada.
 * @param {number} wait - Tempo de espera em milissegundos.
 */
function debounce(func, wait = 150) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Detetor prático de dispositivos móveis global
const isMobile = () => window.innerWidth <= 768;


// ============================================================================
// 2. AJUSTE RESPONSIVO DE EQUAÇÕES MATEMÁTICAS (MATHJAX)
// ============================================================================

// Injeta estilos CSS para controlo de tamanho de fórmulas inline e em bloco
const estiloMathJax = document.createElement('style');
estiloMathJax.innerHTML = `
  /* Fórmulas inline mantêm 100% do tamanho do texto normal */
  mjx-container:not([display="true"]) {
    font-size: 100% !important;
    display: inline !important;
  }

  /* Fórmulas em bloco (display) */
  mjx-container[display="true"] {
    display: block !important;
    font-size: 100% !important;
    margin: 1em 0 !important;
    text-align: center !important;
  }
  mjx-container[display="true"] > mjx-math {
    display: inline-block !important;
    transition: transform 0.2s ease;
  }
`;
document.head.appendChild(estiloMathJax);

/**
 * Deteta e reduz equações em bloco que excedem a largura disponível do ecrã.
 */
function ajustarEquacoesLongas() {
  const equacoes = document.querySelectorAll('mjx-container[display="true"]');
  
  equacoes.forEach(eq => {
    const mathElem = eq.querySelector('mjx-math');
    if (!mathElem) return;

    // Reseta transformações anteriores para medição precisa
    mathElem.style.transform = 'none';
    mathElem.style.transformOrigin = 'center center';

    const larguraContainer = eq.clientWidth;
    const larguraEquacao = mathElem.scrollWidth;

    // Se a equação for mais larga que o container, escala até ao limite de 0.88 (-12%)
    if (larguraEquacao > larguraContainer && larguraContainer > 0) {
      const escalaNecessaria = larguraContainer / larguraEquacao;
      const escalaFinal = Math.max(escalaNecessaria, 0.88);

      mathElem.style.transform = `scale(${escalaFinal})`;
      eq.style.overflowX = 'auto';
      eq.style.overflowY = 'hidden';
    } else {
      eq.style.overflowX = 'visible';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.texto-livreAuto').forEach(el => {
    const blocos = el.innerHTML.trim().split(/\n\s*\n/);
    
    // Se o bloco estiver vazio (extra Enters), insere &nbsp; para forçar a linha
    el.innerHTML = blocos.map(b => `<p>${b.trim() || '&nbsp;'}</p>`).join('');
  });
});

// Configuração Global do MathJax v3
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
    enableMenu: false
  },
  chtml: {
    displayAlign: 'center',
    matchFontHeight: false
  },
  startup: {
    pageReady: () => {
      return MathJax.startup.defaultPageReady().then(() => {
        ajustarEquacoesLongas();
      });
    }
  }
};

/**
 * Re-processa o MathJax dinamicamente após troca de páginas/abas SPA.
 */
function atualizarMathJax() {
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise().then(() => {
      ajustarEquacoesLongas();
    });
  }
}

// Otimiza o evento de resize da janela com debounce
window.addEventListener('resize', debounce(ajustarEquacoesLongas, 150));


// ============================================================================
// 3. SUBSCRISÇÃO DE NEWSLETTER (EMAILJS)
// ============================================================================

// Variável de controlo para evitar envios repetidos
let aEnviar = false;

function subscreverNewsletter(event) {
  event.preventDefault();

  // Garante a inicialização do EmailJS
  if (typeof emailjs !== 'undefined') {
    emailjs.init("_TNiwsLN9rOmsCDwX");
  } else {
    alert("Erro ao carregar o serviço de e-mail. Por favor, recarregue a página.");
    return;
  }

  if (aEnviar) return;

  const emailInput = document.getElementById('newsletter-email');
  // Seleção direta do botão de submissão (evita falhas com event.target)
  const submitBtn = document.querySelector('.newsletter-btn');
  const emailValue = emailInput ? emailInput.value.trim() : '';

  if (!emailValue) return;

  // Ativa o bloqueio e desativa o botão imediatamente
  aEnviar = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'A enviar...'; // Feedback visual opcional
  }

  const templateParams = {
    email: emailValue,
    user_email: emailValue,
    name: 'Assinante'
  };

  emailjs.send('service_s9featq', 'template_iaalz8i', templateParams)
    .then(function () {
      alert(`Obrigado por se inscrever! Enviamos uma confirmação para: ${emailValue}`);
      if (emailInput) emailInput.value = '';
    })
    .catch(function (error) {
      alert('Ocorreu um erro ao subscrever. Por favor, tente novamente.');
      console.error('Erro EmailJS detalhado:', error);
    })
    .finally(function () {
      // Libera o estado do envio e reativa o botão
      aEnviar = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Subscrever';
      }
    });
}

// ============================================================================
// 4. TRADUÇÃO DINÂMICA (GOOGLE TRANSLATE) & IDIOMAS
// ============================================================================

/**
 * Callback de inicialização do widget do Google Translate.
 */
function googleTranslateElementInit() {
  new google.translate.TranslateElement({
    pageLanguage: 'pt',
    autoDisplay: false
  }, 'google_translate_element');
}

const idiomasMaisFalados = [
  { code: "pt", name: "Português" },
  { code: "en", name: "English" },
  { code: "zh-CN", name: "中文 (Mandarim)" },
  { code: "hi", name: "Hindi" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "ar", name: "العربية" },
  { code: "bn", name: "Bengali" },
  { code: "ru", name: "Русский" },
  { code: "ur", name: "Urdu" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "de", name: "Deutsch" },
  { code: "ja", name: "日本語" },
  { code: "mr", name: "Marathi" },
  { code: "te", name: "Telugu" },
  { code: "tr", name: "Türkçe" },
  { code: "ta", name: "Tamil" },
  { code: "it", name: "Italiano" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "tl", name: "Tagalog" }
];

function popularSelectoresIdioma() {
  const selectores = document.querySelectorAll('select:not(.goog-te-combo)');

  selectores.forEach(select => {
    if (!select) return;
    select.options.length = 0;

    idiomasMaisFalados.forEach(idioma => {
      const option = new Option(idioma.name, idioma.code);
      if (idioma.code === 'pt') option.selected = true;
      select.add(option);
    });

    select.onchange = (e) => trocarIdioma(e.target.value);
  });
}

window.trocarIdioma = function (codigoIdioma) {
  const selectores = document.querySelectorAll('select:not(.goog-te-combo)');
  selectores.forEach(select => select.value = codigoIdioma);

  document.documentElement.lang = codigoIdioma;

  const selectGoogle = document.querySelector('.goog-te-combo');
  if (selectGoogle) {
    selectGoogle.value = codigoIdioma;
    selectGoogle.dispatchEvent(new Event('change'));
  } else {
    setTimeout(() => trocarIdioma(codigoIdioma), 500);
  }
};


// ============================================================================
// 5. MODAL DE VISUALIZAÇÃO DE DOCUMENTOS (PDF / PREVIEW)
// ============================================================================

/**
 * Abre o modal nativo de pré-visualização de documentos/PDFs.
 * @param {string} pdfUrl - URL do documento.
 * @param {string} titulo - Título do documento.
 */
function abrirPreviewModal(pdfUrl, titulo) {
  let modal = document.getElementById('pdf-preview-modal');
  
  if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pdf-preview-modal';
      modal.innerHTML = `
          <div class="modal-overlay">
              <div class="modal-container">
                  <div class="modal-header">
                      <h3 id="modal-title"></h3>
                      <button class="modal-close-btn">&times;</button>
                  </div>
                  <div class="modal-body">
                      <iframe id="modal-iframe" src="" type="application/pdf" width="100%" height="100%" frameborder="0"></iframe>
                  </div>
              </div>
          </div>
      `;
      document.body.appendChild(modal);

      // Evento do botão fechar (X)
      modal.querySelector('.modal-close-btn').addEventListener('click', () => {
          modal.style.display = 'none';
          document.getElementById('modal-iframe').src = '';
      });

      // Fechar ao clicar no fundo escuro
      modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
          if (e.target === e.currentTarget) {
              modal.style.display = 'none';
              document.getElementById('modal-iframe').src = '';
          }
      });
  }

  document.getElementById('modal-title').textContent = titulo;
  document.getElementById('modal-iframe').src = pdfUrl;
  modal.style.display = 'block';
}


// ============================================================================
// 6. CICLO DE VIDA E LÓGICA DE INTERFACE (DOMCONTENTLOADED)
// ============================================================================

document.addEventListener("DOMContentLoaded", function () {

  // --------------------------------------------------------------------------
  // 6.1. INICIALIZAÇÕES BÁSICAS
  // --------------------------------------------------------------------------
  popularSelectoresIdioma();

  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', subscreverNewsletter);
  }

  // --------------------------------------------------------------------------
  // 6.2. MENU HAMBÚRGUER (MOBILE)
  // --------------------------------------------------------------------------
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navLinks = document.getElementById('navLinks');

  function fecharMenuMobileCompleto() {
    if (hamburgerBtn) hamburgerBtn.classList.remove('ativo');
    if (navLinks) navLinks.classList.remove('menu-aberto');

    document.querySelectorAll('.dropdown-content').forEach(sub => {
      sub.classList.remove('submenu-visivel');
      sub.style.display = 'none';
      setTimeout(() => sub.style.display = '', 200);
    });
  }

  if (hamburgerBtn && navLinks) {
    hamburgerBtn.addEventListener('click', () => {
      hamburgerBtn.classList.toggle('ativo');
      navLinks.classList.toggle('menu-aberto');
    });
  }

  // --------------------------------------------------------------------------
  // 6.3. GESTÃO DE MENU, DROPDOWNS E SUBMENUS
  // --------------------------------------------------------------------------

  // Seleciona todos os elementos de menu suspenso
  const dropdowns = document.querySelectorAll('.dropdown');

  /**
   * Remove a classe de visibilidade de todos os submenus dentro de um container.
   * @param {HTMLElement|Document} elemento - Elemento pai para buscar submenus.
   */
  function fecharSubmenusDescendentes(elemento) {
    if (!elemento) return;
    const submenus = elemento.querySelectorAll('.dropdown-content');
    submenus.forEach(content => {
      content.classList.remove('submenu-visivel');
    });
  }

  /**
   * Fecha todos os dropdowns abertos no documento.
   */
  function fecharTodosDropdowns() {
    fecharSubmenusDescendentes(document);
  }

  // Configura os eventos para cada dropdown
  dropdowns.forEach(dropdown => {
    
    // ------------------------------------------------------------------------
    // DESKTOP: Eventos de Passagem do Mouse (Hover / Mouseenter & Mouseleave)
    // ------------------------------------------------------------------------
    dropdown.addEventListener('mouseenter', function (e) {
      if (!isMobile()) {
        e.stopPropagation();

        // Limpa o foco ativo de cliques anteriores para evitar submenus "presos"
        if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
        }

        // Se for um menu de nível superior (raiz), fecha todos os outros menus abertos
        const ancestral = this.closest('.dropdown-content');
        if (!ancestral) {
          fecharTodosDropdowns();
        } else {
          // Se for um submenu interno, fecha apenas os submenus irmãos do mesmo nível
          const submenusIrmaos = ancestral.querySelectorAll('.dropdown-content');
          submenusIrmaos.forEach(sub => {
            if (!this.contains(sub)) {
              sub.classList.remove('submenu-visivel');
            }
          });
        }

        // Torna o submenu atual visível e ajusta a direção de abertura
        const submenuAtual = this.querySelector(':scope > .dropdown-content');
        if (submenuAtual) {
          submenuAtual.classList.add('submenu-visivel');

          // Reseta posições anteriores
          submenuAtual.classList.remove('abrir-esquerda', 'abrir-direita');

          // Cálculo dinâmico de espaço em tela (Evita transbordo nas margens)
          const rect = this.getBoundingClientRect();
          const larguraEstimadaSubmenu = 200;
          const espacoDisponivelDireita = window.innerWidth - rect.right;

          // Define se abre para a esquerda ou para a direita com base na margem
          if (espacoDisponivelDireita < larguraEstimadaSubmenu) {
            submenuAtual.classList.add('abrir-esquerda');
          } else {
            submenuAtual.classList.add('abrir-direita');
          }
        }
      }
    });

    // Desktop: Fecha submenus filhos quando o cursor sai do item pai
    dropdown.addEventListener('mouseleave', function () {
      if (!isMobile()) {
        fecharSubmenusDescendentes(this);
      }
    });

    // ------------------------------------------------------------------------
    // MOBILE & CLIQUE: Interação por Toque / Clique
    // ------------------------------------------------------------------------
    const linkPrincipal = dropdown.querySelector(':scope > a');
    if (linkPrincipal) {
      linkPrincipal.addEventListener('click', (e) => {
        const submenuAtual = dropdown.querySelector(':scope > .dropdown-content');

        if (submenuAtual && isMobile()) {
          e.preventDefault();
          e.stopPropagation();

          const estaAberto = submenuAtual.classList.contains('submenu-visivel');

          // Fecha os dropdowns irmãos do mesmo nível
          const pai = dropdown.parentElement;
          if (pai) {
            const irmaos = pai.querySelectorAll(':scope > .dropdown');
            irmaos.forEach(irmao => {
              if (irmao !== dropdown) {
                fecharSubmenusDescendentes(irmao);
              }
            });
          }

          // Alterna entre abrir o submenu ou navegar caso já esteja aberto
          if (!estaAberto) {
            submenuAtual.classList.add('submenu-visivel');
          } else {
            submenuAtual.classList.remove('submenu-visivel');

            const targetId = linkPrincipal.getAttribute("href");
            if (targetId && (targetId.startsWith("#") || targetId.startsWith("/"))) {
              navegarParaSecao(targetId);
              fecharMenuMobileCompleto();
            }
          }
        }
      });
    }
  });

  // --------------------------------------------------------------------------
  // NAVEGAÇÃO GERAL: Links Finais (Sem submenus)
  // --------------------------------------------------------------------------
  const todosLinks = document.querySelectorAll('.nav-links a');

  todosLinks.forEach(link => {
    link.addEventListener('click', () => {
      const temFilhos = link.parentElement.querySelector(':scope > .dropdown-content');
      
      // Se for um link direto (folha), fecha as estruturas de menu ativas
      if (!temFilhos) {
        if (isMobile()) {
          fecharMenuMobileCompleto();
        } else {
          fecharTodosDropdowns();
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 6.4. ANIMAÇÕES (CARROSSEL E NOTÍCIAS)
  // --------------------------------------------------------------------------
  const carouselList = document.getElementById('carousel-list');
  if (carouselList) {
    let animando = false;

    setInterval(() => {
      if (animando) return;

      const primeiroItem = carouselList.firstElementChild;
      if (!primeiroItem) return;

      const larguraItem = primeiroItem.offsetWidth;
      animando = true;

      carouselList.style.transition = 'transform 0.8s ease-in-out';
      carouselList.style.transform = `translateX(-${larguraItem}px)`;

      setTimeout(() => {
        carouselList.style.transition = 'none';
        carouselList.appendChild(primeiroItem);
        carouselList.style.transform = 'translateX(0)';
        animando = false;
      }, 800);

    }, 4000);
  }

  const newsList = document.getElementById('news-list');
  if (newsList) {
    setInterval(() => {
      const emPrimeiro = newsList.firstElementChild;
      if (!emPrimeiro) return;

      emPrimeiro.classList.add('saindo');

      setTimeout(() => {
        emPrimeiro.classList.remove('saindo');
        newsList.appendChild(emPrimeiro);

        const novoSexto = newsList.children[5];
        if (novoSexto) {
          novoSexto.classList.add('entrando');
          setTimeout(() => novoSexto.classList.remove('entrando'), 600);
        }
      }, 600);
    }, 8000);
  }

  // ============================================================================
  // 6.5. NAVEGAÇÃO SPA (SINGLE PAGE APPLICATION)
  // ============================================================================

  // Seleção dos elementos principais da interface para gestão de navegação
  const links = document.querySelectorAll(".nav-links a, .dropdown-content a");
  const seccoes = document.querySelectorAll(".conteudo-seccao");
  const carousel = document.querySelector(".carousel-container");
  const navProfile = document.querySelector(".nav-profile");

  // Mapeamento de secções fixas que compõem a Página Inicial
  const seccaoNoticias = document.getElementById("noticias");
  const seccaoContacto = document.getElementById("contato");
  const seccaoNewsletter = document.getElementById("newsletter");

  /**
   * Exibe os elementos padrão da página inicial e oculta as secções de conteúdo individual.
   */
  function mostrarPaginaInicial() {
    // Esconde todas as secções dinâmicas
    seccoes.forEach(seccao => seccao.classList.remove("ativo"));
    
    // Exibe o carrossel e os blocos fixos da Home
    if (carousel) carousel.classList.remove("escondido");
    if (seccaoNoticias) seccaoNoticias.classList.add("ativo");
    if (seccaoContacto) seccaoContacto.classList.add("ativo");
    if (seccaoNewsletter) seccaoNewsletter.classList.add("ativo");

    // Reseta a URL para a raiz da aplicação
    history.pushState(null, null, "/");
  }

  /**
   * Navega dinamicamente para uma secção específica sem recarregar a página.
   * @param {string} targetId - ID ou data-grupo da secção de destino (ex: "#estat-medidas").
   */
  function navegarParaSecao(targetId) {
    if (!targetId) return;

    // Remove caracteres especiais de rota ou ID (# e /)
    const idLimpo = targetId.replace('#', '').replace('/', '');
    if (!idLimpo) return;

    // Oculta o carrossel durante a visualização de uma secção individual
    if (carousel) carousel.classList.add("escondido");
    
    // Oculta todas as secções ativas no momento
    seccoes.forEach(seccao => seccao.classList.remove("ativo"));

    // Procura a secção pelo ID exato ou pelo atributo customizado data-grupo
    let seccaoAlvo = document.getElementById(idLimpo) || document.querySelector(`.conteudo-seccao[data-grupo="${idLimpo}"]`);
    
    if (seccaoAlvo) {
      // Exibe a secção encontrada e faz a rolagem suave até ela
      seccaoAlvo.classList.add("ativo");
      seccaoAlvo.scrollIntoView({ behavior: 'smooth' });
      
      // Re-processa equações MathJax presentes na nova secção visível
      atualizarMathJax();
    }

    // Atualiza o histórico de navegação do navegador (URL)
    const novaRota = '/' + idLimpo;
    if (window.location.pathname !== novaRota) {
      history.pushState(null, null, novaRota);
    }
  }

  // --------------------------------------------------------------------------
  // 6.5.1. NAVEGAÇÃO POR CARDS DA PÁGINA (.bloco-btn)
  // --------------------------------------------------------------------------
  const botoesCard = document.querySelectorAll('.bloco-btn');

  botoesCard.forEach(botao => {
    botao.addEventListener('click', (event) => {
      // Pega o id do data-target ou remove o '#' do href
      const destino = botao.dataset.target || botao.getAttribute('href');

      // Se o destino for apenas "#" ou estiver vazio, ignora para não quebrar a tela
      if (!destino || destino === '#') return;

      event.preventDefault();
      event.stopPropagation(); // Evita disparar o evento de outros escutadores da página

      navegarParaSecao(destino);
    });
  });
  // --------------------------------------------------------------------------
  // 6.5.2. NAVEGAÇÃO PELO MENU PRINCIPAL E SUBMENUS
  // --------------------------------------------------------------------------
  links.forEach(link => {
    link.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      
      // Intercepta apenas links de navegação interna (iniciados com # ou /)
      if (targetId && (targetId.startsWith("#") || targetId.startsWith("/"))) {
        e.preventDefault();
        e.stopPropagation();
        navegarParaSecao(targetId);
      }
    });
  });

  // Clique no logotipo/perfil para retornar à Página Inicial
  if (navProfile) {
    navProfile.addEventListener("click", function (e) {
      e.preventDefault();
      mostrarPaginaInicial();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // --------------------------------------------------------------------------
  // 6.5.3. GESTÃO DE HISTÓRICO E ROTA INICIAL (F5 / NAVEGAÇÃO DO BROWSER)
  // --------------------------------------------------------------------------
  function carregarEstadoInicialOuHash() {
    const caminhoOuHash = window.location.pathname.replace('/', '') || window.location.hash.replace('#', '');

    // Carrega a secção diretamente se houver uma rota válida na URL, senão carrega a Home
    if (caminhoOuHash && document.getElementById(caminhoOuHash)) {
      navegarParaSecao(caminhoOuHash);
    } else {
      mostrarPaginaInicial();
    }
  }

  // Executa a verificação ao carregar e sincroniza com os botões voltar/avançar do navegador
  carregarEstadoInicialOuHash();
  window.addEventListener("popstate", carregarEstadoInicialOuHash);

  // --------------------------------------------------------------------------
  // 6.6. SISTEMA DE PESQUISA INTERNA (MOBILE & DESKTOP)
  // --------------------------------------------------------------------------
  function executarPesquisa(termo) {
    const termoFormatado = termo.trim().toLowerCase();

    if (termoFormatado === "") {
      carregarEstadoInicialOuHash();
      return;
    }

    if (carousel) carousel.classList.add("escondido");

    seccoes.forEach(seccao => {
      const textoSecao = seccao.textContent.toLowerCase();
      if (textoSecao.includes(termoFormatado)) {
        seccao.classList.add("ativo");
      } else {
        seccao.classList.remove("ativo");
      }
    });
  }

  // Pesquisa Mobile
  const searchContainer = document.getElementById('searchContainer');
  const searchOpenBtn = document.getElementById('searchOpenBtn');
  const searchCloseBtn = document.getElementById('searchCloseBtn');
  const searchInput = document.getElementById('searchInput');
  const navHeader = document.querySelector('.nav-header');

  if (searchOpenBtn && searchContainer) {
    searchOpenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      searchContainer.classList.add('ativo');
      if (navHeader) navHeader.classList.add('search-active');
      if (searchInput) searchInput.focus();
    });

    document.addEventListener('click', (e) => {
      if (!searchContainer.contains(e.target)) {
        searchContainer.classList.remove('ativo');
        if (navHeader) navHeader.classList.remove('search-active');
      }
    });

    if (searchCloseBtn) {
      searchCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        searchContainer.classList.remove('ativo');
        if (navHeader) navHeader.classList.remove('search-active');
      });
    }

    searchContainer.addEventListener('click', (e) => e.stopPropagation());
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => executarPesquisa(e.target.value));
  }

  // Pesquisa Desktop
  const searchDesktopWrapper = document.getElementById('searchDesktopWrapper');
  const searchDesktopBtn = document.getElementById('searchDesktopBtn');
  const searchDesktopClose = document.getElementById('searchDesktopClose');
  const searchInputDesktop = document.getElementById('searchInputDesktop');

  if (searchDesktopBtn && searchDesktopWrapper) {
    searchDesktopBtn.addEventListener('click', (e) => {
      if (!isMobile()) {
        e.stopPropagation();
        searchDesktopWrapper.classList.add('ativo');
        if (searchInputDesktop) searchInputDesktop.focus();
      }
    });

    if (searchDesktopClose) {
      searchDesktopClose.addEventListener('click', (e) => {
        if (!isMobile()) {
          e.stopPropagation();
          searchDesktopWrapper.classList.remove('ativo');
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (!isMobile() && searchDesktopWrapper && !searchDesktopWrapper.contains(e.target)) {
        searchDesktopWrapper.classList.remove('ativo');
      }
    });

    searchDesktopWrapper.addEventListener('click', (e) => {
      if (!isMobile()) e.stopPropagation();
    });
  }

  if (searchInputDesktop) {
    searchInputDesktop.addEventListener('input', (e) => {
      if (!isMobile()) executarPesquisa(e.target.value);
    });
  }

  // --------------------------------------------------------------------------
  // 6.7. INTERCEPTADOR GLOBAL DE LINKS PDF / EMBED-LINK
  // --------------------------------------------------------------------------
  document.addEventListener('click', (event) => {
      const link = event.target.closest('.embed-link, a[href$=".pdf"]');
      
      if (link) {
          event.preventDefault();

          const docPath = link.getAttribute('data-doc') || link.getAttribute('href');
          const docTitle = link.getAttribute('data-title') || link.textContent.trim() || 'Visualizador de Documento';

          abrirPreviewModal(docPath, docTitle);
      }
  });

});