import { timingSafeEqual } from 'crypto';

export function validarSenhaEstorno(password: unknown, expected: string | undefined) {
  if (!expected) return { status: 503, body: { error: 'Senha de estorno não configurada no servidor.' } };
  if (typeof password !== 'string' || !password) return { status: 400, body: { error: 'Informe a senha de estorno.' } };
  const providedBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return { status: 403, body: { error: 'Senha de estorno incorreta.' } };
  }
  return { status: 200, body: { ok: true } };
}
