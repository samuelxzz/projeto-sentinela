const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// ===============================
// FRONTEND
// ===============================

app.use(express.static(path.join(__dirname, "../frontend")));

// ===============================
// BANCO DE DADOS
// ===============================

const DB_FILE = path.join(__dirname, "db.json");

function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        return {
            usuarios: [],
            pacientes: [],
            triagens: [],
            consultas: [],
            altas: [],
            internacoes: [],
            tv_chamada: null,
            tv_historico: []
        };
    }

    const db = JSON.parse(
        fs.readFileSync(DB_FILE, "utf8")
    );

    if (!Array.isArray(db.usuarios)) db.usuarios = [];
    if (!Array.isArray(db.pacientes)) db.pacientes = [];
    if (!Array.isArray(db.triagens)) db.triagens = [];
    if (!Array.isArray(db.consultas)) db.consultas = [];
    if (!Array.isArray(db.altas)) db.altas = [];
    if (!Array.isArray(db.internacoes)) db.internacoes = [];
    if (!("tv_chamada" in db)) db.tv_chamada = null;
    if (!Array.isArray(db.tv_historico)) db.tv_historico = [];

    return db;
}

function writeDB(data) {
    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

// ===============================
// LOGIN
// ===============================

app.post("/login", (req, res) => {

    const db = readDB();

    const usuario = db.usuarios.find(u =>
        u.usuario === req.body.usuario &&
        u.senha === req.body.senha
    );

    if (!usuario) {
        return res.status(401).json({
            erro: "Login inválido"
        });
    }

    res.json(usuario);
});

// ===============================
// ATENDIMENTO
// ===============================

app.post("/atendimento", (req, res) => {

    const db = readDB();

    const paciente = {
        id: Date.now(),
        nome: req.body.nome || "",
        cpf: req.body.cpf || "",
        tipo: req.body.tipo || "",
        status: "triagem",
        createdAt: new Date()
    };

    db.pacientes.push(paciente);

    writeDB(db);

    res.json(paciente);
});

// ===============================
// LISTAR PACIENTES
// ===============================

app.get("/pacientes", (req, res) => {

    const db = readDB();

    res.json(db.pacientes);
});

// ===============================
// TRIAGEM
// ===============================

app.post("/triagem", (req, res) => {

    const db = readDB();

    const temperatura =
        Number(req.body.temperatura);

    let risco = req.body.risco;

    if (temperatura >= 39) {
        risco = "vermelho";
    } else if (temperatura >= 38) {
        risco = "amarelo";
    } else if (!risco) {
        risco = "verde";
    }

    const triagem = {
        id: Date.now(),
        nome: req.body.nome || "",
        sintoma: req.body.sintoma || "",
        temperatura:
            Number.isFinite(temperatura)
                ? temperatura
                : "",
        alergia: req.body.alergia || "",
        observacao: req.body.observacao || "",
        risco,
        status: "aguardando_medico",
        createdAt: new Date()
    };

    db.triagens.push(triagem);

    const paciente = db.pacientes.find(
        p => p.nome === triagem.nome
    );

    if (paciente) {
        paciente.status = "aguardando_medico";
    }

    writeDB(db);

    res.json(triagem);
});

// ===============================
// LISTAR TRIAGENS
// ===============================

app.get("/triagens", (req, res) => {

    const db = readDB();

    const triagens =
        db.triagens.filter(t =>
            !t.status ||
            t.status === "aguardando_medico"
        );

    res.json(triagens);
});

// ===============================
// TV
// ===============================

app.post("/tv/chamar", (req, res) => {

    const db = readDB();

    const chamada = {
        id: Date.now().toString(),
        localTipo: req.body.localTipo || "",
        localNumero: req.body.localNumero || "",
        paciente: req.body.paciente || "",
        hora: new Date().toLocaleTimeString(
            "pt-BR",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        )
    };

    db.tv_chamada = chamada;

    db.tv_historico.unshift(chamada);

    if (db.tv_historico.length > 5) {
        db.tv_historico.pop();
    }

    writeDB(db);

    res.json(chamada);
});

app.get("/tv/chamada", (req, res) => {

    const db = readDB();

    res.json({
        chamada: db.tv_chamada,
        historico: db.tv_historico
    });
});

// ===============================
// MEDICAÇÕES
// ===============================

app.get("/lista-medicacoes", (req, res) => {

    res.json([
        "Dipirona",
        "Paracetamol",
        "Ibuprofeno",
        "Amoxicilina",
        "Azitromicina",
        "Loratadina",
        "Omeprazol",
        "Buscopan",
        "Dramin",
        "Soro fisiológico"
    ]);
});

// ===============================
// CONSULTA
// ===============================

app.post("/consulta", (req, res) => {

    const db = readDB();

    const consulta = {
        id: Date.now(),
        paciente: req.body.paciente || "",
        diagnostico: req.body.diagnostico || "",
        medicacao: req.body.medicacao || "",
        obs: req.body.obs || "",
        createdAt: new Date()
    };

    db.consultas.push(consulta);

    const triagem = db.triagens.find(t =>
        t.nome === consulta.paciente &&
        (
            !t.status ||
            t.status === "aguardando_medico"
        )
    );

    if (triagem) {
        triagem.status = "atendido";
    }

    const paciente = db.pacientes.find(
        p => p.nome === consulta.paciente
    );

    if (paciente) {
        paciente.status = "atendido";
    }

    writeDB(db);

    res.json(consulta);
});

app.get("/medicacoes", (req, res) => {

    const db = readDB();

    res.json(db.consultas);
});

// ===============================
// ALTA
// ===============================

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
                req.body.tipoAlta || ""
            ).trim();

        const motivo =
            String(
                req.body.motivo || ""
            ).trim();

        const orientacoes =
            String(
                req.body.orientacoes || ""
            ).trim();

        const observacoes =
            String(
                req.body.observacoes || ""
            ).trim();

        if (!pacienteNome) {
            return res.status(400).json({
                erro: "Paciente não informado."
            });
        }

        if (!tipoAlta) {
            return res.status(400).json({
                erro: "Tipo de alta não informado."
            });
        }

        if (!motivo) {
            return res.status(400).json({
                erro: "Motivo da alta não informado."
            });
        }

        const paciente =
            db.pacientes.find(p =>
                String(p.nome || "")
                    .trim()
                    .toLowerCase() ===
                pacienteNome.toLowerCase()
            );

        if (!paciente) {
            return res.status(404).json({
                erro: "Paciente não encontrado."
            });
        }

        const triagem =
            db.triagens.find(t =>
                String(t.nome || "")
                    .trim()
                    .toLowerCase() ===
                pacienteNome.toLowerCase()
            );

        const alta = {
            id: Date.now(),
            paciente: paciente.nome,
            tipoAlta,
            motivo,
            orientacoes,
            observacoes,
            createdAt: new Date()
        };

        db.altas.push(alta);

        if (triagem) {
            triagem.status = "alta";
        }

        paciente.status = "alta";

        writeDB(db);

        res.json({
            sucesso: true,
            mensagem:
                "Alta registrada com sucesso!",
            alta
        });

    } catch (erro) {

        console.error(erro);

        res.status(500).json({
            erro:
                "Erro interno ao registrar a alta."
        });
    }
});

