import { DISCIPLINA_BASE_KEYS } from "@/lib/unr-curriculum"

export type TipoBiblioteca = "livro" | "resumo"

// Matérias com bibliografia robusta o bastante pra ter livro-texto/atlas
// E resumo de prova ao mesmo tempo -- pedido explícito do usuário pra
// Pediatria (4º e 5º ano compartilhando os mesmos livros). Todas as
// outras matérias por ano continuam só com "resumo"; Ciências Básicas
// continuam só com "livro" -- ver tiposDaMateria().
const MATERIAS_COM_LIBROS_E_RESUMOS = ["pediatria_4", "pediatria_5", "farmacologia"]

// Lista de tipos de pasta válidos pra uma matéria, na ordem em que devem
// aparecer na UI. A maioria das matérias tem só 1 tipo (nesse caso a
// navegação pula direto pra lista de arquivos, sem tela intermediária);
// só MATERIAS_COM_LIBROS_E_RESUMOS tem os dois, e aí sim aparece a
// escolha "Libros ou Resúmenes".
export function tiposDaMateria(materiaKey: string): TipoBiblioteca[] {
  if (MATERIAS_COM_LIBROS_E_RESUMOS.includes(materiaKey)) return ["livro", "resumo"]
  if ((DISCIPLINA_BASE_KEYS as readonly string[]).includes(materiaKey)) return ["livro"]
  return ["resumo"]
}
