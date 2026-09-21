const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

// ==========================================
// FRONTEND
// ==========================================

app.use(express.static(path.join(__dirname, "../frontend")));

// ==========================================
// BANCO DE DADOS
// ==========================================

const DB_FILE = path.join(__dirname, "db.json");

function readDB() {
    if (!fs.existsSync(DB_FILE)) {

        const bancoInicial = {
            usuarios: [],
            pacientes: [],
            triagens: [],
            consultas: [],
            altas: [],
            tv_chamada: null,
            tv_historico: []
        };

        fs.writeFileSync(
            DB_FILE,
            JSON.stringify(bancoInicial, null, 2)
        );

        return bancoInicial;
    }

    const db = JSON.parse(
        fs.readFileSync(DB_FILE, "utf8")
    );

    if (!Array.isArray(db.usuarios))
        db.usuarios = [];

    if (!Array.isArray(db.pacientes))
        db.pacientes = [];

    if (!Array.isArray(db.triagens))
        db.triagens = [];

    if (!Array.isArray(db.consultas))
        db.consultas = [];

    if (!Array.isArray(db.altas))
        db.altas = [];

    if (!Array.isArray(db.tv_historico))
        db.tv_historico = [];

    if (!Object.prototype.hasOwnProperty.call(db, "tv_chamada")) {
        db.tv_chamada = null;
    }

    return db;
}

