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
            tv_chamada: null,
            tv_historico: []
        };
    }

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

    // NOVO: banco de altas
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

    db.pacientes.push(paciente);

    writeDB(db);

    console.log(
        "👤 Paciente cadastrado:",
        paciente.nome
    );

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

    let risco =
        req.body.risco;

    if (temperatura >= 39) {

        risco = "vermelho";

    } else if (temperatura >= 38) {

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
            Number.isFinite(temperatura)
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

    db.triagens.push(triagem);

    // Atualiza o paciente cadastrado
    const paciente =
        db.pacientes.find(
            p => p.nome === triagem.nome
        );

    if (paciente) {

        paciente.status =
            "aguardando_medico";
    }

    writeDB(db);

    console.log(
        "🩺 Paciente enviado para o médico:",
        triagem.nome
    );

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

    console.log(
        "📋 Pacientes aguardando médico:",
        triagens.length
    );

    res.json(triagens);
});

// ===============================
// TV
// ===============================

app.post("/tv/chamar", (req, res) => {

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

    if (db.tv_historico.length > 5) {

        db.tv_historico.pop();
    }

    writeDB(db);

    res.json(chamada);
});

// ===============================
// CONSULTAR TV
// ===============================

app.get("/tv/chamada", (req, res) => {

    const db = readDB();

    res.json({

        chamada:
            db.tv_chamada,

        historico:
            db.tv_historico

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
// CONSULTA MÉDICA
// ===============================

app.post("/consulta", (req, res) => {

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

    // Marca a triagem como atendida
    const triagem =
        db.triagens.find(t =>
            t.nome === consulta.paciente &&
            (
                !t.status ||
                t.status === "aguardando_medico"
            )
        );

    if (triagem) {

        triagem.status =
            "atendido";
    }

    // Marca paciente como atendido
    const paciente =
        db.pacientes.find(
            p => p.nome === consulta.paciente
        );

    if (paciente) {

        paciente.status =
            "atendido";
    }

    writeDB(db);

    console.log(
        "✅ Consulta salva:",
        consulta.paciente
    );

    res.json(consulta);
});

// ===============================
// LISTAR CONSULTAS
// ===============================

app.get("/medicacoes", (req, res) => {

    const db = readDB();

    res.json(
        db.consultas
    );
});

// =====================================================
// ALTA DO PACIENTE
// =====================================================

app.post("/alta", (req, res) => {

    const db = readDB();

    const pacienteNome =
        req.body.paciente || "";

    const tipoAlta =
        req.body.tipoAlta || "";

    const motivo =
        req.body.motivo || "";

    const orientacoes =
        req.body.orientacoes || "";

    const observacoes =
        req.body.observacoes || "";


    // Verifica paciente
    if (!pacienteNome.trim()) {

        return res.status(400).json({

            erro:
                "Paciente não informado."

        });
    }


    // Verifica tipo de alta
    if (!tipoAlta.trim()) {

        return res.status(400).json({

            erro:
                "Tipo de alta não informado."

        });
    }


    // Verifica motivo
    if (!motivo.trim()) {

        return res.status(400).json({

            erro:
                "Motivo da alta não informado."

        });
    }


    // Procura o paciente
    const paciente =
        db.pacientes.find(
            p => p.nome === pacienteNome
        );


    if (!paciente) {

        return res.status(404).json({

            erro:
                "Paciente não encontrado."

        });
    }


    // Procura a triagem
    const triagem =
        db.triagens.find(t =>
            t.nome === pacienteNome &&
            (
                !t.status ||
                t.status === "aguardando_medico" ||
                t.status === "atendido"
            )
        );


    // Cria a alta
    const alta = {

        id:
            Date.now(),

        paciente:
            pacienteNome,

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


    // Salva no banco
    db.altas.push(
        alta
    );


    // Atualiza triagem
    if (triagem) {

        triagem.status =
            "alta";
    }


    // Atualiza paciente
    paciente.status =
        "alta";


    writeDB(db);


    console.log(
        "🟢 Alta registrada:",
        pacienteNome
    );


    res.json({

        sucesso:
            true,

        mensagem:
            "Alta registrada com sucesso!",

        alta:
            alta

    });

});

// =====================================================
// LISTAR ALTAS
// =====================================================

app.get("/altas", (req, res) => {

    const db = readDB();

    res.json(
        db.altas
    );
});

// =====================================================
// BUSCAR ALTA DE UM PACIENTE
// =====================================================

app.get("/alta", (req, res) => {

    const db = readDB();

    const paciente =
        String(
            req.query.paciente || ""
        ).trim();


    if (!paciente) {

        return res.status(400).json({

            erro:
                "Informe o paciente."

        });
    }


    const altas =
        db.altas.filter(
            a => a.paciente === paciente
        );


    res.json(
        altas
    );
});

// =====================================================
// PDFs
// =====================================================

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


// Permite abrir os PDFs pelo navegador
app.use(
    "/arquivos-pdf",
    express.static(
        PDF_FOLDER
    )
);

// =====================================================
// FUNÇÃO PARA LIMPAR NOME
// =====================================================

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

// =====================================================
// RECEBER PDF
// Sem multer
// =====================================================

app.post("/pdfs/upload", (req, res) => {

    const contentType =
        req.headers["content-type"] || "";


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


    req.on("data", parte => {

        partes.push(
            parte
        );

    });


    req.on("end", () => {

        try {

            const buffer =
                Buffer.concat(
                    partes
                );


            const marcador =
                Buffer.from(
                    "--" + boundary
                );


            const campos = [];

            let inicio = 0;


            while (true) {

                const posicao =
                    buffer.indexOf(
                        marcador,
                        inicio
                    );


                if (posicao === -1) {

                    break;
                }


                if (posicao !== inicio) {

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


                    if (parte.length > 0) {

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
                const parte of campos
            ) {

                const separador =
                    Buffer.from(
                        "\r\n\r\n"
                    );


                const cabecalhoFim =
                    parte.indexOf(
                        separador
                    );


                if (
                    cabecalhoFim === -1
                ) {

                    continue;
                }


                const cabecalho =
                    parte
                        .slice(
                            0,
                            cabecalhoFim
                        )
                        .toString(
                            "utf8"
                        );


                let conteudo =
                    parte.slice(
                        cabecalhoFim +
                        separador.length
                    );


                // Remove CRLF final
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


            const nomeArquivo =
                limparNome(
                    path.basename(
                        arquivoPDF.nome,
                        ".pdf"
                    )
                );


            const arquivoFinal =
                `${nomePaciente}_${Date.now()}_${nomeArquivo}.pdf`;


            const caminho =
                path.join(
                    PDF_FOLDER,
                    arquivoFinal
                );


            fs.writeFileSync(
                caminho,
                arquivoPDF.conteudo
            );


            console.log(
                "📄 PDF recebido:",
                arquivoFinal
            );


            res.json({

                sucesso:
                    true,

                mensagem:
                    "PDF enviado com sucesso!",

                arquivo:
                    arquivoFinal,

                url:
                    "/arquivos-pdf/" +
                    encodeURIComponent(
                        arquivoFinal
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
    });


    req.on("error", erro => {

        console.error(
            "Erro no upload:",
            erro
        );


        if (!res.headersSent) {

            res.status(500).json({

                erro:
                    "Erro durante o envio do PDF."

            });
        }
    });

});

// =====================================================
// LISTAR PDFs
// =====================================================

app.get("/pdfs", (req, res) => {

    const paciente =
        String(
            req.query.paciente || ""
        )
        .trim()
        .toLowerCase();


    try {

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
});

// =====================================================
// TESTE
// =====================================================

app.get("/teste", (req, res) => {

    res.json({

        sucesso:
            true,

        mensagem:
            "Servidor do Sentinela funcionando!"

    });
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================

const PORT =
    process.env.PORT || 3000;


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
            `🩺 Triagens: http://localhost:${PORT}/triagens`
        );

        console.log(
            `📄 PDFs: http://localhost:${PORT}/pdfs`
        );

        console.log(
            `🟢 Altas: http://localhost:${PORT}/altas`
        );

        console.log(
            "===================================="
        );

    }
);