// ===============================
// LISTAR ALTAS
// ===============================

app.get("/altas", (req, res) => {

    const db = readDB();

    res.json(db.altas);
});

// ===============================
// BUSCAR ALTA
// ===============================

app.get("/alta", (req, res) => {

    const db = readDB();

    const paciente =
        String(
            req.query.paciente || ""
        ).trim();

    if (!paciente) {
        return res.status(400).json({
            erro: "Informe o paciente."
        });
    }

    res.json(
        db.altas.filter(
            a => a.paciente === paciente
        )
    );
});

// ===============================
// INTERNAÇÃO
// ===============================

app.post("/internacao", (req, res) => {

    try {

        const db = readDB();

        const nome =
            String(
                req.body.paciente ||
                req.body.nome ||
                ""
            ).trim();

        if (!nome) {
            return res.status(400).json({
                erro: "Paciente não informado."
            });
        }

        const paciente =
            db.pacientes.find(p =>
                String(p.nome || "")
                    .trim()
                    .toLowerCase() ===
                nome.toLowerCase()
            );

        if (!paciente) {
            return res.status(404).json({
                erro: "Paciente não encontrado."
            });
        }

        const internacao = {
            id: Date.now(),
            paciente: paciente.nome,
            status: "internado",
            createdAt: new Date()
        };

        db.internacoes.push(internacao);

        paciente.status = "internado";

        const triagem =
            db.triagens.find(t =>
                String(t.nome || "")
                    .trim()
                    .toLowerCase() ===
                nome.toLowerCase()
            );

        if (triagem) {
            triagem.status = "internado";
        }

        writeDB(db);

        res.json({
            sucesso: true,
            mensagem:
                "Paciente internado com sucesso.",
            internacao
        });

    } catch (erro) {

        console.error(
            "❌ ERRO NA INTERNAÇÃO:",
            erro
        );

        res.status(500).json({
            erro:
                "Erro interno ao realizar a internação."
        });
    }
});

