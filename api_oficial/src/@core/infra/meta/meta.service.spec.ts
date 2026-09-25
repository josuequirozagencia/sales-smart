import { MetaService } from './meta.service';

// Respuesta minima de fetch: solo lo que usa getListTemplates.
const respuesta = (status: number, cuerpo: any) =>
  ({ status, json: async () => cuerpo }) as any;

const plantilla = (name: string) => ({
  id: name,
  name,
  language: 'es',
  status: 'APPROVED',
  category: 'MARKETING',
  components: [],
});

describe('MetaService.getListTemplates', () => {
  const fetchOriginal = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('recorre todas las paginas siguiendo paging.next', async () => {
    fetchMock
      .mockResolvedValueOnce(
        respuesta(200, {
          data: [plantilla('a'), plantilla('b')],
          paging: { cursors: { before: '1', after: '2' }, next: 'https://graph/p2' },
        }),
      )
      .mockResolvedValueOnce(
        respuesta(200, {
          data: [plantilla('c')],
          paging: { cursors: { before: '3', after: '4' }, next: 'https://graph/p3' },
        }),
      )
      .mockResolvedValueOnce(
        respuesta(200, {
          data: [plantilla('d')],
          paging: { cursors: { before: '5', after: '6' } },
        }),
      );

    const resultado = await new MetaService().getListTemplates('123', 'tok');

    expect(resultado.data.map((p) => p.name)).toEqual(['a', 'b', 'c', 'd']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://graph.facebook.com/v20.0/123/message_templates?limit=100',
    );
    expect(fetchMock.mock.calls[1][0]).toBe('https://graph/p2');
    expect(fetchMock.mock.calls[2][0]).toBe('https://graph/p3');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });

  it('con una sola pagina hace una sola peticion', async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(200, { data: [plantilla('a')], paging: { cursors: {} } }),
    );

    const resultado = await new MetaService().getListTemplates('123', 'tok');

    expect(resultado.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('no sigue paginando para siempre', async () => {
    fetchMock.mockImplementation(async () =>
      respuesta(200, {
        data: [plantilla('x')],
        paging: { cursors: {}, next: 'https://graph/otra' },
      }),
    );

    const resultado = await new MetaService().getListTemplates('123', 'tok');

    expect(fetchMock).toHaveBeenCalledTimes(20);
    expect(resultado.data).toHaveLength(20);
  });

  it('si Meta rechaza una pagina, falla como antes', async () => {
    fetchMock
      .mockResolvedValueOnce(
        respuesta(200, {
          data: [plantilla('a')],
          paging: { cursors: {}, next: 'https://graph/p2' },
        }),
      )
      .mockResolvedValueOnce(
        respuesta(400, { error: { message: 'Invalid OAuth access token' } }),
      );

    await expect(
      new MetaService().getListTemplates('123', 'tok'),
    ).rejects.toThrow('Erro ao enviar a mensagem');
  });
});
