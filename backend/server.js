const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

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

    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

    if (!db.usuarios) db.usuarios = [];
    if (!db.pacientes) db.pacientes = [];
    if (!db.triagens) db.triagens = [];
    if (!db.consultas) db.consultas = [];
    if (!db.altas) db.altas = [];
    if (!db.tv_chamada) db.tv_chamada = null;
    if (!db.tv_historico) db.tv_historico = [];

    return db;
}

function writeDB(data) {
    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(data, null, 2)
    );
}

// ===============================
// PASTA DOS PDFs
// ===============================

const PDF_FOLDER = path.join(__dirname, "pdfs");

if (!fs.existsSync(PDF_FOLDER)) {
    fs.mkdirSync(PDF_FOLDER, { recursive: true });
}

app.use(
    "/arquivos-pdf",
    express.static(PDF_FOLDER)
);

// ===============================
// LOGIN
// ===============================

app.post("/login", (req, res) => {
    const db = readDB();

    const user = db.usuarios.find(
        u =>
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

// ===============================
// ATENDIMENTO
// ===============================

app.post("/atendimento", (req, res) => {
    const db = readDB();

    const paciente = {
        id: Date.now(),
        nome: req.body.nome,
        cpf: req.body.cpf,
        tipo: req.body.tipo,
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
        risco: risco,
        status: "aguardando_medico",
        createdAt: new Date()
    };

    db.triagens.push(triagem);

    writeDB(db);

    res.json(triagem);
});

// ===============================
// LISTAR TRIAGENS
// ===============================

app.get("/triagens", (req, res) => {
    const db = readDB();

    res.json(db.triagens);
});

// ===============================
// TV
// ===============================

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

// ===============================
// LISTA DE MEDICAÇÕES
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
        paciente: req.body.paciente,
        diagnostico: req.body.diagnostico,
        medicacao: req.body.medicacao,
        obs: req.body.obs,
        createdAt: new Date()
    };

    db.consultas.push(consulta);

    writeDB(db);

    res.json(consulta);
});

// ===============================
// MEDICAÇÕES
// ===============================

app.get("/medicacoes", (req, res) => {
    const db = readDB();

    res.json(db.consultas);
});

// ===============================
// FUNÇÃO PARA LIMPAR NOME
// ===============================

function limparNome(nome) {
    return String(nome || "paciente")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();
}

// ===============================
// CRIAR PDF
// ===============================

function criarPDF(paciente, alta) {

    const nomeArquivo =
        `alta_${limparNome(paciente.nome)}_${paciente.id}.pdf`;

    const caminhoArquivo =
        path.join(PDF_FOLDER, nomeArquivo);

    const nome = paciente.nome || "Não informado";
    const cpf = paciente.cpf || "Não informado";
    const tipo = paciente.tipo || "Não informado";

    const motivo =
        alta.motivo ||
        "Alta hospitalar";

    const observacoes =
        alta.observacoes ||
        "Nenhuma observação.";

    const data =
        new Date().toLocaleString("pt-BR");

    function escapar(texto) {
        return String(texto)
            .replace(/\\/g, "\\\\")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)");
    }

    const linhas = [
        "HOSPITAL PRO",
        "DOCUMENTO DE ALTA DO PACIENTE",
        "",
        `Paciente: ${nome}`,
        `CPF: ${cpf}`,
        `Tipo: ${tipo}`,
        "",
        `Data da alta: ${data}`,
        `Motivo: ${motivo}`,
        "",
        `Observacoes: ${observacoes}`,
        "",
        "Alta registrada pelo sistema hospitalar."
    ];

    let conteudo = "BT\n";
    conteudo += "/F1 12 Tf\n";
    conteudo += "50 750 Td\n";

    linhas.forEach((linha, index) => {

        if (index === 0) {
            conteudo += "/F1 18 Tf\n";
        } else if (index === 1) {
            conteudo += "/F1 14 Tf\n";
        } else {
            conteudo += "/F1 12 Tf\n";
        }

        conteudo += `(${escapar(linha)}) Tj\n`;
        conteudo += "0 -25 Td\n";
    });

    conteudo += "ET";

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
        "/Contents 4 0 R " +
        "/Resources << /Font << /F1 5 0 R >> >> >>"
    );

    objetos.push(
        `<< /Length ${Buffer.byteLength(conteudo, "utf8")} >>\nstream\n${conteudo}\nendstream`
    );

    objetos.push(
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    );

    let pdf = "%PDF-1.4\n";

    const offsets = [];

    objetos.forEach((objeto, index) => {

        offsets[index + 1] =
            Buffer.byteLength(pdf, "utf8");

        pdf += `${index + 1} 0 obj\n`;
        pdf += objeto;
        pdf += "\nendobj\n";
    });

    const inicioXref =
        Buffer.byteLength(pdf, "utf8");

    pdf += "xref\n";
    pdf += `0 ${objetos.length + 1}\n`;
    pdf += "0000000000 65535 f \n";

    for (let i = 1; i <= objetos.length; i++) {

        pdf +=
            String(offsets[i]).padStart(10, "0") +
            " 00000 n \n";
    }

    pdf += "trailer\n";
    pdf += `<< /Size ${objetos.length + 1} /Root 1 0 R >>\n`;
    pdf += "startxref\n";
    pdf += `${inicioXref}\n`;
    pdf += "%%EOF";

    fs.writeFileSync(
        caminhoArquivo,
        Buffer.from(pdf, "utf8")
    );

    return nomeArquivo;
}

