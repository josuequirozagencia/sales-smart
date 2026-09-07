import nodemailer from "nodemailer";

export interface MailData {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function SendMail(mailData: MailData) {
  const options: any = {
    host: process.env.MAIL_HOST,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    },
    // Topes de espera.
    //
    // Sin ellos, un servidor de correo que no contesta deja la peticion
    // colgada hasta que el sistema operativo se rinde, que pueden ser
    // minutos. Como este helper se llama DENTRO de operaciones que el
    // usuario esta esperando —aprobar una empresa, registrarse—, eso
    // convierte un correo mal configurado en una pantalla congelada.
    //
    // Con tope, el envio falla, se anota, y la operacion sigue.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  };

  const transporter = nodemailer.createTransport(options);

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: process.env.MAIL_FROM, // sender address
    to: mailData.to, // list of receivers
    subject: mailData.subject, // Subject line
    text: mailData.text, // plain text body
    html: mailData.html || mailData.text // html body
  });

  console.log("Message sent: %s", info.messageId);
  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

  // Preview only available when sending through an Ethereal account
  console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
}
