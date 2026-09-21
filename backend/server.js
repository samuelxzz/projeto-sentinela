const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// CONFIGURAÇÕES
// =====================================================

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// =====================================================
// BANCO DE DADOS
// =====================================================

const DB_FILE = path.join(__dirname, "db.json");

function bancoInicial() {
    return {
        usuarios: [],
        pacientes: [],
        triagens: [],
        consultas: [],
        altas: [],
        tv_chamada: null,
        tv_historico: []
    };
}

function readDB() {

    if (!fs.existsSync(DB_FILE)) {

        const banco = bancoInicial();

        writeDB(banco);

        return banco;
    }

    try {

        const db = JSON.parse(
            fs.readFileSync(DB_FILE, "utf8")
        );

        if (!Array.isArray(db.usuarios)) {
            db.usuarios = [];
        }

        if (!Array.isArray(db.pacientes)) {
            db.pacientes = [];
        }

        if (!Array.isArray(db.triagens)) {
            db.triagens = [];
        }

        if (!Array.isArray(db.consultas)) {
            db.consultas = [];
        }

        if (!Array.isArray(db.altas)) {
            db.altas = [];
        }

        if (!("tv_chamada" in db)) {
            db.tv_chamada = null;
        }

        if (!Array.isArray(db.tv_historico)) {
            db.tv_historico = [];
        }

        return db;

    } catch (erro) {

        console.error(
            "Erro ao ler db.json:",
            erro
        );

        return bancoInicial();
    }
}

function writeDB(data) {

    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function normalizar(texto) {

    return String(texto || "")
        .trim()
        .toLowerCase();
}

function limparNome(nome) {

    return String(nome || "paciente")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
}

// =====================================================
// PDF
// =====================================================

const PDF_FOLDER = path.join(
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

// =====================================================
// CRIAR PDF DA ALTA
// =====================================================

function criarPDFAlta(alta) {

    const nomeArquivo =
        `alta_${limparNome(alta.paciente)}_${alta.id}.pdf`;

    const caminho =
        path.join(
            PDF_FOLDER,
            nomeArquivo
        );

    function textoPDF(texto) {

        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\\/g, "\\\\")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)")
            .replace(/\r?\n/g, " ");
    }

    const data =
        new Date(alta.createdAt)
            .toLocaleString("pt-BR");

    const linhas = [

        "SENTINELA - SISTEMA HOSPITALAR",

        "",

        "DOCUMENTO DE ALTA",

        "",

        "Paciente: " +
            alta.paciente,

        "Tipo de alta: " +
            alta.tipoAlta,

        "Data: " +
            data,

        "",

        "Motivo:",

        alta.motivo,

        "",

        "Orientacoes:",

        alta.orientacoes || "Nao informado",

        "",

        "Observacoes:",

        alta.observacoes || "Nao informado",

        "",

        "----------------------------------------",

        "",

        "Documento gerado pelo Sistema Sentinela."
    ];

    let conteudoStream =
        "BT\n";

    conteudoStream +=
        "/F1 12 Tf\n";

    conteudoStream +=
        "50 790 Td\n";

    linhas.forEach(
        (linha, indice) => {

            if (indice > 0) {

                conteudoStream +=
                    "0 -24 Td\n";
            }

            conteudoStream +=
                `(${textoPDF(linha)}) Tj\n`;
        }
    );

    conteudoStream +=
        "ET";

    const objetos = [];

    objetos.push(
        "<< /Type /Catalog /Pages 2 0 R >>"
    );

    objetos.push(
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"
    );

    objetos.push(
        "<< /Type /Page " +
        "/Parent 2 0 R " +
        "/MediaBox [0 0 595 842] " +
        "/Resources << " +
        "/Font << /F1 5 0 R >> " +
        ">> " +
        "/Contents 4 0 R >>"
    );

    objetos.push(
        "<< /Length " +
        Buffer.byteLength(
            conteudoStream,
            "utf8"
        ) +
        " >>\n" +
        "stream\n" +
        conteudoStream +
        "\nendstream"
    );

    objetos.push(
        "<< /Type /Font " +
        "/Subtype /Type1 " +
        "/BaseFont /Helvetica >>"
    );

    let pdf =
        "%PDF-1.4\n";

    const offsets = [0];

    objetos.forEach(
        (objeto, indice) => {

            offsets.push(
                Buffer.byteLength(
                    pdf,
                    "utf8"
                )
            );

            pdf +=
                `${indice + 1} 0 obj\n`;

            pdf +=
                objeto + "\n";

            pdf +=
                "endobj\n";
        }
    );

    const inicioXref =
        Buffer.byteLength(
            pdf,
            "utf8"
        );

    pdf +=
        "xref\n";

    pdf +=
        `0 ${objetos.length + 1}\n`;

    pdf +=
        "0000000000 65535 f \n";

    for (
        let i = 1;
        i < offsets.length;
        i++
    ) {

        pdf +=
            String(offsets[i])
                .padStart(10, "0") +
            " 00000 n \n";
    }

    pdf +=
        "trailer\n";

    pdf +=
        `<< /Size ${objetos.length + 1} /Root 1 0 R >>\n`;

    pdf +=
        "startxref\n";

    pdf +=
        `${inicioXref}\n`;

    pdf +=
        "%%EOF";

    fs.writeFileSync(
        caminho,
        Buffer.from(
            pdf,
            "utf8"
        )
    );

    return nomeArquivo;
}

