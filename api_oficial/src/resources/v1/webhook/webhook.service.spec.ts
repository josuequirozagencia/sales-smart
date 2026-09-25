import { WebhookService } from './webhook.service';

// Reenvio del referral de anuncios Click-to-WhatsApp al CRM.
//
// api_oficial no hace nada con el ctwa_clid: solo lo pasa, junto al mensaje,
// por el socket que ya usa (receivedMessageWhatsAppOficial). El CRM lo
// guarda y lo usa para atribuir conversiones en Meta. Ver
// docs/META_CONVERSIONS_API.md en el repositorio.

const CTWA_CLID =
  'ARAkLkA8rmlFeiCktEJQ-QTwRiyYHAFDLMNDBH0CD3qpjd0HR4irJ6LEkR7JwFF4XvnO';

const referralDeMeta = {
  source_url: 'https://fb.me/abc123',
  source_type: 'ad',
  source_id: '120210000000000',
  headline: 'Curso de marketing',
  body: 'Inscribete hoy',
  media_type: 'image',
  image_url: 'https://scontent.xx.fbcdn.net/imagen.jpg',
  video_url: '',
  thumbnail_url: 'https://scontent.xx.fbcdn.net/miniatura.jpg',
  ctwa_clid: CTWA_CLID,
};

const mensajeTexto = (extra: Record<string, any> = {}) => ({
  from: '593991234567',
  id: `wamid.${Math.random().toString(36).slice(2)}`,
  timestamp: '1789400000',
  type: 'text',
  text: { body: 'Hola, vi su anuncio' },
  ...extra,
});

const webhook = (value: Record<string, any>) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15550783881',
              phone_number_id: '106540352242922',
            },
            ...value,
          },
        },
      ],
    },
  ],
});

const conMensajes = (...messages: any[]) =>
  webhook({
    contacts: [{ profile: { name: 'Cliente Anuncio' }, wa_id: '593991234567' }],
    messages,
  });

describe('WebhookService: referral de anuncios', () => {
  let service: WebhookService;
  let socket: { sendMessage: jest.Mock; readMessage: jest.Mock };
  let prisma: any;

  beforeEach(() => {
    socket = { sendMessage: jest.fn(), readMessage: jest.fn() };
    prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: 7, idEmpresaMult100: 42 }),
      },
      whatsappOficial: {
        findFirst: jest.fn().mockResolvedValue({
          id: 3,
          companyId: 7,
          token_mult100: 'TOKEN-DE-LA-CONEXION',
          phone_number: '+15550783881',
          send_token: 'x',
          use_rabbitmq: false,
          // Sin webhooks externos: forwardToWebhook no llama a nadie.
          n8n_webhook_url: null,
          chatwoot_webhook_url: null,
          typebot_webhook_url: null,
          crm_webhook_url: null,
        }),
      },
    };

    service = new WebhookService(
      { sendToRabbitMQ: jest.fn() } as any,
      { prisma } as any,
      { get: jest.fn().mockResolvedValue(null), set: jest.fn() } as any,
      socket as any,
      { downloadFileMeta: jest.fn() } as any,
    );
  });

  it('reenvia el referral por el socket con los campos que usa el CRM y sin las URLs de medios', async () => {
    await service.webhookCompanyConexao(
      7,
      3,
      conMensajes(mensajeTexto({ referral: referralDeMeta })),
    );

    expect(socket.sendMessage).toHaveBeenCalledTimes(1);
    const enviado = socket.sendMessage.mock.calls[0][0];

    expect(enviado.message.referral).toEqual({
      ctwa_clid: CTWA_CLID,
      source_id: '120210000000000',
      source_type: 'ad',
      source_url: 'https://fb.me/abc123',
      headline: 'Curso de marketing',
      media_type: 'image',
    });
    expect(enviado.message.referral.image_url).toBeUndefined();
    expect(enviado.message.referral.thumbnail_url).toBeUndefined();

    // Lo demas del mensaje sigue igual que antes.
    expect(enviado.message.text).toBe('Hola, vi su anuncio');
    expect(enviado.message.timestamp).toBe(1789400000);
    expect(enviado.token).toBe('TOKEN-DE-LA-CONEXION');
    expect(enviado.companyId).toBe(42);
    expect(enviado.fromNumber).toBe('593991234567');
  });

  it('sin referral el mensaje se reenvia igual y sin ese campo', async () => {
    await service.webhookCompanyConexao(7, 3, conMensajes(mensajeTexto()));

    expect(socket.sendMessage).toHaveBeenCalledTimes(1);
    const enviado = socket.sendMessage.mock.calls[0][0];
    expect(enviado.message.referral).toBeUndefined();
    expect(enviado.message.text).toBe('Hola, vi su anuncio');
  });

  it('en un lote, cada mensaje lleva solo su propio referral', async () => {
    await service.webhookCompanyConexao(
      7,
      3,
      conMensajes(
        mensajeTexto({ referral: referralDeMeta }),
        mensajeTexto({ text: { body: 'Segundo mensaje' } }),
      ),
    );

    expect(socket.sendMessage).toHaveBeenCalledTimes(2);
    expect(socket.sendMessage.mock.calls[0][0].message.referral.ctwa_clid).toBe(CTWA_CLID);
    expect(socket.sendMessage.mock.calls[1][0].message.referral).toBeUndefined();
  });

  it('los avisos de estado no reenvian mensajes ni referral', async () => {
    await service.webhookCompanyConexao(
      7,
      3,
      webhook({ statuses: [{ id: 'wamid.X', status: 'read' }] }),
    );

    expect(socket.sendMessage).not.toHaveBeenCalled();
    expect(socket.readMessage).toHaveBeenCalledTimes(1);
  });

  it('busca la conexion con la empresa y la conexion de la URL', async () => {
    await service.webhookCompanyConexao(
      7,
      3,
      conMensajes(mensajeTexto({ referral: referralDeMeta })),
    );

    expect(prisma.whatsappOficial.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3, companyId: 7, deleted_at: null },
      }),
    );
  });
});
