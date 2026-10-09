export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        const { nomeArquivo, conteudoBase64, curso } = req.body;

        if (!nomeArquivo || !conteudoBase64 || !curso) {
            return res.status(400).json({ error: 'Dados incompletos no envio.' });
        }

        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const REPO_OWNER = "cienciasexactas";
        const REPO_NAME = "cienciasexactas.github.io";
        
        const caminhoArquivo = `uploads/${curso}/${nomeArquivo}`;
        const urlGithub = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${caminhoArquivo}`;

        // Verifica se o ficheiro já existe para obter o 'sha' (necessário para atualizar)
        let sha = null;
        try {
            const checarExiste = await fetch(urlGithub, {
                headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'Vercel-Uploader' }
            });
            if (checarExiste.ok) {
                const dadosExiste = await checarExiste.json();
                sha = dadosExiste.sha;
            }
        } catch (e) {
            console.warn('Ficheiro novo, sem SHA prévio.');
        }

        const corpoPayload = {
            message: `Upload de ficheiro para ${curso}: ${nomeArquivo}`,
            content: conteudoBase64
        };
        if (sha) corpoPayload.sha = sha;

        const response = await fetch(urlGithub, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Vercel-Uploader'
            },
            body: JSON.stringify(corpoPayload)
        });

        const data = await response.json();

        if (response.ok) {
            return res.status(200).json({ 
                success: true, 
                url: data.content.html_url 
            });
        } else {
            return res.status(400).json({ error: data.message });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Erro interno no servidor: ' + error.message });
    }
}