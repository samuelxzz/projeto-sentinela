const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

/* =====================================================
   FRONTEND
===================================================== */

const FRONTEND = path.join(__dirname, "../frontend");

app.use(express.static(FRONTEND));


/* =====================================================
   BANCO DE DADOS
===================================================== */

const DB_FILE = path.join(__dirname, "db.json");


function readDB() {

    if (!fs.existsSync(DB_FILE)) {

        return {
            usuarios: [],
            pacientes: [],
            triagens: [],
            consultas: [],
            tv_chamada: null,
            tv_historico: []
        };

    }

    const db = JSON.parse(
        fs.readFileSync(DB_FILE, "utf8")
    );


    if (!db.usuarios) db.usuarios = [];
    if (!db.pacientes) db.pacientes = [];
    if (!db.triagens) db.triagens = [];
    if (!db.consultas) db.consultas = [];

    if (!db.tv_chamada) {
        db.tv_chamada = null;
    }

    if (!db.tv_historico) {
        db.tv_historico = [];
    }

    return db;
}


function writeDB(data) {

    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(data, null, 2),
        "utf8"
    );

}


/* =====================================================
   TESTE DO SERVIDOR
===================================================== */

app.get("/teste", (req, res) => {

    res.json({
        sucesso: true,
        mensagem: "Servidor do Sentinela funcionando!"
    });

});


/* =====================================================
   LOGIN
===================================================== */

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


/* =====================================================
   ATENDIMENTO
   CADASTRAR PACIENTE
===================================================== */

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


/* =====================================================
   LISTAR PACIENTES
===================================================== */

app.get("/pacientes", (req, res) => {

    const db = readDB();

    res.json(db.pacientes);

});


/* =====================================================
   TRIAGEM
===================================================== */

app.post("/triagem", (req, res) => {

    const db = readDB();


    let risco = req.body.risco;


    const temperatura =
        Number(req.body.temperatura);


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

        temperatura: temperatura,

        alergia: req.body.alergia || "",

        observacao: req.body.observacao || "",

        risco: risco,

        status: "aguardando_medico",

        createdAt: new Date()

    };


    db.triagens.push(triagem);

    writeDB(db);


    res.json(triagem);

});


/* =====================================================
   LISTAR TRIAGENS
===================================================== */

app.get("/triagens", (req, res) => {

    const db = readDB();

    console.log(
        "📋 Triagens enviadas para o Médico:",
        db.triagens.length
    );

    res.json(db.triagens);

});


/* =====================================================
   TV - CHAMAR PACIENTE
===================================================== */

app.post("/tv/chamar", (req, res) => {

    const db = readDB();


    const chamada = {

        id: Date.now().toString(),

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


    db.tv_chamada = chamada;

    db.tv_historico.unshift(chamada);


    if (db.tv_historico.length > 5) {

        db.tv_historico.pop();

    }


    writeDB(db);


    res.json(chamada);

});


/* =====================================================
   TV - CONSULTAR CHAMADA
===================================================== */

app.get("/tv/chamada", (req, res) => {

    const db = readDB();


    res.json({

        chamada: db.tv_chamada,

        historico: db.tv_historico

    });

});


/* =====================================================
   LISTA DE MEDICAÇÕES
===================================================== */

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


/* =====================================================
   CONSULTA
===================================================== */

app.post("/consulta", (req, res) => {

    const db = readDB();


    const consulta = {

        id: Date.now(),

        paciente:
            req.body.paciente || "",

        diagnostico:
            req.body.diagnostico || "",

        medicacao:
            req.body.medicacao || "",

        obs:
            req.body.obs || "",

        createdAt: new Date()

    };


    db.consultas.push(consulta);

    writeDB(db);


    res.json(consulta);

});


/* =====================================================
   LISTAR CONSULTAS
===================================================== */

app.get("/medicacoes", (req, res) => {

    const db = readDB();

    res.json(db.consultas);

});


/* =====================================================
   PDFs
===================================================== */

/*
   Pasta onde os PDFs podem ficar:

   backend/
      pdfs/
         exame1.pdf
         exame2.pdf

*/

const PDF_FOLDER =
    path.join(__dirname, "pdfs");


if (!fs.existsSync(PDF_FOLDER)) {

    fs.mkdirSync(PDF_FOLDER, {
        recursive: true
    });

}


/*
   Permite abrir os arquivos PDF.
*/

app.use(
    "/arquivos-pdf",
    express.static(PDF_FOLDER)
);


/*
   Lista os PDFs.

   Exemplo:

   /pdfs?paciente=Maria
*/

app.get("/pdfs", (req, res) => {

    const paciente =
        req.query.paciente || "";


    try {

        const arquivos =
            fs.readdirSync(PDF_FOLDER);


        const pdfs =
            arquivos
                .filter(arquivo =>
                    arquivo
                        .toLowerCase()
                        .endsWith(".pdf")
                )
                .filter(arquivo => {

                    if (!paciente) {
                        return true;
                    }

                    return arquivo
                        .toLowerCase()
                        .includes(
                            paciente.toLowerCase()
                        );

                })
                .map(arquivo => ({

                    nome: arquivo,

                    url:
                        "/arquivos-pdf/" +
                        encodeURIComponent(
                            arquivo
                        )

                }));


        res.json(pdfs);

    } catch (erro) {

        console.error(
            "Erro ao carregar PDFs:",
            erro
        );

        res.status(500).json({

            erro:
                "Não foi possível carregar os PDFs."

        });

    }

});


/* =====================================================
   INICIAR SERVIDOR
===================================================== */

const PORT =
    process.env.PORT || 3000;


app.listen(PORT, () => {

    console.log("");
    console.log("================================");
    console.log("🏥 SENTINELA");
    console.log("================================");
    console.log(
        `🚀 Servidor rodando na porta ${PORT}`
    );
    console.log(
        `🌐 http://localhost:${PORT}`
    );
    console.log(
        `🩺 Triagens: http://localhost:${PORT}/triagens`
    );
    console.log(
        `📄 PDFs: http://localhost:${PORT}/pdfs`
    );
    console.log("================================");
    console.log("");

});
