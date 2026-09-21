const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

// ======================================================
// CONFIGURAÇÃO
// ======================================================

const PORT = process.env.PORT || 3000;

const FRONTEND_FOLDER = path.join(__dirname, "../frontend");
const DB_FILE = path.join(__dirname, "db.json");
const PDF_FOLDER = path.join(__dirname, "pdfs");

// ======================================================
// CRIAR PASTA PDF
// ======================================================

if (!fs.existsSync(PDF_FOLDER)) {
    fs.mkdirSync(PDF_FOLDER, { recursive: true });
}

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Frontend
app.use(express.static(FRONTEND_FOLDER));

// PDFs
app.use("/pdfs", express.static(PDF_FOLDER));

// ======================================================
// BANCO DE DADOS
// ======================================================

function bancoPadrao() {
    return {
        usuarios: [],
        pacientes: [],
        triagens: [],
        consultas: [],
        medicacoes: [],
        altas: [],
        tv_chamada: null,
        tv_historico: []
    };
}

function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const banco = bancoPadrao();

            fs.writeFileSync(
                DB_FILE,
                JSON.stringify(banco, null, 2),
                "utf8"
            );

            return banco;
        }

        const conteudo = fs.readFileSync(DB_FILE, "utf8");

        if (!conteudo.trim()) {
            return bancoPadrao();
        }

        const db = JSON.parse(conteudo);

        // Garantir que todos os campos existam
        const padrao = bancoPadrao();

        for (const chave of Object.keys(padrao)) {
            if (db[chave] === undefined) {
                db[chave] = padrao[chave];
            }
        }

        return db;

    } catch (erro) {
        console.error("Erro ao ler banco:", erro);

        return bancoPadrao();
    }
}

function writeDB(db) {
    try {
        fs.writeFileSync(
            DB_FILE,
            JSON.stringify(db, null, 2),
            "utf8"
        );

        return true;

    } catch (erro) {
        console.error("Erro ao salvar banco:", erro);
        return false;
    }
}

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function normalizarTexto(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function limparNomeArquivo(nome) {
    return String(nome || "paciente")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_")
        .substring(0, 80);
}

function textoPDF(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E]/g, "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
}

function valorPaciente(paciente, campos) {
    for (const campo of campos) {
        if (
            paciente &&
            paciente[campo] !== undefined &&
            paciente[campo] !== null &&
            String(paciente[campo]).trim() !== ""
        ) {
            return String(paciente[campo]);
        }
    }

    return "Nao informado";
}

// ======================================================
// GERADOR DE PDF
// ======================================================