function writeDB(data) {
    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(data, null, 2)
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


// ==========================================
// PERMITIR ABRIR PDF
// ==========================================

app.use(
    "/arquivos-pdf",
    express.static(PDF_FOLDER)
);


// ==========================================
// LOGIN
// ==========================================

app.post("/login", (req, res) => {

    const db = readDB();

    const user = db.usuarios.find(u =>
        u.usuario === req.body.usuario &&
        u.senha === req.body.senha
    );

    if (!user) {
        return res.status(401).json({
            erro: "Login inválido"
        });
    }

    res.json(user);
});


// ==========================================
// ATENDIMENTO
// ==========================================

app.post("/atendimento", (req, res) => {

    const db = readDB();

    const paciente = {
        id: Date.now(),
        nome: req.body.nome,
        cpf: req.body.cpf,
        tipo: req.body.tipo,
        status: "triagem",
        createdAt: new Date().toISOString()
    };

    db.pacientes.push(paciente);

    writeDB(db);

    res.json(paciente);
});


// ==========================================
// LISTAR PACIENTES
// ==========================================

app.get("/pacientes", (req, res) => {

    const db = readDB();

    res.json(db.pacientes);
});


// ==========================================
// TRIAGEM
// ==========================================

app.post("/triagem", (req, res) => {

    const db = readDB();

    let risco = req.body.risco;

    if (req.body.temperatura >= 39) {

        risco = "vermelho";

    } else if (req.body.temperatura >= 38) {

        risco = "amarelo";

    } else if (!risco) {

        risco = "verde";
    }

    const triagem = {

        id: Date.now(),

        nome: req.body.nome,

        sintoma: req.body.sintoma,

        temperatura: req.body.temperatura,

        alergia: req.body.alergia,

        observacao: req.body.observacao,

        risco,

        status: "aguardando_medico",

        createdAt: new Date().toISOString()
    };

    db.triagens.push(triagem);

    writeDB(db);

    res.json(triagem);
});


// ==========================================
// LISTAR TRIAGENS
// ==========================================

app.get("/triagens", (req, res) => {

    const db = readDB();

    res.json(db.triagens);
});


// ==========================================
// TV
// ==========================================

app.post("/tv/chamar", (req, res) => {

    const db = readDB();

    const chamada = {

        id: Date.now().toString(),

        localTipo: req.body.localTipo,

        localNumero: req.body.localNumero,

        paciente: req.body.paciente,

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


// ==========================================
// LISTA DE MEDICAÇÕES
// ==========================================

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


// ==========================================
// CONSULTA
// ==========================================

app.post("/consulta", (req, res) => {

    const db = readDB();

    const consulta = {

        id: Date.now(),

        paciente: req.body.paciente,

        diagnostico: req.body.diagnostico,

        medicacao: req.body.medicacao,

        obs: req.body.obs,

        createdAt: new Date().toISOString()
    };

    db.consultas.push(consulta);

    writeDB(db);

    res.json(consulta);
});


// ==========================================
// MEDICAÇÕES
// ==========================================

app.get("/medicacoes", (req, res) => {

    const db = readDB();

    res.json(db.consultas);
});


// ==========================================
// GERAR PDF
// ==========================================

function criarPDFPaciente(
    paciente,
    alta,
    triagem,
    consultas,
    caminhoArquivo
) {

    function textoPDF(texto) {

        return String(texto || "Não informado")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\\/g, "\\\\")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)")
            .replace(/\r?\n/g, " ");
    }

    const data = new Date();

    const dataAtual =
        data.toLocaleDateString("pt-BR");

    const horaAtual =
        data.toLocaleTimeString("pt-BR");

    const linhas = [

        "DOCUMENTO DO PACIENTE",

        "",

        "====================================",

        "DADOS DO PACIENTE",

        "Nome: " + textoPDF(paciente.nome),

        "CPF: " + textoPDF(paciente.cpf),

        "Tipo: " + textoPDF(paciente.tipo),

        "Status: " + textoPDF(paciente.status),

        "",

        "DADOS DA ALTA",

        "Tipo de alta: " +
        textoPDF(alta.tipoAlta),

        "Motivo: " +
        textoPDF(alta.motivo),

        "Orientacoes: " +
        textoPDF(alta.orientacoes),

        "Observacoes: " +
        textoPDF(alta.observacoes),

        "",

        "DADOS DA TRIAGEM",

        "Sintoma: " +
        textoPDF(triagem?.sintoma),

        "Temperatura: " +
        textoPDF(triagem?.temperatura),

        "Alergia: " +
        textoPDF(triagem?.alergia),

        "Risco: " +
        textoPDF(triagem?.risco),

        "Observacao: " +
        textoPDF(triagem?.observacao),

        "",

        "CONSULTAS",

        consultas.length > 0
            ? "Quantidade de consultas: " + consultas.length
            : "Nenhuma consulta registrada.",

        "",

        "Documento gerado em: " +
        dataAtual +
        " " +
        horaAtual,

        "",

        "Sistema Hospitalar Sentinela"
    ];


    let comandos = [];

    comandos.push("BT");

    comandos.push("/F1 18 Tf");

    comandos.push("50 790 Td");

    comandos.push(
        "(" +
        textoPDF(linhas[0]) +
        ") Tj"
    );

    comandos.push("/F1 10 Tf");

    for (let i = 1; i < linhas.length; i++) {

        comandos.push("0 -18 Td");

        comandos.push(
            "(" +
            textoPDF(linhas[i]) +
            ") Tj"
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
        Buffer.byteLength(conteudo, "utf8") +
        " >>\n" +
        "stream\n" +
        conteudo +
        "\nendstream"
    );


    objetos.push(
        "<< /Type /Font " +
        "/Subtype /Type1 " +
        "/BaseFont /Helvetica >>"
    );


    let pdf = "%PDF-1.4\n";

    const offsets = [0];


    for (
        let i = 0;
        i < objetos.length;
        i++
    ) {

        offsets.push(
            Buffer.byteLength(pdf, "utf8")
        );

        pdf +=
            `${i + 1} 0 obj\n`;

        pdf +=
            objetos[i] +
            "\n";

        pdf +=
            "endobj\n";
    }


    const inicioXref =
        Buffer.byteLength(pdf, "utf8");


    pdf += "xref\n";

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


    pdf += "trailer\n";

    pdf +=
        `<< /Size ${objetos.length + 1} /Root 1 0 R >>\n`;

    pdf += "startxref\n";

    pdf += inicioXref + "\n";

    pdf += "%%EOF";


    fs.writeFileSync(
        caminhoArquivo,
        Buffer.from(pdf, "utf8")
    );
}


// ==========================================
// REGISTRAR ALTA
// ==========================================

app.post("/alta", (req, res) => {

    try {

        const db = readDB();

        const nomePaciente =
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


        // -------------------------------
        // VALIDAR PACIENTE
        // -------------------------------

        if (!nomePaciente) {

            return res.status(400).json({
                erro: "Selecione um paciente."
            });
        }


        const paciente =
            db.pacientes.find(p =>
                normalizar(p.nome) ===
                normalizar(nomePaciente)
            );


        if (!paciente) {

            return res.status(404).json({
                erro: "Paciente não encontrado."
            });
        }


        // -------------------------------
        // VALIDAR ALTA
        // -------------------------------

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


        // -------------------------------
        // CRIAR ALTA
        // -------------------------------

        const alta = {

            id: Date.now(),

            pacienteId:
                paciente.id,

            paciente:
                paciente.nome,

            tipoAlta,

            motivo,

            orientacoes,

            observacoes,

            createdAt:
                new Date().toISOString()
        };


        db.altas.push(alta);


        // -------------------------------
        // ALTERAR STATUS DO PACIENTE
        // -------------------------------

        paciente.status = "alta";


        // -------------------------------
        // ENCONTRAR TRIAGEM
        // -------------------------------

        const triagem =
            db.triagens.find(t =>
                normalizar(t.nome) ===
                normalizar(paciente.nome)
            );


        if (triagem) {

            triagem.status = "alta";
        }


        // -------------------------------
        // CONSULTAS DO PACIENTE
        // -------------------------------

        const consultas =
            db.consultas.filter(c =>
                normalizar(c.paciente) ===
                normalizar(paciente.nome)
            );


        // -------------------------------
        // SALVAR
        // -------------------------------

        writeDB(db);


        // -------------------------------
        // GERAR PDF
        // -------------------------------

        const nomePDF =
            `paciente_${limparNome(paciente.nome)}_${Date.now()}.pdf`;


        const caminhoPDF =
            path.join(
                PDF_FOLDER,
                nomePDF
            );


        criarPDFPaciente(
            paciente,
            alta,
            triagem,
            consultas,
            caminhoPDF
        );


        // -------------------------------
        // RESPOSTA
        // -------------------------------

        res.json({

            sucesso: true,

            mensagem:
                "Alta registrada e PDF gerado!",

            alta,

            pdf:
                "/download-pdf/" +
                encodeURIComponent(nomePDF),

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
});


// ==========================================
// BAIXAR PDF DO PACIENTE
// ==========================================

app.get(
    "/download-pdf/:arquivo",
    (req, res) => {

        try {

            const arquivo =
                path.basename(
                    req.params.arquivo
                );

            const caminho =
                path.join(
                    PDF_FOLDER,
                    arquivo
                );


            if (!fs.existsSync(caminho)) {

                return res.status(404).json({
                    erro: "PDF não encontrado."
                });
            }


            res.download(
                caminho,
                arquivo,
                erro => {

                    if (erro) {

                        console.error(
                            "Erro no download:",
                            erro
                        );
                    }
                }
            );


        } catch (erro) {

            console.error(erro);

            res.status(500).json({
                erro: "Erro ao baixar PDF."
            });
        }
    }
);


// ==========================================
// LISTAR ALTAS
// ==========================================

app.get("/altas", (req, res) => {

    const db = readDB();

    res.json(db.altas);
});


// ==========================================
// TESTE
// ==========================================

app.get("/teste", (req, res) => {

    res.json({
        sucesso: true,
        mensagem:
            "Servidor do Sentinela funcionando!"
    });
});


// ==========================================
// PORTA
// ==========================================

const PORT =
    process.env.PORT || 3000;


app.listen(PORT, () => {

    console.log(
        `🏥 Hospital Pro rodando na porta ${PORT}`
    );

});
