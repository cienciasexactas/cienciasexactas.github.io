    // SCRIPT DE SUBSCRIÇÃO DA NEWSLETTER -->

    function subscreverNewsletter(event) {
    event.preventDefault();

    const emailInput = document.getElementById('newsletter-email');
    const email = emailInput.value;

    // Dados que serão enviados para o modelo de e-mail
    const templateParams = {
        user_email: email
    };

    // Envia o e-mail usando o EmailJS
    emailjs.send('SEU_SERVICE_ID', 'SEU_TEMPLATE_ID', templateParams)
        .then(function(response) {
            alert(`Obrigado por se inscrever! Enviamos uma confirmação para: ${email}`);
            emailInput.value = '';
        }, function(error) {
            alert('Ocorreu um erro ao subscrever. Por favor, tente novamente.');
            console.error('Erro EmailJS:', error);
        });
    }
    

    // SCRIPT DE NAVEGAÇÃO, ANIMAÇÕES E SUBMENUS DINÂMICOS -->

    document.addEventListener("DOMContentLoaded", function () {
        const links = document.querySelectorAll(".nav-links a, .dropdown-content a");
        const seccoes = document.querySelectorAll(".conteudo-seccao");
        const carousel = document.querySelector(".carousel-container");
        const navProfile = document.querySelector(".nav-profile");

        const seccaoNoticias = document.getElementById("noticias");
        const seccaoContacto = document.getElementById("contato");
        const carouselList = document.getElementById('carousel-list');
        const newsList = document.getElementById('news-list');

        // ==========================================
        // 1. AJUSTE E COMPORTAMENTO DOS SUBMENUS (WEB + MOBILE)
        // ==========================================
        const dropdowns = document.querySelectorAll('.dropdown');
        let ultimoMenuClicado = null;

        // Oculta/fecha temporariamente todos os dropdowns no Web e Mobile
        function fecharTodosDropdowns() {
            const conteudosDropdown = document.querySelectorAll('.dropdown-content');
            conteudosDropdown.forEach(content => {
                content.style.pointerEvents = 'none';
                content.style.opacity = '0';
                content.style.visibility = 'hidden';
            });

            // Restaura a visibilidade original após a animação de saída/transição
            setTimeout(() => {
                conteudosDropdown.forEach(content => {
                    content.style.removeProperty('pointer-events');
                    content.style.removeProperty('opacity');
                    content.style.removeProperty('visibility');
                });
            }, 300);
        }

        dropdowns.forEach(dropdown => {
            // Ajuste automático para abertura à esquerda caso saia do ecrã (Desktop)
            dropdown.addEventListener('mouseenter', function () {
                const submenu = this.querySelector(':scope > .dropdown-content');
                if (!submenu) return;

                submenu.classList.remove('abrir-esquerda');
                const rect = submenu.getBoundingClientRect();

                const espacoDisponivelDireita = window.innerWidth - rect.right;
                if (espacoDisponivelDireita < 10) { 
                    submenu.classList.add('abrir-esquerda');
                }
            });

            // Lógica para fechar ao clicar 2 vezes no mesmo nível (Web e Mobile)
            const linkPrincipal = dropdown.querySelector(':scope > a');
            if (linkPrincipal) {
                linkPrincipal.addEventListener('click', (e) => {
                    if (ultimoMenuClicado === dropdown) {
                        fecharTodosDropdowns();
                        ultimoMenuClicado = null;
                    } else {
                        ultimoMenuClicado = dropdown;
                    }
                });
            }
        });

        // Oculta ao clicar nos links do último nível (itens sem submenus abaixo)
        const linksFinais = document.querySelectorAll('.dropdown-content a:not(.dropdown > a)');
        linksFinais.forEach(link => {
            link.addEventListener('click', () => {
                fecharTodosDropdowns();
                ultimoMenuClicado = null;
            });
        });


        // ==========================================
        // 2. ROTAÇÃO DO CARROSSEL PRINCIPAL
        // ==========================================
        if (carouselList) {
            setInterval(() => {
                const itemWidth = carouselList.firstElementChild ? carouselList.firstElementChild.offsetWidth : 0;
                if (!itemWidth) return;

                const maxScroll = carouselList.scrollWidth - carouselList.clientWidth;

                if (carouselList.scrollLeft >= maxScroll - 5) {
                    carouselList.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    carouselList.scrollBy({ left: itemWidth, behavior: 'smooth' });
                }
            }, 4000);
        }


        // ==========================================
        // 3. ROTAÇÃO DA GRELHA DE NOTÍCIAS
        // ==========================================
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


        // ==========================================
        // 4. NAVEGAÇÃO E VISIBILIDADE DE SECÇÕES
        // ==========================================
        function mostrarPaginaInicial() {
            seccoes.forEach(seccao => seccao.classList.remove("ativo"));
            if (carousel) carousel.classList.remove("escondido");
            if (seccaoNoticias) seccaoNoticias.classList.add("ativo");
            if (seccaoContacto) seccaoContacto.classList.add("ativo");
            history.pushState(null, null, window.location.pathname);
        }

        function navegarParaSecao(targetId) {
            if (!targetId || !targetId.startsWith("#")) return;

            // 1. Esconde o carrossel se existir
            if (carousel) carousel.classList.add("escondido");

            // 2. ESCONDE TUDO (Pai e Filhos)
            seccoes.forEach(seccao => seccao.classList.remove("ativo"));

            // 3. MOSTRA E ROLA APENAS PARA O MENU CLICADO
            const seccaoAlvo = document.querySelector(targetId);
            if (seccaoAlvo) {
                seccaoAlvo.classList.add("ativo"); // Ativa APENAS esta secção
                seccaoAlvo.scrollIntoView({ behavior: 'smooth' }); // Rola suavemente
            }

            // 4. Atualiza o link no navegador
            if (window.location.hash !== targetId) {
                history.pushState(null, null, targetId);
            }
        }

        links.forEach(link => {
            link.addEventListener("click", function (e) {
                const targetId = this.getAttribute("href");
                if (targetId && targetId.startsWith("#")) {
                    e.preventDefault();
                    navegarParaSecao(targetId);
                }
            });
        });

        if (navProfile) {
            navProfile.addEventListener("click", function (e) {
                e.preventDefault();
                mostrarPaginaInicial();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        function carregarEstadoInicialOuHash() {
            const hash = window.location.hash;
            if (hash && document.querySelector(hash)) {
                navegarParaSecao(hash);
            } else {
                mostrarPaginaInicial();
            }
        }

        carregarEstadoInicialOuHash();
        window.addEventListener("popstate", carregarEstadoInicialOuHash);
    });

    // SCRIPT DE NAVEGAÇÃO, ANIMAÇÕES E SUBMENUS DINÂMICOS

        document.addEventListener("DOMContentLoaded", function () {
            const isMobile = () => window.innerWidth <= 768;

            // ==========================================
            // DATA: LISTA DOS 20 IDIOMAS SUPORTADOS PELO GOOGLE TRANSLATE
            // ==========================================
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
                // Seleciona APENAS os seus selects (ignora o combo oculto do Google)
                const selectores = document.querySelectorAll('select:not(.goog-te-combo)');
                
                selectores.forEach(select => {
                    if (!select) return;
                    
                    select.options.length = 0;

                    idiomasMaisFalados.forEach(idioma => {
                        const option = new Option(idioma.name, idioma.code);
                        if (idioma.code === 'pt') {
                            option.selected = true;
                        }
                        select.add(option);
                    });

                    // Adiciona o listener uma única vez para evitar loops
                    select.onchange = (e) => {
                        trocarIdioma(e.target.value);
                    };
                });
            }

            window.trocarIdioma = function(codigoIdioma) {
                console.log("Idioma selecionado:", codigoIdioma);

                // Atualiza o valor visual de todos os selects customizados sem disparar o evento onchange novamente
                const selectores = document.querySelectorAll('select:not(.goog-te-combo)');
                selectores.forEach(select => {
                    select.value = codigoIdioma;
                });

                document.documentElement.lang = codigoIdioma;

                // Envia a ordem para o elemento oculto do Google Translate
                const selectGoogle = document.querySelector('.goog-te-combo');
                if (selectGoogle) {
                    selectGoogle.value = codigoIdioma;
                    selectGoogle.dispatchEvent(new Event('change'));
                } else {
                    // Tenta novamente caso o script do Google ainda esteja a carregar
                    setTimeout(() => trocarIdioma(codigoIdioma), 500);
                }
            };

            popularSelectoresIdioma();
            
            // ==========================================
            // 0. MENU HAMBÚRGUER (MOBILE)
            // ==========================================
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

            // ==========================================
            // ELEMENTOS PRINCIPAIS DA PÁGINA
            // ==========================================
            const links = document.querySelectorAll(".nav-links a, .dropdown-content a");
            const seccoes = document.querySelectorAll(".conteudo-seccao");
            const carousel = document.querySelector(".carousel-container");
            const navProfile = document.querySelector(".nav-profile");

            const seccaoNoticias = document.getElementById("noticias");
            const seccaoContacto = document.getElementById("contato");
            const carouselList = document.getElementById('carousel-list');
            const newsList = document.getElementById('news-list');

            // ==========================================
            // 1. GESTÃO DINÂMICA DE SUBMENUS (WEB + MOBILE)
            // ==========================================
            const dropdowns = document.querySelectorAll('.dropdown');

            function fecharSubmenusDescendentes(elemento) {
                if (!elemento) return;
                
                const linkAtivo = elemento.querySelector('a:focus');
                if (linkAtivo) linkAtivo.blur();

                const submenus = elemento.querySelectorAll('.dropdown-content');
                submenus.forEach(content => {
                    content.style.pointerEvents = 'none';
                    content.style.opacity = '0';
                    content.style.visibility = 'hidden';
                    content.style.display = 'none';
                });

                setTimeout(() => {
                    submenus.forEach(content => {
                        content.style.removeProperty('pointer-events');
                        content.style.removeProperty('opacity');
                        content.style.removeProperty('visibility');
                        content.style.removeProperty('display');
                    });
                }, 150);
            }

            function fecharTodosDropdowns() {
                fecharSubmenusDescendentes(document);
            }

            let cliqueTimer = null;
            let contadorCliques = 0;
            let ultimoMenuClicado = null;
            const JANELA_TEMPO_DUPLO_CLIQUE = 1000;

            dropdowns.forEach(dropdown => {
                dropdown.addEventListener('mouseenter', function (e) {
                    if (!isMobile()) {
                        e.stopPropagation();

                        const pai = this.parentElement;
                        if (pai) {
                            const irmaos = pai.querySelectorAll(':scope > .dropdown');
                            irmaos.forEach(irmao => {
                                if (irmao !== this) {
                                    fecharSubmenusDescendentes(irmao);
                                }
                            });
                        }

                        const submenuAtual = this.querySelector(':scope > .dropdown-content');
                        if (submenuAtual) {
                            submenuAtual.style.removeProperty('display');
                            submenuAtual.style.removeProperty('opacity');
                            submenuAtual.style.removeProperty('visibility');
                            submenuAtual.style.removeProperty('pointer-events');

                            submenuAtual.classList.remove('abrir-esquerda');
                            const rect = submenuAtual.getBoundingClientRect();
                            const espacoDisponivelDireita = window.innerWidth - rect.right;
                            if (espacoDisponivelDireita < 10) { 
                                submenuAtual.classList.add('abrir-esquerda');
                            }
                        }
                    }
                });

                const linkPrincipal = dropdown.querySelector(':scope > a');
                if (linkPrincipal) {
                    linkPrincipal.addEventListener('click', (e) => {
                        const submenuAtual = dropdown.querySelector(':scope > .dropdown-content');

                        if (submenuAtual) {
                            e.preventDefault();
                            e.stopPropagation();

                            if (ultimoMenuClicado !== dropdown) {
                                clearTimeout(cliqueTimer);
                                contadorCliques = 0;
                                ultimoMenuClicado = dropdown;
                            }

                            contadorCliques++;

                            if (contadorCliques === 1) {
                                if (isMobile()) {
                                    const pai = dropdown.parentElement;
                                    if (pai) {
                                        const irmaos = pai.querySelectorAll(':scope > .dropdown');
                                        irmaos.forEach(irmao => {
                                            if (irmao !== dropdown) {
                                                const submenusIrmao = irmao.querySelectorAll('.dropdown-content');
                                                submenusIrmao.forEach(sub => sub.classList.remove('submenu-visivel'));
                                            }
                                        });
                                    }
                                    submenuAtual.classList.toggle('submenu-visivel');
                                }

                                cliqueTimer = setTimeout(() => {
                                    contadorCliques = 0;
                                }, JANELA_TEMPO_DUPLO_CLIQUE);

                            } else if (contadorCliques === 2) {
                                clearTimeout(cliqueTimer);
                                contadorCliques = 0;

                                const targetId = linkPrincipal.getAttribute("href");
                                if (targetId && targetId.startsWith("#")) {
                                    navegarParaSecao(targetId);
                                }

                                if (isMobile()) {
                                    fecharMenuMobileCompleto();
                                } else {
                                    fecharTodosDropdowns();
                                }
                            }
                        }
                    });
                }
            });

            const todosLinks = document.querySelectorAll('.nav-links a');
            todosLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    const temFilhos = link.parentElement.querySelector(':scope > .dropdown-content');
                    if (!temFilhos) {
                        if (isMobile()) {
                            fecharMenuMobileCompleto();
                        } else {
                            fecharTodosDropdowns();
                        }
                    }
                });
            });

            // ==========================================
            // 2. ROTAÇÃO DO CARROSSEL
            // ==========================================
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

            // ==========================================
            // 3. ROTAÇÃO DA GRELHA DE NOTÍCIAS
            // ==========================================
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

            // ==========================================
            // 4. NAVEGAÇÃO E VISIBILIDADE DE SECÇÕES
            // ==========================================
            function mostrarPaginaInicial() {
                seccoes.forEach(seccao => seccao.classList.remove("ativo"));
                if (carousel) carousel.classList.remove("escondido");
                if (seccaoNoticias) seccaoNoticias.classList.add("ativo");
                if (seccaoContacto) seccaoContacto.classList.add("ativo");
                history.pushState(null, null, window.location.pathname);
            }

            function navegarParaSecao(targetId) {
                if (!targetId || !targetId.startsWith("#")) return;

                if (carousel) carousel.classList.add("escondido");
                
                // 1. Oculta todas as secções (incluindo os filhos)
                seccoes.forEach(seccao => seccao.classList.remove("ativo"));

                // 2. Procura e ativa APENAS a secção exata do menu clicado
                const seccaoAlvo = document.querySelector(targetId);
                if (seccaoAlvo) {
                    seccaoAlvo.classList.add("ativo"); // Ativa somente esta secção
                    seccaoAlvo.scrollIntoView({ behavior: 'smooth' }); // Rola suavemente até ela
                }

                if (window.location.hash !== targetId) {
                    history.pushState(null, null, targetId);
                }
            }

            links.forEach(link => {
                link.addEventListener("click", function (e) {
                    const targetId = this.getAttribute("href");
                    if (targetId && targetId.startsWith("#")) {
                        e.preventDefault();
                        navegarParaSecao(targetId);
                    }
                });
            });

            if (navProfile) {
                navProfile.addEventListener("click", function (e) {
                    e.preventDefault();
                    mostrarPaginaInicial();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            }

            function carregarEstadoInicialOuHash() {
                const hash = window.location.hash;
                if (hash && document.querySelector(hash)) {
                    navegarParaSecao(hash);
                } else {
                    mostrarPaginaInicial();
                }
            }

            carregarEstadoInicialOuHash();
            window.addEventListener("popstate", carregarEstadoInicialOuHash);

            // ==========================================
            // 5. CONTROLO E LÓGICA DE PESQUISA
            // ==========================================
            function executarPesquisa(termo) {
                const termoFormatado = termo.trim().toLowerCase();

                if (termoFormatado === "") {
                    carregarEstadoInicialOuHash();
                    return;
                }

                if (carousel) carousel.classList.add("escondido");

                let encontrouResultados = false;

                seccoes.forEach(seccao => {
                    const textoSecao = seccao.textContent.toLowerCase();
                    
                    if (textoSecao.includes(termoFormatado)) {
                        seccao.classList.add("ativo");
                        encontrouResultados = true;
                    } else {
                        seccao.classList.remove("ativo");
                    }
                });

                if (!encontrouResultados) {
                    console.log("Nenhum resultado encontrado para: " + termo);
                }
            }

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

                searchContainer.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    executarPesquisa(e.target.value);
                });
            }

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
                    if (!isMobile()) {
                        e.stopPropagation();
                    }
                });
            }

            if (searchInputDesktop) {
                searchInputDesktop.addEventListener('input', (e) => {
                    if (!isMobile()) {
                        executarPesquisa(e.target.value);
                    }
                });
            }
        });


    <!-- ========================================================== -->
    <!-- MOTOR GOOGLE TRANSLATE (PÁGINA BASE CONFIGURADA PARA 'pt') -->
    <!-- ========================================================== -->
    <div id="google_translate_element" style="display:none;"></div>

        function googleTranslateElementInit() {
            new google.translate.TranslateElement({
                pageLanguage: 'pt',
                autoDisplay: false
            }, 'google_translate_element');
        }