// ===============================
// LISTAR INTERNAÇÕES
// ===============================

app.get("/internacoes", (req, res) => {

    const db = readDB();

    res.json(db.internacoes);
});

// ===============================
// PDFs
// ===============================

const PDF_FOLDER =
    path.join(
        __dirname,
        "pdfs"
    );

if (!fs.existsSync(PDF_FOLDER)) {

    fs.mkdirSync(
        PDF_FOLDER,
        {
            recursive: true
        }
    );
}

app.use(
    "/arquivos-pdf",
    express.static(PDF_FOLDER)
);

// ===============================
// LIMPAR NOME
// ===============================

function limparNome(nome) {

    return String(
        nome || "paciente"
    )
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
        )
        .replace(
            /_+/g,
            "_"
        )
        .replace(
            /^_+|_+$/g,
            ""
        );
}

// ===============================
// GERAR PDF
// ===============================

app.get("/gerar-pdf", (req, res) => {

    try {

        const db = readDB();

        const nome =
            String(
                req.query.paciente || ""
            ).trim();

        if (!nome) {
            return res.status(400).json({
                erro:
                    "Informe o paciente."
            });
        }

        const paciente =
            db.pacientes.find(p =>
                String(p.nome || "")
                    .trim()
                    .toLowerCase() ===
                nome.toLowerCase()
            );

        if (!paciente) {
            return res.status(404).json({
                erro:
                    "Paciente não encontrado."
            });
        }

        const altas =
            db.altas.filter(a =>
                String(a.paciente || "")
                    .trim()
                    .toLowerCase() ===
                nome.toLowerCase()
            );

        const consultas =
            db.consultas.filter(c =>
                String(c.paciente || "")
                    .trim()
                    .toLowerCase() ===
                nome.toLowerCase()
            );

        const internacoes =
            db.internacoes.filter(i =>
                String(i.paciente || "")
                    .trim()
                    .toLowerCase() ===
                nome.toLowerCase()
            );

        const ultimaAlta =
            altas.length
                ? altas[altas.length - 1]
                : null;

        const ultimaConsulta =
            consultas.length
                ? consultas[consultas.length - 1]
                : null;

        const data =
            new Date().toLocaleString(
                "pt-BR"
            );

        const linhas = [
            "HOSPITAL PRO",
            "",
            "DOCUMENTO DO PACIENTE",
            "",
            "Nome: " + paciente.nome,
            "CPF: " + (paciente.cpf || "Não informado"),
            "Tipo: " + (paciente.tipo || "Não informado"),
            "Status: " + (paciente.status || "Não informado"),
            "",
            "DATA: " + data,
            "",
            "CONSULTA",
            "Diagnóstico: " +
                (ultimaConsulta?.diagnostico ||
                 "Não informado"),
            "Medicação: " +
                (ultimaConsulta?.medicacao ||
                 "Não informado"),
            "Observações: " +
                (ultimaConsulta?.obs ||
                 "Não informado"),
            "",
            "ALTA",
            "Tipo: " +
                (ultimaAlta?.tipoAlta ||
                 "Não registrada"),
            "Motivo: " +
                (ultimaAlta?.motivo ||
                 "Não informado"),
            "Orientações: " +
                (ultimaAlta?.orientacoes ||
                 "Não informado"),
            "Observações: " +
                (ultimaAlta?.observacoes ||
                 "Não informado"),
            "",
            "INTERNAÇÃO",
            "Internações registradas: " +
                internacoes.length,
            ""
        ];

        const texto =
            linhas.join("\n");

        const escapePDF = valor =>
            String(valor)
                .replace(/\\/g, "\\\\")
                .replace(/\(/g, "\\(")
                .replace(/\)/g, "\\)")
                .replace(/\r/g, "");

        const conteudo =
            linhas
                .map(
                    linha =>
                        "(" +
                        escapePDF(linha) +
                        ") Tj"
                )
                .join("\n");

        const stream =
`BT
/F1 11 Tf
50 750 Td
14 TL
${conteudo}
ET`;

        const objetos = [];

        objetos.push(
`1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj`
        );

        objetos.push(
`2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj`
        );

        objetos.push(
`3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 595 842]
/Resources << /Font << /F1 4 0 R >> >>
/Contents 5 0 R
>>
endobj`
        );

        objetos.push(
`4 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj`
        );

        objetos.push(
`5 0 obj
<<
/Length ${Buffer.byteLength(stream, "utf8")}
>>
stream
${stream}
endstream
endobj`
        );

        let pdf =
            "%PDF-1.4\n";

        const offsets = [0];

        objetos.forEach(obj => {

            offsets.push(
                Buffer.byteLength(
                    pdf,
                    "utf8"
                )
            );

            pdf += obj + "\n";
        });

        const inicioXref =
            Buffer.byteLength(
                pdf,
                "utf8"
            );

        pdf +=
            "xref\n" +
            "0 " +
            (objetos.length + 1) +
            "\n";

        pdf +=
            "0000000000 65535 f \n";

        for (let i = 1; i < offsets.length; i++) {

            pdf +=
                String(offsets[i])
                    .padStart(10, "0") +
                " 00000 n \n";
        }

        pdf +=
            "trailer\n" +
            "<< /Size " +
            (objetos.length + 1) +
            " /Root 1 0 R >>\n" +
            "startxref\n" +
            inicioXref +
            "\n" +
            "%%EOF";

        const nomeArquivo =
            limparNome(nome) +
            "_" +
            Date.now() +
            ".pdf";

        const caminho =
            path.join(
                PDF_FOLDER,
                nomeArquivo
            );

        fs.writeFileSync(
            caminho,
            Buffer.from(pdf, "utf8")
        );

        res.json({
            sucesso: true,
            nome: nomeArquivo,
            url:
                "/arquivos-pdf/" +
                encodeURIComponent(
                    nomeArquivo
                )
        });

    } catch (erro) {

        console.error(
            "❌ Erro ao gerar PDF:",
            erro
        );

        res.status(500).json({
            erro:
                "Não foi possível gerar o PDF."
        });
    }
});

// ===============================
// LISTAR PDFs
// ===============================

app.get("/pdfs", (req, res) => {

    try {

        const paciente =
            String(
                req.query.paciente || ""
            )
            .trim()
            .toLowerCase();

        const arquivos =
            fs.readdirSync(
                PDF_FOLDER
            );

        const resultado =
            arquivos
                .filter(
                    arquivo =>
                        arquivo
                            .toLowerCase()
                            .endsWith(".pdf")
                )
                .filter(arquivo => {

                    if (!paciente) {
                        return true;
                    }

                    const busca =
                        limparNome(
                            paciente
                        ).toLowerCase();

                    return arquivo
                        .toLowerCase()
                        .includes(busca);
                })
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
            erro:
                "Erro ao listar PDFs."
        });
    }
});

// ===============================
// SERVIDOR
// ===============================

const PORT =
    process.env.PORT || 3000;

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🏥 Hospital Pro rodando na porta ${PORT}`
        );

    }
);