// =====================================================
// LOGIN
// =====================================================

app.post(
    "/login",
    (req, res) => {

        const db = readDB();

        const usuario =
            db.usuarios.find(
                u =>
                    u.usuario ===
                        req.body.usuario &&
                    u.senha ===
                        req.body.senha
            );

        if (!usuario) {

            return res.status(401).json({
                erro: "Login inválido"
            });
        }

        res.json(usuario);
    }
);

// =====================================================
// ATENDIMENTO
// =====================================================

app.post(
    "/atendimento",
    (req, res) => {

        const db = readDB();

        const paciente = {

            id: Date.now(),

            nome:
                req.body.nome || "",

            cpf:
                req.body.cpf || "",

            tipo:
                req.body.tipo || "",

            status:
                "triagem",

            createdAt:
                new Date()
        };

        db.pacientes.push(
            paciente
        );

        writeDB(db);

        console.log(
            "Paciente cadastrado:",
            paciente.nome
        );

        res.json(
            paciente
        );
    }
);

// =====================================================
// LISTAR PACIENTES
// =====================================================

app.get(
    "/pacientes",
    (req, res) => {

        const db = readDB();

        res.json(
            db.pacientes
        );
    }
);

// =====================================================
// TRIAGEM
// =====================================================

app.post(
    "/triagem",
    (req, res) => {

        const db = readDB();

        const temperatura =
            Number(
                req.body.temperatura
            );

        let risco =
            req.body.risco;

        if (temperatura >= 39) {

            risco = "vermelho";

        } else if (
            temperatura >= 38
        ) {

            risco = "amarelo";

        } else if (!risco) {

            risco = "verde";
        }

        const triagem = {

            id:
                Date.now(),

            nome:
                req.body.nome || "",

            sintoma:
                req.body.sintoma || "",

            temperatura:
                Number.isFinite(
                    temperatura
                )
                    ? temperatura
                    : "",

            alergia:
                req.body.alergia || "",

            observacao:
                req.body.observacao || "",

            risco:
                risco,

            status:
                "aguardando_medico",

            createdAt:
                new Date()
        };

        db.triagens.push(
            triagem
        );

        const paciente =
            db.pacientes.find(
                p =>
                    normalizar(p.nome) ===
                    normalizar(triagem.nome)
            );

        if (paciente) {

            paciente.status =
                "aguardando_medico";
        }

        writeDB(db);

        res.json(
            triagem
        );
    }
);

// =====================================================
// LISTAR TRIAGENS
// =====================================================

app.get(
    "/triagens",
    (req, res) => {

        const db = readDB();

        const triagens =
            db.triagens.filter(
                t =>
                    !t.status ||
                    t.status ===
                        "aguardando_medico"
            );

        res.json(
            triagens
        );
    }
);

// =====================================================
// TV - CHAMAR
// =====================================================

