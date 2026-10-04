export interface DesafioParaBloqueio {
  id: string
  titulo: string
  secao: string | null
  area: string | null
}

export function extrairNumeroCaso(titulo: string): number | null {
  const m = titulo.match(/^Caso (\d+)/i)
  return m ? Number(m[1]) : null
}

/**
 * Plano gratuito só acessa o primeiro caso ("Caso 1") de cada seção. Nos
 * planos pagos o aluno escolhe livremente qualquer caso, sem precisar
 * aprovar os anteriores antes.
 */
export function bloqueadoPorPlano(desafio: DesafioParaBloqueio, hasFullAccess: boolean): boolean {
  if (hasFullAccess || desafio.area === "Clínica Médica") return false
  const numero = extrairNumeroCaso(desafio.titulo)
  return numero !== null && numero > 1
}
