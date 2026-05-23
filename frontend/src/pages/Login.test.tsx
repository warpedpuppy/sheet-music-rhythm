import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { TokenResponse } from '../api/types'
import { AuthProvider } from '../auth/AuthContext'
import { Login } from './Login'

const TOKEN_RESPONSE: TokenResponse = {
  access_token: 'token-123',
  token_type: 'bearer',
  user: { id: 1, username: 'student', is_admin: false, created_at: '2026-01-01T00:00:00Z' },
}

function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('Login', () => {
  it('logs in and stores the token', async () => {
    const loginSpy = vi.spyOn(api, 'login').mockResolvedValue(TOKEN_RESPONSE)
    renderLogin()
    await userEvent.type(screen.getByLabelText('Username'), 'student')
    await userEvent.type(screen.getByLabelText('Password'), 'password1')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await waitFor(() => expect(loginSpy).toHaveBeenCalledWith('student', 'password1'))
    await waitFor(() =>
      expect(localStorage.getItem('rhythm-trainer-token')).toBe('token-123'),
    )
  })

  it('shows the error message when login fails', async () => {
    vi.spyOn(api, 'login').mockRejectedValue(new Error('Incorrect username or password.'))
    renderLogin()
    await userEvent.type(screen.getByLabelText('Username'), 'student')
    await userEvent.type(screen.getByLabelText('Password'), 'nope99')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Incorrect username or password.',
    )
  })
})
