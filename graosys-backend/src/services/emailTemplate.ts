// Layout dos e-mails da plataforma (paleta preto e branco da GraoSys). Tabelas e estilos inline: é o que
// Gmail, Outlook e clientes de celular renderizam de forma consistente.
export const LOGO_CID = "graosys-logo";

const esc = (v: string) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export interface PlatformEmail {
  preheader: string; // prévia exibida na caixa de entrada
  title: string;
  paragraphs: string[]; // texto simples (será escapado)
  button?: { label: string; url: string };
  note?: string; // observação em cinza abaixo do botão
}

export function renderPlatformEmail(e: PlatformEmail): { html: string; text: string } {
  const font = "font-family:Arial,Helvetica,sans-serif";
  const p = (t: string) => `<p style="margin:0 0 16px;${font};font-size:15px;line-height:24px;color:#262626">${esc(t)}</p>`;
  const button = e.button
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px"><tr>
         <td style="border-radius:8px;background:#0A0A0A">
           <a href="${esc(e.button.url)}" style="display:inline-block;padding:14px 28px;${font};font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:8px">${esc(e.button.label)}</a>
         </td></tr></table>
       <p style="margin:0 0 16px;${font};font-size:12px;line-height:18px;color:#737373">Se o botão não funcionar, copie e cole este endereço no navegador:<br>
         <a href="${esc(e.button.url)}" style="color:#0A0A0A;word-break:break-all">${esc(e.button.url)}</a></p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(e.title)}</title></head>
<body style="margin:0;padding:0;background:#F5F5F5">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(e.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F5F5F5">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px">
        <tr><td style="background:#0A0A0A;border-radius:12px 12px 0 0;padding:22px 32px">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="vertical-align:middle"><img src="cid:${LOGO_CID}" width="40" height="40" alt="GraoSys" style="display:block;border:0;border-radius:9px;background:#FFFFFF"></td>
            <td style="vertical-align:middle;padding-left:12px;${font};font-size:22px;font-weight:bold;color:#FFFFFF;letter-spacing:-0.3px">GraoSys</td>
          </tr></table>
        </td></tr>
        <tr><td style="background:#FFFFFF;border-radius:0 0 12px 12px;padding:32px;border:1px solid #E5E5E5;border-top:0">
          <h1 style="margin:0 0 20px;${font};font-size:22px;line-height:30px;color:#0A0A0A">${esc(e.title)}</h1>
          ${e.paragraphs.map(p).join("\n          ")}
          ${button}
          ${e.note ? `<p style="margin:0;${font};font-size:13px;line-height:20px;color:#737373">${esc(e.note)}</p>` : ""}
        </td></tr>
        <tr><td align="center" style="padding:20px 16px;${font};font-size:12px;line-height:18px;color:#A3A3A3">
          GraoSys · Gestão para corretoras de grãos<br>
          <a href="https://sistema.graosys.com.br" style="color:#737373">sistema.graosys.com.br</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    "GraoSys", "", e.title, "", ...e.paragraphs.flatMap((t) => [t, ""]),
    ...(e.button ? [`${e.button.label}: ${e.button.url}`, ""] : []),
    ...(e.note ? [e.note, ""] : []),
    "GraoSys · sistema.graosys.com.br",
  ].join("\n");

  return { html, text };
}
