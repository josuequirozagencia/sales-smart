/**
 * @TercioSantos-0 |
 * serviço/atualizar 1 configuração da empresa |
 * @params:companyId/column(name)/data
 *
 * La consulta se escribia a mano con el nombre de la columna y el valor
 * interpolados (`SET "${column}"='${data}'`): una comilla en el valor permitia
 * inyectar SQL y cambiar ajustes de otras empresas. Ahora la columna pasa por
 * lista blanca y el valor viaja como parametro del modelo.
 */
import CompaniesSettings from "../../models/CompaniesSettings";
import { exigirColumna, valorDeColumna } from "./ColumnasCompanySettings";

type Params = {
  companyId: number;
  column: string;
  data: unknown;
};

const UpdateCompanySettingsService = async ({
  companyId,
  column,
  data
}: Params): Promise<any> => {
  const columna = exigirColumna(column);
  const valor = valorDeColumna(columna, data);

  await CompaniesSettings.update({ [columna]: valor } as any, {
    where: { companyId }
  });

  return [{ [columna]: valor }];
};

export default UpdateCompanySettingsService;
