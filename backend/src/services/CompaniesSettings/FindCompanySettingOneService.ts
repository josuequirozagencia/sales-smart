/**
 * @TercioSantos-0 |
 * serviço/todas as configurações de 1 empresa |
 * @param:companyId
 *
 * El nombre de la columna venia de la query y se pegaba dentro del SELECT, lo
 * que permitia leer lo que no era este ajuste. Pasa por la misma lista blanca
 * que la escritura.
 */
import CompaniesSettings from "../../models/CompaniesSettings";
import { exigirColumna } from "./ColumnasCompanySettings";

type Params = {
  companyId: any;
  column: string;
};

const FindCompanySettingOneService = async ({
  companyId,
  column
}: Params): Promise<any> => {
  const columna = exigirColumna(column);

  const ajustes = await CompaniesSettings.findOne({
    where: { companyId },
    attributes: [columna]
  });

  // Siempre una fila: quien lo llama lee resultado[0].<columna>, y una empresa
  // sin ajustes lo dejaba en undefined y reventaba ahi.
  return [{ [columna]: ajustes ? ajustes.get(columna as any) : null }];
};

export default FindCompanySettingOneService;