// ===============================
// REGISTRAR ALTA + GERAR PDF
// ===============================

app.post("/alta", (req, res) => {

    try {

        const db = readDB();

        const nomePaciente =
            req.body.paciente ||
            req.body.nome;

        if (!nomePaciente) {
            return res.status(400).json({
                erro: "Paciente não informado."
            });
        }

        const paciente =
            db.pacientes.find(
                p =>
                    String(p.nome).toLowerCase() ===
                    String(nomePaciente).toLowerCase()
            );

        if (!paciente) {
            return res.status(404).json({
                erro: "Paciente não encontrado."
            });
        }

        const alta = {
            id: Date.now(),
            pacienteId: paciente.id,
            paciente: paciente.nome,
            motivo:
                req.body.motivo ||
                req.body.tipoAlta ||
                "Alta hospitalar",
            observacoes:
                req.body.observacoes ||
                req.body.obs ||
                "Nenhuma observação.",
            data: new Date()
        };

        db.altas.push(alta);

        // Atualiza o status do paciente
        paciente.status = "alta";

        // Atualiza a triagem
        db.triagens.forEach(triagem => {

            if (
                String(triagem.nome).toLowerCase() ===
                String(paciente.nome).toLowerCase()
            ) {
                triagem.status = "alta";
            }
        });

        writeDB(db);

        // Gera o PDF
        const nomeArquivo =
            criarPDF(paciente, alta);

        res.json({
            sucesso: true,
            mensagem: "Alta registrada com sucesso.",
            arquivo: nomeArquivo,
            download: `/baixar-alta/${encodeURIComponent(nomeArquivo)}`
        });

    } catch (erro) {

        console.error("ERRO NA ALTA:", erro);

        res.status(500).json({
            erro: "Erro ao registrar a alta."
        });
    }
});

// ===============================
// BAIXAR PDF DA ALTA
// ===============================

app.get("/baixar-alta/:arquivo", (req, res) => {

    const arquivo =
        path.basename(req.params.arquivo);

    const caminho =
        path.join(PDF_FOLDER, arquivo);

    if (!fs.existsSync(caminho)) {
        return res.status(404).send(
            "PDF não encontrado."
        );
    }

    res.download(
        caminho,
        arquivo
    );
});

// ===============================
// LISTAR PDFs DO PACIENTE
// ===============================

app.get("/pdfs", (req, res) => {

    const paciente =
        req.query.paciente;

    if (!fs.existsSync(PDF_FOLDER)) {
        return res.json([]);
    }

    const arquivos =
        fs.readdirSync(PDF_FOLDER)
            .filter(arquivo =>
                arquivo.toLowerCase().endsWith(".pdf")
            );

    if (!paciente) {
        return res.json(
            arquivos.map(nome => ({
                nome: nome,
                url: `/baixar-alta/${encodeURIComponent(nome)}`
            }))
        );
    }

    const nomeLimpo =
        limparNome(paciente);

    const encontrados =
        arquivos.filter(arquivo =>
            arquivo.toLowerCase().includes(nomeLimpo)
        );

    res.json(
        encontrados.map(nome => ({
            nome: nome,
            url: `/baixar-alta/${encodeURIComponent(nome)}`
        }))
    );
});

// ===============================
// LISTAR ALTAS
// ===============================

app.get("/altas", (req, res) => {

    const db = readDB();

    res.json(db.altas);
});

// ===============================
// TESTE
// ===============================

app.get("/teste", (req, res) => {

    res.json({
        sucesso: true,
        mensagem: "Servidor funcionando!"
    });
});

// ===============================
// INICIAR SERVIDOR
// ===============================

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `🏥 Hospital Pro rodando na porta ${PORT}`
    );

});
