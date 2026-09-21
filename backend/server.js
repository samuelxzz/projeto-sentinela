const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());

// ==========================================
// FRONTEND
// ==========================================

app.use(express.static(path.join(__dirname, "../frontend")));

// ==========================================
// BANCO DE DADOS
// ==========================================

const DB_FILE = path.join(__dirname, "db.json");

function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const bancoInicial = {
                usuarios: [],
                pacientes: [],
                triagens: [],
                consultas: [],
                medicacoes: [],
                altas: [],
                tv_chamada: null,
                tv_historico: []
            };

            fs.writeFileSync(
                DB_FILE,
                JSON.stringify(bancoInicial, null, 2),
                "utf8"
            );

            return bancoInicial;
        }

        const dados = fs.readFileSync(DB_FILE, "utf8");

        const db = dados.trim()
            ? JSON.parse(dados)
            : {};

        if (!Array.isArray(db.usuarios)) db.usuarios = [];
        if (!Array.isArray(db.pacientes)) db.pacientes = [];
        if (!Array.isArray(db.triagens)) db.triagens = [];
        if (!Array.isArray(db.consultas)) db.consultas = [];
        if (!Array.isArray(db.medicacoes)) db.medicacoes = [];
        if (!Array.isArray(db.altas)) db.altas = [];
        if (!Array.isArray(db.tv_historico)) db.tv_historico = [];

        if (!Object.prototype.hasOwnProperty.call(db, "tv_chamada")) {
            db.tv_chamada = null;
        }

        return db;

    } catch (erro) {

        console.error("Erro ao ler o banco:", erro);

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
}

function writeDB(db) {

    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(db, null, 2),
        "utf8"
    );
}


// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function normalizar(texto) {
    return String(texto || "")
        .trim()
        .toLowerCase();
}

function limparNome(nome) {

    return String(nome || "paciente")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();
}


// ==========================================
// PASTA DOS PDFs
// ==========================================

const PDF_FOLDER = path.join(__dirname, "pdfs");

if (!fs.existsSync(PDF_FOLDER)) {
    fs.mkdirSync(PDF_FOLDER, {
        recursive: true
    });
}

// Permite abrir os PDFs pelo navegador
app.use(
    "/arquivos-pdf",
    express.static(PDF_FOLDER)
);


// ==========================================
// GERAR PDF DA ALTA
// ==========================================

function criarPDFAlta(alta, caminhoArquivo) {

    function textoPDF(texto) {

        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\\/g, "\\\\")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)")
            .replace(/\r?\n/g, " ");
    }

    const data = new Date(alta.createdAt);

    const dataFormatada =
        data.toLocaleDateString("pt-BR");

    const horaFormatada =
        data.toLocaleTimeString("pt-BR");

    const linhas = [

        "DOCUMENTO DE ALTA HOSPITALAR",
        "",
        "Paciente: " + textoPDF(alta.paciente),
        "Tipo de alta: " + textoPDF(alta.tipoAlta),
        "Motivo: " + textoPDF(alta.motivo),
        "",
        "Orientacoes:",
        textoPDF(alta.orientacoes || "Nao informado"),
        "",
        "Observacoes:",
        textoPDF(alta.observacoes || "Nao informado"),
        "",
        "Data: " + dataFormatada,
        "Hora: " + horaFormatada,
        "",
        "Documento gerado pelo Sistema Sentinela."
    ];

    let comandos = [];

    comandos.push("BT");
    comandos.push("/F1 18 Tf");
    comandos.push("50 750 Td");
    comandos.push("(" + textoPDF(linhas[0]) + ") Tj");

    comandos.push("/F1 11 Tf");

    let primeiraLinha = true;

    for (let i = 1; i < linhas.length; i++) {

        if (primeiraLinha) {
            comandos.push("0 -28 Td");
            primeiraLinha = false;
        } else {
            comandos.push("0 -20 Td");
        }

        comandos.push(
            "(" + textoPDF(linhas[i]) + ") Tj"
        );
    }

    comandos.push("ET");

    const conteudo =
        comandos.join("\n");

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
        Buffer.byteLength(conteudo, "utf8") +
        " >>\nstream\n" +
        conteudo +
        "\nendstream"
    );

    objetos.push(
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    );

    let pdf = "%PDF-1.4\n";
    const offsets = [0];

    for (let i = 0; i < objetos.length; i++) {

        offsets.push(
            Buffer.byteLength(pdf, "utf8")
        );

        pdf +=
            `${i + 1} 0 obj\n` +
            objetos[i] +
            "\nendobj\n";
    }

    const inicioXref =
        Buffer.byteLength(pdf, "utf8");

    pdf += "xref\n";
    pdf += `0 ${objetos.length + 1}\n`;
    pdf += "0000000000 65535 f \n";

    for (let i = 1; i < offsets.length; i++) {

        pdf +=
            String(offsets[i])
                .padStart(10, "0") +
            " 00000 n \n";
    }

    pdf +=
        "trailer\n" +
        `<< /Size ${objetos.length + 1} /Root 1 0 R >>\n` +
        "startxref\n" +
        inicioXref +
        "\n%%EOF";

    fs.writeFileSync(
        caminhoArquivo,
        Buffer.from(pdf, "utf8")
    );
}


