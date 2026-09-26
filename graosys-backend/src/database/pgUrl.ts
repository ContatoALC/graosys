// O pg já trata prefer/require/verify-ca como verify-full (valida o certificado) e avisa que isso
// vai mudar no pg v9; fixamos verify-full explicitamente para manter a segurança atual sem o aviso.
export function withExplicitSslMode(url: string | undefined): string | undefined {
  return url?.replace(/([?&]sslmode=)(prefer|require|verify-ca)\b/i, "$1verify-full");
}
