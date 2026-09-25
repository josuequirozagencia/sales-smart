import fs from "fs";
import os from "os";
import path from "path";
import XLSX from "xlsx";
import { ImportContactsService } from "../../services/ContactServices/ImportContactsService";
import Contact from "../../models/Contact";
import { closeConnection, getSeededCompany, uniqueSuffix } from "../helpers/db";

// Exercita a importação de contatos a partir de uma planilha de verdade.
//
// Existe por causa da troca do xlsx 0.18.5 (npm, com prototype pollution e
// ReDoS conhecidos) pelo 0.20.3 vindo do CDN oficial da SheetJS. É justamente
// este caminho — XLSX.readFile sobre um arquivo enviado pelo usuário — que a
// atualização poderia quebrar, então convém provar que continua funcionando.

const COMPANY_ID = 1;
const createdNumbers: string[] = [];
const tempFiles: string[] = [];

const makeSheet = (rows: Record<string, string>[]): string => {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Contatos");

  const file = path.join(os.tmpdir(), `contatos-${uniqueSuffix()}.xlsx`);
  XLSX.writeFile(workbook, file);
  tempFiles.push(file);

  return file;
};

// O serviço recebe um Express.Multer.File, mas só usa a propriedade `path`.
const asUpload = (filePath: string) =>
  ({ path: filePath } as Express.Multer.File);

beforeAll(async () => {
  await getSeededCompany();
});

afterAll(async () => {
  await Contact.destroy({ where: { number: createdNumbers } });
  tempFiles.forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
  await closeConnection();
});

describe("ImportContactsService", () => {
  it("importa contatos de uma planilha", async () => {
    const suffix = uniqueSuffix().slice(-6);
    const numero = `5511${suffix}0`;
    createdNumbers.push(numero);

    const file = makeSheet([
      { nome: "Ana Teste", numero, email: "ana@exemplo.test" }
    ]);

    const imported = await ImportContactsService(COMPANY_ID, asUpload(file));

    expect(imported).toHaveLength(1);
    expect(imported[0].name).toBe("Ana Teste");
    expect(imported[0].number).toBe(numero);
    expect(imported[0].email).toBe("ana@exemplo.test");
  });

  it("aceita os cabeçalhos capitalizados e com acento", async () => {
    const suffix = uniqueSuffix().slice(-6);
    const numero = `5511${suffix}1`;
    createdNumbers.push(numero);

    // O serviço aceita nome/Nome, numero/número/Numero/Número, email/E-mail.
    const file = makeSheet([
      { Nome: "Bruno Teste", Número: numero, "E-mail": "bruno@exemplo.test" }
    ]);

    const imported = await ImportContactsService(COMPANY_ID, asUpload(file));

    expect(imported).toHaveLength(1);
    expect(imported[0].name).toBe("Bruno Teste");
    expect(imported[0].email).toBe("bruno@exemplo.test");
  });

  it("remove a formatação do número", async () => {
    const suffix = uniqueSuffix().slice(-6);
    const numero = `5511${suffix}2`;
    createdNumbers.push(numero);

    const file = makeSheet([
      { nome: "Carla Teste", numero: `+${numero.slice(0, 2)} (${numero.slice(2, 4)}) ${numero.slice(4)}` }
    ]);

    const imported = await ImportContactsService(COMPANY_ID, asUpload(file));

    expect(imported).toHaveLength(1);
    expect(imported[0].number).toBe(numero);
  });

  it("não duplica um contato já existente", async () => {
    const suffix = uniqueSuffix().slice(-6);
    const numero = `5511${suffix}3`;
    createdNumbers.push(numero);

    const file = makeSheet([{ nome: "Diego Teste", numero }]);

    const primeira = await ImportContactsService(COMPANY_ID, asUpload(file));
    expect(primeira).toHaveLength(1);

    // Só devolve os criados: na segunda passada não há nada novo.
    const segunda = await ImportContactsService(COMPANY_ID, asUpload(file));
    expect(segunda).toHaveLength(0);

    const total = await Contact.count({
      where: { number: numero, companyId: COMPANY_ID }
    });
    expect(total).toBe(1);
  });
});
