// =====================================================
// ALTA DO PACIENTE
// =====================================================

function criarPDFAlta(paciente, alta) {

    const escapePDF = texto =>
        String(texto || "")
            .replace(/\\/g, "\\\\")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)");

    const linhas = [
        "SENTINELA - ALTA DO PACIENTE",
        "",
        "Paciente: " + paciente.nome,
        "CPF: " + (paciente.cpf || "Não informado"),
        "Tipo de alta: " + alta.tipoAlta,
        "",
        "Motivo:",
        alta.motivo,
        "",
        "Orientações:",
        alta.orientacoes || "Não informado",
        "",
        "Observações:",
        alta.observacoes || "Não informado",
        "",
        "Data: " +
            new Date(alta.createdAt).toLocaleString("pt-BR")
    ];

    let y = 760;

    let conteudo = "BT\n/F1 12 Tf\n";

    for (const linha of linhas) {

        conteudo +=
            `1 0 0 1 50 ${y} Tm (${escapePDF(linha)}) Tj\n`;

        y -= 22;

        if (y < 50) {
            break;
        }
    }

    conteudo += "ET";

    const objetos = [];

    objetos[1] =
        "<< /Type /Catalog /Pages 2 0 R >>";

    objetos[2] =
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";

    objetos[3] =
        "<< /Type /Page /Parent 2 0 R " +
        "/MediaBox [0 0 595 842] " +
        "/Resources << /Font << /F1 4 0 R >> >> " +
        "/Contents 5 0 R >>";

    objetos[4] =
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

    objetos[5] =
        `<< /Length ${Buffer.byteLength(conteudo, "utf8")} >>\nstream\n${conteudo}\nendstream`;

    let pdf = "%PDF-1.4\n";

    const offsets = [0];

    for (let i = 1; i <= 5; i++) {

        offsets[i] =
            Buffer.byteLength(pdf, "utf8");

        pdf += `${i} 0 obj\n`;
        pdf += `${objetos[i]}\n`;
        pdf += "endobj\n";
    }

    const inicioXref =
        Buffer.byteLength(pdf, "utf8");

    pdf += "xref\n";
    pdf += "0 6\n";
    pdf += "0000000000 65535 f \n";

    for (let i = 1; i <= 5; i++) {

        pdf +=
            String(offsets[i]).padStart(10, "0") +
            " 00000 n \n";
    }

    pdf += "trailer\n";
    pdf += "<< /Size 6 /Root 1 0 R >>\n";
    pdf += "startxref\n";
    pdf += `${inicioXref}\n`;
    pdf += "%%EOF";

    return Buffer.from(pdf, "utf8");
}


// =====================================================
// ALTA
// =====================================================

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
            db.pacientes.find(p => {

                return String(p.nome || "")
                    .trim()
                    .toLowerCase() ===
                    pacienteNome
                        .toLowerCase();

            });


        if (!paciente) {

            return res.status(404).json({
                erro: "Paciente não encontrado."
            });
        }


        const triagem =
            db.triagens.find(t => {

                return String(t.nome || "")
                    .trim()
                    .toLowerCase() ===
                    pacienteNome
                        .toLowerCase();

            });


        const alta = {

            id: Date.now(),

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


        db.altas.push(alta);


        if (triagem) {

            triagem.status =
                "alta";
        }


        paciente.status =
            "alta";


        // =================================================
        // GERAR PDF
        // =================================================

        const nomePaciente =
            limparNome(
                paciente.nome
            );

        const nomeArquivo =
            `alta_${nomePaciente}_${Date.now()}.pdf`;

        const caminhoPDF =
            path.join(
                PDF_FOLDER,
                nomeArquivo
            );


        const pdf =
            criarPDFAlta(
                paciente,
                alta
            );


        fs.writeFileSync(
            caminhoPDF,
            pdf
        );


        writeDB(db);


        console.log(
            "🟢 Alta registrada:",
            paciente.nome
        );

        console.log(
            "📄 PDF criado:",
            nomeArquivo
        );


        res.json({

            sucesso: true,

            mensagem:
                "Alta registrada com sucesso!",

            alta: alta,

            pdf: {
                nome:
                    nomeArquivo,

                url:
                    "/arquivos-pdf/" +
                    encodeURIComponent(
                        nomeArquivo
                    ),

                download:
                    "/baixar-alta/" +
                    encodeURIComponent(
                        nomeArquivo
                    )
            }

        });


    } catch (erro) {

        console.error(
            "❌ ERRO NA ALTA:",
            erro
        );

        res.status(500).json({

            erro:
                "Erro interno ao registrar a alta."

        });

    }

});


// =====================================================
// BAIXAR PDF DA ALTA
// =====================================================

app.get(
    "/baixar-alta/:arquivo",
    (req, res) => {

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

                erro:
                    "PDF não encontrado."

            });

        }


        res.download(
            caminho,
            arquivo
        );

    }
);


// =====================================================
// LISTAR ALTAS
// =====================================================

app.get("/altas", (req, res) => {

    const db =
        readDB();

    res.json(
        db.altas
    );

});


// =====================================================
// BUSCAR ALTA DE UM PACIENTE
// =====================================================

app.get("/alta", (req, res) => {

    const db =
        readDB();

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
                String(
                    a.paciente || ""
                )
                .trim()
                .toLowerCase() ===
                paciente
                    .toLowerCase()
        );


    res.json(
        altas
    );

});
