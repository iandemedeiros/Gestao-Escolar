import { DomainsClient } from './domains.client.js';
const id = '123e4567-e89b-42d3-a456-426614174000';
describe('DomainsClient mocked HTTP', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv(
      'INTERNAL_AUTH_TOKEN',
      'fictional-internal-token-for-tests-at-least-32-bytes',
    );
    vi.stubEnv('ALUNOS_SERVICE_URL', 'http://127.0.0.1:3001');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it('sends credentials only to the protected domain endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ sub: id, role: 'ALUNO' }), { status: 200 }),
    );
    expect(
      await new DomainsClient().verify(
        'alunos',
        '11111111111',
        'fictional-password',
      ),
    ).toEqual({ sub: id, role: 'ALUNO' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe('http://127.0.0.1:3001/internal/auth/verify');
    expect(options.redirect).toBe('error');
    expect(options.headers['x-internal-auth-token']).toBe(
      process.env.INTERNAL_AUTH_TOKEN,
    );
  });
  it('maps domain invalid login to no principal', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    expect(
      await new DomainsClient().verify('alunos', '11111111111', 'wrong'),
    ).toBeNull();
  });
  it('rejects unexpected private fields in domain responses', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ sub: id, role: 'ALUNO', senha_hash: 'private' }),
      ),
    );
    await expect(
      new DomainsClient().verify('alunos', '11111111111', 'wrong'),
    ).rejects.toThrow('Autenticacao indisponivel.');
  });
  it('sanitizes network errors', async () => {
    fetchMock.mockRejectedValue(new Error('private URL'));
    await expect(
      new DomainsClient().verify('alunos', '11111111111', 'wrong'),
    ).rejects.toThrow('Autenticacao indisponivel.');
  });
  it('forwards the user token and maps incorrect current password', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(
      new DomainsClient().change(
        { sub: id, role: 'ALUNO' },
        'Bearer fictional',
        {},
      ),
    ).rejects.toThrow('Credenciais invalidas.');
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe(
      'Bearer fictional',
    );
  });
});