function gerarPDFPaciente(paciente, alta) {

    const nomePaciente = valorPaciente(
        paciente,
        ["nome", "Nome", "paciente", "name"]
    );

    const cpf = valorPaciente(
        paciente,
        ["cpf", "CPF"]
    );

    const nascimento = valorPaciente(
        paciente,
        [
            "dataNascimento",
            "data_nascimento",
            "nascimento",
            "dataNascimentoPaciente"
        ]
    );

    const telefone = valorPaciente(
        paciente,
        ["telefone", "celular", "phone"]
    );

    const convenio = valorPaciente(
        paciente,
        ["convenio", "tipo", "plano"]
    );

    const endereco = valorPaciente(
        paciente,
        ["endereco", "address"]
    );

    const dataAlta = new Date().toLocaleString("pt-BR");

    const linhas = [];

    linhas.push("HOSPITAL - SENTINELA");
    linhas.push("");
    linhas.push("DOCUMENTO DE ALTA DO PACIENTE");
    linhas.push("");
    linhas.push("-----------------------------------------------");
    linhas.push("");
    linhas.push("DADOS DO PACIENTE");
    linhas.push("");
    linhas.push("Nome: " + nomePaciente);
    linhas.push("CPF: " + cpf);
    linhas.push("Data de nascimento: " + nascimento);
    linhas.push("Telefone: " + telefone);
    linhas.push("Convenio/Tipo: " + convenio);
    linhas.push("Endereco: " + endereco);
    linhas.push("");
    linhas.push("-----------------------------------------------");
    linhas.push("");
    linhas.push("DADOS DA ALTA");
    linhas.push("");
    linhas.push(
        "Tipo de alta: " +
        (alta.tipoAlta || "Nao informado")
    );

    linhas.push(
        "Motivo: " +
        (alta.motivo || "Nao informado")
    );

    linhas.push(
        "Orientacoes: " +
        (alta.orientacoes || "Nao informado")
    );

    linhas.push(
        "Observacoes: " +
        (alta.observacoes || "Nao informado")
    );

    linhas.push("");
    linhas.push("Data da alta: " + dataAlta);
    linhas.push("");
    linhas.push("-----------------------------------------------");
    linhas.push("");
    linhas.push("Documento gerado automaticamente pelo");
    linhas.push("Sistema Hospitalar Sentinela.");
    linhas.push("");
    linhas.push("Assinatura: _________________________________");

    // --------------------------------------------------
    // QUEBRAR LINHAS GRANDES
    // --------------------------------------------------

    const linhasFinais = [];

    for (const linha of linhas) {

        const texto = String(linha);

        if (texto.length <= 85) {
            linhasFinais.push(texto);
            continue;
        }

        let restante = texto;

        while (restante.length > 85) {

            let corte = restante.lastIndexOf(" ", 85);

            if (corte <= 0) {
                corte = 85;
            }

            linhasFinais.push(restante.substring(0, corte));

            restante = restante.substring(corte).trim();
        }

        if (restante.length > 0) {
            linhasFinais.push(restante);
        }
    }

    // --------------------------------------------------
    // CONTEÚDO PDF
    // --------------------------------------------------

    let comandos = [];

    comandos.push("BT");
    comandos.push("/F1 11 Tf");
    comandos.push("50 790 Td");

    let primeira = true;

    for (const linha of linhasFinais) {

        if (!primeira) {
            comandos.push("0 -18 Td");
        }

        comandos.push("(" + textoPDF(linha) + ") Tj");

        primeira = false;
    }

    comandos.push("ET");

    const stream = comandos.join("\n");

    // --------------------------------------------------
    // OBJETOS PDF
    // --------------------------------------------------

    const objetos = [];

    objetos.push(
        "<< /Type /Catalog /Pages 2 0 R >>"
    );

    objetos.push(
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"
    );

    objetos.push(
        "<< /Type /Page /Parent 2 0 R " +
        "/MediaBox [0 0 595 842] " +
        "/Resources << /Font << /F1 5 0 R >> >> " +
        "/Contents 4 0 R >>"
    );

    objetos.push(
        "<< /Length " +
        Buffer.byteLength(stream, "utf8") +
        " >>\nstream\n" +
        stream +
        "\nendstream"
    );

    objetos.push(
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    );

    // --------------------------------------------------
    // MONTAR PDF
    // --------------------------------------------------

    let pdf = "%PDF-1.4\n";

    const offsets = [0];

    for (let i = 0; i < objetos.length; i++) {

        offsets.push(
            Buffer.byteLength(pdf, "binary")
        );

        pdf += `${i + 1} 0 obj\n`;
        pdf += objetos[i];
        pdf += "\nendobj\n";
    }

    const xrefPosition = Buffer.byteLength(pdf, "binary");

    pdf += "xref\n";
    pdf += `0 ${objetos.length + 1}\n`;
    pdf += "0000000000 65535 f \n";

    for (let i = 1; i < offsets.length; i++) {

        pdf += String(offsets[i])
            .padStart(10, "0") +
            " 00000 n \n";
    }

    pdf += "trailer\n";

    pdf +=
        `<< /Size ${objetos.length + 1} /Root 1 0 R >>\n`;

    pdf += "startxref\n";
    pdf += xrefPosition + "\n";
    pdf += "%%EOF";

    // --------------------------------------------------
    // NOME DO ARQUIVO
    // --------------------------------------------------

    const nomeArquivo =
        `alta_${limparNomeArquivo(nomePaciente)}_${Date.now()}.pdf`;

    const caminhoArquivo =
        path.join(PDF_FOLDER, nomeArquivo);

    fs.writeFileSync(
        caminhoArquivo,
        Buffer.from(pdf, "binary")
    );

    return {
        nomeArquivo,
        caminhoArquivo
    };
}

