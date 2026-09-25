// preDeployCommand del backend en Railway (ver docs/DESPLIEGUE_RAILWAY.md).
// Migraciones en cada despliegue; seeds solo en una base recien creada, porque sequelize no
// registra que seeds ya corrieron y create-payment-settings duplica filas si se repite.
const { execSync } = require("child_process");
const { Client } = require("pg");

const correr = comando => execSync(comando, { stdio: "inherit" });

const yaSembrada = async () => {
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });
  await db.connect();
  try {
    // requireApproval de la empresa 1 lo crea el ultimo seed (20260907130000-create-host-settings)
    // o, en instalaciones anteriores, la migracion 20260905140000.
    const { rows } = await db.query(
      `select 1 from "Settings" where key = 'requireApproval' and "companyId" = 1 limit 1`
    );
    return rows.length > 0;
  } finally {
    await db.end();
  }
};

(async () => {
  correr("npx sequelize db:migrate");

  if (await yaSembrada()) {
    console.log("predeploy: la base ya tiene los datos iniciales, no se ejecutan seeds");
    return;
  }

  console.log("predeploy: base nueva, ejecutando seeds");
  correr("npx sequelize db:seed:all");
})().catch(err => {
  console.error(`predeploy: ${err.message}`);
  process.exit(1);
});
