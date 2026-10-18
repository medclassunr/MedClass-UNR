import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

// Igual a requireAdmin, mas sem checar role -- qualquer conta autenticada
// (aluno comum incluso). Usado nas rotas da Biblioteca (listar/baixar
// arquivo do Drive), que não são restritas a admin.
export async function requireUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return null

  const admin = createAdminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null

  return data.user
}
