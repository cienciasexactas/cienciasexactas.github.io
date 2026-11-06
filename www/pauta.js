// ============================================================================
// GESTÃO DE PAUTAS VIA FICHEIROS EXCEL NO SERVIDOR (VERCEL) - COMPLETO
// ============================================================================

const CURSOS_DISPONIVEIS = [
    'biologia', 'cienciasnaturais', 'matematica', 'economia',
    'gestao-empresa', 'gestao-iscgvsm', 'enfermagem-a', 'enfermagem-b',
    'contabilidade', 'agronomia', 'turismo', 'geografia', 'educacao-infancia'
];

const ANOS_DISPONIVEIS = ['2023-2024', '2024-2025', '2025-2026', '2026-2027'];

// Função auxiliar para capturar com segurança os valores dos seletores do docente
function obterCursoEAnoDocente() {
    const cursoEl = document.getElementById('select-docente-curso') || document.getElementById('novo-curso');
    const anoEl = document.getElementById('select-docente-ano') || document.getElementById('select-ano');
    
    return {
        curso: cursoEl ? cursoEl.value : 'biologia',
        ano: anoEl ? anoEl.value : '2025-2026'
    };
}

// Lê a pauta Excel de um curso e ano específicos diretamente do servidor
async function obterPautaServidor(cursoId, anoLectivo) {
    const caminhoPasta = `sistema/pautas/${cursoId}/${anoLectivo}`;
    try {
        const resposta = await fetch(`https://backend-upload-sooty.vercel.app/api/listar?curso=${caminhoPasta}`);
        const dados = await resposta.json();

        if (resposta.ok && dados.estrutura) {
            for (const bloco of dados.estrutura) {
                if (bloco.ficheiros) {
                    const ficheiroExcel = bloco.ficheiros.find(f => f.nome.endsWith('.xlsx') || f.nome.endsWith('.xls'));
                    if (ficheiroExcel && ficheiroExcel.url) {
                        const resFicheiro = await fetch(ficheiroExcel.url);
                        const arrayBuffer = await resFicheiro.arrayBuffer();
                        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
                        return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    }
                }
            }
        }
    } catch (e) {
        console.warn(`Não foi encontrada pauta para ${cursoId} (${anoLectivo})`, e);
    }
    return [];
}