// ======================================================
// LOGIN
// ======================================================

app.post("/login", (req, res) => {

    try {

        const { usuario, senha } = req.body;

        if (!usuario || !senha) {
            return res.status(400).json({
                sucesso: false,
                erro: "Informe usuario e senha."
            });
        }

        const db = readDB();

        const encontrado = db.usuarios.find(
            u =>
                String(u.usuario) === String(usuario) &&
                String(u.senha) === String(senha)
        );

        if (!encontrado) {
            return res.status(401).json({
                sucesso: false,
                erro: "Usuario ou senha incorretos."
            });
        }

        return res.json({
            sucesso: true,
            mensagem: "Login realizado com sucesso.",
            usuario: encontrado
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            erro: "Erro interno no login."
        });
    }
});

// ======================================================
// ATENDIMENTO
// ======================================================

app.post("/atendimento", (req, res) => {

    try {

        const {
            nome,
            cpf,
            tipo,
            telefone,
            dataNascimento,
            endereco
        } = req.body;

        if (!nome || !cpf) {
            return res.status(400).json({
                sucesso: false,
                erro: "Nome e CPF sao obrigatorios."
            });
        }

        const db = readDB();

        const paciente = {
            id: Date.now().toString(),
            nome,
            cpf,
            tipo: tipo || "Particular",
            telefone: telefone || "",
            dataNascimento: dataNascimento || "",
            endereco: endereco || "",
            status: "aguardando",
            criadoEm: new Date().toISOString()
        };

        db.pacientes.push(paciente);

        writeDB(db);

        res.json({
            sucesso: true,
            mensagem: "Paciente cadastrado com sucesso.",
            paciente
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao cadastrar paciente."
        });
    }
});

// ======================================================
// LISTAR PACIENTES
// ======================================================

app.get("/pacientes", (req, res) => {

    try {

        const db = readDB();

        res.json(db.pacientes || []);

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao buscar pacientes."
        });
    }
});

// ======================================================
// TRIAGEM
// ======================================================

app.post("/triagem", (req, res) => {

    try {

        const db = readDB();

        const triagem = {
            id: Date.now().toString(),
            ...req.body,
            criadoEm: new Date().toISOString()
        };

        db.triagens.push(triagem);

        const nome = normalizarTexto(
            req.body.nome ||
            req.body.paciente ||
            ""
        );

        const paciente = db.pacientes.find(
            p =>
                normalizarTexto(p.nome) === nome
        );

        if (paciente) {
            paciente.status = "triagem";
        }

        writeDB(db);

        res.json({
            sucesso: true,
            mensagem: "Triagem registrada.",
            triagem
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao registrar triagem."
        });
    }
});

// ======================================================
// LISTAR TRIAGENS
// ======================================================

app.get("/triagens", (req, res) => {

    try {

        const db = readDB();

        res.json(db.triagens || []);

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao buscar triagens."
        });
    }
});

// ======================================================
// TV - CHAMAR PACIENTE
// ======================================================

app.post("/tv/chamar", (req, res) => {

    try {

        const db = readDB();

        const chamada = {
            ...req.body,
            data: new Date().toISOString()
        };

        db.tv_chamada = chamada;

        if (!Array.isArray(db.tv_historico)) {
            db.tv_historico = [];
        }

        db.tv_historico.push(chamada);

        writeDB(db);

        res.json({
            sucesso: true,
            chamada
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao chamar paciente."
        });
    }
});

// ======================================================
// TV - CONSULTAR CHAMADA
// ======================================================

app.get("/tv/chamada", (req, res) => {

    try {

        const db = readDB();

        res.json(
            db.tv_chamada || null
        );

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao consultar chamada."
        });
    }
});

