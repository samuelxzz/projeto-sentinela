const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "../frontend")));

const DB_FILE = path.join(__dirname, "db.json");


// =====================================================
// BANCO DE DADOS
// =====================================================

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

  const db =
    JSON.parse(
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

  if (!db.tv_chamada)
    db.tv_chamada = null;

  if (!Array.isArray(db.tv_historico))
    db.tv_historico = [];

  return db;
}


function writeDB(data) {

  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(data, null, 2)
  );

}


// =====================================================
// LOGIN
// =====================================================

app.post("/login", (req, res) => {

  const db = readDB();

  const user =
    db.usuarios.find(u =>
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


// =====================================================
// ATENDIMENTO
// =====================================================

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

  res.json(paciente);

});


// =====================================================
// LISTAR PACIENTES
// =====================================================

app.get("/pacientes", (req, res) => {

  const db = readDB();

  res.json(db.pacientes);

});


// =====================================================
// TRIAGEM
// =====================================================

app.post("/triagem", (req, res) => {

  const db = readDB();

  let risco =
    req.body.risco;

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

    nome:
      req.body.nome || "",

    sintoma:
      req.body.sintoma || "",

    temperatura:
      req.body.temperatura || "",

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

  const paciente =
    db.pacientes.find(
      p =>
        String(p.nome).trim().toLowerCase() ===
        String(triagem.nome).trim().toLowerCase()
    );

  if (paciente) {

    paciente.status =
      "aguardando_medico";

  }

  writeDB(db);

  res.json(triagem);

});


// =====================================================
// LISTAR TRIAGENS
// =====================================================

app.get("/triagens", (req, res) => {

  const db = readDB();

  res.json(db.triagens);

});


// =====================================================
// TV
// =====================================================

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

  if (
    db.tv_historico.length > 5
  ) {

    db.tv_historico.pop();

  }

  writeDB(db);

  res.json(chamada);

});


app.get("/tv/chamada", (req, res) => {

  const db = readDB();

  res.json({

    chamada:
      db.tv_chamada,

    historico:
      db.tv_historico

  });

});


// =====================================================
// MEDICAÇÕES
// =====================================================

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


// =====================================================
// CONSULTA
// =====================================================

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


  const paciente =
    db.pacientes.find(
      p =>
        String(p.nome).trim().toLowerCase() ===
        String(consulta.paciente).trim().toLowerCase()
    );

  if (paciente) {

    paciente.status =
      "atendido";

  }


  const triagem =
    db.triagens.find(
      t =>
        String(t.nome).trim().toLowerCase() ===
        String(consulta.paciente).trim().toLowerCase()
    );

  if (triagem) {

    triagem.status =
      "atendido";

  }


  writeDB(db);

  res.json(consulta);

});


// =====================================================
// MEDICAÇÕES / CONSULTAS
// =====================================================

app.get("/medicacoes", (req, res) => {

  const db = readDB();

  res.json(
    db.consultas
  );

});


// =====================================================
// PASTA DOS PDFs
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


// Permite abrir os PDFs
app.use(
  "/arquivos-pdf",
  express.static(
    PDF_FOLDER
  )
);


// =====================================================
// LIMPAR NOME
// =====================================================

function limparNome(nome) {

  return String(nome || "paciente")
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
    );

}


// =====================================================
// CRIAR PDF
// =====================================================

