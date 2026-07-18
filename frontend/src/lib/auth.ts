import { createContext, useContext } from "react"

export interface AuthUser {
  email: string
  name: string
  picture?: string | null
}

export interface AuthContextType {
  user: AuthUser | null
  token: string | null
  login: (credential: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => {},
  logout: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

const STORAGE_KEY = "fp_auth"

export function loadStoredAuth(): { user: AuthUser; token: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed.token || !parsed.user) return null
    return parsed
  } catch {
    return null
  }
}

export function storeAuth(user: AuthUser, token: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }))
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY)
}