// ==========================================
// LOGIN
// ==========================================

app.post("/login", (req, res) => {

    try {

        const {
            usuario,
            senha
        } = req.body;

        const db = readDB();

        const encontrado =
            db.usuarios.find(u =>
                String(u.usuario || "") === String(usuario || "") &&
                String(u.senha || "") === String(senha || "")
            );

        if (!encontrado) {

            return res.status(401).json({
                sucesso: false,
                erro: "Usuário ou senha incorretos."
            });
        }

        res.json({
            sucesso: true,
            mensagem: "Login realizado com sucesso!"
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            erro: "Erro no login."
        });
    }
});


// ==========================================
// PACIENTES
// ==========================================

app.get("/pacientes", (req, res) => {

    const db = readDB();

    res.json(db.pacientes);
});


// ==========================================
// ATENDIMENTO
// ==========================================

app.post("/atendimento", (req, res) => {

    try {

        const {
            nome,
            cpf,
            tipo
        } = req.body;

        if (!nome || !cpf) {

            return res.status(400).json({
                erro: "Nome e CPF são obrigatórios."
            });
        }

        const db = readDB();

        const paciente = {
            id: Date.now(),
            nome,
            cpf,
            tipo: tipo || "Particular",
            status: "aguardando_triagem",
            createdAt: new Date().toISOString()
        };

        db.pacientes.push(paciente);

        writeDB(db);

        res.json({
            sucesso: true,
            mensagem: "Paciente cadastrado com sucesso!",
            paciente
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            erro: "Erro ao cadastrar paciente."
        });
    }
});


// ==========================================
// TRIAGEM
// ==========================================

app.post("/triagem", (req, res) => {

    try {

        const db = readDB();

        const triagem = {
            id: Date.now(),
            ...req.body,
            createdAt: new Date().toISOString()
        };

        db.triagens.push(triagem);

        writeDB(db);

        res.json({
            sucesso: true,
            triagem
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            erro: "Erro ao salvar triagem."
        });
    }
});


app.get("/triagens", (req, res) => {

    const db = readDB();

    res.json(db.triagens);
});


// ==========================================
// CONSULTA
// ==========================================

app.post("/consulta", (req, res) => {

    try {

        const db = readDB();

        const consulta = {
            id: Date.now(),
            ...req.body,
            createdAt: new Date().toISOString()
        };

        db.consultas.push(consulta);

        writeDB(db);

        res.json({
            sucesso: true,
            consulta
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            erro: "Erro ao salvar consulta."
        });
    }
});


// ==========================================
// MEDICAÇÕES
// ==========================================

app.get("/lista-medicacoes", (req, res) => {

    const db = readDB();

    res.json(db.medicacoes);
});


app.post("/medicacoes", (req, res) => {

    try {

        const db = readDB();

        const medicacao = {
            id: Date.now(),
            ...req.body,
            createdAt: new Date().toISOString()
        };

        db.medicacoes.push(medicacao);

        writeDB(db);

        res.json({
            sucesso: true,
            medicacao
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            erro: "Erro ao salvar medicação."
        });
    }
});


// ==========================================
// TV - CHAMADA
// ==========================================

app.post("/tv/chamar", (req, res) => {

    try {

        const db = readDB();

        const chamada = {
            ...req.body,
            createdAt: new Date().toISOString()
        };

        db.tv_chamada = chamada;

        db.tv_historico.push(chamada);

        writeDB(db);

        res.json({
            sucesso: true,
            chamada
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            erro: "Erro ao chamar paciente."
        });
    }
});


app.get("/tv/chamada", (req, res) => {

    const db = readDB();

    res.json(db.tv_chamada);
});


// ==========================================
// ALTA
// ==========================================

