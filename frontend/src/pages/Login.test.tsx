import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { Login } from './Login'

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('Login', () => {
  it('logs in with the entered credentials', async () => {
    const loginSpy = vi.spyOn(api, 'login').mockResolvedValue({
      access_token: 'token-123',
      token_type: 'bearer',
      user: { id: 1, username: 'alice', is_admin: false, unlocked_level: 1 },
    })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/username/i), 'alice')
    await user.type(screen.getByLabelText(/password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => expect(loginSpy).toHaveBeenCalledWith('alice', 'secret123'))
    expect(localStorage.getItem('rhythm_token')).toBe('token-123')
  })

  it('shows an error message when login fails', async () => {
    vi.spyOn(api, 'login').mockRejectedValue(new ApiError(401, 'Incorrect username or password'))
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/username/i), 'alice')
    await user.type(screen.getByLabelText(/password/i), 'wrong-pass')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password')
  })
})
