export interface IReceivedWhatsppOficial {
  token: string;
  fromNumber: string;
  nameContact: string;
  companyId: number;
  message: IMessageReceived;
}

export interface IReceivedWhatsppOficialRead {
  messageId: string;
  companyId: number;
  token: string;
}

export interface IMessageReceived {
  type:
    | 'text'
    | 'image'
    | 'audio'
    | 'document'
    | 'video'
    | 'location'
    | 'contacts'
    | 'order'
    | 'interactive'
    | 'referral'
    | 'sticker';
  timestamp: number;
  idMessage: string;
  text?: string;
  file?: string;
  mimeType?: string;
  idFile?: string;
  quoteMessageId?: string;
  /** Anuncio Click-to-WhatsApp del que viene el mensaje, si viene de uno. */
  referral?: IMessageReferral;
}

/**
 * Lo que el CRM necesita del referral de Meta para atribuir conversiones.
 * Sin las URLs de imagen y video: no se usan y engordarian cada mensaje.
 */
export interface IMessageReferral {
  ctwa_clid?: string;
  source_id?: string;
  source_type?: string;
  source_url?: string;
  headline?: string;
  media_type?: string;
}