// ======================================================
// MEDICAMENTOS
// ======================================================

app.get("/lista-medicacoes", (req, res) => {

    try {

        const db = readDB();

        res.json(
            db.medicacoes || []
        );

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao buscar medicacoes."
        });
    }
});

// ======================================================
// CONSULTA
// ======================================================

app.post("/consulta", (req, res) => {

    try {

        const db = readDB();

        const consulta = {
            id: Date.now().toString(),
            ...req.body,
            criadoEm: new Date().toISOString()
        };

        db.consultas.push(consulta);

        writeDB(db);

        res.json({
            sucesso: true,
            mensagem: "Consulta registrada.",
            consulta
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao registrar consulta."
        });
    }
});

// ======================================================
// MEDICAÇÕES
// ======================================================

app.post("/medicacoes", (req, res) => {

    try {

        const db = readDB();

        const medicacao = {
            id: Date.now().toString(),
            ...req.body,
            criadoEm: new Date().toISOString()
        };

        db.medicacoes.push(medicacao);

        writeDB(db);

        res.json({
            sucesso: true,
            mensagem: "Medicacao registrada.",
            medicacao
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao registrar medicacao."
        });
    }
});

// ======================================================
// ALTA DO PACIENTE
// ======================================================

app.post("/alta", (req, res) => {

    try {

        console.log("====================================");
        console.log("NOVA SOLICITACAO DE ALTA");
        console.log(req.body);
        console.log("====================================");

        const {
            paciente,
            nome,
            tipoAlta,
            tipo,
            motivo,
            orientacoes,
            observacoes
        } = req.body;

        const nomePaciente = paciente || nome;

        if (!nomePaciente) {

            return res.status(400).json({
                sucesso: false,
                erro: "Paciente nao informado."
            });
        }

        const db = readDB();

        // --------------------------------------------------
        // LOCALIZAR PACIENTE
        // --------------------------------------------------

        const nomeNormalizado =
            normalizarTexto(nomePaciente);

        const pacienteEncontrado =
            db.pacientes.find(p => {

                const nomeBanco =
                    normalizarTexto(p.nome);

                return (
                    nomeBanco === nomeNormalizado ||
                    nomeBanco.includes(nomeNormalizado) ||
                    nomeNormalizado.includes(nomeBanco)
                );
            });

        if (!pacienteEncontrado) {

            return res.status(404).json({
                sucesso: false,
                erro:
                    "Paciente nao encontrado no banco de dados."
            });
        }

        // --------------------------------------------------
        // GARANTIR ARRAY DE ALTAS
        // --------------------------------------------------

        if (!Array.isArray(db.altas)) {
            db.altas = [];
        }

        // --------------------------------------------------
        // REGISTRAR ALTA
        // --------------------------------------------------

        const alta = {

            id: Date.now().toString(),

            paciente:
                pacienteEncontrado.nome,

            pacienteId:
                pacienteEncontrado.id,

            tipoAlta:
                tipoAlta ||
                tipo ||
                "Alta",

            motivo:
                motivo ||
                "Nao informado",

            orientacoes:
                orientacoes ||
                "Nenhuma orientacao informada",

            observacoes:
                observacoes ||
                "Nenhuma observacao informada",

            data:
                new Date().toISOString()
        };

        db.altas.push(alta);

        // --------------------------------------------------
        // ALTERAR STATUS DO PACIENTE
        // --------------------------------------------------

        pacienteEncontrado.status = "alta";

        pacienteEncontrado.dataAlta =
            alta.data;

        // --------------------------------------------------
        // ALTERAR STATUS DA TRIAGEM
        // --------------------------------------------------

        if (Array.isArray(db.triagens)) {

            db.triagens.forEach(triagem => {

                const nomeTriagem =
                    normalizarTexto(
                        triagem.nome ||
                        triagem.paciente ||
                        ""
                    );

                if (
                    nomeTriagem ===
                    normalizarTexto(
                        pacienteEncontrado.nome
                    )
                ) {
                    triagem.status = "alta";
                    triagem.dataAlta = alta.data;
                }
            });
        }

        // --------------------------------------------------
        // SALVAR BANCO
        // --------------------------------------------------

        const salvo = writeDB(db);

        if (!salvo) {

            return res.status(500).json({
                sucesso: false,
                erro: "Nao foi possivel salvar a alta."
            });
        }

        // --------------------------------------------------
        // GERAR PDF
        // --------------------------------------------------

        const pdf =
            gerarPDFPaciente(
                pacienteEncontrado,
                alta
            );

        console.log(
            "PDF GERADO:",
            pdf.caminhoArquivo
        );

        // --------------------------------------------------
        // RESPONDER
        // --------------------------------------------------

        return res.json({

            sucesso: true,

            mensagem:
                "Alta registrada e PDF gerado com sucesso.",

            paciente:
                pacienteEncontrado,

            alta,

            arquivo:
                pdf.nomeArquivo,

            pdf:
                "/baixar-alta/" +
                encodeURIComponent(
                    pdf.nomeArquivo
                )
        });

    } catch (erro) {

        console.error(
            "ERRO NA ALTA:",
            erro
        );

        return res.status(500).json({

            sucesso: false,

            erro:
                "Erro interno ao registrar a alta.",

            detalhes:
                erro.message
        });
    }
});