app.post(
    "/tv/chamar",
    (req, res) => {

        const db = readDB();

        const chamada = {

            id:
                Date.now().toString(),

            localTipo:
                req.body.localTipo || "",

            localNumero:
                req.body.localNumero || "",

            paciente:
                req.body.paciente || "",

            hora:
                new Date().toLocaleTimeString(
                    "pt-BR",
                    {
                        hour: "2-digit",
                        minute: "2-digit"
                    }
                )
        };

        db.tv_chamada =
            chamada;

        db.tv_historico.unshift(
            chamada
        );

        if (
            db.tv_historico.length > 5
        ) {

            db.tv_historico.pop();
        }

        writeDB(db);

        res.json(
            chamada
        );
    }
);

// =====================================================
// TV - CONSULTAR
// =====================================================

app.get(
    "/tv/chamada",
    (req, res) => {

        const db = readDB();

        res.json({

            chamada:
                db.tv_chamada,

            historico:
                db.tv_historico
        });
    }
);

// =====================================================
// MEDICAÇÕES
// =====================================================

app.get(
    "/lista-medicacoes",
    (req, res) => {

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
    }
);

// =====================================================
// CONSULTA MÉDICA
// =====================================================

app.post(
    "/consulta",
    (req, res) => {

        const db = readDB();

        const consulta = {

            id:
                Date.now(),

            paciente:
                req.body.paciente || "",

            diagnostico:
                req.body.diagnostico || "",

            medicacao:
                req.body.medicacao || "",

            obs:
                req.body.obs || "",

            createdAt:
                new Date()
        };

        db.consultas.push(
            consulta
        );

        const triagem =
            db.triagens.find(
                t =>
                    normalizar(t.nome) ===
                        normalizar(
                            consulta.paciente
                        ) &&
                    (
                        !t.status ||
                        t.status ===
                            "aguardando_medico"
                    )
            );

        if (triagem) {

            triagem.status =
                "atendido";
        }

        const paciente =
            db.pacientes.find(
                p =>
                    normalizar(p.nome) ===
                    normalizar(
                        consulta.paciente
                    )
            );

        if (paciente) {

            paciente.status =
                "atendido";
        }

        writeDB(db);

        res.json(
            consulta
        );
    }
);

// =====================================================
// LISTAR CONSULTAS
// =====================================================

app.get(
    "/medicacoes",
    (req, res) => {

        const db = readDB();

        res.json(
            db.consultas
        );
    }
);

// =====================================================
// ALTA DO PACIENTE + PDF
// =====================================================

app.post(
    "/alta",
    (req, res) => {

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

            // -----------------------------
            // VALIDAÇÕES
            // -----------------------------

            if (!pacienteNome) {

                return res.status(400).json({
                    erro:
                        "Paciente não informado."
                });
            }

            if (!tipoAlta) {

                return res.status(400).json({
                    erro:
                        "Tipo de alta não informado."
                });
            }

            if (!motivo) {

                return res.status(400).json({
                    erro:
                        "Motivo da alta não informado."
                });
            }

            // -----------------------------
            // ENCONTRAR PACIENTE
            // -----------------------------

            const paciente =
                db.pacientes.find(
                    p =>
                        normalizar(p.nome) ===
                        normalizar(
                            pacienteNome
                        )
                );

            if (!paciente) {

                return res.status(404).json({
                    erro:
                        "Paciente não encontrado."
                });
            }

            // -----------------------------
            // ENCONTRAR TRIAGEM
            // -----------------------------

            const triagem =
                db.triagens.find(
                    t =>
                        normalizar(t.nome) ===
                            normalizar(
                                pacienteNome
                            ) &&
                        (
                            !t.status ||
                            t.status ===
                                "aguardando_medico" ||
                            t.status ===
                                "atendido"
                        )
                );

            // -----------------------------
            // CRIAR ALTA
            // -----------------------------

            const alta = {

                id:
                    Date.now(),

                paciente:
                    paciente.nome,

                tipoAlta:
                    tipoAlta,

                motivo:
                    motivo,

                orientacoes:
                    orientacoes,

                observacoes:
                    observacoes,

                createdAt:
                    new Date()
            };

            // -----------------------------
            // SALVAR ALTA
            // -----------------------------

            db.altas.push(
                alta
            );

            // -----------------------------
            // ATUALIZAR TRIAGEM
            // -----------------------------

            if (triagem) {

                triagem.status =
                    "alta";
            }

            // -----------------------------
            // ATUALIZAR PACIENTE
            // -----------------------------

            paciente.status =
                "alta";

            // -----------------------------
            // SALVAR BANCO
            // -----------------------------

            writeDB(db);

            // -----------------------------
            // GERAR PDF
            // -----------------------------

            const nomePDF =
                criarPDFAlta(
                    alta
                );

            const urlPDF =
                "/arquivos-pdf/" +
                encodeURIComponent(
                    nomePDF
                );

            console.log(
                "Alta registrada:",
                paciente.nome
            );

            console.log(
                "PDF criado:",
                nomePDF
            );

            // -----------------------------
            // RESPONDER PARA O FRONTEND
            // -----------------------------

            res.status(200).json({

                sucesso:
                    true,

                mensagem:
                    "Alta registrada com sucesso!",

                alta:
                    alta,

                pdf:
                    urlPDF,

                arquivo:
                    nomePDF
            });

        } catch (erro) {

            console.error(
                "ERRO NA ALTA:",
                erro
            );

            res.status(500).json({

                erro:
                    "Erro interno ao registrar a alta."
            });
        }
    }
);