// Converte a lista de alunos em .xlsx e envia para o servidor Vercel
async function guardarPautaServidor(cursoId, anoLectivo, listaAlunos) {
    if (typeof XLSX === 'undefined') {
        alert("Biblioteca SheetJS (XLSX) não encontrada.");
        return false;
    }

    try {
        const worksheet = XLSX.utils.json_to_sheet(listaAlunos);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Pauta");

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        const nomeFicheiro = `Pauta_${cursoId}_${anoLectivo}.xlsx`;
        const caminhoPasta = `sistema/pautas/${cursoId}/${anoLectivo}`;

        const payload = {
            tipo: 'ficheiro',
            nomeArquivo: nomeFicheiro,
            content: excelBuffer,
            conteudoBase64: excelBuffer,
            curso: caminhoPasta
        };

        const resposta = await fetch('https://backend-upload-sooty.vercel.app/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        return resposta.ok;
    } catch (erro) {
        console.error("Erro ao guardar pauta no servidor:", erro);
        return false;
    }
}

// Autenticação Unificada (Docente vs Estudante nos Excel do Servidor)
async function autenticarUtilizador() {
    const idInput = document.getElementById('pauta-user-id');
    const senhaInput = document.getElementById('pauta-user-senha');
    const erroDiv = document.getElementById('pauta-login-error');

    if (!idInput || !senhaInput) return;

    const id = idInput.value.trim();
    const senha = senhaInput.value.trim();

    if (!id || !senha) {
        if (erroDiv) erroDiv.textContent = "Preencha o ID e a Senha.";
        return;
    }

    // 1. Verificação de Acesso do Docente
    if (id.toLowerCase() === "docente" && senha === "admin") {
        if (erroDiv) erroDiv.textContent = "";
        document.getElementById('pauta-login-section').classList.add('pauta-hidden');
        document.getElementById('vista-docente').classList.remove('pauta-hidden');
        atualizarTabelaDocente();
        return;
    }

    // 2. Procura o Estudante varrendo os cursos e anos disponíveis no servidor
    if (erroDiv) erroDiv.textContent = "A procurar dados no servidor...";

    let alunoEncontrado = null;
    let cursoEncontrado = "";

    for (const curso of CURSOS_DISPONIVEIS) {
        for (const ano of ANOS_DISPONIVEIS) {
            const pautaTurma = await obterPautaServidor(curso, ano);
            const match = pautaTurma.find(a =>
                String(a.ID || a.id || a.Numero || "").trim() === id &&
                String(a.Senha || a.senha || "123").trim() === senha
            );
            if (match) {
                alunoEncontrado = match;
                cursoEncontrado = `${curso} (${ano})`;
                break;
            }
        }
        if (alunoEncontrado) break;
    }

    if (!alunoEncontrado) {
        if (erroDiv) erroDiv.textContent = "ID ou senha incorretos, ou registo não encontrado.";
        return;
    }

    if (erroDiv) erroDiv.textContent = "";
    document.getElementById('pauta-login-section').classList.add('pauta-hidden');

    // Preencher Vista do Estudante
    document.getElementById('lbl-nome').textContent = alunoEncontrado.Nome || alunoEncontrado.nome || "Estudante";
    document.getElementById('lbl-curso').textContent = alunoEncontrado.Curso || alunoEncontrado.curso || cursoEncontrado;
    document.getElementById('lbl-id').textContent = id;

    const tbodyAv = document.getElementById('tabela-avaliacoes');
    tbodyAv.innerHTML = `<tr>
        <td>${alunoEncontrado.Cadeira || alunoEncontrado.cadeira || "Disciplina Geral"}</td>
        <td>${alunoEncontrado.F1 || alunoEncontrado.f1 || "-"}</td>
        <td>${alunoEncontrado.F2 || alunoEncontrado.f2 || "-"}</td>
        <td>${alunoEncontrado.TP || alunoEncontrado.tp || "-"}</td>
        <td><strong>${alunoEncontrado.Final || alunoEncontrado.final || alunoEncontrado.Nota || 0}</strong></td>
        <td>${alunoEncontrado.Estado || alunoEncontrado.estado || "Avaliado"}</td>
    </tr>`;

    const tbodyEv = document.getElementById('tabela-evolucao');
    tbodyEv.innerHTML = `<tr><td>Avaliação Atual</td><td>${alunoEncontrado.Final || alunoEncontrado.final || 14}</td><td>Registado</td></tr>`;

    document.getElementById('vista-estudante').classList.remove('pauta-hidden');
}

// Inserção ou Atualização Manual pelo Docente (Por Curso e Ano Letivo)
async function adicionarAlunoManual() {
    const id = document.getElementById('novo-id').value.trim();
    const senha = document.getElementById('novo-senha').value.trim() || "123";
    const nome = document.getElementById('novo-nome').value.trim();
    const { curso, ano } = obterCursoEAnoDocente();
    const cadeira = document.getElementById('novo-cadeira').value.trim();
    const notaFinal = document.getElementById('novo-final').value.trim();
    const f1 = document.getElementById('novo-f1')?.value || "-";
    const f2 = document.getElementById('novo-f2')?.value || "-";
    const tp = document.getElementById('novo-tp')?.value || "-";

    if (!id || !nome || !cadeira || !notaFinal) {
        alert("Preencha pelo menos o ID, Nome, Cadeira e Nota Final.");
        return;
    }

    // Obter pauta atual daquele curso/ano no servidor
    let alunosPauta = await obterPautaServidor(curso, ano);

    // Verificar se já existe o aluno E a mesma cadeira para atualizar, ou adicionar novo
    let registoExistente = alunosPauta.find(a =>
        String(a.ID || a.id) === id &&
        String(a.Cadeira || a.cadeira).toLowerCase() === cadeira.toLowerCase()
    );

    if (registoExistente) {
        registoExistente.Nome = nome;
        registoExistente.Senha = senha;
        registoExistente.F1 = f1;
        registoExistente.F2 = f2;
        registoExistente.TP = tp;
        registoExistente.Final = Number(notaFinal);
        registoExistente.Estado = Number(notaFinal) >= 10 ? "Aprovado" : "Reprovado";
    } else {
        alunosPauta.push({
            ID: id,
            Senha: senha,
            Nome: nome,
            Curso: curso,
            Cadeira: cadeira,
            F1: f1,
            F2: f2,
            TP: tp,
            Final: Number(notaFinal),
            Estado: Number(notaFinal) >= 10 ? "Aprovado" : "Reprovado"
        });
    }

    const sucesso = await guardarPautaServidor(curso, ano, alunosPauta);
    if (sucesso) {
        // Limpar campos do formulário
        document.getElementById('novo-id').value = "";
        document.getElementById('novo-senha').value = "";
        document.getElementById('novo-nome').value = "";
        document.getElementById('novo-cadeira').value = "";
        document.getElementById('novo-final').value = "";
        if (document.getElementById('novo-f1')) document.getElementById('novo-f1').value = "";
        if (document.getElementById('novo-f2')) document.getElementById('novo-f2').value = "";
        if (document.getElementById('novo-tp')) document.getElementById('novo-tp').value = "";

        atualizarTabelaDocente();
        alert("Registo guardado/atualizado com sucesso no servidor!");
    } else {
        alert("Erro ao gravar no servidor.");
    }
}

// Apagar um registo/cadeira de um aluno específico na pauta
async function apagarRegistoDocente(idAluno, cadeiraNome) {
    if (!confirm(`Tem certeza que deseja remover o registo do aluno ID ${idAluno} (${cadeiraNome})?`)) return;

    const { curso, ano } = obterCursoEAnoDocente();
    let alunosPauta = await obterPautaServidor(curso, ano);

    // Filtra removendo exatamente o aluno com o ID e cadeira correspondentes
    const pautaFiltrada = alunosPauta.filter(a => !(String(a.ID || a.id) === String(idAluno) && String(a.Cadeira || a.cadeira) === String(cadeiraNome)));

    const sucesso = await guardarPautaServidor(curso, ano, pautaFiltrada);
    if (sucesso) {
        atualizarTabelaDocente();
        alert("Registo removido com sucesso!");
    } else {
        alert("Erro ao atualizar o servidor.");
    }
}

// Carregar dados para os campos do formulário para edição rápida
function carregarParaEdicao(id, nome, curso, cadeira, f1, f2, tp, final, senha) {
    document.getElementById('novo-id').value = id;
    document.getElementById('novo-nome').value = nome;
    
    const cursoEl = document.getElementById('select-docente-curso') || document.getElementById('novo-curso');
    if (cursoEl) cursoEl.value = curso;
    
    document.getElementById('novo-cadeira').value = cadeira;
    if (document.getElementById('novo-f1')) document.getElementById('novo-f1').value = f1;
    if (document.getElementById('novo-f2')) document.getElementById('novo-f2').value = f2;
    if (document.getElementById('novo-tp')) document.getElementById('novo-tp').value = tp;
    document.getElementById('novo-final').value = final;
    if (document.getElementById('novo-senha')) document.getElementById('novo-senha').value = senha || "123";

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Atualização da Tabela no Painel Docente com botões de Edição e Exclusão
async function atualizarTabelaDocente() {
    const tbody = document.getElementById('tabela-docente-alunos');
    if (!tbody) return;

    const { curso, ano } = obterCursoEAnoDocente();

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">A carregar pauta do servidor para ${curso} (${ano})...</td></tr>`;

    const alunosPauta = await obterPautaServidor(curso, ano);
    tbody.innerHTML = "";

    if (alunosPauta.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#666;">Nenhum aluno registado nesta turma/ano.</td></tr>`;
        return;
    }

    alunosPauta.forEach(aluno => {
        const id = aluno.ID || aluno.id || aluno.Numero || "-";
        const nome = aluno.Nome || aluno.nome || "-";
        const cadeira = aluno.Cadeira || aluno.cadeira || "-";
        const final = aluno.Final || aluno.final || 0;
        const f1 = aluno.F1 || aluno.f1 || "-";
        const f2 = aluno.F2 || aluno.f2 || "-";
        const tp = aluno.TP || aluno.tp || "-";
        const senha = aluno.Senha || aluno.senha || "123";

        tbody.innerHTML += `<tr>
            <td><strong>${id}</strong></td>
            <td>${nome}</td>
            <td>${cadeira}</td>
            <td><strong>${final}v</strong> (F1: ${f1}, F2: ${f2}, TP: ${tp})</td>
            <td style="white-space: nowrap;">
                <button onclick="carregarParaEdicao('${id}', '${nome}', '${curso}', '${cadeira}', '${f1}', '${f2}', '${tp}', '${final}', '${senha}')" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-right:4px;">✏️ Editar</button>
                <button onclick="apagarRegistoDocente('${id}', '${cadeira}')" style="background:#dc2626; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑️ Apagar</button>
            </td>
        </tr>`;
    });
}

// Processar Ficheiro Excel carregado pelo Docente
function processarFicheiroDocente(e) {
    const ficheiro = e.target.files[0];
    if (!ficheiro || typeof XLSX === 'undefined') return;

    const { curso, ano } = obterCursoEAnoDocente();

    const leitor = new FileReader();
    leitor.onload = async function (evt) {
        try {
            const dados = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(dados, { type: 'array' });
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

            const sucesso = await guardarPautaServidor(curso, ano, json);
            if (sucesso) {
                atualizarTabelaDocente();
                alert("Ficheiro Excel importado e guardado com sucesso no servidor!");
            } else {
                alert("Erro ao enviar o ficheiro para o servidor.");
            }
        } catch (err) {
            alert("Erro ao ler o formato do ficheiro Excel.");
        }
    };
    leitor.readAsArrayBuffer(ficheiro);
}

// Fechar Sessão
function terminarSessao() {
    document.getElementById('pauta-user-id').value = "";
    document.getElementById('pauta-user-senha').value = "";
    document.getElementById('vista-estudante').classList.add('pauta-hidden');
    document.getElementById('vista-docente').classList.add('pauta-hidden');
    document.getElementById('pauta-login-section').classList.remove('pauta-hidden');
}

// Navegação SPA da Pauta
function abrirSecaoPautas(evento) {
    if (evento) evento.preventDefault();

    if (typeof navegarParaSecao === 'function') {
        navegarParaSecao('pauta');
    } else {
        const seccoes = document.querySelectorAll(".conteudo-seccao");
        const carousel = document.querySelector(".carousel-container");
        if (carousel) carousel.classList.add("escondido");
        seccoes.forEach(sec => sec.classList.remove("ativo"));

        const pautaSec = document.getElementById('pauta');
        if (pautaSec) pautaSec.classList.add("ativo");
    }

    const loginSec = document.getElementById('pauta-login-section');
    const estSec = document.getElementById('vista-estudante');
    const docSec = document.getElementById('vista-docente');

    if (loginSec) loginSec.classList.remove('pauta-hidden');
    if (estSec) estSec.classList.add('pauta-hidden');
    if (docSec) docSec.classList.add('pauta-hidden');
}