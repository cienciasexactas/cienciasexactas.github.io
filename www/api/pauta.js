export default async function handler(req, res) {
    // 1. Configuração de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 2. Controlo rigoroso de Cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = "cienciasexactas";
    const REPO_NAME = "cienciasexactas.github.io";
    const FILE_PATH = "dados/pauta_geral.json"; // Caminho onde o JSON é guardado no repositório

    const headers = {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'Vercel-Pauta-Manager',
        'Accept': 'application/vnd.github.v3+json'
    };

    try {
        // MÉTODOS GET: Ler os dados do GitHub
        if (req.method === 'GET') {
            const respostaGh = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, { headers });

            if (respostaGh.status === 404) {
                // Se o ficheiro ainda não existir, retorna estrutura inicial vazia alinhada com o pauta.js
                return res.status(200).json({
                    estudantes: [],
                    planilhasColunas: { "Presenças": [], "Trabalhos Individuais": [], "Trabalhos de Grupo": [] },
                    percentagens: {}
                });
            }

            if (!respostaGh.ok) {
                return res.status(502).json({ error: 'Erro ao comunicar com o GitHub para ler os dados.' });
            }

            const dadosFicheiro = await respostaGh.json();
            const conteudoDecodificado = Buffer.from(dadosFicheiro.content, 'base64').toString('utf8');
            const jsonDados = JSON.parse(conteudoDecodificado);

            // Devolve os dados com a chave exata esperada pelo frontend
            return res.status(200).json({
                estudantes: jsonDados.estudantes || [],
                planilhasColunas: jsonDados.planilhasColunas || { "Presenças": [], "Trabalhos Individuais": [], "Trabalhos de Grupo": [] },
                percentagens: jsonDados.percentagens || {}
            });
        }

        // MÉTODO POST: Atualizar/Guardar os dados no GitHub
        if (req.method === 'POST') {
            const { estudantes, planilhasColunas, percentagens } = req.body;

            if (!estudantes) {
                return res.status(400).json({ error: 'Dados de estudantes obrigatórios.' });
            }

            // Estrutura completa a guardar no JSON (alinhada com o pauta.js)
            const dadosParaGuardar = {
                estudantes,
                planilhasColunas: planilhasColunas || { "Presenças": [], "Trabalhos Individuais": [], "Trabalhos de Grupo": [] },
                percentagens: percentagens || {}
            };

            const novoConteudoBase64 = Buffer.from(JSON.stringify(dadosParaGuardar, null, 2)).toString('base64');

            // 1. Obter o SHA atual do ficheiro (exigido pela API do GitHub)
            let fileSha = null;
            const checkGh = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, { headers });

            if (checkGh.ok) {
                const fileInfo = await checkGh.json();
                fileSha = fileInfo.sha;
            }

            // 2. Enviar o commit para o GitHub
            const payload = {
                message: "Atualização automática de pautas e percentagens via painel Vercel",
                content: novoConteudoBase64,
                sha: fileSha
            };

            const updateGh = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!updateGh.ok) {
                const erroDetalhe = await updateGh.json();
                return res.status(502).json({ error: 'Erro ao salvar no GitHub.', detalhe: erroDetalhe });
            }

            return res.status(200).json({ sucesso: true, mensagem: 'Dados sincronizados com sucesso!' });
        }

        return res.status(405).json({ error: 'Método não permitido.' });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}