// =====================================================
// LISTAR ALTAS
// =====================================================

app.get(
    "/altas",
    (req, res) => {

        const db = readDB();

        res.json(
            db.altas
        );
    }
);

// =====================================================
// BUSCAR ALTA DE UM PACIENTE
// =====================================================

app.get(
    "/alta",
    (req, res) => {

        const db = readDB();

        const paciente =
            String(
                req.query.paciente ||
                ""
            ).trim();

        if (!paciente) {

            return res.status(400).json({
                erro:
                    "Informe o paciente."
            });
        }

        const altas =
            db.altas.filter(
                a =>
                    normalizar(
                        a.paciente
                    ) ===
                    normalizar(
                        paciente
                    )
            );

        res.json(
            altas
        );
    }
);

// =====================================================
// UPLOAD DE PDF
// =====================================================

app.post(
    "/pdfs/upload",
    (req, res) => {

        const contentType =
            req.headers["content-type"] ||
            "";

        if (
            !contentType.includes(
                "multipart/form-data"
            )
        ) {

            return res.status(400).json({

                erro:
                    "O envio precisa ser feito como arquivo PDF."
            });
        }

        const boundaryMatch =
            contentType.match(
                /boundary=(?:"([^"]+)"|([^;]+))/
            );

        if (!boundaryMatch) {

            return res.status(400).json({

                erro:
                    "Boundary do arquivo não encontrado."
            });
        }

        const boundary =
            boundaryMatch[1] ||
            boundaryMatch[2];

        const partes = [];

        req.on(
            "data",
            parte => {
                partes.push(
                    parte
                );
            }
        );

        req.on(
            "end",
            () => {

                try {

                    const buffer =
                        Buffer.concat(
                            partes
                        );

                    const marcador =
                        Buffer.from(
                            "--" +
                            boundary
                        );

                    const campos = [];

                    let inicio = 0;

                    while (true) {

                        const posicao =
                            buffer.indexOf(
                                marcador,
                                inicio
                            );

                        if (
                            posicao === -1
                        ) {
                            break;
                        }

                        if (
                            posicao !== inicio
                        ) {

                            let parte =
                                buffer.slice(
                                    inicio,
                                    posicao
                                );

                            if (
                                parte.length >= 2 &&
                                parte[0] === 13 &&
                                parte[1] === 10
                            ) {

                                parte =
                                    parte.slice(2);
                            }

                            if (
                                parte.length > 0
                            ) {

                                campos.push(
                                    parte
                                );
                            }
                        }

                        inicio =
                            posicao +
                            marcador.length;
                    }

                    let paciente =
                        "paciente";

                    let arquivoPDF =
                        null;

                    for (
                        const parte
                        of campos
                    ) {

                        const separador =
                            Buffer.from(
                                "\r\n\r\n"
                            );

                        const fimCabecalho =
                            parte.indexOf(
                                separador
                            );

                        if (
                            fimCabecalho === -1
                        ) {
                            continue;
                        }

                        const cabecalho =
                            parte
                                .slice(
                                    0,
                                    fimCabecalho
                                )
                                .toString(
                                    "utf8"
                                );

                        let conteudo =
                            parte.slice(
                                fimCabecalho +
                                separador.length
                            );

                        if (
                            conteudo.length >= 2 &&
                            conteudo[
                                conteudo.length - 2
                            ] === 13 &&
                            conteudo[
                                conteudo.length - 1
                            ] === 10
                        ) {

                            conteudo =
                                conteudo.slice(
                                    0,
                                    conteudo.length - 2
                                );
                        }

                        const nomeMatch =
                            cabecalho.match(
                                /name="([^"]+)"/i
                            );

                        if (!nomeMatch) {
                            continue;
                        }

                        const nomeCampo =
                            nomeMatch[1];

                        const arquivoMatch =
                            cabecalho.match(
                                /filename="([^"]*)"/i
                            );

                        if (
                            nomeCampo ===
                            "paciente"
                        ) {

                            paciente =
                                conteudo.toString(
                                    "utf8"
                                );
                        }

                        if (
                            nomeCampo === "pdf" &&
                            arquivoMatch
                        ) {

                            arquivoPDF = {

                                nome:
                                    arquivoMatch[1],

                                conteudo:
                                    conteudo
                            };
                        }
                    }

                    if (!arquivoPDF) {

                        return res.status(400).json({

                            erro:
                                "Nenhum arquivo PDF foi enviado."
                        });
                    }

                    const extensao =
                        path.extname(
                            arquivoPDF.nome
                        ).toLowerCase();

                    if (
                        extensao !== ".pdf"
                    ) {

                        return res.status(400).json({

                            erro:
                                "Somente arquivos PDF são permitidos."
                        });
                    }

                    const nomePaciente =
                        limparNome(
                            paciente
                        );

                    const nomeOriginal =
                        limparNome(
                            path.basename(
                                arquivoPDF.nome,
                                ".pdf"
                            )
                        );

                    const nomeFinal =
                        `${nomePaciente}_${Date.now()}_${nomeOriginal}.pdf`;

                    const caminho =
                        path.join(
                            PDF_FOLDER,
                            nomeFinal
                        );

                    fs.writeFileSync(
                        caminho,
                        arquivoPDF.conteudo
                    );

                    res.json({

                        sucesso:
                            true,

                        mensagem:
                            "PDF enviado com sucesso!",

                        arquivo:
                            nomeFinal,

                        url:
                            "/arquivos-pdf/" +
                            encodeURIComponent(
                                nomeFinal
                            )
                    });

                } catch (erro) {

                    console.error(
                        "Erro ao salvar PDF:",
                        erro
                    );

                    res.status(500).json({

                        erro:
                            "Erro ao salvar o PDF."
                    });
                }
            }
        );
    }
);