function criarPDF(paciente, alta) {

  function textoPDF(texto) {

    return String(texto || "")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");

  }


  const linhas = [

    "SENTINELA - ALTA DO PACIENTE",

    "",

    "Paciente: " +
      paciente.nome,

    "CPF: " +
      (paciente.cpf || "Nao informado"),

    "Tipo de alta: " +
      alta.tipoAlta,

    "",

    "Motivo:",

    alta.motivo,

    "",

    "Orientacoes:",

    alta.orientacoes ||
      "Nao informado",

    "",

    "Observacoes:",

    alta.observacoes ||
      "Nao informado",

    "",

    "Data: " +
      new Date(
        alta.createdAt
      ).toLocaleString("pt-BR")

  ];


  let y = 780;

  let conteudo =
    "BT\n" +
    "/F1 12 Tf\n";


  linhas.forEach(linha => {

    conteudo +=
      `1 0 0 1 50 ${y} Tm (${textoPDF(linha)}) Tj\n`;

    y -= 25;

  });


  conteudo +=
    "ET";


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
    `<< /Length ${Buffer.byteLength(conteudo, "utf8")} >>\n` +
    "stream\n" +
    conteudo +
    "\nendstream";


  let pdf =
    "%PDF-1.4\n";

  const offsets = [0];


  for (
    let i = 1;
    i <= 5;
    i++
  ) {

    offsets[i] =
      Buffer.byteLength(
        pdf,
        "utf8"
      );

    pdf +=
      `${i} 0 obj\n`;

    pdf +=
      objetos[i] +
      "\n";

    pdf +=
      "endobj\n";

  }


  const xref =
    Buffer.byteLength(
      pdf,
      "utf8"
    );


  pdf +=
    "xref\n";

  pdf +=
    "0 6\n";

  pdf +=
    "0000000000 65535 f \n";


  for (
    let i = 1;
    i <= 5;
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
    "<< /Size 6 /Root 1 0 R >>\n";

  pdf +=
    "startxref\n";

  pdf +=
    xref + "\n";

  pdf +=
    "%%EOF";


  return Buffer.from(
    pdf,
    "utf8"
  );

}


// =====================================================
// REGISTRAR ALTA + GERAR PDF
// =====================================================

app.post("/alta", (req, res) => {

  try {

    const db =
      readDB();


    const pacienteNome =
      String(
        req.body.paciente ||
        req.body.nome ||
        ""
      ).trim();


    const tipoAlta =
      String(
        req.body.tipoAlta ||
        "Alta médica"
      ).trim();


    const motivo =
      String(
        req.body.motivo ||
        "Paciente liberado pelo médico."
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

        erro:
          "Paciente não informado."

      });

    }


    const paciente =
      db.pacientes.find(
        p =>
          String(p.nome || "")
            .trim()
            .toLowerCase() ===
          pacienteNome
            .toLowerCase()
      );


    if (!paciente) {

      return res.status(404).json({

        erro:
          "Paciente não encontrado."

      });

    }


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


    db.altas.push(
      alta
    );


    paciente.status =
      "alta";


    const triagem =
      db.triagens.find(
        t =>
          String(t.nome || "")
            .trim()
            .toLowerCase() ===
          pacienteNome
            .toLowerCase()
      );


    if (triagem) {

      triagem.status =
        "alta";

    }


    const nomeArquivo =
      "alta_" +
      limparNome(
        paciente.nome
      ) +
      "_" +
      Date.now() +
      ".pdf";


    const caminhoPDF =
      path.join(
        PDF_FOLDER,
        nomeArquivo
      );


    const pdf =
      criarPDF(
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

      sucesso:
        true,

      mensagem:
        "Alta registrada com sucesso!",

      paciente:
        paciente.nome,

      pdf:
        "/arquivos-pdf/" +
        encodeURIComponent(
          nomeArquivo
        ),

      download:
        "/baixar-alta/" +
        encodeURIComponent(
          nomeArquivo
        )

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
// BAIXAR PDF
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
// LISTAR PDFs
// =====================================================

app.get("/pdfs", (req, res) => {

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


            const busca =
              limparNome(
                paciente
              ).toLowerCase();


            return arquivo
              .toLowerCase()
              .includes(busca);

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
      "Erro ao listar PDFs:",
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
  "0.0.0.0",
  () => {

    console.log(
      "🏥 Hospital Pro rodando na porta " +
      PORT
    );

    console.log(
      "📄 PDFs disponíveis em /pdfs"
    );

    console.log(
      "🟢 Alta disponível em POST /alta"
    );

  }
);