app.post("/alta", (req, res) => {

    try {

        const db = readDB();

        const pacienteNome =
            String(
                req.body.paciente ||
                req.body.nome ||
                ""
            ).trim();

        const tipoAlta =
            String(
                req.body.tipoAlta ||
                ""
            ).trim();

        const motivo =
            String(
                req.body.motivo ||
                ""
            ).trim();

        const orientacoes =
            String(
                req.body.orientacoes ||
                ""
            ).trim();

        const observacoes =
            String(
                req.body.observacoes ||
                ""
            ).trim();


        // ------------------------------
        // VALIDAÇÕES
        // ------------------------------

        if (!pacienteNome) {

            return res.status(400).json({
                erro: "Selecione um paciente."
            });
        }

        if (!tipoAlta) {

            return res.status(400).json({
                erro: "Selecione o tipo de alta."
            });
        }

        if (!motivo) {

            return res.status(400).json({
                erro: "Informe o motivo da alta."
            });
        }


        // ------------------------------
        // LOCALIZAR PACIENTE
        // ------------------------------

        const paciente =
            db.pacientes.find(p =>
                normalizar(p.nome) ===
                normalizar(pacienteNome)
            );


        if (!paciente) {

            return res.status(404).json({
                erro:
                    "Paciente não encontrado."
            });
        }


        // ------------------------------
        // CRIAR ALTA
        // ------------------------------

        const alta = {

            id: Date.now(),

            paciente: paciente.nome,

            pacienteId:
                paciente.id || null,

            tipoAlta,

            motivo,

            orientacoes,

            observacoes,

            createdAt:
                new Date().toISOString()
        };


        db.altas.push(alta);


        // ------------------------------
        // ATUALIZAR PACIENTE
        // ------------------------------

        paciente.status = "alta";


        // ------------------------------
        // ATUALIZAR TRIAGEM
        // ------------------------------

        const triagem =
            db.triagens.find(t =>
                normalizar(t.nome) ===
                normalizar(paciente.nome)
            );

        if (triagem) {
            triagem.status = "alta";
        }


        // ------------------------------
        // SALVAR BANCO
        // ------------------------------

        writeDB(db);


        // ------------------------------
        // CRIAR PDF
        // ------------------------------

        const nomePDF =
            `alta_${limparNome(paciente.nome)}_${Date.now()}.pdf`;

        const caminhoPDF =
            path.join(
                PDF_FOLDER,
                nomePDF
            );

        criarPDFAlta(
            alta,
            caminhoPDF
        );


        // ------------------------------
        // RESPONDER
        // ------------------------------

        res.json({

            sucesso: true,

            mensagem:
                "Alta registrada com sucesso!",

            alta,

            pdf:
                "/arquivos-pdf/" +
                encodeURIComponent(nomePDF),

            arquivo:
                nomePDF
        });


    } catch (erro) {

        console.error(
            "Erro ao registrar alta:",
            erro
        );

        res.status(500).json({

            sucesso: false,

            erro:
                "Erro ao registrar a alta."
        });
    }
});


// ==========================================
// LISTAR ALTAS
// ==========================================

app.get("/altas", (req, res) => {

    const db = readDB();

    res.json(db.altas);
});


// ==========================================
// BUSCAR ALTA DO PACIENTE
// ==========================================

app.get("/alta", (req, res) => {

    const paciente =
        String(
            req.query.paciente || ""
        ).trim();

    if (!paciente) {

        return res.status(400).json({
            erro: "Informe o paciente."
        });
    }

    const db = readDB();

    const altas =
        db.altas.filter(a =>
            normalizar(a.paciente) ===
            normalizar(paciente)
        );

    res.json(altas);
});


// ==========================================
// LISTAR PDFs
// ==========================================

app.get("/pdfs", (req, res) => {

    try {

        const paciente =
            normalizar(
                req.query.paciente || ""
            );

        if (!paciente) {
            return res.json([]);
        }

        if (!fs.existsSync(PDF_FOLDER)) {
            return res.json([]);
        }

        const arquivos =
            fs.readdirSync(PDF_FOLDER);

        const resultado =
            arquivos
                .filter(arquivo =>
                    arquivo
                        .toLowerCase()
                        .endsWith(".pdf")
                )
                .filter(arquivo =>
                    arquivo
                        .toLowerCase()
                        .includes(
                            limparNome(paciente)
                        )
                )
                .map(arquivo => ({

                    nome: arquivo,

                    url:
                        "/arquivos-pdf/" +
                        encodeURIComponent(
                            arquivo
                        )
                }));

        res.json(resultado);

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            erro: "Erro ao listar PDFs."
        });
    }
});


// ==========================================
// TESTE DO SERVIDOR
// ==========================================

app.get("/teste", (req, res) => {

    res.json({
        sucesso: true,
        mensagem:
            "Servidor do Sentinela funcionando!"
    });
});


// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, () => {

    console.log(
        `Servidor rodando em http://localhost:${PORT}`
    );

});