// =====================================================
// LISTAR PDFs
// =====================================================

app.get(
    "/pdfs",
    (req, res) => {

        try {

            const paciente =
                String(
                    req.query.paciente ||
                    ""
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

                    .filter(
                        arquivo => {

                            if (!paciente) {
                                return true;
                            }

                            const nomeBusca =
                                limparNome(
                                    paciente
                                ).toLowerCase();

                            return arquivo
                                .toLowerCase()
                                .includes(
                                    nomeBusca
                                );
                        }
                    )

                    .map(
                        arquivo => ({

                            nome:
                                arquivo,

                            url:
                                "/arquivos-pdf/" +
                                encodeURIComponent(
                                    arquivo
                                )
                        })
                    );

            res.json(
                resultado
            );

        } catch (erro) {

            console.error(
                erro
            );

            res.status(500).json({

                erro:
                    "Não foi possível carregar os PDFs."
            });
        }
    }
);

// =====================================================
// TESTE
// =====================================================

app.get(
    "/teste",
    (req, res) => {

        res.json({

            sucesso:
                true,

            mensagem:
                "Servidor do Sentinela funcionando!"
        });
    }
);

// =====================================================
// INICIAR SERVIDOR
// =====================================================

app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "===================================="
        );

        console.log(
            "🏥 SENTINELA"
        );

        console.log(
            "===================================="
        );

        console.log(
            `🚀 Servidor rodando em http://localhost:${PORT}`
        );

        console.log(
            `📋 Pacientes: http://localhost:${PORT}/pacientes`
        );

        console.log(
            `🩺 Triagens: http://localhost:${PORT}/triagens`
        );

        console.log(
            `🟢 Altas: http://localhost:${PORT}/altas`
        );

        console.log(
            `📄 PDFs: http://localhost:${PORT}/pdfs`
        );

        console.log(
            "===================================="
        );
    }
);