// ======================================================
// BAIXAR PDF DA ALTA
// ======================================================

app.get("/baixar-alta/:arquivo", (req, res) => {

    try {

        const arquivo =
            path.basename(
                decodeURIComponent(
                    req.params.arquivo
                )
            );

        const caminho =
            path.join(
                PDF_FOLDER,
                arquivo
            );

        if (!fs.existsSync(caminho)) {

            return res.status(404).json({
                sucesso: false,
                erro: "PDF nao encontrado."
            });
        }

        res.download(
            caminho,
            arquivo
        );

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao baixar PDF."
        });
    }
});

// ======================================================
// LISTAR PDFS DE UM PACIENTE
// ======================================================

app.get("/pdfs", (req, res) => {

    try {

        const nomePaciente =
            normalizarTexto(
                req.query.paciente || ""
            );

        if (!fs.existsSync(PDF_FOLDER)) {
            return res.json([]);
        }

        const arquivos =
            fs.readdirSync(PDF_FOLDER);

        const resultado =
            arquivos
                .filter(
                    arquivo =>
                        arquivo.toLowerCase().endsWith(".pdf")
                )
                .filter(arquivo => {

                    if (!nomePaciente) {
                        return true;
                    }

                    return normalizarTexto(
                        arquivo
                    ).includes(
                        nomePaciente.replace(/\s+/g, "_")
                    );
                })
                .map(arquivo => ({

                    nome: arquivo,

                    url:
                        "/baixar-alta/" +
                        encodeURIComponent(
                            arquivo
                        )
                }));

        res.json(resultado);

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao listar PDFs."
        });
    }
});

// ======================================================
// TESTE DO SERVIDOR
// ======================================================

app.get("/teste", (req, res) => {

    res.json({
        sucesso: true,
        mensagem: "Servidor Sentinela funcionando!",
        data: new Date().toISOString()
    });
});

// ======================================================
// PÁGINA PRINCIPAL
// ======================================================

app.get("/", (req, res) => {

    const indexPath =
        path.join(
            FRONTEND_FOLDER,
            "index.html"
        );

    if (fs.existsSync(indexPath)) {

        return res.sendFile(indexPath);
    }

    res.json({
        sucesso: true,
        mensagem:
            "Servidor Sentinela funcionando."
    });
});

// ======================================================
// INICIAR SERVIDOR
// ======================================================

app.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("====================================");
    console.log("   SISTEMA SENTINELA");
    console.log("====================================");
    console.log(
        `Servidor rodando na porta ${PORT}`
    );
    console.log(
        `PDFs: ${PDF_FOLDER}`
    );
    console.log("====================================");
    console.log("");
});
